from rest_framework import permissions

class RBACPermission(permissions.BasePermission):
    """
    Role-Based Access Control (RBAC) permission based on X-User-Role request header.

    Role Permissions Matrix:
    -------------------------------------------------------------------------------------
    Role        | Read (GET) | Create Draft | Post to GL / Pay | Bank Reconcile | Period Lock
    -------------------------------------------------------------------------------------
    ADMIN       |    YES     |     YES      |       YES        |      YES       |    YES
    ACCOUNTANT  |    YES     |     YES      |       YES        |      YES       |    NO
    DATA_ENTRY  |    YES     |     YES      |       NO         |      NO        |    NO
    AUDITOR     |    YES     |     NO       |       NO         |      NO        |    NO
    -------------------------------------------------------------------------------------
    """
    def has_permission(self, request, view):
        role = request.headers.get('X-User-Role', 'ACCOUNTANT').upper()

        # 1. AUDITOR is strictly Read-Only across all endpoints
        if role == 'AUDITOR':
            return request.method in permissions.SAFE_METHODS

        # 2. Read-only requests (GET, HEAD, OPTIONS) are allowed for all active roles
        if request.method in permissions.SAFE_METHODS:
            return True

        view_name = getattr(view, '__class__', {}).__name__
        action = getattr(view, 'action', None)

        # 3. Period Lock management requires ADMIN role
        if view_name == 'PeriodLockViewSet':
            return role == 'ADMIN'

        # 4. DATA_ENTRY role restrictions
        if role == 'DATA_ENTRY':
            # Cannot post journal entries, reverse entries, or post invoices/bills to GL
            if action in ['post_entry', 'reverse_entry', 'post_to_ledger', 'upload_csv', 'match_ledger']:
                return False

            # Cannot record payments or vendor payments
            if view_name in ['PaymentRecordViewSet', 'VendorPaymentViewSet', 'BankStatementTransactionViewSet', 'BankReconciliationViewSet']:
                return False

            # Cannot delete records
            if request.method == 'DELETE':
                return False

        # 5. ACCOUNTANT & ADMIN have access to normal creation, posting, payment recording
        return True

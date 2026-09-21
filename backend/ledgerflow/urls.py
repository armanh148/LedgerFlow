from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.accounts.views import AccountViewSet, PeriodLockViewSet
from apps.ledger.views import JournalEntryViewSet, JournalItemViewSet
from apps.invoicing.views import CustomerViewSet, InvoiceViewSet, PaymentRecordViewSet
from apps.payables.views import VendorViewSet, BillViewSet, VendorPaymentViewSet
from apps.banking.views import BankAccountViewSet, BankStatementTransactionViewSet, BankReconciliationViewSet
from apps.core.views import AuditLogViewSet, DataExportView, DataImportView
from apps.reports.views import (
    TrialBalanceView, ProfitAndLossView, BalanceSheetView,
    ARAgingView, APAgingView, DashboardMetricsView
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'period-locks', PeriodLockViewSet, basename='periodlock')
router.register(r'journal-entries', JournalEntryViewSet, basename='journalentry')
router.register(r'journal-items', JournalItemViewSet, basename='journalitem')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentRecordViewSet, basename='payment')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'vendor-payments', VendorPaymentViewSet, basename='vendorpayment')
router.register(r'bank-accounts', BankAccountViewSet, basename='bankaccount')
router.register(r'bank-transactions', BankStatementTransactionViewSet, basename='banktransaction')
router.register(r'bank-reconciliations', BankReconciliationViewSet, basename='bankreconciliation')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/reports/trial-balance/', TrialBalanceView.as_view(), name='trial-balance'),
    path('api/reports/profit-loss/', ProfitAndLossView.as_view(), name='profit-loss'),
    path('api/reports/balance-sheet/', BalanceSheetView.as_view(), name='balance-sheet'),
    path('api/reports/ar-aging/', ARAgingView.as_view(), name='ar-aging'),
    path('api/reports/ap-aging/', APAgingView.as_view(), name='ap-aging'),
    path('api/reports/dashboard-metrics/', DashboardMetricsView.as_view(), name='dashboard-metrics'),
    path('api/data-hub/export/', DataExportView.as_view(), name='data-export'),
    path('api/data-hub/import/', DataImportView.as_view(), name='data-import'),
]


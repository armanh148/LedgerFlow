from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Vendor, Bill, BillStatus, VendorPayment
from .serializers import VendorSerializer, BillSerializer, VendorPaymentSerializer
from apps.accounts.models import Account, AccountCategory
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryType, JournalEntryStatus
from apps.ledger.services import PostingEngine
from apps.core.permissions import RBACPermission

class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone', 'tax_id']

class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all().prefetch_related('items', 'payments', 'vendor', 'journal_entry')
    serializer_class = BillSerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['bill_number', 'vendor__name', 'status']
    ordering_fields = ['issue_date', 'due_date', 'grand_total']

    @action(detail=True, methods=['post'], url_path='post-to-ledger')
    @transaction.atomic
    def post_to_ledger(self, request, pk=None):
        """Generates and posts double-entry voucher for vendor bill."""
        bill = self.get_object()
        if bill.status != BillStatus.DRAFT:
            return Response({"error": "Bill is already posted or processed."}, status=status.HTTP_400_BAD_REQUEST)

        ap_account = Account.objects.filter(code__startswith='20', category=AccountCategory.LIABILITY).first() or Account.objects.filter(category=AccountCategory.LIABILITY).first()
        exp_account = Account.objects.filter(code__startswith='5', category=AccountCategory.EXPENSE).first() or Account.objects.filter(category=AccountCategory.EXPENSE).first()

        if not ap_account or not exp_account:
            return Response({"error": "Chart of Accounts missing AP (2010) or Expense (5010) account."}, status=status.HTTP_400_BAD_REQUEST)

        entry = JournalEntry.objects.create(
            entry_number=f"JV-{bill.bill_number}",
            entry_type=JournalEntryType.BILL,
            date=bill.issue_date,
            status=JournalEntryStatus.DRAFT,
            narration=f"Vendor Bill #{bill.bill_number} from {bill.vendor.name}"
        )

        # Debit Expense for Subtotal
        JournalItem.objects.create(
            journal_entry=entry,
            account=exp_account,
            debit=bill.subtotal,
            credit=Decimal('0.00'),
            description=f"Expense - Bill #{bill.bill_number}"
        )

        # Debit Input Tax if tax_amount > 0
        if bill.tax_amount > 0:
            JournalItem.objects.create(
                journal_entry=entry,
                account=exp_account,
                debit=bill.tax_amount,
                credit=Decimal('0.00'),
                description=f"Input Tax - Bill #{bill.bill_number}"
            )

        # Credit Accounts Payable for Grand Total
        JournalItem.objects.create(
            journal_entry=entry,
            account=ap_account,
            debit=Decimal('0.00'),
            credit=bill.grand_total,
            description=f"AP - {bill.vendor.name}"
        )

        posted_entry = PostingEngine.post_entry(entry.id, user=request.user if request.user.is_authenticated else None)

        bill.journal_entry = posted_entry
        bill.status = BillStatus.RECEIVED
        bill.save()

        return Response(self.get_serializer(bill).data, status=status.HTTP_200_OK)

class VendorPaymentViewSet(viewsets.ModelViewSet):
    queryset = VendorPayment.objects.all().select_related('bill', 'journal_entry')
    serializer_class = VendorPaymentSerializer
    permission_classes = [RBACPermission]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        bill = payment.bill
        bank_account = Account.objects.filter(code__startswith='10', category=AccountCategory.ASSET).first()
        ap_account = Account.objects.filter(code__startswith='20', category=AccountCategory.LIABILITY).first()

        if bank_account and ap_account:
            entry = JournalEntry.objects.create(
                entry_number=f"PMT-{payment.payment_number}",
                entry_type=JournalEntryType.PAYMENT,
                date=payment.payment_date,
                status=JournalEntryStatus.DRAFT,
                narration=f"Vendor Payment for Bill #{bill.bill_number}"
            )

            # Debit AP
            JournalItem.objects.create(
                journal_entry=entry,
                account=ap_account,
                debit=payment.paid_amount,
                credit=Decimal('0.00'),
                description=f"AP Settlement - {bill.vendor.name}"
            )

            # Credit Bank/Cash
            JournalItem.objects.create(
                journal_entry=entry,
                account=bank_account,
                debit=Decimal('0.00'),
                credit=payment.paid_amount,
                description=f"Payment via {payment.payment_mode}"
            )

            posted_entry = PostingEngine.post_entry(entry.id, user=request.user if request.user.is_authenticated else None)
            payment.journal_entry = posted_entry
            payment.save()

        if bill.remaining_balance <= 0:
            bill.status = BillStatus.PAID
        else:
            bill.status = BillStatus.PARTIALLY_PAID
        bill.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

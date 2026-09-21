from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Customer, Invoice, InvoiceStatus, PaymentRecord
from .serializers import CustomerSerializer, InvoiceSerializer, PaymentRecordSerializer
from apps.accounts.models import Account, AccountCategory
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryType, JournalEntryStatus
from apps.ledger.services import PostingEngine
from apps.core.permissions import RBACPermission

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'email', 'phone', 'tax_id']

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().prefetch_related('items', 'payments', 'customer', 'journal_entry')
    serializer_class = InvoiceSerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'customer__name', 'status']
    ordering_fields = ['issue_date', 'due_date', 'grand_total']

    @action(detail=True, methods=['post'], url_path='post-to-ledger')
    @transaction.atomic
    def post_to_ledger(self, request, pk=None):
        """Generates and posts double-entry voucher for invoice."""
        invoice = self.get_object()
        if invoice.status != InvoiceStatus.DRAFT:
            return Response({"error": "Invoice is already posted or processed."}, status=status.HTTP_400_BAD_REQUEST)

        # Get AR Account, Revenue Account, Tax Account
        ar_account = Account.objects.filter(code__startswith='12', category=AccountCategory.ASSET).first() or Account.objects.filter(category=AccountCategory.ASSET).first()
        rev_account = Account.objects.filter(code__startswith='4', category=AccountCategory.REVENUE).first() or Account.objects.filter(category=AccountCategory.REVENUE).first()
        tax_account = Account.objects.filter(code__startswith='21', category=AccountCategory.LIABILITY).first()

        if not ar_account or not rev_account:
            return Response({"error": "Chart of Accounts missing required AR (1200) or Revenue (4010) account."}, status=status.HTTP_400_BAD_REQUEST)

        # Create Journal Entry
        entry = JournalEntry.objects.create(
            entry_number=f"JV-{invoice.invoice_number}",
            entry_type=JournalEntryType.INVOICE,
            date=invoice.issue_date,
            status=JournalEntryStatus.DRAFT,
            narration=f"Invoice #{invoice.invoice_number} for {invoice.customer.name}"
        )

        # Debit Accounts Receivable for Grand Total
        JournalItem.objects.create(
            journal_entry=entry,
            account=ar_account,
            debit=invoice.grand_total,
            credit=Decimal('0.00'),
            description=f"AR - {invoice.customer.name}"
        )

        # Credit Sales Revenue for Subtotal
        JournalItem.objects.create(
            journal_entry=entry,
            account=rev_account,
            debit=Decimal('0.00'),
            credit=invoice.subtotal,
            description=f"Sales Revenue - Invoice #{invoice.invoice_number}"
        )

        # Credit Sales Tax Payable if tax_amount > 0
        if invoice.tax_amount > 0:
            tax_acc = tax_account or Account.objects.filter(category=AccountCategory.LIABILITY).first()
            JournalItem.objects.create(
                journal_entry=entry,
                account=tax_acc,
                debit=Decimal('0.00'),
                credit=invoice.tax_amount,
                description=f"Sales Tax Payable - Invoice #{invoice.invoice_number}"
            )

        # Post Entry
        posted_entry = PostingEngine.post_entry(entry.id, user=request.user if request.user.is_authenticated else None)

        invoice.journal_entry = posted_entry
        invoice.status = InvoiceStatus.SENT
        invoice.save()

        return Response(self.get_serializer(invoice).data, status=status.HTTP_200_OK)

class PaymentRecordViewSet(viewsets.ModelViewSet):
    queryset = PaymentRecord.objects.all().select_related('invoice', 'journal_entry')
    serializer_class = PaymentRecordSerializer
    permission_classes = [RBACPermission]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()

        invoice = payment.invoice
        # Create Payment Receipt Voucher
        bank_account = Account.objects.filter(code__startswith='10', category=AccountCategory.ASSET).first()
        ar_account = Account.objects.filter(code__startswith='12', category=AccountCategory.ASSET).first()

        if bank_account and ar_account:
            entry = JournalEntry.objects.create(
                entry_number=f"REC-{payment.payment_number}",
                entry_type=JournalEntryType.RECEIPT,
                date=payment.payment_date,
                status=JournalEntryStatus.DRAFT,
                narration=f"Payment received for Invoice #{invoice.invoice_number}"
            )

            # Debit Bank/Cash
            JournalItem.objects.create(
                journal_entry=entry,
                account=bank_account,
                debit=payment.paid_amount,
                credit=Decimal('0.00'),
                description=f"Payment Received via {payment.payment_mode}"
            )

            # Credit Accounts Receivable
            JournalItem.objects.create(
                journal_entry=entry,
                account=ar_account,
                debit=Decimal('0.00'),
                credit=payment.paid_amount,
                description=f"AR Settlement - {invoice.customer.name}"
            )

            posted_entry = PostingEngine.post_entry(entry.id, user=request.user if request.user.is_authenticated else None)
            payment.journal_entry = posted_entry
            payment.save()

        # Update Invoice Status
        if invoice.remaining_balance <= 0:
            invoice.status = InvoiceStatus.PAID
        else:
            invoice.status = InvoiceStatus.PARTIALLY_PAID
        invoice.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

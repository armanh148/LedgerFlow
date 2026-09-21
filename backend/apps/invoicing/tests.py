from decimal import Decimal
from datetime import date
from django.test import TestCase
from apps.accounts.models import Account, AccountCategory
from apps.invoicing.models import Customer, Invoice, InvoiceItem, InvoiceStatus, PaymentRecord
from apps.ledger.models import JournalEntryStatus, JournalEntryType

class InvoicingWorkflowTest(TestCase):
    def setUp(self):
        self.ar_account = Account.objects.create(code='1200', name='Accounts Receivable', category=AccountCategory.ASSET)
        self.rev_account = Account.objects.create(code='4010', name='Sales Revenue', category=AccountCategory.REVENUE)
        self.tax_account = Account.objects.create(code='2100', name='Sales Tax Payable', category=AccountCategory.LIABILITY)
        self.bank_account = Account.objects.create(code='1020', name='Bank Account', category=AccountCategory.ASSET, opening_balance=Decimal('10000.00'))

        self.customer = Customer.objects.create(
            name='Test Tech Inc',
            email='billing@testtech.com',
            phone='1234567890',
            address='123 Tech Lane',
            tax_id='TAX-9988'
        )

    def test_invoice_creation_and_ledger_posting(self):
        """Creating an invoice and posting to ledger should create balanced double-entry voucher."""
        invoice = Invoice.objects.create(
            invoice_number='INV-TEST-001',
            customer=self.customer,
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal('1000.00'),
            tax_amount=Decimal('100.00'),
            grand_total=Decimal('1100.00'),
            status=InvoiceStatus.DRAFT
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            description='Software License',
            quantity=Decimal('1.00'),
            unit_price=Decimal('1000.00'),
            tax_rate=Decimal('10.00'),
            total_price=Decimal('1100.00')
        )

        response = self.client.post(f'/api/invoices/{invoice.id}/post-to-ledger/')
        self.assertEqual(response.status_code, 200)

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, InvoiceStatus.SENT)
        self.assertIsNotNone(invoice.journal_entry)
        self.assertEqual(invoice.journal_entry.status, JournalEntryStatus.POSTED)
        self.assertTrue(invoice.journal_entry.is_balanced)

        # Check Account balances
        # AR should increase by grand total $1,100
        self.assertEqual(self.ar_account.current_balance, Decimal('1100.00'))
        # Revenue should increase by subtotal $1,000
        self.assertEqual(self.rev_account.current_balance, Decimal('1000.00'))
        # Tax payable should increase by tax $100
        self.assertEqual(self.tax_account.current_balance, Decimal('100.00'))

    def test_payment_record_receipt_voucher(self):
        """Recording a payment for an invoice creates a posted receipt voucher and updates balances."""
        invoice = Invoice.objects.create(
            invoice_number='INV-TEST-002',
            customer=self.customer,
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal('500.00'),
            tax_amount=Decimal('0.00'),
            grand_total=Decimal('500.00'),
            status=InvoiceStatus.SENT
        )

        payment_data = {
            'payment_number': 'REC-TEST-001',
            'invoice': str(invoice.id),
            'paid_amount': '500.00',
            'payment_date': str(date.today()),
            'payment_mode': 'BANK_TRANSFER',
            'reference_number': 'REF-123456'
        }

        response = self.client.post('/api/payments/', payment_data, content_type='application/json')
        self.assertEqual(response.status_code, 201)

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, InvoiceStatus.PAID)
        self.assertEqual(invoice.remaining_balance, Decimal('0.00'))

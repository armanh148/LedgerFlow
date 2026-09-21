from decimal import Decimal
from datetime import date
from django.test import TestCase
from apps.accounts.models import Account, AccountCategory
from apps.payables.models import Vendor, Bill, BillItem, BillStatus, VendorPayment
from apps.ledger.models import JournalEntryStatus

class PayablesWorkflowTest(TestCase):
    def setUp(self):
        self.ap_account = Account.objects.create(code='2010', name='Accounts Payable', category=AccountCategory.LIABILITY)
        self.exp_account = Account.objects.create(code='5010', name='Office Rent Expense', category=AccountCategory.EXPENSE)
        self.bank_account = Account.objects.create(code='1020', name='Bank Account', category=AccountCategory.ASSET, opening_balance=Decimal('20000.00'))

        self.vendor = Vendor.objects.create(
            name='Office Lease LLC',
            email='rent@officelease.com',
            phone='9876543210',
            address='456 Property Row'
        )

    def test_bill_creation_and_ledger_posting(self):
        """Posting a vendor bill generates a debit to expense and credit to AP."""
        bill = Bill.objects.create(
            bill_number='BILL-TEST-001',
            vendor=self.vendor,
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal('2000.00'),
            tax_amount=Decimal('0.00'),
            grand_total=Decimal('2000.00'),
            status=BillStatus.DRAFT
        )
        BillItem.objects.create(
            bill=bill,
            description='Monthly Rent',
            quantity=Decimal('1.00'),
            unit_price=Decimal('2000.00'),
            tax_rate=Decimal('0.00'),
            total_price=Decimal('2000.00')
        )

        response = self.client.post(f'/api/bills/{bill.id}/post-to-ledger/')
        self.assertEqual(response.status_code, 200)

        bill.refresh_from_db()
        self.assertEqual(bill.status, BillStatus.RECEIVED)
        self.assertIsNotNone(bill.journal_entry)
        self.assertEqual(bill.journal_entry.status, JournalEntryStatus.POSTED)
        self.assertTrue(bill.journal_entry.is_balanced)

        self.assertEqual(self.exp_account.current_balance, Decimal('2000.00'))
        self.assertEqual(self.ap_account.current_balance, Decimal('2000.00'))

    def test_vendor_payment_processing(self):
        """Vendor payment settles AP liability and debits bank account."""
        bill = Bill.objects.create(
            bill_number='BILL-TEST-002',
            vendor=self.vendor,
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=Decimal('1500.00'),
            tax_amount=Decimal('0.00'),
            grand_total=Decimal('1500.00'),
            status=BillStatus.RECEIVED
        )

        payment_data = {
            'payment_number': 'PMT-TEST-001',
            'bill': str(bill.id),
            'paid_amount': '1500.00',
            'payment_date': str(date.today()),
            'payment_mode': 'BANK_TRANSFER',
            'reference_number': 'REF-PMT-99'
        }

        response = self.client.post('/api/vendor-payments/', payment_data, content_type='application/json')
        self.assertEqual(response.status_code, 201)

        bill.refresh_from_db()
        self.assertEqual(bill.status, BillStatus.PAID)
        self.assertEqual(bill.remaining_balance, Decimal('0.00'))

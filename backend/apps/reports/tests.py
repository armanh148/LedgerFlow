from decimal import Decimal
from datetime import date
from django.test import TestCase
from apps.accounts.models import Account, AccountCategory
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryStatus, JournalEntryType
from apps.ledger.services import PostingEngine
from apps.reports.services import ReportingEngine

class FinancialReportsTest(TestCase):
    def setUp(self):
        self.bank = Account.objects.create(code='1020', name='Chase Bank', category=AccountCategory.ASSET, opening_balance=Decimal('50000.00'))
        self.ar = Account.objects.create(code='1200', name='Accounts Receivable', category=AccountCategory.ASSET, opening_balance=Decimal('0.00'))
        self.ap = Account.objects.create(code='2010', name='Accounts Payable', category=AccountCategory.LIABILITY, opening_balance=Decimal('0.00'))
        self.equity = Account.objects.create(code='3010', name="Owner's Equity", category=AccountCategory.EQUITY, opening_balance=Decimal('50000.00'))
        self.revenue = Account.objects.create(code='4010', name='Consulting Revenue', category=AccountCategory.REVENUE, opening_balance=Decimal('0.00'))
        self.rent = Account.objects.create(code='5010', name='Rent Expense', category=AccountCategory.EXPENSE, opening_balance=Decimal('0.00'))

    def test_trial_balance_debits_equals_credits(self):
        """Trial Balance total debits must equal total credits."""
        entry = JournalEntry.objects.create(
            entry_number='JV-REP-01',
            entry_type=JournalEntryType.STANDARD,
            date=date.today(),
            status=JournalEntryStatus.DRAFT,
            narration='Sale and Rent'
        )
        JournalItem.objects.create(journal_entry=entry, account=self.bank, debit=Decimal('10000.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry, account=self.revenue, debit=Decimal('0.00'), credit=Decimal('10000.00'))
        PostingEngine.post_entry(entry.id)

        tb = ReportingEngine.get_trial_balance()
        self.assertTrue(tb['is_balanced'])
        self.assertEqual(tb['total_debits'], tb['total_credits'])

    def test_profit_and_loss_calculation(self):
        """P&L calculation (Revenues - Expenses = Net Profit)."""
        # Income $12,000
        entry1 = JournalEntry.objects.create(entry_number='JV-REP-02', entry_type=JournalEntryType.STANDARD, date=date.today(), status=JournalEntryStatus.DRAFT)
        JournalItem.objects.create(journal_entry=entry1, account=self.bank, debit=Decimal('12000.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry1, account=self.revenue, debit=Decimal('0.00'), credit=Decimal('12000.00'))
        PostingEngine.post_entry(entry1.id)

        # Expense $3,000
        entry2 = JournalEntry.objects.create(entry_number='JV-REP-03', entry_type=JournalEntryType.STANDARD, date=date.today(), status=JournalEntryStatus.DRAFT)
        JournalItem.objects.create(journal_entry=entry2, account=self.rent, debit=Decimal('3000.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry2, account=self.bank, debit=Decimal('0.00'), credit=Decimal('3000.00'))
        PostingEngine.post_entry(entry2.id)

        pnl = ReportingEngine.get_profit_and_loss()
        self.assertEqual(pnl['total_revenue'], '12000.00')
        self.assertEqual(pnl['total_expense'], '3000.00')
        self.assertEqual(pnl['net_profit'], '9000.00')
        self.assertTrue(pnl['is_profitable'])

    def test_balance_sheet_equation(self):
        """Balance Sheet Assets == Liabilities + Equity + Retained Earnings."""
        bs = ReportingEngine.get_balance_sheet('2026-09-21')
        self.assertTrue(bs['is_balanced'])
        self.assertEqual(bs['difference'], '0.00')

    def test_ar_and_ap_aging_with_string_date(self):
        """AR and AP aging must run smoothly with string as_of_date."""
        ar = ReportingEngine.get_ar_aging('2026-09-21')
        self.assertIn('customers', ar)
        self.assertIn('grand_total', ar)

        ap = ReportingEngine.get_ap_aging('2026-09-21')
        self.assertIn('vendors', ap)
        self.assertIn('grand_total', ap)


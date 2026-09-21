from decimal import Decimal
from datetime import date
from django.test import TestCase
from django.core.exceptions import ValidationError
from apps.accounts.models import Account, AccountCategory, PeriodLock
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryStatus, JournalEntryType
from apps.ledger.services import PostingEngine
from apps.reports.services import ReportingEngine

class AccountingIntegrityTest(TestCase):
    def setUp(self):
        self.cash = Account.objects.create(code='1010-TEST', name='Cash', category=AccountCategory.ASSET, opening_balance=Decimal('1000.00'))
        self.bank = Account.objects.create(code='1020-TEST', name='Bank Account', category=AccountCategory.ASSET, opening_balance=Decimal('5000.00'))
        self.equity = Account.objects.create(code='3010-TEST', name='Equity', category=AccountCategory.EQUITY, opening_balance=Decimal('6000.00'))
        self.revenue = Account.objects.create(code='4010-TEST', name='Revenue', category=AccountCategory.REVENUE, opening_balance=Decimal('0.00'))
        self.expense = Account.objects.create(code='5010-TEST', name='Rent Expense', category=AccountCategory.EXPENSE, opening_balance=Decimal('0.00'))

    def test_double_entry_balance_required(self):
        """Unbalanced journal entries (Debits != Credits) MUST be rejected by PostingEngine."""
        entry = JournalEntry.objects.create(
            entry_number='TEST-JV-001',
            entry_type=JournalEntryType.STANDARD,
            date=date.today(),
            status=JournalEntryStatus.DRAFT,
            narration='Unbalanced Entry Test'
        )
        # Debit $500, Credit $400
        JournalItem.objects.create(journal_entry=entry, account=self.expense, debit=Decimal('500.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry, account=self.bank, debit=Decimal('0.00'), credit=Decimal('400.00'))

        with self.assertRaises(ValidationError) as context:
            PostingEngine.post_entry(entry.id)
        self.assertIn("Double-Entry Violation", str(context.exception))

    def test_balanced_entry_posting_and_coa_balances(self):
        """Balanced entry updates account balances correctly."""
        entry = JournalEntry.objects.create(
            entry_number='TEST-JV-002',
            entry_type=JournalEntryType.STANDARD,
            date=date.today(),
            status=JournalEntryStatus.DRAFT,
            narration='Balanced Sale Entry'
        )
        JournalItem.objects.create(journal_entry=entry, account=self.bank, debit=Decimal('1500.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry, account=self.revenue, debit=Decimal('0.00'), credit=Decimal('1500.00'))

        posted = PostingEngine.post_entry(entry.id)
        self.assertEqual(posted.status, JournalEntryStatus.POSTED)

        # Verify Account Balances
        # Bank (Asset): opening $5,000 + debit $1,500 = $6,500
        self.assertEqual(self.bank.current_balance, Decimal('6500.00'))
        # Revenue (Revenue): opening $0 + credit $1,500 = $1,500
        self.assertEqual(self.revenue.current_balance, Decimal('1500.00'))

    def test_audit_immutability(self):
        """Posted journal entries cannot be edited or deleted."""
        entry = JournalEntry.objects.create(
            entry_number='TEST-JV-003',
            entry_type=JournalEntryType.STANDARD,
            date=date.today(),
            status=JournalEntryStatus.DRAFT,
            narration='Immutability Test'
        )
        JournalItem.objects.create(journal_entry=entry, account=self.expense, debit=Decimal('300.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry, account=self.bank, debit=Decimal('0.00'), credit=Decimal('300.00'))
        posted = PostingEngine.post_entry(entry.id)

        # Attempting delete on posted entry should fail
        with self.assertRaises(ValidationError):
            posted.delete()

        # Attempting modification on posted entry should fail
        posted.narration = "Attempted edit"
        with self.assertRaises(ValidationError):
            posted.save()

    def test_period_locking_enforcement(self):
        """Posting to a locked fiscal period must fail."""
        PeriodLock.objects.create(
            period_name='Locked Period Test',
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 31),
            is_locked=True
        )

        entry = JournalEntry.objects.create(
            entry_number='TEST-JV-LOCKED',
            entry_type=JournalEntryType.STANDARD,
            date=date(2025, 1, 15),
            status=JournalEntryStatus.DRAFT,
            narration='Backdated Entry'
        )
        JournalItem.objects.create(journal_entry=entry, account=self.expense, debit=Decimal('100.00'), credit=Decimal('0.00'))
        JournalItem.objects.create(journal_entry=entry, account=self.bank, debit=Decimal('0.00'), credit=Decimal('100.00'))

        with self.assertRaises(ValidationError) as ctx:
            PostingEngine.post_entry(entry.id)
        self.assertIn("Fiscal period is locked", str(ctx.exception))

    def test_trial_balance_equality(self):
        """Trial balance total debits must equal total credits."""
        tb = ReportingEngine.get_trial_balance()
        self.assertTrue(tb['is_balanced'])
        self.assertEqual(tb['total_debits'], tb['total_credits'])

import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.db.models import Sum

class AccountCategory(models.TextChoices):
    ASSET = 'ASSET', 'Asset'
    LIABILITY = 'LIABILITY', 'Liability'
    EQUITY = 'EQUITY', 'Equity'
    REVENUE = 'REVENUE', 'Revenue'
    EXPENSE = 'EXPENSE', 'Expense'

class Account(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=20, choices=AccountCategory.choices)
    parent_account = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_accounts')
    is_active = models.BooleanField(default=True)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f"{self.code} - {self.name} ({self.category})"

    @property
    def current_balance(self) -> Decimal:
        """
        Calculates the real-time balance based on posted journal items.
        Debits increase ASSETS and EXPENSES.
        Credits increase LIABILITIES, EQUITY, and REVENUE.
        """
        from apps.ledger.models import JournalItem, JournalEntryStatus
        items = JournalItem.objects.filter(
            account=self,
            journal_entry__status=JournalEntryStatus.POSTED
        )
        totals = items.aggregate(
            total_debit=Sum('debit'),
            total_credit=Sum('credit')
        )
        total_debit = totals['total_debit'] or Decimal('0.00')
        total_credit = totals['total_credit'] or Decimal('0.00')

        if self.category in [AccountCategory.ASSET, AccountCategory.EXPENSE]:
            return self.opening_balance + total_debit - total_credit
        else:
            return self.opening_balance + total_credit - total_debit

class PeriodLock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period_name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    is_locked = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-end_date']

    def __str__(self):
        status = "LOCKED" if self.is_locked else "OPEN"
        return f"{self.period_name} ({self.start_date} to {self.end_date}) - {status}"

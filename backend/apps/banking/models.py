import uuid
from decimal import Decimal
from django.db import models
from apps.accounts.models import Account
from apps.ledger.models import JournalEntry

class BankAccount(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50)
    bank_name = models.CharField(max_length=100)
    ledger_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='bank_accounts', null=True, blank=True)
    opening_balance = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def current_balance(self):
        """Compute current balance from linked ledger account, fallback to opening_balance."""
        try:
            if self.ledger_account_id and self.ledger_account:
                return self.ledger_account.current_balance
        except Exception:
            pass
        return self.opening_balance

    def __str__(self):
        return f"{self.bank_name} - {self.account_name} ({self.account_number})"

class BankStatementTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='statement_transactions')
    transaction_date = models.DateField()
    description = models.CharField(max_length=255)
    reference = models.CharField(max_length=100, blank=True, default='')
    amount = models.DecimalField(max_digits=15, decimal_places=2) # + for Deposit, - for Withdrawal
    is_reconciled = models.BooleanField(default=False)
    matched_journal_entry = models.ForeignKey(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_bank_txs')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date', '-created_at']

    def __str__(self):
        status = "RECONCILED" if self.is_reconciled else "UNRECONCILED"
        return f"[{self.transaction_date}] {self.description}: ${self.amount} ({status})"

class BankReconciliation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='reconciliations')
    statement_date = models.DateField()
    statement_ending_balance = models.DecimalField(max_digits=15, decimal_places=2)
    cleared_balance = models.DecimalField(max_digits=15, decimal_places=2)
    difference = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    is_reconciled = models.BooleanField(default=False)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-statement_date']

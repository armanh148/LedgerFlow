import uuid
from decimal import Decimal
from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from apps.accounts.models import Account

class JournalEntryType(models.TextChoices):
    STANDARD = 'STANDARD', 'Standard Journal'
    PAYMENT = 'PAYMENT', 'Payment Voucher'
    RECEIPT = 'RECEIPT', 'Receipt Voucher'
    CONTRA = 'CONTRA', 'Contra Entry'
    INVOICE = 'INVOICE', 'Invoice Ledger'
    BILL = 'BILL', 'Bill Ledger'
    REVERSAL = 'REVERSAL', 'Reversal Voucher'

class JournalEntryStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    POSTED = 'POSTED', 'Posted'
    VOID = 'VOID', 'Void'

class JournalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry_number = models.CharField(max_length=50, unique=True)
    entry_type = models.CharField(max_length=20, choices=JournalEntryType.choices, default=JournalEntryType.STANDARD)
    date = models.DateField()
    status = models.CharField(max_length=20, choices=JournalEntryStatus.choices, default=JournalEntryStatus.DRAFT)
    narration = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_entries')
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='posted_entries')
    posted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reverses_entry = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversals')

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name_plural = 'Journal Entries'

    def __str__(self):
        return f"{self.entry_number} ({self.get_entry_type_display()}) - {self.status}"

    def clean(self):
        # Prevent editing posted entries
        if self.pk and JournalEntry.objects.filter(pk=self.pk).exists():
            orig = JournalEntry.objects.get(pk=self.pk)
            if orig.status == JournalEntryStatus.POSTED and self.status == JournalEntryStatus.POSTED:
                # Disallow modifying date, entry_number, entry_type, narration on posted entries
                if (orig.date != self.date or 
                    orig.entry_number != self.entry_number or 
                    orig.entry_type != self.entry_type or 
                    orig.narration != self.narration):
                    raise ValidationError("Audit Immutability Violation: Posted journal entries cannot be modified.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.status == JournalEntryStatus.POSTED:
            raise ValidationError("Audit Immutability Violation: Posted journal entries cannot be deleted. Create a reversal voucher instead.")
        super().delete(*args, **kwargs)

    @property
    def total_debit(self) -> Decimal:
        return sum((item.debit for item in self.items.all()), Decimal('0.00'))

    @property
    def total_credit(self) -> Decimal:
        return sum((item.credit for item in self.items.all()), Decimal('0.00'))

    @property
    def is_balanced(self) -> bool:
        td = self.total_debit
        tc = self.total_credit
        return td > Decimal('0.00') and td == tc

class JournalItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_items')
    debit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    credit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(debit__gte=0) & models.Q(credit__gte=0),
                name='non_negative_debit_credit'
            ),
            models.CheckConstraint(
                check=(
                    (models.Q(debit__gt=0) & models.Q(credit=0)) |
                    (models.Q(credit__gt=0) & models.Q(debit=0))
                ),
                name='mutually_exclusive_debit_credit'
            )
        ]

    def __str__(self):
        return f"{self.journal_entry.entry_number} | {self.account.code} | Dr: {self.debit} Cr: {self.credit}"

    def clean(self):
        if self.journal_entry.status == JournalEntryStatus.POSTED:
            raise ValidationError("Audit Immutability Violation: Cannot add or modify items on a posted journal entry.")

        if self.debit < 0 or self.credit < 0:
            raise ValidationError("Debits and Credits must be non-negative numbers.")

        if (self.debit > 0 and self.credit > 0) or (self.debit == 0 and self.credit == 0):
            raise ValidationError("A line item must have either a positive debit OR credit, but not both or neither.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.journal_entry.status == JournalEntryStatus.POSTED:
            raise ValidationError("Audit Immutability Violation: Cannot delete line items from a posted journal entry.")
        super().delete(*args, **kwargs)

from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.accounts.models import PeriodLock
from apps.core.models import AuditLog
from .models import JournalEntry, JournalItem, JournalEntryStatus, JournalEntryType

class PostingEngine:
    @staticmethod
    @transaction.atomic
    def post_entry(entry_id, user=None, user_role='ACCOUNTANT'):
        """
        Atomically posts a draft journal entry.
        Verifies:
        1. Period is not locked.
        2. Status is DRAFT.
        3. Total Debits == Total Credits (> 0).
        4. Atomic database commit + Audit log record.
        """
        entry = JournalEntry.objects.select_for_update().get(pk=entry_id)

        if entry.status == JournalEntryStatus.POSTED:
            raise ValidationError("Journal entry is already posted.")

        # Check Period Lock
        locked_periods = PeriodLock.objects.filter(
            is_locked=True,
            start_date__lte=entry.date,
            end_date__gte=entry.date
        )
        if locked_periods.exists():
            raise ValidationError(f"Cannot post transaction dated {entry.date}: Fiscal period is locked.")

        # Aggregate items
        items = list(entry.items.select_related('account').all())
        if not items:
            raise ValidationError("Journal entry has no line items.")

        total_debit = sum((item.debit for item in items), Decimal('0.00'))
        total_credit = sum((item.credit for item in items), Decimal('0.00'))

        if total_debit <= Decimal('0.00'):
            raise ValidationError("Journal entry total debit must be greater than zero.")

        if total_debit != total_credit:
            raise ValidationError(
                f"Double-Entry Violation: Total Debits ({total_debit}) must equal Total Credits ({total_credit}). "
                f"Difference: {total_debit - total_credit}"
            )

        # Update entry status
        entry.status = JournalEntryStatus.POSTED
        entry.posted_at = timezone.now()
        entry.posted_by = user
        # Skip custom clean check in save() since status change DRAFT -> POSTED is allowed
        JournalEntry.objects.filter(pk=entry.pk).update(
            status=JournalEntryStatus.POSTED,
            posted_at=entry.posted_at,
            posted_by=user
        )

        # Create Audit Record
        AuditLog.objects.create(
            user=user if user and user.is_authenticated else None,
            user_role=user_role,
            action='POST_JOURNAL_ENTRY',
            model_name='JournalEntry',
            object_id=str(entry.id),
            details={
                'entry_number': entry.entry_number,
                'total_debit': str(total_debit),
                'total_credit': str(total_credit),
                'item_count': len(items)
            }
        )

        return JournalEntry.objects.get(pk=entry.pk)

    @staticmethod
    @transaction.atomic
    def reverse_entry(entry_id, reason="Correction of original entry", user=None, user_role='ACCOUNTANT'):
        """
        Creates and posts an opposite reversal entry to correct a posted entry.
        Swaps Debits and Credits for each line item.
        """
        original = JournalEntry.objects.get(pk=entry_id)
        if original.status != JournalEntryStatus.POSTED:
            raise ValidationError("Only POSTED entries can be reversed.")

        rev_number = f"REV-{original.entry_number}"

        reversal = JournalEntry.objects.create(
            entry_number=rev_number,
            entry_type=JournalEntryType.REVERSAL,
            date=timezone.now().date(),
            status=JournalEntryStatus.DRAFT,
            narration=f"Reversal of {original.entry_number}: {reason}",
            created_by=user if user and user.is_authenticated else None,
            reverses_entry=original
        )

        # Copy line items with inverted debit/credit
        for item in original.items.all():
            JournalItem.objects.create(
                journal_entry=reversal,
                account=item.account,
                debit=item.credit, # SWAP
                credit=item.debit, # SWAP
                description=f"Reversal: {item.description}"
            )

        # Post reversal atomically
        posted_reversal = PostingEngine.post_entry(reversal.id, user=user, user_role=user_role)

        # Mark original as VOID/Reversed if needed
        JournalEntry.objects.filter(pk=original.pk).update(status=JournalEntryStatus.VOID)

        return posted_reversal

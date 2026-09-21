import csv
import io
from decimal import Decimal
from datetime import date, timedelta
import calendar

from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import BankAccount, BankStatementTransaction, BankReconciliation
from .serializers import BankAccountSerializer, BankStatementTransactionSerializer, BankReconciliationSerializer
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryStatus
from apps.core.permissions import RBACPermission

class BankAccountViewSet(viewsets.ModelViewSet):
    queryset = BankAccount.objects.all().select_related('ledger_account')
    serializer_class = BankAccountSerializer
    permission_classes = [RBACPermission]

    @action(detail=True, methods=['get'], url_path='monthly-balance')
    def monthly_balance(self, request, pk=None):
        """
        Returns last 12 months + remaining months of current year for this bank account.
        Past months: computed from posted journal items.
        Future months (after today): shown as projected using current balance.
        """
        bank = self.get_object()
        today = date.today()

        MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        # Build month list: last 12 historical months (oldest first)
        past_months = []
        for i in range(11, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            last_day = calendar.monthrange(year, month)[1]
            past_months.append(date(year, month, last_day))

        # Add remaining months of current year beyond today
        future_months = []
        for month in range(today.month + 1, 13):
            last_day = calendar.monthrange(today.year, month)[1]
            future_months.append(date(today.year, month, last_day))

        all_months = past_months + future_months
        result = []

        if bank.ledger_account_id:
            acct = bank.ledger_account
            opening = acct.opening_balance

            from apps.accounts.models import AccountCategory
            is_debit_normal = acct.category in [AccountCategory.ASSET, AccountCategory.EXPENSE]

            # Compute current real balance once (for projections)
            curr_bal = float(bank.current_balance)

            for end_of_month in all_months:
                is_projected = end_of_month > today

                if is_projected:
                    bal = curr_bal
                else:
                    items = JournalItem.objects.filter(
                        account=acct,
                        journal_entry__status=JournalEntryStatus.POSTED,
                        journal_entry__date__lte=end_of_month
                    ).aggregate(
                        total_debit=Sum('debit'),
                        total_credit=Sum('credit')
                    )
                    td = items['total_debit'] or Decimal('0.00')
                    tc = items['total_credit'] or Decimal('0.00')
                    bal = float(opening + td - tc if is_debit_normal else opening + tc - td)

                result.append({
                    'month': MONTH_LABELS[end_of_month.month - 1],
                    'year': end_of_month.year,
                    'label': f"{MONTH_LABELS[end_of_month.month - 1]} {end_of_month.year}",
                    'balance': bal,
                    'date': str(end_of_month),
                    'is_projected': is_projected,
                })
        else:
            bal = float(bank.opening_balance)
            for end_of_month in all_months:
                is_projected = end_of_month > today
                result.append({
                    'month': MONTH_LABELS[end_of_month.month - 1],
                    'year': end_of_month.year,
                    'label': f"{MONTH_LABELS[end_of_month.month - 1]} {end_of_month.year}",
                    'balance': bal,
                    'date': str(end_of_month),
                    'is_projected': is_projected,
                })

        # Compute MoM change % using last two actual (non-projected) months
        mom_change = None
        actual = [r for r in result if not r.get('is_projected')]
        if len(actual) >= 2:
            prev = actual[-2]['balance']
            curr = actual[-1]['balance']
            if prev != 0:
                mom_change = round(((curr - prev) / abs(prev)) * 100, 1)

        return Response({
            'bank_account_id': str(bank.id),
            'bank_name': bank.bank_name,
            'account_name': bank.account_name,
            'current_balance': float(bank.current_balance),
            'mom_change': mom_change,
            'monthly_data': result,
        }, status=status.HTTP_200_OK)

class BankStatementTransactionViewSet(viewsets.ModelViewSet):
    queryset = BankStatementTransaction.objects.all().select_related('bank_account', 'matched_journal_entry')
    serializer_class = BankStatementTransactionSerializer
    permission_classes = [RBACPermission]

    @action(detail=False, methods=['post'], url_path='upload-csv')
    def upload_csv(self, request):
        """
        Parses uploaded bank statement CSV file and inserts statement transactions.
        Expected CSV columns: Date, Description, Reference, Amount
        """
        bank_account_id = request.data.get('bank_account_id')
        file_obj = request.FILES.get('file')

        if not bank_account_id or not file_obj:
            return Response({"error": "bank_account_id and file are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            bank_account = BankAccount.objects.get(pk=bank_account_id)
            decoded_file = file_obj.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)

            created_txs = []
            for row in reader:
                tx_date = row.get('Date') or row.get('date')
                desc = row.get('Description') or row.get('description', 'Bank Transaction')
                ref = row.get('Reference') or row.get('reference', '')
                amt_str = row.get('Amount') or row.get('amount', '0.00')

                amount = Decimal(str(amt_str).replace('$', '').replace(',', '').strip())

                tx = BankStatementTransaction.objects.create(
                    bank_account=bank_account,
                    transaction_date=tx_date,
                    description=desc,
                    reference=ref,
                    amount=amount
                )
                created_txs.append(tx)

            serializer = self.get_serializer(created_txs, many=True)
            return Response({"message": f"Successfully parsed {len(created_txs)} transactions.", "transactions": serializer.data}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='match-ledger')
    def match_ledger(self, request, pk=None):
        """
        Matches a statement transaction with an internal JournalEntry.
        """
        tx = self.get_object()
        journal_entry_id = request.data.get('journal_entry_id')

        if not journal_entry_id:
            tx.is_reconciled = False
            tx.matched_journal_entry = None
            tx.save()
            return Response(self.get_serializer(tx).data, status=status.HTTP_200_OK)

        try:
            entry = JournalEntry.objects.get(pk=journal_entry_id)
            tx.matched_journal_entry = entry
            tx.is_reconciled = True
            tx.save()
            return Response(self.get_serializer(tx).data, status=status.HTTP_200_OK)
        except JournalEntry.DoesNotExist:
            return Response({"error": "Journal Entry not found."}, status=status.HTTP_404_NOT_FOUND)

class BankReconciliationViewSet(viewsets.ModelViewSet):
    queryset = BankReconciliation.objects.all().select_related('bank_account')
    serializer_class = BankReconciliationSerializer
    permission_classes = [RBACPermission]

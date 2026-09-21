from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q
from apps.accounts.models import Account, AccountCategory
from apps.ledger.models import JournalItem, JournalEntryStatus
from apps.invoicing.models import Invoice, InvoiceStatus
from apps.payables.models import Bill, BillStatus

class ReportingEngine:
    @staticmethod
    def get_trial_balance(as_of_date=None):
        """
        Calculates real-time Trial Balance.
        Lists every account, its debit and credit balances, and checks total debit == total credit.
        """
        accounts = Account.objects.filter(is_active=True).order_by('code')
        items_query = JournalItem.objects.filter(journal_entry__status=JournalEntryStatus.POSTED)
        if as_of_date:
            items_query = items_query.filter(journal_entry__date__lte=as_of_date)

        rows = []
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')

        for account in accounts:
            account_items = items_query.filter(account=account)
            agg = account_items.aggregate(
                sum_debit=Sum('debit'),
                sum_credit=Sum('credit')
            )
            raw_debit = agg['sum_debit'] or Decimal('0.00')
            raw_credit = agg['sum_credit'] or Decimal('0.00')

            debit_balance = Decimal('0.00')
            credit_balance = Decimal('0.00')

            if account.category in [AccountCategory.ASSET, AccountCategory.EXPENSE]:
                net = account.opening_balance + raw_debit - raw_credit
                if net >= 0:
                    debit_balance = net
                else:
                    credit_balance = abs(net)
            else:
                net = account.opening_balance + raw_credit - raw_debit
                if net >= 0:
                    credit_balance = net
                else:
                    debit_balance = abs(net)

            if debit_balance > 0 or credit_balance > 0 or account.opening_balance != 0:
                rows.append({
                    'account_id': str(account.id),
                    'code': account.code,
                    'name': account.name,
                    'category': account.category,
                    'debit': str(debit_balance),
                    'credit': str(credit_balance),
                })
                total_debits += debit_balance
                total_credits += credit_balance

        is_balanced = (total_debits == total_credits)

        return {
            'as_of_date': str(as_of_date or timezone.now().date()),
            'accounts': rows,
            'total_debits': str(total_debits),
            'total_credits': str(total_credits),
            'difference': str(total_debits - total_credits),
            'is_balanced': is_balanced
        }

    @staticmethod
    def get_profit_and_loss(start_date=None, end_date=None):
        """
        Calculates Profit & Loss (Income Statement).
        Revenues - Expenses = Net Profit.
        """
        if not end_date:
            end_date = timezone.now().date()

        items_query = JournalItem.objects.filter(
            journal_entry__status=JournalEntryStatus.POSTED,
            journal_entry__date__lte=end_date
        )
        if start_date:
            items_query = items_query.filter(journal_entry__date__gte=start_date)

        # Revenue Accounts
        revenue_accounts = Account.objects.filter(category=AccountCategory.REVENUE, is_active=True)
        revenues = []
        total_revenue = Decimal('0.00')

        for acc in revenue_accounts:
            acc_items = items_query.filter(account=acc)
            agg = acc_items.aggregate(sd=Sum('debit'), sc=Sum('credit'))
            sd = agg['sd'] or Decimal('0.00')
            sc = agg['sc'] or Decimal('0.00')
            net_rev = sc - sd
            if net_rev != 0:
                revenues.append({
                    'code': acc.code,
                    'name': acc.name,
                    'amount': str(net_rev)
                })
                total_revenue += net_rev

        # Expense Accounts
        expense_accounts = Account.objects.filter(category=AccountCategory.EXPENSE, is_active=True)
        expenses = []
        total_expense = Decimal('0.00')

        for acc in expense_accounts:
            acc_items = items_query.filter(account=acc)
            agg = acc_items.aggregate(sd=Sum('debit'), sc=Sum('credit'))
            sd = agg['sd'] or Decimal('0.00')
            sc = agg['sc'] or Decimal('0.00')
            net_exp = sd - sc
            if net_exp != 0:
                expenses.append({
                    'code': acc.code,
                    'name': acc.name,
                    'amount': str(net_exp)
                })
                total_expense += net_exp

        net_profit = total_revenue - total_expense

        return {
            'start_date': str(start_date) if start_date else None,
            'end_date': str(end_date),
            'revenues': revenues,
            'total_revenue': str(total_revenue),
            'expenses': expenses,
            'total_expense': str(total_expense),
            'net_profit': str(net_profit),
            'is_profitable': net_profit >= 0
        }

    @staticmethod
    def get_balance_sheet(as_of_date=None):
        """
        Calculates Balance Sheet as of a specific date.
        Assets = Liabilities + Equity + Retained Earnings (Net Profit).
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        pnl = ReportingEngine.get_profit_and_loss(end_date=as_of_date)
        net_profit = Decimal(pnl['net_profit'])

        # Asset Accounts
        assets = []
        total_assets = Decimal('0.00')
        for acc in Account.objects.filter(category=AccountCategory.ASSET, is_active=True):
            bal = acc.current_balance
            if bal != 0:
                assets.append({'code': acc.code, 'name': acc.name, 'amount': str(bal)})
                total_assets += bal

        # Liability Accounts
        liabilities = []
        total_liabilities = Decimal('0.00')
        for acc in Account.objects.filter(category=AccountCategory.LIABILITY, is_active=True):
            bal = acc.current_balance
            if bal != 0:
                liabilities.append({'code': acc.code, 'name': acc.name, 'amount': str(bal)})
                total_liabilities += bal

        # Equity Accounts
        equity = []
        total_equity = Decimal('0.00')
        for acc in Account.objects.filter(category=AccountCategory.EQUITY, is_active=True):
            bal = acc.current_balance
            if bal != 0:
                equity.append({'code': acc.code, 'name': acc.name, 'amount': str(bal)})
                total_equity += bal

        # Add Retained Earnings (Net Profit) to Equity
        equity.append({'code': 'RE-3999', 'name': 'Retained Earnings (Current Period)', 'amount': str(net_profit)})
        total_equity += net_profit

        total_liabilities_and_equity = total_liabilities + total_equity
        difference = total_assets - total_liabilities_and_equity

        return {
            'as_of_date': str(as_of_date),
            'assets': assets,
            'total_assets': str(total_assets),
            'liabilities': liabilities,
            'total_liabilities': str(total_liabilities),
            'equity': equity,
            'total_equity': str(total_equity),
            'total_liabilities_and_equity': str(total_liabilities_and_equity),
            'difference': str(difference),
            'is_balanced': (difference == Decimal('0.00'))
        }

    @staticmethod
    def get_ar_aging(as_of_date=None):
        """
        Calculates Accounts Receivable (AR) Aging buckets (0-30, 31-60, 61-90, 90+ days).
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        open_invoices = Invoice.objects.exclude(status__in=[InvoiceStatus.PAID, InvoiceStatus.CANCELLED])
        customer_aging = {}

        for inv in open_invoices:
            cust_name = inv.customer.name
            if cust_name not in customer_aging:
                customer_aging[cust_name] = {
                    'customer_id': str(inv.customer.id),
                    'customer_name': cust_name,
                    'current_0_30': Decimal('0.00'),
                    'days_31_60': Decimal('0.00'),
                    'days_61_90': Decimal('0.00'),
                    'days_90_plus': Decimal('0.00'),
                    'total_due': Decimal('0.00'),
                }

            days_overdue = (as_of_date - inv.due_date).days
            bal = inv.remaining_balance

            if days_overdue <= 30:
                customer_aging[cust_name]['current_0_30'] += bal
            elif days_overdue <= 60:
                customer_aging[cust_name]['days_31_60'] += bal
            elif days_overdue <= 90:
                customer_aging[cust_name]['days_61_90'] += bal
            else:
                customer_aging[cust_name]['days_90_plus'] += bal

            customer_aging[cust_name]['total_due'] += bal

        rows = []
        tot_0_30 = Decimal('0.00')
        tot_31_60 = Decimal('0.00')
        tot_61_90 = Decimal('0.00')
        tot_90_plus = Decimal('0.00')
        grand_total = Decimal('0.00')

        for item in customer_aging.values():
            tot_0_30 += item['current_0_30']
            tot_31_60 += item['days_31_60']
            tot_61_90 += item['days_61_90']
            tot_90_plus += item['days_90_plus']
            grand_total += item['total_due']
            rows.append({
                'customer_id': item['customer_id'],
                'customer_name': item['customer_name'],
                'current_0_30': str(item['current_0_30']),
                'days_31_60': str(item['days_31_60']),
                'days_61_90': str(item['days_61_90']),
                'days_90_plus': str(item['days_90_plus']),
                'total_due': str(item['total_due']),
            })

        return {
            'as_of_date': str(as_of_date),
            'customers': rows,
            'total_0_30': str(tot_0_30),
            'total_31_60': str(tot_31_60),
            'total_61_90': str(tot_61_90),
            'total_90_plus': str(tot_90_plus),
            'grand_total': str(grand_total)
        }

    @staticmethod
    def get_ap_aging(as_of_date=None):
        """
        Calculates Accounts Payable (AP) Aging buckets for vendors.
        """
        if not as_of_date:
            as_of_date = timezone.now().date()

        open_bills = Bill.objects.exclude(status__in=[BillStatus.PAID, BillStatus.CANCELLED])
        vendor_aging = {}

        for bill in open_bills:
            v_name = bill.vendor.name
            if v_name not in vendor_aging:
                vendor_aging[v_name] = {
                    'vendor_id': str(bill.vendor.id),
                    'vendor_name': v_name,
                    'current_0_30': Decimal('0.00'),
                    'days_31_60': Decimal('0.00'),
                    'days_61_90': Decimal('0.00'),
                    'days_90_plus': Decimal('0.00'),
                    'total_due': Decimal('0.00'),
                }

            days_overdue = (as_of_date - bill.due_date).days
            bal = bill.remaining_balance

            if days_overdue <= 30:
                vendor_aging[v_name]['current_0_30'] += bal
            elif days_overdue <= 60:
                vendor_aging[v_name]['days_31_60'] += bal
            elif days_overdue <= 90:
                vendor_aging[v_name]['days_61_90'] += bal
            else:
                vendor_aging[v_name]['days_90_plus'] += bal

            vendor_aging[v_name]['total_due'] += bal

        rows = []
        tot_0_30 = Decimal('0.00')
        tot_31_60 = Decimal('0.00')
        tot_61_90 = Decimal('0.00')
        tot_90_plus = Decimal('0.00')
        grand_total = Decimal('0.00')

        for item in vendor_aging.values():
            tot_0_30 += item['current_0_30']
            tot_31_60 += item['days_31_60']
            tot_61_90 += item['days_61_90']
            tot_90_plus += item['days_90_plus']
            grand_total += item['total_due']
            rows.append({
                'vendor_id': item['vendor_id'],
                'vendor_name': item['vendor_name'],
                'current_0_30': str(item['current_0_30']),
                'days_31_60': str(item['days_31_60']),
                'days_61_90': str(item['days_61_90']),
                'days_90_plus': str(item['days_90_plus']),
                'total_due': str(item['total_due']),
            })

        return {
            'as_of_date': str(as_of_date),
            'vendors': rows,
            'total_0_30': str(tot_0_30),
            'total_31_60': str(tot_31_60),
            'total_61_90': str(tot_61_90),
            'total_90_plus': str(tot_90_plus),
            'grand_total': str(grand_total)
        }

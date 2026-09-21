import os
import django
from decimal import Decimal
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ledgerflow.settings')
django.setup()

from django.contrib.auth.models import User
from apps.accounts.models import Account, AccountCategory, PeriodLock
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryType, JournalEntryStatus
from apps.ledger.services import PostingEngine
from apps.invoicing.models import Customer, Invoice, InvoiceItem, InvoiceStatus, PaymentRecord
from apps.payables.models import Vendor, Bill, BillItem, BillStatus, VendorPayment
from apps.banking.models import BankAccount, BankStatementTransaction

def run_seed():
    print("Seeding LedgerFlow Accounting Data...")

    # 1. Superuser / Demo Users
    if not User.objects.filter(username='admin').exists():
        User.objects.create_superuser('admin', 'admin@ledgerflow.com', 'admin123')
        print("Created superuser admin/admin123")

    # 2. Standard Chart of Accounts (COA)
    coa_data = [
        # 1000s ASSETS
        {'code': '1010', 'name': 'Petty Cash', 'category': AccountCategory.ASSET, 'opening': Decimal('1500.00')},
        {'code': '1020', 'name': 'Chase Operating Bank Account', 'category': AccountCategory.ASSET, 'opening': Decimal('85000.00')},
        {'code': '1200', 'name': 'Accounts Receivable (AR)', 'category': AccountCategory.ASSET, 'opening': Decimal('0.00')},
        {'code': '1500', 'name': 'Computer & Office Equipment', 'category': AccountCategory.ASSET, 'opening': Decimal('24000.00')},

        # 2000s LIABILITIES
        {'code': '2010', 'name': 'Accounts Payable (AP)', 'category': AccountCategory.LIABILITY, 'opening': Decimal('0.00')},
        {'code': '2100', 'name': 'Sales Tax Payable', 'category': AccountCategory.LIABILITY, 'opening': Decimal('0.00')},
        {'code': '2200', 'name': 'Payroll Liabilities', 'category': AccountCategory.LIABILITY, 'opening': Decimal('0.00')},

        # 3000s EQUITY
        {'code': '3010', 'name': "Owner's Equity / Common Stock", 'category': AccountCategory.EQUITY, 'opening': Decimal('100500.00')},
        {'code': '3020', 'name': 'Retained Earnings', 'category': AccountCategory.EQUITY, 'opening': Decimal('10000.00')},

        # 4000s REVENUE
        {'code': '4010', 'name': 'Software & Consulting Revenue', 'category': AccountCategory.REVENUE, 'opening': Decimal('0.00')},
        {'code': '4020', 'name': 'Subscription Sales', 'category': AccountCategory.REVENUE, 'opening': Decimal('0.00')},

        # 5000s EXPENSES
        {'code': '5010', 'name': 'Rent & Lease Expense', 'category': AccountCategory.EXPENSE, 'opening': Decimal('0.00')},
        {'code': '5020', 'name': 'Salaries & Wages Expense', 'category': AccountCategory.EXPENSE, 'opening': Decimal('0.00')},
        {'code': '5030', 'name': 'Utilities & Cloud Hosting', 'category': AccountCategory.EXPENSE, 'opening': Decimal('0.00')},
        {'code': '5040', 'name': 'Office Supplies & Software Licenses', 'category': AccountCategory.EXPENSE, 'opening': Decimal('0.00')},
    ]

    account_map = {}
    for acc in coa_data:
        account, created = Account.objects.get_or_create(
            code=acc['code'],
            defaults={
                'name': acc['name'],
                'category': acc['category'],
                'opening_balance': acc['opening']
            }
        )
        account_map[acc['code']] = account

    print(f"Seeded {len(account_map)} COA Accounts.")

    # 3. Period Lock Example (e.g. Past Year 2024 is locked)
    PeriodLock.objects.get_or_create(
        period_name='FY 2024 Finalized',
        defaults={
            'start_date': date(2024, 1, 1),
            'end_date': date(2024, 12, 31),
            'is_locked': True
        }
    )

    # 4. Bank Account
    chase_bank_account, _ = BankAccount.objects.get_or_create(
        account_number='CHASE-889012',
        defaults={
            'account_name': 'Main Business Checking',
            'bank_name': 'Chase Bank',
            'ledger_account': account_map['1020'],
            'opening_balance': Decimal('85000.00')
        }
    )

    # 5. Customers
    cust_acme, _ = Customer.objects.get_or_create(
        name='Acme Enterprise Systems',
        defaults={
            'email': 'billing@acme.com',
            'phone': '+1 (555) 019-2834',
            'address': '100 Innovation Way, Suite 400, Silicon Valley, CA',
            'tax_id': 'US-9920148'
        }
    )

    cust_nexus, _ = Customer.objects.get_or_create(
        name='Nexus Logistics Group',
        defaults={
            'email': 'ap@nexuslogistics.io',
            'phone': '+1 (555) 048-9921',
            'address': '750 Cargo Blvd, Chicago, IL',
            'tax_id': 'US-4481029'
        }
    )

    # 6. Vendors
    vendor_aws, _ = Vendor.objects.get_or_create(
        name='Amazon Web Services',
        defaults={
            'email': 'ar@aws.amazon.com',
            'phone': '+1 (800) 555-0100',
            'address': '410 Terry Ave N, Seattle, WA',
            'tax_id': 'US-1029384'
        }
    )

    vendor_office, _ = Vendor.objects.get_or_create(
        name='WeWork Real Estate LLC',
        defaults={
            'email': 'space@wework.com',
            'phone': '+1 (888) 555-0199',
            'address': '575 Fifth Avenue, New York, NY',
            'tax_id': 'US-8830192'
        }
    )

    # 7. Initial Posted Journal Vouchers
    # JV-2026-001: Monthly Office Rent Payment ($4,500)
    if not JournalEntry.objects.filter(entry_number='JV-2026-001').exists():
        rent_jv = JournalEntry.objects.create(
            entry_number='JV-2026-001',
            entry_type=JournalEntryType.PAYMENT,
            date=date.today() - timedelta(days=20),
            status=JournalEntryStatus.DRAFT,
            narration='Paid January Office Space Lease'
        )
        JournalItem.objects.create(journal_entry=rent_jv, account=account_map['5010'], debit=Decimal('4500.00'), credit=Decimal('0.00'), description='Office Rent')
        JournalItem.objects.create(journal_entry=rent_jv, account=account_map['1020'], debit=Decimal('0.00'), credit=Decimal('4500.00'), description='Paid via Chase Bank')
        PostingEngine.post_entry(rent_jv.id)

    # JV-2026-002: Cloud Infrastructure Expense ($2,200)
    if not JournalEntry.objects.filter(entry_number='JV-2026-002').exists():
        cloud_jv = JournalEntry.objects.create(
            entry_number='JV-2026-002',
            entry_type=JournalEntryType.STANDARD,
            date=date.today() - timedelta(days=15),
            status=JournalEntryStatus.DRAFT,
            narration='Production Server Infrastructure'
        )
        JournalItem.objects.create(journal_entry=cloud_jv, account=account_map['5030'], debit=Decimal('2200.00'), credit=Decimal('0.00'), description='AWS Cloud Servers')
        JournalItem.objects.create(journal_entry=cloud_jv, account=account_map['1020'], debit=Decimal('0.00'), credit=Decimal('2200.00'), description='Auto debit Chase')
        PostingEngine.post_entry(cloud_jv.id)

    # 8. Sample Invoice for Acme Enterprise ($12,500 + $1,250 Tax = $13,750)
    if not Invoice.objects.filter(invoice_number='INV-2026-1001').exists():
        inv = Invoice.objects.create(
            invoice_number='INV-2026-1001',
            customer=cust_acme,
            issue_date=date.today() - timedelta(days=10),
            due_date=date.today() + timedelta(days=20),
            subtotal=Decimal('12500.00'),
            tax_amount=Decimal('1250.00'),
            grand_total=Decimal('13750.00'),
            status=InvoiceStatus.SENT,
            notes='Net 30 Payment Terms. Thank you for your business!'
        )
        InvoiceItem.objects.create(
            invoice=inv,
            description='Enterprise ERP Custom Module Development',
            quantity=Decimal('1.00'),
            unit_price=Decimal('12500.00'),
            tax_rate=Decimal('10.00'),
            total_price=Decimal('13750.00')
        )

        # Create linked journal entry for Invoice
        inv_jv = JournalEntry.objects.create(
            entry_number='JV-INV-2026-1001',
            entry_type=JournalEntryType.INVOICE,
            date=inv.issue_date,
            status=JournalEntryStatus.DRAFT,
            narration=f'Invoice INV-2026-1001 for {cust_acme.name}'
        )
        JournalItem.objects.create(journal_entry=inv_jv, account=account_map['1200'], debit=Decimal('13750.00'), credit=Decimal('0.00'), description='AR - Acme')
        JournalItem.objects.create(journal_entry=inv_jv, account=account_map['4010'], debit=Decimal('0.00'), credit=Decimal('12500.00'), description='Consulting Revenue')
        JournalItem.objects.create(journal_entry=inv_jv, account=account_map['2100'], debit=Decimal('0.00'), credit=Decimal('1250.00'), description='Sales Tax Payable')
        inv.journal_entry = PostingEngine.post_entry(inv_jv.id)
        inv.save()

    # 9. Sample Bill from WeWork ($4,500)
    if not Bill.objects.filter(bill_number='BILL-2026-088').exists():
        bill = Bill.objects.create(
            bill_number='BILL-2026-088',
            vendor=vendor_office,
            issue_date=date.today() - timedelta(days=5),
            due_date=date.today() + timedelta(days=15),
            subtotal=Decimal('4500.00'),
            tax_amount=Decimal('0.00'),
            grand_total=Decimal('4500.00'),
            status=BillStatus.RECEIVED,
            notes='Office rent bill for current month'
        )
        BillItem.objects.create(
            bill=bill,
            description='Monthly Workspace Lease',
            quantity=Decimal('1.00'),
            unit_price=Decimal('4500.00'),
            tax_rate=Decimal('0.00'),
            total_price=Decimal('4500.00')
        )
        bill_jv = JournalEntry.objects.create(
            entry_number='JV-BILL-2026-088',
            entry_type=JournalEntryType.BILL,
            date=bill.issue_date,
            status=JournalEntryStatus.DRAFT,
            narration=f'Vendor Bill BILL-2026-088 from {vendor_office.name}'
        )
        JournalItem.objects.create(journal_entry=bill_jv, account=account_map['5010'], debit=Decimal('4500.00'), credit=Decimal('0.00'), description='Rent Expense')
        JournalItem.objects.create(journal_entry=bill_jv, account=account_map['2010'], debit=Decimal('0.00'), credit=Decimal('4500.00'), description='AP - WeWork')
        bill.journal_entry = PostingEngine.post_entry(bill_jv.id)
        bill.save()

    # 10. Sample Bank Statement Transactions
    BankStatementTransaction.objects.get_or_create(
        bank_account=chase_bank_account,
        reference='CHASE-TX-9901',
        defaults={
            'transaction_date': date.today() - timedelta(days=20),
            'description': 'WeWork Lease Payment - Check #1002',
            'amount': Decimal('-4500.00'),
            'is_reconciled': True
        }
    )

    BankStatementTransaction.objects.get_or_create(
        bank_account=chase_bank_account,
        reference='CHASE-TX-9902',
        defaults={
            'transaction_date': date.today() - timedelta(days=15),
            'description': 'AWS AWS.Amazon.com Cloud Svcs',
            'amount': Decimal('-2200.00'),
            'is_reconciled': True
        }
    )

    BankStatementTransaction.objects.get_or_create(
        bank_account=chase_bank_account,
        reference='CHASE-TX-9903',
        defaults={
            'transaction_date': date.today() - timedelta(days=2),
            'description': 'Incoming Wire Acme Corp',
            'amount': Decimal('13750.00'),
            'is_reconciled': False
        }
    )

    print("Seed process completed successfully!")

if __name__ == '__main__':
    run_seed()

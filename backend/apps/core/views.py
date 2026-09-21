from rest_framework import viewsets, filters, views, status
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import json

from .models import AuditLog
from .serializers import AuditLogSerializer

from apps.accounts.models import Account, PeriodLock
from apps.accounts.serializers import AccountSerializer
from apps.ledger.models import JournalEntry, JournalItem, JournalEntryStatus, JournalEntryType
from apps.ledger.serializers import JournalEntrySerializer
from apps.invoicing.models import Customer, Invoice, InvoiceItem, PaymentRecord
from apps.invoicing.serializers import CustomerSerializer, InvoiceSerializer
from apps.payables.models import Vendor, Bill, BillItem, VendorPayment
from apps.payables.serializers import VendorSerializer, BillSerializer
from apps.banking.models import BankAccount, BankStatementTransaction
from apps.banking.serializers import BankAccountSerializer, BankStatementTransactionSerializer

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('user')
    serializer_class = AuditLogSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['action', 'user__username', 'user_role', 'model_name', 'object_id']
    ordering_fields = ['timestamp']

class DataExportView(views.APIView):
    """
    Exports single dataset or complete financial database backup in structured JSON format.
    """
    def get(self, request):
        export_type = request.query_params.get('type', 'all')
        data = {}

        if export_type in ['all', 'accounts']:
            accounts = Account.objects.all().order_by('code')
            data['accounts'] = AccountSerializer(accounts, many=True).data

        if export_type in ['all', 'customers']:
            customers = Customer.objects.all().order_by('name')
            data['customers'] = CustomerSerializer(customers, many=True).data

        if export_type in ['all', 'vendors']:
            vendors = Vendor.objects.all().order_by('name')
            data['vendors'] = VendorSerializer(vendors, many=True).data

        if export_type in ['all', 'vouchers', 'journal_entries']:
            entries = JournalEntry.objects.all().prefetch_related('items').order_by('-date', '-created_at')
            data['journal_entries'] = JournalEntrySerializer(entries, many=True).data

        if export_type in ['all', 'invoices']:
            invoices = Invoice.objects.all().prefetch_related('items', 'payments').order_by('-issue_date')
            data['invoices'] = InvoiceSerializer(invoices, many=True).data

        if export_type in ['all', 'bills']:
            bills = Bill.objects.all().prefetch_related('items', 'payments').order_by('-issue_date')
            data['bills'] = BillSerializer(bills, many=True).data

        if export_type in ['all', 'banking']:
            bank_accounts = BankAccount.objects.all()
            transactions = BankStatementTransaction.objects.all().order_by('-transaction_date')
            data['bank_accounts'] = BankAccountSerializer(bank_accounts, many=True).data
            data['bank_transactions'] = BankStatementTransactionSerializer(transactions, many=True).data

        return Response({
            "version": "1.0",
            "exported_at": timezone.now().isoformat(),
            "export_type": export_type,
            "data": data
        }, status=status.HTTP_200_OK)

class DataImportView(views.APIView):
    """
    Handles bulk imports and full system restoration for accounts, vouchers, invoices, bills, customers, vendors, and banking.
    """
    def post(self, request):
        payload = request.data
        import_type = payload.get('type', 'auto')
        items = payload.get('data')

        if items is None:
            return Response({"error": "No 'data' provided in import payload."}, status=status.HTTP_400_BAD_REQUEST)

        results = {
            "success": True,
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": []
        }

        try:
            with transaction.atomic():
                # 1. Full Backup Import / Restore
                if isinstance(items, dict) and ('accounts' in items or 'journal_entries' in items or 'invoices' in items or 'bills' in items or 'customers' in items or 'vendors' in items or 'bank_accounts' in items):
                    # Accounts
                    if 'accounts' in items and isinstance(items['accounts'], list):
                        for acc in items['accounts']:
                            code = str(acc.get('code', '')).strip()
                            name = str(acc.get('name', '')).strip()
                            category = str(acc.get('category', 'ASSET')).strip().upper()
                            op_bal = Decimal(str(acc.get('opening_balance', '0.00')).replace('$', '').replace(',', '') or '0.00')
                            if code and name:
                                obj, created = Account.objects.update_or_create(
                                    code=code,
                                    defaults={'name': name, 'category': category, 'opening_balance': op_bal, 'is_active': True}
                                )
                                if created: results["created"] += 1
                                else: results["updated"] += 1

                    # Customers
                    if 'customers' in items and isinstance(items['customers'], list):
                        for c in items['customers']:
                            c_name = str(c.get('name', '')).strip()
                            if c_name:
                                Customer.objects.get_or_create(
                                    name=c_name,
                                    defaults={
                                        'email': c.get('email', ''),
                                        'phone': c.get('phone', ''),
                                        'address': c.get('address', ''),
                                        'tax_id': c.get('tax_id', '')
                                    }
                                )
                                results["created"] += 1

                    # Vendors
                    if 'vendors' in items and isinstance(items['vendors'], list):
                        for v in items['vendors']:
                            v_name = str(v.get('name', '')).strip()
                            if v_name:
                                Vendor.objects.get_or_create(
                                    name=v_name,
                                    defaults={
                                        'email': v.get('email', ''),
                                        'phone': v.get('phone', ''),
                                        'address': v.get('address', ''),
                                        'tax_id': v.get('tax_id', '')
                                    }
                                )
                                results["created"] += 1

                    # Bank Accounts
                    if 'bank_accounts' in items and isinstance(items['bank_accounts'], list):
                        for b in items['bank_accounts']:
                            b_name = str(b.get('bank_name', '')).strip()
                            a_name = str(b.get('account_name', '')).strip()
                            a_num = str(b.get('account_number', '')).strip()
                            if b_name and a_name:
                                BankAccount.objects.get_or_create(
                                    account_number=a_num,
                                    defaults={
                                        'bank_name': b_name,
                                        'account_name': a_name,
                                        'opening_balance': Decimal(str(b.get('opening_balance', '0.00')) or '0.00')
                                    }
                                )
                                results["created"] += 1

                    return Response({
                        "message": "Full backup data processed successfully.",
                        "results": results
                    }, status=status.HTTP_200_OK)

                # 2. Specific Entity List Import
                if not isinstance(items, list):
                    return Response({"error": "'data' must be a list of records."}, status=status.HTTP_400_BAD_REQUEST)

                # Entity: Accounts
                if import_type == 'accounts':
                    for idx, row in enumerate(items):
                        code = str(row.get('code') or row.get('Account Code') or row.get('Code') or '').strip()
                        name = str(row.get('name') or row.get('Account Name') or row.get('Name') or '').strip()
                        category = str(row.get('category') or row.get('Category') or 'ASSET').strip().upper()
                        op_bal_raw = str(row.get('opening_balance') or row.get('Opening Balance') or '0.00').replace('$', '').replace(',', '')
                        
                        if not code or not name:
                            results["skipped"] += 1
                            results["errors"].append(f"Row {idx + 1}: Missing code or name")
                            continue

                        valid_cats = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
                        if category not in valid_cats:
                            category = 'ASSET'

                        try:
                            op_bal = Decimal(op_bal_raw or '0.00')
                        except Exception:
                            op_bal = Decimal('0.00')

                        obj, created = Account.objects.update_or_create(
                            code=code,
                            defaults={
                                'name': name,
                                'category': category,
                                'opening_balance': op_bal,
                                'is_active': True
                            }
                        )
                        if created: results["created"] += 1
                        else: results["updated"] += 1

                # Entity: Journal Entries / Vouchers
                elif import_type in ['vouchers', 'journal_entries']:
                    for idx, row in enumerate(items):
                        entry_num = str(row.get('entry_number') or row.get('Voucher Number') or row.get('Entry Number') or f"JV-IMP-{timezone.now().strftime('%Y%m%d%H%M%S')}-{idx}").strip()
                        date_val = str(row.get('date') or row.get('Date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        narration = str(row.get('narration') or row.get('Narration') or row.get('Description') or 'Imported Journal Voucher').strip()
                        entry_type = str(row.get('entry_type') or row.get('Type') or 'STANDARD').strip().upper()
                        if entry_type not in ['STANDARD', 'PAYMENT', 'RECEIPT', 'CONTRA', 'INVOICE', 'BILL', 'REVERSAL']:
                            entry_type = 'STANDARD'

                        raw_items = row.get('items', [])
                        # Support flat CSV row formats with debit_account, debit_amount, credit_account, credit_amount
                        if not raw_items:
                            dr_acc_code = str(row.get('debit_account') or row.get('Debit Account') or '').strip()
                            dr_amt = Decimal(str(row.get('debit_amount') or row.get('Debit Amount') or '0.00').replace('$', '').replace(',', '') or '0.00')
                            cr_acc_code = str(row.get('credit_account') or row.get('Credit Account') or '').strip()
                            cr_amt = Decimal(str(row.get('credit_amount') or row.get('Credit Amount') or '0.00').replace('$', '').replace(',', '') or '0.00')

                            if dr_acc_code and cr_acc_code and dr_amt > 0 and cr_amt > 0:
                                dr_acc, _ = Account.objects.get_or_create(code=dr_acc_code, defaults={'name': f"Account {dr_acc_code}", 'category': 'EXPENSE'})
                                cr_acc, _ = Account.objects.get_or_create(code=cr_acc_code, defaults={'name': f"Account {cr_acc_code}", 'category': 'ASSET'})
                                raw_items = [
                                    {'account': dr_acc.id, 'debit': dr_amt, 'credit': Decimal('0.00'), 'description': narration},
                                    {'account': cr_acc.id, 'debit': Decimal('0.00'), 'credit': cr_amt, 'description': narration}
                                ]

                        if not raw_items or len(raw_items) < 2:
                            results["skipped"] += 1
                            results["errors"].append(f"Row {idx + 1}: Journal Voucher requires at least 2 balanced line items.")
                            continue

                        # Check if entry_number already exists
                        if JournalEntry.objects.filter(entry_number=entry_num).exists():
                            entry_num = f"{entry_num}-{idx+1}"

                        jv = JournalEntry.objects.create(
                            entry_number=entry_num,
                            date=date_val,
                            narration=narration,
                            entry_type=entry_type,
                            status=JournalEntryStatus.POSTED,
                            posted_at=timezone.now()
                        )

                        for itm in raw_items:
                            acc_val = itm.get('account')
                            if isinstance(acc_val, str) and not acc_val.replace('-', '').isalnum():
                                # might be code
                                acc_obj, _ = Account.objects.get_or_create(code=acc_val, defaults={'name': f"Account {acc_val}", 'category': 'ASSET'})
                                acc_id = acc_obj.id
                            elif isinstance(acc_val, str) and len(acc_val) < 10:
                                # code
                                acc_obj, _ = Account.objects.get_or_create(code=acc_val, defaults={'name': f"Account {acc_val}", 'category': 'ASSET'})
                                acc_id = acc_obj.id
                            else:
                                acc_id = acc_val

                            JournalItem.objects.create(
                                journal_entry=jv,
                                account_id=acc_id,
                                debit=Decimal(str(itm.get('debit', '0.00')) or '0.00'),
                                credit=Decimal(str(itm.get('credit', '0.00')) or '0.00'),
                                description=itm.get('description', '')
                            )
                        results["created"] += 1

                # Entity: Customers
                elif import_type == 'customers':
                    for idx, row in enumerate(items):
                        name = str(row.get('name') or row.get('Customer Name') or row.get('Name') or '').strip()
                        if not name:
                            results["skipped"] += 1
                            continue
                        Customer.objects.update_or_create(
                            name=name,
                            defaults={
                                'email': str(row.get('email') or row.get('Email') or ''),
                                'phone': str(row.get('phone') or row.get('Phone') or ''),
                                'address': str(row.get('address') or row.get('Address') or ''),
                                'tax_id': str(row.get('tax_id') or row.get('Tax ID') or row.get('GSTIN') or '')
                            }
                        )
                        results["created"] += 1

                # Entity: Vendors
                elif import_type == 'vendors':
                    for idx, row in enumerate(items):
                        name = str(row.get('name') or row.get('Vendor Name') or row.get('Name') or '').strip()
                        if not name:
                            results["skipped"] += 1
                            continue
                        Vendor.objects.update_or_create(
                            name=name,
                            defaults={
                                'email': str(row.get('email') or row.get('Email') or ''),
                                'phone': str(row.get('phone') or row.get('Phone') or ''),
                                'address': str(row.get('address') or row.get('Address') or ''),
                                'tax_id': str(row.get('tax_id') or row.get('Tax ID') or row.get('GSTIN') or '')
                            }
                        )
                        results["created"] += 1

                # Entity: Invoices
                elif import_type == 'invoices':
                    for idx, row in enumerate(items):
                        inv_num = str(row.get('invoice_number') or row.get('Invoice Number') or f"INV-IMP-{timezone.now().strftime('%Y%m%d')}-{idx+1}").strip()
                        cust_name = str(row.get('customer_name') or row.get('Customer') or row.get('Customer Name') or 'General Customer').strip()
                        cust, _ = Customer.objects.get_or_create(name=cust_name)

                        issue_date = str(row.get('issue_date') or row.get('Issue Date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        due_date = str(row.get('due_date') or row.get('Due Date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        subtotal = Decimal(str(row.get('subtotal') or row.get('Subtotal') or row.get('Amount') or '0.00').replace('$', '').replace(',', '') or '0.00')
                        tax_amt = Decimal(str(row.get('tax_amount') or row.get('Tax Amount') or row.get('Tax') or '0.00').replace('$', '').replace(',', '') or '0.00')
                        grand_tot = Decimal(str(row.get('grand_total') or row.get('Grand Total') or row.get('Total') or (subtotal + tax_amt)).replace('$', '').replace(',', '') or '0.00')
                        notes = str(row.get('notes') or row.get('Notes') or 'Imported Invoice').strip()

                        inv, created = Invoice.objects.update_or_create(
                            invoice_number=inv_num,
                            defaults={
                                'customer': cust,
                                'issue_date': issue_date,
                                'due_date': due_date,
                                'subtotal': subtotal,
                                'tax_amount': tax_amt,
                                'grand_total': grand_tot,
                                'status': 'DRAFT',
                                'notes': notes
                            }
                        )

                        # Check for items
                        raw_items = row.get('items', [])
                        if raw_items:
                            inv.items.all().delete()
                            for itm in raw_items:
                                InvoiceItem.objects.create(
                                    invoice=inv,
                                    description=itm.get('description', 'Service / Goods'),
                                    quantity=Decimal(str(itm.get('quantity', '1.00')) or '1.00'),
                                    unit_price=Decimal(str(itm.get('unit_price', '0.00')) or '0.00'),
                                    tax_rate=Decimal(str(itm.get('tax_rate', '0.00')) or '0.00')
                                )
                        else:
                            if not inv.items.exists():
                                InvoiceItem.objects.create(
                                    invoice=inv,
                                    description='Imported Item / Service',
                                    quantity=Decimal('1.00'),
                                    unit_price=subtotal,
                                    tax_rate=Decimal('0.00')
                                )

                        if created: results["created"] += 1
                        else: results["updated"] += 1

                # Entity: Bills
                elif import_type == 'bills':
                    for idx, row in enumerate(items):
                        bill_num = str(row.get('bill_number') or row.get('Bill Number') or f"BILL-IMP-{timezone.now().strftime('%Y%m%d')}-{idx+1}").strip()
                        vend_name = str(row.get('vendor_name') or row.get('Vendor') or row.get('Vendor Name') or 'General Vendor').strip()
                        vend, _ = Vendor.objects.get_or_create(name=vend_name)

                        issue_date = str(row.get('issue_date') or row.get('Issue Date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        due_date = str(row.get('due_date') or row.get('Due Date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        subtotal = Decimal(str(row.get('subtotal') or row.get('Subtotal') or row.get('Amount') or '0.00').replace('$', '').replace(',', '') or '0.00')
                        tax_amt = Decimal(str(row.get('tax_amount') or row.get('Tax Amount') or row.get('Tax') or '0.00').replace('$', '').replace(',', '') or '0.00')
                        grand_tot = Decimal(str(row.get('grand_total') or row.get('Grand Total') or row.get('Total') or (subtotal + tax_amt)).replace('$', '').replace(',', '') or '0.00')
                        notes = str(row.get('notes') or row.get('Notes') or 'Imported Purchase Bill').strip()

                        bill, created = Bill.objects.update_or_create(
                            bill_number=bill_num,
                            defaults={
                                'vendor': vend,
                                'issue_date': issue_date,
                                'due_date': due_date,
                                'subtotal': subtotal,
                                'tax_amount': tax_amt,
                                'grand_total': grand_tot,
                                'status': 'DRAFT',
                                'notes': notes
                            }
                        )

                        raw_items = row.get('items', [])
                        if raw_items:
                            bill.items.all().delete()
                            for itm in raw_items:
                                BillItem.objects.create(
                                    bill=bill,
                                    description=itm.get('description', 'Purchase Item'),
                                    quantity=Decimal(str(itm.get('quantity', '1.00')) or '1.00'),
                                    unit_price=Decimal(str(itm.get('unit_price', '0.00')) or '0.00'),
                                    tax_rate=Decimal(str(itm.get('tax_rate', '0.00')) or '0.00')
                                )
                        else:
                            if not bill.items.exists():
                                BillItem.objects.create(
                                    bill=bill,
                                    description='Imported Purchase Item',
                                    quantity=Decimal('1.00'),
                                    unit_price=subtotal,
                                    tax_rate=Decimal('0.00')
                                )

                        if created: results["created"] += 1
                        else: results["updated"] += 1

                # Entity: Bank Statement Transactions
                elif import_type in ['bank_transactions', 'banking']:
                    bank_id = payload.get('bank_account_id')
                    bank_acc = None
                    if bank_id:
                        bank_acc = BankAccount.objects.filter(pk=bank_id).first()
                    if not bank_acc:
                        bank_acc = BankAccount.objects.first()

                    if not bank_acc:
                        return Response({"error": "No bank account found to import transactions into."}, status=status.HTTP_400_BAD_REQUEST)

                    for idx, row in enumerate(items):
                        tx_date = str(row.get('transaction_date') or row.get('Date') or row.get('date') or timezone.now().strftime('%Y-%m-%d')).strip()
                        desc = str(row.get('description') or row.get('Description') or 'Bank Statement Transaction').strip()
                        ref = str(row.get('reference') or row.get('Reference') or '').strip()
                        amt_raw = str(row.get('amount') or row.get('Amount') or '0.00').replace('$', '').replace(',', '').strip()

                        try:
                            amt = Decimal(amt_raw)
                        except Exception:
                            amt = Decimal('0.00')

                        if amt != 0:
                            BankStatementTransaction.objects.create(
                                bank_account=bank_acc,
                                transaction_date=tx_date,
                                description=desc,
                                reference=ref,
                                amount=amt
                            )
                            results["created"] += 1
                        else:
                            results["skipped"] += 1

                else:
                    return Response({"error": f"Unknown import type: {import_type}"}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "message": f"Successfully processed {import_type} import.",
                "results": results
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": f"Import operation failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


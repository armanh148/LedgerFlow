from rest_framework import serializers
from .models import Customer, Invoice, InvoiceItem, PaymentRecord
from apps.ledger.serializers import JournalEntrySerializer

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'tax_rate', 'total_price']

class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    customer_details = CustomerSerializer(source='customer', read_only=True)
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all())
    journal_entry_details = JournalEntrySerializer(source='journal_entry', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    remaining_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'customer', 'customer_details', 'issue_date', 'due_date',
            'subtotal', 'tax_amount', 'grand_total', 'status', 'journal_entry',
            'journal_entry_details', 'notes', 'created_at', 'items', 'paid_amount', 'remaining_balance'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        invoice = Invoice.objects.create(**validated_data)
        subtotal = 0
        tax_total = 0

        for item_data in items_data:
            item = InvoiceItem.objects.create(invoice=invoice, **item_data)
            sub = item.quantity * item.unit_price
            tax = sub * (item.tax_rate / 100)
            subtotal += sub
            tax_total += tax

        invoice.subtotal = subtotal
        invoice.tax_amount = tax_total
        invoice.grand_total = subtotal + tax_total
        invoice.save()
        return invoice

class PaymentRecordSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = PaymentRecord
        fields = '__all__'

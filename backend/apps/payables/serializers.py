from rest_framework import serializers
from .models import Vendor, Bill, BillItem, VendorPayment
from apps.ledger.serializers import JournalEntrySerializer

class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'

class BillItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'tax_rate', 'total_price']

class BillSerializer(serializers.ModelSerializer):
    items = BillItemSerializer(many=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    vendor = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all())
    journal_entry_details = JournalEntrySerializer(source='journal_entry', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    remaining_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = Bill
        fields = [
            'id', 'bill_number', 'vendor', 'vendor_details', 'issue_date', 'due_date',
            'subtotal', 'tax_amount', 'grand_total', 'status', 'journal_entry',
            'journal_entry_details', 'notes', 'created_at', 'items', 'paid_amount', 'remaining_balance'
        ]

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        bill = Bill.objects.create(**validated_data)
        subtotal = 0
        tax_total = 0

        for item_data in items_data:
            item = BillItem.objects.create(bill=bill, **item_data)
            sub = item.quantity * item.unit_price
            tax = sub * (item.tax_rate / 100)
            subtotal += sub
            tax_total += tax

        bill.subtotal = subtotal
        bill.tax_amount = tax_total
        bill.grand_total = subtotal + tax_total
        bill.save()
        return bill

class VendorPaymentSerializer(serializers.ModelSerializer):
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True)

    class Meta:
        model = VendorPayment
        fields = '__all__'

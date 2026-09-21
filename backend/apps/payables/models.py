import uuid
from decimal import Decimal
from django.db import models
from apps.ledger.models import JournalEntry

class Vendor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    address = models.TextField(blank=True, default='')
    tax_id = models.CharField(max_length=50, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.email})"

class BillStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    RECEIVED = 'RECEIVED', 'Received'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Paid'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'

class Bill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill_number = models.CharField(max_length=50, unique=True)
    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name='bills')
    issue_date = models.DateField()
    due_date = models.DateField()
    subtotal = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    grand_total = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=BillStatus.choices, default=BillStatus.DRAFT)
    journal_entry = models.OneToOneField(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='bill')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']

    def __str__(self):
        return f"{self.bill_number} - {self.vendor.name} ({self.status}) ${self.grand_total}"

    @property
    def paid_amount(self) -> Decimal:
        return sum((p.paid_amount for p in self.payments.all()), Decimal('0.00'))

    @property
    def remaining_balance(self) -> Decimal:
        return self.grand_total - self.paid_amount

class BillItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    total_price = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))

    def save(self, *args, **kwargs):
        sub = self.quantity * self.unit_price
        tax = sub * (self.tax_rate / Decimal('100.00'))
        self.total_price = sub + tax
        super().save(*args, **kwargs)

class VendorPayment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_number = models.CharField(max_length=50, unique=True)
    bill = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='payments')
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2)
    payment_date = models.DateField()
    payment_mode = models.CharField(max_length=20, default='BANK_TRANSFER')
    reference_number = models.CharField(max_length=100, blank=True, default='')
    journal_entry = models.OneToOneField(JournalEntry, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_payment')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payment_number} - Bill {self.bill.bill_number}: ${self.paid_amount}"

from rest_framework import serializers
from .models import Account, PeriodLock

class AccountSerializer(serializers.ModelSerializer):
    current_balance = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = Account
        fields = ['id', 'code', 'name', 'category', 'category_display', 'parent_account', 'is_active', 'opening_balance', 'current_balance']

class PeriodLockSerializer(serializers.ModelSerializer):
    class Meta:
        model = PeriodLock
        fields = '__all__'

from rest_framework import serializers
from .models import BankAccount, BankStatementTransaction, BankReconciliation
from apps.accounts.serializers import AccountSerializer

class BankAccountSerializer(serializers.ModelSerializer):
    ledger_account_details = AccountSerializer(source='ledger_account', read_only=True)
    current_balance = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = ['id', 'account_name', 'account_number', 'bank_name', 'ledger_account', 'ledger_account_details', 'opening_balance', 'current_balance', 'created_at']

    def get_current_balance(self, obj):
        try:
            return str(obj.current_balance)
        except Exception:
            return str(obj.opening_balance)

class BankStatementTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankStatementTransaction
        fields = '__all__'

class BankReconciliationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankReconciliation
        fields = '__all__'

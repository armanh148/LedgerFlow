from rest_framework import serializers
from .models import JournalEntry, JournalItem
from apps.accounts.serializers import AccountSerializer
from apps.accounts.models import Account

class JournalItemSerializer(serializers.ModelSerializer):
    account_details = AccountSerializer(source='account', read_only=True)
    account = serializers.PrimaryKeyRelatedField(queryset=Account.objects.all())

    class Meta:
        model = JournalItem
        fields = ['id', 'account', 'account_details', 'debit', 'credit', 'description']

class JournalEntrySerializer(serializers.ModelSerializer):
    items = JournalItemSerializer(many=True)
    total_debit = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_credit = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_balanced = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = JournalEntry
        fields = [
            'id', 'entry_number', 'entry_type', 'date', 'status', 'narration',
            'created_by', 'created_by_name', 'posted_by', 'posted_at', 'created_at',
            'reverses_entry', 'items', 'total_debit', 'total_credit', 'is_balanced'
        ]
        read_only_fields = ['created_by', 'posted_by', 'posted_at', 'created_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        journal_entry = JournalEntry.objects.create(**validated_data)
        for item_data in items_data:
            JournalItem.objects.create(journal_entry=journal_entry, **item_data)
        return journal_entry

    def update(self, instance, validated_data):
        if instance.status == 'POSTED':
            raise serializers.ValidationError("Audit Immutability Violation: Posted journal entries cannot be modified.")

        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                JournalItem.objects.create(journal_entry=instance, **item_data)

        return instance

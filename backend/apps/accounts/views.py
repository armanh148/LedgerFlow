from rest_framework import viewsets, filters
from .models import Account, PeriodLock
from .serializers import AccountSerializer, PeriodLockSerializer
from apps.core.permissions import RBACPermission

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name', 'category']
    ordering_fields = ['code', 'name', 'category']

class PeriodLockViewSet(viewsets.ModelViewSet):
    queryset = PeriodLock.objects.all()
    serializer_class = PeriodLockSerializer
    permission_classes = [RBACPermission]


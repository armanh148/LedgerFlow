from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from .models import JournalEntry, JournalItem
from .serializers import JournalEntrySerializer, JournalItemSerializer
from .services import PostingEngine
from apps.core.permissions import RBACPermission

class JournalEntryViewSet(viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all().prefetch_related('items__account')
    serializer_class = JournalEntrySerializer
    permission_classes = [RBACPermission]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['entry_number', 'narration', 'entry_type', 'status']
    ordering_fields = ['date', 'entry_number', 'created_at']

    @action(detail=True, methods=['post'], url_path='post')
    def post_entry(self, request, pk=None):
        """Post a draft entry to the general ledger."""
        user_role = request.headers.get('X-User-Role', 'ACCOUNTANT')
        if user_role == 'DATA_ENTRY':
            return Response(
                {"error": "Permission Denied: Data Entry operators cannot post directly to General Ledger."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            posted = PostingEngine.post_entry(
                entry_id=pk,
                user=request.user if request.user.is_authenticated else None,
                user_role=user_role
            )
            serializer = self.get_serializer(posted)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except ValidationError as e:
            return Response({"error": str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reverse')
    def reverse_entry(self, request, pk=None):
        """Create an opposite reversal entry for a posted entry."""
        user_role = request.headers.get('X-User-Role', 'ACCOUNTANT')
        if user_role == 'DATA_ENTRY':
            return Response(
                {"error": "Permission Denied: Data Entry operators cannot reverse entries."},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reason', 'Correction of entry')
        try:
            reversal = PostingEngine.reverse_entry(
                entry_id=pk,
                reason=reason,
                user=request.user if request.user.is_authenticated else None,
                user_role=user_role
            )
            serializer = self.get_serializer(reversal)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class JournalItemViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JournalItem.objects.all().select_related('account', 'journal_entry')
    serializer_class = JournalItemSerializer
    permission_classes = [RBACPermission]

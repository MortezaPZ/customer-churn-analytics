from django.contrib import admin

from .models import Dataset, TrainingRun


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ['name', 'row_count', 'column_count', 'churn_rate', 'uploaded_at']
    search_fields = ['name']
    readonly_fields = ['schema']


@admin.register(TrainingRun)
class TrainingRunAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'status', 'roc_auc', 'f1_score', 'created_at']
    list_filter = ['status', 'algorithm']
    readonly_fields = ['feature_importances', 'confusion_matrix', 'roc_curve']

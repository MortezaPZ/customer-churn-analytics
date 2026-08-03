from rest_framework import serializers

from .models import Dataset, TrainingRun


class DatasetSerializer(serializers.ModelSerializer):
    run_count = serializers.IntegerField(source='runs.count', read_only=True)

    class Meta:
        model = Dataset
        fields = [
            'id',
            'name',
            'target_column',
            'row_count',
            'column_count',
            'churn_rate',
            'schema',
            'run_count',
            'uploaded_at',
        ]
        read_only_fields = fields


class DatasetListSerializer(DatasetSerializer):
    """The list view does not need the full column profile."""

    class Meta(DatasetSerializer.Meta):
        fields = [
            field for field in DatasetSerializer.Meta.fields if field != 'schema'
        ]
        read_only_fields = fields


class DatasetUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    target_column = serializers.CharField(max_length=100, default='Churn')

    def validate_file(self, value):
        if not value.name.lower().endswith('.csv'):
            raise serializers.ValidationError('Only .csv files are supported.')
        if value.size > 20 * 1024 * 1024:
            raise serializers.ValidationError('File must be 20 MB or smaller.')
        return value


class TrainingRunSerializer(serializers.ModelSerializer):
    dataset_name = serializers.CharField(source='dataset.name', read_only=True)
    algorithm_label = serializers.CharField(
        source='get_algorithm_display', read_only=True
    )

    class Meta:
        model = TrainingRun
        fields = [
            'id',
            'dataset',
            'dataset_name',
            'algorithm',
            'algorithm_label',
            'status',
            'error_message',
            'accuracy',
            'precision',
            'recall',
            'f1_score',
            'roc_auc',
            'confusion_matrix',
            'feature_importances',
            'roc_curve',
            'training_seconds',
            'created_at',
        ]
        read_only_fields = fields


class TrainRequestSerializer(serializers.Serializer):
    algorithm = serializers.ChoiceField(
        choices=[choice[0] for choice in TrainingRun.ALGORITHM_CHOICES],
        default='gradient_boosting',
    )


class PredictRequestSerializer(serializers.Serializer):
    records = serializers.ListField(
        child=serializers.DictField(), allow_empty=False, max_length=1000
    )

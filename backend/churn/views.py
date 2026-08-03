import pandas as pd
from django.core.files.storage import default_storage
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from . import ml
from .models import Dataset, TrainingRun
from .serializers import (
    DatasetListSerializer,
    DatasetSerializer,
    DatasetUploadSerializer,
    PredictRequestSerializer,
    TrainingRunSerializer,
    TrainRequestSerializer,
)


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'detail': str(message)}, status=code)


def _jsonable(frame: pd.DataFrame) -> list[dict]:
    """NaN is not valid JSON, so swap it for null before serialising rows."""
    return frame.astype(object).where(frame.notna(), None).to_dict('records')


class DatasetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Dataset.objects.all()

    def get_serializer_class(self):
        return DatasetSerializer if self.action == 'retrieve' else DatasetListSerializer

    # Only the upload takes a file; the other actions speak JSON.
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """Accept a CSV, profile it, and store it as a Dataset."""
        serializer = DatasetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data['file']
        target = serializer.validated_data['target_column']

        saved_path = default_storage.save(f'datasets/{upload.name}', upload)
        try:
            frame = ml.read_csv(default_storage.path(saved_path))
            profile = ml.profile_dataframe(frame, target)
        except ml.DataError as exc:
            default_storage.delete(saved_path)
            return _error(exc)

        dataset = Dataset.objects.create(
            name=serializer.validated_data.get('name') or upload.name,
            file=saved_path,
            target_column=target,
            row_count=profile['row_count'],
            column_count=profile['column_count'],
            churn_rate=profile['churn_rate'],
            schema=profile,
        )
        return Response(DatasetSerializer(dataset).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def train(self, request, pk=None):
        """Fit a model on this dataset and persist the run with its metrics."""
        dataset = self.get_object()
        serializer = TrainRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        algorithm = serializer.validated_data['algorithm']

        run = TrainingRun.objects.create(dataset=dataset, algorithm=algorithm)
        try:
            frame = ml.read_csv(dataset.file.path)
            result = ml.train(frame, dataset.target_column, algorithm)
        except ml.DataError as exc:
            run.status = 'failed'
            run.error_message = str(exc)
            run.save(update_fields=['status', 'error_message'])
            return _error(exc)

        run.status = 'completed'
        run.accuracy = result.accuracy
        run.precision = result.precision
        run.recall = result.recall
        run.f1_score = result.f1
        run.roc_auc = result.roc_auc
        run.confusion_matrix = result.confusion
        run.feature_importances = result.importances
        run.roc_curve = result.roc
        run.artifact_path = result.artifact_path
        run.training_seconds = result.seconds
        run.save()

        return Response(TrainingRunSerializer(run).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """First rows of the raw file, for the upload confirmation screen."""
        dataset = self.get_object()
        frame = ml.read_csv(dataset.file.path).head(20)
        return Response({'columns': list(frame.columns), 'rows': _jsonable(frame)})


class TrainingRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TrainingRun.objects.select_related('dataset').all()
    serializer_class = TrainingRunSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        dataset_id = self.request.query_params.get('dataset')
        return queryset.filter(dataset_id=dataset_id) if dataset_id else queryset

    @action(detail=True, methods=['get'])
    def segments(self, request, pk=None):
        """Score the whole dataset and bucket customers into risk bands."""
        run = self._completed_run()
        _, probabilities = self._score_dataset(run)

        bands = pd.Series([ml.risk_band(p) for p in probabilities])
        segments = []
        for band in ('high', 'medium', 'low'):
            mask = (bands == band).to_numpy()
            segments.append(
                {
                    'band': band,
                    'customers': int(mask.sum()),
                    'share': round(float(mask.mean()), 4),
                    'average_probability': round(float(probabilities[mask].mean()), 4)
                    if mask.any()
                    else 0.0,
                }
            )

        return Response(
            {
                'total_customers': len(bands),
                'at_risk': int((bands != 'low').sum()),
                'average_probability': round(float(probabilities.mean()), 4),
                'segments': segments,
            }
        )

    @action(detail=True, methods=['get'])
    def predictions(self, request, pk=None):
        """The highest-risk customers, ready for a retention campaign."""
        run = self._completed_run()
        frame, probabilities = self._score_dataset(run)

        try:
            limit = min(int(request.query_params.get('limit', 50)), 500)
        except ValueError:
            raise ValidationError({'limit': 'Must be an integer.'})

        scored = frame.copy()
        scored['churn_probability'] = probabilities.round(4)
        scored['risk_band'] = [ml.risk_band(p) for p in probabilities]
        scored = scored.sort_values('churn_probability', ascending=False).head(limit)

        return Response({'count': len(scored), 'results': _jsonable(scored)})

    @action(detail=True, methods=['post'])
    def predict(self, request, pk=None):
        """Score ad-hoc records posted as JSON."""
        run = self._completed_run()
        serializer = PredictRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        frame = pd.DataFrame(serializer.validated_data['records'])
        try:
            probabilities = ml.score(ml.load(run.artifact_path), frame)
        except ml.DataError as exc:
            return _error(exc)

        return Response(
            {
                'results': [
                    {
                        'churn_probability': round(float(p), 4),
                        'risk_band': ml.risk_band(float(p)),
                    }
                    for p in probabilities
                ]
            }
        )

    def _completed_run(self) -> TrainingRun:
        run = self.get_object()
        if run.status != 'completed' or not run.artifact_path:
            raise ValidationError(
                {'detail': 'This training run has no usable model yet.'}
            )
        return run

    def _score_dataset(self, run: TrainingRun):
        frame = ml.read_csv(run.dataset.file.path)
        probabilities = ml.score(ml.load(run.artifact_path), frame)
        return frame, probabilities


@api_view(['GET'])
def overview(request):
    """Headline numbers for the dashboard landing card."""
    latest = TrainingRun.objects.filter(status='completed').first()
    return Response(
        {
            'datasets': Dataset.objects.count(),
            'training_runs': TrainingRun.objects.count(),
            'latest_run': TrainingRunSerializer(latest).data if latest else None,
        }
    )

from django.db import models


class Dataset(models.Model):
    """A customer CSV uploaded by the user, plus the profiling we ran on it."""

    name = models.CharField(max_length=200)
    file = models.FileField(upload_to='datasets/')
    target_column = models.CharField(max_length=100)
    row_count = models.PositiveIntegerField(default=0)
    column_count = models.PositiveIntegerField(default=0)
    churn_rate = models.FloatField(default=0.0)
    schema = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.name} ({self.row_count} rows)'


class TrainingRun(models.Model):
    """One fit of a model against a dataset, with its holdout metrics."""

    ALGORITHM_CHOICES = [
        ('gradient_boosting', 'Gradient Boosting'),
        ('random_forest', 'Random Forest'),
        ('logistic_regression', 'Logistic Regression'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    dataset = models.ForeignKey(Dataset, related_name='runs', on_delete=models.CASCADE)
    algorithm = models.CharField(
        max_length=40, choices=ALGORITHM_CHOICES, default='gradient_boosting'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)

    accuracy = models.FloatField(null=True, blank=True)
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    f1_score = models.FloatField(null=True, blank=True)
    roc_auc = models.FloatField(null=True, blank=True)

    confusion_matrix = models.JSONField(default=list, blank=True)
    feature_importances = models.JSONField(default=list, blank=True)
    roc_curve = models.JSONField(default=dict, blank=True)

    artifact_path = models.CharField(max_length=500, blank=True)
    training_seconds = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_algorithm_display()} on {self.dataset.name}'

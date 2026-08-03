import io
import shutil
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import ml
from .models import Dataset, TrainingRun


def make_frame(rows: int = 400) -> pd.DataFrame:
    """A small dataset with genuine signal, so trained metrics are meaningful."""
    rng = np.random.default_rng(0)
    tenure = rng.integers(1, 72, rows)
    contract = rng.choice(['Month-to-month', 'Two year'], rows)
    charges = rng.normal(70, 20, rows).round(2)
    score = (
        1.2 * (contract == 'Month-to-month')
        - 0.05 * tenure
        + 0.01 * charges
        + rng.normal(0, 0.3, rows)
    )
    churn = np.where(score > 0.2, 'Yes', 'No')
    return pd.DataFrame(
        {
            'customerID': [f'C{i}' for i in range(rows)],
            'Tenure': tenure,
            'Contract': contract,
            'MonthlyCharges': charges,
            'Churn': churn,
        }
    )


def as_upload(frame: pd.DataFrame, name: str = 'customers.csv') -> SimpleUploadedFile:
    buffer = io.StringIO()
    frame.to_csv(buffer, index=False)
    return SimpleUploadedFile(name, buffer.getvalue().encode(), content_type='text/csv')


class TempStorageMixin:
    """Keep uploaded CSVs and model artifacts out of the working tree."""

    @classmethod
    def setUpClass(cls):
        cls._temp_dir = Path(tempfile.mkdtemp())
        artifacts = cls._temp_dir / 'artifacts'
        artifacts.mkdir()
        cls._settings = override_settings(
            MEDIA_ROOT=cls._temp_dir / 'media', MODEL_ARTIFACT_DIR=artifacts
        )
        cls._settings.enable()
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls._settings.disable()
        shutil.rmtree(cls._temp_dir, ignore_errors=True)


class TargetCoercionTests(TestCase):
    def test_maps_yes_no_to_binary(self):
        result = ml.coerce_target(pd.Series(['Yes', 'no', 'YES', 'No']))
        self.assertEqual(list(result), [1, 0, 1, 0])

    def test_accepts_existing_binary_column(self):
        result = ml.coerce_target(pd.Series([1, 0, 1]))
        self.assertEqual(list(result), [1, 0, 1])

    def test_rejects_unrecognised_labels(self):
        with self.assertRaises(ml.DataError):
            ml.coerce_target(pd.Series(['maybe', 'yes']))

    def test_rejects_multiclass_numeric_column(self):
        with self.assertRaises(ml.DataError):
            ml.coerce_target(pd.Series([0, 1, 2]))


class ColumnSelectionTests(TestCase):
    def test_drops_identifier_columns(self):
        numeric, categorical = ml.split_columns(make_frame(), 'Churn')

        self.assertNotIn('customerID', numeric + categorical)
        self.assertIn('Tenure', numeric)
        self.assertIn('Contract', categorical)

    def test_profile_reports_churn_rate_and_columns(self):
        profile = ml.profile_dataframe(make_frame(), 'Churn')

        self.assertEqual(profile['row_count'], 400)
        self.assertTrue(0 < profile['churn_rate'] < 1)
        self.assertTrue(any(c['type'] == 'categorical' for c in profile['columns']))

    def test_profile_rejects_unknown_target(self):
        with self.assertRaises(ml.DataError):
            ml.profile_dataframe(make_frame(), 'Missing')


class TrainingTests(TempStorageMixin, TestCase):
    def test_train_produces_usable_metrics(self):
        result = ml.train(make_frame(), 'Churn', 'gradient_boosting')

        self.assertGreater(result.roc_auc, 0.7)
        self.assertTrue(0 <= result.accuracy <= 1)
        self.assertEqual(len(result.confusion), 2)
        self.assertTrue(result.importances)
        self.assertEqual(
            result.importances,
            sorted(result.importances, key=lambda i: i['importance'], reverse=True),
        )

    def test_refuses_single_class_target(self):
        frame = make_frame()
        frame['Churn'] = 'No'
        with self.assertRaises(ml.DataError):
            ml.train(frame, 'Churn', 'gradient_boosting')

    def test_refuses_tiny_dataset(self):
        with self.assertRaises(ml.DataError):
            ml.train(make_frame(20), 'Churn', 'gradient_boosting')

    def test_scoring_rejects_missing_columns(self):
        result = ml.train(make_frame(), 'Churn', 'logistic_regression')
        artifact = ml.load(result.artifact_path)

        with self.assertRaises(ml.DataError):
            ml.score(artifact, pd.DataFrame({'Tenure': [4]}))


class ApiTests(TempStorageMixin, TestCase):
    def setUp(self):
        self.client = APIClient()

    def upload(self, frame=None, target='Churn'):
        return self.client.post(
            '/api/datasets/upload/',
            {
                'file': as_upload(frame if frame is not None else make_frame()),
                'target_column': target,
            },
            format='multipart',
        )

    def train(self, dataset_id):
        return self.client.post(f'/api/datasets/{dataset_id}/train/', {}, format='json')

    def test_upload_profiles_the_file(self):
        response = self.upload()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['row_count'], 400)
        self.assertGreater(response.data['churn_rate'], 0)
        self.assertEqual(Dataset.objects.count(), 1)

    def test_upload_rejects_unknown_target_column(self):
        response = self.upload(target='NotAColumn')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Dataset.objects.count(), 0)

    def test_upload_rejects_non_csv(self):
        response = self.client.post(
            '/api/datasets/upload/',
            {'file': SimpleUploadedFile('notes.txt', b'hello')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 400)

    def test_train_then_read_segments_and_predictions(self):
        dataset_id = self.upload().data['id']

        train = self.train(dataset_id)
        self.assertEqual(train.status_code, 201)
        self.assertEqual(train.data['status'], 'completed')
        self.assertGreater(train.data['roc_auc'], 0.7)

        run_id = train.data['id']

        segments = self.client.get(f'/api/runs/{run_id}/segments/')
        self.assertEqual(segments.status_code, 200)
        self.assertEqual(
            sum(s['customers'] for s in segments.data['segments']),
            segments.data['total_customers'],
        )

        predictions = self.client.get(f'/api/runs/{run_id}/predictions/?limit=10')
        self.assertEqual(predictions.status_code, 200)
        self.assertEqual(predictions.data['count'], 10)
        probabilities = [r['churn_probability'] for r in predictions.data['results']]
        self.assertEqual(probabilities, sorted(probabilities, reverse=True))

    def test_predict_endpoint_scores_a_record(self):
        dataset_id = self.upload().data['id']
        run_id = self.train(dataset_id).data['id']

        response = self.client.post(
            f'/api/runs/{run_id}/predict/',
            {
                'records': [
                    {'Tenure': 2, 'Contract': 'Month-to-month', 'MonthlyCharges': 95.0}
                ]
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        result = response.data['results'][0]
        self.assertTrue(0 <= result['churn_probability'] <= 1)
        self.assertIn(result['risk_band'], {'low', 'medium', 'high'})

    def test_segments_rejects_a_failed_run(self):
        dataset_id = self.upload().data['id']
        run = TrainingRun.objects.create(
            dataset_id=dataset_id, algorithm='random_forest', status='failed'
        )

        response = self.client.get(f'/api/runs/{run.id}/segments/')

        self.assertEqual(response.status_code, 400)

    def test_runs_can_be_filtered_by_dataset(self):
        first = self.upload().data['id']
        second = self.upload().data['id']
        self.train(first)

        response = self.client.get(f'/api/runs/?dataset={second}')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)

    def test_overview_reports_latest_run(self):
        dataset_id = self.upload().data['id']
        self.train(dataset_id)

        response = self.client.get('/api/overview/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['datasets'], 1)
        self.assertIsNotNone(response.data['latest_run'])

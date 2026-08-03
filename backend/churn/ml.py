"""Training and scoring logic for the churn model.

Everything the API needs sits behind three functions: `profile_dataframe` for the
upload step, `train` for fitting, and `score` for applying a saved pipeline.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from django.conf import settings
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Values we accept as "this customer churned".
TRUTHY = {'1', 'yes', 'true', 'y', 'churn', 'churned', 'left'}
FALSY = {'0', 'no', 'false', 'n', 'stay', 'stayed', 'active', 'retained'}

# Columns that identify a customer rather than describe them - never features.
ID_LIKE = {'id', 'customerid', 'customer_id', 'userid', 'user_id', 'uuid', 'email'}

RANDOM_STATE = 42


class DataError(ValueError):
    """Raised when the uploaded CSV cannot be used for training."""


@dataclass
class TrainingResult:
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float
    confusion: list
    importances: list
    roc: dict
    artifact_path: str
    seconds: float
    feature_columns: list = field(default_factory=list)


def read_csv(path: str | Path) -> pd.DataFrame:
    """Read a CSV, tolerating the encodings exported CRM files usually carry."""
    for encoding in ('utf-8-sig', 'latin-1'):
        try:
            return pd.read_csv(path, encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise DataError('Could not decode the file as UTF-8 or Latin-1.')


def coerce_target(series: pd.Series) -> pd.Series:
    """Map a churn column of any common flavour onto 0/1."""
    if pd.api.types.is_numeric_dtype(series):
        values = series.fillna(0).astype(float)
        unique = set(values.dropna().unique())
        if not unique <= {0.0, 1.0}:
            raise DataError(
                'Numeric target column must contain only 0 and 1, '
                f'found {sorted(unique)[:5]}.'
            )
        return values.astype(int)

    normalised = series.astype(str).str.strip().str.lower()
    mapped = normalised.map(
        lambda v: 1 if v in TRUTHY else (0 if v in FALSY else np.nan)
    )
    if mapped.isna().any():
        unknown = sorted(set(normalised[mapped.isna()]))[:5]
        raise DataError(
            f'Target column has values that are not yes/no-like: {unknown}.'
        )
    return mapped.astype(int)


def split_columns(frame: pd.DataFrame, target: str) -> tuple[list[str], list[str]]:
    """Return (numeric, categorical) feature columns, dropping ID-like ones."""
    features = [
        column
        for column in frame.columns
        if column != target and column.strip().lower() not in ID_LIKE
    ]
    numeric, categorical = [], []
    for column in features:
        series = frame[column]
        if pd.api.types.is_numeric_dtype(series):
            numeric.append(column)
        elif series.nunique(dropna=True) <= 50:
            # High-cardinality strings are free text, not a category worth encoding.
            categorical.append(column)
    if not numeric and not categorical:
        raise DataError('No usable feature columns were found in this file.')
    return numeric, categorical


def profile_dataframe(frame: pd.DataFrame, target: str) -> dict:
    """Summarise a dataset for the upload response and the dashboard header."""
    if target not in frame.columns:
        raise DataError(f'Target column "{target}" is not present in the file.')

    labels = coerce_target(frame[target])
    numeric, categorical = split_columns(frame, target)

    columns = []
    for column in numeric:
        series = pd.to_numeric(frame[column], errors='coerce')
        columns.append(
            {
                'name': column,
                'type': 'numeric',
                'missing': int(frame[column].isna().sum()),
                'min': _clean(series.min()),
                'max': _clean(series.max()),
                'mean': _clean(series.mean()),
            }
        )
    for column in categorical:
        counts = frame[column].astype(str).value_counts().head(6)
        columns.append(
            {
                'name': column,
                'type': 'categorical',
                'missing': int(frame[column].isna().sum()),
                'unique': int(frame[column].nunique(dropna=True)),
                'top_values': [
                    {'value': str(value), 'count': int(count)}
                    for value, count in counts.items()
                ],
            }
        )

    return {
        'row_count': int(len(frame)),
        'column_count': int(frame.shape[1]),
        'churn_rate': float(labels.mean()),
        'numeric_features': numeric,
        'categorical_features': categorical,
        'columns': columns,
    }


def _clean(value) -> float | None:
    """NumPy scalars and NaN are not JSON-serialisable; normalise them."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(result) else round(result, 4)


def build_pipeline(numeric: list[str], categorical: list[str], algorithm: str) -> Pipeline:
    """Impute, encode and scale, then hand off to the chosen classifier."""
    numeric_steps = Pipeline(
        [
            ('impute', SimpleImputer(strategy='median')),
            ('scale', StandardScaler()),
        ]
    )
    categorical_steps = Pipeline(
        [
            ('impute', SimpleImputer(strategy='most_frequent')),
            ('encode', OneHotEncoder(handle_unknown='ignore', min_frequency=5)),
        ]
    )

    preprocessor = ColumnTransformer(
        [
            ('numeric', numeric_steps, numeric),
            ('categorical', categorical_steps, categorical),
        ],
        remainder='drop',
    )

    classifiers = {
        'gradient_boosting': GradientBoostingClassifier(random_state=RANDOM_STATE),
        'random_forest': RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            class_weight='balanced',
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        'logistic_regression': LogisticRegression(
            max_iter=2000, class_weight='balanced'
        ),
    }
    if algorithm not in classifiers:
        raise DataError(f'Unknown algorithm "{algorithm}".')

    return Pipeline(
        [('preprocess', preprocessor), ('classifier', classifiers[algorithm])]
    )


def train(frame: pd.DataFrame, target: str, algorithm: str) -> TrainingResult:
    """Fit `algorithm` on `frame` and report holdout metrics."""
    started = time.perf_counter()

    labels = coerce_target(frame[target])
    if labels.nunique() < 2:
        raise DataError('The target column contains only one class - nothing to learn.')
    if len(frame) < 50:
        raise DataError('At least 50 rows are needed to train a meaningful model.')

    numeric, categorical = split_columns(frame, target)
    features = frame[numeric + categorical]

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=labels,
    )

    pipeline = build_pipeline(numeric, categorical, algorithm)
    pipeline.fit(x_train, y_train)

    predicted = pipeline.predict(x_test)
    probabilities = pipeline.predict_proba(x_test)[:, 1]

    false_positive, true_positive, _ = roc_curve(y_test, probabilities)
    # The full curve is one point per threshold; the chart only needs a sketch.
    step = max(1, len(false_positive) // 100)

    artifact_path = settings.MODEL_ARTIFACT_DIR / f'model-{uuid.uuid4().hex}.joblib'
    joblib.dump(
        {
            'pipeline': pipeline,
            'numeric': numeric,
            'categorical': categorical,
            'target': target,
        },
        artifact_path,
    )

    return TrainingResult(
        accuracy=round(float(accuracy_score(y_test, predicted)), 4),
        precision=round(float(precision_score(y_test, predicted, zero_division=0)), 4),
        recall=round(float(recall_score(y_test, predicted, zero_division=0)), 4),
        f1=round(float(f1_score(y_test, predicted, zero_division=0)), 4),
        roc_auc=round(float(roc_auc_score(y_test, probabilities)), 4),
        confusion=confusion_matrix(y_test, predicted).tolist(),
        importances=_importances(pipeline, x_test, y_test),
        roc={
            'fpr': [round(float(v), 4) for v in false_positive[::step]],
            'tpr': [round(float(v), 4) for v in true_positive[::step]],
        },
        artifact_path=str(artifact_path),
        seconds=round(time.perf_counter() - started, 3),
        feature_columns=numeric + categorical,
    )


def _importances(pipeline: Pipeline, x_test: pd.DataFrame, y_test: pd.Series) -> list:
    """Rank the original columns by permutation importance.

    Permutation importance is measured on the raw columns rather than the
    one-hot expanded matrix, so "Contract" stays one bar instead of three.
    """
    result = permutation_importance(
        pipeline,
        x_test,
        y_test,
        n_repeats=8,
        random_state=RANDOM_STATE,
        scoring='roc_auc',
        n_jobs=-1,
    )
    ranked = sorted(
        (
            {
                'feature': column,
                'importance': round(float(mean), 5),
                'std': round(float(std), 5),
            }
            for column, mean, std in zip(
                x_test.columns, result.importances_mean, result.importances_std
            )
        ),
        key=lambda item: item['importance'],
        reverse=True,
    )
    return ranked[:15]


def load(artifact_path: str) -> dict:
    return joblib.load(artifact_path)


def score(artifact: dict, frame: pd.DataFrame) -> np.ndarray:
    """Return churn probabilities for every row of `frame`."""
    columns = artifact['numeric'] + artifact['categorical']
    missing = [column for column in columns if column not in frame.columns]
    if missing:
        raise DataError(f'Input is missing required columns: {missing}.')
    return artifact['pipeline'].predict_proba(frame[columns])[:, 1]


def risk_band(probability: float) -> str:
    if probability >= 0.7:
        return 'high'
    if probability >= 0.4:
        return 'medium'
    return 'low'

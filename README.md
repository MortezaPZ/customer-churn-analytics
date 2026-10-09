# Customer Churn Analytics

Upload a customer CSV, train a churn model, and see who is likely to leave and which fields drove that score.

## Overview

The backend profiles the file before training, fits one of three scikit-learn models, and returns risk segments plus permutation importance on the original columns. The Angular dashboard is for acting on that list, not for staring at a single accuracy number.

## Features

- CSV upload with a column profile: row count, types, missing values, and class balance
- Training with gradient boosting, random forest, or logistic regression
- The same sklearn `Pipeline` is used at score time, so encoding and scaling are not reimplemented in the view
- Permutation importance on the original fields, so `Contract` stays one factor instead of three one-hot pieces
- High, medium, and low risk segments, and an export of the highest-risk customers
- Files that cannot be trained are rejected with a reason: one class, fewer than 50 rows, or labels that cannot be parsed

## Technology Stack

- Python, Django REST Framework, scikit-learn
- Angular
- SQLite for the app database

## Architecture

`churn/ml.py` does not know about HTTP. `views.py` does not know sklearn internals. Swapping the model code does not require an API change.

Identifier-like columns such as `customerID` and `email` are dropped. Free-text columns with more than 50 distinct values are dropped. Rare categories are grouped with `min_frequency`. Missing numbers use the median. Missing categories use the most frequent value. Non-UTF-8 uploads fall back to Latin-1.

## Measured results

Holdout metrics on the bundled sample, 3000 rows, 24.4 percent churn, stratified 75/25 split:

| Model | ROC-AUC | Accuracy | Precision | Recall | F1 | Train time |
| --- | --- | --- | --- | --- | --- | --- |
| Logistic regression | 0.826 | 0.729 | 0.469 | 0.820 | 0.596 | 0.3 s |
| Gradient boosting | 0.816 | 0.792 | 0.648 | 0.322 | 0.431 | 4.6 s |
| Random forest | 0.811 | 0.771 | 0.524 | 0.667 | 0.587 | 4.3 s |

Gradient boosting is the most precise and finds about a third of the churners. Logistic regression finds 82 percent of them and raises more false alarms. For a retention campaign, recall is usually the more expensive one to miss. The dashboard shows all three models.

Top factors on this sample: `Contract`, `Tenure`, `MonthlyCharges`, `TechSupport`, `LatePayments`, `PaymentMethod`.

## Installation

Backend:

```bash
cd backend
python -m venv ../.venv
```

Windows: `../.venv/Scripts/activate`. Linux or macOS: `source ../.venv/bin/activate`.

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py generate_sample_data --rows 3000
python manage.py runserver
```

The API is at `http://localhost:8000/api/`.

Frontend:

```bash
cd frontend
npm install
npm start
```

The dashboard is at `http://localhost:4200`.

## Usage

The target column accepts `Yes`/`No`, `1`/`0`, `true`/`false`, and `churned`/`active`. Send its name as `target_column`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/datasets/upload/` | Upload a CSV (`file`, `target_column`) |
| `GET` | `/api/datasets/` | List datasets |
| `GET` | `/api/datasets/{id}/` | Dataset detail and column profile |
| `GET` | `/api/datasets/{id}/preview/` | First 20 raw rows |
| `POST` | `/api/datasets/{id}/train/` | Train (`{"algorithm": "random_forest"}`) |
| `GET` | `/api/runs/` | Training runs, optional `?dataset=1` |
| `GET` | `/api/runs/{id}/` | Metrics, confusion matrix, ROC, importances |
| `GET` | `/api/runs/{id}/segments/` | Risk bands |
| `GET` | `/api/runs/{id}/predictions/` | Highest-risk customers (`?limit=50`) |
| `POST` | `/api/runs/{id}/predict/` | Score records (`{"records": [{...}]}`) |
| `GET` | `/api/overview/` | Dashboard counters |

```bash
curl -F "file=@sample_data/customer_churn.csv" -F "target_column=Churn" \
     http://localhost:8000/api/datasets/upload/

curl -X POST -H "Content-Type: application/json" \
     -d '{"algorithm":"gradient_boosting"}' \
     http://localhost:8000/api/datasets/1/train/
```

## Testing

```bash
cd backend
python manage.py test churn
```

The suite covers target conversion, feature selection, training guarantees, and the API including error paths.

## Limitations

The sample generator is tuned to a hard problem in the published telecom-churn range (about 0.80 to 0.85 ROC-AUC). It is not a claim about a specific production dataset. The frontend has no unit specs.

## License

MIT

# Customer Churn Prediction & Analytics Dashboard

Upload a customer CSV, train a churn model on it, and get back a dashboard that
tells you **who is about to leave and why** — not just an accuracy number.

Built with **Django REST Framework + scikit-learn** on the backend and
**Angular** on the frontend.

---

## What it does

1. **Upload** a customer CSV. The API profiles it — row counts, column types,
   missing values, class balance — and tells you if the file cannot be trained on
   before you waste time on it.
2. **Train** a model (Gradient Boosting, Random Forest, or Logistic Regression).
   Categorical encoding, imputation and scaling are handled by an sklearn
   `Pipeline`, so the same transformations apply at scoring time.
3. **Explain** the result. Permutation importance is computed on the original
   columns, so `Contract` shows up as one ranked driver rather than three
   one-hot fragments.
4. **Act** on it. Customers are bucketed into high / medium / low risk bands, and
   the highest-risk list is exportable for a retention campaign.

---

## Measured results

On the bundled 3,000-row sample dataset (24.4% churn rate), holdout metrics from
a 75/25 stratified split:

| Model | ROC-AUC | Accuracy | Precision | Recall | F1 | Train time |
|---|---|---|---|---|---|---|
| Logistic Regression | **0.826** | 0.729 | 0.469 | 0.820 | 0.596 | 0.3s |
| Gradient Boosting | 0.816 | 0.792 | 0.648 | 0.322 | 0.431 | 4.6s |
| Random Forest | 0.811 | 0.771 | 0.524 | 0.667 | 0.587 | 4.3s |

These land in the same range as published benchmarks on real telco churn data
(typically 0.80–0.85 ROC-AUC), which is the point — the sample generator was
tuned to produce a realistically *hard* problem rather than a flattering one.

Note the trade-off the table makes visible: gradient boosting has the best
precision but finds only a third of the churners, while logistic regression
catches 82% of them at the cost of more false alarms. **For a retention
campaign, recall is usually worth more than precision** — missing a leaving
customer costs a whole subscription, while a wasted discount costs very little.
The dashboard shows all three so that call belongs to the business, not the
model.

Top churn drivers found by the model: `Contract`, `Tenure`, `MonthlyCharges`,
`TechSupport`, `LatePayments`, `PaymentMethod`.

---

## Quick start

### Backend

```bash
cd backend
python -m venv ../.venv
../.venv/Scripts/activate        # Windows;  source ../.venv/bin/activate on Linux/macOS
pip install -r requirements.txt

python manage.py migrate
python manage.py generate_sample_data --rows 3000    # writes sample_data/customer_churn.csv
python manage.py runserver
```

API is now on `http://localhost:8000/api/` — it ships with DRF's browsable
interface, so every endpoint below is clickable in a browser.

### Frontend

```bash
cd frontend
npm install
npm start
```

Dashboard is on `http://localhost:4200`.

### Tests

```bash
cd backend
python manage.py test churn
```

19 tests covering target coercion, feature selection, training guarantees, and
every API endpoint including the failure paths.

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/datasets/upload/` | Upload a CSV (multipart: `file`, `target_column`) |
| `GET` | `/api/datasets/` | List uploaded datasets |
| `GET` | `/api/datasets/{id}/` | Dataset detail with full column profile |
| `GET` | `/api/datasets/{id}/preview/` | First 20 rows of the raw file |
| `POST` | `/api/datasets/{id}/train/` | Train a model (`{"algorithm": "random_forest"}`) |
| `GET` | `/api/runs/` | List training runs (`?dataset=1` to filter) |
| `GET` | `/api/runs/{id}/` | Metrics, confusion matrix, ROC curve, importances |
| `GET` | `/api/runs/{id}/segments/` | Risk-band breakdown across all customers |
| `GET` | `/api/runs/{id}/predictions/` | Highest-risk customers (`?limit=50`) |
| `POST` | `/api/runs/{id}/predict/` | Score ad-hoc records (`{"records": [{...}]}`) |
| `GET` | `/api/overview/` | Dashboard headline counters |

### Example

```bash
curl -F "file=@sample_data/customer_churn.csv" -F "target_column=Churn" \
     http://localhost:8000/api/datasets/upload/

curl -X POST -H "Content-Type: application/json" \
     -d '{"algorithm":"gradient_boosting"}' \
     http://localhost:8000/api/datasets/1/train/

curl http://localhost:8000/api/runs/1/segments/
```

---

## Bring your own data

Any CSV works as long as it has one column indicating churn. The target column
is flexible — `Yes`/`No`, `1`/`0`, `true`/`false`, `churned`/`active` are all
recognised. Pass its name as `target_column` on upload.

The API handles the messy parts of real exports on its own:

- **Encoding** — falls back from UTF-8 to Latin-1 rather than failing on files
  exported from Excel.
- **Missing values** — median imputation for numeric columns, most-frequent for
  categorical.
- **ID columns** — `customerID`, `email` and friends are detected and dropped, so
  the model cannot cheat by memorising row identifiers.
- **Free-text columns** — string columns with more than 50 distinct values are
  excluded rather than one-hot exploded into thousands of features.
- **Rare categories** — grouped by `min_frequency` so a category seen twice does
  not become its own feature.

Files that genuinely cannot be trained on are rejected with a specific reason
(single-class target, fewer than 50 rows, unparseable labels) rather than a
stack trace.

---

## Project layout

```
churn-analytics/
├── backend/
│   ├── config/              # Django settings, URLs
│   ├── churn/
│   │   ├── ml.py            # Training, scoring, profiling — all sklearn logic
│   │   ├── models.py        # Dataset, TrainingRun
│   │   ├── serializers.py   # Request validation, response shaping
│   │   ├── views.py         # DRF viewsets
│   │   ├── tests.py         # 19 tests
│   │   └── management/commands/generate_sample_data.py
│   └── requirements.txt
└── frontend/                # Angular dashboard
```

The design rule is that `ml.py` knows nothing about Django requests and `views.py`
knows nothing about scikit-learn internals. That keeps the model logic testable
on its own and swappable without touching the API surface.

---

## License

MIT

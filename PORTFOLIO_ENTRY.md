# Portfolio entry — copy/paste for Kaya, Upwork or Freelancer

---

## Short version (portfolio card, ~50 words)

**Customer Churn Prediction & Analytics Dashboard**

A full-stack ML application that turns a raw customer CSV into a retention
action plan. Django REST + scikit-learn backend, Angular dashboard. Achieves
0.83 ROC-AUC, explains which factors drive churn, and exports a ranked
at-risk call list. Handles messy real-world exports: mixed encodings, missing
values, and free-text columns.

**Stack:** Python · Django REST Framework · scikit-learn · pandas · Angular ·
TypeScript · SCSS

---

## Long version (project description)

### The problem

Most churn projects stop at a model file and an accuracy score. A business
cannot act on that. This application closes the gap between "the model works"
and "here is who to call on Monday."

### What it does

Upload a customer CSV and the API profiles it immediately — row counts, column
types, missing values, class balance — and rejects files that cannot be trained
on with a specific reason rather than a stack trace. Train a model in one click
(Gradient Boosting, Random Forest, or Logistic Regression) and the dashboard
returns four things:

1. **Ranked churn drivers.** Permutation importance computed on the original
   columns, so a categorical feature like Contract stays a single ranked driver
   rather than fragmenting into three one-hot bars.
2. **Risk segmentation.** Every customer bucketed into high / medium / low risk
   with average probability per band.
3. **Model diagnostics.** ROC curve, confusion matrix, and the full metric set
   on a held-out 25% split.
4. **An action list.** The highest-risk customers ranked by probability,
   exportable as CSV for a retention campaign.

### Measured results

On a 3,000-row dataset with a 24.4% churn rate:

| Model | ROC-AUC | Accuracy | Precision | Recall |
|---|---|---|---|---|
| Logistic Regression | 0.826 | 72.9% | 46.9% | 82.0% |
| Gradient Boosting | 0.829 | 81.2% | 71.4% | 38.3% |
| Random Forest | 0.821 | 77.1% | 52.4% | 66.7% |

In line with published benchmarks on real telco churn data (0.80–0.85 ROC-AUC).

### Engineering decisions worth mentioning

- **A single sklearn `Pipeline`** carries imputation, encoding and scaling, so
  the exact transformations applied at training are applied at scoring. No
  train/serve skew.
- **ID-like columns are detected and dropped** (`customerID`, `email`), so the
  model cannot inflate its score by memorising row identifiers.
- **High-cardinality string columns are excluded** rather than one-hot exploded
  into thousands of sparse features.
- **The ML layer knows nothing about Django, and the API layer knows nothing
  about scikit-learn internals** — model logic stays independently testable and
  swappable.
- **19 tests** cover target coercion, feature selection, training guarantees,
  and every API endpoint including its failure paths.
- **Charts are hand-built SVG** with no charting dependency, on a palette
  validated for colour-vision deficiency, with a selected dark mode.

### The trade-off the dashboard makes visible

Gradient Boosting has the best precision but catches only 38% of churners.
Logistic Regression catches 82% at the cost of more false alarms. For a
retention campaign recall is usually worth more — a missed churner costs a
whole subscription, a wasted discount costs very little. The dashboard shows
all three models so that call stays with the business rather than being buried
in the model.

---

## Talking points if a client asks

**"Why permutation importance and not feature_importances_?"**
Tree-based `feature_importances_` is biased toward high-cardinality features and
is computed on the encoded matrix. Permutation importance measures the actual
drop in ROC-AUC on held-out data, on the original columns — it answers the
question the business is asking.

**"How would this scale to a million rows?"**
Training moves to a task queue (Celery + Redis) instead of the request cycle,
the dataset moves to Postgres or object storage instead of a local file, and
scoring is batched. The `ml.py` boundary means none of that touches the API
contract.

**"Can it work with my data?"**
Yes — any CSV with a churn column. The target accepts Yes/No, 1/0, true/false,
or churned/active. Encoding fallbacks, imputation and column filtering are
handled automatically.

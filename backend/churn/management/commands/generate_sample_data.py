"""Create a realistic telco-style churn CSV so the demo runs without a client file."""

from pathlib import Path

import numpy as np
import pandas as pd
from django.core.management.base import BaseCommand

RANDOM_STATE = 7

CONTRACTS = ['Month-to-month', 'One year', 'Two year']
# "None" would round-trip through the CSV as NaN, so the no-internet category
# is spelled out instead.
INTERNET = ['DSL', 'Fiber optic', 'No internet']
PAYMENT = ['Electronic check', 'Mailed check', 'Bank transfer', 'Credit card']
SUPPORT = ['Yes', 'No']


class Command(BaseCommand):
    help = 'Generate a synthetic customer churn dataset as CSV.'

    def add_arguments(self, parser):
        parser.add_argument('--rows', type=int, default=3000)
        parser.add_argument(
            '--output', type=str, default='sample_data/customer_churn.csv'
        )

    def handle(self, *args, **options):
        rows = options['rows']
        rng = np.random.default_rng(RANDOM_STATE)

        contract = rng.choice(CONTRACTS, rows, p=[0.55, 0.25, 0.20])
        internet = rng.choice(INTERNET, rows, p=[0.35, 0.45, 0.20])
        payment = rng.choice(PAYMENT, rows, p=[0.35, 0.20, 0.22, 0.23])
        tech_support = rng.choice(SUPPORT, rows, p=[0.4, 0.6])
        paperless = rng.choice(SUPPORT, rows, p=[0.6, 0.4])
        senior = rng.choice([0, 1], rows, p=[0.84, 0.16])

        tenure = np.clip(rng.gamma(2.0, 12.0, rows), 1, 72).round().astype(int)
        monthly = np.clip(rng.normal(66, 25, rows), 18, 130).round(2)
        # Longer-tenured customers have paid more in total, with some noise.
        total = (monthly * tenure * rng.normal(1.0, 0.06, rows)).round(2)
        support_tickets = rng.poisson(1.2, rows)
        late_payments = rng.poisson(0.8, rows)

        # Churn is driven by a latent score, so the model has real signal to find.
        score = (
            # Intercept tuned so the overall rate lands near the ~26% seen in
            # public telco churn datasets.
            -3.1
            + 1.5 * (contract == 'Month-to-month')
            - 0.9 * (contract == 'Two year')
            + 0.8 * (internet == 'Fiber optic')
            + 0.7 * (payment == 'Electronic check')
            - 0.6 * (tech_support == 'Yes')
            + 0.35 * senior
            - 0.045 * tenure
            + 0.016 * monthly
            + 0.22 * support_tickets
            + 0.30 * late_payments
            + rng.normal(0, 0.5, rows)
        )
        probability = 1 / (1 + np.exp(-score))
        churn = np.where(rng.random(rows) < probability, 'Yes', 'No')

        frame = pd.DataFrame(
            {
                'customerID': [f'C{i:06d}' for i in range(1, rows + 1)],
                'SeniorCitizen': senior,
                'Tenure': tenure,
                'Contract': contract,
                'InternetService': internet,
                'TechSupport': tech_support,
                'PaperlessBilling': paperless,
                'PaymentMethod': payment,
                'MonthlyCharges': monthly,
                'TotalCharges': total,
                'SupportTickets': support_tickets,
                'LatePayments': late_payments,
                'Churn': churn,
            }
        )

        # Real exports are never complete; leave a few gaps for the imputer.
        missing = rng.choice(rows, size=max(1, rows // 60), replace=False)
        frame.loc[missing, 'TotalCharges'] = np.nan

        output = Path(options['output'])
        output.parent.mkdir(parents=True, exist_ok=True)
        frame.to_csv(output, index=False)

        rate = (frame['Churn'] == 'Yes').mean()
        self.stdout.write(
            self.style.SUCCESS(
                f'Wrote {rows} rows to {output} (churn rate {rate:.1%}).'
            )
        )

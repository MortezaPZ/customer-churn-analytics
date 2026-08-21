# داشبورد پیش‌بینی و تحلیل ریزش مشتری (Customer Churn Analytics)

*Upload a customer CSV, train a churn model, and get an explainable dashboard — who is about to leave and why, not just an accuracy number. Django REST + scikit-learn backend, Angular frontend. See below for the Persian write-up.*

یک فایل CSV از مشتری‌ها آپلود کن، روی آن یک مدل ریزش (churn) آموزش بده، و یک
داشبورد بگیر که می‌گوید **چه کسی در حال رفتن است و چرا** — نه فقط یک عدد
accuracy.

ساخته‌شده با **Django REST Framework + scikit-learn** در بک‌اند و **Angular**
در فرانت‌اند.

---

## چه کاری انجام می‌دهد

۱. **آپلود** یک CSV مشتری. API آن را پروفایل می‌کند — تعداد سطرها، نوع
   ستون‌ها، مقادیر گم‌شده، توازن کلاس — و قبل از این‌که وقت تلف کنی می‌گوید
   فایل قابل آموزش هست یا نه.
۲. **آموزش** یک مدل (Gradient Boosting، Random Forest یا Logistic Regression).
   کدگذاری دسته‌ای، پرکردن مقادیر گم‌شده و مقیاس‌دهی توسط یک `Pipeline` از
   sklearn انجام می‌شود، پس همان تبدیل‌ها هنگام نمره‌دهی هم اعمال می‌شوند.
۳. **توضیح** نتیجه. اهمیت جایگشتی (permutation importance) روی ستون‌های
   اصلی محاسبه می‌شود، پس `Contract` به‌عنوان یک عامل رتبه‌بندی‌شده دیده
   می‌شود، نه سه تکه‌ی one-hot جدا.
۴. **اقدام** روی نتیجه. مشتری‌ها در سطح ریسک بالا/متوسط/پایین دسته‌بندی
   می‌شوند و فهرست پرریسک‌ترین‌ها برای یک کمپین حفظ مشتری قابل خروجی‌گرفتن است.

---

## نتایج اندازه‌گیری‌شده

روی مجموعه‌داده‌ی نمونه‌ی همراه پروژه (۳۰۰۰ سطر، نرخ ریزش ۲۴٫۴٪)، معیارهای
هولدآوت از یک تقسیم لایه‌ای ۷۵/۲۵:

| مدل | ROC-AUC | صحت | دقت | فراخوانی | F1 | زمان آموزش |
|---|---|---|---|---|---|---|
| Logistic Regression | **۰٫۸۲۶** | ۰٫۷۲۹ | ۰٫۴۶۹ | ۰٫۸۲۰ | ۰٫۵۹۶ | ۰٫۳ ثانیه |
| Gradient Boosting | ۰٫۸۱۶ | ۰٫۷۹۲ | ۰٫۶۴۸ | ۰٫۳۲۲ | ۰٫۴۳۱ | ۴٫۶ ثانیه |
| Random Forest | ۰٫۸۱۱ | ۰٫۷۷۱ | ۰٫۵۲۴ | ۰٫۶۶۷ | ۰٫۵۸۷ | ۴٫۳ ثانیه |

این اعداد در همان بازه‌ی benchmark‌های منتشرشده روی داده‌ی واقعی ریزش
مخابراتی هستند (معمولاً ۰٫۸۰ تا ۰٫۸۵ ROC-AUC) — و همین هدف است: تولیدکننده‌ی
داده‌ی نمونه طوری تنظیم شده که یک مسئله‌ی واقع‌بینانه‌ی *سخت* بسازد، نه یک
مسئله‌ی ساده و چشم‌نواز.

جدول یک trade-off را نشان می‌دهد: gradient boosting بهترین دقت را دارد ولی
فقط یک‌سوم ریزش‌کننده‌ها را پیدا می‌کند، درحالی‌که logistic regression ۸۲٪
آن‌ها را می‌گیرد به قیمت هشدارهای اشتباه بیشتر. **برای یک کمپین حفظ مشتری،
فراخوانی معمولاً از دقت باارزش‌تر است** — از‌دست‌دادن یک مشتری در حال رفتن
هزینه‌ی یک اشتراک کامل دارد، درحالی‌که یک تخفیف هدررفته هزینه‌ی ناچیزی دارد.
داشبورد هر سه مدل را نشان می‌دهد تا این تصمیم دست کسب‌وکار باشد، نه مدل.

مهم‌ترین عوامل ریزش که مدل پیدا کرده: `Contract`، `Tenure`،
`MonthlyCharges`، `TechSupport`، `LatePayments`، `PaymentMethod`.

---

## شروع سریع

### بک‌اند

```bash
cd backend
python -m venv ../.venv
../.venv/Scripts/activate        # Windows؛  source ../.venv/bin/activate در Linux/macOS
pip install -r requirements.txt

python manage.py migrate
python manage.py generate_sample_data --rows 3000    # می‌نویسد در sample_data/customer_churn.csv
python manage.py runserver
```

API روی `http://localhost:8000/api/` بالا می‌آید — با رابط قابل‌مرور DRF
همراه است، پس هر endpoint زیر مستقیم در مرورگر قابل‌کلیک‌کردن است.

### فرانت‌اند

```bash
cd frontend
npm install
npm start
```

داشبورد روی `http://localhost:4200` است.

### آزمون‌ها

```bash
cd backend
python manage.py test churn
```

۱۹ آزمون که تبدیل ستون هدف، انتخاب ویژگی، تضمین‌های آموزش، و همه‌ی
endpointها شامل مسیرهای خطا را پوشش می‌دهند.

---

## API

| متد | مسیر | هدف |
|---|---|---|
| `POST` | `/api/datasets/upload/` | آپلود CSV (multipart: `file`, `target_column`) |
| `GET` | `/api/datasets/` | فهرست مجموعه‌داده‌های آپلودشده |
| `GET` | `/api/datasets/{id}/` | جزئیات مجموعه‌داده با پروفایل کامل ستون‌ها |
| `GET` | `/api/datasets/{id}/preview/` | ۲۰ سطر اول فایل خام |
| `POST` | `/api/datasets/{id}/train/` | آموزش مدل (`{"algorithm": "random_forest"}`) |
| `GET` | `/api/runs/` | فهرست اجراهای آموزش (فیلتر با `?dataset=1`) |
| `GET` | `/api/runs/{id}/` | معیارها، ماتریس درهم‌ریختگی، منحنی ROC، اهمیت‌ها |
| `GET` | `/api/runs/{id}/segments/` | تفکیک سطح ریسک روی همه‌ی مشتری‌ها |
| `GET` | `/api/runs/{id}/predictions/` | پرریسک‌ترین مشتری‌ها (`?limit=50`) |
| `POST` | `/api/runs/{id}/predict/` | نمره‌دهی رکوردهای دلخواه (`{"records": [{...}]}`) |
| `GET` | `/api/overview/` | شمارنده‌های اصلی داشبورد |

### نمونه

```bash
curl -F "file=@sample_data/customer_churn.csv" -F "target_column=Churn" \
     http://localhost:8000/api/datasets/upload/

curl -X POST -H "Content-Type: application/json" \
     -d '{"algorithm":"gradient_boosting"}' \
     http://localhost:8000/api/datasets/1/train/

curl http://localhost:8000/api/runs/1/segments/
```

---

## استفاده با داده‌ی خودت

هر CSV کار می‌کند به شرطی که یک ستون نشان‌دهنده‌ی ریزش داشته باشد. نام ستون
هدف انعطاف‌پذیر است — `Yes`/`No`، `1`/`0`، `true`/`false`،
`churned`/`active` همه شناخته می‌شوند. نامش را هنگام آپلود به‌عنوان
`target_column` بفرست.

API خودش بخش‌های شلوغ خروجی‌های واقعی را مدیریت می‌کند:

- **کدگذاری** — اگر UTF-8 نبود به Latin-1 برمی‌گردد، به‌جای خطادادن روی
  فایل‌های خروجی‌گرفته‌شده از Excel.
- **مقادیر گم‌شده** — پرکردن با میانه برای ستون‌های عددی، پرتکرارترین مقدار
  برای دسته‌ای.
- **ستون‌های شناسه** — `customerID`، `email` و مشابه‌ها تشخیص داده و حذف
  می‌شوند، پس مدل نمی‌تواند با به‌خاطرسپردن شناسه‌ی سطرها تقلب کند.
- **ستون‌های متن آزاد** — ستون‌های رشته‌ای با بیش از ۵۰ مقدار متمایز حذف
  می‌شوند به‌جای این‌که به هزاران ویژگی one-hot منفجر شوند.
- **دسته‌های کمیاب** — با `min_frequency` گروه‌بندی می‌شوند تا یک دسته که
  فقط دوبار دیده شده، ویژگی جدا نشود.

فایل‌هایی که واقعاً قابل آموزش نیستند با یک دلیل مشخص (هدف تک‌کلاسه، کمتر از
۵۰ سطر، برچسب‌های غیرقابل‌پارس) رد می‌شوند، نه با یک stack trace.

---

## ساختار پروژه

```
churn-analytics/
├── backend/
│   ├── config/              # تنظیمات Django, URLها
│   ├── churn/
│   │   ├── ml.py            # آموزش، نمره‌دهی، پروفایل‌سازی — همه‌ی منطق sklearn
│   │   ├── models.py        # Dataset, TrainingRun
│   │   ├── serializers.py   # اعتبارسنجی درخواست، شکل‌دهی پاسخ
│   │   ├── views.py         # ویوست‌های DRF
│   │   ├── tests.py         # ۱۹ آزمون
│   │   └── management/commands/generate_sample_data.py
│   └── requirements.txt
└── frontend/                # داشبورد Angular
```

قاعده‌ی طراحی این است که `ml.py` چیزی از درخواست‌های Django نمی‌داند و
`views.py` چیزی از جزئیات داخلی scikit-learn نمی‌داند. این باعث می‌شود منطق
مدل به‌تنهایی قابل‌تست بماند و بدون دست‌زدن به سطح API قابل تعویض باشد.

---

## مجوز

MIT

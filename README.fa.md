# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

این پروژهٔ مستقل TypeScript در مرحلهٔ **پشتیبانی کلاینت و سند** است. مقدار `applicationReady:false` باقی می‌ماند. مجموعهٔ منتشرشده ۳۷ ماژول اجرایی و ۱۵ فایل تست سورس دارد: قراردادهای HTTP و فرم، خواندن زبان با مرجعیت API، ده کاتالوگ تخت ۱۰۷کلیدی، ابزار ارسال درخواست و CSP، کلاینت و عملیات HTTP قابلیت‌ها، اجرای واقعی ICU و انتخاب پیام، دادهٔ SEO، انتقال خصوصی Web Vitals، ترکیب کلاس‌ها و فونت‌های دارای مجوز و بررسی‌شده.

[پشتیبانی کلاینت و سند](docs/client-document.fa.md)، [فونت](docs/fonts.fa.md)، [مرز سرور](docs/server-boundary.fa.md) و [ترجمه](docs/localization.fa.md) مالکیت و محدودیت‌ها را شرح می‌دهند. بسته‌های پشتیبان Next.js/React، next-intl، clsx و tailwind-merge نصب می‌شوند؛ Next.js در این مرحله فقط نوع‌های حذف‌شوندهٔ متادیتا و Web Vitals را می‌دهد. برنامه، مسیر، provider، رابط یا نقطهٔ ورود Next.js منتشر نشده است.

## نصب و اعتبارسنجی

از Node.js ثبت‌شده در [.nvmrc](.nvmrc) و npm همراه آن استفاده کنید. Python 3.14.4 و وابستگی‌های پین‌شدهٔ فونت را در محیط موقت فعال‌شده‌ای خارج از checkout نصب کنید. CI آن‌ها را روی اجراکنندهٔ موقت خود نصب می‌کند.

```sh
npm ci
python -m pip install --requirement font-source/requirements.txt
npm run validate -- full
```

[فهرست مرجع](.agents/validation.json) هر ده بررسی الزامی مرحله را تعیین می‌کند. تست‌های Node از داده و جریان مصنوعی استفاده می‌کنند و dotenv غیرفعال است. پوشش واقعی TypeScript در `coverage/unit/lcov.info`، گردش‌کار در `coverage/governance/lcov.info` و ابزار Python در `coverage/fonts/coverage.xml` ساخته می‌شود. این‌ها شاهد برنامهٔ قابل اجرا یا مرورگر نیستند و commit نمی‌شوند.

[مشارکت](CONTRIBUTING.fa.md)، [راهنمای مرحله](docs/bootstrap.fa.md)، [حفاظت شاخه](docs/branch-protection.fa.md) و [Sonar](docs/sonarqube.fa.md) را بخوانید. هر PR حداکثر ۱۰۰ فایل تغییر می‌دهد؛ این سقف تعداد کل فایل‌های مخزن نیست. تنظیم محلی به‌تنهایی موفقیت CI، سونار یا بازبینی دوردست را ثابت نمی‌کند.

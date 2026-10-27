# Kernel Website

[English](README.md) · [فارسی](README.fa.md)

این پروژهٔ مستقل TypeScript در مرحلهٔ **پایهٔ رابط کلاینت** است. مقدار `applicationReady:false` باقی می‌ماند. مجموعهٔ منتشرشده ۵۰ ماژول اجرایی و ۲۴ فایل تست سورس دارد: قراردادهای HTTP و فرم، خواندن زبان با مرجعیت API، ده کاتالوگ تخت ۱۰۷کلیدی، ابزار ارسال درخواست و CSP، کلاینت و عملیات HTTP قابلیت‌ها، اجرای واقعی ICU و انتخاب پیام، دادهٔ SEO، انتقال خصوصی Web Vitals، ترکیب کلاس‌ها و فونت‌های دارای مجوز و بررسی‌شده. پنج ابزار محلی shadcn/Radix، فیلد با برچسب و توضیح مرتبط، بازخورد محلی‌شده، provider نشست و پوسته، ترجیح پوسته، شمارش معکوس محدود، حرکت با محتوای اولیهٔ مرئی و آداپتر هوک Web Vitals نیز منتشر شده‌اند.

[پایهٔ رابط کلاینت](docs/client-ui.fa.md)، [مالکیت نشست](docs/session.fa.md)، [پشتیبانی کلاینت و سند](docs/client-document.fa.md)، [فونت](docs/fonts.fa.md)، [مرز سرور](docs/server-boundary.fa.md) و [ترجمه](docs/localization.fa.md) مالکیت و محدودیت‌ها را شرح می‌دهند. بسته‌های پشتیبان نصب‌شده صریحاً در [package.json](package.json) ثبت و واردسازی هر بسته به مالک، هویت و مرحلهٔ اجرایی یا نوعی دقیق محدود می‌شود. Next.js نوع‌های حذف‌شوندهٔ سند و آداپتر مستقل هوک Web Vitals را می‌دهد. صفحه، layout ریشه، آداپتر درخواست و ترجمه، خط ساخت CSS، مسیر مرورگر، استقرار یا نقطهٔ ورود فریم‌ورک منتشر نشده‌اند. [فهرست دقیق ۱۳۹فایلی](.github/bootstrap-policy.json) مرجع محدوده است.

## نصب و اعتبارسنجی

از Node.js ثبت‌شده در [.nvmrc](.nvmrc) و npm همراه آن استفاده کنید. Python 3.14.4 و وابستگی‌های پین‌شدهٔ فونت را در محیط موقت فعال‌شده‌ای خارج از checkout نصب کنید. CI آن‌ها را روی اجراکنندهٔ موقت خود نصب می‌کند.

```sh
npm ci
python -m pip install --requirement font-source/requirements.txt
npm run validate -- full
```

[فهرست مرجع](.agents/validation.json) هر ده بررسی الزامی مرحله را تعیین می‌کند. تست‌ها در Node یا jsdom جداگانه با React/RTL، Radix، next-intl و next-themes واقعی و پاسخ fetch مصنوعی اجرا می‌شوند؛ dotenv غیرفعال است. تست مالک Motion و هوک فریم‌ورک، mock و محدودیت متن ثابت خود را مستند می‌کند. پوشش واقعی TypeScript در `coverage/unit/lcov.info`، گردش‌کار در `coverage/governance/lcov.info` و ابزار Python در `coverage/fonts/coverage.xml` ساخته می‌شود. این‌ها شاهد برنامهٔ قابل اجرا یا مرورگر نیستند و commit نمی‌شوند.

[مشارکت](CONTRIBUTING.fa.md)، [راهنمای مرحله](docs/bootstrap.fa.md)، [حفاظت شاخه](docs/branch-protection.fa.md) و [Sonar](docs/sonarqube.fa.md) را بخوانید. هر PR حداکثر ۱۰۰ فایل تغییر می‌دهد؛ این سقف تعداد کل فایل‌های مخزن نیست. تنظیم محلی به‌تنهایی موفقیت CI، سونار یا بازبینی دوردست را ثابت نمی‌کند.

# آماده‌سازی انتشار و محیط

[English](release-operations.md) · [فارسی](release-operations.fa.md)

این snapshot در مرحلهٔ **delivery-tooling** قابل اجرا نیست. قرارداد آماده‌سازی
محلی و مرجع غیرفعال اضافه می‌شود و هیچ workflow انتشار، بسته‌بندی، staging، smoke
استقرار یا DAST فعال نمی‌شود. workflowهای فعلی check، سیاست و Sonar و
[gate مرجع](validation.fa.md) یازده‌بررسی نقش موجود خود را حفظ می‌کنند. شاهد native
Sonar و preflight کامل CodeRabbit تابع [حفاظت شاخه](branch-protection.fa.md) و
[راهنمای Sonar](sonarqube.fa.md) می‌ماند.

[پیکربندی نسخه](releasing.fa.md) و مدخل تاریخی changelog، tag، artifact بارگذاری‌شده،
اجرای ارائه‌دهنده یا سرویس مستقر را ثابت نمی‌کند.
[بسته‌بند](../scripts/package-release.mjs) با ورودی محلی ساختگی آزموده می‌شود؛ نه
برنامهٔ غایب را build می‌کند و نه نسخه‌ای منتشر می‌کند. آماده‌سازی محلی مجوز commit،
push، dispatch گردش کار، ایجاد secret یا فعال‌سازی زیرساخت نیست.

[اعتبارسنج‌های مقصد](../scripts/validate-workflow-targets.mjs) ورودی صریح
staging، smoke و DAST را بدون تماس با URL می‌سنجند. staging میزبان تنظیم‌شدهٔ دقیق
برنامه و API را مقایسه می‌کند. smoke افزون بر آن شناسهٔ صریح استقرار را با شناسهٔ
موردانتظار تطبیق می‌دهد. DAST میزبان مجاز و میزبان production جداگانه را مقایسه
می‌کند. این کنترل واژگانی است، نه تثبیت DNS، بررسی redirect یا اثبات غیرproduction
بودن میزبان؛ alias یا allowlist نادرست همچنان بازبینی اپراتور می‌خواهد. این توابع
هیچ scanner یا اجراکنندهٔ مرورگر ندارند.

[ابزار پاک‌سازی](../scripts/docker-smoke-cleanup.mjs) عملیات Docker و Compose تزریقی
را می‌پذیرد و نام منبع تولیدشده و فایل موقت متعلق به اجرا را محدود می‌کند.
[آزمون آن](../scripts/docker-smoke-cleanup.test.mjs) callback ساختگی و فایل موقت
دارد؛ سازگاری engine یا حذف موفق منبع واقعی را ثابت نمی‌کند. خطای پاک‌سازی شکست
می‌ماند و image، cache و استقرار نامرتبط هرگز نباید سراسری prune شوند.

عملیات اجرای آینده به gate برنامهٔ جداگانهٔ بازبینی‌شده، منشأ معتبر fixture، هویت
دقیق artifact و مقصد، حداقل دسترسی ارائه‌دهنده و مجوز صریح نیاز دارد. fork و سورس
نامطمئن نباید اعتبارنامهٔ fixture خصوصی بگیرد. اجرای واقعی، شکست و منبع باقی‌مانده
ثبت شود؛ نبود شاهد یکپارچگی به موفقیتِ ردشده تبدیل نشود.
[پذیرش staging](staging.fa.md)، [پذیرش استقرار](deployment.fa.md) و
[بازبینی امنیت](security/reviews.fa.md) را دنبال کنید.

# راهنمای وب‌سایت

[English](README.md) · [فارسی](README.fa.md)

مرحلهٔ منتشرشدهٔ `application` ترکیب قابل اجرا را با `applicationReady:true` و ۹۰ ماژول محصول بر پایهٔ fixture مستقل API دربرمی‌گیرد. موجودی دقیق و پانزده بررسی الزامی را از [راهنمای مرحله](bootstrap.fa.md) بخوانید. [یکپارچه‌سازی برنامه](application.fa.md) ترکیب تحویل‌شده و پذیرش را نگاشت می‌کند؛ نتیجهٔ واقعی ساخت، مرورگر و تصویر باید درخت دقیق آزموده‌شده را مشخص کند. استقرار و گردش‌های کاری عملیاتی پذیرش و مجوز جدا دارند.

| حوزه                          | راهنما                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| راه‌اندازی فعلی و مالکیت سورس | [README](../README.fa.md)، [معماری](architecture.fa.md)، [ناوبری](source-navigation.fa.md)، [ADRها](adr/README.fa.md)                                                                 |
| یکپارچه‌سازی برنامه           | [پذیرش برنامه](application.fa.md)، [قرارداد SEO](seo.fa.md)                                                                                                                           |
| رفتار فرم‌های محلی و نشست     | [فرم‌ها](forms.fa.md)، [نشست](session.fa.md)، [رابط کلاینت](client-ui.fa.md)                                                                                                          |
| مرزهای API و سرور             | [fixture API](api-fixture.fa.md)، [مرز سرور](server-boundary.fa.md)، [پشتیبانی کلاینت و سند](client-document.fa.md)                                                                   |
| طراحی و زبان‌ها               | [طراحی](../DESIGN.fa.md)، [مهارت طراحی](../.agents/skills/design-ui/SKILL.md)، [ترجمه](localization.fa.md)، [فونت](fonts.fa.md)                                                       |
| اعتبارسنجی و شواهد            | [اعتبارسنجی](validation.fa.md)، [آزمون](testing.fa.md)، [قابلیت اطمینان آزمون](test-reliability.fa.md)، [گردش تغییر](change-workflow.fa.md)                                           |
| پیش‌نیازهای مرورگر و نمایش    | [زیرساخت مرورگر](browser-foundation.fa.md)، [زیرساخت اجراگر](runner-foundation.fa.md)، [دسترس‌پذیری](accessibility.fa.md)، [مقایسهٔ تصویر](visual-regression.fa.md)                   |
| امنیت و حریم خصوصی            | [CSP](website-csp.fa.md)، [مدل تهدید](security/threat-model.fa.md)، [ورود](security/authentication-review.fa.md)، [بازبینی امنیت](security/reviews.fa.md)، [سیاست](../SECURITY.fa.md) |
| کارایی                        | [کارایی وب‌سایت](website-performance.fa.md)                                                                                                                                           |
| آماده‌سازی تحویل و عملیات     | [استقرار](deployment.fa.md)، [staging](staging.fa.md)، [عملیات انتشار](release-operations.fa.md)، [نسخه‌بندی](releasing.fa.md)، [حفاظت شاخه](branch-protection.fa.md)                 |
| تحلیل و راهنمای دستیار        | [SonarQube](sonarqube.fa.md)، [دستورها](../.agents/README.md)، [فهم سورس](ai-code-understanding.fa.md)، [ارزیابی](comprehension-evaluation.fa.md)                                     |

فرمان‌ها و مالکیت بررسی‌ها از
[فهرست مرجع اعتبارسنجی](../.agents/validation.json) می‌آیند. راهنماهای انسانی
انگلیسی همراه کامل فارسی دارند؛ دستورها و مهارت‌های دستیار فقط انگلیسی هستند.
مجموعه‌آزمون‌های نوشته‌شدهٔ مرورگر، الگوهای غیرفعال اپراتور و fixtureهای محلی Node
فقط محدودهٔ مستندشدهٔ خود را اثبات می‌کنند.

## شواهد تاریخ‌دار و سورس اولیه

این سوابق تاریخ و یافته‌های اولیهٔ خود را نگه می‌دارند. آن‌ها سورس و بررسی‌های
ثبت‌شده در همان زمان را توصیف می‌کنند؛ از جمله مسیرهایی که یکپارچه‌سازی اجرایی
آن‌ها ممکن است هنوز منتشر نشده باشد. این سوابق تأیید snapshot فعلی، تصویر فعلی
مرورگر، تنظیم سرویس بیرونی یا استقرار نیستند. برای پذیرش فعلی از راهنماهای بالا
استفاده کنید.

- [تأیید مستقل وب‌سایت](qa/independent-website-verification.fa.md)
- [ارزیابی نیازمندی، ۲۴ اکتبر ۲۰۲۶](qa/requirements-audit-2026-10-24.fa.md)
- [وضعیت موضوع‌ها، ۲۴ اکتبر ۲۰۲۶](qa/roadmap-status-2026-10-24.fa.md)،
  [JSON ثبت‌شده](qa/roadmap-status-2026-10-24.json)
- [فهم سورس، ۲۴ اکتبر ۲۰۲۶](qa/source-comprehension-2026-10-24.fa.md)
- [چیدمان مستقل، ۲۴ اکتبر ۲۰۲۶](qa/standalone-layout-2026-10-24.fa.md)
- [پیکربندی اولیهٔ ابزار Vitest](qa/source-originals/vitest.tooling.config.ts)

فایل بایگانی‌شدهٔ Vitest سابقهٔ سورس در `docs/qa/source-originals/` است. این فایل
پیکربندی فعال ریشه، فرمان ثبت‌شدهٔ اعتبارسنجی یا مجوز اجرای سورس بایگانی‌شده نیست.
پیکربندی منتشرشده و مجموعهٔ آزمون راهبری با پوشش اندازه‌گیری‌شده همچنان مالک فعلی
هستند.

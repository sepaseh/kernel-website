# SonarQube Cloud

[English](sonarqube.md) · [فارسی](sonarqube.fa.md)

[گردش‌کار موجود Sonar](../.github/workflows/sonar.yml) روی `ubuntu-latest`
اجرا می‌شود؛ در راه‌انداز سرویس **Linux** را انتخاب کنید، حتی اگر توسعهٔ محلی
روی ویندوز است. همین گردش‌کار را استفاده کنید و `build.yml` تکراری نسازید.
روش تحلیل در CI را انتخاب و تحلیل خودکار پروژه را خاموش کنید.

کلید پروژهٔ واردشدهٔ **`sepaseh_kernel-website`** را در variable اکشن
`SONAR_PROJECT_KEY` قرار دهید. پیش‌فرض `SONAR_HOST_URL` برابر
`https://sonarcloud.io` است. توکن دارای اجازهٔ تحلیل همین پروژه بسازید و
فقط مقدار آن را در Actions secret با نام **`SONAR_TOKEN`** ذخیره کنید.
برچسب توکن مانند `kernel-github-actions` دلخواه و جدا از نام secret و کلید
پروژه است. مقدار توکن را در سورس، dotenv، variable، چت یا log نگذارید.
نبود اعتبارنامه یا تنظیم پروژه خطای صریح می‌دهد و تحلیل ادعا نمی‌شود.

گردش‌کار مجموعهٔ دقیق فایل‌ها را بررسی، ابزارهای قفل‌شده را نصب و هر دو دستور
پوشش واقعی را پیش از اسکن اجرا می‌کند. [تنظیمات](../sonar-project.properties)
فایل‌های `coverage/unit/lcov.info` و `coverage/governance/lcov.info` را
از همان checkout و revision وارد می‌کند. پوشش مربوط به ابزارهای پایه و
گردش‌کار است؛ رابط Next.js، مسیر HTTP، سفر مرورگر یا استقرار را پوشش نمی‌دهد.
تعریف صرف نوع DTO رفتار اجرایی ندارد. گزارش نسازید مگر از اجرای واقعی تست
و پوشش پروژهٔ دیگر را جایگزین نکنید.

اجرای واقعی، SHA یا PR تحلیل‌شده، تحلیل سرویس و دروازهٔ کیفیت را ثبت کنید.
scanner از `sonar.qualitygate.wait=false` استفاده می‌کند؛ ارسال موفق تحلیل
و سبزی job اکشن با موفقیت بررسی **SonarCloud Code Analysis** از App
`12526` متفاوت است. قبولی بررسی سرویس طبق
[حفاظت شاخه](branch-protection.fa.md) الزامی است. تحلیل غایب، اجرا‌نشده یا
ناموفق به معنی قبولی دروازهٔ کیفیت نیست.

پیکربندی و شمارندهٔ صفر خطا در پروژهٔ خالی شاهد اجرا نیستند. موفقیت CI اولیه و
دروازهٔ کیفیت Sonar برای [PR شمارهٔ ۱ وب‌سایت](https://github.com/sepaseh/kernel-website/pull/1)
در ۲۶ اکتبر ۲۰۲۶ تأیید شد؛ headهای بعدی به نتیجهٔ تازه نیاز دارند. خالی بودن
سابقهٔ main به‌تنهایی
مسدود بودن تحلیل PR نخست را ثابت نمی‌کند؛ خطای واقعی سرویس را بررسی کنید.
PR از fork اعتبارنامهٔ این گردش‌کار را دریافت نمی‌کند؛ اسرار را در اختیار
کد بررسی‌نشدهٔ fork قرار ندهید.

در یافتهٔ S9382 مربوط به [صفحه‌بندی فایل‌های PR](../scripts/check-pr-size.mjs)،
نشانی صفحهٔ بعد از هدر Link پاسخ قبلی به دست می‌آید؛ بنابراین انتظار ترتیبی
صفحه‌ها الزامی است. این حالت با [استثنای رسمی وابستگی تکرارها](https://eslint.org/docs/latest/rules/no-await-in-loop#when-not-to-use-it)
مطابقت دارد. بازبینی مخزن این مورد را مثبت کاذب می‌داند؛ یافتهٔ سرویس در
وضعیت ثبت‌شدهٔ ۲۶ اکتبر ۲۰۲۶ هنوز **OPEN** است و تغییری در طبقه‌بندی سرویس
ادعا نمی‌شود. ترتیب وابسته را حفظ کنید؛ برای خاموش‌کردن یافته، suppression،
wrapper کمکی یا درخواست موازی اضافه نکنید.

[راهنمای رسمی GitHub Actions](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
و [روش‌های تحلیل](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis)
را ببینید.

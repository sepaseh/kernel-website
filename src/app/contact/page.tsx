import { getTranslations } from "next-intl/server";

import { ContactForm } from "@/features/contact/ContactForm";
import { createPageMetadata } from "@/shared/seo/metadata";

export async function generateMetadata() {
  const t = await getTranslations();
  return createPageMetadata({
    title: `${t("contact")} · Kernel`,
    description: t("contactIntro"),
    path: "/contact",
  });
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <section className="site-container py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <p className="eyebrow mb-6 text-primary">Kernel</p>
        <h1 className="section-title">{t("contact")}</h1>
        <p className="mt-6 mb-10 text-lg leading-relaxed text-muted-foreground">
          {t("contactIntro")}
        </p>
        <ContactForm />
      </div>
    </section>
  );
}

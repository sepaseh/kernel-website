import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <div className="site-container py-28">
      <p className="eyebrow mb-6">404</p>
      <h1 className="section-title">{t("feedbackNotFoundTitle")}</h1>
      <p className="mt-5 text-muted-foreground">{t("feedbackNotFoundText")}</p>
      <Button className="mt-8" asChild>
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}

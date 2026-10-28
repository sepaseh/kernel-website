"use client";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
type Props = {
  error: unknown;
  retry: () => void;
};

export default function ErrorPage({ retry }: Props) {
  const t = useTranslations();

  return (
    <div className="site-container py-28">
      <meta name="robots" content="noindex, nofollow" />
      <h1 className="section-title">{t("feedbackErrorTitle")}</h1>
      <p className="mt-5 text-muted-foreground">{t("feedbackErrorText")}</p>
      <Button className="mt-8" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}

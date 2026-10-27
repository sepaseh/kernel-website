"use client";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WebsiteApiError } from "@/shared/api/client";
type Props = { error?: unknown; success?: string };
export const Feedback = ({ error, success }: Props) => {
  const t = useTranslations();
  if (error)
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert size={16} color="currentColor" aria-hidden />
        <AlertTitle>{t("unexpectedError")}</AlertTitle>
        <AlertDescription>
          {error instanceof TypeError ||
          (error instanceof WebsiteApiError && error.status >= 500)
            ? t("networkError")
            : error instanceof Error
              ? error.message
              : t("networkError")}
        </AlertDescription>
      </Alert>
    );
  return success ? (
    <Alert role="status">
      <CircleCheck size={16} color="currentColor" aria-hidden />
      <AlertDescription>{success}</AlertDescription>
    </Alert>
  ) : null;
};

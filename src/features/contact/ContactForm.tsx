"use client";

import { useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useEffect, useId, useRef, useState } from "react";

import { WebsiteApiError } from "@/shared/api/client";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { Button } from "@/shared/ui/button";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

import { submitContact } from "./api";
import {
  contactDescriptionMaxLength,
  contactNameMaxLength,
  type ContactSubmission,
} from "./types";
import { invalidContactFields, normalizedContact } from "./values";

type FieldErrors = Partial<Record<keyof ContactSubmission, string>>;
export function ContactForm() {
  const locale = useLocale();
  return <OwnedContactForm key={locale} />;
}

function OwnedContactForm() {
  const t = useTranslations();
  const locale = useLocale();
  const descriptionId = useId();
  const captureOperation = useOperationScope();
  const pending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const resetRequested = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>();
  const [fields, setFields] = useState<FieldErrors>({});

  useEffect(() => {
    if (sent) {
      successRef.current?.focus();
      return;
    }
    if (busy) return;
    const first = Object.keys(fields)[0];
    if (first || resetRequested.current) {
      (
        formRef.current?.elements.namedItem(
          first ?? "name",
        ) as HTMLElement | null
      )?.focus();
      resetRequested.current = false;
    }
  }, [busy, fields, sent]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = Object.fromEntries(
      ["name", "mobile", "description"].map((key) => [
        key,
        String(data.get(key) ?? ""),
      ]),
    ) as ContactSubmission;
    const normalized = normalizedContact(body);
    const invalid = invalidContactFields(normalized);
    const nextFields: FieldErrors = {};
    if (invalid.name) nextFields.name = t("contactNameInvalid");
    if (invalid.mobile) nextFields.mobile = t("contactMobileInvalid");
    if (invalid.description)
      nextFields.description = t("contactDescriptionInvalid");
    setFields(nextFields);
    setError(undefined);
    const first = Object.keys(nextFields)[0];
    if (first) return;
    const signature = JSON.stringify(normalized);
    const isCurrent = captureOperation();
    pending.current = true;
    setBusy(true);
    try {
      if (attempt.current?.signature !== signature)
        attempt.current = { signature, key: crypto.randomUUID() };
      await submitContact(body, attempt.current.key, locale);
      if (!isCurrent()) return;
      form.reset();
      attempt.current = undefined;
      setSent(true);
    } catch (problem) {
      if (!isCurrent()) return;
      if (problem instanceof WebsiteApiError) {
        const next: FieldErrors = {};
        for (const key of ["name", "mobile", "description"] as const)
          if (problem.fields[key]) next[key] = problem.fields[key];
        setFields(next);
        const seconds = Number(problem.retryAfter);
        if (
          problem.status === 429 &&
          Number.isSafeInteger(seconds) &&
          seconds > 0
        ) {
          setError(new Error(t("contactRateLimit", { seconds })));
          return;
        }
      }
      setError(problem);
    } finally {
      pending.current = false;
      if (isCurrent()) setBusy(false);
    }
  }

  if (sent)
    return (
      <div ref={successRef} tabIndex={-1} className="space-y-6 outline-none">
        <Feedback success={t("contactSuccess")} />
        <Button
          type="button"
          onClick={() => {
            resetRequested.current = true;
            setSent(false);
          }}
        >
          {t("contactAnother")}
        </Button>
      </div>
    );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={submit}
      aria-label={t("contact")}
      aria-busy={busy}
      className="space-y-6"
    >
      <Feedback error={error} />
      <fieldset disabled={busy} className="space-y-6">
        <FormField
          name="name"
          label={t("contactName")}
          autoComplete="name"
          required
          maxLength={contactNameMaxLength}
          error={fields.name}
          dir="auto"
        />
        <FormField
          name="mobile"
          label={t("contactMobile")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          maxLength={32}
          dir="ltr"
          hint={t.rich("contactMobileHelp", {
            number: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
          })}
          error={fields.mobile}
        />
        <div className="space-y-2.5">
          <Label htmlFor={descriptionId}>{t("contactDescription")}</Label>
          <Textarea
            name="description"
            id={descriptionId}
            required
            maxLength={contactDescriptionMaxLength}
            dir="auto"
            aria-invalid={Boolean(fields.description)}
            aria-describedby={
              fields.description ? `${descriptionId}-error` : undefined
            }
          />
          {fields.description && (
            <p
              id={`${descriptionId}-error`}
              className="text-sm text-destructive"
            >
              {fields.description}
            </p>
          )}
        </div>
        <Button type="submit" className="h-12 w-full">
          {busy ? t("pending") : t("contactSend")}
        </Button>
      </fieldset>
    </form>
  );
}

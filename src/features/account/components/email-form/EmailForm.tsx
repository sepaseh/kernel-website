"use client";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getAccount,
  requestEmailCode,
  verifyEmail,
} from "@/features/account/api";
import { AccountSection } from "@/features/account/components/account-section/AccountSection";
import type { Account } from "@/features/account/types";
import { useSession } from "@/features/auth/SessionProvider";
import { useCooldown } from "@/shared/hooks/use-cooldown";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { normalizeDigits, textValue } from "@/shared/lib/form-values";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

type EmailFormProps = { account: Account };
export const EmailForm = ({ account }: EmailFormProps) => {
  const locale = useLocale();
  const { generation } = useSession();
  return (
    <EmailFields
      key={`${locale}:${generation}:${account.id}`}
      account={account}
    />
  );
};
const EmailFields = ({ account }: EmailFormProps) => {
  const t = useTranslations();

  const locale = useLocale();
  const { acceptAccount } = useSession();
  const captureOperation = useOperationScope();
  const form = useRef<HTMLFormElement>(null);
  const emailRevision = useRef(0);
  const cooldown = useCooldown();
  const [email, setEmail] = useState(account.email ?? "");
  const [requestedEmail, setRequestedEmail] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<string>();
  async function sendCode() {
    if (sending || busy || cooldown.remaining) return;
    const input = form.current?.elements.namedItem("email");
    if (!(input instanceof HTMLInputElement) || !input.reportValidity()) return;
    const destination = email.trim().toLowerCase();
    const destinationRevision = emailRevision.current;
    const isCurrent = captureOperation();
    setSending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const response = await requestEmailCode({ email: destination }, locale);
      if (!isCurrent() || emailRevision.current !== destinationRevision) return;
      setRequestedEmail(destination);
      cooldown.start(response.remaining_seconds);
      setNotice(t("codeRequested"));
    } catch (problem) {
      if (isCurrent()) setError(problem);
    } finally {
      if (isCurrent()) setSending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      sending ||
      !requestedEmail ||
      requestedEmail !== email.trim().toLowerCase() ||
      !event.currentTarget.reportValidity()
    )
      return;
    const data = new FormData(event.currentTarget);
    const isCurrent = captureOperation();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await verifyEmail(
        { email: requestedEmail, otp: normalizeDigits(textValue(data, "otp")) },
        locale,
      );
      if (!isCurrent()) return;
      const updated = await getAccount(locale);
      if (!isCurrent()) return;
      acceptAccount(updated);
      setEmail(updated.email ?? requestedEmail);
      setRequestedEmail(undefined);
      setNotice(t("accountEmailVerified"));
    } catch (problem) {
      if (isCurrent()) setError(problem);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  const resendLabel = cooldown.remaining
    ? t("feedbackResendIn", { seconds: cooldown.remaining })
    : t("sendCode");
  const sendLabel = sending ? t("pending") : resendLabel;
  return (
    <AccountSection
      title={t("accountEmail")}
      description={t("accountEmailText")}
    >
      <form
        ref={form}
        onSubmit={submit}
        className="space-y-5"
        aria-busy={busy || sending}
      >
        <Feedback error={error} success={notice} />
        {account.email ? (
          <p className="text-sm text-muted-foreground break-all">
            {t("accountVerifiedEmail", { email: account.email })}
          </p>
        ) : null}
        <fieldset className="space-y-5" disabled={busy || sending}>
          <FormField
            id="account-email"
            name="email"
            label={t("accountEmailLabel")}
            value={email}
            onChange={(event) => {
              emailRevision.current += 1;
              setEmail(event.target.value);
              setError(undefined);
              setRequestedEmail(undefined);
              setNotice(undefined);
            }}
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            maxLength={254}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 px-5"
            disabled={cooldown.remaining > 0}
            onClick={() => void sendCode()}
          >
            {sendLabel}
          </Button>
          <FormField
            id="email-otp"
            name="otp"
            label={t("otp")}
            inputMode="numeric"
            dir="ltr"
            autoComplete="one-time-code"
            required
            maxLength={12}
          />
          <Button
            type="submit"
            className="h-11 px-5"
            disabled={requestedEmail !== email.trim().toLowerCase()}
          >
            {busy ? t("pending") : t("accountVerifyEmail")}
          </Button>
        </fieldset>
      </form>
    </AccountSection>
  );
};

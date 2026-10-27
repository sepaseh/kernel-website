"use client";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { changePassword } from "@/features/account/api";
import { AccountSection } from "@/features/account/components/account-section/AccountSection";
import { useSession } from "@/features/auth/SessionProvider";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { passwordValue } from "@/shared/lib/form-values";
import { replaceDocument } from "@/shared/navigation/document";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

export function PasswordForm() {
  const locale = useLocale();
  const { account, generation } = useSession();
  return (
    <PasswordFields key={`${locale}:${generation}:${account?.id ?? ""}`} />
  );
}
function PasswordFields() {
  const t = useTranslations();

  const locale = useLocale();
  const captureOperation = useOperationScope();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const password = passwordValue(data, "new_password");
    if (password !== passwordValue(data, "confirmation")) {
      setError(new Error(t("passwordMismatch")));
      return;
    }
    const isCurrent = captureOperation();
    setBusy(true);
    setError(undefined);
    try {
      await changePassword(
        {
          current_password: passwordValue(data, "current_password"),
          new_password: password,
        },
        locale,
      );
      // Password changes revoke the session. Start a fresh document so the
      // account guard cannot replace this success destination during refresh.
      if (isCurrent()) replaceDocument("/login?password=changed");
    } catch (problem) {
      if (isCurrent()) setError(problem);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  return (
    <AccountSection
      title={t("password")}
      description={t("accountPasswordText")}
    >
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <Feedback error={error} />
        <fieldset className="space-y-5" disabled={busy}>
          <FormField
            id="current-password"
            name="current_password"
            label={t("accountCurrentPassword")}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <FormField
            id="new-password"
            name="new_password"
            label={t("newPassword")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            hint={t("passwordHelp")}
          />
          <FormField
            id="password-confirmation"
            name="confirmation"
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
          <Button type="submit" className="h-11 px-5">
            {busy ? t("pending") : t("accountChangePassword")}
          </Button>
        </fieldset>
      </form>
    </AccountSection>
  );
}

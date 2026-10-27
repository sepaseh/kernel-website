"use client";
import { useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { updateUsername } from "@/features/account/api";
import { AccountSection } from "@/features/account/components/account-section/AccountSection";
import type { Account } from "@/features/account/types";
import { useSession } from "@/features/auth/SessionProvider";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { textValue } from "@/shared/lib/form-values";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

type UsernameFormProps = { account: Account };
export const UsernameForm = ({ account }: UsernameFormProps) => {
  const locale = useLocale();
  const { generation } = useSession();
  return (
    <UsernameFields
      key={`${locale}:${generation}:${account.id}`}
      account={account}
    />
  );
};
const UsernameFields = ({ account }: UsernameFormProps) => {
  const t = useTranslations();

  const locale = useLocale();
  const { acceptAccount } = useSession();
  const captureOperation = useOperationScope();
  const [username, setUsername] = useState(account.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<string>();
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const isCurrent = captureOperation();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const updated = await updateUsername(
        { username: textValue(data, "username").toLowerCase() },
        locale,
      );
      if (!isCurrent()) return;
      acceptAccount(updated);
      setUsername(updated.username ?? "");
      setNotice(t("accountUsernameUpdated"));
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  return (
    <AccountSection
      title={t("accountUsername")}
      description={t("accountUsernameText")}
    >
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <Feedback error={error} success={notice} />
        <fieldset className="space-y-5" disabled={busy}>
          <FormField
            id="account-username"
            name="username"
            label={t("accountUsername")}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            dir="ltr"
            required
            pattern="[a-zA-Z0-9_.\-]{3,30}"
            minLength={3}
            maxLength={30}
            hint={t("accountUsernameHelp")}
          />
          <Button type="submit" className="h-11 px-5">
            {busy ? t("pending") : t("accountSaveUsername")}
          </Button>
        </fieldset>
      </form>
    </AccountSection>
  );
};

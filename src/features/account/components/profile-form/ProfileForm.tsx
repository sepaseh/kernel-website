"use client";
import { useLocale, useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { updateProfile } from "@/features/account/api";
import { AccountSection } from "@/features/account/components/account-section/AccountSection";
import type { Account } from "@/features/account/types";
import { useSession } from "@/features/auth/SessionProvider";
import { profileNameMaxLength } from "@/shared/contracts";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { textValue } from "@/shared/lib/form-values";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

type ProfileFormProps = { account: Account };
export const ProfileForm = ({ account }: ProfileFormProps) => {
  const locale = useLocale();
  const { generation } = useSession();
  return (
    <ProfileFields
      key={`${locale}:${generation}:${account.id}`}
      account={account}
    />
  );
};
const ProfileFields = ({ account }: ProfileFormProps) => {
  const t = useTranslations();

  const locale = useLocale();
  const { acceptAccount } = useSession();
  const captureOperation = useOperationScope();
  const [firstName, setFirstName] = useState(account.first_name);
  const [lastName, setLastName] = useState(account.last_name);
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
      const updated = await updateProfile(
        {
          first_name: textValue(data, "first_name"),
          last_name: textValue(data, "last_name"),
        },
        locale,
      );
      if (!isCurrent()) return;
      acceptAccount(updated);
      setFirstName(updated.first_name);
      setLastName(updated.last_name);
      setNotice(t("accountProfileUpdated"));
    } catch (error_) {
      if (isCurrent()) setError(error_);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  return (
    <AccountSection
      title={t("accountProfile")}
      description={t("accountProfileText")}
    >
      <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <Feedback error={error} success={notice} />
        <fieldset className="space-y-5" disabled={busy}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              id="profile-first-name"
              name="first_name"
              label={t("firstName")}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              required
              maxLength={profileNameMaxLength}
            />
            <FormField
              id="profile-last-name"
              name="last_name"
              label={t("lastName")}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              required
              maxLength={profileNameMaxLength}
            />
          </div>
          <FormField
            id="profile-mobile"
            label={t("mobile")}
            value={account.mobile}
            readOnly
            dir="ltr"
            hint={t("accountMobileHelp")}
          />
          <Button type="submit" className="h-11 px-5">
            {busy ? t("pending") : t("accountSaveProfile")}
          </Button>
        </fieldset>
      </form>
    </AccountSection>
  );
};

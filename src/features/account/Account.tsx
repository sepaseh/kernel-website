"use client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/api";
import { useSession } from "@/features/auth/SessionProvider";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { Feedback } from "@/shared/ui/Feedback";

import { EmailForm } from "./components/email-form/EmailForm";
import { PasswordForm } from "./components/password-form/PasswordForm";
import { ProfileForm } from "./components/profile-form/ProfileForm";
import { UsernameForm } from "./components/username-form/UsernameForm";

export function Account() {
  const locale = useLocale();
  const { account, generation } = useSession();
  return (
    <AccountView
      key={`${locale}:${generation}:${account?.id ?? "anonymous"}`}
    />
  );
}

function AccountView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { account, loading, error, refresh } = useSession();
  const captureOperation = useOperationScope();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>();
  async function signOut() {
    if (busy) return;
    const isCurrent = captureOperation();
    setBusy(true);
    setLogoutError(undefined);
    try {
      await logout(locale);
      if (!isCurrent()) return;
      refresh();
      router.replace("/login");
    } catch (problem) {
      if (isCurrent()) setLogoutError(problem);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  useEffect(() => {
    if (!loading && !account && !error) router.replace("/login");
  }, [loading, account, error, router]);
  if (loading || (!account && !error))
    return (
      <div className="site-container py-24" role="status">
        {t("accountSessionLoading")}
      </div>
    );
  if (error || !account)
    return (
      <div className="site-container max-w-xl py-24">
        <h1 className="mb-6 text-3xl">{t("accountSessionError")}</h1>
        <Feedback error={error} />
        <Button className="mt-6" onClick={refresh}>
          {t("accountCheckAgain")}
        </Button>
      </div>
    );
  return (
    <section
      className="site-container py-14 sm:py-20"
      data-testid="account-content"
    >
      <div className="mb-12 flex flex-wrap items-end justify-between gap-7">
        <div>
          <p className="eyebrow mb-5 text-muted-foreground">
            {t("accountEyebrow")}
          </p>
          <h1 className="section-title">
            {t("accountTitle", { name: account.first_name })}
          </h1>
          <p className="mt-4 text-muted-foreground">{t("accountIntro")}</p>
        </div>
        <Button
          variant="outline"
          className="h-11 gap-3 px-5"
          disabled={busy}
          onClick={() => void signOut()}
        >
          <LogOut
            size={16}
            color="currentColor"
            className="size-4"
            aria-hidden
          />
          {busy ? t("pending") : t("accountLogout")}
        </Button>
      </div>
      <Feedback error={logoutError} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ProfileForm account={account} />
          <UsernameForm account={account} />
        </div>
        <div className="space-y-6">
          <EmailForm account={account} />
          <PasswordForm />
        </div>
      </div>
    </section>
  );
}

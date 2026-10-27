"use client";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/SessionProvider";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import { isMobile, mobileValue, passwordValue } from "@/shared/lib/form-values";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

import { login } from "./api";

export function Login() {
  const locale = useLocale();
  const { account, generation } = useSession();
  return (
    <LoginForm key={`${locale}:${generation}:${account?.id ?? "anonymous"}`} />
  );
}

function LoginForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const captureOperation = useOperationScope();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const mobile = mobileValue(data);
    if (!isMobile(mobile)) {
      setError(new Error(t("mobileInvalid")));
      return;
    }
    const isCurrent = captureOperation();
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await login(
        { identifier: mobile, password: passwordValue(data) },
        locale,
      );
      if (!isCurrent()) return;
      refresh();
      router.replace("/account");
    } catch (problem) {
      if (isCurrent()) setError(problem);
    } finally {
      pending.current = false;
      if (isCurrent()) setBusy(false);
    }
  }
  return (
    <section>
      <p className="eyebrow mb-5">Kernel</p>
      <h1 className="text-4xl leading-tight font-medium tracking-[-0.045em]">
        {t("authLoginTitle")}
      </h1>
      <p className="mt-3 mb-8 text-muted-foreground">{t("authLoginText")}</p>
      <form
        onSubmit={submit}
        className="space-y-5"
        data-testid="login-form"
        aria-busy={busy}
      >
        <Feedback error={error} />
        <fieldset disabled={busy} className="space-y-5">
          <FormField
            name="mobile"
            label={t("mobile")}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            required
            maxLength={20}
            placeholder="09xxxxxxxxx"
          />
          <FormField
            name="password"
            label={t("password")}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Button className="h-12 w-full gap-3" type="submit">
            {busy ? t("pending") : t("login")}
            <ArrowUpRight
              size={16}
              color="currentColor"
              className="size-4 rtl:-rotate-90"
              aria-hidden
            />
          </Button>
        </fieldset>
      </form>
      <p className="mt-7 text-sm text-muted-foreground">
        {t("authNoAccount")}{" "}
        <Link
          href="/register"
          className="text-foreground underline underline-offset-4"
        >
          {t("register")}
        </Link>
      </p>
    </section>
  );
}

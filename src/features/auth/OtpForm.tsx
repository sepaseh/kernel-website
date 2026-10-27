"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/SessionProvider";
import type { ForgotPasswordRequest } from "@/features/recovery/types";
import type { RegisterRequest } from "@/features/register/types";
import { type OtpResponse, profileNameMaxLength } from "@/shared/contracts";
import { useCooldown } from "@/shared/hooks/use-cooldown";
import { useOperationScope } from "@/shared/hooks/use-operation-scope";
import {
  isMobile,
  mobileValue,
  normalizeDigits,
  passwordValue,
  textValue,
} from "@/shared/lib/form-values";
import { Feedback } from "@/shared/ui/Feedback";
import { FormField } from "@/shared/ui/FormField";

type OtpFormProps = {
  requestCode: (
    mobile: RegisterRequest["mobile"],
    locale: string,
  ) => Promise<OtpResponse>;
} & (
  | {
      kind: "register";
      complete: (value: RegisterRequest, locale: string) => Promise<void>;
    }
  | {
      kind: "recovery";
      complete: (value: ForgotPasswordRequest, locale: string) => Promise<void>;
    }
);

export function OtpForm(props: OtpFormProps) {
  const locale = useLocale();
  const { account, generation } = useSession();
  return (
    <OtpFormBody
      {...props}
      key={`${props.kind}:${locale}:${generation}:${account?.id ?? "anonymous"}`}
    />
  );
}

function OtpFormBody(props: OtpFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const captureOperation = useOperationScope();
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const cooldown = useCooldown();
  const [mobileInput, setMobileInput] = useState("");
  const [codeMobile, setCodeMobile] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notice, setNotice] = useState<string>();
  const registration = props.kind === "register";
  const mobile = normalizeDigits(mobileInput).replace(/[\s-]/g, "");
  const remaining = codeMobile === mobile ? cooldown.remaining : 0;
  let codeLabel = t("sendCode");
  if (sending) codeLabel = t("pending");
  else if (remaining) codeLabel = t("feedbackResendIn", { seconds: remaining });
  const submitLabel = t(registration ? "register" : "authResetPassword");

  const ownsDestination = (destination: RegisterRequest["mobile"]) =>
    form.current !== null &&
    mobileValue(new FormData(form.current)) === destination;

  async function sendCode() {
    if (pending.current || remaining || !form.current) return;
    const destination = mobileValue(new FormData(form.current));
    if (!isMobile(destination)) {
      setError(new Error(t("mobileInvalid")));
      return;
    }
    const isCurrent = captureOperation();
    pending.current = true;
    setSending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const response = await props.requestCode(destination, locale);
      if (!isCurrent() || !ownsDestination(destination)) return;
      setCodeMobile(destination);
      cooldown.start(response.remaining_seconds);
      setNotice(t("codeRequested"));
    } catch (problem) {
      if (isCurrent() && ownsDestination(destination)) setError(problem);
    } finally {
      pending.current = false;
      if (isCurrent()) setSending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const destination = mobileValue(data);
    const password = passwordValue(data);
    if (!isMobile(destination)) {
      setError(new Error(t("mobileInvalid")));
      return;
    }
    if (password !== passwordValue(data, "confirmation")) {
      setError(new Error(t("passwordMismatch")));
      return;
    }
    const isCurrent = captureOperation();
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const value = {
      mobile: destination,
      otp: normalizeDigits(textValue(data, "otp")),
      password,
    };
    try {
      if (props.kind === "register")
        await props.complete(
          {
            ...value,
            first_name: textValue(data, "first_name"),
            last_name: textValue(data, "last_name"),
          },
          locale,
        );
      else await props.complete(value, locale);
      if (!isCurrent()) return;
      if (registration) {
        refresh();
        router.replace("/account");
      } else router.replace("/login?reset=success");
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
        {t(registration ? "authRegisterTitle" : "authRecoveryTitle")}
      </h1>
      <p className="mt-3 mb-8 text-muted-foreground">
        {t(registration ? "authRegisterText" : "authRecoveryText")}
      </p>
      <form
        ref={form}
        onSubmit={submit}
        className="space-y-5"
        data-testid={registration ? "register-form" : "recovery-form"}
        aria-busy={busy || sending}
      >
        <Feedback error={error} success={notice} />
        <fieldset disabled={busy} className="space-y-5">
          {registration ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="first_name"
                label={t("firstName")}
                autoComplete="given-name"
                required
                maxLength={profileNameMaxLength}
              />
              <FormField
                name="last_name"
                label={t("lastName")}
                autoComplete="family-name"
                required
                maxLength={profileNameMaxLength}
              />
            </div>
          ) : null}
          <FormField
            name="mobile"
            label={t("mobile")}
            type="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder="09xxxxxxxxx"
            required
            maxLength={20}
            value={mobileInput}
            onChange={(event) => {
              setMobileInput(event.currentTarget.value);
              setError(undefined);
              setNotice(undefined);
            }}
          />
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <FormField
                name="otp"
                label={t("otp")}
                autoComplete="one-time-code"
                inputMode="numeric"
                dir="ltr"
                required
                maxLength={12}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-12 shrink-0"
              disabled={sending || remaining > 0}
              onClick={() => void sendCode()}
            >
              {codeLabel}
            </Button>
          </div>
          {registration ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("feedbackCodeHelp")}
            </p>
          ) : null}
          <FormField
            name="password"
            label={t(registration ? "password" : "newPassword")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            hint={t("passwordHelp")}
          />
          <FormField
            name="confirmation"
            label={t("confirmPassword")}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
          />
          <Button className="h-12 w-full" type="submit" disabled={sending}>
            {busy ? t("pending") : submitLabel}
          </Button>
        </fieldset>
      </form>
      {registration ? (
        <p className="mt-7 text-sm text-muted-foreground">
          {t("authHasAccount")}{" "}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-4"
          >
            {t("login")}
          </Link>
        </p>
      ) : (
        <p className="mt-7">
          <Link href="/login" className="text-sm underline underline-offset-4">
            {t("authBackToLogin")}
          </Link>
        </p>
      )}
    </section>
  );
}

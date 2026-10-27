import type { AbstractIntlMessages } from "next-intl";

import type { WebsiteTranslationResource } from "./catalog-data/website-types";

const sharedClientKeys = [
  "account",
  "backHome",
  "codeRequested",
  "confirmPassword",
  "feedbackCodeHelp",
  "feedbackErrorText",
  "feedbackErrorTitle",
  "feedbackNotFoundText",
  "feedbackNotFoundTitle",
  "feedbackResendIn",
  "firstName",
  "forgotPassword",
  "home",
  "lastName",
  "login",
  "mobile",
  "mobileInvalid",
  "networkError",
  "newPassword",
  "otp",
  "password",
  "passwordHelp",
  "passwordMismatch",
  "pending",
  "register",
  "reload",
  "retry",
  "sendCode",
  "unexpectedError",
] as const satisfies readonly (keyof WebsiteTranslationResource)[];

const clientKeys = {
  account: [
    ...sharedClientKeys,
    ...[
      "accountChangePassword",
      "accountCheckAgain",
      "accountCurrentPassword",
      "accountEmail",
      "accountEmailLabel",
      "accountEmailText",
      "accountEmailVerified",
      "accountEyebrow",
      "accountIntro",
      "accountLogout",
      "accountMobileHelp",
      "accountPasswordText",
      "accountProfile",
      "accountProfileText",
      "accountProfileUpdated",
      "accountSaveProfile",
      "accountSaveUsername",
      "accountSessionError",
      "accountSessionLoading",
      "accountTitle",
      "accountUsername",
      "accountUsernameHelp",
      "accountUsernameText",
      "accountUsernameUpdated",
      "accountVerifiedEmail",
      "accountVerifyEmail",
    ],
  ],
  auth: [
    ...sharedClientKeys,
    ...[
      "authAccountSideLabel",
      "authAccountSideText",
      "authAccountSideTitle",
      "authBackToLogin",
      "authHasAccount",
      "authLoginText",
      "authLoginTitle",
      "authLogoutSuccess",
      "authNoAccount",
      "authPasswordChanged",
      "authPasswordReset",
      "authRecoveryText",
      "authRecoveryTitle",
      "authRegisterText",
      "authRegisterTitle",
      "authResetPassword",
      "authSessionExpired",
    ],
  ],
  root: sharedClientKeys,
} as const;

type ClientMessageScope = keyof typeof clientKeys;
type ClientMessageKey<Scope extends ClientMessageScope> =
  (typeof clientKeys)[Scope][number];

// Nested providers replace messages. Keep each route's explicit key boundary.
export function selectClientMessages<
  Messages extends AbstractIntlMessages,
  Scope extends ClientMessageScope,
>(
  messages: Messages,
  scope: Scope,
): Pick<Messages, Extract<ClientMessageKey<Scope>, keyof Messages>> {
  const selected: Record<string, string> = {};
  for (const key of clientKeys[scope]) {
    const value = messages[key];
    if (typeof value !== "string")
      throw new Error(`Missing client translation string: ${key}`);
    selected[key] = value;
  }
  return selected as Pick<
    Messages,
    Extract<ClientMessageKey<Scope>, keyof Messages>
  >;
}

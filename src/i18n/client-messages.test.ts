import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { localeCodes } from "@/i18n/catalog-data/locales";

import { catalogs } from "./catalogs";
import { selectClientMessages } from "./client-messages";

const expectedKeys = {
  root: [
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
  ],
  auth: [
    "account",
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
  ],
  account: [
    "account",
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
  ],
} as const;

describe("route-scoped flat client translations", () => {
  it.each(localeCodes)(
    "keeps the explicit root/auth/account key boundaries for %s",
    async (locale) => {
      const messages = (await catalogs[locale]()).default;
      const root = selectClientMessages(messages, "root");
      const auth = selectClientMessages(messages, "auth");
      const account = selectClientMessages(messages, "account");
      for (const [scope, selected] of Object.entries({ root, auth, account })) {
        expect(Object.keys(selected).sort()).toEqual(
          expectedKeys[scope as keyof typeof expectedKeys],
        );
        for (const [key, value] of Object.entries(selected)) {
          expect(typeof value).toBe("string");
          expect(value).toBe(messages[key as keyof typeof messages]);
        }
        for (const key of [
          "homeTitle",
          "siteTheme",
          "metadataTitle",
          "globalErrorHeading",
        ])
          expect(selected).not.toHaveProperty(key);
      }
      expect(root).not.toHaveProperty("authLoginTitle");
      expect(root).not.toHaveProperty("accountTitle");
      expect(auth).not.toHaveProperty("accountEmailLabel");
      expect(account).not.toHaveProperty("authLoginTitle");

      const rootText = createTranslator({ locale, messages: root });
      const authText = createTranslator({ locale, messages: auth });
      const accountText = createTranslator({ locale, messages: account });
      expect(rootText("feedbackErrorTitle")).toBe(messages.feedbackErrorTitle);
      expect(rootText("retry")).toBe(messages.retry);
      expect(authText("authLoginTitle")).toBe(messages.authLoginTitle);
      expect(authText("password")).toBe(messages.password);
      expect(authText("authPasswordReset")).toBe(messages.authPasswordReset);
      expect(accountText("accountTitle", { name: "Ada" })).toContain("Ada");
      expect(accountText("accountLogout")).toBe(messages.accountLogout);
      expect(accountText("accountEmailLabel")).toBe(messages.accountEmailLabel);
    },
  );

  it("does not mutate catalogs and rejects missing or nested required messages", async () => {
    const messages = Object.freeze({ ...(await catalogs.en()).default });
    const keys = Object.keys(messages);
    selectClientMessages(messages, "auth");
    expect(Object.keys(messages)).toEqual(keys);
    const missingRoot = { ...messages };
    Reflect.deleteProperty(missingRoot, "retry");
    expect(() => selectClientMessages(missingRoot, "root")).toThrow(
      "Missing client translation string: retry",
    );
    expect(() =>
      selectClientMessages({ ...messages, retry: { text: "nested" } }, "root"),
    ).toThrow("Missing client translation string: retry");
    const missingAccount = { ...messages };
    Reflect.deleteProperty(missingAccount, "accountEmailLabel");
    expect(() => selectClientMessages(missingAccount, "account")).toThrow(
      "Missing client translation string: accountEmailLabel",
    );
  });
});

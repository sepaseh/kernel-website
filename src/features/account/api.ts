import { apiRequest } from "@/shared/api/client";
import type { OtpResponse } from "@/shared/contracts";

import type {
  Account,
  EmailVerificationRequest,
  EmailVerifyRequest,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  UsernameUpdateRequest,
} from "./types";
export const getAccount = (locale: string, signal?: AbortSignal) =>
  apiRequest<Account>("/account/me", locale, { signal });
export const updateProfile = (value: ProfileUpdateRequest, locale: string) =>
  apiRequest<Account>("/account/update-profile", locale, {
    method: "PATCH",
    body: JSON.stringify(value),
  });
export const updateUsername = (value: UsernameUpdateRequest, locale: string) =>
  apiRequest<Account>("/account/update-username", locale, {
    method: "POST",
    body: JSON.stringify(value),
  });
export const requestEmailCode = (
  value: EmailVerificationRequest,
  locale: string,
) =>
  apiRequest<OtpResponse>("/account/request-email-verification", locale, {
    method: "POST",
    body: JSON.stringify(value),
  });
export const verifyEmail = (value: EmailVerifyRequest, locale: string) =>
  apiRequest("/account/verify-email", locale, {
    method: "POST",
    body: JSON.stringify(value),
  });
export const changePassword = (value: PasswordChangeRequest, locale: string) =>
  apiRequest("/auth/change-password", locale, {
    method: "POST",
    body: JSON.stringify(value),
  });

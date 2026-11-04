import { apiRequest } from "@/shared/api/client";
import { AuthPaths, type OtpResponse } from "@/shared/contracts";

import type { ForgotPasswordRequest } from "./types";
export const resetPassword = (value: ForgotPasswordRequest, locale: string) =>
  apiRequest(AuthPaths.forgotPassword, locale, {
    method: "POST",
    body: JSON.stringify(value),
  });
export const requestRecoveryCode = (mobile: string, locale: string) =>
  apiRequest<OtpResponse>(AuthPaths.otpRequest, locale, {
    method: "POST",
    body: JSON.stringify({ mobile, purpose: "forgot_password" }),
  });

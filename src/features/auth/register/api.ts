import { apiRequest } from "@/shared/api/client";
import { AuthPaths, type OtpResponse } from "@/shared/contracts";

import type { RegisterRequest } from "./types";
export const register = (value: RegisterRequest, locale: string) =>
  apiRequest(AuthPaths.register, locale, {
    method: "POST",
    body: JSON.stringify(value),
  });
export const requestRegistrationCode = (mobile: string, locale: string) =>
  apiRequest<OtpResponse>(AuthPaths.otpRequest, locale, {
    method: "POST",
    body: JSON.stringify({ mobile, purpose: "register" }),
  });

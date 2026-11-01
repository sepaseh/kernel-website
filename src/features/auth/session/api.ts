import { apiRequest } from "@/shared/api/client";
import { type Account, AuthPaths } from "@/shared/contracts";
export const getAccount = (locale: string, signal?: AbortSignal) =>
  apiRequest<Account>("/account/me", locale, { signal });

export const logout = (locale: string) =>
  apiRequest(AuthPaths.logout, locale, {
    method: "POST",
    body: JSON.stringify({}),
  });

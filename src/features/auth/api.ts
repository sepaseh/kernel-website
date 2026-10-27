import { apiRequest } from "@/shared/api/client";
import { AuthPaths } from "@/shared/contracts";
export const logout = (locale: string) =>
  apiRequest(AuthPaths.logout, locale, {
    method: "POST",
    body: JSON.stringify({}),
  });

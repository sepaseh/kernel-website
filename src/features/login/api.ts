import { apiRequest } from "@/shared/api/client";
import { AuthPaths } from "@/shared/contracts";

import type { LoginRequest } from "./types";
export const login = (value: LoginRequest, locale: string) =>
  apiRequest(AuthPaths.login, locale, {
    method: "POST",
    body: JSON.stringify(value),
  });

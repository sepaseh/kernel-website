import "server-only";

import { headers } from "next/headers";

import { isCspNonce } from "./csp";

export async function getRequestNonce(): Promise<string | undefined> {
  const nonce = (await headers()).get("x-kernel-csp-nonce");
  // Unmatched asset/metadata fallbacks can render a 404 without document policy.
  return isCspNonce(nonce) ? nonce : undefined;
}

import "server-only";

import { headers } from "next/headers";

import { isCspNonce } from "./csp";

export async function getRequestNonce(): Promise<string | undefined> {
  const nonce = (await headers()).get("x-kernel-csp-nonce");
  // The proxy strips caller headers and supplies document nonces. Syntax alone
  // does not establish that trust; known non-HTML handlers receive no nonce.
  return isCspNonce(nonce) ? nonce : undefined;
}

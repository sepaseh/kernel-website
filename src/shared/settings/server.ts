import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { loadWebsiteLanguage } from "./language";

// React cache deduplicates this read only within a server render. A new request
// reads settings again, so an administrator's change never needs a rebuild.
export const getWebsiteLanguage = cache(async () => {
  await connection();
  return loadWebsiteLanguage();
});

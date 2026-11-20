import { apiRequest } from "@/shared/api/client";
import { PublicPaths } from "@/shared/contracts";

import type { ContactReceipt, ContactSubmission } from "./types";

export async function submitContact(
  value: ContactSubmission,
  key: string,
  locale: string,
): Promise<ContactReceipt> {
  const result = await apiRequest<unknown>(
    PublicPaths.contactMessages,
    locale,
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(value),
    },
  );
  if (!result || typeof result !== "object")
    throw new TypeError("Invalid receipt");
  const { id, created_at } = result as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id) ||
    typeof created_at !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(created_at) ||
    !Number.isFinite(Date.parse(created_at))
  )
    throw new TypeError("Invalid receipt");
  return { id, created_at };
}

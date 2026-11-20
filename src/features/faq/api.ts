import "server-only";

import { getApiBaseUrl } from "@/shared/api/origin";

import { faqMaxOffset, faqPageSize } from "./paths";
import type { Faq, FaqList } from "./types";

export class FaqApiError extends Error {
  readonly status = 503;
  constructor() {
    super("The FAQ service is unavailable.");
  }
}

const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FaqApiError();
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number) => {
  if (
    typeof value !== "string" ||
    !value.length ||
    value.length > max ||
    value.trim() !== value
  )
    throw new FaqApiError();
  return value;
};
const integer = (value: unknown, max = Number.MAX_SAFE_INTEGER) => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > max
  )
    throw new FaqApiError();
  return value;
};
function faq(value: unknown): Faq {
  const data = record(value);
  if (
    typeof data.id !== "string" ||
    !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(data.id)
  )
    throw new FaqApiError();
  return {
    id: data.id,
    question: text(data.question, 300),
    answer: text(data.answer, 5000),
    sort: integer(data.sort, 1_000_000),
  };
}

export async function loadFaqs(
  page = 1,
  size: 1 | 20 = faqPageSize,
): Promise<FaqList> {
  const offset = (page - 1) * faqPageSize;
  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > faqMaxOffset
  )
    throw new FaqApiError();
  const query = new URLSearchParams({
    offset: String(offset),
    size: String(size),
  });
  const response = await fetch(
    new URL(`/public/faqs?${query}`, getApiBaseUrl()),
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok || !response.body) throw new FaqApiError();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new FaqApiError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let position = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.byteLength;
  }
  const data = record(
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)),
  );
  const total = integer(data.total);
  if (
    !Array.isArray(data.items) ||
    data.items.length !== Math.min(size, Math.max(0, total - offset))
  )
    throw new FaqApiError();
  const items = data.items.map(faq);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new FaqApiError();
  for (let index = 1; index < items.length; index++) {
    const previous = items[index - 1];
    const current = items[index];
    if (
      previous.sort > current.sort ||
      (previous.sort === current.sort && previous.id > current.id)
    )
      throw new FaqApiError();
  }
  return { items, total };
}

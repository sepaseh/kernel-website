import "server-only";

import { getApiBaseUrl } from "@/shared/api/origin";
import { containsAsciiControl } from "@/shared/seo/config";

import { blogPageSize, isFileId, isPostCode } from "./paths";
import type {
  BlogArticle,
  BlogCategory,
  BlogImage,
  BlogList,
  BlogPost,
  BlogSitemapItem,
} from "./types";

export class BlogApiError extends Error {
  constructor(readonly status: number) {
    super("The article service is unavailable.");
  }
}
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BlogApiError(503);
  return value as Record<string, unknown>;
};
const text = (value: unknown) => {
  if (typeof value !== "string") throw new BlogApiError(503);
  return value;
};
const date = (value: unknown, required: boolean) => {
  if (value === undefined && !required) return undefined;
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new BlogApiError(503);
  return result;
};
const identifier = (value: unknown) => {
  const result = text(value);
  if (!isFileId(result)) throw new BlogApiError(503);
  return result;
};
const integer = (value: unknown) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new BlogApiError(503);
  return value;
};
const urlTitle = (value: unknown) => {
  const result = text(value);
  if (
    !result ||
    /[\\/\s?#]/u.test(result) ||
    containsAsciiControl(result, true)
  )
    throw new BlogApiError(503);
  return result;
};
const image = (value: unknown): BlogImage | undefined => {
  if (value === undefined) return undefined;
  const data = record(value);
  if (data.content_type !== "image/jpeg" && data.content_type !== "image/png")
    throw new BlogApiError(503);
  const dimension = (value: unknown) => {
    if (value === undefined) return undefined;
    const result = integer(value);
    if (!result) throw new BlogApiError(503);
    return result;
  };
  return {
    id: identifier(data.id),
    content_type: data.content_type,
    width: dimension(data.width),
    height: dimension(data.height),
  };
};
const parseCategory = (value: unknown): BlogCategory => {
  const data = record(value);
  return {
    id: identifier(data.id),
    name: text(data.name),
    description: text(data.description),
  };
};
function post(value: unknown, preview = false): BlogPost {
  const data = record(value);
  const id = integer(data.id);
  const titleSegment = urlTitle(data.url_title);
  const title = text(data.title);
  if (
    !isPostCode(String(id)) ||
    !Array.isArray(data.tags) ||
    (!preview && !title.trim())
  )
    throw new BlogApiError(503);
  return {
    id,
    title,
    excerpt: text(data.excerpt),
    url_title: titleSegment,
    cover_image: image(data.cover_image),
    category:
      data.category === undefined ? undefined : parseCategory(data.category),
    tags: data.tags.map((tag) => {
      const data = record(tag);
      return { id: identifier(data.id), name: text(data.name) };
    }),
    published_at: date(data.published_at, !preview),
    public_updated_at: date(data.public_updated_at, !preview),
  };
}
async function json(path: string, token?: string): Promise<unknown> {
  const response = await fetch(new URL(path, getApiBaseUrl()), {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "omit",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new BlogApiError(
      [401, 403, 404].includes(response.status) ? response.status : 503,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new BlogApiError(503);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new BlogApiError(503);
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  ) as unknown;
}
export async function loadPosts(
  page = 1,
  categoryId?: string,
): Promise<BlogList> {
  const query = new URLSearchParams({
    offset: String((page - 1) * blogPageSize),
    size: String(blogPageSize),
  });
  if (categoryId) query.set("category_id", categoryId);
  const data = record(await json(`/public/posts?${query}`));
  if (!Array.isArray(data.items) || data.items.length > blogPageSize)
    throw new BlogApiError(503);
  return {
    items: data.items.map((value) => post(value)),
    total: integer(data.total),
  };
}
export async function loadArticle(
  id: string,
  token?: string,
): Promise<BlogArticle> {
  if (!isPostCode(id)) throw new BlogApiError(404);
  const data = record(
    await json(`/public/posts/${id}${token ? "/preview" : ""}`, token),
  );
  const result = post(data, !!token);
  if (String(result.id) !== id) throw new BlogApiError(503);
  return { ...result, body: text(data.body) };
}
export async function loadCategory(id: string) {
  if (!isFileId(id)) throw new BlogApiError(404);
  const result = parseCategory(await json(`/public/categories/${id}`));
  if (result.id !== id) throw new BlogApiError(503);
  return result;
}
export async function loadBlogSitemap(): Promise<BlogSitemapItem[]> {
  const result: BlogSitemapItem[] = [];
  let total: number;
  do {
    const data = record(
      await json(`/public/posts/sitemap?offset=${result.length}&size=1000`),
    );
    total = integer(data.total);
    // The single sitemap reserves four URLs for home, contact, blog and FAQ. Fail clearly
    // rather than silently dropping articles when a sitemap index is needed.
    if (
      total > 49_996 ||
      !Array.isArray(data.items) ||
      data.items.length > 1000 ||
      (!data.items.length && result.length < total)
    )
      throw new BlogApiError(503);
    for (const item of data.items) {
      const entry = record(item);
      const id = integer(entry.id);
      const titleSegment = urlTitle(entry.url_title);
      if (!isPostCode(String(id))) throw new BlogApiError(503);
      result.push({
        id,
        url_title: titleSegment,
        public_updated_at: date(entry.public_updated_at, true)!,
      });
    }
  } while (result.length < total);
  if (
    result.length !== total ||
    new Set(result.map((item) => item.id)).size !== result.length
  )
    throw new BlogApiError(503);
  return result;
}

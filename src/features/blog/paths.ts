import type { BlogPost } from "./types";

export const blogPageSize = 12;
export const isPostCode = (value: string) => /^[1-9]\d{7}$/.test(value);
export const isFileId = (value: string) =>
  /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
export const articlePath = (post: Pick<BlogPost, "id" | "url_title">) =>
  `/${post.id}/${encodeURIComponent(post.url_title)}`;
export const mediaPath = (id: string) => `/media/${encodeURIComponent(id)}`;
export const previewCookieName = (id: string) => `kernel_blog_preview_${id}`;

export function archivePath(page = 1, categoryId?: string) {
  return `/blog${categoryId ? `/categories/${encodeURIComponent(categoryId)}` : ""}${page > 1 ? `/page/${page}` : ""}`;
}

export function parseArchivePath(path: string[] = []) {
  const parts = [...path];
  let categoryId: string | undefined;
  if (parts[0] === "categories") {
    if (!parts[1] || !isFileId(parts[1])) return undefined;
    categoryId = parts[1];
    parts.splice(0, 2);
  }
  let page = 1;
  if (parts.length) {
    if (
      parts.length !== 2 ||
      parts[0] !== "page" ||
      !/^[1-9]\d*$/.test(parts[1])
    )
      return undefined;
    page = Number(parts[1]);
    if (!Number.isSafeInteger(page * blogPageSize)) return undefined;
  }
  return { categoryId, page };
}

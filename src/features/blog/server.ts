import "server-only";

import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { BlogApiError, loadArticle, loadCategory, loadPosts } from "./api";
import {
  archivePath,
  articlePath,
  blogPageSize,
  isPostCode,
  parseArchivePath,
} from "./paths";

export const getArticle = cache(loadArticle);
const getCategory = cache(loadCategory);
const getPosts = cache(loadPosts);

export async function resolveArticle(id: string, title?: string) {
  if (!isPostCode(id)) notFound();
  let post;
  try {
    post = await getArticle(id);
  } catch (error) {
    if (error instanceof BlogApiError && error.status === 404) notFound();
    throw error;
  }
  if (title !== post.url_title) permanentRedirect(articlePath(post));
  return post;
}
export async function resolveArchive(path?: string[]) {
  const query = parseArchivePath(path);
  if (!query) notFound();
  const canonical = archivePath(query.page, query.categoryId);
  if (`/blog${path?.length ? `/${path.join("/")}` : ""}` !== canonical)
    permanentRedirect(canonical);
  let category;
  try {
    category = query.categoryId
      ? await getCategory(query.categoryId)
      : undefined;
  } catch (error) {
    if (error instanceof BlogApiError && error.status === 404) notFound();
    throw error;
  }
  const posts = await getPosts(query.page, query.categoryId);
  if (query.page > 1 && (query.page - 1) * blogPageSize >= posts.total)
    notFound();
  return { ...query, category, posts, path: canonical };
}

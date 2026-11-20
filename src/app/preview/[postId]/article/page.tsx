import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BlogApiError } from "@/features/blog/api";
import { Article } from "@/features/blog/Article";
import { isPostCode, previewCookieName } from "@/features/blog/paths";
import { getArticle } from "@/features/blog/server";

type Props = { params: Promise<{ postId: string }> };
export async function generateMetadata() {
  const t = await getTranslations();
  return {
    title: t("blogPreview"),
    robots: { index: false, follow: false },
    referrer: "no-referrer" as const,
  };
}
export default async function Page({ params }: Props) {
  const { postId } = await params;
  if (!isPostCode(postId)) notFound();
  const token = (await cookies()).get(previewCookieName(postId))?.value;
  if (!token) notFound();
  let post;
  try {
    post = await getArticle(postId, token);
  } catch (error) {
    if (error instanceof BlogApiError && [401, 403, 404].includes(error.status))
      notFound();
    throw error;
  }
  return <Article post={post} preview />;
}

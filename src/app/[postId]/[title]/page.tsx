import { Article } from "@/features/blog/Article";
import { articleMetadata } from "@/features/blog/seo";
import { resolveArticle } from "@/features/blog/server";

type Props = { params: Promise<{ postId: string; title: string }> };
export async function generateMetadata({ params }: Props) {
  const { postId, title } = await params;
  return articleMetadata(await resolveArticle(postId, title));
}
export default async function Page({ params }: Props) {
  const { postId, title } = await params;
  return <Article post={await resolveArticle(postId, title)} />;
}

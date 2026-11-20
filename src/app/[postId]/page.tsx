import { resolveArticle } from "@/features/blog/server";

type Props = { params: Promise<{ postId: string }> };
export default async function Page({ params }: Props) {
  await resolveArticle((await params).postId);
  return null;
}

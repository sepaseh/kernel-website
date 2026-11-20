import { getTranslations } from "next-intl/server";

import { Archive } from "@/features/blog/Archive";
import { resolveArchive } from "@/features/blog/server";
import { createPageMetadata } from "@/shared/seo/metadata";

type Props = { params: Promise<{ path?: string[] }> };
export async function generateMetadata({ params }: Props) {
  const [t, archive] = await Promise.all([
    getTranslations(),
    resolveArchive((await params).path),
  ]);
  return createPageMetadata({
    title: `${archive.category?.name ?? t("blog")} · Kernel`,
    description: archive.category?.description || t("blogIntro"),
    path: archive.path,
    index: archive.posts.total > 0,
  });
}
export default async function Page({ params }: Props) {
  return <Archive {...await resolveArchive((await params).path)} />;
}

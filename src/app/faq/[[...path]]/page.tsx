import { getTranslations } from "next-intl/server";

import { Faq } from "@/features/faq/Faq";
import { resolveFaq } from "@/features/faq/server";
import { createPageMetadata } from "@/shared/seo/metadata";

type Props = { params: Promise<{ path?: string[] }> };

export async function generateMetadata({ params }: Props) {
  const [t, result] = await Promise.all([
    getTranslations(),
    resolveFaq((await params).path),
  ]);
  return createPageMetadata({
    title: `${t("faq")}${result.page > 1 ? ` · ${t("faqPage", { page: result.page })}` : ""} · Kernel`,
    description: t("faqIntro"),
    path: result.path,
    index: result.faqs.total > 0,
  });
}

export default async function Page({ params }: Props) {
  return <Faq {...await resolveFaq((await params).path)} />;
}

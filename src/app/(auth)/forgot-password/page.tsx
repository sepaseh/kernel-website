import { getTranslations } from "next-intl/server";

import { Recovery } from "@/features/recovery";
export async function generateMetadata() {
  const t = await getTranslations();
  return {
    title: t("forgotPassword"),
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <Recovery />;
}

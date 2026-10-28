import { getTranslations } from "next-intl/server";

import { Register } from "@/features/register";
export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("register"), robots: { index: false, follow: false } };
}
export default function Page() {
  return <Register />;
}

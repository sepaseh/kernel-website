import { getTranslations } from "next-intl/server";

import { Login } from "@/features/login";
import { Feedback } from "@/shared/ui/Feedback";
export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("login"), robots: { index: false, follow: false } };
}
type Props = {
  searchParams: Promise<{
    reset?: string | string[];
    password?: string | string[];
  }>;
};

export default async function Page({ searchParams }: Props) {
  const t = await getTranslations();
  const { reset, password } = await searchParams;
  const notice =
    reset === "success"
      ? t("authPasswordReset")
      : password === "changed"
        ? t("authPasswordChanged")
        : undefined;
  return (
    <>
      {notice && (
        <div className="mb-6">
          <Feedback success={notice} />
        </div>
      )}
      <Login />
    </>
  );
}

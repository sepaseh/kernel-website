import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Preferences } from "@/website/shared/Preferences";
export async function Footer() {
  const t = await getTranslations();
  return (
    <footer className="site-container mt-auto border-t border-border py-9">
      <div className="flex flex-wrap items-start justify-between gap-7">
        <div>
          <Link href="/" className="text-2xl font-semibold tracking-[-0.06em]">
            kernel
          </Link>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {t("siteFooter")}
          </p>
        </div>
        <Preferences themeLabel={t("siteTheme")} />
      </div>
      <div className="mt-12 flex flex-wrap justify-between gap-3 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Kernel</span>
        <span>{t("siteBuilt")}</span>
      </div>
    </footer>
  );
}

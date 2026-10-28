import { Asterisk } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Preferences } from "@/website/shared/Preferences";

import { HeaderAccountLink } from "./HeaderAccountLink";

export async function Header() {
  const t = await getTranslations();
  return (
    <header className="site-container flex min-h-24 items-center justify-between gap-2 border-b border-border/80 sm:gap-3">
      <Link
        href="/"
        aria-label={`Kernel · ${t("home")}`}
        className="inline-flex shrink-0 items-center gap-1.5 text-2xl leading-none font-semibold tracking-[-0.07em] sm:text-[28px]"
      >
        kernel
        <Asterisk
          size={24}
          color="currentColor"
          className="hidden size-6 text-primary sm:block"
          strokeWidth={1.7}
          aria-hidden
        />
      </Link>
      <nav aria-label={t("home")} className="flex items-center gap-1 sm:gap-5">
        <Link
          href="/#foundation"
          className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
        >
          {t("siteFoundation")}
        </Link>
        <Preferences themeLabel={t("siteTheme")} />
        <HeaderAccountLink
          accountLabel={t("account")}
          loginLabel={t("login")}
        />
      </nav>
    </header>
  );
}

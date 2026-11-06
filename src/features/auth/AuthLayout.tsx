import { Asterisk } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
type Props = { children: ReactNode };
export const AuthLayout = ({ children }: Props) => {
  const t = useTranslations();
  return (
    <div className="site-container grid min-h-[calc(100svh-18rem)] gap-12 py-14 lg:grid-cols-2 lg:gap-24 lg:py-24">
      <aside className="hidden flex-col justify-between border-e border-border pe-12 lg:flex">
        <div>
          <p className="eyebrow mb-8">{t("authAccountSideLabel")}</p>
          <h2 className="max-w-xl text-5xl leading-[1.15] font-medium tracking-[-0.05em] whitespace-pre-line">
            {t("authAccountSideTitle")}
          </h2>
          <p className="mt-7 max-w-sm leading-relaxed text-muted-foreground">
            {t("authAccountSideText")}
          </p>
        </div>
        <Asterisk
          size={96}
          color="currentColor"
          className="mt-24 size-24 text-primary"
          strokeWidth={0.8}
          aria-hidden
        />
      </aside>
      <div className="mx-auto w-full max-w-md self-center">{children}</div>
    </div>
  );
};

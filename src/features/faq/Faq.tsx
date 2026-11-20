import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { faqMaxOffset, faqPageSize, faqPath } from "./paths";
import type { FaqList } from "./types";

type Props = { page: number; faqs: FaqList };

export async function Faq({ page, faqs }: Props) {
  const t = await getTranslations();
  return (
    <section className="site-container py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow mb-6 text-primary">Kernel</p>
        <h1 className="section-title">{t("faq")}</h1>
        <p className="mt-6 mb-12 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {t("faqIntro")}
        </p>
        {faqs.items.length ? (
          <div className="divide-y divide-border border-y border-border">
            {faqs.items.map((item) => (
              <details key={item.id} className="group py-1">
                <summary className="cursor-pointer rounded-lg py-6 pe-3 text-lg font-medium marker:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <span dir="auto" className="[overflow-wrap:anywhere]">
                    {item.question}
                  </span>
                </summary>
                <div
                  dir="auto"
                  className="pb-7 text-base leading-relaxed whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere] [unicode-bidi:plaintext]"
                >
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-8 text-muted-foreground">
            {t("faqEmpty")}
          </p>
        )}
        {faqs.total > faqPageSize && (
          <nav
            aria-label={t("faqPage", { page })}
            className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-7 text-sm"
          >
            <div>
              {page > 1 && (
                <Link
                  href={faqPath(page - 1)}
                  rel="prev"
                  className="font-medium text-primary hover:underline"
                >
                  {t("faqPrevious")}
                </Link>
              )}
            </div>
            <span className="text-muted-foreground">
              {t("faqPage", { page })}
            </span>
            <div>
              {page * faqPageSize <= faqMaxOffset &&
                page * faqPageSize < faqs.total && (
                  <Link
                    href={faqPath(page + 1)}
                    rel="next"
                    className="font-medium text-primary hover:underline"
                  >
                    {t("faqNext")}
                  </Link>
                )}
            </div>
          </nav>
        )}
      </div>
    </section>
  );
}

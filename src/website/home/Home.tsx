import {
  ArrowDown,
  ArrowUpRight,
  Asterisk,
  Check,
  Fingerprint,
  Layers3,
  MoveUpRight,
  PanelsTopLeft,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

import { Reveal } from "./Reveal";
export async function Home() {
  const t = await getTranslations();

  const features = [
    {
      key: "identity",
      Icon: Fingerprint,
      title: t("homeIdentityTitle"),
      text: t("homeIdentityText"),
    },
    {
      key: "interface",
      Icon: PanelsTopLeft,
      title: t("homeInterfaceTitle"),
      text: t("homeInterfaceText"),
    },
    {
      key: "boundary",
      Icon: Layers3,
      title: t("homeBoundaryTitle"),
      text: t("homeBoundaryText"),
    },
  ];
  return (
    <>
      <section className="site-container relative py-20 sm:py-28 lg:py-36">
        <div className="eyebrow mb-8 flex items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-primary" />
          {t("homeEyebrow")}
        </div>
        <h1 className="home-hero-title max-w-5xl text-[clamp(3.25rem,7.5vw,7.6rem)] leading-[1.08] font-medium tracking-[-0.065em] text-balance">
          {t("homeTitle")}
          <br />
          <span className="text-primary">{t("homeTitleAccent")}</span>
        </h1>
        <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-2 lg:items-end">
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t("homeIntro")}
          </p>
          <div className="flex flex-wrap items-center gap-5 lg:justify-self-end">
            <Button
              size="lg"
              className="h-13 gap-4 rounded-full px-6 text-base"
              asChild
            >
              <Link href="/register">
                {t("register")}
                <ArrowUpRight
                  size={20}
                  color="currentColor"
                  className="size-5 rtl:-rotate-90"
                  aria-hidden
                />
              </Link>
            </Button>
            <Link
              href="/#foundation"
              className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
            >
              {t("homeExplore")}
              <ArrowDown
                size={16}
                color="currentColor"
                className="size-4"
                aria-hidden
              />
            </Link>
          </div>
        </div>
        <div className="mt-20 flex items-center justify-between gap-6 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>{t("homeNote")}</p>
          <Asterisk
            size={28}
            color="currentColor"
            className="size-7 shrink-0 text-primary"
            strokeWidth={1.25}
            aria-hidden
          />
        </div>
      </section>
      <section
        id="foundation"
        className="border-y border-border bg-muted/30 py-20 sm:py-28"
      >
        <div className="site-container">
          <Reveal className="grid gap-7 lg:grid-cols-[1fr_2fr]">
            <p className="eyebrow">{t("homeSectionLabel")}</p>
            <div>
              <h2 className="section-title whitespace-pre-line">
                {t("homeSectionTitle")}
              </h2>
              <p className="mt-7 max-w-xl leading-relaxed text-muted-foreground">
                {t("homeSectionText")}
              </p>
            </div>
          </Reveal>
          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {features.map(({ key, Icon, title, text }, index) => (
              <Reveal
                key={key}
                className="flex flex-col bg-background p-7 sm:p-9"
                delay={index * 0.07}
              >
                <Icon
                  size={28}
                  color="currentColor"
                  className="mb-16 size-7 text-primary"
                  strokeWidth={1.4}
                  aria-hidden
                />
                <h3 className="max-w-xs text-xl leading-snug font-medium tracking-tight">
                  {title}
                </h3>
                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section className="site-container grid gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-24">
        <Reveal>
          <p className="eyebrow mb-8">{t("homeDetailLabel")}</p>
          <h2 className="section-title whitespace-pre-line">
            {t("homeDetailTitle")}
          </h2>
        </Reveal>
        <Reveal className="lg:pt-12">
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            {t("homeDetailText")}
          </p>
          <ul className="mt-9 divide-y divide-border">
            {[
              "homeDetailOne",
              "homeDetailTwo",
              "homeDetailThree",
              "homeDetailFour",
            ].map((key) => (
              <li key={key} className="flex items-center gap-4 py-5 text-sm">
                <Check
                  size={16}
                  color="currentColor"
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                {t(key)}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>
      <section className="site-container mb-20 sm:mb-28">
        <Reveal className="relative overflow-hidden rounded-[1.5rem] bg-primary p-7 text-primary-foreground sm:p-14 lg:p-20">
          <p className="eyebrow mb-9 text-primary-foreground/70">
            {t("homeCtaLabel")}
          </p>
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <h2 className="section-title max-w-xl whitespace-pre-line">
              {t("homeCtaTitle")}
            </h2>
            <div>
              <p className="max-w-sm leading-relaxed text-primary-foreground/75">
                {t("homeCtaText")}
              </p>
              <Button
                variant="outline"
                size="lg"
                className="mt-8 h-12 gap-5 rounded-full border-current bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                asChild
              >
                <Link href="/register">
                  {t("register")}
                  <MoveUpRight
                    size={16}
                    color="currentColor"
                    className="size-4 rtl:-rotate-90"
                    aria-hidden
                  />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

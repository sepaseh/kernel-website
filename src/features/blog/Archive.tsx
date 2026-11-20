import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getWebsiteLanguage } from "@/shared/settings/server";

import { archivePath, articlePath, blogPageSize, mediaPath } from "./paths";
import type { BlogCategory, BlogList } from "./types";

type Props = { category?: BlogCategory; page: number; posts: BlogList };
export async function Archive({ category, page, posts }: Props) {
  const [t, { code, calendar }] = await Promise.all([
    getTranslations(),
    getWebsiteLanguage(),
  ]);
  return (
    <section className="site-container py-16 sm:py-24">
      <header className="mb-14 max-w-3xl">
        <p className="eyebrow mb-5 text-primary">{t("blog")}</p>
        <h1 dir="auto" className="section-title">
          {category?.name ?? t("blog")}
        </h1>
        <p
          dir="auto"
          className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          {category?.description || t("blogIntro")}
        </p>
        {category && (
          <Link
            href="/blog"
            className="mt-6 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("blog")}
          </Link>
        )}
      </header>
      {posts.items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-muted-foreground">
          {t("blogEmpty")}
        </p>
      ) : (
        <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((post) => (
            <article key={post.id} className="flex flex-col">
              {post.cover_image && (
                <Link
                  href={articlePath(post)}
                  tabIndex={-1}
                  aria-hidden
                  className="mb-6 block overflow-hidden rounded-xl border border-border"
                >
                  <img
                    src={mediaPath(post.cover_image.id)}
                    alt=""
                    width={post.cover_image.width}
                    height={post.cover_image.height}
                    loading="lazy"
                    className="aspect-[1.9] w-full object-cover transition-transform duration-300 hover:scale-[1.03] motion-reduce:transform-none"
                  />
                </Link>
              )}
              {post.category && (
                <Link
                  href={archivePath(1, post.category.id)}
                  className="mb-3 text-xs font-medium text-primary hover:underline"
                >
                  <bdi>{post.category.name}</bdi>
                </Link>
              )}
              <h2
                dir="auto"
                className="text-2xl leading-snug font-medium tracking-tight"
              >
                <Link
                  href={articlePath(post)}
                  className="underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>
              </h2>
              <p
                dir="auto"
                className="mt-4 line-clamp-3 leading-relaxed text-muted-foreground"
              >
                {post.excerpt}
              </p>
              <div className="mt-auto flex items-center justify-between gap-4 pt-6 text-sm">
                {post.published_at && (
                  <time
                    dateTime={post.published_at}
                    className="text-muted-foreground"
                  >
                    {new Intl.DateTimeFormat(code, {
                      calendar: calendar === "jalali" ? "persian" : "gregory",
                      dateStyle: "medium",
                    }).format(new Date(post.published_at))}
                  </time>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {posts.total > blogPageSize && (
        <nav
          aria-label={t("blogPage", { page })}
          className="mt-16 flex items-center justify-between gap-4 border-t border-border pt-7 text-sm"
        >
          <div>
            {page > 1 && (
              <Link
                rel="prev"
                href={archivePath(page - 1, category?.id)}
                className="font-medium text-primary hover:underline"
              >
                {t("blogPrevious")}
              </Link>
            )}
          </div>
          <span className="text-muted-foreground">
            {t("blogPage", { page })}
          </span>
          <div>
            {page * blogPageSize < posts.total && (
              <Link
                rel="next"
                href={archivePath(page + 1, category?.id)}
                className="font-medium text-primary hover:underline"
              >
                {t("blogNext")}
              </Link>
            )}
          </div>
        </nav>
      )}
    </section>
  );
}

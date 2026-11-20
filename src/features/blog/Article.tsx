import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getRequestNonce } from "@/shared/security/nonce";
import { serializeJsonLd } from "@/shared/seo/structured-data";
import { getWebsiteLanguage } from "@/shared/settings/server";

import { sanitizeArticleHtml } from "./content";
import { archivePath, mediaPath } from "./paths";
import { articleBreadcrumbJsonLd, articleJsonLd } from "./seo";
import type { BlogArticle } from "./types";

type Props = { post: BlogArticle; preview?: boolean };
export async function Article({ post, preview = false }: Props) {
  const [t, { code, calendar }, nonce] = await Promise.all([
    getTranslations(),
    getWebsiteLanguage(),
    getRequestNonce(),
  ]);
  const data = preview ? undefined : articleJsonLd(post, code);
  const breadcrumb = preview
    ? undefined
    : articleBreadcrumbJsonLd(post, { home: t("home"), blog: t("blog") });
  const format = (value: string) =>
    new Intl.DateTimeFormat(code, {
      dateStyle: "long",
      calendar: calendar === "jalali" ? "persian" : "gregory",
    }).format(new Date(value));
  return (
    <article className="site-container py-12 sm:py-20">
      {data && (
        <script
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd([data, breadcrumb]),
          }}
        />
      )}
      {preview && (
        <aside
          role="status"
          className="mb-8 rounded-xl border border-border bg-muted px-5 py-4"
        >
          <p className="font-medium">{t("blogPreview")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("blogPreviewText")}
          </p>
        </aside>
      )}
      <nav
        aria-label={t("blog")}
        className="mb-10 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap gap-x-3 gap-y-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              {t("home")}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/blog" className="hover:text-foreground">
              {t("blog")}
            </Link>
          </li>
          {post.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link
                  href={archivePath(1, post.category.id)}
                  className="hover:text-foreground"
                >
                  <bdi>{post.category.name}</bdi>
                </Link>
              </li>
            </>
          )}
        </ol>
      </nav>
      <header className="mx-auto max-w-3xl">
        <h1
          dir="auto"
          className="text-[clamp(2.2rem,5vw,4.5rem)] leading-tight font-medium tracking-tight text-balance"
        >
          {preview && !post.title.trim() ? t("blogPreview") : post.title}
        </h1>
        {post.excerpt && (
          <p
            dir="auto"
            className="mt-7 text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            {post.excerpt}
          </p>
        )}
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {post.published_at && (
            <p>
              <time dateTime={post.published_at}>
                {format(post.published_at)}
              </time>
            </p>
          )}
          {post.public_updated_at &&
            post.public_updated_at !== post.published_at && (
              <p>
                {t("blogUpdated")}{" "}
                <time dateTime={post.public_updated_at}>
                  {format(post.public_updated_at)}
                </time>
              </p>
            )}
        </div>
      </header>
      {post.cover_image && (
        <figure className="mx-auto my-10 max-w-5xl overflow-hidden rounded-2xl border border-border">
          <img
            src={mediaPath(post.cover_image.id)}
            width={post.cover_image.width}
            height={post.cover_image.height}
            alt={post.title}
            className="h-auto w-full"
            fetchPriority="high"
          />
        </figure>
      )}
      <div
        dir="auto"
        className="blog-prose mx-auto mt-12 max-w-3xl"
        dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(post.body) }}
      />
      {post.tags.length > 0 && (
        <ul className="mx-auto mt-12 flex max-w-3xl flex-wrap gap-2 border-t border-border pt-7">
          {post.tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-full bg-muted px-3 py-1 text-sm"
            >
              <bdi>{tag.name}</bdi>
            </li>
          ))}
        </ul>
      )}
      <div className="mx-auto mt-12 max-w-3xl border-t border-border pt-8">
        <Link
          href="/blog"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("blog")}
        </Link>
      </div>
    </article>
  );
}

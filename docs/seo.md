# Prepare website metadata and indexing

The [published application](bootstrap.md) integrates origin validation,
page metadata, JSON-LD, sitemap and social-image owners. Production indexing and
deployment remain separately authorized operations.

The SEO owners validate the website origin, create page
metadata and serialize structured data. The App Router consumes those helpers for
the home page, robots, sitemap and social image. Use this guide when changing
public content or indexing policy; [server boundaries](server-boundary.md) owns
request security and the `X-Robots-Tag` response policy.

## Configuration and privacy

`WEBSITE_URL` is the explicit public origin for canonical and share URLs.
`readSeoConfig` rejects credentials, a non-root path, query, fragment,
whitespace and control characters. It accepts an optional trailing root slash
and permits HTTP only on loopback with indexing disabled. `API_BASE_URL` selects
the server-to-server API origin. A visitor Host header never selects the website origin.
[Configuration owner](../src/shared/seo/config.ts).

`WEBSITE_INDEXING_ENABLED` accepts only literal `true` or `false`; absent means
false. Values such as `1`, `TRUE` and the empty string fail. With indexing
disabled, an absent/empty website URL omits URL-bearing canonical/structured
metadata. Requested indexing requires a non-loopback HTTPS origin and becomes
active only with `NODE_ENV=production`. Production mode alone never enables it.
Keep local, preview and staging environments non-indexed.

Use explicit synthetic settings in tests; do not inspect real dotenv files or
credentials. The helpers need no `NEXT_PUBLIC_*` configuration. Operator loading,
restart and an authorized production indexing change belong to
[deployment](deployment.md).

Noindex controls search inclusion, not confidentiality. Authentication and API
authorization protect private content. Crawlers need access to a page to see its
noindex instruction; inspect both returned HTML and response headers rather than
treating robots.txt as access control.

## Page and language contracts

[The root layout](../src/app/layout.tsx) supplies translated defaults and noindex
for routes that have not explicitly selected public metadata.
[The home page](../src/app/page.tsx) calls
[createPageMetadata](../src/shared/seo/metadata.ts) with its own title,
description and `path:"/"`.

The helper normalizes a trailing path slash and rejects schemes, queries,
fragments, traversal and encoded separators/control characters. It returns an
absolute title, page canonical when configured, robots and Open Graph/Twitter
metadata. `index:false` cannot be overridden by the global indexing flag.
When an origin exists, share metadata points to the
[1200×630 social-image route](../src/app/social-image/route.tsx).

The current public content page is `/`. Login, registration, recovery, account
and error pages stay noindex and outside the sitemap. A new public page needs its
own canonical path; assigning `/` globally misidentifies distinct pages.
Tracking queries and fragments are not separate pages. Internal links, redirects,
canonicals and sitemap entries must identify the same public destination.

The API selects the sole active language and exact direction.
[Localization](localization.md) owns all ten complete flat catalogs and explicit
message scopes. The permanent `/en` and `/fa` aliases in
[next.config.ts](../next.config.ts) redirect to unprefixed destinations while
preserving queries. They are not separate language versions and are not advertised
through sitemap or hreflang. Concurrent language-specific URLs need an explicit
language/cache/metadata design change.

[robots.ts](../src/app/robots.ts) allows page retrieval and disallows `/api/`.
It advertises the sitemap only while indexing is enabled.
[sitemap.ts](../src/app/sitemap.ts) returns an empty set while indexing is
disabled and only the public home URL when enabled. Neither uses a request-time
timestamp as `lastModified`.

`createWebsiteJsonLd` builds a `WebSite` object from the actual name,
description, language and configured origin. It returns no object without an
origin. `serializeJsonLd` escapes every `<` and rejects undefined
serialization. [Structured data tests](../src/shared/seo/structured-data.test.ts).

## Add or change public content

1. Define the audience and useful content, then place the route in `src/app`
   with presentation in its semantic feature owner. Keep unpublished/personal
   data out of shared caches.
2. Use the page's own canonical path and complete catalog keys. The current home
   metadata provides the pattern:

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return createPageMetadata({
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    path: "/",
  });
}
```

Include `lastModified` only when the actual content change time is known.

Render serialized JSON-LD with the trusted document nonce. Publish real social
media at stable public URLs with descriptive alternatives and correct
dimensions. Use factual structured data for visible content.
[Document CSP](website-csp.md).

On the executed revision, inspect initial HTML and response headers for the
canonical and robots values. Check the actual status for missing content,
including when streaming is enabled. Verify the social image response and
parsed JSON-LD, including with a crawler user agent and JavaScript disabled.

## Verify the change and launch separately

Config, metadata and structured-data tests live beside their
owners. [Browser SEO cases](../e2e/website/seo.spec.ts)
exercise runtime configuration, initial HTML, language/direction, metadata,
redirects, robots/sitemap, missing-document statuses and unavailable settings
using the [local synthetic HTTP fixture](api-fixture.md). Run the complete
publication procedure in [validation](validation.md); source and helper passes
do not claim that a browser or public domain was checked.

For the executed revision, inspect the returned canonical, status, HTML and
`X-Robots-Tag`, social-image response and parsed JSON-LD. Also review headings,
links, keyboard behavior, contrast, mobile/reduced-motion states and measured
[performance](website-performance.md). [Accessibility](accessibility.md) has its
own checks. Complete metadata or a lab score does not guarantee ranking or
enhanced search display.

DNS, Search Console verification, sitemap submission and production indexing
changes require separate authorization. After an approved launch, use the
provider's verification value and submit the matching-origin sitemap. Inspect
live public responses and monitor indexing, canonical selection and crawl
failures. Plan redirects and migration when the domain, URL structure or
language policy changes.

Reference material: [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing),
[canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[language-specific sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
and [structured-data policy](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

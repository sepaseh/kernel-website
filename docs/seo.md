# Prepare website metadata and indexing

The [features phase](bootstrap.md) publishes helpers for origin validation,
page metadata and JSON-LD. Rendering metadata, serving a sitemap or social
image, and enabling indexing depend on later application and deployment work.

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

Noindex controls search inclusion. Protect private content with authentication
and API authorization. Crawlers need access to a page to see its noindex
instruction.

## Check page metadata and structured data

Pass a localized title and description with the page's own absolute pathname
to `createPageMetadata`. The helper rejects unsafe pathnames and removes a
trailing slash from non-root paths. With a configured origin, it supplies a
self-canonical URL and refers to `/social-image` in social metadata. Setting
`index: false` overrides enabled site-wide indexing for the page. Without an
origin, URL-bearing metadata is omitted. [Metadata tests](../src/shared/seo/metadata.test.ts).

`createWebsiteJsonLd` builds a `WebSite` object from the actual name,
description, language and configured origin. It returns no object without an
origin. `serializeJsonLd` escapes every `<` and rejects undefined
serialization. [Structured data tests](../src/shared/seo/structured-data.test.ts).

## Verify a later application integration

When page composition is published, keep authentication, account and error
pages noindex and outside the sitemap. Give each indexable page its own
canonical path. Internal links, redirects and sitemap entries should identify
the same destination. Include `lastModified` only when the actual content
change time is known.

Render serialized JSON-LD with the trusted document nonce. Publish real social
media at stable public URLs with descriptive alternatives and correct
dimensions. Use factual structured data for visible content.
[Document CSP](website-csp.md).

On the executed revision, inspect initial HTML and response headers for the
canonical and robots values. Check the actual status for missing content,
including when streaming is enabled. Verify the social image response and
parsed JSON-LD, including with a crawler user agent and JavaScript disabled.

## Verify launch separately

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

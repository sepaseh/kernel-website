# SEO support and application acceptance

[English](seo.md) · [فارسی](seo.fa.md)

The [SEO helpers](../src/shared/seo) own origin validation, page metadata and safe
structured-data serialization. The [publication marker](../.github/bootstrap-policy.json)
identifies the actual delivered scope. With `applicationReady:false`, helper
tests and authored browser cases do not establish rendered metadata, robots,
sitemap, social-image responses or an indexed website. The
[application contract](application.md) requires real route/HTML/browser evidence
before runnable acceptance. This guide does not record a domain verification,
Search Console inspection, sitemap submission or production indexing change.

## Configuration and privacy

`API_BASE_URL` identifies the server-to-server API connection. `WEBSITE_URL`
identifies the public website origin for canonical and share URLs; do not infer
it from an incoming Host header or substitute the API origin. `readSeoConfig`
accepts a complete HTTP(S) origin without credentials, a non-root path, query,
fragment, whitespace or control characters. An optional trailing root slash is
accepted. HTTP is permitted only for loopback with indexing disabled.

`WEBSITE_INDEXING_ENABLED` accepts only literal `true` or `false`; absent means
false. Values such as `1`, `TRUE` and the empty string fail. An absent/empty
website URL is allowed while disabled, omitting URL-bearing canonical/structured
metadata. Requested indexing requires a non-loopback HTTPS origin and becomes
active only with `NODE_ENV=production`. Production mode alone never enables it.
Local or public preview/staging environments keep indexing disabled. Apply a
reviewed production change only after domain, content, access and deployment
acceptance; publishing this guide grants no such operational authorization.

Use explicitly supplied synthetic configuration in tests. Do not inspect or
modify real dotenv or credentials to verify SEO. Deployment configuration,
loading and restart behavior belong to the actual runtime and
[delivery contract](deployment.md); the pure helper does not load a file or
restart a service. No `NEXT_PUBLIC_*` value is needed by these server helpers.

Noindex controls search inclusion, not confidentiality. Authentication and API
authorization must protect private content. Robots controls crawling; blocking
retrieval can prevent a crawler from seeing noindex. Application acceptance must
inspect both HTML metadata and response headers, including any edge
`X-Robots-Tag`, rather than assuming the helper result is the delivered response.

## Page and language contracts

`createPageMetadata` takes a full title, description, absolute pathname and optional
`index:false`. It normalizes a trailing path slash and rejects schemes, query,
fragment, traversal and encoded separators/control characters. It returns an
absolute title, matching page canonical when configured, robots and share
metadata. `index:false` cannot be overridden by the global flag. The helper
describes `/social-image` at 1200×630 when an origin exists; it does not implement
that route or prove the response is available.

The accepted initial application has `/` as its public content page. Login,
registration, recovery, account and error pages stay noindex and outside the
sitemap. A new public page needs its own canonical pathname; assigning `/` in
the root layout to every page misidentifies distinct content. Tracking queries
and fragments are not independent pages. Internal links, redirects, canonical
metadata and sitemap entries must identify the same public destination.

The independent API selects the sole active language and exact direction. All
ten [flat local catalogs](localization.md) remain complete; website copy and
metadata use the selected catalog without visitor negotiation. The accepted
unprefixed URL design treats `/en` and `/fa` as permanent legacy aliases,
preserving queries, rather than separate indexable language versions. Do not
advertise them through sitemap or hreflang. Concurrent language-specific URLs
would require a new language/cache/metadata decision.

Root/request integration must verify actual initial HTML, lang/dir, canonical,
metadata, redirects and status, including JavaScript-disabled rendering and a
crawler user agent. A rendered missing-page component or noindex tag alone does
not prove a 404 status after streaming begins. Do not turn every missing/error
page into a successful home response. Consult the installed Next.js documentation
and design response boundaries before claiming required 404/410 semantics.

## Adding public content

Define a useful page and its real audience/content first. Place the route in the
application inventory and presentation with its semantic feature owner. Use
`createPageMetadata` with that page's own path and complete flat catalog keys in
every language. Do not copy the older nested `Metadata` namespace example or
invent an unregistered standalone translation command.

Fetch public API content through the server boundary and keep unpublished or
personal data out of shared caches. Missing/unpublished content, metadata,
sitemap, preview and unpublishing must agree. Hiding a link is not draft access
control. Add discoverable internal links and only public canonical sitemap URLs.
Use a real meaningful content-change timestamp for `lastModified`; omit it when
no such source exists rather than generating a new time on every request.

The accepted initial robots policy allows page retrieval to observe noindex and
excludes `/api/`; the initial sitemap is empty while indexing is disabled and
contains only the public home when enabled. These are application requirements,
not executed outputs of this prerequisite. Recheck them when routes change.

`createWebsiteJsonLd` supplies simple `WebSite` data from the actual name,
description, active language and configured origin. It returns no object without
an origin. `serializeJsonLd` escapes every `<` after JSON serialization and rejects
non-serializable undefined output. Preserve that safe output and the trusted
request nonce when the application renders it. Do not invent contact details,
reviews, ratings, authors, dates or SearchAction for nonexistent content/features.
Valid structured data does not establish enhanced search display or ranking.

Provide actual media with stable public URLs, descriptive alternatives, explicit
dimensions and appropriate formats. Keep private assets private. A brand share
card is not proof of a real product image or logo. If video becomes primary
content, supply a real visible page, retrievable thumbnail, accurate title,
description and publication/duration information, plus usable captions/text.
Decorative video does not establish a separate watch page.

## Verification and launch evidence

Select checks from the [canonical manifest](../.agents/validation.json) and
[Contributing](../CONTRIBUTING.md). Existing config/metadata/structured-data owner
tests verify actual helper behavior with synthetic inputs. Authored SEO browser
cases still require the exact runnable inventory, a real verified production
build and the [pinned synthetic API](api-fixture.md). Application activation
retains every helper test and all fifteen checks plus protected build/e2e/visual
jobs. Do not substitute an old report, source inspection or an invented command.

Record source/build, settings, versions, initial HTML and status, canonical,
robots/sitemap, noindex on private/error states, social-image response and parsed
JSON-LD. Test unavailable settings and safe failures. Assess meaningful headings,
usable links, keyboard behavior, contrast, mobile/reduced-motion states and
measured [performance](website-performance.md); complete metadata or a lab score
does not guarantee ranking. [Accessibility](accessibility.md) has its own evidence.

Search Console and DNS changes require a separately authorized domain owner.
After an approved launch, verify ownership using the provider's actual value,
submit the matching-origin sitemap and inspect the actual public response.
Monitor indexing, canonical selection, crawl failures and field metrics when
data exists. Submission is not a guarantee of indexing and changes are not
instant. Domain, URL or language-policy changes need a migration/redirect plan.
Useful product content, genuine identity/contact information, approved media and
ongoing monitoring remain product/operator responsibilities.

Reference material: [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing),
[canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls),
[language-specific sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
and [structured-data policy](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).

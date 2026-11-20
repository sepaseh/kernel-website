# Public blog and private preview

The website renders published articles and private previews from a compatible HTTP
API. The API owns persistence, publication, uploads and authorization. The
[synthetic HTTP fixture](api-fixture.md#feature-data-and-test-operations)
implements the contract below for local testing.

## Public routes and wire contract

| Website route                                               | Behavior                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `/blog` and `/blog/page/:page`                              | Twelve published cards per page with native article and previous/next links.                  |
| `/blog/categories/:categoryId` and its `/page/:page` suffix | Flat category archive; category IDs use the API's UUID convention.                            |
| `/:postId`                                                  | Look up only the eight-digit public code, then permanently redirect to the current full URL.  |
| `/:postId/:title`                                           | Render the matching published title segment, or permanently redirect an incorrect/old suffix. |
| `/media/:fileId`                                            | Anonymous, bounded same-origin JPEG/PNG delivery from the API.                                |

The server-only [reader](../src/features/blog/api.ts) uses `GET /public/posts?offset=0&size=12&category_id=...`, `GET /public/posts/:id`, `GET /public/categories/:id`, and paginated `GET /public/posts/sitemap?offset=0&size=1000`. Lists return `{items,total}`; detail adds the sanitized HTML `body`. Pure local [types](../src/features/blog/types.ts) describe only consumed fields.

Public post data includes numeric `id`, `title`, effective `excerpt`, `url_title`, optional `cover_image`/`category`, `tags`, and actual `published_at`/`public_updated_at`. Images are identified by file ID and trusted type/dimensions; arbitrary upstream URL fields are ignored. Category and tag labels are shared data, not public author identities.

Public reads omit cookies and authorization, reject redirects, use no-store and a fifteen-second timeout, bound JSON to 2 MiB, and validate successful responses. Missing/unpublished detail returns 404 before any title redirect. API outages remain errors rather than false article 404s or successful empty sitemaps. Preview alone sends its scoped bearer capability.

There are no public tag archives, author profiles, article versions, per-post SEO overrides, or database/storage implementation imports. Empty first archives remain useful UI; empty archives are noindex. Invalid and out-of-range pagination returns 404. Explicit first-page suffixes redirect to the base archive.

## HTML, media, and security

[Content rendering](../src/features/blog/content.ts) applies a server-only sanitize-html allowlist in addition to API validation. It retains recognized Quill text/list/direction classes, removes arbitrary scripts/styles/iframes/attributes, and rewrites images only when they carry a valid `data-file-id`. Those images use the same-origin media route; foreign image URLs cannot expand CSP.

Article/card titles and excerpts, and each rich-text block, use native automatic text direction so mixed Persian/English content does not inherit the shell's reading order. Explicit editor directions remain authoritative; category/tag names are isolated from surrounding navigation. This changes no API-selected website language or direction.

The [media adapter](../src/features/blog/media.ts) fetches only the configured API's `/files/:id/content`, forwards no visitor credentials, rejects redirects and non-JPEG/PNG responses, checks signatures, and bounds bytes to 20 MiB. It returns no upstream cookies or redirect headers. The API remains responsible for actual image decoding, references, file context, and processing policy. Media is outside `/api` so robots.txt does not block image crawling.

Article images and the cover use derived or content-owned alternatives. Article metadata and cover alt derive from the published title; no independent cover alt/title inputs exist. The editor is never delivered to public readers.

Keep dynamic HTML private/no-store with fresh trusted CSP nonces. React cache deduplicates reads within a server render, not across visitors. Media also uses private/no-store; this route does not promise removal of external cached copies after API cleanup. [CSP](website-csp.md) and [server boundaries](server-boundary.md).

## Metadata and discovery

[Article SEO](../src/features/blog/seo.ts) derives canonical URLs, descriptions, article OG/Twitter metadata, factual BlogPosting and visible-hierarchy BreadcrumbList. Canonicals use explicit `WEBSITE_URL`; a caller's title never chooses a resource or origin. No author is fabricated. JSON-LD uses the existing escaping serializer and document nonce.

Each archive page self-canonicalizes. With indexing enabled, the sitemap lists
the blog and each current public article when publications exist. Category
archives are discoverable from article and category links. [Sitemap limits and indexing](seo.md#page-and-language-contracts)

The existing global language/direction/calendar and indexing settings apply. Article dates use the API calendar explicitly rather than deriving it from the language. There is no visitor language negotiation or article-level indexing switch. Nine server-rendered blog labels extend all ten flat catalogs without broadening client message scopes. [Localization](localization.md), [SEO](seo.md).

## Authorized preview

For local verification, sign in as a fixture administrator and issue
`POST /posts/:id/preview-token`. A compatible backend needs to issue a
short-lived capability scoped to the post under `posts.read`. The URL uses this
capability in place of the administrator's bearer credential.

Open `/preview/:id?token=...`. The [preview exchange](../src/features/blog/preview.ts)
validates the capability through `GET /public/posts/:id/preview`. On success it
sets a five-minute HttpOnly, SameSite=Lax cookie restricted to
`/preview/:id/article` and sends a 303 redirect to that URL. The cookie uses
Secure when the request or configured website origin uses HTTPS. The exchange
sets private/no-store, no-referrer and noindex/nofollow headers.

The clean [preview page](../src/app/preview/[postId]/article/page.tsx) rereads the API with the capability on each request. API expiry, live session, and permission checks remain authoritative. It renders the current saved working payload with a clear notice, noindex/nofollow, no JSON-LD, and private/no-store behavior. It is not tied to a revision or a guarantee that a later Save has not changed the payload.

## Verify changes

Focused tests live beside the reader, render, media and preview source.
The [blog browser suite](../e2e/website/blog.spec.ts) checks native pagination
without JavaScript, canonical redirects, actual 404 responses, RTL and preview
revocation after logout. It also exercises publication and withdrawal using the
fixture.

Run affected tests, then the canonical checks. Build, CSP/browser and visual evidence must use the real website with this repository's disposable responder. Header navigation changes require actual visual review; historical baselines alone are not new visual acceptance. [Validation](validation.md).

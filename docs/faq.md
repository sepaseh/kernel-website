# Publish frequently asked questions

`/faq` renders twenty active FAQs per page with native disclosures and previous/
next links. Questions and answers are escaped plain text; answers preserve internal
line breaks. Each content block determines its own text direction and wraps long
unbroken input. Expansion, keyboard activation and pagination work without
JavaScript. The feature introduces no client component or browser dependency.

## Provide the public FAQ list

The server-only [FAQ reader](../src/features/faq/api.ts) calls `GET /public/faqs`.
Page requests start at `offset=0&size=20`. The sitemap uses `offset=0&size=1` to
check for active items. The reader consumes UUID `id`,
trimmed `question` of 1–300 UTF-16 code units, trimmed `answer` of 1–5000 units,
and integer `sort` from 0 through 1,000,000. Lists use `{items,total}` ordered by
`sort ASC, id ASC`. Unknown public query fields, including search and status,
are unsupported. The API owns activation and persistence; the website does not
read management content or implement an independent visibility flag.

Requests use the trusted configured API origin, omit visitor credentials, reject
redirects, use no-store and a fifteen-second timeout, and bound response bodies to
2 MiB. The boundary validates public fields, paging consistency, duplicates and
order. Outages and invalid responses remain errors. React request-only caching
deduplicates the metadata/page read within one server render.

## Resolve pages and sitemap entries

The [resolver](../src/features/faq/server.ts) permanently redirects
`/faq/page/1` to `/faq`. Invalid paths, unsafe numbers, offsets above 10,000,000
and pages beyond the active total return 404. The empty first page returns useful
200 content with noindex. Populated pages self-canonicalize and follow global
indexing opt-in, API-selected language/direction and the existing nonce policy.
No per-FAQ SEO fields or FAQ structured-data output are introduced.

Home links to FAQ beside Contact. The sitemap includes `/faq` when active items
exist, with no `lastModified` value. [Sitemap and indexing](seo.md#page-and-language-contracts)

All ten catalogs provide the server-rendered labels. The account wire contract
includes four `faqs.*` permissions for management. Public reading is anonymous.

## Verify public FAQ behavior

The [local HTTP fixture](api-fixture.md#feature-data-and-test-operations) seeds
twenty-one active FAQs and one inactive item, and accepts administrator-only
edits for browser tests.

Owner tests cover bounded reads, routes, metadata, escaped SSR content, empty/error
states and sitemap publication. The [browser suite](../e2e/website/faq.spec.ts)
checks native operation without JavaScript, canonical redirects and actual 404s,
activation, long tokens, keyboard/Axe and desktop/mobile light/dark layouts in both
directions. Run the [exact-tree validation procedure](validation.md) and
inspect current captures and visual comparisons before publication.

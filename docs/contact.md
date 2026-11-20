# Public contact messages

`/contact` renders a localized public form with exactly Name, Mobile and
Description. All fields are required. The form validates trimmed names and
descriptions against limits of 120 and 5,000 JavaScript UTF-16 code units.
Internal description line breaks remain. Contact accepts Iranian `09` or
`+989` numbers with ASCII, Persian or Arabic digits and surrounding whitespace.

## Enter and submit a message

The [contact form](../src/features/contact/ContactForm.tsx) marks each field
required and uses localized validation messages. Mobile and its examples stay
LTR. Name and Description detect their own text direction. Submission disables
editing and duplicate clicks. Failure retains the entered values. Confirmed
success clears them, moves focus to the confirmation and offers a new-message
action. The mounted form owns its pending state and submission key.

## Handle retries through the website proxy

The [HTTP consumer](../src/features/contact/api.ts) sends exactly
`{name,mobile,description}` with the entered values to
`POST /public/contact-messages` through the same-origin proxy. The browser
validates a normalized copy and assigns a random UUID `Idempotency-Key` to that
copy. Retrying the same normalized payload after an uncertain result reuses the
key. A different payload or a new message after success uses a new key. Personal
input stays out of local and session storage.

The consumer expects a UUID `id` and UTC ISO `created_at` in a successful
receipt. Malformed success data remains retryable. A compatible API owns
canonical `+989` storage, transactional duplicate protection, 24-hour receipts,
quotas and persistence. The [synthetic HTTP fixture](api-fixture.md#feature-data-and-test-operations)
models the contract in memory.

The [proxy](../src/shared/api/proxy.ts) admits only POST for this public route,
requires the normal website origin and a valid UUID header, and bounds JSON to
32 KiB. It forwards no cookie, authorization or forwarded client identity, and
omits upstream Set-Cookie. The [browser client](../src/shared/api/client.ts)
omits credentials and suppresses session expiry notifications for a public 401.
Receipts and errors are private/no-store. Retry-After passes through for
localized quota feedback.

Home links to Contact. The page owns its canonical URL and follows the global
indexing setting. [Sitemap and indexing](seo.md#page-and-language-contracts)

## Verify submission and layout

All ten catalogs contain the explicit contact client scope. Focused tests cover
validation, normalized retry identity, pending/edit ownership, errors, quota,
success/reset, stale completion, receipt parsing, anonymous transport and proxy
isolation. The synthetic HTTP fixture models submissions, replay/conflict, quotas
and an administrator-only inbox inspection endpoint; it is not the real backend.
The [contact browser suite](../e2e/website/contact.spec.ts) verifies proxy retries
without duplicate insertion, navigation from home, keyboard interaction and
responsive layout in both text directions. Run
[exact-tree validation](validation.md), compare baselines and inspect current
contact captures before publication.

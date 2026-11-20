# Kernel Website localization

The API selects the website's language, text direction and Gregorian or Jalali
calendar. The website loads messages from one local catalog for each request.

## Catalog ownership

[`localeCodes`](../src/i18n/catalog-data/locales.ts) registers `ar`, `de`, `en`,
`es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`. Each code owns one file under
`src/i18n/catalog-data/locales/<code>.json`. Each resource contains a flat object
of nonempty strings. Keep catalog keys and interpolation placeholders consistent across languages.
JSON keeps translations as data: no imports, expressions or executable statements.
Every key appears exactly once, including after JSON escape decoding.

Shared meanings use one bare key, such as `login` or `password`. Distinct
meanings have separate keys, including `accountEmail` and `accountEmailLabel`.
Keep feature-specific keys explicit, such as `authLoginTitle`. Do not add nested
namespaces, dotted aliases, fallback spreads or parallel catalog sources.

[`WebsiteTranslationResource`](../src/i18n/catalog-data/website-types.ts) derives
the key shape through an erased `en.json` type import. English supplies the type
shape; each language supplies its own complete messages. Translation engines,
framework code and executable catalog logic stay outside the resource directory.
[The loader registry](../src/i18n/catalogs.ts) lazily imports one JSON resource
for the requested code and preserves its default object across repeated calls.
Its checked return type and exact-shape type assertions require each resource to
match the canonical keys and string values.

Use the explicit `.json` extension in imports. TypeScript's current Bundler
resolution does not resolve an extensionless catalog path to JSON. Retain explicit
JSON import attributes in authored browser suites that run under Node.

## Edit a message

1. Find the key in the feature and all ten JSON resources. Reuse a key only when the
   meaning is the same; a section title and input label may need distinct text.
2. Update every language with a complete translation. Preserve intentional
   newlines and identical ICU variable names. `accountTitle` uses `{name}`,
   `accountVerifiedEmail` uses `{email}`, and `feedbackResendIn` uses `{seconds}`.
3. For a client component, check its explicit
   [message scope](../src/i18n/client-messages.ts). Root, auth, account and
   contact key lists retain shared keys and reject missing or non-string messages. Update the
   relevant allowlist and scope tests for an intentional new client key; do not
   ship the full catalog or infer a group by prefix.
4. Run the existing integrity, real ICU and scope tests:

```sh
node node_modules/vitest/vitest.mjs run src/i18n/catalog-data/integrity.test.ts src/i18n/catalogs.test.ts src/i18n/client-messages.test.ts
```

Update the expected key count in the
[catalog integrity test](../src/i18n/catalog-data/integrity.test.ts) when adding
or removing a key. Type and
boundary checks remain required. The tests check strict JSON, duplicate keys,
flat string data, exact type/key completeness, placeholders/newlines, lazy loading,
repeated-import identity and real next-intl interpolation. JSON resources
remain ordinary indexed source. Executable loaders and translation consumers
retain measured coverage.

## Review sensitive translations

Review the meaning of changed translations in the rendered message or API
response. Check that each translation preserves the original action and its
consequence, including negation, irreversibility, permission, expiry and retry
conditions. Check the message in context with representative interpolated
values. Catalog checks verify keys and placeholders. Record the languages
reviewed and any pending linguistic review with the change evidence.

For a contact form error, preserve whether the visitor can retry immediately or
must wait. Review the text with the displayed duration when one is provided.

## Trace active language and direction

[`loadWebsiteLanguage`](../src/shared/settings/language.ts) reads public API
settings without visitor cookies or language headers, with no-store, redirect
rejection and a five-second timeout. It validates supported codes and accepts the
API's explicit direction even when it differs from a code-based expectation.
It also validates the configured Gregorian/Jalali calendar. Blog dates explicitly
select that calendar for Intl formatting instead of inferring it from language.
Malformed, unavailable or unsupported settings produce explicit errors.

[`getWebsiteLanguage`](../src/shared/settings/server.ts) deduplicates that read
only within a server render; it does not persist settings across requests.
The [next-intl adapter](../src/i18n/request.ts) loads the chosen catalog.
The [root layout](../src/app/layout.tsx) sets `html lang`/`dir` and selects root
messages. The auth layout, account page and contact layout select their own subsets.
Nested client providers replace message sets, so every selected set must include
the strings its descendants actually use.

There is no visitor language control, language cookie, local-storage locale or
browser negotiation. The permanent `/en` and `/fa`
[redirects](../next.config.ts) are legacy aliases to unprefixed URLs, not separate
language versions. See [SEO](seo.md#page-and-language-contracts) for canonical and
sitemap behavior.

## Verify rendered content

Auth and account tests use next-intl and explicit message scopes through
[the session fixture](../src/test/feature-session.tsx). The
[contact form tests](../src/features/contact/ContactForm.test.tsx) exercise its
own scope. Framework tests
exercise request/root integration; browser checks additionally exercise settings
changes/failures, actual `lang`/`dir` and rendered pages against the
[local synthetic HTTP fixture](api-fixture.md).

Review both directions, long translations and form feedback in the actual page.
[Accessibility](accessibility.md), [fonts](fonts.md) and
[visual comparison](visual-regression.md) cover their respective rendered
boundaries. Follow [validation](validation.md) for the complete publication gate;
documentation language remains English while all ten product catalogs stay
complete.

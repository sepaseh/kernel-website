# Maintain website messages and language selection

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

The API selects one active website language and its exact `ltr`/`rtl` direction.
The website loads that language's local messages; theme preference remains
independent. Use this guide to edit messages or trace language selection.

## Catalog ownership

[`localeCodes`](../src/i18n/catalog-data/locales.ts) registers `ar`, `de`, `en`,
`es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`. Each code owns one file under
`src/i18n/catalog-data/locales`. Each current
catalog exports 107 flat, nonempty literal strings with identical semantic keys.

Shared meanings use one bare key, such as `login` or `password`. Distinct
meanings have separate keys, including `accountEmail` and `accountEmailLabel`.
Keep feature-specific keys explicit, such as `authLoginTitle`. Do not add nested
namespaces, dotted aliases, fallback spreads or parallel catalog sources.

[`WebsiteTranslationResource`](../src/i18n/catalog-data/website-types.ts) derives
the key shape through an erased English-catalog type import. English is the type
shape, not a runtime fallback. Pure catalog data may import only erased local
types; translation engines, framework code and executable catalog logic stay
outside this directory. [The loader registry](../src/i18n/catalogs.ts) explicitly
loads every code and preserves each canonical catalog object.

## Edit a message

1. Find the key in the feature and all ten catalogs. Reuse a key only when the
   meaning is the same; a section title and input label may need distinct text.
2. Update every language with a genuine complete translation. Preserve intentional
   newlines and identical ICU variable names: `accountTitle` uses `{name}`,
   `accountVerifiedEmail` uses `{email}`, and `feedbackResendIn` uses `{seconds}`.
3. For a client component, check its explicit
   [message scope](../src/i18n/client-messages.ts). Root/auth/account key lists
   retain shared keys and reject missing or non-string messages. Update the
   relevant allowlist and scope tests for an intentional new client key; do not
   ship the full catalog or infer a group by prefix.
4. Run the existing integrity, real ICU and scope tests:

```sh
node node_modules/vitest/vitest.mjs run src/i18n/catalog-data/integrity.test.ts src/i18n/catalogs.test.ts src/i18n/client-messages.test.ts
```

An intentional new semantic key also changes the current 107-key contract and
its checked expectations/documentation; make those changes together. Type and
boundary checks remain required. The tests check flat literal data, key/value
completeness, placeholders/newlines, repeated-import identity and real next-intl
interpolation. They do not replace linguistic review.

## Trace active language and direction

[`loadWebsiteLanguage`](../src/shared/settings/language.ts) reads public API
settings without visitor cookies or language headers, with no-store, redirect
rejection and a five-second timeout. It validates supported codes and accepts the
API's explicit direction even when it differs from a code-based expectation.
Malformed, unavailable or unsupported settings produce explicit errors.

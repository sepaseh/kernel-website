# Website localization

[English](localization.md) · [فارسی](localization.fa.md)

Complete local website catalogs, a plain lazy loader registry and explicit client
message selection define the localization contract. Local components use real
next-intl in isolated tests. Read the [publication marker](../.github/bootstrap-policy.json):
with `applicationReady:false`, these tests do not execute request-scoped Next.js
adapters, application providers or browser-rendered pages. The
[application contract](application.md) requires those owners to preserve the same
API authority and client message boundaries.

## Catalog ownership

[`localeCodes`](../src/i18n/catalog-data/locales.ts) registers the ten supported
catalog codes: `ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru` and `tr`.
Each has exactly one code-named file under
[`src/i18n/catalog-data/locales`](../src/i18n/catalog-data/locales/). Every catalog
exports 107 flat, nonempty string values with the same semantic keys. Shared
meanings use one root key such as `login` or `password`; distinct meanings keep
their own keys, including `accountEmail` and `accountEmailLabel`. Do not add
nested `common` objects, dotted namespace aliases or parallel catalog sources.

[`WebsiteTranslationResource`](../src/i18n/catalog-data/website-types.ts) derives
the complete key shape from the English catalog through an erased type import.
English owns that type shape, not a fallback spread for another language. Data
modules may import only erased local data types; runtime English imports,
frameworks, translation engines and feature adapters are forbidden there.
[`catalogs`](../src/i18n/catalogs.ts) supplies an explicit loader for every
registered code and reuses the canonical imported catalog object.

Preserve genuine translations, intentional newlines and ICU `{variable}` names
in every language. For example, `accountTitle` uses `{name}`,
`accountVerifiedEmail` uses `{email}` and `feedbackResendIn` uses `{seconds}`.
These are website ICU messages. [Real ICU tests](../src/i18n/catalogs.test.ts) parse and interpolate every message using installed next-intl. This establishes engine behavior, not framework or browser rendering.

## Active language and direction

The independent API's public settings select the sole active language and its
direction. The existing
[`loadWebsiteLanguage`](../src/shared/settings/language.ts) performs an uncached
public read without visitor cookies or language headers, validates supported
codes and accepts the API's explicit `ltr` or `rtl` direction. A catalog code
does not determine direction. Unsupported, malformed or unavailable settings
remain explicit failures.

The website has no visitor language choice, language cookie or local-storage
locale. The loader registry only provides message data for the already selected
code; it does not negotiate a language or change server settings. Keep API
contracts and local catalog ownership separate.

## Validation and remaining runtime work

The [catalog tests](../src/i18n/catalog-data/integrity.test.ts) load all ten actual
catalogs and verify file ownership, 107 complete flat keys, nonblank translated
values, placeholder/newline parity, canonical semantic labels and repeated-import
identity. Translation-difference checks detect fallback copies; they are not a
linguistic quality assessment.

The exact publication guard requires every catalog, its type, registry, tests
and this bilingual guide. Production boundary checks reject runtime data
imports, foreign packages, omitted adapters and cross-checkout dependencies.
The [canonical full gate](../.agents/validation.json) runs on every PR for its
declared scope: eleven checks for false-marker prerequisites, all fifteen for
application activation. Keep genuine unit/governance coverage of every published
production module.

[Client message selections](../src/i18n/client-messages.ts) and their owner tests cover explicit root/auth/account key boundaries, shared-key retention and missing/nested-value rejection across all ten languages. [Local UI/session tests](client-ui.md) exercise a real next-intl provider with synthetic EN/FA data. Feature form tests use [scoped fixture messages](../src/test/feature-session.tsx) from the explicit auth/account selections, so complete catalogs cannot hide a missing client key. Request-scoped Next.js integration, application providers and bootstrap error pages must consume the same local data contract. Browser, accessibility and reviewed visual validation require actual execution of the exact runnable snapshot against the [pinned independent synthetic API](api-fixture.md), including unavailable-settings failures and API-supplied direction.

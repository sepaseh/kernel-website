# Website localization

[English](localization.md) · [فارسی](localization.fa.md)

The current [client-document phase](bootstrap.md) publishes complete local website catalogs, a plain lazy loader registry and explicit client message selection. It remains non-runnable with
`applicationReady:false`: Next.js request adapters, providers, screens and
rendered translation behavior are not included.

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
All ten checks in the [canonical full gate](../.agents/validation.json) run on
every PR and produce real unit/governance coverage for the published scope.

[Client message selections](../src/i18n/client-messages.ts) and their owner tests cover explicit root/auth/account key boundaries, shared-key retention and missing/nested-value rejection across all ten languages. Request-scoped Next.js integration, provider rendering and bootstrap error-page use belong to the later runtime owners.
Browser, accessibility and reviewed visual validation still require the runnable
application and its independently published synthetic API fixture.

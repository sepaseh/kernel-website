# ADR 0003: One active language

[English](0003-single-active-language.md) · [فارسی](0003-single-active-language.fa.md)

Status: accepted; language loading and local catalogs are published.

The persisted public API setting alone selects a supported language code and
valid ltr/rtl direction. The local registry validates codes; it does not derive
direction. The loader uses no-store without visitor cookies or language headers.
Unavailable, malformed or unsupported settings fail explicitly rather than silently
falling back to English. Calendar/display-name metadata is not duplicated here.

Each of ten code-named catalogs is one complete flat root string map. Keep shared
bare keys, explicit feature prefixes and genuine translations with matching ICU
variables. Providers and translation execution stay outside pure catalog data;
client code selects explicit root/auth/account key groups.

The accepted URL design has unprefixed canonical routes and no visitor language
switch, cookie or browser negotiation. Application acceptance must verify routes,
HTML lang/dir, metadata and legacy prefix redirects on the exact runtime tree.
False-marker support tests do not establish those behaviors. Use the
[application contract](../application.md) without changing API language authority.

Read [registry](../../src/i18n/catalog-data/locales.ts),
[language loader](../../src/shared/settings/language.ts),
[localization](../localization.md) and
[catalog integrity tests](../../src/i18n/catalog-data/integrity.test.ts).
A visitor-selectable multilingual product would require a new URL/cache/metadata
decision.

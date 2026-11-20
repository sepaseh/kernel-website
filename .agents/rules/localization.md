# Local website translations

## Catalogs

Keep all website messages under `src/i18n/catalog-data`. Each supported code
(`ar`, `de`, `en`, `es`, `fa`, `fr`, `it`, `pt`, `ru`, `tr`) owns one flat,
string-valued `locales/<code>.json` resource. Exclude duplicate keys, nested
objects, dotted keys, parallel sources and compatibility aliases. `locales.ts`
registers supported codes and erased types derive the key shape from `en.json`.
Use explicit `.json` import extensions. The loader registry lazily imports each
resource and preserves the default object's identity.

Use one bare key for a shared meaning such as `login` or `password`. Prefix
feature-specific keys in lower camel case, such as `authLoginTitle`,
`accountEmail` and `accountEmailLabel`. Keep headings distinct from input
labels.

Keep message keys and placeholders consistent across all catalogs. Give every
key a genuine, nonempty translation in each supported language.
Preserve ICU `{variable}` placeholders and newlines. Exclude English spreads
and fallback catalogs. Keep engines, providers and validation outside
the resource directory. Maintain exact-shape types, JSON/key checks and real
ICU tests. Catalog data remains indexed by analysis.

## Request and client scopes

Call `useTranslations()` without a namespace in client components and use flat
keys. Prefer one translator per component. The
[client selector](../../src/i18n/client-messages.ts) uses explicit `root`,
`auth`, `account` and `contact` key allowlists and requires strings. Keep the
complete catalog on the server. Keep allowlists independent of key prefixes and
English runtime values. Update all-language scope tests when adding a client
message. The
[global error route](../../src/app/global-error.tsx) reads reviewed English and
Persian strings directly when request settings or providers may be unavailable.

## API language and calendar

Persisted public API settings choose the sole active language, direction and
calendar. Validate `language.direction` as `ltr` or `rtl` and use the exact API
value. Article dates map API calendars to `gregory` or `persian`, independent
of the catalog code. Preserve explicit errors for unavailable settings,
malformed values and unsupported languages. Keep visitor preferences, cookies,
headers and URL prefixes out of language selection. Preserve the permanent
`/en` and `/fa` compatibility redirects and their query strings. Verify actual
redirects when changing route behavior.

## Verify translation changes

Use the [focused catalog checks](../../docs/localization.md#edit-a-message) while
editing. They cover integrity, ICU and client scope across all ten languages.
The [validation manifest](../validation.json) also requires typecheck and
boundary checks.

Follow the [HTTP contract review](api-collection.md#verify-before-changing-a-consumer)
when the public settings protocol changes.

# ADR 0005: Local source ownership

[English](0005-independent-repositories.md) · [فارسی](0005-independent-repositories.fa.md)

Status: accepted.

Source belongs to this project. Keep feature behavior and exclusive request DTOs
with their feature, settings contracts beside their loader and genuinely reused
wire concepts in src/shared/contracts. Shared UI/hooks and application-wide
HTTP/fonts/security/SEO/language/performance infrastructure retain semantic owners;
one bootstrap caller does not make infrastructure feature-specific.

Each language owns one complete code-named TypeScript catalog. Shared meanings
have one bare root key; exclusive account/auth keys use explicit prefixes in the
same flat object. Catalog changes are local. Paths, DTOs, cookies and settings
still require release-time HTTP compatibility with the independent API.

Reveal and its test live under website/home. Preferences is shared support for
future shell reuse; Header/Footer integration is not published in this phase.
No runtime source dependency on another checkout or installed local source
package is permitted. One independently installable root package must remain.

Read [architecture](../architecture.md), [imports](../../.agents/rules/imports.md),
[localization](../localization.md) and the [canonical checks](../../.agents/validation.json).

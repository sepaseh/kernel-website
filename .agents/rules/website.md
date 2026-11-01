# Public website source

Read the current [source scope](../../docs/bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

## Ownership and boundaries

Feature behavior belongs under its owning src/features directory. Shared frontend
infrastructure owns its local src/shared modules. Use HTTP for the configured
sample backend; keep database, authentication and storage implementation outside
frontend source. Setup and tests use this repository's owned HTTP fixture. Keep feature-specific pure DTOs beside the feature, settings contracts
beside their loader and reused wire concepts in src/shared/contracts.

Production package imports require the exact owner, installed package identity
and runtime/type-only permission in scripts/check-boundaries.mjs. In a false-marker phase the installed Next.js package supplies only its declared feature-local link/router boundaries, erased document types and Web Vitals hook adapter. Do not broaden permissions to make a test realistic. Runnable adapters need explicit owners, package permissions and tests. Inspect installed framework request APIs and actual supported signatures rather than assuming older synchronous APIs.

## Components and controls

Annotate component input parameters with a named Props type and infer the return
type. Do not use FC, React.FC, FunctionComponent or aliases of those types.
Components without props need no empty props type. Keep the installed framework function signatures when runnable composition introduces them.

Reuse the reviewed local UI primitives. Preserve native control properties,
explicit submit types, visible labels, unique description relationships and
localized feedback. Import Lucide icons by direct name with explicit size,
currentColor and decorative aria-hidden. Keep light/dark choice independent of
language and preserve reduced-motion behavior. Keep UI dependencies local to
this website's reviewed component system.

## Language and document support

The API's validated public settings choose the sole active language and exact
ltr/rtl direction; never infer direction from a locale code. Ten complete local
flat catalogs preserve ICU variables and genuine translations. No visitor
language controls, language cookies, header negotiation or URL language selection
are introduced. See [localization](../../docs/localization.md).

## Verification

Select checks from [the canonical manifest](../validation.json). The complete
gate must match actual source. Local code/tooling tests do not establish browser, visual, SSR or deployment readiness. Runnable composition requires all application checks, the same-repository synthetic HTTP fixture and actual hosted build/e2e/visual checks observed and made required before merge.

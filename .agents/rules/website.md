# Public website source

This standalone TypeScript guidance phase contains local website support and
feature components. applicationReady remains false. Read
[the phase guide](../../docs/bootstrap.md); no Next.js pages, root layout,
server-only request adapter, CSS build, browser fixture or deployment is published.

## Ownership and boundaries

Feature behavior belongs under its owning src/features directory. Shared frontend
infrastructure owns its local src/shared modules. Use HTTP for the independent
API, never its database, authentication, storage implementation, SDK or another
checkout. Keep feature-specific pure DTOs beside the feature, settings contracts
beside their loader and reused wire concepts in src/shared/contracts.

Production package imports require the exact owner, installed package identity
and runtime/type-only permission in scripts/check-boundaries.mjs. The installed
Next.js package currently supplies only declared feature-local link/router
boundaries, erased document types and the Web Vitals hook adapter. Do not add a
framework entry point or broaden permissions to make a test appear realistic.
When later integrating framework request APIs, inspect the installed guide and
actual supported signatures rather than assuming an older synchronous API.

Keep request composition consistent with failure semantics. Independently useful
reads retain their own result/error state; dependent operations stay ordered.
Preserve request/session generation and mount ownership, cleanup and cancellation.
Protected personal data and settings remain uncached. Read
[server boundaries](../../docs/server-boundary.md) and
[session ownership](../../docs/session.md).

## Components and controls

Annotate component input parameters with a named Props type and infer the return
type. Do not use FC, React.FC, FunctionComponent or aliases of those types.
Components without props need no empty props type. Keep appropriate framework
function signatures when a future runnable phase introduces them.

Reuse the reviewed local UI primitives. Preserve native control properties,
explicit submit types, visible labels, unique description relationships and
localized feedback. Import Lucide icons by direct name with explicit size,
currentColor and decorative aria-hidden. Keep light/dark choice independent of
language and preserve reduced-motion behavior. No admin component library or
provider belongs in the website.

Interactive state stays with its owner. Derive values when synchronization is
unnecessary, use stable dependencies, and declare components outside another
component's render. A conditional numeric expression must not render an unwanted
zero. Use keys when a form should reset by locale, session generation or account
identity. Preserve password whitespace, OTP destination ownership and accepted
server normalization. Read [forms](../../docs/forms.md) and
[client UI](../../docs/client-ui.md).

## Language and document support

The API's validated public settings choose the sole active language and exact
ltr/rtl direction; never infer direction from a locale code. Ten complete local
flat catalogs preserve ICU variables and genuine translations. No visitor
language controls, language cookies, header negotiation or URL language selection
are introduced. See [localization](../../docs/localization.md).

SEO support requires explicit origins and opt-in indexing. Escape JSON-LD and
restrict it to verified content. Metrics have no default transport and must not
corrupt delivery. Preserve the pure CSP/proxy policies and licensed self-hosted
fonts. The existing [client/document guide](../../docs/client-document.md)
describes support behavior, not a running root layout or public route.

## Verification

Select checks from [the canonical manifest](../validation.json). The complete
phase gate measures local code and tooling; it does not establish browser,
accessibility, visual, SSR or deployment readiness. A future runnable phase must
publish and execute the application checks and isolated synthetic API fixture,
then observe and require the real hosted build/e2e/visual checks before merging.

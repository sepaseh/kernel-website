# Public website source

## Ownership and boundaries

Use `src/features/auth` for login, registration, recovery, shared OTP UI and the
authentication layout. Session reads, logout and `SessionProvider` belong in its
`session` directory. Keep account mutations with account forms and public
blog, contact and FAQ behavior under their individual feature owners. Home
content and `Reveal` stay in `src/features/home`. App shell components belong in
`src/app/_components`. Shared infrastructure lives in `src/shared`, with
controls in `src/shared/ui` and `cn` in `src/shared/lib`.
[Application architecture](../../docs/architecture.md)

Follow [source ownership and import permissions](imports.md) for wire contracts
and framework adapters.

## Request and form ownership

Independently useful reads retain their own result and error state. Keep
dependent operations ordered.
Preserve request/session generation and mount ownership, cleanup and cancellation.
Protected personal data and settings remain uncached. Key forms by locale,
session generation or account identity where a change requires a reset.
Preserve password whitespace, OTP destination ownership and accepted server
normalization. [HTTP boundaries](../../docs/server-boundary.md) ·
[Session ownership](../../docs/session.md) · [Form behavior](../../docs/forms.md)

## Components and controls

Use a named props type on the component parameter and infer the return type.
Omit the props type and parameter for components without props.
Avoid `FC`, `React.FC`, `FunctionComponent` and aliases of those types.

Reuse the reviewed local UI primitives. Preserve native control properties,
explicit submit types, visible labels, unique description relationships and
localized feedback. Import Lucide icons by direct name with explicit size,
currentColor and decorative aria-hidden. Keep light/dark choice independent of
language and preserve reduced-motion behavior. Keep UI dependencies local to
this website's reviewed component system. [Shared controls](../../docs/client-ui.md#choose-and-compose-controls)

Interactive state stays with its owner. Derive values when synchronization is
unnecessary, use stable dependencies, and declare components outside another
component's render. Guard conditional numeric expressions against rendering an
unwanted zero.

## Language and document support

Follow the [request language and calendar rules](localization.md#api-language-and-calendar)
for API settings and compatibility redirects.

SEO support requires explicit origins and opt-in indexing. Escape JSON-LD and
restrict it to verified content. Metrics have no default transport and must not
corrupt delivery. Preserve the pure CSP/proxy policies and licensed self-hosted
fonts. See the [client and document policy](../../docs/client-document.md).

## Verification

Use the [application acceptance guide](../../docs/application.md#exact-tree-acceptance)
for real build, browser, CSP and visual verification with the local fixture.
Check [required hosted evidence](../../docs/application.md#visual-and-hosted-acceptance)
before merge.

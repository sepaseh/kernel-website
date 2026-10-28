# Website architecture

[English](architecture.md) · [فارسی](architecture.fa.md)

This is one independently installable root TypeScript package. [The source marker](../.github/bootstrap-policy.json) identifies delivered composition and exact inventory; [phase scope](bootstrap.md) records the application boundary. Next App Router implements the runtime direction in [ADR0001](adr/0001-independent-runtimes.md). [Application integration](application.md) maps the root layout, pages, request adapters and shell to their complete acceptance contract.

## Source and service ownership

| Boundary           | Published owner                                                                                                                             | Responsibility                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Features           | [features](../src/features)                                                                                                                 | Login, shared OTP, recovery and account forms, feature HTTP modules and exclusive DTOs.                                                    |
| Shared wire data   | [contracts](../src/shared/contracts/index.ts), [settings contracts](../src/shared/settings/contracts.ts)                                    | Local framework-free shared DTOs and path constants.                                                                                       |
| HTTP               | [client](../src/shared/api/client.ts), [forwarding](../src/shared/api/proxy.ts)                                                             | Cookie/no-store transport and bounded Web API forwarding. Mounted by the owned App Router API route, with adapter and browser acceptance.  |
| Language/messages  | [language loader](../src/shared/settings/language.ts), [catalogs](../src/i18n/catalogs.ts), [client groups](../src/i18n/client-messages.ts) | API-authoritative language/direction, ten local flat catalogs and explicit message scopes.                                                 |
| Presentation       | [primitives](../src/components/ui), [shared UI](../src/shared/ui), [providers](../src/app/providers/Providers.tsx)                          | Controls, feedback, session/theme composition and interaction support; page-shell ownership is confirmed from the actual inventory.        |
| Document/resources | [SEO](../src/shared/seo), [CSP](../src/shared/security/csp.ts), [fonts](../src/shared/fonts), [Web Vitals](../src/shared/performance)       | Explicit origins, escaped data, policy construction, licensed assets and optional delivery. Live SSR/headers need actual adapter evidence. |

The independent API owns authentication/authorization, password handling, OTP delivery, database migrations, persistence and storage. Consume HTTP without cross-checkout imports or local source packages. Coordinate incompatible path, DTO, cookie or settings changes. Local DTOs alone do not establish released API compatibility.

## State, privacy and language

[SessionProvider](../src/features/auth/SessionProvider.tsx) keys reads by locale/generation. Refresh or locale replacement invalidates the previous snapshot; stale reads and accepted mutations cannot replace the current account. Forms reset by generation, locale/account identity. Mount-operation ownership prevents late feedback/navigation, but cannot undo a completed server mutation. Read [session](session.md) and [forms](forms.md).

HTTP preserves original transport/cancellation failures. Public authentication401 stays with its form; protected mutation401 still announces expiry. Forwarding validates route/method, mutation origin and bounded JSON, preserves native cookies, removes successful credential fields and returns private/no-store responses. See [server boundary](server-boundary.md).

Uncached public API settings alone select a supported catalog and exact ltr/rtl direction without visitor cookies or negotiation. Each code-named catalog is a flat string object with shared bare keys, explicit feature prefixes and no aliases/nested namespaces. Theme is independent. [Localization](localization.md) defines adapter obligations.

Fonts, CSP, SEO, settings, HTTP and metrics retain semantic infrastructure ownership even with one composition consumer. Reveal belongs to website/home; Preferences is shared presentation. A new route/layout does not justify moving domain behavior into composition or server code into a client export.

## Tooling and integration evidence

Quality helpers keep fixture location, bundle parsing, environments and metadata/locks outside product runtime. [Delivery](deployment.md) and [operations](release-operations.md) define owned file/configuration/health/cleanup contracts and passive templates. [Runner](runner-foundation.md), [browser](browser-foundation.md) and [API fixture](api-fixture.md) contracts require inert imports, readiness-first operations, explicit inputs and owned lifecycle. Node fixtures and callback tests do not establish actual API/browser/container readiness.

The [manifest](../.agents/validation.json), [Contributing](../CONTRIBUTING.md) and [application contract](application.md) bind source to checks. Runnable composition must deliver all fifteen checks, real build/browser/CSP/visual evidence and protected jobs before merge. Dated decisions/QA preserve history; a source marker or helper pass cannot substitute for execution.

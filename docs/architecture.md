# Website architecture

[English](architecture.md) · [فارسی](architecture.fa.md)

The integration-tooling phase publishes one independently installable root TypeScript package,
local feature/UI support and its maintained instructions. It is not a runnable
Next.js application: routes, root layout, request adapter, global CSS, browser
fixture and deployment are deferred. The accepted runtime direction remains
Next App Router; [ADR 0001](adr/0001-independent-runtimes.md) separates that decision
from delivered integration.

## Source and service ownership

| Boundary                                    | Published owner                                                                                                                               | Responsibility                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature behavior and exclusive request DTOs | [features](../src/features)                                                                                                                   | Login, shared OTP flow, recovery and account forms plus their local HTTP modules/types.                                                     |
| Reused wire concepts                        | [shared contracts](../src/shared/contracts/index.ts), [settings contracts](../src/shared/settings/contracts.ts)                               | Framework-free DTOs and path constants used locally.                                                                                        |
| Transport and forwarding                    | [HTTP client](../src/shared/api/client.ts), [proxy support](../src/shared/api/proxy.ts)                                                       | Cookie/no-store browser requests and bounded Web API forwarding, with synthetic tests. No route currently mounts the proxy.                 |
| Language and messages                       | [language loader](../src/shared/settings/language.ts), [catalogs](../src/i18n/catalogs.ts), [client groups](../src/i18n/client-messages.ts)   | API-owned active language/direction and ten complete local catalogs.                                                                        |
| Presentation support                        | [primitives](../src/components/ui), [shared UI](../src/shared/ui), [providers](../src/app/providers/Providers.tsx)                            | Controls, feedback, session/theme composition and interaction support. No page shell is published.                                          |
| Document and resource support               | [SEO](../src/shared/seo), [CSP helpers](../src/shared/security/csp.ts), [fonts](../src/shared/fonts), [Web Vitals](../src/shared/performance) | Explicit origins, safe data, policy construction, licensed assets and optional metric delivery. No live SSR/header/telemetry claim follows. |

The independent API owns authentication, authorization, password handling, OTP
delivery, database migrations, persistence and storage. Consume it through HTTP;
never import another checkout or a local source package. Local types alone do not
establish compatibility with a released API. Coordinate incompatible observable
path, DTO, cookie or settings changes before release.

## State and privacy boundaries

[SessionProvider](../src/features/auth/SessionProvider.tsx) keys reads by locale
and generation. Refresh or locale replacement invalidates the previous loaded
snapshot immediately; aborted reads and stale accepted mutations cannot replace
the current account. Forms also key their local state by generation, locale and
account identity. Mount-operation guards prevent late feedback or navigation after
replacement. [Session](session.md) and [forms](forms.md) describe this behavior and
its tests; these guards cannot undo a server mutation already completed.

The HTTP client keeps original transport/cancellation failures. Public authentication
401 responses retain their originating form feedback without announcing expiry;
protected mutation 401 responses still notify the session provider. Forwarding
support checks allowed route/method pairs, mutation origins and bounded JSON bodies,
preserves native cookie responses, removes successful authentication credential
fields and marks responses private/no-store. See [server boundary](server-boundary.md).

## Language, ownership and later integration

The API setting alone selects a supported catalog code and valid direction.
The loader does not forward visitor cookies or language preferences and uses
no-store. Each code-named catalog is one flat string object with bare shared keys
and explicit feature prefixes; no nested namespaces, aliases or parallel catalogs
are introduced. See [localization](localization.md).

Reveal and its test live under website/home. Preferences is shared presentation
support intended for a later shell. Fonts, CSP, SEO, language, API transport and
Web Vitals keep their semantic infrastructure owners even when a bootstrap caller
is their only consumer. Theme preference remains independent from language.

[ADRs](adr/README.md) record accepted boundaries. The
[canonical manifest](../.agents/validation.json), [phase guide](bootstrap.md) and
[contribution policy](../CONTRIBUTING.md) define current checks. Real build,
browser/CSP, visual, SSR and deployment verification must accompany later runnable
integration; support tests and static guidance checks do not establish it.

## Deterministic quality tooling

The four independent helpers under scripts keep test fixture location, synthetic bundle measurements, environment construction and visual metadata/locking outside product modules. Their three Node owner-test files use owned temporary projects; production source remains unchanged. No other checkout is an imported source dependency, and this phase launches no API, browser or deployment process. [Testing](testing.md) and [validation](validation.md) describe actual evidence and deferred acceptance.

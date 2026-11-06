# Website architecture

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This is one independently installable root TypeScript package. Next App Router
composes routes and the document around feature-owned behavior and shared
frontend infrastructure. Use this guide to place a change and understand its
dependencies. [Application composition](application.md) traces the request/render
path; [source scope](bootstrap.md) links the exact inventory and operational
boundary.

## Source and service ownership

```text
src/
├── app/
│   ├── _components/       # Header, Footer and the shell's account link
│   ├── (auth)/            # Authentication routes and route layout
│   ├── account/           # Account page composition
│   ├── api/               # Same-origin HTTP forwarding route
│   └── providers/         # Application-wide provider composition
├── features/
│   ├── account/           # Protected account forms, writes and DTOs
│   ├── auth/
│   │   ├── login/         # Login form, HTTP module and DTOs
│   │   ├── register/      # Registration form, HTTP module and DTOs
│   │   ├── recovery/      # Recovery form, HTTP module and DTOs
│   │   ├── session/       # SessionProvider, account reads and logout
│   │   ├── AuthLayout.tsx
│   │   └── OtpForm.tsx
│   └── home/              # Home page content and Reveal behavior
├── i18n/                  # Message loading and pure catalog-data
├── shared/
│   ├── api/               # HTTP transport, origin and forwarding policy
│   ├── contracts/         # Reused pure wire concepts
│   ├── lib/               # cn and form-value helpers
│   ├── ui/                # Primitives, FormField, Feedback and ThemeToggle
│   └── …                  # Settings, fonts, security, SEO, hooks and metrics
├── test/                  # Shared test fixtures
└── proxy.ts               # Request-boundary integration
```

| Boundary                    | Published owner                                                                                                                             | Responsibility                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Application composition     | app, shell components, [providers](../src/app/providers/Providers.tsx)                                                                      | Routes, page metadata, shell and application provider wiring.                                 |
| Authentication              | auth, [session API](../src/features/auth/session/api.ts)                                                                                    | Login, registration, recovery, shared OTP UI, session reads and logout.                       |
| Account                     | account                                                                                                                                     | Protected profile, username, email and password forms and their HTTP mutations.               |
| Home                        | home                                                                                                                                        | Home content and its local Reveal component.                                                  |
| Shared controls and helpers | UI, [cn](../src/shared/lib/cn.ts), [form values](../src/shared/lib/form-values.ts)                                                          | Reviewed primitives, feedback, theme selection and reusable local helpers.                    |
| Shared wire data            | [contracts](../src/shared/contracts/index.ts), [settings contracts](../src/shared/settings/contracts.ts)                                    | Framework-free shared DTOs and path constants.                                                |
| HTTP                        | [client](../src/shared/api/client.ts), [forwarding](../src/shared/api/proxy.ts)                                                             | Cookie/no-store transport and bounded Web API forwarding mounted by the App Router API route. |
| Language/messages           | [language loader](../src/shared/settings/language.ts), [catalogs](../src/i18n/catalogs.ts), [client groups](../src/i18n/client-messages.ts) | API-authoritative language/direction, ten local flat catalogs and explicit message scopes.    |
| Document/resources          | SEO, [CSP](../src/shared/security/csp.ts), fonts, Web Vitals                                                                                | Explicit origins, escaped data, policy construction, licensed assets and optional delivery.   |

Keep focused tests beside their owners. Routes compose feature exports; shared
modules do not import route composition. Header and Footer belong to this app's
shell, while ThemeToggle is reusable UI. The authentication layout and shared OTP
form belong to authentication, and Reveal stays with the home feature. There is
no separate `website`, root `components` or catch-all `lib` ownership layer.

The session API owns `getAccount` and `logout`. Account mutation helpers stay in
the account feature; moving the session read avoids making authentication depend
on account-form implementation. The reused `Account` wire type remains in shared
contracts. These are frontend ownership boundaries, not a move of server-side
authentication or persistence into this repository.

The sample frontend expects authentication, settings and account operations over HTTP; backend authorization, password handling, OTP delivery, persistence and storage stay outside frontend source. Local DTOs describe the sample protocol. This starter owns its setup and acceptance, including a same-repository synthetic HTTP fixture. Downstream developers choose their backend and integration without requiring another repository's source or guidance. Synthetic acceptance does not establish external backend compatibility.

## State, privacy and language

[SessionProvider](../src/features/auth/session/SessionProvider.tsx) keys reads by locale/generation. Refresh or locale replacement invalidates the previous snapshot; stale reads and accepted mutations cannot replace the current account. Forms reset by generation, locale/account identity. Mount-operation ownership prevents late feedback/navigation, but cannot undo a completed server mutation. Read [session](session.md) and [forms](forms.md).

HTTP preserves original transport/cancellation failures. Public authentication401 stays with its form; protected mutation401 still announces expiry. Forwarding validates route/method, mutation origin and bounded JSON, preserves native cookies, removes successful credential fields and returns private/no-store responses. See [server boundary](server-boundary.md).

Uncached public API settings alone select a supported catalog and exact ltr/rtl direction without visitor cookies or negotiation. Each code-named catalog is a flat string object with shared bare keys, explicit feature prefixes and no aliases/nested namespaces. Theme is independent. [Localization](localization.md) defines adapter obligations.

Fonts, CSP, SEO, settings, HTTP and metrics retain semantic infrastructure ownership even with one composition consumer. A new route/layout does not justify moving domain behavior into composition or server code into a client export.

## Tooling and integration evidence

Quality helpers keep the synthetic HTTP fixture, bundle parsing, environments and metadata/locks outside product runtime. [Delivery](deployment.md) and [operations](release-operations.md) define owned file/configuration/health/cleanup contracts and passive templates. [Runner](runner-foundation.md), [browser](browser-foundation.md) and [API fixture](api-fixture.md) contracts require inert imports, readiness-first operations, explicit inputs and owned lifecycle. Node fixtures and callback tests do not establish actual API/browser/container readiness.

The [manifest](../.agents/validation.json), [Contributing](../CONTRIBUTING.md) and [application contract](application.md) bind source to checks. Runnable composition retains every required check, real build/browser/CSP/visual evidence and protected jobs. A source marker or helper pass cannot substitute for execution.

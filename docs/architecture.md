# Kernel Website architecture

The standalone TypeScript website uses Next.js App Router to compose routes and
the document. Feature code owns behavior and shared modules own reusable
frontend infrastructure. [Application composition](application.md) traces the
request and render path. [Source scope](bootstrap.md) defines the file inventory.

## Source and service ownership

```text
src/
├── app/
│   ├── _components/       # Header, Footer and the shell's account link
│   ├── (auth)/            # Authentication routes and route layout
│   ├── account/           # Account page composition
│   ├── api/               # Same-origin HTTP forwarding route
│   ├── [postId]/          # Canonical article URLs
│   ├── blog/              # Public archives and pagination
│   ├── contact/           # Public contact form
│   ├── faq/               # Public FAQs and pagination
│   ├── media/             # Public article images through the API
│   ├── preview/           # Private article preview
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
│   ├── blog/              # Published reads, rendering, media and preview
│   ├── contact/           # Public contact fields, validation and anonymous submission
│   ├── faq/               # Active questions, pagination and native disclosures
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

| Boundary                    | Published owner                                                                                                                             | Responsibility                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Application composition     | app, shell components, [providers](../src/app/providers/Providers.tsx)                                                                      | Routes, page metadata, shell and application provider wiring.                                           |
| Authentication              | auth, [session API](../src/features/auth/session/api.ts)                                                                                    | Login, registration, recovery, shared OTP UI, session reads and logout.                                 |
| Account                     | account                                                                                                                                     | Protected profile, username, email and password forms and their HTTP mutations.                         |
| Home                        | home                                                                                                                                        | Home content and its local Reveal component.                                                            |
| Blog                        | [Blog feature](../src/features/blog/server.ts), [guide](blog.md)                                                                            | Anonymous published projections, ID-only canonical routes, article rendering, media and scoped preview. |
| Contact                     | [Contact form](../src/features/contact/ContactForm.tsx), [submission contract](contact.md)                                                  | Anonymous submissions, input validation and duplicate-safe retries.                                     |
| FAQs                        | [FAQ route resolver](../src/features/faq/server.ts), [public FAQ contract](faq.md)                                                          | Read active questions and render paginated native disclosures.                                          |
| Shared controls and helpers | UI, [cn](../src/shared/lib/cn.ts), [form values](../src/shared/lib/form-values.ts)                                                          | Reviewed primitives, feedback, theme selection and reusable local helpers.                              |
| Shared wire data            | [contracts](../src/shared/contracts/index.ts), [settings contracts](../src/shared/settings/contracts.ts)                                    | Framework-free shared DTOs and path constants.                                                          |
| HTTP                        | [client](../src/shared/api/client.ts), [forwarding](../src/shared/api/proxy.ts)                                                             | Cookie/no-store transport and bounded Web API forwarding mounted by the App Router API route.           |
| Language/messages           | [language loader](../src/shared/settings/language.ts), [catalogs](../src/i18n/catalogs.ts), [client groups](../src/i18n/client-messages.ts) | API-authoritative language/direction, ten local flat catalogs and explicit message scopes.              |
| Document/resources          | SEO, [CSP](../src/shared/security/csp.ts), fonts, Web Vitals                                                                                | Explicit origins, escaped data, policy construction, licensed assets and optional delivery.             |

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

The HTTP API supplies settings, authentication, account operations and public
content. It owns authorization, password handling, OTP delivery, persistence
and storage. Local wire types describe the website's expected protocol. The
package includes a [synthetic API](api-fixture.md) for local setup and checks.
Verify a real backend integration against the [server boundary](server-boundary.md).

## State, privacy and language

[SessionProvider](../src/features/auth/session/SessionProvider.tsx) keys reads by locale/generation. Refresh or locale replacement invalidates the previous snapshot; stale reads and accepted mutations cannot replace the current account. Forms reset by generation, locale/account identity. Mount-operation ownership prevents late feedback/navigation, but cannot undo a completed server mutation. Read [session](session.md) and [forms](forms.md).

The browser HTTP client preserves its own fetch and response-stream failures,
including cancellation. Server forwarding returns a generic 503 for caught
upstream timeouts and transport failures. Public authentication 401 errors stay
with their form; protected mutation 401 errors still announce expiry. Forwarding
validates route/method, mutation origin and bounded JSON, preserves native
cookies, removes successful credential fields and returns private/no-store
responses. See [server boundary](server-boundary.md).

Uncached public API settings select the catalog, `ltr` or `rtl` direction and
calendar. The visitor's theme preference is independent. Each catalog
uses a flat string object with shared bare keys and explicit feature prefixes.
[Localization](localization.md)

Fonts, CSP, SEO, settings, HTTP and metrics retain semantic infrastructure ownership even with one composition consumer. A new route/layout does not justify moving domain behavior into composition or server code into a client export.

## Tooling and integration evidence

Quality helpers keep the synthetic HTTP fixture, bundle parsing, environments and metadata/locks outside product runtime. [Delivery](deployment.md) and [operations](release-operations.md) define owned file/configuration/health/cleanup contracts and passive templates. [Runner](runner-foundation.md), [browser](browser-foundation.md) and [API fixture](api-fixture.md) contracts require inert imports, readiness-first operations, explicit inputs and owned lifecycle. Node fixtures and callback tests do not establish actual API/browser/container readiness.

The [manifest](../.agents/validation.json), [Contributing](../CONTRIBUTING.md) and [application contract](application.md) bind source to checks. Runnable composition retains every required check, real build/browser/CSP/visual evidence and protected jobs. A source marker or helper pass cannot substitute for execution.

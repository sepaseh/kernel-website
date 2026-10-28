# Website topic dispositions — 24 October 2026

[English](roadmap-status-2026-10-24.md) · [فارسی](roadmap-status-2026-10-24.fa.md)

This dated planning matrix retains137 topic titles and this website's recorded disposition. A learning topic does not automatically require a runtime feature. Foundation, configured workflow, conditional feature and unperformed manual/remote checks are distinct; no fresh execution is implied. See the [requirements assessment](requirements-audit-2026-10-24.md) and [machine-readable matrix](roadmap-status-2026-10-24.json). All evidence paths are relative to this project root.

| Code | Meaning                        |
| ---- | ------------------------------ |
| I    | Implemented foundation         |
| W    | Documented workflow            |
| C    | Conditional feature            |
| P    | Foundation; condition remains  |
| M    | Manual evaluation not run      |
| R    | Configured; remote run pending |
| D    | Intentionally deferred         |
| N    | Outside this owner             |

| ID   | Topic                                     | Website | Disposition                                                                                                                                |
| ---- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F001 | Next.js — Pages Router                    | D       | Pages Router is deliberately absent; website uses App Router.                                                                              |
| F002 | Browser APIs                              | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F003 | React                                     | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F004 | TypeScript                                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F005 | JavaScript                                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F006 | HTML                                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F007 | CSS                                       | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F008 | Server & Client Components                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F009 | Rendering Strategies (CSR, SSR, SSG, ISR) | P       | CSR/SSR exist; SSG/ISR requires future publication/invalidation rules.                                                                     |
| F010 | Server Actions & Route Handlers           | I       | Allowlisted Route Handlers proxy HTTP; no duplicated business Server Actions are needed.                                                   |
| F011 | Streaming & Suspense                      | C       | Admin lazy Suspense exists; server streaming needs a concrete slow section.                                                                |
| F012 | Cache & Revalidation                      | P       | Settings/auth remain no-store; public content caching needs a publication policy.                                                          |
| F013 | Error & Loading Boundaries                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F014 | Next.js — App Router                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F015 | State Management                          | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F016 | Design Systems                            | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F017 | Monorepo                                  | N       | Outside this single-project website scope.                                                                                                 |
| F018 | Micro Frontends                           | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F019 | Module Federation                         | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F020 | Component Architecture                    | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F021 | Domain-driven Frontend Architecture       | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F022 | Dependency Boundaries                     | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F023 | Frontend Error Handling Architecture      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F024 | Unit Testing                              | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F025 | Integration Testing                       | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F026 | E2E Testing                               | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F027 | Vitest                                    | I       | API application tests use Node test; catalog tests use Vitest. No test-engine migration is needed.                                         |
| F028 | React Testing Library                     | N       | React Testing Library/MSW/Storybook belong to admin; website uses unit/real-browser coverage without a mandatory duplicate stack.          |
| F029 | Playwright                                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F030 | MSW                                       | N       | React Testing Library/MSW/Storybook belong to admin; website uses unit/real-browser coverage without a mandatory duplicate stack.          |
| F031 | TDD                                       | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F032 | Testing Strategy                          | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F033 | Component Testing                         | P       | Admin components/Storybook and website unit/browser coverage exist; extra component suites are scoped.                                     |
| F034 | Visual Regression Testing                 | I       | Four reviewed visual baselines per frontend and pinned CI jobs exist; hosted execution is separate.                                        |
| F035 | Accessibility Testing                     | I       | Automated axe/keyboard/semantic checks exist; they do not replace manual F046/F048 evaluation.                                             |
| F036 | Storybook                                 | N       | React Testing Library/MSW/Storybook belong to admin; website uses unit/real-browser coverage without a mandatory duplicate stack.          |
| F037 | Contract Testing                          | I       | Admin Pact, API HTTP provider/Bruno and website real HTTP integration cover existing contracts; expansion is conditional.                  |
| F038 | Flaky Test Management                     | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F039 | Core Web Vitals                           | I       | Standard CLS/INP/LCP and supporting metrics exist; field p75 needs real traffic.                                                           |
| F040 | Browser Rendering Pipeline                | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F041 | Bundle Optimization                       | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F042 | Code Splitting                            | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F043 | Frontend Caching Strategies               | I       | Public/static caching is distinct from private sessions/live settings; no-store boundaries are tested.                                     |
| F044 | Image & Font Optimization                 | P       | Local fonts/website shaping-safe subsets exist; product image/CDN/video processing is conditional.                                         |
| F045 | Performance Budgets                       | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F046 | WCAG                                      | M       | Manual screen-reader/listening and complete WCAG evaluation are not run; automation is not certification.                                  |
| F047 | Keyboard Navigation                       | I       | Automated axe/keyboard/semantic checks exist; they do not replace manual F046/F048 evaluation.                                             |
| F048 | Screen Readers                            | M       | Manual screen-reader/listening and complete WCAG evaluation are not run; automation is not certification.                                  |
| F049 | ARIA                                      | I       | Automated axe/keyboard/semantic checks exist; they do not replace manual F046/F048 evaluation.                                             |
| F050 | XSS                                       | I       | Current context-specific rendering/input/gateway protections exist; no blanket rich-HTML sanitizer claim.                                  |
| F051 | CSP                                       | I       | Admin static CSP and website nonce report-only/enforce are separate; report-only does not block.                                           |
| F052 | OAuth/OIDC                                | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F053 | Authentication                            | P       | Password/session/account flows exist; real OTP delivery is API/provider-owned and still unconfigured.                                      |
| F054 | Authorization                             | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F055 | CSRF                                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F056 | Secure Cookies                            | I       | Native HttpOnly cookies/credential stripping serve website; admin uses memory bearer state.                                                |
| F057 | Dependency & Supply-chain Security        | I       | Audit gates exist; API retains four MinIO moderate findings and zero high/critical.                                                        |
| F058 | Secret Management                         | P       | Safe current env/text/file contexts exist; managed secrets or rich-HTML/CMS policies require a real deployment/content need.               |
| F059 | Clickjacking Protection                   | I       | Current context-specific rendering/input/gateway protections exist; no blanket rich-HTML sanitizer claim.                                  |
| F060 | Input Validation                          | I       | Existing forms/wire limits align with authoritative API input/type/size validation.                                                        |
| F061 | Sanitization                              | P       | Safe current env/text/file contexts exist; managed secrets or rich-HTML/CMS policies require a real deployment/content need.               |
| F062 | Git                                       | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F063 | GitHub Actions                            | R       | Pinned workflows exist; hosted activation, credentials and branch protection were not executed here.                                       |
| F064 | Docker                                    | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F065 | CI/CD                                     | R       | Pinned workflows exist; hosted activation, credentials and branch protection were not executed here.                                       |
| F066 | Turborepo                                 | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F067 | pnpm                                      | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F068 | REST                                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F069 | GraphQL                                   | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F070 | gRPC                                      | N       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F071 | Databases                                 | N       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F072 | Backend & Distributed Caching             | N       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F073 | Message Queues                            | N       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F074 | AI SDK                                    | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F075 | MCP                                       | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F076 | Tool Calling                              | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F077 | Streaming UI                              | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F078 | RAG                                       | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F079 | Prompt Engineering                        | P       | Portable guidance/oracles exist; controlled source evaluation is distinct from automatic host discovery/all-assistant benchmarking.        |
| F080 | System Design                             | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F081 | Requirements Analysis                     | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F082 | Technical Planning                        | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F083 | Code Review                               | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F084 | Mentoring                                 | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F085 | Architecture Decision Making              | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F086 | Technical Communication & Documentation   | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F087 | HTTP/HTTPS                                | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F088 | Cookies & Sessions                        | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F089 | CORS                                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F090 | Browser Caching                           | I       | Public/static caching is distinct from private sessions/live settings; no-store boundaries are tested.                                     |
| F091 | JavaScript Event Loop                     | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F092 | Web Storage                               | I       | UI/theme preferences may persist; visitor storage does not select website language and bearer stays in memory.                             |
| F093 | Web Workers                               | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F094 | WebSockets                                | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F095 | Server-Sent Events                        | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F096 | Service Workers                           | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F097 | Progressive Web App                       | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F098 | Web Push Notifications                    | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F099 | Browser Extensions                        | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F100 | Web Media APIs & Playback                 | C       | Generic upload/storage is not a complete DAM/CMS/video pipeline; these remain product-dependent.                                           |
| F101 | TV & Remote-control UI Engineering        | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F102 | Cross-platform Frontend Adapters          | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F103 | Chrome DevTools                           | W       | A reusable documented practice, not a new runtime package or proof of every historic action.                                               |
| F104 | Network Debugging                         | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F105 | Performance Profiling                     | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F106 | Memory Leak Debugging                     | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F107 | Source Maps                               | P       | Local diagnostics/report adapters exist; source-map uploads/collectors/alerts depend on deployment.                                        |
| F108 | Error Monitoring                          | P       | Local diagnostics/report adapters exist; source-map uploads/collectors/alerts depend on deployment.                                        |
| F109 | Logging & Diagnostics                     | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F110 | Real User Monitoring                      | P       | Standard metric adapters exist; consent/sampling/collector and field p75 proof remain conditional.                                         |
| F111 | Data Fetching Patterns                    | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F112 | Server State Management                   | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F113 | Loading, Error & Empty States             | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F114 | Retry                                     | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F115 | Optimistic Updates                        | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F116 | Forms & Validation                        | I       | Existing forms/wire limits align with authoritative API input/type/size validation.                                                        |
| F117 | Pagination                                | N       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F118 | Race Conditions & Stale Data              | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F119 | Infinite Loading                          | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F120 | Timeout                                   | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F121 | Cancellation                              | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F122 | Responsive Design                         | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F123 | CSS Architecture                          | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F124 | UI Implementation from Design             | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F125 | Animation & Motion                        | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F126 | Internationalization                      | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F127 | SEO & Metadata                            | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F128 | Cross-browser Compatibility               | P       | Chromium evidence exists; target browser/device combinations need their own validation.                                                    |
| F129 | Typography & Visual Hierarchy             | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F130 | Environment Configuration                 | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F131 | Deployment                                | P       | Docker/native tools and local verification exist; real systemd/ACME/production activation is not run.                                      |
| F132 | CDN & Edge Delivery                       | C       | Conditional on a real product/provider/hosting requirement; not a missing mandatory starter dependency.                                    |
| F133 | Feature Flags                             | P       | Simple validated deployment/indexing switches exist; a generalized flag platform is conditional.                                           |
| F134 | Release & Rollback Strategies             | W       | Frontend artifact rollback is documented; API now tests local matched DB/object/session restore, not operational backups.                  |
| F135 | Dependency Management                     | I       | The appropriate current foundation exists; see the scoped source/test evidence, not a claim of every possible extension.                   |
| F136 | Package Publishing                        | D       | Intentionally deferred for this starter; installing every learning-roadmap technology is not a requirement.                                |
| F137 | Incident Debugging                        | P       | API now tests local HTTP request/release/log incident correlation and recovery; production browser/collector/alerting remains conditional. |

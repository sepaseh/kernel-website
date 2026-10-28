# Website verification — 24 October 2026

[English](independent-website-verification.md) · [فارسی](independent-website-verification.fa.md)

This dated record precedes the [requirements assessment](requirements-audit-2026-10-24.md), including its later session-generation fix and additional checks. Use the current [Docker guide](../../deploy/docker/README.md) for cleanup requirements. Results below describe the recorded run, not a fresh verification.

Scope: the kernel-website working tree on Windows x64 with Node 24.18.0 and disposable Linux containers on Docker Engine 29.7.2. See [architecture](../architecture.md) and [validation](../validation.md).

## Required local gates

The canonical full profile completed with exit zero. Final focused checks also passed after the source-startup and static-analysis configuration refinements:

| Check                                  | Observed result                                                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guidance and discovery structure       | 21 registered checks, 11 local tasks, eight evaluation specifications; 14 hook/checker/runner cases passed. This is not an executed model benchmark.                                |
| Import boundaries                      | 121 production source files checked; no API implementation imports.                                                                                                                 |
| Dependencies, types and source quality | Audit reported zero vulnerabilities; typecheck, lint, formatting and Knip passed.                                                                                                   |
| Website unit tests                     | 171 passed.                                                                                                                                                                         |
| Complete local catalogs                | Nine integrity cases passed across all ten language families and all retained consumer catalogs.                                                                                    |
| Tooling                                | 21 Node cases and 18 Vitest audit/authorized-target cases passed.                                                                                                                   |
| Deployment and source startup          | 19 cases passed, including prepared standalone assets, top-level junction containment, immutable output, renderer/preflight/readiness and synthetic Next dotenv precedence.         |
| Production output                      | Build and bundle budgets passed: 824102 emitted browser JavaScript bytes, largest chunk 235044 bytes, CSS 37452 bytes. These are graph measurements, not first-page transfer sizes. |
| Real API browser journeys              | 47 passed with separate API-owned synthetic SQLite/uploads and production standalone website.                                                                                       |
| Report-only CSP                        | Four cases passed against the same production output in report-only mode.                                                                                                           |
| Visual comparisons                     | Four existing reviewed PNGs passed on Windows with Playwright 1.63.0 / Chromium 153.0.8010.12; no baseline was updated.                                                             |

Knip statically includes all Playwright configs and test trees without dynamically executing their external-target setup. Actual staging/smoke configs still fail closed on missing or unauthorized targets. The source npm-start helper uses Next's own @next/env production loading order for . before defaults and preflight; subprocess tests used only synthetic temporary dotenv files, including a root file that must stay ignored.

## Real local deployment artifacts

The native packager consumed the real prepared standalone build. Its complete output was copied to a temporary directory outside the checkout and started directly with bundled runtime dependencies. A separate API process used a fresh synthetic temporary database/uploads, explicit origins and random loopback ports. Readiness, raw HTML, nonce CSP, noindex, all extracted JS/CSS/font URLs, login credential stripping, HttpOnly cookie forwarding, authenticated account response and private no-store headers passed. Both direct processes and the temporary release/state were removed. This was Windows x64 payload execution, not a Linux systemd test.

The Docker smoke built the website and TLS gateway from this repository and the API from its separate checkout. Only the API's test entrypoint/configuration was overridden; normal website Compose contains no API service. A unique local Compose project, volume, generated self-signed certificate and loopback ports isolated the run. HTTP→HTTPS redirect, standalone assets/fonts, report-only→enforce runtime recreation, noindex, real Secure/HttpOnly cookie login/account, private no-store and release marker all passed. Its containers, volume, network, temporary files and three uniquely tagged images were removed. Base images/build cache were retained; no broad cleanup ran.

## Evidence and limits

Local generated evidence is ignored by Git: test-results/completion/full.log, test-results/completion/docker.log, test-results/deployment/native.json and test-results/deployment/docker.json. The ordinary browser/visual reports also remain local generated artifacts.

No operator state, real dotenv, live accounts, production service or real certificate was used. No commit, push or remote workflow dispatch occurred. Linux systemd/ACME installation, hosted CI/CodeQL/Sonar/ZAP, branch protection, a production OTP provider, public deployment, Lighthouse/field metrics and complete WCAG conformance remain outside this local verification. Hosted private API integration requires an operator-provisioned read-only token and immutable API revision; no secret was created or read here.

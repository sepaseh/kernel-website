# Website task navigation

[English](source-navigation.md) · [فارسی](source-navigation.fa.md)

Start with [root instructions](../AGENTS.md), [settings](../.agents/settings.json)
and the matching task in [navigation](../.agents/navigation.json). The machine map
owns concrete local source, contracts, tests, rules and check IDs. Read the full
owning functions; an index is not proof of semantic completeness or automatic
instruction loading.

This map covers the published non-runnable support and feature scope. It must not
describe authored browser suites as executed journeys, or point to deferred routes,
layout/CSS or deployment as if they were present. [Architecture](architecture.md) and [ADRs](adr/README.md) distinguish
accepted design from delivered integration.

- For forms and session races, inspect feature owners, HTTP modules/types and
  [form](forms.md)/[session](session.md) behavior. Trace cancellation, generation
  replacement, feedback, OTP destinations and stale navigation.
- For wire ownership, inspect feature types.ts, settings contracts and the shared
  wire module. The independent API owns real authentication, data and storage.
- For language/messages, inspect the API language loader, one locales/code.ts
  object per language, English-derived key type, literal loaders and explicit
  root/auth/account client groups. API direction is not derived from a language code.
- For design, begin with [DESIGN](../DESIGN.md), the
  [design skill](../.agents/skills/design-ui/SKILL.md) and actual local primitives.
  Semantic classes are not computed CSS, screenshots or browser evidence.
- For HTTP/CSP/SEO/font/performance support, open the linked source owner and its
  direct tests. Those helpers do not establish live route or document integration.
- For Git and review work, use the git-workflow task, [Git router](../.agents/rules/git.md),
  [branches](../.agents/rules/branches.md), [commit](../.agents/skills/commit/SKILL.md)
  and [issue startup](../.agents/skills/start-issue/SKILL.md) workflows. Preserve
  work and verify the actual base; preparation does not publish remote metadata.

Select checks from the [canonical manifest](../.agents/validation.json) and
[contribution policy](../CONTRIBUTING.md). Record source freshness, actual execution,
failures, skips and limits. A matching search line or past green result is not fresh
verification. [Evaluation](comprehension-evaluation.md) separately addresses static
navigation, observed instruction discovery and measured source understanding.

For deterministic quality tooling, start with the integration-tooling task in the machine navigation and [testing](testing.md). Inspect the explicit API resolver, bundle/budget parser, performance environment and visual metadata/lock helper plus their three Node owner-test files. Their required check is measured governance coverage; browser routes, launchers and historical image compatibility remain outside this phase.

For delivery-tooling, inspect the published readiness/copy/package, public configuration, explicit health, scoped cleanup and target-validation owners through the delivery-tooling machine task. [Deployment preparation](deployment.md) and [release operations](release-operations.md) describe synthetic evidence and passive templates. The required check is measured governance coverage; core CLIs reject operations when `applicationReady:false`, before configuration reads, network or artifact access. Remote workflows remain deferred.

The [runner foundation](runner-foundation.md) adds six Node modules and six measured Node owner-test files for explicit inputs, direct-child lifecycle, standalone/API fixture launching and bounded analysis output. The website, API, server and analyzer entry operations read the public readiness marker first and refuses this snapshot with applicationReady:false. Imports do not load dotenv, mutate the environment or launch a service. Tests run owned synthetic Node programs, including failure and cancellation; they do not execute a real Next.js build/start, independent API, browser, Docker engine or lab analysis. The unchanged eleven-check gate measures the new tooling without weakening thresholds or excluding source. The [browser foundation](browser-foundation.md) now adds typed authored suites, readiness-first Playwright configuration and visual/CSP orchestration. Four Node owner files measure guards and injected behavior; browser binaries, independent APIs and real browser/visual execution remain deferred.

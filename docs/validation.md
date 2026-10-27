# Canonical validation for delivery tooling

[English](validation.md) · [فارسی](validation.fa.md)

[.agents/validation.json](../.agents/validation.json) is the sole command/profile
inventory. **runner-foundation** retains eleven required checks over the exact
317-file non-runnable inventory. Four retained integration helpers with three Node
owner-test files and eight delivery helpers with six Node owner-test files stay in
required governance coverage, not unexecuted advisory entries. The existing eleven
audit regression cases remain in the Vitest unit suite; their runner and coverage
owner are unchanged. settings.recommendedChecks is a checked full-profile projection.
[Contributing](../CONTRIBUTING.md) owns installation, authorization and exact-tree
handoff requirements.

Use the pinned Node and its bundled npm, and Python3.14.4 with pinned font
requirements in a disposable environment outside the checkout. After fresh
installation, run the complete gate on the exact isolated proposed snapshot:

```sh
npm run validate -- full
```

The runner validates the whole command plan, executes sequentially and stops at
failure. Every PR, including documentation and drafts, runs the same full profile
without changed-path filtering. A smaller declared profile or focused helper test
is development evidence, not a replacement for full:

```sh
node --test scripts/api-repository.test.mjs scripts/website-performance.test.mjs scripts/visual-environment.test.mjs
```

Select matching delivery owner files from [testing](testing.md), for example:

```sh
node --test scripts/release-files.test.mjs scripts/prepare-standalone.test.mjs scripts/package-release.test.mjs
```

These focused Node commands do not run the Vitest audit regression or the entire
gate. Use the canonical full profile for complete handoff evidence; never remove
an existing selector or exclude source to make a runner pass.

Keep production source in measured analysis/coverage, 90% unit and 80% governance
thresholds, and required real font verification. Synthetic bundle fixtures and
owned loopback listener probes measure tooling behavior only. They do not build
an app, launch an API/browser or compare images. The phase registers no browser,
Lighthouse, Knip or deployment execution command.

Core delivery CLIs read the unlinked public readiness policy and refuse this
applicationReady:false phase before configuration/network/artifact operations.
Synthetic test roots may declare readiness to exercise actual local copying and
immutable packaging; that marker does not establish a working application.
Public configuration values, injected engine callbacks and owned health listeners
keep evidence local. Passive native/Docker templates, release configuration and
historical changelog entries do not activate a provider workflow or deployment.
See [delivery acceptance](deployment.md) and [operations](release-operations.md).

The API location helper requires KERNEL_SYNTHETIC_ENV=1 and an absolute explicit
KERNEL_API_DIRECTORY; tests supply owned synthetic directories. Marker validation
does not prove installation, immutable revision or service compatibility.
Environment helpers retain only allowlisted runtime essentials and synthetic
values, not owner secrets or NODE_OPTIONS. Never load real dotenv, existing state
or another checkout implicitly.

Local results do not establish hosted CI, Sonar or CodeRabbit execution. Follow
[branch protection](branch-protection.md) and the [current-head preflight](sonarqube.md#before-requesting-coderabbit)
before provider requests or authorized merges. Failures, missing evidence and
unavailable audits are not passes. Optional hooks are host aids, not the full gate;
their Bash/Node fixture tests do not prove host autoload.

Before runtime activation, publish the app and independently installed synthetic
API fixture, extend application checks, observe genuine build/browser/CSP/visual
jobs and require their verified contexts. Historical reports and baseline metadata
cannot replace that evidence.

The [runner foundation](runner-foundation.md) adds six Node modules and six measured Node owner-test files for explicit inputs, direct-child lifecycle, standalone/API fixture launching and bounded analysis output. The website, API, server and analyzer entry operations read the public readiness marker first and refuses this snapshot with applicationReady:false. Imports do not load dotenv, mutate the environment or launch a service. Tests run owned synthetic Node programs, including failure and cancellation; they do not execute a real Next.js build/start, independent API, browser, Docker engine or lab analysis. The unchanged eleven-check gate measures the new tooling without weakening thresholds or excluding source. Browser SDK/suites and application activation remain future work.

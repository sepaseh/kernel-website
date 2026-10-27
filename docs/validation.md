# Canonical validation for integration tooling

[English](validation.md) · [فارسی](validation.fa.md)

[.agents/validation.json](../.agents/validation.json) is the sole command/profile
inventory. **integration-tooling** retains eleven required checks; three new
tooling owner-test files join required governance coverage, not unexecuted advisory
entries. settings.recommendedChecks is a checked full-profile projection.
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

Keep production source in measured analysis/coverage, 90% unit and 80% governance
thresholds, and required real font verification. Synthetic bundle fixtures and
owned loopback listener probes measure tooling behavior only. They do not build
an app, launch an API/browser or compare images. The phase registers no browser,
Lighthouse, Knip or deployment execution command.

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

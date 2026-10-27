# Server-boundary phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

This phase contains twenty-nine source files: wire contracts, form helpers,
API-origin validation, the API-authoritative settings-language loader, ten flat
107-key catalogs, their erased key type and explicit lazy-loader registry, plus
five source test files. Web API forwarding and pure CSP policy helpers extend the
published closure; read [server boundary](server-boundary.md). `applicationReady:false` is enforced by the
[exact inventory](../.github/bootstrap-policy.json). Read [localization](localization.md)
for catalog ownership and language policy. No Next.js app, actual ICU rendering,
browser journey, deployment or runtime dependency is included.

After `npm ci`, run `npm run validate -- full`. The
[manifest](../.agents/validation.json) defines nine required checks: snapshot,
CI policy, audit, closed imports, types, lint, formatting, measured unit tests and measured
governance tests. Run the full current phase before an authorized commit, push
or PR handoff. Use only the isolated exact proposed tree, not omitted source
from the primary checkout.

Every PR, including drafts, executes that same canonical full command without
changed-file filtering. The runner validates the entire selected plan before
execution: duplicate check IDs/profile entries, unknown checks, missing required
checks and manual/advisory entries in `full` fail closed. CI does not maintain a
second list of phase commands. Focused development profiles remain available but
cannot replace the full PR gate.

The CI policy parses YAML with unique keys and verifies the PR trigger, mandatory
job, root directory and unconditional install/full-gate steps. Path/branch filters,
draft conditions, ignored failures and reordered/missing commands fail validation.
All nine checks in the canonical full profile execute in the `check` job. The
other required native contexts are listed below. Future build/e2e/visual jobs need
an explicit policy transition instead of silently running a Windows check on Linux.

Unit coverage must reach 90% for statements, branches, functions and lines.
Governance coverage must reach 80% for lines, functions and branches, excluding
test files. Reports are generated from actual execution at
`coverage/unit/lcov.info` and `coverage/governance/lcov.info`; do not commit
them, fabricate results or attribute them to a complete website.

The inventory rejects undeclared/missing files, private paths and symlinks and
checks maintained local links. It allows ordinary root `node_modules` and
`coverage` output directories. The 100-file cap applies to each PR's changed-file
list, not the total inventory.

[CI](../.github/workflows/ci.yml) runs the full phase and an unprivileged
read-only PR-size check. The [target guard](../.github/workflows/pr-policy.yml)
uses only the immutable `github.workflow_sha` checkout with read-only permissions.
Never execute PR-head or unreviewed base code in that privileged event.
The size guard rejects metadata above 100 files before retrieval. An eligible PR
fits one complete page; unexpected pagination, incomplete file metadata and
changing head/base/count evidence fail closed.

Use native CodeRabbit/Sonar/CI and one approving review with resolved
conversations. CodeRabbit automatic review is disabled; request a manual review
only after the [strict preflight](sonarqube.md#before-requesting-coderabbit) passes
for the current head. All required non-CodeRabbit checks and zero OPEN/unresolved
Sonar issues of every severity are mandatory under the approved non-runnable
check set. Recheck after head changes, respect quotas and avoid duplicate
in-flight requests. See [Contributing](../CONTRIBUTING.md),
[branch protection](branch-protection.md) and [Sonar](sonarqube.md).

Under the non-runnable publication policy, app build/e2e/visual
jobs are not required. The five native contexts, including the trusted
`PR file limit`, are listed in
[branch protection](branch-protection.md); the closed inventory and
applicationReady:false remain unchanged. No fake jobs or skipped required checks
are used. Before any runnable-app merge, introduce complete UI build, HTTP/auth,
browser/CSP, accessibility and reviewed visual validation against a separately
published synthetic API fixture; observe real build/e2e/visual jobs pass, add
them to required checks and expand the full canonical gate. Preserve every other
branch protection.

The complete website application has fifteen required checks. Their actual
source and fixtures must arrive through focused publication PRs before this
non-runnable publication can become a runnable application. Once introduced, the
entire application gate runs on every PR regardless of changed paths; the
100-file PR cap is independent of test scope.

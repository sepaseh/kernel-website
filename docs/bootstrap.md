# Foundation phase

[English](bootstrap.md) · [فارسی](bootstrap.fa.md)

This phase contains twelve source files: six contract modules, form helpers and
tests, API-origin validation, locale codes and the public-settings language
loader/tests. `applicationReady:false` is enforced by the
[exact inventory](../.github/bootstrap-policy.json). No Next.js app, catalog
rendering, browser journey, deployment or runtime dependency is included.

After `npm ci`, run `npm run validate -- full`. The
[manifest](../.agents/validation.json) defines eight required checks: snapshot,
audit, closed imports, types, lint, formatting, measured unit tests and measured
governance tests. Run the full current phase before an authorized commit, push
or PR handoff. Use only the isolated exact proposed tree, not omitted source
from the primary checkout.

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
read-only PR-size check. The initial empty main has no trusted PR guard yet.
After a reviewed merge, the [target guard](../.github/workflows/pr-policy.yml)
uses only the immutable `github.workflow_sha` checkout with read-only permissions.
Never execute PR-head or unreviewed base code in that privileged event.
Pagination follows dependent server links sequentially and rejects incomplete
or changing head/base evidence.

Use native CodeRabbit/Sonar/CI and one approving review with resolved
conversations. CodeRabbit automatic review is disabled; request a manual review
only after the [strict preflight](sonarqube.md#before-requesting-coderabbit) passes
for the current head. All required non-CodeRabbit checks and zero OPEN/unresolved
Sonar issues of every severity are mandatory under the approved foundation
check set. Recheck after head changes, respect quotas and avoid duplicate
in-flight requests. See [Contributing](../CONTRIBUTING.md),
[branch protection](branch-protection.md) and [Sonar](sonarqube.md).

Under the explicitly approved non-runnable foundation policy, app build/e2e/visual
jobs are not required. The four native contexts are listed in
[branch protection](branch-protection.md); the closed inventory and
applicationReady:false remain unchanged. No fake jobs or skipped required checks
are used. Before any runnable-app merge, introduce complete UI build, HTTP/auth,
browser/CSP, accessibility and reviewed visual validation against a separately
published synthetic API fixture; observe real build/e2e/visual jobs pass, add
them to required checks and expand the full canonical gate. Preserve every other
branch protection.

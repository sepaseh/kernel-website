# Assistant entry point

Read the [assistant guidance index](.agents/README.md) and
[Contributing](CONTRIBUTING.md) before making changes. Use the
[publication policy](.github/bootstrap-policy.json) to confirm the current phase
and admitted files. Read the applicable rules, source owners and tests. Verify
behavior against the current source and actual checks.

## Scope and safety

Use the existing checkout and preserve unrelated tracked, staged and untracked
work. Get explicit user authorization for any additional worktree, clone or
copied implementation checkout, including when delegating.
[Working-checkout rules](.agents/rules/branches.md#working-checkout)

Use disposable synthetic fixtures. Keep real environments, credentials, keys,
databases, uploads and browser state out of fixtures. Follow the
[safety rules](.agents/rules/safety.md#secrets-and-local-state) for public examples,
private state and authorized access.

Do not read real dotenv files, keys, credentials or operator data. Keep
production out of local tests. Use [settings](.agents/settings.json) and
[source navigation](docs/source-navigation.md) to find the matching rules,
source and tests.

## Published scope

The current phase is `operations` and `applicationReady` is `true`. Use actual
check results to establish acceptance.

## Git and review

Use a verified feature branch and PR for changes to protected `main`.
Honor existing authorization for the same action and scope. Follow the
[Git workflow](.agents/rules/git.md) and
[remote action boundaries](.agents/rules/safety.md#external-systems).
Review the complete diff against the intended base before publication. Follow
the [PR scope rules](.agents/rules/pull-requests.md#before-creation) and the
[review workflow](.agents/skills/review-pr/SKILL.md).

Require explicit user authorization for each commit and each remote effect.
[Action boundaries](.agents/rules/safety.md#authorization)
Use a verified `codex/` branch, keep direct pushes to `main` prohibited and
follow the [Conventional Commit rules](.agents/rules/commits.md).
Preserve [branch protection](docs/branch-protection.md#required-policy).
Apply the [CodeRabbit preflight](.agents/rules/pull-requests.md#coderabbit-request-preflight)
before every manual request. Verify
[current-head approval](docs/reviews.md#verify-approval-and-merge-readiness)
separately from the provider check.

## Verification and documentation

Start with a focused check from the [validation manifest](.agents/validation.json).
Preserve required checks, assertions, type safety, lint and security controls.
Report actual results, failures and unavailable evidence. Follow the
[validation workflow](.agents/skills/validate-change/SKILL.md).

Keep maintained documentation and assistant instructions in English, current
and organized by reader task. Use the [documentation index](docs/README.md)
and the [documentation rules](.agents/rules/guidance.md).

Before an authorized commit, push or PR handoff, run the canonical `full` profile
on a fresh verification-only export of the exact proposed tree.
[Exact-tree validation](.agents/skills/validate-change/SKILL.md#validate-the-exact-tree)

Preserve [coverage and check integrity](.agents/rules/testing.md#coverage-and-check-integrity)
and [synchronize tests with actual events](.agents/rules/testing.md#synchronize-with-actual-events).
Application acceptance requires the production build, this repository's
synthetic HTTP fixture and the reviewed browser for functional, CSP and visual
checks. [Acceptance criteria](docs/application.md#exact-tree-acceptance)

Report actual QA results in the task or terminal. Save a report only when
requested. [Evidence and reports](.agents/rules/guidance.md#record-evidence)

## Source boundaries

- Preserve [feature and UI ownership](.agents/rules/website.md#ownership-and-boundaries),
  [import boundaries and framework entry points](.agents/rules/imports.md#enforce-boundaries),
  [HTTP behavior](docs/server-boundary.md#browser-http-client),
  [session and form ownership](.agents/rules/website.md#request-and-form-ownership)
  and [document policies](.agents/rules/website.md#language-and-document-support).
- Keep runner, browser and delivery imports inert. Check readiness before
  reading inputs, resolving tools, writing output or starting children. Only
  owned synthetic roots may declare readiness for guard tests. Keep the real
  marker unchanged when testing a guarded operation. [Runner readiness](docs/runner-foundation.md#readiness-and-imports) · [Process ownership](docs/runner-foundation.md#inputs-and-process-ownership)
- Use the reviewed installed SDK and an explicitly filtered browser parent
  environment. Preserve baseline bytes and review dates until an authorized
  update has actual visual review. Baseline updates are forbidden in CI.
  [Browser inputs](docs/browser-foundation.md#dependency-and-input-boundaries) · [Baseline procedure](docs/visual-regression.md#update-a-baseline-intentionally)
- Keep [manual operations and advisory measurements](docs/release-operations.md#choose-the-operation)
  separate from required checks. Obtain authorization for their actual effects
  and report results from actual execution. [Operational safeguards](docs/release-operations.md#prepare-observe-and-clean-up)

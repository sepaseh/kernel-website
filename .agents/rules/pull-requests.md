# Pull requests

Use the [contribution guide](../../CONTRIBUTING.md#publish-and-review) and
[pull request template](../../.github/PULL_REQUEST_TEMPLATE.md).

## Before creation

- Verify the intended base from the request or repository metadata. Review the
  complete base-to-head diff for unrelated work.
- Count additions, deletions, renames and binaries. Count one entry per rename.
- Aim for 80 or fewer GitHub changed-file entries initially. Split independent
  changes when useful and explain why a larger cohesive change belongs together.
  File count is advisory. Exceeding 100 entries alone must not fail CI or require
  deleting and recreating a PR.
- For a stack, target the verified predecessor and state the dependency.
- [Validate the exact tree](../skills/validate-change/SKILL.md#validate-the-exact-tree).
  Revalidate when proposed bytes change.
- Follow the [commit title conventions](commits.md). A squash merge uses the PR
  title for the release commit.

## Body and linkage

- Explain the problem, chosen approach and resulting behavior.
- Use `Closes #123` or `Fixes #123` only when the pull request fully resolves an issue.
- Use `Refs #123` or `Related to #123` when linkage is contextual or partial.
- Report only checks actually run and disclose limitations or residual risks.
- Include screenshots or recordings for visible UI changes.

## Publish a pull request

- Disclose pending hosted CI after creation. Honor the user's Ready for review or
  draft preference after the required local work passes.

## Provider evidence and required checks

- Verify current-head producer results and substantive provider evidence under
  [branch protection](../../docs/branch-protection.md). Keep required checks
  active and report missing, failed, pending, skipped or quota-limited evidence
  accurately.
- Verify measured coverage against the attested Git tree and describe its actual
  scope. Follow [Sonar verification](../../docs/sonarqube.md) for project binding,
  scanner execution and the separate quality gate. Follow the
  [secrets rules](safety.md#secrets-and-local-state) when checking integration settings.
- A `pull_request_target` guard must execute only trusted default-branch code,
  pinned to the immutable workflow commit with `github.workflow_sha`. Never execute
  unreviewed PR head/base code in that context; keep token permissions minimal.

## CodeRabbit request preflight

Follow the [current-head preflight](../../docs/reviews.md#before-requesting-coderabbit)
and record the revision, matching Sonar analysis/report link and full issue
count. A skipped review or unanalysed project supplies no preflight evidence.
An open false positive blocks the request until an authorized classification or
a real fix with fresh analysis resolves it. Keep the required checks intact and
follow the [analysis rules](code-quality.md#static-analysis-findings).
When preflight and [remote authorization](safety.md#external-systems) both allow
the request, post only `@coderabbitai review` once.

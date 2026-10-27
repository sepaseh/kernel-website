# Pull requests

A pull request explains why a change is needed, what changed, and how to verify
it. Use the repository's pull-request conventions in `CONTRIBUTING.md`.

## Before creation

- Verify the intended protected base and relevant branch context rather than
  assuming main. Review the complete base-to-head diff for unrelated work.
- Keep the PR at 100 or fewer GitHub changed-file entries, counting additions,
  deletions, renames and binaries. A rename counts as one GitHub entry.
- Run the declared phase's required gate on an isolated checkout/export of the
  exact proposed commit snapshot. Record the phase, commit/tree and actual checks.
  A full pass over local untracked source does not validate a partial published PR.
  Publishing runnable code still requires the full canonical application gate in
  `CONTRIBUTING.md`; bootstrap evidence cannot replace it.
- Use a Conventional Commit title; squash merging makes it the release commit.
- Keep one website PR open at a time. Later packages may be prepared locally;
  do not publish another branch or PR until the current PR is actually merged
  and the requested workflow authorizes publication. Reconcile the merged main
  with the tested base instead of assuming the prepared package is still exact.

## Body and linkage

- Explain the problem and chosen approach, not just changed files.
- Use `Closes #123` or `Fixes #123` only when the pull request fully resolves an issue.
- Use a contextual reference for partial work. Use an existing host template
  only after checking that it exists; do not invent local forms or host features.
- Report only checks actually run and disclose limitations or residual risks.
- Include screenshots or recordings for visible runnable UI changes. A phase
  with no page or CSS pipeline must state that limit rather than fabricate an
  image or claim browser verification.
- Create authorized pull requests ready for review (`draft: false`), unless the
  user explicitly requests a draft. Report pending provider checks accurately;
  readiness does not waive local validation, review or protected merge checks.

## Provider evidence and required checks

- Merging requires the ordinary native CI, CodeRabbit and SonarCloud checks,
  at least one approving review and resolved review conversations. Apply
  protection to administrators, dismiss stale approvals and require an up-to-date
  branch. Use the native approval count; no separate publisher or custom approval
  check is required. See [branch protection](../../docs/branch-protection.md).
- Verify actual provider evidence for the current PR head. Missing, pending,
  failed, skipped or quota-limited review/analysis must not be reported as a
  completed review or passing analysis. Do not waive currently required checks
  outside an explicitly authorized phase-policy change.
- Inspect actual check details, review results and project binding for the latest
  PR head. Configuration files, installed apps and a successful status alone do
  not prove analysis or review ran; success may represent a skipped review.
- Before any initial or renewed CodeRabbit request, complete the strict
  [review-request preflight](#before-requesting-coderabbit). A skipped automatic
  review does not waive it. Do not infer actual review from configuration.
- Treat Sonar scanner execution and its provider quality gate as separate results.
  Import genuinely measured LCOV from the same checkout and describe its actual
  source scope. Do not attribute governance-script coverage to unpublished runtime
  code. For setup/status checks, inspect secret names only, never token values.
- Verify each repository independently; working integration in another repository
  does not establish this repository's activation or successful execution.
- A `pull_request_target` guard must execute only trusted default-branch code,
  pinned to the immutable workflow commit with `github.workflow_sha`. Never execute
  unreviewed PR head/base code in that context; keep token permissions minimal.

## Before requesting CodeRabbit

Do not request an initial CodeRabbit review or re-review until this preflight
passes for the exact current PR head:

- Verify **all required non-CodeRabbit checks** have completed successfully,
  including the actual Sonar scanner run and provider quality gate. Use the
  explicitly approved phase-specific check set in
  [branch protection](../../docs/branch-protection.md). The non-runnable foundation
  does not require app `build`, `e2e` or `visual` jobs under that approved policy;
  currently required checks cannot otherwise be bypassed.
  Exclude only CodeRabbit's own check and approval from this preflight to avoid
  a circular dependency.
- Inspect the latest applicable Sonar PR/branch report for the same head and
  source scope. Establish **zero OPEN/unresolved issues of every severity**,
  including existing issues; a passing quality gate or zero new-code issues
  is insufficient. Verify complete issue results and pagination, not an empty
  project's counters or a filtered subset.
- Missing, pending, skipped, failed or unavailable checks, an absent/mismatched
  analysis, or missing complete zero-issue evidence **blocks the request**.
  Record the head SHA, required-check results and exact Sonar analysis/report.
- A finding described locally as a suspected false positive still blocks while
  the provider keeps it OPEN. An actual correction plus fresh analysis, or a
  separately authorized provider classification, must appear in the real report
  before this gate can pass. Do not add suppressions, exclusions or analyzer-only
  indirection to bypass the gate.
- A new commit/head change invalidates the preflight. Rerun it after fixes before
  requesting another review. Wait at least one hour since both the latest
  request and the latest substantive website review, and obey any longer
  provider retry limit. Do not duplicate a request or accepted review already
  in flight for the head. A skipped or conversational COMMENTED response is
  not substantive code review.
- Only after this preflight and explicit authorization may one manual
  `@coderabbitai review` be requested. A quota-limited/skipped response is not
  completed review evidence; wait for allowance and recheck the current head.

Before any runnable-app merge, introduce real UI build, browser/CSP and visual
jobs, observe them pass for the proposed head, add `build`, `e2e` and `visual`
to required checks and expand the full canonical application gate. Preserve
approval, strict/admin, stale-review, conversation, linear-history and
no-force-push/deletion protection. Foundation checks do not prove app readiness.

See [Contributing](../../CONTRIBUTING.md), [the phase guide](../../docs/bootstrap.md),
[testing](testing.md), [Sonar guidance](../../docs/sonarqube.md) and [safety](safety.md).

Do not create, update, mark ready, merge, or close a pull request without
explicit authorization for that remote action. Authorization already given
for the requested workflow persists; do not add a redundant approval step.

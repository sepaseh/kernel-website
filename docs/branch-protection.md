# Protect pull request merges

Verify the live repository identity and actual protection before relying on it.
Files and configured integrations do not themselves protect a branch.

## Required policy

Protect main and every actual branch used as a PR base, including verified
predecessors in a stack. Publication grants no merge or bypass.
Require one approving review, dismiss stale approvals, resolve conversations,
keep strict up-to-date checks, enforce for administrators and require linear
history. Allow neither force pushes nor branch deletion. Add no bypass actors.

| Required check             | Expected GitHub App              |
| -------------------------- | -------------------------------- |
| `check`                    | GitHub Actions `15368`           |
| `CodeQL`                   | GitHub Advanced Security `57789` |
| `SonarQube Cloud analysis` | GitHub Actions `15368`           |
| `SonarCloud Code Analysis` | SonarQube Cloud `12526`          |
| `CodeRabbit`               | CodeRabbit `347564`              |

The native `CodeQL` security result is required separately from its Actions
analysis job. A successful scanner job alone is not the native result.
The [CodeQL workflow](../.github/workflows/codeql.yml) must analyze every actual
PR base, including protected predecessors in an explicitly authorized stack.
It analyzes JavaScript/TypeScript and GitHub Actions together in one job using
`security-extended`. CodeQL is a hosted security gate, distinct from the local
actionlint syntax/expression check in the static profile.

The [CI analysis job](../.github/workflows/ci.yml) skips fork PRs because they
cannot receive the analysis secret. Both required Sonar results remain merge
blockers for those PRs. A maintainer must review the proposed source and workflow
changes, then publish the reviewed commits on an in-repository branch and open
an in-repository replacement PR linked to the original contribution. Wait for
its exact head to pass `SonarQube Cloud analysis`, `SonarCloud Code Analysis`
and every other required check under ordinary protection before merging.
A topic-branch push alone does not trigger this workflow. Preserve the fork
guard; do not expose secrets to fork source or remove required checks.

Use the native approving-review count and provider `CodeRabbit` check.
A native approval count does not select a particular bot, and a skipped or neutral
provider check does not establish a substantive current-head review.
Inspect actual provider evidence before claiming approval.
There is no separate approval publisher, review-signal check or PR file-limit gate.
PR scope guidance is advisory and reviewed before opening a PR.

CI displays static checks, dependency audit, unit tests and governance tests as
separate jobs. The required `check` job aggregates their outcomes without
installing dependencies or rerunning checks. It fails for a failed, skipped,
cancelled or missing producer.

Each test suite measures its own coverage once and publishes an immutable
suite/run/attempt artifact. Analysis downloads and verifies both artifacts against
the repository, PR head, base, tested commit/tree, workflow and measured LCOV bytes.
Each artifact retains its successful producer attempt when only failed jobs or
analysis are rerun. A passing scanner job remains separate from the native Sonar
quality gate.

## Verify before merging

Read live protection and the latest head's actual checks, approval and resolved
conversations. Do not weaken policy to merge. A merge needs explicit authority.
After a real merge, reconcile the remaining stack against actual main and
rerun exact-tree validation when proposed bytes change. Keep each PR focused and state verified stack dependencies.
[Review preflight](reviews.md) separately governs manual CodeRabbit requests.

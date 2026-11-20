# Verify branch protection

Use this guide to verify live branch protection and the evidence needed to merge
a pull request. Confirm the repository and actual PR base.

## Required policy

Protect main and every actual branch used as a PR base, including verified
predecessors in a stack. Publication grants no merge or bypass.
Require an approving review, dismiss stale approvals, resolve conversations,
require the branch to be up to date and enforce linear history. Block force
pushes, branch deletion and administrative bypass.
Add no bypass actors.

| Required check                 | Expected GitHub App              |
| ------------------------------ | -------------------------------- |
| `check`                        | GitHub Actions `15368`           |
| `CodeQL`                       | GitHub Advanced Security `57789` |
| `SonarQube Cloud analysis`     | GitHub Actions `15368`           |
| `SonarCloud Code Analysis`     | SonarQube Cloud `12526`          |
| `CodeRabbit`                   | CodeRabbit `347564`              |
| `Application build and bundle` | GitHub Actions `15368`           |
| `Application E2E tests`        | GitHub Actions `15368`           |
| `Visual comparison`            | GitHub Actions `15368`           |

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

CI displays static checks, dependency audit, unit and governance tests, the
application build, and separate application E2E, accessibility, SEO, CSP and
visual comparison jobs. The required `check` job aggregates every producer's
outcome without installing dependencies or rerunning checks. It fails for a
failed, skipped, cancelled or missing producer.

Unit and governance each measure coverage once and publish an immutable
suite/run/attempt artifact. Analysis downloads and verifies both artifacts against
the repository, PR head, base, tested commit/tree, workflow and report bytes.
The governance artifact includes the Python font verifier's coverage XML.
Each artifact retains its successful producer attempt when only failed jobs or
analysis are rerun. A passing scanner job remains separate from the native Sonar
quality gate.

## Verify before merging

1. Confirm the intended base uses the live protection settings above and the
   exact PR head is current with that base.
2. Verify the required check names, providers and successful results for that
   head. Confirm the substantive approval and resolve every conversation.
   Use [review preflight](reviews.md) for manual CodeRabbit requests.
3. Confirm the head again immediately before an authorized merge. After merging,
   reconcile any remaining stack against the actual base and rerun
   [exact-tree validation](validation.md) when the proposed bytes change.

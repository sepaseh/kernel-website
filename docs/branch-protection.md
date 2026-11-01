# Protect pull request merges

Verify the live repository identity and actual protection before relying on it.
Files and configured integrations do not themselves protect a branch.

## Required policy

Protect main and every actual branch used as a PR base. An explicitly
authorized stack requires the same protection on each predecessor base before
its dependent PR is published; authorizing a stack grants no merge or bypass.
Require one approving review, dismiss stale approvals, resolve conversations,
keep strict up-to-date checks, enforce for administrators and require linear
history. Allow neither force pushes nor branch deletion. Add no bypass actors.

| Required check             | Expected GitHub App     |
| -------------------------- | ----------------------- |
| `check`                    | GitHub Actions `15368`  |
| `PR file limit`            | GitHub Actions `15368`  |
| `SonarQube Cloud analysis` | GitHub Actions `15368`  |
| `SonarCloud Code Analysis` | SonarQube Cloud `12526` |
| `CodeRabbit`               | CodeRabbit `347564`     |
| `CodeRabbit approval`      | GitHub Actions `15368`  |

The trusted [review verifier](../scripts/review-policy.mjs) checks actual
current-head bot approval and the provider's completed check.
An approval count alone does not select one bot, and a skipped/neutral provider
check does not establish a substantive review.
[The policy workflow](../.github/workflows/review-policy.yml) runs trusted
default-branch policy; [the review signal](../.github/workflows/review-signal.yml)
does not execute PR source with privileged access.
The [file-limit workflow](../.github/workflows/pr-policy.yml) uses trusted
immutable workflow source, read-only permissions and no PR-head execution.

## Initial publication

The new repository initially contains only a README. Trusted default-branch
checks cannot run before their workflows exist on main.
Registering required names does not manufacture their first result.
Missing checks remain blockers; no bootstrap waiver, direct push, protection
bypass or merge is authorized by opening the first PR.

## Verify before merging

Read live protection and the latest head's actual checks, approval and resolved
conversations. Do not weaken policy to merge. A merge needs explicit authority.
After a real merge, reconcile the remaining stack against actual main and
rerun exact-tree validation when proposed bytes change. The default remains
one open PR unless the user explicitly authorizes a stack.
[Review preflight](reviews.md) separately governs manual CodeRabbit requests.

# Branch protection

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

Use GitHub's native protection with one approving review, resolved conversations,
stale-approval dismissal, an up-to-date branch and administrator enforcement.
Disable force pushes and deletion. Remote changes require explicit authorization.

| Native check                      | App                    |
| --------------------------------- | ---------------------- |
| `check`, `build`, `e2e`, `visual` | GitHub Actions `15368` |
| `CodeRabbit`                      | CodeRabbit `347564`    |
| `SonarCloud Code Analysis`        | SonarCloud `12526`     |

The foundation provides an actual `check` job and a separate **SonarQube Cloud
analysis** job. It does not provide application `build`, `e2e` or `visual`
jobs. Existing requirements for those jobs remain blocked; this source change
does not remove them, fabricate success or authorize protection changes.

CodeRabbit automatic review, incremental review and draft review are disabled.
Request one manual review per authorized PR. Automatic approvals remain enabled
and author-command approval is disabled. A skipped or quota-limited progress
status is not a substantive current-head review.

Verify actual current-head checks, App identities, review results and Sonar
quality gate. One native approval uses GitHub's ordinary count. No custom
publisher or dedicated approval App is required. See [Sonar setup](sonarqube.md)
and the [phase guide](bootstrap.md). Before any authorized runnable-phase
protection migration, observe the real replacement checks.

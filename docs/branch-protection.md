# Phase-aware branch protection

[English](branch-protection.md) · [فارسی](branch-protection.fa.md)

The **foundation**, **localization**, **server-boundary**, **client-document**, **client-ui** **feature-ui**, **guidance** and **integration-tooling** phases remain non-runnable with
`applicationReady:false` and explicit source inventories. All these phases require
these native checks:

| Required published-phase check | Expected GitHub App         |
| ------------------------------ | --------------------------- |
| `check`                        | GitHub Actions, App `15368` |
| `PR file limit`                | GitHub Actions, App `15368` |
| `SonarQube Cloud analysis`     | GitHub Actions, App `15368` |
| `SonarCloud Code Analysis`     | SonarCloud, App `12526`     |
| `CodeRabbit`                   | CodeRabbit, App `347564`    |

The real check job validates the published scope; the scanner job and the
provider quality gate are distinct requirements. App `build`, `e2e` and
`visual` jobs are outside this non-runnable publication policy. No fake
job, skipped check or claim of application readiness substitutes for them.

The trusted `PR file limit` job is a separate required Actions context. Its
default-branch workflow uses an immutable `github.workflow_sha` checkout and
read-only permissions; never execute PR-head code in that privileged event.
The ordinary PR CI also checks the limit before installing dependencies.

Keep all other protections: one approving review, resolved conversations,
dismissal of stale approvals, strict up-to-date checks, administrator enforcement,
linear history and no force pushes or branch deletion. A native approval count
does not itself bind approval to one bot. CODEOWNERS suggests reviewers; it does
not configure protection. Remote policy changes require explicit authorization
and verification of the actual context names and App identities.

Before **any runnable-app merge**, introduce the real UI build, browser/CSP and
visual jobs, observe them pass on the proposed head, **add `build`, `e2e` and
`visual` to required checks**, and expand the full canonical validation gate.
Use the independently published synthetic API fixture for HTTP/auth/browser
evidence. Foundation validation cannot establish runnable-app readiness.

Manual CodeRabbit requests still require the [strict preflight](sonarqube.md#before-requesting-coderabbit):
all current required non-CodeRabbit checks must pass for the latest head and the
applicable Sonar report must have zero OPEN/unresolved issues of every severity.
A locally documented false positive remains a blocker while OPEN in the
provider. Recheck new heads, respect quotas and avoid duplicate in-flight reviews.
Automatic approvals remain enabled; author-command approval is disabled. A
skipped review is not substantive review evidence.

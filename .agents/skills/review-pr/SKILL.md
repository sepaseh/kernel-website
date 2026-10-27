---
name: review-pr
description: Review a Kernel pull request for actionable defects.
---

# Review a pull request

Read `.agents/rules/git.md`, `.agents/rules/code-review.md`,
`.agents/rules/pull-requests.md`, and `.agents/rules/safety.md`.

1. Confirm the repository and PR. Read its title, body, linked issue/acceptance criteria, relevant comments, checks, commits and complete diff.
2. Inspect relevant implementation, tests, local HTTP contracts and documentation.
3. Evaluate the affected dimensions in `code-review.md`; do not treat CI as a substitute for review.
4. Report actionable findings first, ordered by priority, with tight locations and failure scenarios.
5. Submit a remote review only when the user explicitly authorizes it.
6. If requesting an initial CodeRabbit review or re-review, first apply the canonical [preflight](../../rules/pull-requests.md#before-requesting-coderabbit). Every required non-CodeRabbit check, including scanner and actual Sonar quality gate, must pass for the current head; the applicable Sonar report must have zero OPEN/unresolved issues of all severities. Missing evidence blocks the request. A new head invalidates it; respect quotas and never duplicate an in-flight review for that head.

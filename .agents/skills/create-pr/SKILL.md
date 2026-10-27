---
name: create-pr
description: Prepare or create a focused Kernel pull request.
---

# Create a pull request

Read `.agents/rules/git.md`, `.agents/rules/pull-requests.md`,
`.agents/rules/commits.md`, and `.agents/rules/safety.md`. Use
`validate-change` for the readiness gate.

1. Confirm the repository, head branch, base branch, and whether remote creation is authorized.
2. Review the complete diff and commits against the base branch; exclude unrelated or generated changes.
3. Run the complete gate required by `CONTRIBUTING.md`.
4. Draft a Conventional Commit title and explain the problem, approach, verification, and limitations.
5. Check the user's existing authorization for commit, push and PR creation or readiness. Ask only for a remote action not already covered. Preparation stays local; keep the next package unpublished while the current website PR remains open. After its verified merge, reconcile actual main and rerun the full gate if the tested tree changes.
6. Before requesting CodeRabbit, apply the canonical [preflight](../../rules/pull-requests.md#before-requesting-coderabbit): all required non-CodeRabbit checks must pass and the latest matching Sonar report must have zero OPEN/unresolved issues of all severities. This applies to initial and repeated requests; exclude only CodeRabbit's own check/approval, recheck after a new head, respect quotas and avoid duplicate in-flight requests.

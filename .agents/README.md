# Website assistant guidance

[AGENTS.md](../AGENTS.md) is the entry point; [settings](settings.json) indexes local rules, skills and optional hooks. [Navigation](navigation.json) maps only published owners, contracts and tests. [Validation](validation.json) is the canonical command inventory; [evaluation](evaluation/cases.json) supplies source-grounded questions.

Read the [source marker](../.github/bootstrap-policy.json) and [phase guide](../docs/bootstrap.md) before selecting checks or claiming readiness. [Application integration](../docs/application.md) defines future composition and acceptance separately from current source. A false marker keeps core operations guarded; a true marker alone proves no successful execution. Machine navigation must not invent unpublished owners.

Visual work starts with [DESIGN](../DESIGN.md) and the [design skill](skills/design-ui/SKILL.md). Source, executed tests, current browser/visual evidence and external design artifacts have separate scopes. Optional Claude adapters point to this guidance; files do not prove automatic loading, design-tool setup or model performance.

Assistant instructions, rules, skills and evaluation prompts are English only. Human guides have complete reciprocal English/Persian companions. Use [guidance evidence](rules/guidance.md), [source navigation](../docs/source-navigation.md), [evaluation](../docs/comprehension-evaluation.md) and [ADRs](../docs/adr/README.md).

Git work starts with [Git policy](rules/git.md), [branches](rules/branches.md), [Contributing](../CONTRIBUTING.md) and the matching skill. Preserve authorization already given. Before authorized commit/push/handoff run the complete exact isolated-tree gate. Prepare later packages locally while a website PR is open; reconcile actual merged main before next publication. Authorized PRs are ready for review and at most 100 changed entries.

The four optional hooks require host integration. The Bash safety wrapper delegates to the Node guard and fails closed without Node; post-edit formatting is scoped to its verified owner file, and fast quality checks never replace full validation. Synthetic hook tests establish only tested behavior. Dependabot version-update limits remain zero; security-update settings are separate.

[Testing](../docs/testing.md), [runners](../docs/runner-foundation.md), [browser tooling](../docs/browser-foundation.md) and [the API contract](../docs/api-fixture.md) distinguish synthetic guard tests from actual independently installed API/browser evidence. Imports remain inert, readiness first, fixtures explicit and cleanup owned. [Delivery](../docs/deployment.md) and [operations](../docs/release-operations.md) retain separate acceptance and authorization.

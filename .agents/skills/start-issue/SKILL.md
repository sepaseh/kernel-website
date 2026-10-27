---
name: start-issue
description: Begin implementation of an existing issue when the user asks to work on, fix or implement it; inspect its evidence and acceptance criteria and establish a safe local scope and branch. Do not use merely to publish findings or change issue metadata.
---

# Start an issue

Read [Git workflow](../../rules/git.md), [issues](../../rules/issues.md),
[branches](../../rules/branches.md) and [safety](../../rules/safety.md).

1. Confirm the actual repository and issue identifier. Read supplied local
   context or relevant authorized remote metadata, comments and linked work;
   verify the claim against current source rather than relying on its title.
2. Separate facts, unknowns, acceptance criteria and real dependencies. Find
   owners through [navigation](../../navigation.json), read matching rules and
   form a scoped implementation/validation plan. Clarify only missing decisions
   that materially block that work; continue useful independent investigation.
3. Inspect branch/status and preserve existing changes. Reuse a matching branch
   or establish an authorized branch from a verified base. Preserve an unborn
   working tree without inventing a base commit.
4. Implement the requested outcome and select relevant checks through
   [validate-change](../validate-change/SKILL.md). Handle already-resolved or
   duplicate issues with concrete evidence rather than silently expanding scope.
5. Report the interpreted scope, branch if established, outcome, checks and
   remaining uncertainty. Do not invent an issue, labels or permissions, or
   assign, comment, change status, create a PR, commit or push without the
   authorization needed for that specific action.

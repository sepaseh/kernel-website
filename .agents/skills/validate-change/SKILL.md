---
name: validate-change
description: Select Kernel checks for the actual change and run the complete canonical gate before an authorized commit, push or PR handoff.
---

# Validate a change

Read the [publication policy](../../../.github/bootstrap-policy.json) for the
phase, readiness and admitted files. Read the affected source, tests and rules.
Inspect the working tree and staged changes under the
[working-checkout rule](../../rules/branches.md#working-checkout).

## Choose affected checks

Start with the smallest relevant published check from the
[validation manifest](../../validation.json). Add a focused regression for
changed observable behavior under the [testing rules](../../rules/testing.md).

## Validate the exact tree

Before an authorized commit, push or PR handoff, follow the
[exact-tree procedure](../../../docs/validation.md). Compare the proposed source
with a fresh verification-only export. Use its empty npm configuration, locked
installs and synthetic fixtures. Run `npm run validate -- full` in that export.

Follow [check integrity](../../rules/testing.md#coverage-and-check-integrity)
and report any required check that blocks staging or committing.

Resolve required failures within the task's scope and reverify. Preserve
required checks, genuine failing assertions and coverage. Leave staging and
committing pending while a required check fails or cannot run.

## Report evidence

Report the phase, readiness, checked revision or tree, commands, actual results
and unavailable checks. Use the
[provider evidence rules](../../rules/pull-requests.md#provider-evidence-and-required-checks)
for hosted checks and approval, and the
[guidance evidence rules](../../rules/guidance.md) for instruction discovery.

Record a fingerprint when the verification procedure uses one. Follow the
[website evidence rules](../../rules/guidance.md#record-evidence) for skipped
checks and known limits.

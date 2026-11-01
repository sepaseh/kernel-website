---
name: validate-change
description: Select focused governance checks and validate the exact proposed publication tree.
---

# Validate a change

Read [source scope](../../../docs/bootstrap.md), [the manifest](../../validation.json),
[Contributing](../../../CONTRIBUTING.md) and matching rules.

1. Inspect changed owners, tests and the actual declared inventory.
2. During development run the smallest affected owner tests and semantic checks.
3. Before each authorized commit, push or PR handoff, follow
   [exact-tree validation](../../../docs/validation.md): a disposable export of
   actual proposed bytes, fresh locked npm installation with empty configuration,
   then all nine full-profile checks.
4. Keep unit coverage at 90% and governance coverage at 80%; preserve measured scope.
5. Correct in-scope failures and rerun affected checks. Do not stage/commit with
   a failed or unavailable required check, suppress a finding or invent a pass.
6. Report exact source/tree, commands, failures/skips, cleanup and limits.
   Governance evidence does not establish application, browser or provider readiness.

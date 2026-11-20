# Change handoff and implementation plan

Use this handoff for a feature, defect or tooling change. Keep the filled record
with local task evidence or an authorized issue or PR. Creating remote metadata,
sending messages, committing and publishing each require authorization for their
actual effect.

## Establish the change contract

- Record the request, source and date. Distinguish required, proposed, conditional
  and out-of-scope items. A roadmap topic alone is not a product requirement.
- Name the repository/source owner and affected HTTP consumers. Local contracts
  and catalogs belong here; coordinate observable wire compatibility when needed.
- Read [navigation](source-navigation.md), full owner source, contracts, rules and
  tests. Record current behavior and the failure, including relevant dirty or
  untracked source without reading real environments, private state or secrets.
- Write observable acceptance scenarios with the trigger, expected result,
  failure or authorization boundary and verification. Include relevant session
  races, language and cache privacy, and recovery behavior.
- Verify the [admitted source](../.github/bootstrap-policy.json) and the
  [application acceptance requirements](application.md). Use actual execution
  evidence for the exact tree when recording build, browser or deployment results.

## Reusable task record

Copy and fill this record. Placeholders are not completed evidence.

```text
Request/source/date:
Required items and explicit exclusions:
Owner and affected consumers:
Baseline commit/tree and dirty/untracked source scope:
R1: Given ... when ... then ...; verify with ...
R2: Invalid/stale/unauthorized ... must ...; verify with ...
Dependencies or operator decisions still needed:
Small ordered implementation steps and owning files:
HTTP/data compatibility and rollback:
Synthetic fixtures, owned resources and cleanup:
Validation IDs/profile from .agents/validation.json:
Manual or external checks not run:
Observed results, first failure, reproduction and skips:
Remaining recommendations and owner:
```

Prefer the smallest coherent implementation. Keep API behavior in its service and
presentation in the website. Product/provider integrations need an actual
requirement. Explain durable architectural changes in the relevant current guide, including their consequences.

Select commands from the [canonical manifest](../.agents/validation.json) and
follow the [validation procedure](validation.md). Record the proposed tree, tests
run, first failure and any skipped or unavailable evidence. Reproduce failures
with synthetic inputs and explain corrections. Preserve required checks, tests
and thresholds.

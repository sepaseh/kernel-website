# Change handoff and implementation plan

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use this handoff for a feature, defect or tooling change. It is a portable planning
record, not an AI runtime or a requirement to use one assistant. Keep the filled
record with local task evidence or an authorized issue/PR. Creating remote metadata,
sending messages, committing and publishing need authorization for their actual effect.

## Establish the change contract

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
[contribution policy](../CONTRIBUTING.md), rather than maintaining another complete
gate. Record source changes, configured workflows and actually executed checks
separately. Preserve first-failure evidence, reproduce with synthetic inputs and
explain any correction; never hide a failure through retries, skipped tests,
suppression or weakened thresholds. Do not infer a manual screen-reader review,
hosted result, production recovery or assistant benchmark from source inspection.

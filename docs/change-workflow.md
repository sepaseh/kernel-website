# Change handoff and implementation plan

[English](change-workflow.md) · [فارسی](change-workflow.fa.md)

Use this handoff for a feature, defect or tooling change. It is a portable planning
record, not an AI runtime or a requirement to use one assistant. Keep the filled
record with local task evidence or an authorized issue/PR. Creating remote metadata,
sending messages, committing and publishing need authorization for their actual effect.

## Establish the change contract

- Record the request, source and date. Distinguish required, proposed, conditional
  and out-of-scope items. A roadmap topic alone is not a product requirement.
- Name the repository/source owner and affected HTTP consumers. Local contracts
  and catalogs belong here; coordinate observable wire compatibility when needed.
- Read [navigation](source-navigation.md), full owner source, contracts, rules and
  tests. Record current behavior and the failure, including relevant dirty or
  untracked source without reading real environments, private state or secrets.
- Write observable acceptance scenarios: trigger, result, failure/authorization
  boundary and verification. Include applicable session races, language/cache
  privacy and recovery behavior.
- Read the publication marker and exact source inventory. Distinguish a
  false-marker prerequisite from application activation under the
  [application contract](application.md). Source, authored suites and historical
  results do not establish current build, browser or deployment execution.

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
requirement. Record a durable architectural change in an ADR and update the matching
English/Persian explanation.

Select commands from the [canonical manifest](../.agents/validation.json) and
[contribution policy](../CONTRIBUTING.md), rather than maintaining another complete
gate. Record source changes, configured workflows and actually executed checks
separately. Preserve first-failure evidence, reproduce with synthetic inputs and
explain any correction; never hide a failure through retries, skipped tests,
suppression or weakened thresholds. Do not infer a manual screen-reader review,
hosted result, production recovery or assistant benchmark from source inspection.

# Source comprehension evaluation

[English](comprehension-evaluation.md) · [فارسی](comprehension-evaluation.fa.md)

[Case specifications](../.agents/evaluation/cases.json) cover the published source
boundaries. Each case has an English prompt, task IDs, local evidence, check IDs
and observable positive/negative criteria. The active assistant specification is
English-only; this human guide has a Persian companion. A case file is not an
executed benchmark or proof that an assistant discovered instructions.

## Run and record a bounded evaluation

1. Identify the exact commit/tree plus any dirty/untracked source in scope. Exclude
   real environments, credentials, private state and unrelated checkout contents.
2. Give a fresh subject the prompt and an allowlisted source snapshot. Keep answer
   criteria, previous answers and historical QA outside the subject's input.
   Independently verify source fingerprints.
3. Record the exposed host/model/version, configuration, allowed tools, source
   scope and observed loading in [run template](../.agents/evaluation/run-template.json).
   If loading is not observable, leave it not-verified. Keep unavailable
   time/token/cost fields null rather than estimating them as measurements.
4. Evaluate source-grounded answers against the criteria. Record partial coverage,
   missing evidence, assumptions and limits. A clarified prompt is a new trial,
   not permission to silently rescore an older answer.

Bind every trial to its publication marker and inventory. A false-marker
prerequisite contains tested local support, forms, runner guards and authored
browser cases; it does not establish application execution. For an application
trial, expose only the actually published composition and matching evidence
required by the [application contract](application.md). Distinguish accepted
architecture from implemented source and local tests from hosted/browser results.
Never require files absent from the subject snapshot or credit invented results.

The [guidance checker](../scripts/check-guidance.mjs) checks metadata, paths, links
and command projections. It does not execute an assistant, prove semantic-map
completeness, measure discovery or judge answer quality. The checked-in template
is unrun until a separate record supplies actual observations. Historical studies
belong to their own dated scope and do not establish the current snapshot's results.
Use [navigation](source-navigation.md), [architecture](architecture.md) and the
[canonical manifest](../.agents/validation.json) to identify actual owners and checks.

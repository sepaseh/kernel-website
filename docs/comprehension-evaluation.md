# Evaluate instruction discovery

[Case specifications](../.agents/evaluation/cases.json) cover the published source
boundaries. Each case has an English prompt, task IDs, local evidence, check IDs
and observable scoring criteria. Run a trial to collect evidence about
instruction discovery and answer quality.

## Run and record a bounded evaluation

Keep the evaluation read-only and use only public source and synthetic fixtures.
Give the assistant a fresh session and keep expected answers and scoring criteria
outside its input. Distinguish host-reported instruction loading from files the
assistant opens during the trial. Mark automatic discovery unknown when host
evidence is missing. Verify the answer independently against the scoped source
and available checks.

1. Identify the exact commit/tree plus any dirty/untracked source in scope. Exclude
   real environments, credentials, private state and unrelated checkout contents.
2. Give the assistant the English prompt and an allowlisted source snapshot. Keep
   previous answers and historical QA outside the assistant's input. Independently
   verify source fingerprints.
3. Record the exposed host/model/version, configuration, allowed tools, source
   scope and observed loading in the [run template](../.agents/evaluation/run-template.json).
   Use `not-verified` for unobserved loading and `null` for unavailable time, token
   or cost measurements.
4. Evaluate source-grounded answers against the criteria. Record partial coverage,
   missing evidence, assumptions and limits. A clarified prompt is a new trial,
   not permission to silently rescore an older answer.

Bind every trial to the [source policy](../.github/bootstrap-policy.json) for the
snapshot. For an application trial, expose the admitted composition and matching
evidence described in the [application contract](application.md). Judge the
answer against the files and observed results available to the subject. Keep
architecture, implementation, local checks and hosted or browser execution
distinct when scoring claims.

The [guidance checker](../scripts/check-guidance.mjs) validates published Markdown
links and the settings and task indexes. Its
[tests](../scripts/check-guidance.test.mjs) exercise case and template validation
with synthetic data. Use the trial procedure to observe actual instruction
loading and score an answer. The checked-in template starts in `not-run` state.
Report observations in the task or terminal and save a local report only when
explicitly requested, under ignored `test-results/`.

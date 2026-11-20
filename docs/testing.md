# Write and maintain tests

Run the smallest test that exercises the changed behavior. Use the
[validation manifest](../.agents/validation.json) to select related checks.
Before an authorized commit or PR, run the full profile as described in
[validation](validation.md).
Before an authorized push, follow the same complete exact-tree procedure.

## Select the evidence

| Change                                | Run and inspect                                                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature, component or HTTP adapter    | Colocated Vitest suites. Assert visible results, preserved input, cancellation and session ownership where relevant.                                                           |
| Runner, artifact or repository policy | Colocated Node owner tests or a named integration suite. Check original errors, cleanup, exact input identity and child completion.                                            |
| Full route or visitor journey         | [Functional browser tests](../e2e/website/website.spec.ts) with the delivered app and synthetic API. The suite includes account flows, blog, contact and FAQ across its specs. |
| Accessibility, indexing or CSP        | Dedicated browser profiles. CSP runs in enforce and report-only modes.                                                                                                         |
| Appearance                            | The visual profile with the reviewed Chromium and Windows baseline images. Inspect the captured diffs before changing a baseline. [Visual regression](visual-regression.md)    |
| Fonts                                 | The font integrity check with the hash-locked Python dependencies. [Fonts](fonts.md)                                                                                           |
| Dependency change                     | Fresh locked install, separate online audit and affected suites. The audit wrapper's unit tests mock the subprocess and exercise result handling.                              |

Unit coverage uses 90% thresholds. Node governance tests measure the executable
tooling at 80% or higher. Keep the measured scopes and assertions intact. The
tooling TypeScript project checks the authored browser suites against the
installed SDK types. Actual browser results come from the executed profiles.

## Add a regression

1. Find the responsible source and nearby test. [Source navigation](source-navigation.md)
2. Use synthetic data and disposable resources. For runner readiness checks,
   use dedicated roots owned by the test and keep imports inert. Exercise the
   guard before reading inputs, resolving tools or starting children.
3. Assert the observable outcome and relevant failure, cancellation or cleanup.
   Synchronize on actual readiness and completion. [Test reliability](test-reliability.md)
4. Run the focused test and related checks. Report commands, first failures,
   skips and limits in the task or terminal.

The [boundary check](../scripts/check-boundaries.mjs) traces literal imports,
local bindings, literal container selections and explicit return or yield
expressions. It traces dynamic import values through the first parameter and
explicit returns of locally traceable `.then` callbacks. Review argument flow
through arbitrary calls and other callbacks manually. Keep module namespaces
and builtin loaders in explicit bindings inside their owning file.

## Run application acceptance

Use the [synthetic API](api-fixture.md) with the production website build and
verified Chromium. Browser profiles reuse the prepared standalone output, so
source or output changes require a new build. Hosted CI reuses the exact
successful build artifact, while the local full profile runs the required
checks sequentially within one export. [Validation](validation.md)

The fixture exercises the website's local HTTP contracts. Runner owner tests
use synthetic SDK files and child processes to exercise tooling. External API
compatibility, hosted checks, visual approval and deployed behavior each need
results from their own execution.

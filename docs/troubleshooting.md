# Troubleshoot local setup and checks

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Start with the first failed command and its exact source, toolchain and error.
Fix the cause before rerunning its check. This guidance covers local synthetic
development; it does not authorize contacting an existing API or changing operator
configuration.

For a test that passes on rerun, use [failure investigation](test-reliability.md)
to distinguish a race, missing synchronization, leaked resource or unavailable
dependency. Do not add sleeps, retries, skipped cases, weaker assertions or lower
coverage thresholds to conceal the first failure.

Report findings in the current task or terminal, including failures/skips and
cleanup. Create a local report only on explicit request, under ignored
`test-results/`. Keep real credentials, databases, uploads and operator files out
of reproductions.

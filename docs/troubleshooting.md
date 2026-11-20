# Troubleshoot local setup and checks

Start with the first failed command and its exact error. Identify the source
snapshot and toolchain before changing the implementation or rerunning a check.

## Installation or readiness fails

- If Node reports an engine mismatch or a checker rejects an installed package,
  select the exact version in [.nvmrc](../.nvmrc) and install the lockfile in a
  clean directory. For publication checks, follow [exact-tree validation](validation.md).
- If a runner rejects the source root, confirm that the public
  [source policy](../.github/bootstrap-policy.json) admits the runnable
  application and that the selected root is free of runtime dotenv files.
  Preserve the readiness marker and use a clean verification export if needed.
- If font verification fails to import a tool, activate the pinned CPython
  environment and install the hash-locked packages. [Font verification](fonts.md)

## The website fails to start or show content

1. Confirm that the website and API use distinct free ports. The parent `PORT`
   is the website port, and the fixture derives its own port from `API_BASE_URL`.
2. Start the fixture and wait for its listening message. If the website displays
   a settings error, verify the fixture responds to `GET /settings` on the
   configured loopback API origin.
3. Build and start the website from the same source with the same shell inputs.
   The home page should render at `WEBSITE_URL`.

If a port or lock already has an owner, stop your own launcher or choose another
free port pair and update both URLs. [Local startup instructions](development.md)

## Browser checks fail before opening a page

- For an SDK identity error, reinstall from the lockfile and confirm that
  Playwright and its core package resolve to the reviewed version. For a missing
  executable, install Chromium from the local Playwright CLI with
  `PLAYWRIGHT_BROWSERS_PATH=0`. If the download fails, record the error and the
  browser-dependent checks that could not run. [Browser tooling](browser-foundation.md)
- For a missing or mismatched build record, build the current source with its
  current public test inputs before rerunning the browser profile.
  [Build evidence](validation.md#local-and-hosted-execution)
- For a baseline or capture mismatch, compare the recorded platform and browser
  identity, then inspect any produced images and diffs.
  [Visual comparison](visual-regression.md)

## A result changes on rerun

Preserve the first failure. Investigate readiness, cancellation and cleanup
before changing assertions or metrics. [Test reliability](test-reliability.md)

Report the first failure, any skipped checks and cleanup in the task or terminal.
Use synthetic data and disposable resources for reproductions. Save a local
report under ignored `test-results/` only when requested.

# Check an authorized staging or smoke target

Use these commands to check an explicitly authorized non-production deployment
with the installed Playwright browsers and reviewed website/API URLs. For
local application acceptance, follow [full validation](validation.md).

## Prepare public inputs

Use the Node version in [.nvmrc](../.nvmrc) and its bundled npm. Install the
locked development dependencies from the website root.

```sh
npm ci --include=dev --strict-peer-deps --ignore-scripts --no-audit --no-fund
```

Select the actual artifact and target before running a browser. Supply the
inputs for the selected check.

| Staging input              | Smoke input                    | Value                                             |
| -------------------------- | ------------------------------ | ------------------------------------------------- |
| `STAGING_BASE_URL`         | `SMOKE_BASE_URL`               | Explicit application HTTP(S) base URL             |
| `STAGING_API_HEALTH_URL`   | `SMOKE_API_HEALTH_URL`         | Explicit API health HTTP(S) URL                   |
| `STAGING_ALLOWED_APP_HOST` | `SMOKE_ALLOWED_APP_HOST`       | Exact application hostname only                   |
| `STAGING_ALLOWED_API_HOST` | `SMOKE_ALLOWED_API_HOST`       | Exact API hostname only                           |
| —                          | `SMOKE_DEPLOYMENT_ID`          | Selected immutable deployed release ID            |
| —                          | `SMOKE_EXPECTED_DEPLOYMENT_ID` | Independently expected ID; must equal selected ID |

Use URLs without credentials or control characters. Host allowlists contain no
scheme, path or port. An allowlist match is lexical: review DNS, aliases and
redirect behavior separately. Matching input IDs do not prove a remote identity.
Staging noindex is indexing policy, not access control.

Prepare the target with indexing disabled, a nonce-bearing report-only or
enforcing CSP, working local assets/fonts and an API health response containing
`{"status":"ok"}`. The checks verify these deployed properties; they do not
configure the target. Agree on its synthetic-data and external-scan policy with
its operator before execution.

## Validate without contacting the targets

The following placeholders are reserved example names. Replace them with reviewed
public inputs before actual external execution.

PowerShell:

```powershell
$env:STAGING_BASE_URL = 'https://staging.example.com'
$env:STAGING_API_HEALTH_URL = 'https://api.staging.example.com/health'
$env:STAGING_ALLOWED_APP_HOST = 'staging.example.com'
$env:STAGING_ALLOWED_API_HOST = 'api.staging.example.com'
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node scripts/validate-workflow-targets.mjs staging
```

POSIX shell:

```sh
export STAGING_BASE_URL=https://staging.example.com
export STAGING_API_HEALTH_URL=https://api.staging.example.com/health
export STAGING_ALLOWED_APP_HOST=staging.example.com
export STAGING_ALLOWED_API_HOST=api.staging.example.com
export PLAYWRIGHT_BROWSERS_PATH=0
node scripts/validate-workflow-targets.mjs staging
```

The pure preflight exits zero without opening URLs, resolving DNS, launching a
browser or checking the remote deployment. A failure identifies the rejected
field. Fix that input before continuing; passing this command grants no authority
to contact the target.

## Run the authorized staging check

After target authorization and review, with the inputs above set:

```sh
node node_modules/@playwright/test/cli.js install chromium firefox webkit
npm run test:staging
```

On supported Linux hosts, browser provisioning can additionally require the
installed CLI's `install --with-deps chromium firefox webkit` mode; that installs
OS dependencies and needs the operator's normal host permission. Use the exact
installed SDK, not an unpinned `npx` download.

The wrapper filters its child environment and selects Chromium, Firefox and
WebKit with one worker and no retries. The [scenario](../e2e/operations/staging.spec.ts)
visits `/`, `/login`, `/register` and `/forgot-password`. It checks headings,
noindex, nonce CSP, Axe findings and the API health response `{"status":"ok"}`.
It requires a successful same-origin font, script or stylesheet response and
rejects failed or cross-origin requests for those resource types.

## Run an authorized release smoke check

Set the six `SMOKE_` inputs from the table. For example, in PowerShell:

```powershell
$env:SMOKE_BASE_URL = 'https://staging.example.com'
$env:SMOKE_API_HEALTH_URL = 'https://api.staging.example.com/health'
$env:SMOKE_ALLOWED_APP_HOST = 'staging.example.com'
$env:SMOKE_ALLOWED_API_HOST = 'api.staging.example.com'
$env:SMOKE_DEPLOYMENT_ID = 'candidate-001'
$env:SMOKE_EXPECTED_DEPLOYMENT_ID = 'candidate-001'
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
node scripts/validate-workflow-targets.mjs smoke
```

In a POSIX shell, use `export NAME=value` for those same six inputs and the browser
path. After the pure preflight succeeds and external execution is authorized:

```sh
node node_modules/@playwright/test/cli.js install chromium
npm run test:smoke
```

The [smoke scenario](../e2e/operations/smoke.spec.ts) checks login/register forms,
requires a successful same-origin font, script or stylesheet response and
rejects failures for those resource types. It checks API health and requires
the `/_kernel/release` response to match the selected and expected release ID.

## Read results and finish

Browser outputs stay under ignored `playwright-report/staging` or
`playwright-report/smoke`, with artifacts in the corresponding `test-results`
folder. Failures retain traces/screenshots according to configuration. Stop with
Ctrl+C if necessary and wait for the owned Playwright process to drain; these checks
do not own the external deployment, so they must not stop it or remove its data.
Retain first failures and inspect only the current run's generated artifacts.

## Run an authorized check in GitHub Actions

- For [Staging validation](../.github/workflows/staging.yml), supply
  `application_url` and `api_health_url` matching the configured host allowlists.
- For [Deployment smoke tests](../.github/workflows/deployment-smoke.yml), also
  supply `deployment_id` matching the repository variable
  `SMOKE_EXPECTED_DEPLOYMENT_ID`.

After authorization, select `main` and dispatch the selected workflow. Inspect
the validation step for a rejected input. On browser completion, inspect the
run's Playwright artifact for the actual target and outcome. The artifact name
includes the run ID.

## Check a DAST target before authorizing a scan

[DAST](../.github/workflows/dast.yml) is a separate authorized scan. Its pure
preflight is `node scripts/validate-workflow-targets.mjs dast`, using `DAST_TARGET`,
`DAST_ALLOWED_HOST` and `DAST_PRODUCTION_HOST`. The allowed and denied hostnames
must be independently reviewed before the pinned scanner is dispatched. The workflow
then runs `node scripts/operations-checks.mjs dast-context` to write an exclusive
context under `test-results/dast/authorized.context`. Its anchored, escaped
origin pattern restricts the spider to the selected scheme, hostname and port;
similarly named hosts are outside that context. The pinned scanner imports it
through `-n`; the original target and all technology families remain selected.
This scope is not a DNS, redirect or network-egress boundary. See
[operations](release-operations.md) and [security review](reviews.md).

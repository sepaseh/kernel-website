# Check an authorized staging or smoke target

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use these commands only for an explicitly authorized non-production deployment.
They visit supplied website/API URLs and use installed local browsers; they do
not start a local API fixture or deploy an application. Local application
acceptance uses the separate [API fixture](api-fixture.md) and
[full validation](validation.md).

## Prepare public inputs

Use the pinned Node/npm toolchain and a fresh `npm ci --include=dev` installation. Select the
actual artifact and target before running a browser. The required inputs are:

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
WebKit with one worker and no retries. The authored scenario visits `/`, `/login`,
`/register` and `/forgot-password`; it checks visible headings, local asset
responses, noindex, nonce CSP, Axe findings and the explicit API health response
`{"status":"ok"}`. Success means those cases passed for that actual target and
browser set, not complete accessibility or deployment acceptance.

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

Smoke checks login/register forms, asset responses, the actual
`/_kernel/release` JSON marker and API health. It requires the selected and
expected IDs to agree and the remote marker to match them. A marker alone cannot
identify all running website bytes.

## Read results and finish

Browser outputs stay under ignored `playwright-report/staging` or
`playwright-report/smoke`, with artifacts in the corresponding `test-results`
folder. Failures retain traces/screenshots according to configuration. Stop with
Ctrl+C if necessary and wait for the owned Playwright process to drain; these checks
do not own the external deployment, so they must not stop it or remove its data.
Retain first failures and inspect only the current run's generated artifacts.

The main-only [staging](../.github/workflows/staging.yml) and
[deployment-smoke](../.github/workflows/deployment-smoke.yml) workflows map manual
URL inputs to these same contracts and repository-variable host allowlists.
Dispatch requires separate remote authorization. Their source does not establish
a completed hosted run.

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

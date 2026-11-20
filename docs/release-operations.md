# Choose and run an operational check

Complete [application validation](validation.md) before preparing a release.
Choose the manual operation or advisory measurement for the outcome you need.

## Choose the operation

| Purpose                        | Command                                  | Inputs and expected output                                                                     | Procedure                                      |
| ------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Package an existing build      | `npm run deploy:package -- --release=ID` | Verified local build; unused ID; exclusive `dist/releases/ID`                                  | [Build/package](deployment.md)                 |
| Exercise disposable containers | `npm run test:docker`                    | Local engine, same-repository HTTP fixture, owned state and cleanup                            | [Docker reference](../deploy/docker/README.md) |
| Check a deployed release       | `npm run test:smoke`                     | Reviewed public URLs/hosts and matching release IDs; browser results                           | [Smoke/staging](staging.md)                    |
| Check an external staging site | `npm run test:staging`                   | Reviewed public URLs/hosts; Chromium/Firefox/WebKit results                                    | [Smoke/staging](staging.md)                    |
| Collect advisory lab samples   | `npm run perf:website`                   | Explicit synthetic inputs, local HTTP fixture and verified browser; twelve samples and medians | [Performance](website-performance.md)          |

The [wrapper](../scripts/operations-checks.mjs) owns packaging, smoke and staging
commands. It checks readiness first, validates explicit inputs and filters browser
child environments. Docker and Lighthouse have separate owned runners. A command
name or ready source marker does not establish its successful execution.

## Distinguish the workflows

| Workflow source                                               | Trigger and effect                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [Release](../.github/workflows/release.yml)                   | Authorized main-only manual release-please run; creates/updates release metadata and PR/tag lifecycle                        |
| [Package](../.github/workflows/package-release.yml)           | Authorized main-only manual run with `release_id`; builds with synthetic loopback settings, packages and uploads an artifact |
| [Staging](../.github/workflows/staging.yml)                   | Authorized main-only manual external browser check                                                                           |
| [Deployment smoke](../.github/workflows/deployment-smoke.yml) | Authorized main-only manual check of a selected deployed release                                                             |
| [DAST](../.github/workflows/dast.yml)                         | Authorized main-only manual scan after target preflight                                                                      |
| [CodeQL](../.github/workflows/codeql.yml)                     | Configured main/PR/scheduled analysis, plus manual dispatch                                                                  |

[Versioning and tags](releasing.md) owns release-please preparation. For a
successful package run, inspect `website-release-<run-id>` under the run's
artifacts and compare the included `release.json` with the requested ID and
source run. For installation, use the selected [deployment procedure](deployment.md).

## Prepare, observe and clean up

1. Identify the exact source/build, operation and actual target or owned local
   resources. Complete the procedure linked in the table.
2. Confirm authorization for the actual effect: local containers, external traffic,
   remote dispatch and release publication are distinct actions. Do not give
   untrusted source private fixture credentials.
3. Run with public allowlisted inputs. Preserve the first failure and inspect
   actual outputs; a skipped/unavailable operation is not a pass.
4. Stop and drain only direct children created by the runner. Inspect cleanup
   errors and report retained resources; do not compensate with global prune or
   deletion of unrelated files, images, volumes, services or operator state.

The [Docker cleanup helper](../scripts/docker-smoke-cleanup.mjs) scopes generated
resource names, checks ownership and attempts independent cleanup despite
failures. Its injected tests establish that contract, not successful engine
removal. Deployment images retained for rollback have a separate lifecycle.

For external checks, verify DNS, redirects and target ownership under
[staging](staging.md) before sending requests. Record actual results in the task
or terminal. Keep command-generated artifacts ignored and create extra QA
reports only on request.

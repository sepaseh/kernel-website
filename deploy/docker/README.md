# Docker and TLS installation reference

Read the current [source scope](../../docs/bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This directory supplies website/gateway Dockerfile targets, a Compose model and public
configuration examples. Review and execute the procedures below only for an
authorized local engine or operator target. Source inspection and injected tests
record no successful container build, TLS deployment or cleanup.

The operations phase retains the delivered website composition with
`applicationReady: true`. Image build and startup still reject false or invalid
markers. Complete exact-tree application acceptance before the separately
authorized container procedure below; a source marker does not prove an image
built or a stack passed. Never change the marker to bypass a prerequisite.

## Prepare the normal website stack

Use the verified source/toolchain, [exact-tree validation](../../docs/validation.md)
and the delivered application's runtime acceptance,
a compatible local Docker engine with Compose/Buildx, an unused immutable release
ID, explicit public origins and an operator-owned TLS directory. The normal
[Compose model](compose.yaml) contains only website and gateway. Any HTTP service
the developer chooses to connect remains a separately configured integration.

Copy the public fields in [compose.env.example](compose.env.example) into a
separately managed operator configuration outside source. Supply:

| Input                                          | Meaning                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `RELEASE_ID`, `IMAGE_PREFIX`                   | Immutable website/gateway image identity                             |
| `WEBSITE_HOST`, `WEBSITE_URL`                  | Lowercase bare DNS host and explicit public origin                   |
| `API_BASE_URL`                                 | Configured HTTP upstream origin reachable from the website container |
| `WEBSITE_INDEXING_ENABLED`, `WEBSITE_CSP_MODE` | Explicit indexing policy and report-only/enforce rollout             |
| `BIND_ADDRESS`, `HTTP_PORT`, `HTTPS_PORT`      | Reviewed host interfaces/ports; ports are canonical integers 1–65535 |
| `TLS_CERT_DIRECTORY`                           | Absolute existing operator-owned certificate directory               |

The read-only TLS mount requires `fullchain.pem` and `privkey.pem`. Nginx runs as
UID/GID `101`: its directory must be traversable by that group (for example
`0750`), and a root-owned key may use group `101`/mode `0640`. Startup rejects
unreadable or world-accessible keys; accepted modes are `0400`, `0440`, `0600`
and `0640`. Changing real certificate permissions is an explicit operator action.

## Review and activate an authorized stack

Run from the website root. Replace the public-values file path and project name
with the selected operator-owned ones. The first command resolves configuration;
the later commands contact the selected engine and change its resources.

```sh
docker compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview config --quiet
docker compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview build
docker compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview up -d --wait --wait-timeout 180
```

Review the selected local engine before these commands; a remote Docker context
is not an implicit authorized target. The image dependency layer uses
`npm ci --ignore-scripts`. The website image includes only standalone runtime,
assets and explicit runtime helpers. Build/startup require the shipped readiness
marker. Installed dependency lifecycle assumptions and intended-platform runtime
behavior require actual build/engine verification.

The website listens internally on `3001`; the nonroot gateway listens on
`8080/8443`, mapped to the selected host HTTP/HTTPS ports. The website's HTML
health check must pass before the gateway is started. Gateway health requests
`/_kernel/release` over loopback TLS with hostname/certificate verification and
requires the exact marker body. Both services rotate `json-file` logs at 10 MB,
retaining at most three files per service.

After startup, verify actual HTTPS/redirect behavior, static assets/fonts, API
session cookies, private/no-store and CSP through the edge. A healthy gateway or
release marker alone does not identify all running website build bytes. Verify
artifact identity before accepting the deployment.

## Stop or roll back the selected stack

For the explicitly selected owned project:

```sh
docker compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview down
```

This stops that Compose project; do not use global prune or remove unrelated
containers/images/volumes. Retain immutable images needed for rollback. For an
authorized rollback, select the previous verified release ID/images with matching
public configuration and recreate only that project without rebuilding:

```sh
docker compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview up -d --no-build --wait --wait-timeout 180
```

Keep the previous images available and repeat edge acceptance.
Website rollback does not migrate a separately configured HTTP service.

## Run the separate disposable smoke exercise

Use this website checkout and its installed tools; no other repository or
service installation is required. Stop manually started local launchers first.
With a reviewed local engine and explicit authorization for disposable container
work, enable the synthetic test marker:

```sh
KERNEL_SYNTHETIC_ENV=1 npm run test:docker
```

The runner uses the fixed ordinary Docker executable and only the local engine
socket, an empty owned Docker configuration and unique project/image/builder
names. Its HTTP fixture build context contains only
[`website-api-fixture.mjs`](../../scripts/website-api-fixture.mjs) and a generated
Node image recipe. It copies no dependency manifests, source tree, migrations,
database, operator state or authentication secrets. The responder keeps synthetic
accounts/settings in memory and requires the test marker plus its explicit
container-only binding mode. The production website image excludes this fixture.

The certificate helper runs networkless as root only to generate an owned Linux
TLS volume and its group/modes. Its private key remains in that volume; only the
public certificate is captured for host-side verification. The gateway remains
nonroot, and certificate/hostname verification stays enabled.

Expected success prints the unique ignored
`test-results/deployment/docker-<release>.json` result path. The actual exercise
checks redirect, static/font assets, both CSP modes, noindex, website proxy cookies
against the owned HTTP fixture and the release marker. The result identifies the
local fixture source and its copied SHA256; it makes no external-service
compatibility claim. It attempts all owned cleanup after success, failure or
cancellation: certificate container, Compose resources/volumes, builder/cache,
unique images and temporary files. Ctrl+C cancels the operation and drains owned
children before cleanup. Cleanup errors remain failures; inspect the named
retained resources instead of using global removal.

A real smoke result certifies only its recorded source/engine/fixture run.
[Injected owner tests](../../scripts/run-docker-smoke.test.mjs) and
[cleanup tests](../../scripts/docker-smoke-cleanup.test.mjs) exercise contracts
without an engine. This page records no executed smoke or deployed stack. See
[deployment](../../docs/deployment.md), [operations](../../docs/release-operations.md)
and [external smoke/staging](../../docs/staging.md).

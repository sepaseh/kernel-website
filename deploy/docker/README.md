# Docker deployment

Use this guide to prepare and verify deployment on an authorized Linux Docker
engine. See [deployment](../../docs/deployment.md) for the release and verification
procedure.
Complete [exact-tree application acceptance](../../docs/validation.md) before
preparing an installation. The website image checks the application's readiness
marker at build and startup. The disposable smoke exercise has its own procedure.

## Prepare the normal website stack

The root [.dockerignore](../../.dockerignore) is a default-deny allowlist derived
from the exact [public inventory](../../.github/bootstrap-policy.json). Every
admitted parent is opened for traversal and its contents denied again; only exact
file exceptions are included. Literal brackets in App Router paths are escaped.
Explicit generated/private-root denies come last so Windows context senders prune
those trees before encountering inaccessible links in ignored dependencies or
verification environments. Never repair or delete another run's files to build.
Unlisted siblings, real dotenv, local assistant settings, credentials, dependencies
and generated output remain outside the build context. This follows Docker's
[last-matching-pattern rules](https://docs.docker.com/build/concepts/context/#negating-matches).

Keep this list synchronized when the admitted inventory changes and run
`node --test scripts/deployment.integration.test.mjs`. A Dockerfile-specific ignore
override is not supported. The build stage copies that filtered public context so
the normal build can fingerprint every admitted source input, including guidance,
tests and the pinned toolchain. Missing files still fail source verification;
neither the readiness nor provenance/budget checks are bypassed. The final image
continues to copy only standalone runtime, public/static assets and explicit
runtime helpers, leaving build-only source out of the running image.

Use a local Docker engine with Compose and Buildx, an unused immutable release
ID, explicit public origins and an operator-owned TLS directory. The website
build and runtime stages use the Node version in [.nvmrc](../../.nvmrc).
The [Compose model](compose.yaml) starts the website and gateway. Configure
the HTTP API separately.

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

Run from the website root. Replace the public-values path, context and project
with the reviewed selections. Use `docker context ls` to identify the authorized
local engine. Check shell overrides because Compose can take interpolation
values from the shell ahead of the explicit file.

```sh
docker --context kernel-local compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview config
```

Check the image tags, public origins, listener bindings and TLS mount in the
resolved configuration. Then build and start the authorized project.

```sh
docker --context kernel-local compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview build
docker --context kernel-local compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview up -d --wait --wait-timeout 180
```

The image dependency layer uses `npm ci --ignore-scripts`. The website image
includes the standalone runtime, assets and explicit runtime helpers.

The website listens internally on `3001`; the nonroot gateway listens on
`8080/8443`, mapped to the selected host HTTP/HTTPS ports. The website's HTML
health check must pass before the gateway is started. Gateway health requests
`/_kernel/release` over loopback TLS with hostname/certificate verification and
requires the exact marker body. Both services rotate `json-file` logs at 10 MB,
retaining at most three files per service.

If startup fails, use the same context, public-values file and project with
`ps --all` to find exited or unhealthy containers and `logs website gateway`
to inspect the first failure. After startup, verify HTTPS and HTTP redirects,
assets/fonts, API session cookies, private/no-store and CSP through the public
edge. Confirm the release marker and running website build match the artifact.

## Stop or roll back the selected stack

For the explicitly selected owned project:

```sh
docker --context kernel-local compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview down
```

This stops that Compose project; do not use global prune or remove unrelated
containers/images/volumes. Retain immutable images needed for rollback. For an
authorized rollback, select the previous verified release ID/images with matching
public configuration and recreate only that project without rebuilding:

```sh
docker --context kernel-local compose --env-file /absolute/path/website-compose.env -f deploy/docker/compose.yaml --project-name kernel-website-preview up -d --no-build --wait --wait-timeout 180
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

In PowerShell:

```powershell
$env:KERNEL_SYNTHETIC_ENV = '1'
npm run test:docker
```

The default Docker executable is `/usr/bin/docker` on non-Windows hosts or
`C:\Program Files\Docker\Docker\resources\bin\docker.exe` on Windows. For another
installation, set the public `WEBSITE_DOCKER_CLI` input to its absolute, unlinked
executable path. For example, with an ordinary installation at that path:

```sh
WEBSITE_DOCKER_CLI=/usr/local/bin/docker KERNEL_SYNTHETIC_ENV=1 npm run test:docker
```

Selecting the executable does not select an ambient Docker context or
configuration. The runner retains its fixed local engine socket, empty owned
Docker configuration and unique project/image/builder names.
Its HTTP fixture build context contains only
[`website-api-fixture.mjs`](../../scripts/website-api-fixture.mjs) and a generated
image recipe with the same Node pin as the website. It copies no dependency manifests, source tree, migrations,
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

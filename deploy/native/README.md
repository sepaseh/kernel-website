# Native Linux installation reference

Read the current [source scope](../../docs/bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use this reference to review a Linux systemd/Nginx installation of a verified
[standalone package](../../docs/deployment.md). The supplied files are templates;
this page records no installed service, successful Linux runtime, ACME issuance
or renewal. Actual host changes require explicit operator authorization and
verification on the intended OS/architecture/Node version.

The current `runners-foundation` phase has `applicationReady: false`. Packaging,
template-rendering and health-check CLIs reject it, and the service preflight
blocks startup. The sequence below applies only after runnable composition and
application acceptance are delivered. Do not alter the marker to activate these
templates; isolated owner tests establish helper contracts only.

## Prepare the artifact and public configuration

Build/package on the intended platform and complete
[exact-tree validation](../../docs/validation.md) plus the delivered application's
runtime acceptance. Review the package's `release.json`,
source/build identity and API compatibility. Keep immutable releases separate
from installed configuration, TLS keys and API-owned data.

The [service](systemd/kernel-website.service) expects:

| Item                     | Template value                                            |
| ------------------------ | --------------------------------------------------------- |
| Service identity         | Unprivileged `kernel-web` user/group                      |
| Selected release         | `/srv/kernel-website/current`                             |
| Server directory         | `/srv/kernel-website/current/website`                     |
| Node executable          | `/usr/bin/node`, matching the reviewed toolchain/artifact |
| Production environment   | `/etc/kernel-website/website.env`                         |
| Writable service cache   | `/var/cache/kernel-website`, mode `0700`                  |
| Private website listener | `127.0.0.1:3001` in the public example                    |

[website.env.example](website.env.example) lists production inputs: `NODE_ENV`,
`HOSTNAME`, `PORT`, the independent `API_BASE_URL`, explicit `WEBSITE_URL`, indexing
and CSP flags, and telemetry preference. Configure the API's trust/cookie
boundary independently. Do not put credentials or actual dotenv files in source
or immutable releases.

[nginx.env.example](nginx.env.example) contains public rendering fields:
`WEBSITE_HOST`, `TLS_CERTIFICATE`, `TLS_CERTIFICATE_KEY`, `RELEASE_ID` and
`HTTPS_PORT`. The native Nginx templates listen on `80/443`; `HTTPS_PORT` supplies
the public redirect/forwarding port, not a replacement listen directive.

## Render and review the edge

Follow the complete [local renderer example](../../docs/deployment.md#render-a-local-edge-configuration).
All renderer input/output paths remain inside the owned repository. Actual
certificate/key contents stay at operator-controlled paths outside it.

The [ACME bootstrap](nginx/acme-bootstrap.conf.template) serves only the challenge
path and otherwise returns 503. The [TLS template](nginx/kernel-website.conf.template)
keeps the same `/var/www/acme` webroot available over HTTP for renewals and redirects
other HTTP paths to HTTPS. It provides unknown-host rejection, TLS, release marker
and the website proxy. Review
certificate issuance/renewal and trusted forwarding. A shared Nginx listener
needs one operator-owned default rejection block per address/port; do not install
multiple conflicting default-server blocks.

## Authorized installation sequence

An operator must resolve and verify these host-specific steps before activation:

1. Provision the reviewed Node executable, unprivileged service identity,
   immutable release directories, installed public environment and certificate
   ownership. Verify the service can read its selected artifact.
2. Select the verified release at `current` using the host's reviewed atomic
   replacement procedure. Keep a previous verified artifact for rollback.
3. Review actual runtime cache writes and provide the required per-release cache
   mapping/ownership. The unit restricts writes to its service cache; do not
   loosen `ProtectSystem=strict` merely to conceal a permission failure.
4. Install the reviewed systemd/Nginx configuration through the host's normal
   managed process. Validate Nginx syntax and resolve shared-listener conflicts
   before reloading it. Provision/verify the real TLS certificate separately.
5. Start the selected service, inspect its startup outcome and run the explicit
   readiness check below. Confirm assets/fonts, cookies, private/no-store and CSP
   through the actual edge before accepting the installation.

The unit's `ExecStartPre` checks the shipped readiness policy and production
settings before Node starts. `CacheDirectory`, filesystem/kernel restrictions,
`UMask=0077` and the service account remain part of the reviewed deployment.
Template inspection and local copy tests do not verify these host steps.

## Verify and roll back

After the authorized service is listening at the template's loopback port:

```sh
node /srv/kernel-website/current/scripts/healthcheck.mjs website http://127.0.0.1:3001/login
```

Expected success is exit zero for a 200 HTML response. Check the actual running
build as well as `/_kernel/release`; the marker alone does not identify all
website bytes. Inspect the service's journal for the selected release without
exposing private values.

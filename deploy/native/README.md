# Native Linux deployment

Use this guide to install an immutable release on an authorized Linux host.
See [deployment](../../docs/deployment.md) for the release and verification
procedure.
Complete application acceptance on the intended platform and install the verified
standalone package. The current operations phase delivers the application. The
service checks the packaged readiness marker and public production settings
before startup.

## Prepare the artifact and public configuration

Build and package on the intended OS and architecture. Complete
[exact-tree validation](../../docs/validation.md), then compare `release.json`
with the selected release ID, build ID, platform and Node version from
[.nvmrc](../../.nvmrc). Keep immutable releases separate from installed
configuration, TLS keys and API-owned data.

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
`HTTPS_PORT`. The native TLS template listens on ports 80 and 443. Set
`HTTPS_PORT` to the client-facing HTTPS port used in redirects and forwarded
requests. A different public port needs a corresponding listener or edge mapping.

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
   managed process. Run `nginx -t` and resolve syntax or shared-listener failures
   before reloading. Provision and verify the TLS certificate separately.
5. Start the selected service, inspect its startup outcome and run the explicit
   readiness check below. Confirm assets/fonts, cookies, private/no-store and CSP
   through the actual edge before accepting the installation.

The unit's `ExecStartPre` checks the shipped readiness policy and production
settings before Node starts. `CacheDirectory`, filesystem/kernel restrictions,
`UMask=0077` and the service account remain part of the reviewed deployment.
Template inspection and local copy tests do not verify these host steps.

## Verify and roll back

Check the active systemd unit and the selected release at the loopback port.

```sh
systemctl is-active kernel-website.service
/usr/bin/node /srv/kernel-website/current/scripts/healthcheck.mjs website http://127.0.0.1:3001/login
```

Expect `active` from systemd and a successful health-check exit for a 200 HTML
response. If either fails, inspect the unit's startup result and journal without
sharing private values. Check the running build against the package and confirm
that the public `/_kernel/release` response matches the selected release ID.

For authorized rollback, atomically reselect the previous verified artifact,
restore its matching public edge/configuration and cache ownership, restart via
the normal service manager and repeat readiness/edge acceptance. Website
rollback does not migrate or recover API state. Retain rollback artifacts; clean
only explicitly owned retired releases after review. See
[operations](../../docs/release-operations.md) and [security review](../../docs/reviews.md).

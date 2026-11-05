# Build, package and prepare installation

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This phase publishes guarded packaging/rendering helpers and deployment
templates. The application readiness marker is false: the delivery CLIs reject
it before their operation callbacks read inputs, write artifacts or make health
requests. Importing a helper starts no operation. The contracts and commands
below describe a future application-ready package; they are not an activation
procedure for this publication. Do not toggle the marker to bypass the boundary.

Owner tests use synthetic roots and artifacts to verify these helpers. Creating
a real release requires delivered framework composition and complete application
acceptance. Activating a service or operator target also requires separate
authorization and intended-platform verification.

## Prepare and build

The package helper consumes an existing completed standalone build; it does not
build the website. Required inputs include `.next/BUILD_ID`,
`.next/standalone/server.js`, public assets and `.next/static`. The published
[test-server runner](runner-foundation.md) defines guarded build/start sequencing,
but the application configuration and framework entry points are not admitted
yet. Neither the template files nor synthetic test outputs establish a real
build or bundle-budget result.

Once application composition is delivered, verify the complete build against its
source before packaging. A previous `.next` directory cannot validate current
source. Keep one writer for build and packaging outputs.

## Create an immutable local package

Choose an unused release ID: 1–128 letters, digits, dots, underscores or hyphens,
starting with a letter/digit and containing no `..`.

For an accepted application-ready source tree, the wrapper command is
`node scripts/package-release.mjs --release=local-preview-001`. It consumes the
existing build. Expected output is
`dist/releases/local-preview-001/`, containing:

- `website/server.js`, bundled runtime dependencies, public files and static assets;
- three runtime preflight/health helpers in `scripts/` and the matching
  `.github/bootstrap-policy.json`;
- `release.json`, recording `releaseId`, `websiteBuildId`, Node version, platform,
  architecture and bundled-runtime ownership.

An existing destination fails rather than being overwritten. Inspect a partial
output and choose a new ID. Build on the intended OS/architecture with the locked
toolchain; copying tests do not establish cross-platform runtime compatibility.
Review actual artifact contents: the [file policy](../scripts/release-files.mjs)
excludes private/runtime file classes but cannot recognize a credential embedded
in an otherwise allowed file.

By default, each artifact-tree copy has a shared traversal budget of 100,000 entries and
1 GiB of file bytes. Materialized copies of repeated dependency links count
again; callers may set explicit entry and byte limits. Crossing either limit fails
the operation rather than allowing a shared-link graph to expand without bound.

When preparation overwrites an asset, it stages bytes in an exclusively created
destination file, preserves source permissions, closes both handles and renames
the stage over the destination. A failure removes only its claimed staging file. Physical local
roots without linked ancestors and a single writer remain required; these
pathname checks do not prevent concurrent ancestor-directory replacement.

## Render a local edge configuration

The [renderer](../scripts/render-deployment.mjs) accepts public values and writes
configuration without contacting Nginx or reading certificate/key contents. Its
three paths must remain inside the owning repository. Relative paths resolve
from that root, regardless of the shell's current directory.

After application readiness has been delivered, this example renders public
placeholders to an unused ignored output path. In the current phase it stops at
the readiness gate without reading the template or creating output:

```sh
node scripts/render-deployment.mjs --template deploy/native/nginx/kernel-website.conf.template --public-values-file deploy/native/nginx.env.example --output test-results/deployment-example/nginx.conf
```

When admitted by readiness, success prints `Deployment configuration rendered.`
and creates that file. Review its hostname, certificate paths, release ID and
forwarding values. It is an
example configuration, ready for inspection rather than installation unchanged.
For selected operator values, use a separate public-values file inside the owned
root and an unused generated output path; keep actual keys outside source.

The renderer rejects traversal, encoded filenames, network/drive-relative paths,
links and unsafe ancestors. It refuses existing output by default. `--force`
replaces only a validated regular file inside that root; it does not grant access
to installed service or outside operator files. Source and destination trees must
remain trusted and single-writer; pathname checks are not a defense against
concurrent ancestor replacement.

## Choose an installation path

| Path         | What is supplied                                               | Next procedure                                              |
| ------------ | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Native Linux | systemd and Nginx templates, public configuration examples     | [Native installation reference](../deploy/native/README.md) |
| Docker       | Dockerfile targets, Compose model, TLS mount and health checks | [Docker installation reference](../deploy/docker/README.md) |

Both paths package only the website. Downstream developers select any HTTP
backend and its deployment separately. The local HTTP fixture is test-only.
Verify API compatibility, same-origin cookies, host/forwarding boundaries,
request-time settings, private/no-store responses, assets/fonts and CSP on the
selected platform. Keep credentials, actual TLS keys and installed operator
configuration outside source and immutable releases.

The platform references describe procedures to review and execute under operator
authorization. This guide records no installed systemd service, issued/renewed
certificate, successful container deployment or production readiness.

## Check and roll back an authorized installation

For a future accepted application-ready artifact with selected public production
settings, the shipped preflight command is:

```sh
node scripts/validate-deployment-env.mjs website
```

Expected success is `Deployment configuration is valid.`. After an owned or
authorized website is listening on its explicitly selected address:

```sh
node scripts/healthcheck.mjs website http://127.0.0.1:3001/login
```

Success exits zero only for a 200 HTML response containing an HTML document; it
does not follow redirects. Replace the address if the installed listener differs.
This helper requires the matching shipped readiness marker. Never toggle a false
marker to enter operations.

API and website probes both stop reading after 1 MiB and cancel the unread
response stream. A response exceeding that limit fails readiness even if its
status and document markers would otherwise be valid.

Verify the running build against the artifact identity as well as the gateway's
`/_kernel/release` response. Demonstrate atomic current-selection replacement and
rollback to a previous verified artifact with matching configuration and cache
ownership. Website rollback does not migrate or recover API data.

# Build, package and deploy

Use this guide to prepare an immutable release and verify an authorized
deployment.
Complete [exact-tree validation](validation.md) before publishing. Installation
and target checks require authorization and verification on the target platform.

## Prepare and build

Use a clean owned source tree, the Node version in [.nvmrc](../.nvmrc), and the
explicit public inputs in [local development](development.md). That guide also
starts the same-repository test-only HTTP fixture. Before publication, complete the
fresh isolated-tree [validation procedure](validation.md).

From the website root, with the development inputs set:

```sh
npm run build
```

Success prints `Production build and bundle budgets passed.` and prepares
`.next/BUILD_ID`, `.next/standalone/server.js` and static assets. The build also
records the source, runtime inputs and output for browser acceptance. Resolve
any build failure before packaging and keep one writer for build and packaging
outputs.

## Create an immutable local package

Choose an unused release ID: 1–128 letters, digits, dots, underscores or hyphens,
starting with a letter/digit and containing no `..`.

```sh
npm run deploy:package -- --release=local-preview-001
```

Package immediately after verifying the build you intend to ship. The command
prints the release ID, platform and output directory on success. Under
`dist/releases/local-preview-001/`, check:

- `website/server.js`, bundled runtime dependencies, public files and static assets;
- three runtime preflight/health helpers in `scripts/` and the matching
  `.github/bootstrap-policy.json`;
- `release.json`, recording `releaseId`, `websiteBuildId`, Node version, platform,
  architecture, the website entry point and bundled-runtime ownership. Match
  `websiteBuildId` to the accepted build's `.next/BUILD_ID`.

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

This example renders public placeholders to an unused ignored output path after
the readiness check. Review the resulting configuration before any installation:

```sh
node scripts/render-deployment.mjs --template deploy/native/nginx/kernel-website.conf.template --public-values-file deploy/native/nginx.env.example --output test-results/deployment-example/nginx.conf
```

Success prints `Deployment configuration rendered.` and creates that file.
Review its hostname, certificate paths, release ID and forwarding values before
rendering the separately selected installation configuration.
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

From the installed release root, supply the selected public production settings
to verify the packaged readiness marker and deployment inputs.

```sh
node scripts/validate-deployment-env.mjs website
```

Expected success is `Deployment configuration is valid.`. Once the website is
listening, probe its sign-in route from that same release root:

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

Retain artifacts needed for rollback. Clean only files/resources owned by the
specific preparation or test; inspect cleanup failures and report retained
resources in the task. [Operations](release-operations.md) maps separate Docker,
external smoke/staging and advisory commands. [Versioning](releasing.md) covers
release PRs/tags; neither is part of local packaging.

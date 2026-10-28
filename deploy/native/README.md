# Native service and edge reference templates

[English](README.md) · [فارسی](README.fa.md)

The application source now includes runnable Next.js composition and build/start commands with `applicationReady:true`. These files remain passive Linux service/edge references: they do not install, start or verify a service, release or deployment-smoke target. Do not install the [systemd reference](systemd/kernel-website.service) as evidence of deployment readiness. The exact application gate and intended-platform operational acceptance are separate prerequisites.

The intended layout separates immutable releases/current selection, operator configuration and per-release writable cache from API-owned state. The service reference uses an unprivileged website account, preflight and filesystem/kernel restrictions. [Artifact preparation](../../scripts/package-release.mjs) and [preflight](../../scripts/validate-deployment-env.mjs) require the shared public readiness guard; false/invalid markers fail without a bypass. Synthetic ready fixtures prove helper contracts, not installed-service readiness. A real artifact must ship its matching guard/marker and complete runtime support files.

[Website](website.env.example) and [host](hosts.env.example) examples are public
source placeholders. They are not installed environments, secrets or proof that
the API trusts the website. Keep actual credentials and TLS keys outside releases
and source. The [bootstrap](nginx/bootstrap.conf.template) and
[TLS edge](nginx/kernel.conf.template) templates accept reviewed public fields via
the [renderer](../../scripts/render-deployment.mjs); rendering does not validate
installed Nginx, certificate ownership, ACME issuance/renewal or a live routing
boundary. A shared listener needs one operator-owned default rejection block per
address/port; installing repeated default-server blocks is not a composition
strategy.

Future authorized activation must first verify the actual application artifact on
the intended OS/architecture/Node toolchain, required runtime gates, API fixture
and trusted host/forwarding/cookie/CSP boundary. Check syntax on the intended edge,
explicit health targets, assets/fonts and real service permissions. A generated
release-marker response alone does not identify the running website build.

Review atomic current-selection changes, matching edge/configuration and
per-release cache ownership, then demonstrate rollback to a previous verified
artifact. Website rollback does not perform API migrations, data recovery or
contract rollback. No host, service, certificate or release is modified by this
guide. Follow [deployment acceptance](../../docs/deployment.md),
[operations](../../docs/release-operations.md) and
[security review](../../docs/security/reviews.md).

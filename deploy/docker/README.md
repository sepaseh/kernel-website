# Docker and TLS reference templates

[English](README.md) · [فارسی](README.fa.md)

The operations phase includes a guarded [disposable Docker-smoke runner](smoke.mjs) alongside runnable application source and Docker/TLS references. Its Dockerfile carries the complete build-helper closure and explicit synthetic build inputs. `applicationReady:true` and a passing application gate do not establish that an engine, image, Compose stack, generated certificate or API session has actually passed container verification. This guide records no successful Docker run.

Review the [Dockerfile](Dockerfile), [Compose model](compose.yaml), [website entrypoint](website-entrypoint.sh), [gateway validator](15-validate-configuration.sh) and [Nginx template](nginx.conf.template) as references awaiting operational acceptance. Build/entrypoint require the public readiness marker through the shared helper; false/invalid markers must fail without a bypass. Application readiness does not certify the image or gateway. [The example](.env.example) contains public placeholders, not operator configuration, credentials or a certificate. No real dotenv or key is bundled.

The smoke runner first checks readiness and the explicit clean, independently installed public API revision `4755d62d14fb9d53cbe9d6246ca9be6bb4a3a7a9`. That API revision has no deployment Dockerfile, so smoke generates an owned fixture build recipe from its public source instead of borrowing another checkout's deployment files. It uses only a local engine endpoint, a fresh owned Docker configuration, synthetic API state and generated test-only secret/TLS files, unique project/image/builder identities and bounded direct-child operations. Owner tests inject Docker callbacks; they do not run an engine. A real smoke run separately verifies redirect, static/font assets, CSP modes, noindex, API session cookies and release identity, then attempts all owned cleanup even after failure.

The intended separation is website plus gateway with an explicitly configured
independent API upstream; there is no API service or database in the normal
Compose model. The references propose an internal website listener, nonroot
website user, explicit health URL, read-only certificate mount, unknown-host/TLS
rejection and trusted forwarding-header replacement. Static inspection and local
configuration tests do not prove these properties in a running engine or that
the mounted Next.js routes preserve cookies through this gateway, CSP and no-store behavior.

The [cleanup helper](../../scripts/docker-smoke-cleanup.mjs) is tested through
[injected fake operations](../../scripts/docker-smoke-cleanup.test.mjs), not Docker.
It restricts generated project/image/builder names and owned temporary files,
attempts independent cleanup despite failures and reports aggregated errors. It
does not by itself prove that a real engine's resources were removed; the [smoke runner](smoke.mjs) invokes the same owned cleanup contract. Never substitute global prune or removal of unrelated resources for
owned cleanup; retained deployment images have a different rollback lifecycle.

Future activation requires a separately verified application/build, compatible
engine/toolchain, synthetic independent API, actual TLS/asset/CSP/session checks
and owned-resource cleanup/interruption evidence. Operators must review target
ports, host/API trust, certificate ownership/renewal, immutable release identity
and rollback before authorized execution. See
[deployment acceptance](../../docs/deployment.md),
[operations](../../docs/release-operations.md) and
[validation](../../docs/validation.md). The canonical manifest registers the manual `npm run test:docker` command separately from the fifteen-check full profile; importing its module remains inert.

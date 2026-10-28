# Docker and TLS reference templates

[English](README.md) · [فارسی](README.fa.md)

These are passive Docker/TLS references alongside runnable application source. The application has `applicationReady:true` and build/start commands, but Docker smoke orchestration and operational workflow acceptance remain deferred. This directory is not an accepted installable stack. The application gate does not run an engine, build an image, start Compose, issue certificates or verify an API session through this gateway. The Docker image’s complete build-helper dependency closure still needs the separate operational change.

Review the [Dockerfile](Dockerfile), [Compose model](compose.yaml), [website entrypoint](website-entrypoint.sh), [gateway validator](15-validate-configuration.sh) and [Nginx template](nginx.conf.template) as references awaiting operational acceptance. Build/entrypoint require the public readiness marker through the shared helper; false/invalid markers must fail without a bypass. Application readiness does not certify the image or gateway. [The example](.env.example) contains public placeholders, not operator configuration, credentials or a certificate. No real dotenv or key is bundled.

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
does not supply the deferred runner or prove that a real engine's resources were
removed. Never substitute global prune or removal of unrelated resources for
owned cleanup; retained deployment images have a different rollback lifecycle.

Future activation requires a separately verified application/build, compatible
engine/toolchain, synthetic independent API, actual TLS/asset/CSP/session checks
and owned-resource cleanup/interruption evidence. Operators must review target
ports, host/API trust, certificate ownership/renewal, immutable release identity
and rollback before authorized execution. See
[deployment acceptance](../../docs/deployment.md),
[operations](../../docs/release-operations.md) and
[validation](../../docs/validation.md). No launch commands are registered here.

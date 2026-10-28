# Delivery preparation and runtime acceptance

[English](deployment.md) · [فارسی](deployment.fa.md)

The operations phase retains runnable Next.js composition, CSS and build/start commands with `applicationReady:true` and supplies guarded packaging and Docker-smoke source. Their local preparation, container execution and external deployment have separate acceptance. The complete fifteen-check application gate is still required, but it does not execute or certify a Docker engine, installed Linux service, certificate, release or deployed target.

## Published preparation contracts

[Standalone preparation](../scripts/prepare-standalone.mjs), the [release packager](../scripts/package-release.mjs) and their shared [file policy](../scripts/release-files.mjs) operate on explicitly supplied local inputs. Owner tests use disposable synthetic build trees; copied server-shaped fixtures prove file handling, not a complete working artifact. Core CLIs require an ordinary unlinked schema1 readiness policy with applicationReady true before environment, network or artifact operations; false/invalid policies still fail with no bypass. A true source marker does not authorize release or deployment. Release IDs/destinations remain exclusive; an existing release is not a scratch directory. File-class filtering does not attest arbitrary allowed content contains no secret.

[Configuration validation](../scripts/validate-deployment-env.mjs) checks supplied
website settings; [template rendering](../scripts/render-deployment.mjs) substitutes
validated public fields without installing a service. The
[health helper](../scripts/healthcheck.mjs) requires an explicit target: importing
it does not authorize or perform a network check. Tests use synthetic responses or
an owned loopback listener, never an existing API. Public example files contain
source placeholders only; real operator environments, keys and data stay outside
source and artifacts.

The renderer's `--template`, `--public-values-file` and `--output` paths must stay
inside the repository that owns the script. Relative paths resolve from that
repository, independent of the command's working directory; absolute local paths
inside it are also accepted. All three paths are checked before template/public
value reads or output creation. Traversal segments, URL-encoded filenames,
drive-relative paths, network paths, links and non-directory ancestors are refused.
`--force` allows replacing only a validated regular output file inside that root;
it does not grant access to outside operator files or installed service paths.

The [Docker](../deploy/docker/README.md) and
[native](../deploy/native/README.md) references describe proposed service/edge
boundaries. They are not deployment instructions for this snapshot. Read
[operations](release-operations.md), [staging](staging.md) and the
[threat model](security/threat-model.md) before planning later activation.

## Acceptance before a runnable deployment

Deployment acceptance must use the actual application artifact and its exact-tree fifteen-check [validation profile](validation.md), including real production build/bundle, independently installed synthetic API/browser/CSP and current visual comparison. Record source, toolchain, platform, artifact hash and actual results. Retained local helper tests and the published operational runners do not establish engine/service compatibility. Run the guarded container smoke or separately authorized target checks on the intended platform and retain their actual results.

Before operator activation, verify trusted hosts/forwarding, same-origin API
cookies, request-time settings, CSP/cache behavior, assets/fonts, explicit health
targets, certificate ownership and immutable release identity. Validate rollback
with the matching previous artifact/configuration and per-release writable cache.
API authorization, persistence, migrations and data recovery remain the
independent API owner's responsibility. No deployment, rollback or infrastructure
change is performed by publishing these helpers or guides.

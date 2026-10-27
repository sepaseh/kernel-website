# Delivery preparation and runtime acceptance

[English](deployment.md) · [فارسی](deployment.fa.md)

The **delivery-tooling** phase publishes local artifact/configuration helpers and
inert deployment references. `applicationReady:false` remains mandatory. The
website still has no application routes, root layout, CSS pipeline or runnable
server. No application build, API, browser, Docker engine or deployed target is
started or certified by this phase.

## Published preparation contracts

[Standalone preparation](../scripts/prepare-standalone.mjs), the
[release packager](../scripts/package-release.mjs) and their shared
[file policy](../scripts/release-files.mjs) operate on explicitly supplied local
inputs. Their owner tests use disposable synthetic build trees. A copied
server-shaped fixture and release metadata prove file handling, not that Next.js
produced a working server or that bundled dependencies are complete and usable.
Core delivery CLIs read the unlinked public readiness policy and require
schema version 1 with applicationReady true before environment reads, network or
artifact copying. The current false policy refuses them; only owned synthetic
test roots declare readiness for these contract tests. There is no bypass flag.
Release IDs and destinations remain exclusive; an existing release is not a
scratch directory to overwrite. Filtering prohibited file classes does not prove
that arbitrary allowed content contains no secret.

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

A later authorized change must deliver the actual framework composition and a
verified production build, install an independently owned synthetic API fixture,
and introduce the complete required application/build/browser/visual gates.
Record the exact source, toolchain, platform, artifact hash and actual results.
The current eleven-check [validation profile](validation.md) remains required;
local helper tests cannot replace those future runtime checks.

Before operator activation, verify trusted hosts/forwarding, same-origin API
cookies, request-time settings, CSP/cache behavior, assets/fonts, explicit health
targets, certificate ownership and immutable release identity. Validate rollback
with the matching previous artifact/configuration and per-release writable cache.
API authorization, persistence, migrations and data recovery remain the
independent API owner's responsibility. No deployment, rollback or infrastructure
change is performed by publishing these helpers or guides.

# Prepare version metadata and publish a release

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This guide covers the release PR/tag workflow. To build a local artifact, use
[deployment](deployment.md); to choose a manual check or package workflow, use
[operations](release-operations.md). A local package and a published version are
separate results.

## Version sources

The root [package](../package.json), [version manifest](../.release-please-manifest.json)
and [changelog](../CHANGELOG.md) are maintained source. The
[release configuration](../release-please-config.json) selects the Node release
strategy for this one package and configures a `v` tag prefix. Conventional
Commit titles supply versioning input. Existing metadata or a changelog entry
alone does not prove a release/tag was published.

## Prepare the release workflow

1. Reconcile the intended `main` revision with actual merged changes. Pass the
   complete fresh exact-tree [gate](validation.md) before any authorized
   commit/push/PR handoff, including documentation-only work.
2. Review Conventional Commit history and the expected version/changelog scope.
   Apply the [canonical PR policy](../.agents/rules/pull-requests.md), including
   verified stack dependencies and advisory scope guidance. Release PRs retain
   ordinary protection, validation and authorization requirements.
3. Verify the repository's release-please configuration and provider permissions.
   The workflow uses `RELEASE_PLEASE_TOKEN` when provisioned, otherwise
   `GITHUB_TOKEN`. Inspect secret names/availability only; provisioning or changing
   a token needs its own authorization and must not expose its value.
4. Obtain authorization for the actual main-only remote workflow action and any
   later merge/publication. Local preparation does not grant those effects.

The [Release workflow](../.github/workflows/release.yml) has manual dispatch and a
`main` guard. It invokes the pinned release-please action with the local config
and manifest. An authorized operator can select **Release** in the repository's
Actions UI, choose `main` and dispatch it. The expected result depends on the
current commit/release state: inspect the actual action result and resulting
release PR or published release/tag. Do not infer publication from dispatch or a
successful configuration check.

## Review and verify publication

Review generated version/changelog edits as ordinary source changes. Follow
[Contributing](../CONTRIBUTING.md), current-head checks, review approval and
resolved conversations before an authorized merge. Keep the normal protection
rules intact. A workflow-created PR is not automatically approved or merged.

After an explicitly authorized publication, verify the actual tag/release,
source revision and version metadata agree. Record actual URLs and failures.
An uploaded [package workflow](../.github/workflows/package-release.yml) artifact
is a separate output: verify its build/release identity and intended-platform
compatibility before installation. Do not reuse an immutable release ID to hide
a failed or partial result, or rewrite published history without authorization.

Publishing source, version metadata or a release does not authorize installing a
service, dispatching an external scan or deploying production. Follow the
[installation references](deployment.md#choose-an-installation-path) for those
separately verified operator steps. This guide records no dispatched workflow,
merged release PR or published tag.

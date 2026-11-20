# Publish release metadata

Use this guide to prepare a version PR and publish its tag and GitHub release.
For an immutable website package, see [deployment](deployment.md).

## Version sources

The root [package](../package.json), [version manifest](../.release-please-manifest.json)
and [changelog](../CHANGELOG.md) are maintained source. The
[release configuration](../release-please-config.json) selects the Node release
strategy for this one package and configures a `v` tag prefix. Conventional
Commit titles supply versioning input.
Verify the tag and GitHub release in the repository. A changelog entry or
version setting alone does not establish a published release.

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

In GitHub Actions, select **Release**, choose `main` and dispatch the
[workflow](../.github/workflows/release.yml) after authorization. It runs the
pinned release-please action with the local config and manifest. Inspect the job
output and follow the URL for any created or updated release PR. After the
release PR is merged, verify the release and tag produced by an authorized
dispatch. If nothing was created, check the job output against the selected
`main` revision and existing release metadata.

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

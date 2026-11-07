# Application composition and acceptance

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This guide maps the delivered application to its integration obligations. The
[source policy](../.github/bootstrap-policy.json) owns the current inventory and
readiness marker; [architecture](architecture.md) owns the source map.
Use [development](development.md) for local setup and [validation](validation.md)
for the complete checking procedure.

## Composition

| Owner                                                                                              | Integration responsibility                                                                           |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [Root layout](../src/app/layout.tsx) and [providers](../src/app/providers/Providers.tsx)           | Compose request settings, scoped messages, session/theme support, local fonts and the request nonce. |
| App routes and shell                                                                               | Compose home, authentication and account features with page metadata and error/fallback behavior.    |
| [Request messages](../src/i18n/request.ts) and [server settings](../src/shared/settings/server.ts) | Load uncached API language/direction and select the appropriate local catalog.                       |
| API route, [request proxy](../src/proxy.ts) and [forwarding policy](../src/shared/api/proxy.ts)    | Enforce HTTP boundaries, cookie/no-store forwarding and CSP integration.                             |

Keep API-selected language/direction and explicit root/auth/account message
scopes, independent theme preference, form/session ownership, both CSP modes,
explicit SEO origins with opt-in indexing, escaped JSON-LD and licensed local
fonts. [Forms](forms.md), [session](session.md), [localization](localization.md),
[server boundaries](server-boundary.md) and [design](../DESIGN.md) define the
corresponding behavior. Framework adapters must use the installed API signatures
and retain their exact import and coverage permissions.

## Exact-tree acceptance

The [full profile](../.agents/validation.json) contains every required check,
including dead-code analysis, one verified production build/bundle, disjoint
application, accessibility, SEO and CSP browser suites, and visual comparison.
The CSP suite retains enforcing and report-only modes. The inventory,
manifest, package scripts, import/type/lint/coverage configuration and CI policy
must agree. Follow [validation](validation.md) for fresh installs, the isolated
proposed tree and complete execution; focused checks do not replace that gate.

Browser acceptance uses this repository's [local HTTP fixture](api-fixture.md),
fresh in-memory state, explicit loopback targets and the verified browser. It
exercises the real website against synthetic responses, not compatibility with
an external backend. Record the exact source/tree and
actual results, including failures, skips and cleanup. Unit mocks, a readiness
marker or a pass from another tree cannot establish integration success.

## Visual and hosted acceptance

Visual comparison requires compatible platform, SDK/browser, font and source
metadata. Keep baseline bytes and dates intact. Updating an image requires
explicit authorization and actual visual review; capture failure leaves review
pending. See [visual regression](visual-regression.md).

Before runnable merge, observe genuine current-head success from every required
CI producer and the protected `check` aggregate. The aggregate must require the
application build, each browser suite and visual comparison. Changes to protected
contexts require explicit authorization. Scanner execution, native Sonar quality gate and review
are separate evidence under [branch protection](branch-protection.md) and the
[CodeRabbit preflight](reviews.md#before-requesting-coderabbit).

## Publication boundary

[Contributing](../CONTRIBUTING.md) owns PR sizing, authorization and sequencing.
Keep required behavior, tests and acceptance together when selecting a package;
revalidate whenever the proposed bytes change. Application acceptance grants no
release, workflow-dispatch or deployment authority. Those operations follow
[delivery](deployment.md), [operations](release-operations.md) and
[staging](staging.md).

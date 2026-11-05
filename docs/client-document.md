# Trace document-related behavior

The [features phase](bootstrap.md) publishes client features, HTTP support and
document policy helpers. Follow the relevant owner and its local tests.

| Symptom                                      | Investigation path                                                                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unexpected language, direction or message    | Follow [localization](localization.md) from public settings through the catalog loader and explicit client message scopes. Check the API's direction independently of its language code.                                                                          |
| Unexpected API response or forwarding header | Follow [authentication boundary review](authentication-review.md) and the [HTTP forwarding owner](../src/shared/api/proxy.ts). Check the route/method, Origin and header allowlists with synthetic requests. This helper is not yet mounted as a framework route. |
| Stale account, pending state or countdown    | Follow [session ownership](session.md), then the provider, form or hook test for the affected transition. See [forms](forms.md).                                                                                                                                  |
| Labels, feedback or theme behavior           | Follow [client UI](client-ui.md) and the relevant component test; use [accessibility](accessibility.md) for the limits of local component evidence.                                                                                                               |
| Unexpected canonical, indexing or JSON-LD    | Check the explicit public origin, page pathname and indexing flag in the helper tests. See [SEO](seo.md).                                                                                                                                                         |
| Unexpected CSP directive or document path    | Check the mode, pathname and nonce inputs against the pure policy. See [CSP](website-csp.md).                                                                                                                                                                     |
| Missing metric or unexpected font preload    | Check the explicit metric subscription and the configured locale. See [performance helpers](website-performance.md).                                                                                                                                              |

Page composition and framework request adapters belong to later integration.
That phase can verify the actual metadata and CSP headers returned for a
document and trace the request through the framework. [Architecture](architecture.md)
and [source navigation](source-navigation.md).

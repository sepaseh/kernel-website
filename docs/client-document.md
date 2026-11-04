# Trace a page request

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

This phase publishes client and HTTP support modules without page composition.
Start with the relevant owner and its local tests:

| Symptom                                      | Investigation path                                                                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unexpected language, direction or message    | Follow [localization](localization.md) from public settings through the catalog loader and explicit client message scopes. Check the API's direction independently of its language code.                                                                          |
| Unexpected API response or forwarding header | Follow [authentication boundary review](authentication-review.md) and the [HTTP forwarding owner](../src/shared/api/proxy.ts). Check the route/method, Origin and header allowlists with synthetic requests. This helper is not yet mounted as a framework route. |
| Stale account, pending state or countdown    | Follow [session ownership](session.md), then the provider or hook test for the affected transition. [Forms](forms.md) separates the published helpers from planned form integration.                                                                              |
| Labels, feedback or theme behavior           | Follow [client UI](client-ui.md) and the relevant component test; use [accessibility](accessibility.md) for the limits of local component evidence.                                                                                                               |

Page metadata, document CSP headers and framework request composition are not
published in this phase, so there is no current page-level troubleshooting path
for them. Use [architecture](architecture.md) for intended ownership and
[source navigation](source-navigation.md) to verify which owners and tests are
actually admitted before investigating a later composition.

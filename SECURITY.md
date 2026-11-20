# Security policy

## Report a vulnerability privately

Use **Report a vulnerability** in the repository's GitHub **Security** tab when
private reporting is available. Otherwise, ask the repository owner for a
secure channel before sharing technical details. Keep reports and sensitive
details out of public issues, pull requests, commits and logs.

Include the affected revision, feature or endpoint, expected and observed
behavior, potential impact and steps using synthetic data. Redact credentials,
tokens, personal information and sensitive payloads from the report and any
attachments. Review error messages and nested causes before sharing them.

Get explicit authorization before testing an existing service or production
system. Keep exploit details and credentials out of assistant messages.

## Validate a fix

Keep the original failure visible, add a focused regression when warranted and
follow [exact-tree validation](docs/validation.md). Do not suppress findings,
exclude source or weaken the review gate.
Use the [threat model](docs/threat-model.md) for assumptions about the website,
its HTTP API and its deployment boundary.

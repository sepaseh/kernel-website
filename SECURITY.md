# Security

## Report a vulnerability privately

For a suspected vulnerability, use this repository's GitHub **Security** tab and
**Report a vulnerability** when private reporting is available.
If it is unavailable, request a private reporting channel from the repository
owner before sharing technical details. Do not post an exploit or credential
in a public issue, PR, log or assistant message.

Include the affected revision, reproduction with synthetic data, expected
behavior and impact. Omit tokens, real user records and production payloads.
Do not test an existing service or production system without explicit authority.

## Validate a fix

Keep the original failure visible, add a focused regression when warranted and
follow [exact-tree validation](docs/validation.md). Do not suppress findings,
exclude source or weaken the review gate.
The governance publication does not establish application or deployment security.

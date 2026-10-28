# Decision records

[English](README.md) · [فارسی](README.fa.md)

These accepted decisions define source/service ownership and the website's intended
runtime, HTTP, language and session boundaries. Delivery status comes from the
[publication marker](../../.github/bootstrap-policy.json), exact inventory and
[application acceptance](../application.md), rather than the ADR status.
Implementation notes distinguish false-marker support evidence from executed
application and deployment evidence. An accepted decision is
not evidence that a build, browser journey or deployment has run. Read owner
source and tests before changing a boundary.

- [0001 Website runtime](0001-independent-runtimes.md)
- [0002 HTTP boundary](0002-lightweight-clean-api.md)
- [0003 One active language](0003-single-active-language.md)
- [0004 Cookie sessions](0004-cookie-proxy-and-sessions.md)
- [0005 Local source ownership](0005-independent-repositories.md)

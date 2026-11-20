# Changelog

Release Please generates versioned entries from the commit history.
Verify the existence and source revision of a tag or release using the
[publication procedure](docs/releasing.md#review-and-verify-publication).

## Unreleased

### Added

- Published articles, category archives, media and private article preview. [Blog](docs/blog.md)
- A public contact form with duplicate-safe retries and a paginated FAQ with native disclosures. [Contact](docs/contact.md) · [FAQs](docs/faq.md)

### Changed

- Aligned the account permission type with Kernel Admin's content, category and file permissions.
- Updated Node to `24.22.2` and refreshed compatible npm packages, including Next.js `16.4.6`, next-intl `4.15.3`, Vitest `5.1.1` and ESLint `10.15.0`. [Package manifest](package.json) · [Lockfile](package-lock.json)
- Browser checks verify the same build after execution. Coverage evidence checks measured paths against the Git tree, and smoke and staging checks require successful same-origin asset delivery. [Validation](docs/validation.md) · [Staging](docs/staging.md)

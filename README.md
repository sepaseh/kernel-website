# Kernel Website

Kernel Website is the standalone Next.js and TypeScript application for
public-facing Kernel features. It uses a configured HTTP API for content,
settings and accounts. The built-in synthetic API lets you run the website
locally with disposable data.

## Run locally

Use a source directory without runtime dotenv files.

1. From the repository root, use the Node version in [.nvmrc](.nvmrc) and
   install the locked packages with `npm ci --include=dev`.
2. Set the public loopback inputs in both terminals. Use the PowerShell or shell
   example in the [local development guide](docs/development.md#set-explicit-local-inputs).
3. Start the synthetic API in the first terminal and wait for its listening
   message. Leave it running.

   ```sh
   node scripts/test-website-api.mjs
   ```

4. In the second terminal, build and start the website.

   ```sh
   npm run build
   npm start
   ```

5. Open <http://127.0.0.1:3010> and visit `/blog`, `/faq`, `/contact` or `/login`.
   Stop both processes with Ctrl+C when finished. Stopping the fixture discards
   its accounts, messages and other in-memory changes.

For environment setup, feature edits and browser checks, follow the
[local development guide](docs/development.md). For startup and check failures,
start with [local troubleshooting](docs/troubleshooting.md).

## Included capabilities

- Multilingual home page, published blog and frequently asked questions.
- Public contact form.
- Registration, sign-in, password recovery and account management.

The publication phase is **operations** and application readiness is **true**.
The [publication policy](.github/bootstrap-policy.json) defines admitted files.
Build, browser and deployment results depend on execution in their respective
environments.

## Documentation

- [Documentation index](docs/README.md) for guides by task.
- [Architecture](docs/architecture.md) for system boundaries and source ownership.
- [Development](docs/development.md) for local setup and source changes.
- [Validation](docs/validation.md) for required checks and evidence.
- [Deployment](docs/deployment.md) for packaging and deployment.

While editing, use the affected checks from the [validation manifest](.agents/validation.json).
Before an authorized commit, push or PR handoff, run the full profile against
the exact proposed tree with the local fixture and reviewed Chromium build.

## Get help and contribute

Use repository issues for bugs and feature requests. Report suspected
vulnerabilities privately. [Issues](https://github.com/sepaseh/kernel-website/issues) · [Security policy](SECURITY.md)

Follow the contribution workflow to propose a change. Assistants start at the
repository's assistant entry point. [Contributing](CONTRIBUTING.md) · [Assistant entry point](AGENTS.md)

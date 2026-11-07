# Run the website locally

Read the current [source scope](bootstrap.md) before using this reference. Published source and constraints do not themselves establish execution, compatibility or deployment.

Use this guide to open the website locally, make a feature change and verify its
visible behavior. It starts the website against this repository's test-only HTTP
fixture. Each fixture process owns fresh in-memory state that is discarded when
that process stops.
Use a clean website source directory without runtime dotenv files. Do not point
these commands at an existing API or a developer database.

## Install the toolchain

Use the exact Node version in [.nvmrc](../.nvmrc) and its bundled npm.

From the website root, include the development tools required for validation and
browser acceptance:

```sh
npm ci --include=dev
```

The [local HTTP fixture](api-fixture.md) is included in this repository and uses
Node's built-in HTTP server. It needs no separate checkout or installation.

## Set explicit local inputs

The examples use free loopback ports 3010 for the website and 3100 for the API.
Set the same values in each terminal used below. These are public test
settings, not secrets.

PowerShell:

```powershell
$env:KERNEL_SYNTHETIC_ENV = '1'
$env:NODE_ENV = 'production'
$env:NPM_CONFIG_INCLUDE = 'dev'
$env:HOSTNAME = '127.0.0.1'
$env:PORT = '3010'
$env:WEBSITE_URL = 'http://127.0.0.1:3010'
$env:API_BASE_URL = 'http://127.0.0.1:3100'
$env:WEBSITE_INDEXING_ENABLED = 'false'
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
```

POSIX shell:

```sh
export KERNEL_SYNTHETIC_ENV=1 NODE_ENV=production NPM_CONFIG_INCLUDE=dev
export HOSTNAME=127.0.0.1 PORT=3010
export WEBSITE_URL=http://127.0.0.1:3010 API_BASE_URL=http://127.0.0.1:3100
export WEBSITE_INDEXING_ENABLED=false PLAYWRIGHT_BROWSERS_PATH=0
```

The website's public [.env.example](../.env.example) documents application fields;
the synthetic runner takes values from the shell and refuses runtime dotenv
files. Supply no authentication secret, database URL or storage setting; the
fixture uses only its owned in-memory state.

## Build and open

In the first terminal, start the synthetic API and leave it running:

```sh
node scripts/test-website-api.mjs
```

The launcher selects `scripts/website-api-fixture.mjs` in this repository and
starts it in test mode. It derives API port 3100 from `API_BASE_URL`; keep the
parent `PORT` set to the website's 3010.

In a second terminal at the website root, with the same local inputs:

```sh
npm run build
npm start
```

Open `http://127.0.0.1:3010`. The home page should render, `/login` should show the
sign-in form and `/account` should require a session. The synthetic API uses the
test-only OTP `123456`; this value does not describe production OTP delivery.
The website language comes from API settings; changing browser language or a
cookie does not select it. Theme preference is independent.

This project currently supplies a production build/start loop. After an edit,
stop the website with Ctrl+C, rebuild and start again. Stop each owned launcher
with Ctrl+C when finished; the fixture launcher drains its direct child.
Stopping the fixture discards its in-memory accounts and sessions.

## Change and verify a feature

Find the owner in [architecture](architecture.md) and
[navigation](source-navigation.md). Keep behavior in `src/features`, reusable
frontend infrastructure in `src/shared`, and page composition in `src/app`.
For example, a profile-form change belongs with
`src/features/account/components/profile-form`, its API DTO and its existing
`ProfileForm.test.tsx`, rather than in the account route.
Login, registration and recovery belong under `src/features/auth`; their shared
session owner is `src/features/auth/session`. Home content stays in
`src/features/home`. Reuse `src/shared/ui` for controls and
`src/shared/lib/cn.ts` for class composition. Header and Footer are app shell
components in `src/app/_components`, not general shared controls.

Run that existing focused test while editing:

```sh
node node_modules/vitest/vitest.mjs run src/features/account/components/profile-form/ProfileForm.test.tsx
```

Then run affected boundary/type/lint checks from the
[canonical manifest](../.agents/validation.json). Changes to forms need observable
submission/error/stale-account assertions; preserve password whitespace, OTP
destinations and reset identity. UI changes also need browser and visual review
under [Design](../DESIGN.md).

### Worked example: profile feedback

For a small profile-feedback change, follow the existing update path instead of
adding logic to the account route. The example keeps the HTTP contract unchanged.

1. Open [ProfileForm](../src/features/account/components/profile-form/ProfileForm.tsx).
   It submits `first_name` and `last_name`, accepts the normalized returned account
   and shows the `accountProfileUpdated` translation in `Feedback`. Its reset key
   contains locale, session generation and account ID. Preserve that identity and
   the captured operation guard while editing feedback.
2. Trace [ProfileUpdateRequest](../src/features/account/types.ts),
   [updateProfile](../src/features/account/api.ts) and the
   [HTTP client](../src/shared/api/client.ts). The existing request is
   `PATCH /api/account/update-profile` with JSON such as
   `{"first_name":"Grace","last_name":"Hopper"}`. `textValue` trims ordinary
   names; returned values, including API normalization, replace the displayed
   fields. Adding a field or changing wire vocabulary needs API compatibility work
   before a frontend DTO edit.
3. When changing visible success wording, update the existing
   `accountProfileUpdated` key in all ten
   catalog files. Preserve the flat 107-key
   contract, complete genuine translations and any ICU placeholders. The existing
   account client-message selection already includes this key. An intentional new
   key also needs explicit selection and scope tests; follow
   [localization](localization.md).
4. Extend the existing successful-submit case in
   [ProfileForm.test.tsx](../src/features/account/components/profile-form/ProfileForm.test.tsx)
   to assert the intended status text. Keep its assertions for trimmed submitted
   names and normalized server values. Retain failure/input preservation,
   duplicate-submit and replacement-session cases: a wording change must not
   break those behaviors. API vocabulary assertions remain in the account HTTP
   suite.

Run the affected suites with the installed test CLI:

```sh
node node_modules/vitest/vitest.mjs run src/features/account/components/profile-form/ProfileForm.test.tsx src/features/account/api.test.ts src/i18n/catalog-data/integrity.test.ts src/i18n/client-messages.test.ts
npm run check:boundaries
npm run typecheck
npm run lint
```

Expected result: the targeted suites and source checks pass. Rebuild/restart the
owned website, register/sign in using a synthetic account and open `/account`.
Enter `  Grace  ` and `  Hopper  `, then choose **Save profile**. The form should
display the API's normalized names and announce the intended success text. A
failed write keeps the entered values; it must not show success. The API-selected
language controls the actual labels. Do not save a visitor language choice to
exercise another catalog. Use the browser suites' synthetic scenarios for that.

Restore the intended final change before complete validation. An illustrative
exercise is not permission to change the product's HTTP contract or translations
without a requirement.

## Browser acceptance and handoff

For browser acceptance, install project-local Chromium and let the test runner
own its API and website processes. Stop manually started launchers first:

```sh
node node_modules/@playwright/test/cli.js install chromium
npm run build
npm run test:e2e
npm run test:accessibility
npm run test:seo
npm run test:csp
npm run test:visual
```

These commands consume the same verified website build and local HTTP fixture.
Application journeys, accessibility, SEO, CSP and visual comparison run separately;
the CSP command exercises both enforcing and report-only modes. A source or build
change requires a new build. This verifies frontend behavior against synthetic
responses, not compatibility with a deployed backend.

Before handing off a change, follow [exact-tree validation](validation.md) in a
fresh disposable export and run every required check:

```sh
npm run validate -- full
```

The procedure covers the complete gate beyond the browser checks above, including
fresh dependencies and source verification. Record the exact tree, actual results
and remaining limits.

See [troubleshooting](troubleshooting.md) for failed setup checks.

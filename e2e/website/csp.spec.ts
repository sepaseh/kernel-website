import { expect, test } from "@playwright/test";

import { websiteOrigin } from "./helpers";

const mode = process.env.WEBSITE_TEST_CSP_MODE ?? "enforce";
const enforcing = mode === "enforce";
const header = enforcing
  ? "content-security-policy"
  : "content-security-policy-report-only";
const nonceFrom = (value: string) => value.match(/'nonce-([^']+)'/)?.[1];

test("uses fresh unforgeable document nonces for framework, theme and JSON-LD scripts", async ({
  page,
  request,
}) => {
  const first = await request.get(websiteOrigin, {
    headers: {
      "x-kernel-csp-nonce": "A".repeat(24),
      "content-security-policy": "script-src 'unsafe-inline'",
    },
  });
  const second = await request.get(websiteOrigin);
  expect(first.status()).toBe(200);
  const nonce = nonceFrom(first.headers()[header]);
  expect(nonce).toMatch(/^[A-Za-z0-9+/]{24}$/);
  expect(nonce).not.toBe("A".repeat(24));
  expect(nonceFrom(second.headers()[header])).not.toBe(nonce);
  expect(first.headers()["cache-control"]).toContain("no-store");
  expect(
    first.headers()[
      enforcing
        ? "content-security-policy-report-only"
        : "content-security-policy"
    ],
  ).toBeUndefined();

  const response = await page.goto(websiteOrigin);
  const documentNonce = nonceFrom(response!.headers()[header]);
  // next-themes deliberately clears its live script nonce after hydration.
  // Verify the initial server document that the browser actually executes.
  const scripts = await page.evaluate(
    (html) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      return [...parsed.querySelectorAll("script")].map((element) => ({
        nonce: element.nonce,
        type: element.type,
      }));
    },
    await response!.text(),
  );
  expect(scripts.length).toBeGreaterThan(3);
  expect(scripts.every((script) => script.nonce === documentNonce)).toBe(true);
  expect(scripts.some((script) => script.type === "application/ld+json")).toBe(
    true,
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("blocks or reports nonce-less scripts, while trusted inline scripts execute", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as { cspViolations: string[] };
    state.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) =>
      state.cspViolations.push(
        `${event.disposition}:${event.effectiveDirective}`,
      ),
    );
  });
  // Browser-debugger evaluation can bypass CSP. Inject into the response so
  // both probes are ordinary parser-inserted scripts under its real headers.
  await page.route(`${websiteOrigin}/`, async (route) => {
    const response = await route.fetch();
    const nonce = nonceFrom(response.headers()[header]);
    const html = (await response.text()).replace(
      "</head>",
      `<script nonce="${nonce}">window.kernelTrustedProbe = true</script>` +
        `<script>window.kernelUntrustedProbe = true</script></head>`,
    );
    await route.fulfill({ response, body: html });
  });
  await page.goto(websiteOrigin);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { cspViolations: string[] }).cspViolations,
      ),
    )
    .toContain(`${enforcing ? "enforce" : "report"}:script-src-elem`);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { kernelTrustedProbe?: boolean })
          .kernelTrustedProbe,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { kernelUntrustedProbe?: boolean })
          .kernelUntrustedProbe,
    ),
  ).toBe(enforcing ? undefined : true);
});

test("blocks or reports unauthorized style elements without breaking nonce-bearing theme styles", async ({
  page,
}) => {
  await page.goto(websiteOrigin);
  const result = await page.evaluate(async () => {
    const probe = document.createElement("p");
    probe.id = "kernel-csp-style-probe";
    probe.textContent = "Style policy probe";
    document.body.append(probe);
    const untrusted = document.createElement("style");
    untrusted.textContent =
      "#kernel-csp-style-probe { color: rgb(1, 2, 3) !important; }";
    document.head.append(untrusted);
    await new Promise(requestAnimationFrame);
    const untrustedApplied = getComputedStyle(probe).color === "rgb(1, 2, 3)";
    untrusted.remove();
    const trusted = document.createElement("style");
    trusted.nonce = document.querySelector("script")!.nonce;
    trusted.textContent =
      "#kernel-csp-style-probe { color: rgb(3, 2, 1) !important; }";
    document.head.append(trusted);
    await new Promise(requestAnimationFrame);
    const trustedApplied = getComputedStyle(probe).color === "rgb(3, 2, 1)";
    trusted.remove();
    probe.remove();
    return { untrustedApplied, trustedApplied };
  });
  expect(result).toEqual({
    untrustedApplied: !enforcing,
    trustedApplied: true,
  });
});

test("keeps API, fonts and metadata delivery separate and protects real missing documents", async ({
  request,
}) => {
  const personal = await request.get(`${websiteOrigin}/api/account/me`);
  expect(personal.status()).toBe(401);
  expect(personal.headers()["cache-control"]).toBe("private, no-store");
  for (const resource of [
    "/fonts/vazirmatn-latin.woff2",
    "/robots.txt",
    "/sitemap.xml",
    "/icon.svg",
    "/social-image",
  ]) {
    const response = await request.get(`${websiteOrigin}${resource}`);
    expect(response.status()).toBe(200);
    expect(response.headers()[header]).toBeUndefined();
    if (resource === "/social-image")
      expect(response.headers()["cache-control"]).toContain(
        "public, max-age=86400",
      );
  }
  const missing = await request.get(`${websiteOrigin}/missing-csp-document`, {
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  expect(missing.status()).toBe(404);
  expect(nonceFrom(missing.headers()[header])).toBeTruthy();
});

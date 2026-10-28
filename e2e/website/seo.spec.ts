import type { ChildProcess } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

import { localeCodes } from "@/i18n/catalog-data/locales";
import english from "@/i18n/catalog-data/locales/en";
import { catalogs } from "@/i18n/catalogs";

import { artifactFile } from "../../scripts/release-files.mjs";
import { readyRunnerRoot } from "../../scripts/runner-inputs.mjs";
import { startOwnedProcess } from "../../scripts/runner-process.mjs";
import { apiOrigin, setSiteLanguage, websiteOrigin } from "./helpers";

const canonicalOrigin = "https://kernel-seo.test";
const canonicalHome = `${canonicalOrigin}/`;
const botHeaders = { "User-Agent": "facebookexternalhit/1.1" };
const repository = fileURLToPath(new URL("../../", import.meta.url));
const websiteDirectory = repository;

// Parse the returned HTML without loading its scripts, styles or resources.
const inspectHtml = (page: Page, html: string) =>
  page.evaluate((source) => {
    const parsed = new DOMParser().parseFromString(source, "text/html");
    const meta = Object.fromEntries(
      [...parsed.head.querySelectorAll("meta[name], meta[property]")].map(
        (element) => [
          element.getAttribute("name") ?? element.getAttribute("property"),
          element.getAttribute("content"),
        ],
      ),
    );
    return {
      canonical: [...parsed.head.querySelectorAll('link[rel="canonical"]')].map(
        (element) => element.getAttribute("href"),
      ),
      direction: parsed.documentElement.dir,
      hreflang: parsed.querySelectorAll("link[hreflang]").length,
      jsonLd: [
        ...parsed.querySelectorAll('script[type="application/ld+json"]'),
      ].map((element) => JSON.parse(element.textContent ?? "null")),
      language: parsed.documentElement.lang,
      meta,
      robots: [...parsed.querySelectorAll('meta[name="robots"]')].map(
        (element) => element.getAttribute("content") ?? "",
      ),
      title: parsed.head.querySelector("title")?.textContent,
    };
  }, html);

const freePort = async () => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No loopback port was allocated.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
};

// A second process deliberately reuses the production build with different
// runtime configuration. It cannot read operator dotenv files or real APIs.
const withWebsite = async (
  request: APIRequestContext,
  options: { indexing: boolean; apiOrigin?: string },
  check: (origin: string) => Promise<void>,
) => {
  await readyRunnerRoot(websiteDirectory);
  const standaloneServer = await artifactFile(
    path.join(websiteDirectory, ".next/standalone/server.js"),
  );
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  let output = "";
  const owned: Omit<ReturnType<typeof startOwnedProcess>, "child"> & {
    child: ChildProcess;
  } = startOwnedProcess({
    args: [standaloneServer],
    cwd: websiteDirectory,
    env: {
      API_BASE_URL: options.apiOrigin ?? apiOrigin,
      CI: "1",
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_ENV: "production",
      PORT: String(port),
      PATH: process.env.PATH ?? "",
      WEBSITE_URL: canonicalOrigin,
      WEBSITE_INDEXING_ENABLED: String(options.indexing),
      WEBSITE_CSP_MODE: "enforce",
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
      ...(process.env.TMP ? { TMP: process.env.TMP } : {}),
    },
    signal: undefined,
    stdio: "pipe",
  });
  const { child } = owned;
  child.stdout?.on("data", (data) => {
    output = (output + data).slice(-8_000);
  });
  child.stderr?.on("data", (data) => {
    output = (output + data).slice(-8_000);
  });
  let finished = false;
  let processFailure: unknown;
  const observedCompletion = owned.completion.then(
    () => {
      finished = true;
    },
    (error: unknown) => {
      finished = true;
      processFailure = error;
    },
  );
  let primaryFailure: { error: unknown } | undefined;
  try {
    await expect
      .poll(
        async () => {
          if (finished)
            throw (
              processFailure ??
              new Error(`The isolated SEO website exited. ${output}`)
            );
          try {
            return (
              await request.get(`${origin}/robots.txt`, { timeout: 2_000 })
            ).status();
          } catch {
            return 0;
          }
        },
        {
          timeout: 30_000,
          message: "The isolated SEO website should become ready.",
        },
      )
      .toBe(200);
    await check(origin);
    if (finished || child.exitCode !== null || child.signalCode !== null)
      throw (
        processFailure ??
        new Error(`The isolated SEO website exited during its check. ${output}`)
      );
  } catch (error) {
    primaryFailure = { error };
  }

  let cleanupFailure: { error: unknown } | undefined;
  try {
    await owned.stop();
    // A successful bounded stop drains close; a failed stop must not leave this
    // helper waiting forever for a completion that can no longer be guaranteed.
    await observedCompletion;
  } catch (error) {
    cleanupFailure = { error };
  }
  if (primaryFailure && cleanupFailure)
    throw new AggregateError(
      [primaryFailure.error, cleanupFailure.error],
      "The isolated SEO check and its owned process cleanup both failed.",
      { cause: primaryFailure.error },
    );
  if (primaryFailure) throw primaryFailure.error;
  if (cleanupFailure) throw cleanupFailure.error;
};

test.beforeEach(async ({ request, context }) => {
  await setSiteLanguage(request, "en");
  // Metadata's synthetic canonical origin must never become a network target.
  await context.route(/^https?:\/\//, (route) =>
    new URL(route.request().url()).origin === websiteOrigin
      ? route.continue()
      : route.abort(),
  );
});

test.afterEach(async ({ request }) => {
  await setSiteLanguage(request, "en");
});

for (const locale of localeCodes) {
  test(`serves complete '${locale}' homepage SEO from the persisted language in SSR and the browser`, async ({
    page,
    request,
  }) => {
    const messages = (await catalogs[locale]()).default;
    const otherLocale = locale === "en" ? "fa" : "en";
    const configuredLanguage = await setSiteLanguage(request, locale);
    await withWebsite(request, { indexing: true }, async (origin) => {
      // Only this owned loopback server may supply the positive indexing case.
      // The synthetic canonical HTTPS origin remains a blocked network target.
      await page.route(`${origin}/**`, (route) => route.continue());
      const response = await request.get(
        `${origin}/?utm_source=seo&preview=ignored`,
        {
          headers: {
            ...botHeaders,
            "Accept-Language": otherLocale,
            Cookie: `NEXT_LOCALE=${otherLocale}`,
          },
        },
      );
      expect(response.status()).toBe(200);
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
      const document = await inspectHtml(page, await response.text());
      expect(document.language).toBe(locale);
      expect(document.direction).toBe(configuredLanguage.direction);
      expect(document.title).toBe(messages.metadataTitle);
      expect(document.meta.description).toBe(messages.metadataDescription);
      expect(
        document.canonical.map((value) => new URL(value ?? "").href),
      ).toEqual([canonicalHome]);
      expect(document.hreflang).toBe(0);
      expect(document.meta.robots).toBe("index, follow");
      expect(document.meta["og:type"]).toBe("website");
      expect(document.meta["og:site_name"]).toBe("Kernel");
      expect(document.meta["og:title"]).toBe(messages.metadataTitle);
      expect(document.meta["og:description"]).toBe(
        messages.metadataDescription,
      );
      expect(new URL(document.meta["og:url"]).href).toBe(canonicalHome);
      expect(document.meta["og:image"]).toBe(`${canonicalOrigin}/social-image`);
      expect(document.meta["og:image:width"]).toBe("1200");
      expect(document.meta["og:image:height"]).toBe("630");
      expect(document.meta["twitter:card"]).toBe("summary_large_image");
      expect(document.meta["twitter:title"]).toBe(messages.metadataTitle);
      expect(document.meta["twitter:description"]).toBe(
        messages.metadataDescription,
      );
      expect(document.meta["twitter:image"]).toBe(
        `${canonicalOrigin}/social-image`,
      );
      expect(document.jsonLd).toEqual([
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": canonicalHome,
          url: canonicalHome,
          name: "Kernel",
          description: messages.metadataDescription,
          inLanguage: locale,
        },
      ]);

      await page.goto(`${origin}/?utm_source=seo`);
      await expect(page).toHaveTitle(messages.metadataTitle);
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
        "href",
        /^https:\/\/kernel-seo\.test\/?$/,
      );
      await expect(
        page.locator('head meta[name="description"]'),
      ).toHaveAttribute("content", messages.metadataDescription);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        messages.homeTitle,
      );
    });
  });
}

test("publishes only the real homepage in discovery files and serves a valid local social PNG", async ({
  page,
  request,
}) => {
  await withWebsite(request, { indexing: true }, async (origin) => {
    const robots = await request.get(`${origin}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(robots.headers()["content-type"]).toContain("text/plain");
    const text = await robots.text();
    expect(text).toMatch(/^User-Agent: \*$/m);
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text.match(/^Disallow: .*$/gm)).toEqual(["Disallow: /api/"]);
    expect(text).toContain(`Sitemap: ${canonicalOrigin}/sitemap.xml`);

    const sitemap = await request.get(`${origin}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()["content-type"]).toContain("xml");
    const xml = await sitemap.text();
    expect(
      await page.evaluate((source) => {
        const parsed = new DOMParser().parseFromString(
          source,
          "application/xml",
        );
        if (parsed.querySelector("parsererror"))
          throw new Error("Invalid sitemap XML.");
        return [...parsed.querySelectorAll("loc")].map(
          (element) => element.textContent,
        );
      }, xml),
    ).toEqual([canonicalHome]);
    expect(xml).not.toContain("<lastmod>");
    const image = await request.get(`${origin}/social-image`);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    const bytes = await image.body();
    expect([...bytes.subarray(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
    await test.info().attach("social-image", {
      body: bytes,
      contentType: "image/png",
    });
    const icon = await request.get(`${origin}/icon.svg`);
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  });
});

test("keeps utility, API and missing pages out of search without borrowing the homepage canonical", async ({
  page,
  request,
}) => {
  for (const pathname of [
    "/login",
    "/register",
    "/forgot-password",
    "/account",
  ]) {
    const response = await request.get(`${websiteOrigin}${pathname}`, {
      headers: botHeaders,
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    const document = await inspectHtml(page, await response.text());
    expect(document.robots).toContain("noindex, nofollow");
    expect(document.canonical).toEqual([]);
    expect(document.jsonLd).toEqual([]);
  }
  const api = await request.get(`${websiteOrigin}/api/account/me`);
  expect(api.status()).toBe(401);
  expect(api.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  const missing = await request.get(
    `${websiteOrigin}/seo-page-that-does-not-exist`,
    { headers: botHeaders },
  );
  expect(missing.status()).toBe(404);
  const document = await inspectHtml(page, await missing.text());
  expect(document.robots.some((value) => value.includes("noindex"))).toBe(true);
  expect(document.canonical).toEqual([]);
  expect(document.jsonLd).toEqual([]);
});

test("renders readable public content and usable links with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    reducedMotion: "reduce",
  });
  try {
    await context.route(/^https?:\/\//, (route) =>
      new URL(route.request().url()).origin === websiteOrigin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(websiteOrigin);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      english.homeTitle,
    );
    await expect(
      page.getByText(english.homeIntro, { exact: true }),
    ).toBeVisible();
    const main = page.getByRole("main");
    for (const text of [
      english.homeSectionTitle,
      english.homeIdentityTitle,
      english.homeDetailTitle,
      english.homeCtaTitle,
    ]) {
      const heading = main.getByRole("heading", { name: text, exact: true });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
      const opacity = await heading.evaluate((element) => {
        let opacity = 1;
        for (
          let current: Element | null = element;
          current;
          current = current.parentElement
        )
          opacity *= Number(getComputedStyle(current).opacity);
        return opacity;
      });
      expect(opacity).toBe(1);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: test.info().outputPath("home-without-javascript.png"),
      fullPage: true,
    });
    await main
      .getByRole("link", { name: english.register, exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(`${websiteOrigin}/register`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      english.authRegisterTitle,
    );
  } finally {
    await context.close();
  }
});

test("honors preview noindex and an empty sitemap at runtime using the same production build", async ({
  page,
  request,
}) => {
  await withWebsite(request, { indexing: false }, async (origin) => {
    const home = await request.get(`${origin}/`, { headers: botHeaders });
    expect(home.status()).toBe(200);
    expect(home.headers()["x-robots-tag"]).toBe("noindex, follow");
    const document = await inspectHtml(page, await home.text());
    expect(document.meta.robots).toBe("noindex, follow");
    expect(
      document.canonical.map((value) => new URL(value ?? "").href),
    ).toEqual([canonicalHome]);
    const robots = await request.get(`${origin}/robots.txt`);
    expect(robots.headers()["x-robots-tag"]).toBe("noindex, follow");
    const text = await robots.text();
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text).toContain("Disallow: /api/");
    expect(text).not.toContain("Sitemap:");
    const sitemap = await request.get(`${origin}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain("<loc>");
  });
});

for (const { code, direction } of [
  { code: "en", direction: "rtl" },
  { code: "fa", direction: "ltr" },
] as const) {
  test(`honors API direction '${direction}' for '${code}' in SSR and after hydration`, async ({
    page,
    request,
  }) => {
    const settingsApi = createHttpServer((request, response) => {
      if (request.url !== "/settings") {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify({
          language: {
            calendar: "gregorian",
            code,
            direction,
            name: code,
            native_name: code,
          },
          dark_theme: {},
          light_theme: {},
        }),
      );
    });
    await new Promise<void>((resolve) =>
      settingsApi.listen(0, "127.0.0.1", resolve),
    );
    const address = settingsApi.address();
    if (!address || typeof address === "string")
      throw new Error("No isolated settings port was allocated.");
    try {
      await withWebsite(
        request,
        { indexing: false, apiOrigin: `http://127.0.0.1:${address.port}` },
        async (origin) => {
          const response = await request.get(`${origin}/`, {
            headers: botHeaders,
          });
          expect(response.status()).toBe(200);
          const document = await inspectHtml(page, await response.text());
          expect(document.language).toBe(code);
          expect(document.direction).toBe(direction);
          await page.route(/^https?:\/\//, (route) =>
            new URL(route.request().url()).origin === origin
              ? route.continue()
              : route.abort(),
          );
          await page.goto(origin);
          await expect(page.locator("html")).toHaveAttribute("lang", code);
          await expect(page.locator("html")).toHaveAttribute("dir", direction);
          const messages = (await catalogs[code]()).default;
          await expect(page.getByRole("heading", { level: 1 })).toContainText(
            messages.homeTitle,
          );
          // This control requires hydration; direction must survive it unchanged.
          const previousTheme = await page
            .locator("html")
            .getAttribute("class");
          await page
            .getByRole("button", { name: messages.siteTheme })
            .first()
            .click();
          await expect(page.locator("html")).not.toHaveAttribute(
            "class",
            previousTheme ?? "",
          );
          await expect(page.locator("html")).toHaveAttribute("dir", direction);
        },
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        settingsApi.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
}

test("returns a non-indexable error document when the isolated settings API is unavailable", async ({
  page,
  request,
}) => {
  // A local 503 responder exercises the genuine failure path. No API process,
  // production setting, database or owner resource is stopped or modified.
  const unavailable = createHttpServer((_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end('{"error":"Synthetic isolated SEO outage"}');
  });
  await new Promise<void>((resolve) =>
    unavailable.listen(0, "127.0.0.1", resolve),
  );
  const address = unavailable.address();
  if (!address || typeof address === "string")
    throw new Error("No isolated outage port was allocated.");
  try {
    await withWebsite(
      request,
      { indexing: true, apiOrigin: `http://127.0.0.1:${address.port}` },
      async (origin) => {
        const response = await request.get(`${origin}/`, {
          headers: botHeaders,
        });
        expect(response.status()).toBeGreaterThanOrEqual(500);
        const document = await inspectHtml(page, await response.text());
        expect(document.robots.some((value) => value.includes("noindex"))).toBe(
          true,
        );
        expect(document.canonical).toEqual([]);
        expect(document.jsonLd).toEqual([]);
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      unavailable.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

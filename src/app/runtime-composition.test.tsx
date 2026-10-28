// @vitest-environment node
import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/features/auth/SessionProvider";
import english from "@/i18n/catalog-data/locales/en";
import { TestIntlProvider } from "@/test/intl";
import { Footer } from "@/website/layouts/Footer";
import { Header } from "@/website/layouts/Header";

import RecoveryPage, {
  generateMetadata as recoveryMetadata,
} from "./(auth)/forgot-password/page";
import AuthLayout from "./(auth)/layout";
import LoginPage, {
  generateMetadata as loginMetadata,
} from "./(auth)/login/page";
import RegisterPage, {
  generateMetadata as registerMetadata,
} from "./(auth)/register/page";
import AccountPage, {
  generateMetadata as accountMetadata,
} from "./account/page";
import RootLayout, { generateMetadata as rootMetadata } from "./layout";
import HomePage, { generateMetadata as homeMetadata } from "./page";

const framework = vi.hoisted(() => ({
  nonce: "aB9+".repeat(6),
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-kernel-csp-nonce": framework.nonce }),
}));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next/navigation", () => ({
  useRouter: () => framework.router,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const { default: messages } = await import("@/i18n/catalog-data/locales/en");
  return {
    getMessages: async () => messages,
    getTranslations: async () =>
      createTranslator({
        locale: "en",
        messages,
        onError: (error) => {
          throw error;
        },
      }),
  };
});

beforeEach(() => {
  vi.stubEnv("API_BASE_URL", "http://127.0.0.1:3100");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WEBSITE_URL", "https://website.example.test");
  vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ language: { code: "en", direction: "rtl" } }),
    ),
  );
});

afterEach(() => vi.unstubAllEnvs());

async function serverHtml(node: ReactNode) {
  const stream = await renderToReadableStream(node);
  await stream.allReady;
  return new Response(stream).text();
}

function session(children: ReactNode) {
  return (
    <TestIntlProvider>
      <SessionProvider>{children}</SessionProvider>
    </TestIntlProvider>
  );
}

describe("published application composition", () => {
  it("renders the API-selected exact document direction, preload, shared shell and nonce-bearing theme bootstrap", async () => {
    const markup = await serverHtml(
      await RootLayout({ children: <p>Owned route content</p> }),
    );
    expect(markup).toContain('<html lang="en" dir="rtl"');
    expect(markup).toContain('href="/fonts/vazirmatn-latin.woff2"');
    expect(markup).not.toContain('href="/fonts/vazirmatn-arabic.woff2"');
    expect(markup).toContain(`nonce="${framework.nonce}"`);
    expect(markup).toContain('href="#content"');
    expect(markup).toContain(english.siteSkip);
    expect(markup).toContain('<main id="content" tabindex="-1"');
    expect(markup).toContain("Owned route content");
    expect(markup).toContain(english.siteFooter);
    expect(markup).not.toContain(english.authAccountSideText);
    expect(markup).not.toMatch(/opacity:0|display:none|visibility:hidden/);
  });

  it("renders public home content and nonce-bearing JSON-LD using the explicit origin", async () => {
    const markup = await serverHtml(session(await HomePage()));
    expect(markup).toContain(english.homeTitle);
    expect(markup).toContain(english.homeIdentityTitle);
    expect(markup).toContain(english.homeInterfaceTitle);
    expect(markup).toContain(english.homeBoundaryTitle);
    expect(markup).toContain(english.homeCtaTitle);
    expect(markup).toContain('href="/register"');
    expect(markup).toContain('href="/#foundation"');
    expect(markup).toContain(
      `nonce="${framework.nonce}" type="application/ld+json"`,
    );
    expect(markup).toContain('"inLanguage":"en"');
    expect(markup).toContain('"url":"https://website.example.test/"');
    expect(markup).not.toMatch(/opacity:0|display:none|visibility:hidden/);
  });

  it("omits structured data when no public origin is configured", async () => {
    vi.stubEnv("WEBSITE_URL", "");
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "false");
    const markup = await serverHtml(session(await HomePage()));
    expect(markup).toContain(english.homeTitle);
    expect(markup).not.toContain("application/ld+json");
  });

  it("composes the localized auth wrapper and each existing feature without a new session boundary", async () => {
    const pages = [
      {
        node: await LoginPage({ searchParams: Promise.resolve({}) }),
        heading: english.authLoginTitle,
      },
      { node: RegisterPage(), heading: english.authRegisterTitle },
      { node: RecoveryPage(), heading: english.authRecoveryTitle },
    ];
    for (const page of pages) {
      const markup = await serverHtml(
        session(await AuthLayout({ children: page.node })),
      );
      expect(markup).toContain(page.heading);
      expect(markup).toContain(english.authAccountSideTitle);
      expect(markup).toContain("<form");
      expect(markup).toContain('type="submit"');
    }
    const account = await serverHtml(session(await AccountPage()));
    expect(account).toContain(english.accountSessionLoading);
  });

  it.each([
    {
      query: { reset: "success", password: "changed" },
      notice: english.authPasswordReset,
    },
    { query: { password: "changed" }, notice: english.authPasswordChanged },
    { query: { reset: "other", password: "other" }, notice: undefined },
    { query: { reset: ["success"], password: ["changed"] }, notice: undefined },
  ])(
    "shows only validated login return notices for $query",
    async ({ query, notice }) => {
      const markup = await serverHtml(
        session(await LoginPage({ searchParams: Promise.resolve(query) })),
      );
      if (notice) expect(markup).toContain(notice);
      else {
        expect(markup).not.toContain(english.authPasswordReset);
        expect(markup).not.toContain(english.authPasswordChanged);
      }
    },
  );

  it("keeps utility metadata private while the explicit home page can opt into indexing", async () => {
    expect(await rootMetadata()).toMatchObject({
      metadataBase: new URL("https://website.example.test/"),
      robots: { index: false, follow: true },
      title: { default: english.metadataTitle },
    });
    expect(await homeMetadata()).toMatchObject({
      robots: { index: true, follow: true },
      alternates: { canonical: "https://website.example.test/" },
    });
    for (const [load, title] of [
      [loginMetadata, english.login],
      [registerMetadata, english.register],
      [recoveryMetadata, english.forgotPassword],
      [accountMetadata, english.account],
    ] as const) {
      expect(await load()).toEqual({
        title,
        robots: { index: false, follow: false },
      });
    }
  });

  it("renders shared navigation and footer with semantic names and decorative direct icons", async () => {
    const header = await serverHtml(session(await Header()));
    const footer = await serverHtml(session(await Footer()));
    expect(header).toContain(`aria-label="Kernel · ${english.home}"`);
    expect(header).toContain(`aria-label="${english.home}"`);
    expect(header).toContain(english.siteTheme);
    expect(footer).toContain(english.siteFooter);
    expect(footer.replaceAll("<!-- -->", "")).toContain(
      `© ${new Date().getFullYear()} Kernel`,
    );
    for (const icon of (header + footer).matchAll(/<svg[^>]+>/g)) {
      expect(icon[0]).toContain('aria-hidden="true"');
      expect(icon[0]).toContain('stroke="currentColor"');
      expect(icon[0]).toMatch(/width="\d+"/);
    }
  });
});

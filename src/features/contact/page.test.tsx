// @vitest-environment node
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Layout from "@/app/contact/layout";
import Page, { generateMetadata } from "@/app/contact/page";
import en from "@/i18n/catalog-data/locales/en.json";

vi.mock("@/features/contact/ContactForm", () => ({
  ContactForm: () => <form aria-label="contact form" />,
}));
vi.mock("@/shared/settings/server", () => ({
  getWebsiteLanguage: async () => ({
    code: "en",
    direction: "ltr",
    calendar: "gregorian",
  }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: keyof typeof en) => en[key],
  getMessages: async () => en,
}));

describe("public contact route", () => {
  it("renders the scoped form within semantic server content and derives canonical metadata", async () => {
    const stream = await renderToReadableStream(
      await Layout({ children: await Page() }),
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain(en.contactIntro);
    expect(html).toContain("<h1");
    expect(html).toContain("contact form");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WEBSITE_URL", "https://website.example.test");
    vi.stubEnv("WEBSITE_INDEXING_ENABLED", "true");
    expect(await generateMetadata()).toMatchObject({
      alternates: { canonical: "https://website.example.test/contact" },
      robots: { index: true },
    });
    vi.unstubAllEnvs();
  });
});

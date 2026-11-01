import { describe, expect, it } from "vitest";

import { readSeoConfig } from "./config";

describe("explicit website SEO configuration", () => {
  it("defaults to no URL and no indexing without deriving an API or request origin", () => {
    expect(readSeoConfig({})).toEqual({ indexable: false });
    expect(
      readSeoConfig({
        WEBSITE_URL: "",
        WEBSITE_INDEXING_ENABLED: "false",
        API_BASE_URL: "https://private-api.example",
        HOST: "attacker.example",
      }),
    ).toEqual({ indexable: false });
  });

  it("canonicalizes a configured origin and standard port without enabling indexing by default", () => {
    const config = readSeoConfig({
      WEBSITE_URL: "HTTPS://Kernel.Example:443/",
    });
    expect(config.url?.href).toBe("https://kernel.example/");
    expect(config.indexable).toBe(false);
  });

  it("requires a deliberate production flag before enabling indexing", () => {
    expect(
      readSeoConfig({
        WEBSITE_URL: "https://kernel.example",
        WEBSITE_INDEXING_ENABLED: "true",
        NODE_ENV: "production",
      }).indexable,
    ).toBe(true);
    for (const NODE_ENV of [undefined, "development", "test", "staging"])
      expect(
        readSeoConfig({
          WEBSITE_URL: "https://kernel.example",
          WEBSITE_INDEXING_ENABLED: "true",
          NODE_ENV,
        }).indexable,
      ).toBe(false);
    expect(
      readSeoConfig({
        WEBSITE_URL: "https://kernel.example",
        WEBSITE_INDEXING_ENABLED: "false",
        NODE_ENV: "production",
      }).indexable,
    ).toBe(false);
  });

  it("does not classify a public DNS hostname starting with 127 as loopback", () => {
    expect(
      readSeoConfig({
        WEBSITE_URL: "https://127.example.com",
        WEBSITE_INDEXING_ENABLED: "true",
        NODE_ENV: "production",
      }).indexable,
    ).toBe(true);
  });

  it.each(["", "TRUE", "False", "1", "yes", " true "])(
    "rejects a non-boolean indexing value: %j",
    (WEBSITE_INDEXING_ENABLED) => {
      expect(() => readSeoConfig({ WEBSITE_INDEXING_ENABLED })).toThrow(
        "WEBSITE_INDEXING_ENABLED",
      );
    },
  );

  it.each([undefined, ""])(
    "requires the URL when indexing is requested: %j",
    (WEBSITE_URL) => {
      expect(() =>
        readSeoConfig({
          WEBSITE_URL,
          WEBSITE_INDEXING_ENABLED: "true",
          NODE_ENV: "production",
        }),
      ).toThrow("WEBSITE_URL is required");
    },
  );

  it.each([
    "not-a-url",
    "//kernel.example",
    "ftp://kernel.example",
    "https:kernel.example",
    "https://user:password@kernel.example",
    "https://kernel.example/path",
    "https://kernel.example/path/..",
    "https://kernel.example/.",
    "https://kernel.example//",
    "https://kernel.example/?query=value",
    "https://kernel.example/?",
    "https://kernel.example/#part",
    "https://kernel.example/#",
    "https://kernel.example\\",
    " https://kernel.example",
    "https://kernel.example\n",
    "https://ker\tnel.example",
    "https://kernel.example\uFEFF",
    "https://kernel.example\u00a0",
  ])("rejects a non-origin URL without indexing too: %j", (WEBSITE_URL) => {
    expect(() => readSeoConfig({ WEBSITE_URL })).toThrow("WEBSITE_URL");
    expect(() =>
      readSeoConfig({
        WEBSITE_URL,
        WEBSITE_INDEXING_ENABLED: "true",
        NODE_ENV: "production",
      }),
    ).toThrow("WEBSITE_URL");
  });

  it.each([
    "localhost",
    "preview.localhost",
    "localhost.",
    "127.0.0.1",
    "127.1",
    "127.255.255.255",
    "[::1]",
    "[::ffff:127.0.0.1]",
  ])(
    "permits an HTTP loopback preview only while indexing is disabled: %s",
    (host) => {
      const config = readSeoConfig({
        WEBSITE_URL: `http://${host}:3001/`,
        NODE_ENV: "production",
      });
      expect(config.indexable).toBe(false);
      expect(config.url?.protocol).toBe("http:");
      expect(() =>
        readSeoConfig({
          WEBSITE_URL: `http://${host}:3001`,
          WEBSITE_INDEXING_ENABLED: "true",
          NODE_ENV: "production",
        }),
      ).toThrow("HTTPS");
      expect(() =>
        readSeoConfig({
          WEBSITE_URL: `https://${host}`,
          WEBSITE_INDEXING_ENABLED: "true",
          NODE_ENV: "production",
        }),
      ).toThrow("non-loopback");
    },
  );

  it("rejects cleartext public origins even without indexing", () => {
    expect(() =>
      readSeoConfig({ WEBSITE_URL: "http://kernel.example" }),
    ).toThrow("HTTPS");
  });

  it("does not repeat a configured credential or invalid flag in its errors", () => {
    let urlError: unknown;
    try {
      readSeoConfig({
        WEBSITE_URL: "https://private-user:private-password@internal.example",
      });
    } catch (error) {
      urlError = error;
    }
    expect(urlError).toBeInstanceOf(Error);
    expect(String(urlError)).not.toMatch(
      /private-user|private-password|internal\.example/,
    );
    let flagError: unknown;
    try {
      readSeoConfig({ WEBSITE_INDEXING_ENABLED: "sensitive-invalid-value" });
    } catch (error) {
      flagError = error;
    }
    expect(flagError).toBeInstanceOf(Error);
    expect(String(flagError)).not.toContain("sensitive-invalid-value");
  });
});

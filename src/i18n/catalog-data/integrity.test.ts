import { readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { catalogs } from "../catalogs";
import { localeCodes } from "./locales";
import type { WebsiteTranslationResource } from "./website-types";

const placeholders = (message: string) =>
  [...message.matchAll(/\{(\w+)[,}]/g)].map((match) => match[1]).sort();
const entries = async () =>
  Promise.all(
    localeCodes.map(async (code) => ({
      code,
      messages: (await catalogs[code]()).default,
    })),
  );

describe("complete local website catalogs", () => {
  it("registers ten unique canonical codes and one loader per code", () => {
    expect(localeCodes).toHaveLength(10);
    expect(new Set(localeCodes).size).toBe(localeCodes.length);
    expect(localeCodes.every((code) => /^[a-z]{2}$/.test(code))).toBe(true);
    expect(Object.keys(catalogs).sort()).toEqual([...localeCodes].sort());
  });

  it("keeps exactly one code-named catalog file for each registered language", async () => {
    const files = await readdir(new URL("./locales/", import.meta.url), {
      withFileTypes: true,
    });
    expect(files.every((file) => file.isFile())).toBe(true);
    expect(files.map((file) => file.name).sort()).toEqual(
      localeCodes.map((code) => `${code}.ts`).sort(),
    );
  });

  it("loads all 107 canonical keys as flat nonempty strings in every language", async () => {
    const english = (await catalogs.en()).default;
    const keys = Object.keys(english).sort();
    expect(keys).toHaveLength(107);
    for (const { code, messages } of await entries()) {
      expect(Object.keys(messages).sort(), code).toEqual(keys);
      for (const [key, value] of Object.entries(messages)) {
        expect(key, `${code}:${key}`).not.toContain(".");
        expect(typeof value, `${code}:${key}`).toBe("string");
        expect(value.trim(), `${code}:${key}`).not.toBe("");
      }
      for (const namespace of [
        "common",
        "GlobalError",
        "Metadata",
        "Site",
        "Home",
        "Auth",
        "Account",
        "Feedback",
      ])
        expect(messages, `${code}:${namespace}`).not.toHaveProperty(namespace);
    }
  });

  it("preserves interpolation names and intentional newlines across all catalogs", async () => {
    const english = (await catalogs.en()).default;
    expect(placeholders(english.accountTitle)).toEqual(["name"]);
    expect(placeholders(english.accountVerifiedEmail)).toEqual(["email"]);
    expect(placeholders(english.feedbackResendIn)).toEqual(["seconds"]);
    for (const { code, messages } of await entries())
      for (const [key, value] of Object.entries(messages)) {
        const source = english[key as keyof WebsiteTranslationResource];
        expect(placeholders(value), `${code}:${key}`).toEqual(
          placeholders(source),
        );
        expect(value.split("\n").length, `${code}:${key}`).toBe(
          source.split("\n").length,
        );
      }
  });

  it("provides genuine non-English strings rather than an English fallback spread", async () => {
    const english = (await catalogs.en()).default;
    for (const { code, messages } of await entries()) {
      if (code === "en") continue;
      const values = Object.entries(messages);
      const translated = values.filter(
        ([key, value]) =>
          value !== english[key as keyof WebsiteTranslationResource],
      );
      expect(translated.length / values.length, code).toBeGreaterThan(0.9);
    }
  });

  it("keeps shared meanings and distinct account labels in canonical root keys", async () => {
    for (const { code, messages } of await entries()) {
      for (const key of [
        "accountEmail",
        "accountEmailLabel",
        "login",
        "mobile",
        "password",
        "firstName",
        "otp",
      ] as const)
        expect(typeof messages[key], `${code}:${key}`).toBe("string");
      expect(messages, code).not.toHaveProperty("authMobile");
      expect(messages, code).not.toHaveProperty("accountPassword");
    }
  });

  it("reuses the same local catalog object across repeated loader calls", async () => {
    for (const code of localeCodes) {
      const first = await catalogs[code]();
      const second = await catalogs[code]();
      expect(second.default, code).toBe(first.default);
    }
  });
});

import { readdir, readFile } from "node:fs/promises";

import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import { catalogs } from "../catalogs";
import { type LocaleCode, localeCodes } from "./locales";
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

const assertLiteralCatalog = (content: string) => {
  JSON.parse(content);
  const source = ts.parseJsonText("catalog.json", content);
  const statement = source.statements[0];
  if (
    !statement ||
    !ts.isExpressionStatement(statement) ||
    !ts.isObjectLiteralExpression(statement.expression)
  )
    throw new Error("Catalog messages must be a literal flat JSON object");
  const keys = new Set<string>();
  for (const property of statement.expression.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      !ts.isStringLiteral(property.name) ||
      !ts.isStringLiteral(property.initializer)
    )
      throw new Error("Catalogs may contain only literal string properties");
    if (keys.has(property.name.text))
      throw new Error("Catalog keys must not be repeated");
    keys.add(property.name.text);
  }
};

describe("complete local website catalogs", () => {
  it("keeps every catalog as strict flat JSON data with unique keys", async () => {
    for (const code of localeCodes) {
      const content = await readFile(
        new URL(`./locales/${code}.json`, import.meta.url),
        "utf8",
      );
      expect(() => assertLiteralCatalog(content), code).not.toThrow();
    }
  });

  it("rejects executable code, malformed JSON, duplicate keys and non-string values", () => {
    const invalid = [
      '{ "password": "first", "password": "second" }',
      '{ "password": "first", "pass\\u0077ord": "second" }',
      '{ "nested": { "label": "value" } }',
      '{ "password": ["value"] }',
      '{ "password": null }',
      '{ "password": true }',
      '{ "password": 123 }',
      "[]",
      "null",
      '"label"',
      '{ password: "label" }',
      '{ "password": "label", }',
      '{ "password": "label" /* comment */ }',
      "{ ...english }",
      '{ [name]: "label" }',
      '{ "password": translate("label") }',
      '{ get password() { return "label"; } }',
      'const messages = { password: "label" }; export default messages;',
      '{ "password": "label" }; runBusinessLogic();',
    ];
    for (const content of invalid)
      expect(() => assertLiteralCatalog(content), content).toThrow();
  });

  it("preserves the exact English-derived string shape in every loaded catalog type", () => {
    type CatalogShapes = {
      [Code in LocaleCode]: Awaited<
        ReturnType<(typeof catalogs)[Code]>
      >["default"];
    };
    expectTypeOf<CatalogShapes>().toEqualTypeOf<
      Record<LocaleCode, WebsiteTranslationResource>
    >();
  });

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
      localeCodes.map((code) => `${code}.json`).sort(),
    );
  });

  it("loads all 108 canonical keys as flat nonempty strings in every language", async () => {
    const english = (await catalogs.en()).default;
    const keys = Object.keys(english).sort();
    expect(keys).toHaveLength(108);
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

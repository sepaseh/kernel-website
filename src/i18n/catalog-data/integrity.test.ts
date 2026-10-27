import { readdir, readFile } from "node:fs/promises";

import ts from "typescript";
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

const isErasedLocalImport = (statement: ts.Statement) =>
  ts.isImportDeclaration(statement) &&
  statement.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword &&
  ts.isStringLiteral(statement.moduleSpecifier) &&
  statement.moduleSpecifier.text.startsWith(".");
const isCatalogExport = (statement: ts.Statement) =>
  ts.isExportAssignment(statement) &&
  !statement.isExportEquals &&
  ts.isIdentifier(statement.expression) &&
  statement.expression.text === "messages";

const assertLiteralMessages = (statement: ts.VariableStatement) => {
  const definitions = statement.declarationList;
  if (
    definitions.flags !== ts.NodeFlags.Const ||
    definitions.declarations.length !== 1 ||
    statement.modifiers?.length
  )
    throw new Error("Catalogs must declare one plain const message object");
  const declaration = definitions.declarations[0];
  if (
    !ts.isIdentifier(declaration.name) ||
    declaration.name.text !== "messages"
  )
    throw new Error("Catalogs must name their single data object messages");
  const initializer = declaration.initializer;
  const value =
    initializer && ts.isSatisfiesExpression(initializer)
      ? initializer.expression
      : initializer;
  if (!value || !ts.isObjectLiteralExpression(value))
    throw new Error("Catalog messages must be a literal flat object");
  for (const property of value.properties) {
    if (
      !ts.isPropertyAssignment(property) ||
      (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) ||
      (!ts.isStringLiteral(property.initializer) &&
        !ts.isNoSubstitutionTemplateLiteral(property.initializer))
    )
      throw new Error("Catalogs may contain only literal string properties");
  }
};

const assertLiteralCatalog = (content: string) => {
  const source = ts.createSourceFile(
    "catalog.ts",
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  let declarations = 0;
  let exports = 0;
  for (const statement of source.statements) {
    if (isErasedLocalImport(statement)) continue;
    if (ts.isVariableStatement(statement)) {
      assertLiteralMessages(statement);
      declarations++;
      continue;
    }
    if (isCatalogExport(statement)) {
      exports++;
      continue;
    }
    throw new Error(
      "Catalog files must not contain executable statements or imports",
    );
  }
  if (declarations !== 1 || exports !== 1)
    throw new Error(
      "Catalogs must declare and default-export one message object",
    );
};

describe("complete local website catalogs", () => {
  it("keeps every catalog as literal flat data with erased local type imports only", async () => {
    for (const code of localeCodes) {
      const content = await readFile(
        new URL(`./locales/${code}.ts`, import.meta.url),
        "utf8",
      );
      expect(() => assertLiteralCatalog(content), code).not.toThrow();
    }
  });

  it("rejects executable code, fallback spreads, computed keys and computed values in data files", () => {
    const declarations = [
      "const messages = { ...english };",
      'const messages = { [name]: "label" };',
      'const messages = { password: translate("label") };',
      "const messages = { password: `label ${value}` };",
      'const messages = { nested: { label: "value" } };',
      'const messages = { get password() { return "label"; } };',
      "const messages = { password };",
      "const messages = buildCatalog();",
      'const messages = { password: "label" }; runBusinessLogic();',
      'import english from "./en.ts"; const messages = { password: "label" };',
      'import type { Shape } from "foreign-package"; const messages = { password: "label" };',
      'const messages = { password: "label" }; function businessLogic() {}',
      'let messages = { password: "label" };',
      'using messages = { password: "label" };',
      'await using messages = { password: "label" };',
      'const messages = { password: "label" }, hidden = runBusinessLogic();',
      'export const messages = { password: "label" };',
    ];
    for (const declaration of declarations)
      expect(() =>
        assertLiteralCatalog(`${declaration}\nexport default messages;`),
      ).toThrow();
    expect(() =>
      assertLiteralCatalog('export default { password: "label" };'),
    ).toThrow();
    expect(() =>
      assertLiteralCatalog('const messages = { password: "label" };'),
    ).toThrow();
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

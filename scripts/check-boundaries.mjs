import assert from "node:assert/strict";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import {
  completePublicationWork,
  publicationFiles,
  readPublishedFile,
} from "./validate-bootstrap.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const packageOwners = {
  "eslint.config.mjs": new Set([
    "@eslint/js",
    "eslint-plugin-simple-import-sort",
    "globals",
  ]),
  "vitest.config.mjs": new Set(["vitest"]),
  "scripts/check-boundaries.mjs": new Set(["typescript"]),
  "scripts/check-ci.mjs": new Set(["yaml"]),
  "scripts/check-guidance.mjs": new Set(["prettier", "yaml"]),
};

export function validateStandalonePackage(pkg, lock) {
  assert.equal(pkg.name, "kernel-website");
  assert.equal(pkg.type, "module");
  assert.equal(
    Object.hasOwn(pkg, "workspaces"),
    false,
    "One standalone package is required.",
  );
  assert.equal(lock.name, pkg.name, "Lockfile root identity must match.");
  assert.equal(
    lock.packages?.[""]?.name,
    pkg.name,
    "Lockfile package identity must match.",
  );
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    assert.deepEqual(
      lock.packages[""][field],
      pkg[field],
      "Root dependency metadata must match the lockfile.",
    );
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      assert.equal(
        name.startsWith("@kernel/"),
        false,
        "Backend package imports are forbidden.",
      );
      assert.equal(
        /^(?:workspace:|file:|link:)/.test(version),
        false,
        "Local package links are forbidden.",
      );
    }
  }
  for (const [name, entry] of Object.entries(lock.packages)) {
    assert.equal(
      entry.link,
      undefined,
      "Linked dependency in lockfile: " + name,
    );
    assert.ok(
      !name || name.startsWith("node_modules/"),
      "Only installed dependency locations are allowed.",
    );
  }
}

function validateCreateRequireBindings(ast) {
  const checker = ts
    .createProgram({
      rootNames: [ast.fileName],
      options: {
        allowJs: true,
        noEmit: true,
        noLib: true,
        noResolve: true,
        types: [],
      },
      host: {
        fileExists: (filename) => filename === ast.fileName,
        getCanonicalFileName: (filename) => filename,
        getCurrentDirectory: () => "",
        getDefaultLibFileName: () => "",
        getNewLine: () => "\n",
        getSourceFile: (filename) =>
          filename === ast.fileName ? ast : undefined,
        readFile: () => undefined,
        useCaseSensitiveFileNames: () => true,
        writeFile: () =>
          assert.fail("Import validation must never emit files."),
      },
    })
    .getTypeChecker();
  const moduleMembers = new Set(["Module", "default"]);
  const propertyKey = (node) => {
    if (!node) return undefined;
    if (ts.isComputedPropertyName(node))
      return ts.isStringLiteralLike(node.expression)
        ? node.expression.text
        : undefined;
    return node.text;
  };
  const memberKey = (node) => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression)
    )
      return node.argumentExpression.text;
    return undefined;
  };
  const assignments = new Map();
  const recordAssignment = (name, value) => {
    if (!ts.isIdentifier(name)) return;
    const symbol = checker.getSymbolAtLocation(name);
    if (!symbol) return;
    const values = assignments.get(symbol) ?? [];
    values.push(value);
    assignments.set(symbol, values);
  };
  const collectAssignments = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      recordAssignment(node.left, node.right);
      if (ts.isObjectLiteralExpression(node.left))
        for (const entry of node.left.properties)
          if (moduleMembers.has(propertyKey(entry.name)))
            recordAssignment(
              ts.isPropertyAssignment(entry) ? entry.initializer : entry.name,
              node.right,
            );
    }
    ts.forEachChild(node, collectAssignments);
  };
  collectAssignments(ast);

  const moduleSpecifier = (node) =>
    ts.isStringLiteralLike(node) &&
    ["module", "node:module"].includes(node.text);
  const globalIdentifier = (node, name) =>
    ts.isIdentifier(node) &&
    node.text === name &&
    !checker.getSymbolAtLocation(node)?.declarations?.length;
  const moduleCall = (node) =>
    node.expression.kind === ts.SyntaxKind.ImportKeyword ||
    globalIdentifier(node.expression, "require") ||
    (memberKey(node.expression) === "getBuiltinModule" &&
      globalIdentifier(node.expression.expression, "process"));
  const moduleValue = (node, seen = new Set()) => {
    if (!node) return false;
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))
      return moduleValue(node.expression, seen);
    if (ts.isCallExpression(node))
      return (
        moduleCall(node) &&
        node.arguments.length === 1 &&
        moduleSpecifier(node.arguments[0])
      );
    if (moduleMembers.has(memberKey(node)))
      return moduleValue(node.expression, seen);
    if (!ts.isIdentifier(node)) return false;

    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return false;
    seen.add(symbol);
    if (
      (assignments.get(symbol) ?? []).some((value) => moduleValue(value, seen))
    )
      return true;
    return (symbol.declarations ?? []).some((declaration) => {
      if (ts.isVariableDeclaration(declaration))
        return moduleValue(declaration.initializer, seen);
      if (
        ts.isBindingElement(declaration) &&
        ts.isObjectBindingPattern(declaration.parent) &&
        ts.isVariableDeclaration(declaration.parent.parent)
      )
        return (
          moduleMembers.has(
            propertyKey(declaration.propertyName ?? declaration.name),
          ) && moduleValue(declaration.parent.parent.initializer, seen)
        );
      if (ts.isImportClause(declaration))
        return moduleSpecifier(declaration.parent.moduleSpecifier);
      if (ts.isNamespaceImport(declaration))
        return moduleSpecifier(declaration.parent.parent.moduleSpecifier);
      if (ts.isImportSpecifier(declaration))
        return (
          moduleMembers.has(
            (declaration.propertyName ?? declaration.name).text,
          ) && moduleSpecifier(declaration.parent.parent.parent.moduleSpecifier)
        );
      return false;
    });
  };
  const forbiddenKey = (node) => propertyKey(node) === "createRequire";
  const exportedBinding = (name) =>
    ts.isIdentifier(name)
      ? moduleValue(name)
      : name.elements.some(
          (entry) => ts.isBindingElement(entry) && exportedBinding(entry.name),
        );
  const moduleExport = (node) => {
    if (node.moduleSpecifier) {
      if (!moduleSpecifier(node.moduleSpecifier)) return false;
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause))
        return true;
      return node.exportClause.elements.some((entry) => {
        const key = propertyKey(entry.propertyName ?? entry.name);
        return key === "createRequire" || moduleMembers.has(key);
      });
    }
    if (!node.exportClause || !ts.isNamedExports(node.exportClause))
      return false;
    return node.exportClause.elements.some((entry) => {
      const symbol = checker.getExportSpecifierLocalTargetSymbol(entry);
      return (symbol?.declarations ?? []).some(
        (declaration) => declaration.name && exportedBinding(declaration.name),
      );
    });
  };
  const visit = (node) => {
    let forbidden = false;
    if (
      ts.isImportSpecifier(node) &&
      moduleSpecifier(node.parent.parent.parent.moduleSpecifier)
    )
      forbidden = forbiddenKey(node.propertyName ?? node.name);
    if (memberKey(node) === "createRequire")
      forbidden = moduleValue(node.expression);
    if (ts.isExportDeclaration(node)) forbidden = moduleExport(node);
    if (ts.isExportAssignment(node)) forbidden = moduleValue(node.expression);
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      forbidden = node.declarationList.declarations.some((declaration) =>
        exportedBinding(declaration.name),
      );
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name))
      forbidden =
        node.name.elements.some((entry) =>
          forbiddenKey(entry.propertyName ?? entry.name),
        ) && moduleValue(node.initializer);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left)
    )
      forbidden =
        node.left.properties.some((entry) => forbiddenKey(entry.name)) &&
        moduleValue(node.right);
    assert.equal(
      Boolean(forbidden),
      false,
      "createRequire bypasses reviewed literal import ownership.",
    );
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

export function validateModuleImports(
  filename,
  source,
  pkg,
  files = publicationFiles,
) {
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  assert.equal(ast.parseDiagnostics.length, 0, "Invalid authored JavaScript.");
  validateCreateRequireBindings(ast);
  const inspect = (specifier) => {
    assert.ok(
      typeof specifier === "string" && specifier,
      "Imports must use explicit literal specifiers.",
    );
    if (specifier.startsWith("node:")) {
      assert.ok(isBuiltin(specifier), "Unknown Node builtin.");
      return;
    }
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(filename), specifier),
      );
      assert.ok(
        files.includes(resolved),
        "Import leaves the reviewed publication: " + specifier,
      );
      return;
    }
    assert.equal(
      /^(?:[A-Za-z]+:|[/\\])/.test(specifier),
      false,
      "Absolute and remote imports are forbidden.",
    );
    const owner = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    const declared = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(
      Object.hasOwn(declared, owner),
      "Undeclared dependency: " + owner,
    );
    assert.ok(
      filename.endsWith(".test.mjs") || packageOwners[filename]?.has(owner),
      "Package import is not permitted for this owner: " + owner,
    );
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    )
      inspect(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      assert.equal(
        node.arguments.length,
        1,
        "Imports need one literal argument.",
      );
      assert.ok(
        ts.isStringLiteralLike(node.arguments[0]),
        "Computed imports are forbidden.",
      );
      inspect(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}

export async function inspectBoundaries(root = repository) {
  const pkg = JSON.parse(await readPublishedFile(root, "package.json"));
  const lock = JSON.parse(await readPublishedFile(root, "package-lock.json"));
  validateStandalonePackage(pkg, lock);
  await completePublicationWork(
    publicationFiles
      .filter((file) => file.endsWith(".mjs"))
      .map(async (filename) =>
        validateModuleImports(
          filename,
          await readPublishedFile(root, filename),
          pkg,
        ),
      ),
  );
}

if (import.meta.main) {
  await inspectBoundaries();
  console.log(
    "Standalone governance package and exact import ownership passed.",
  );
}

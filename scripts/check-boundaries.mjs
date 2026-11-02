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
  const restBinding = Symbol("object-rest binding");
  const assignments = new Map();
  const bindingSymbol = (node) =>
    ts.isShorthandPropertyAssignment(node.parent)
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
  const recordAssignment = (name, value, keys) => {
    if (!ts.isIdentifier(name)) return;
    const symbol = bindingSymbol(name);
    if (!symbol) return;
    const values = assignments.get(symbol) ?? [];
    values.push({ value, keys });
    assignments.set(symbol, values);
  };
  const assignmentEntries = (target) => {
    if (!ts.isObjectLiteralExpression(target)) return [];

    return target.properties.map((entry) => {
      if (ts.isSpreadAssignment(entry))
        return { key: restBinding, target: entry.expression };

      return {
        key: propertyKey(entry.name),
        target: ts.isPropertyAssignment(entry) ? entry.initializer : entry.name,
      };
    });
  };
  const recordAssignmentTargets = (target, value, keys = []) => {
    if (
      ts.isBinaryExpression(target) &&
      target.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      recordAssignmentTargets(target.left, value, keys);
      return;
    }
    if (ts.isIdentifier(target)) {
      recordAssignment(target, value, keys);
      return;
    }
    for (const { key, target: binding } of assignmentEntries(target)) {
      if (key === undefined) continue;

      recordAssignmentTargets(binding, value, [...keys, key]);
    }
  };
  const collectAssignments = (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      recordAssignmentTargets(node.left, node.right);
    ts.forEachChild(node, collectAssignments);
  };
  collectAssignments(ast);

  const builtinSpecifier = (node, builtin) =>
    ts.isStringLiteralLike(node) &&
    [builtin, "node:" + builtin].includes(node.text);
  const moduleSpecifier = (node) => builtinSpecifier(node, "module");
  const globalIdentifier = (node, name) =>
    ts.isIdentifier(node) &&
    node.text === name &&
    !checker.getSymbolAtLocation(node)?.declarations?.length;
  const memberSourceOrigin = (key, origin) => {
    if (origin === "module")
      return key === restBinding || moduleMembers.has(key)
        ? "module"
        : undefined;
    if (origin === "process") {
      if (key === "process") return "global";

      return key === "default" ? "process" : undefined;
    }
    return key === "getBuiltinModule" && origin === "loader"
      ? "process"
      : undefined;
  };
  const selectedOrigin = (value, keys, origin, seen) => {
    let sourceOrigin = origin;
    for (const key of keys.toReversed()) {
      sourceOrigin = memberSourceOrigin(key, sourceOrigin);
      if (!sourceOrigin) return false;
    }
    return hasOrigin(value, sourceOrigin, seen);
  };
  const importedOrigin = (declaration, origin) => {
    if (ts.isImportClause(declaration))
      return builtinSpecifier(declaration.parent.moduleSpecifier, origin);
    if (ts.isNamespaceImport(declaration))
      return builtinSpecifier(
        declaration.parent.parent.moduleSpecifier,
        origin,
      );
    if (!ts.isImportSpecifier(declaration)) return false;

    const key = (declaration.propertyName ?? declaration.name).text;
    const specifier = declaration.parent.parent.parent.moduleSpecifier;
    if (origin === "loader")
      return (
        key === "getBuiltinModule" && builtinSpecifier(specifier, "process")
      );
    const member =
      origin === "module" ? moduleMembers.has(key) : key === "default";
    return member && builtinSpecifier(specifier, origin);
  };
  const declarationSource = (declaration) => {
    if (ts.isVariableDeclaration(declaration))
      return { value: declaration.initializer, keys: [] };
    if (
      !ts.isBindingElement(declaration) ||
      !ts.isObjectBindingPattern(declaration.parent)
    )
      return undefined;

    const parent = declarationSource(declaration.parent.parent);
    if (!parent) return undefined;

    const key = declaration.dotDotDotToken
      ? restBinding
      : propertyKey(declaration.propertyName ?? declaration.name);
    return { value: parent.value, keys: [...parent.keys, key] };
  };
  const declarationOrigin = (declaration, origin, seen) => {
    const source = declarationSource(declaration);
    if (source) return selectedOrigin(source.value, source.keys, origin, seen);
    return importedOrigin(declaration, origin);
  };
  const identifierOrigin = (node, origin, seen) => {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return false;

    const next = new Set(seen).add(symbol);
    const assigned = (assignments.get(symbol) ?? []).some(({ value, keys }) =>
      selectedOrigin(value, keys, origin, next),
    );
    return (
      assigned ||
      (symbol.declarations ?? []).some((declaration) =>
        declarationOrigin(declaration, origin, next),
      )
    );
  };
  const callOrigin = (node, origin, seen) => {
    if (origin === "loader" || node.arguments.length !== 1) return false;
    if (!builtinSpecifier(node.arguments[0], origin)) return false;

    return (
      node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      hasOrigin(node.expression, "loader", seen)
    );
  };
  const hasOrigin = (node, origin, seen = new Set()) => {
    if (!node) return false;
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))
      return hasOrigin(node.expression, origin, seen);
    if (ts.isCallExpression(node)) return callOrigin(node, origin, seen);
    if (ts.isIdentifier(node)) {
      if (origin === "global" && globalIdentifier(node, "globalThis"))
        return true;
      if (origin === "process" && globalIdentifier(node, "process"))
        return true;
      if (origin === "loader" && globalIdentifier(node, "require")) return true;
      return identifierOrigin(node, origin, seen);
    }
    return selectedOrigin(node.expression, [memberKey(node)], origin, seen);
  };
  const moduleValue = (node) => hasOrigin(node, "module");
  const boundContainer = (node, seen) => {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return false;

    const next = new Set(seen).add(symbol);
    const declared = (symbol.declarations ?? [])
      .map(declarationSource)
      .filter(Boolean);
    return [...(assignments.get(symbol) ?? []), ...declared].some(
      ({ value, keys }) =>
        keys.length === 0 && containsModuleValue(value, next),
    );
  };
  const containsModuleValue = (node, seen = new Set()) => {
    if (!node) return false;
    if (moduleValue(node)) return true;
    if (ts.isParenthesizedExpression(node))
      return containsModuleValue(node.expression, seen);
    if (ts.isIdentifier(node)) return boundContainer(node, seen);
    if (ts.isSpreadElement(node))
      return containsModuleValue(node.expression, seen);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.some((entry) => containsModuleValue(entry, seen));
    if (!ts.isObjectLiteralExpression(node)) return false;

    return node.properties.some((entry) => {
      if (ts.isPropertyAssignment(entry))
        return containsModuleValue(entry.initializer, seen);
      if (ts.isSpreadAssignment(entry))
        return containsModuleValue(entry.expression, seen);
      if (ts.isShorthandPropertyAssignment(entry))
        return containsModuleValue(entry.name, seen);
      return false;
    });
  };
  const forbiddenKey = (node) => propertyKey(node) === "createRequire";
  const declarationEntries = (pattern) => {
    if (!ts.isObjectBindingPattern(pattern)) return [];

    return pattern.elements.map((entry) => ({
      key: entry.dotDotDotToken
        ? restBinding
        : propertyKey(entry.propertyName ?? entry.name),
      target: entry.name,
    }));
  };
  const forbiddenPattern = (pattern, value, keys = []) => {
    if (
      ts.isBinaryExpression(pattern) &&
      pattern.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      return forbiddenPattern(pattern.left, value, keys);

    const entries = ts.isObjectBindingPattern(pattern)
      ? declarationEntries(pattern)
      : assignmentEntries(pattern);
    return entries.some(({ key, target }) => {
      if (
        (key === undefined || key === "createRequire") &&
        selectedOrigin(value, keys, "module")
      )
        return true;
      return forbiddenPattern(target, value, [...keys, key]);
    });
  };
  const exportedBinding = (name) =>
    ts.isIdentifier(name)
      ? containsModuleValue(name)
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
    if (
      ts.isElementAccessExpression(node) &&
      !ts.isStringLiteralLike(node.argumentExpression)
    )
      forbidden = moduleValue(node.expression);
    if (ts.isExportDeclaration(node)) forbidden = moduleExport(node);
    if (ts.isExportAssignment(node))
      forbidden = containsModuleValue(node.expression);
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
      forbidden = forbiddenPattern(node.name, node.initializer);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left)
    )
      forbidden = forbiddenPattern(node.left, node.right);
    assert.equal(
      Boolean(forbidden),
      false,
      "createRequire bypasses reviewed literal import ownership.",
    );
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return (callee) => hasOrigin(callee, "loader");
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
  // Import-free .mjs files still have module scope; retain explicit export bindings.
  if (!ts.isExternalModule(ast)) ast.externalModuleIndicator = true;
  const isLoader = validateCreateRequireBindings(ast);
  const inspect = (specifier) => {
    assert.ok(
      typeof specifier === "string" && specifier,
      "Imports must use explicit literal specifiers.",
    );
    if (isBuiltin(specifier)) return;
    assert.equal(specifier.startsWith("node:"), false, "Unknown Node builtin.");
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
        isLoader(node.expression))
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

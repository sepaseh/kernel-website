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
  const stringKey = (node, seen = new Set()) => {
    if (!node) return undefined;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isParenthesizedExpression(node))
      return stringKey(node.expression, seen);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      const left = stringKey(node.left, seen);
      const right = stringKey(node.right, seen);
      return left !== undefined && right !== undefined
        ? left + right
        : undefined;
    }
    if (!ts.isIdentifier(node)) return undefined;

    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return undefined;

    const declaration = symbol.valueDeclaration;
    if (
      !declaration ||
      !ts.isVariableDeclaration(declaration) ||
      !(declaration.parent.flags & ts.NodeFlags.Const)
    )
      return undefined;
    return stringKey(declaration.initializer, new Set(seen).add(symbol));
  };
  const propertyKey = (node) => {
    if (!node) return undefined;
    if (ts.isComputedPropertyName(node)) return stringKey(node.expression);
    return node.text;
  };
  const memberKey = (node) => {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node))
      return ts.isNumericLiteral(node.argumentExpression)
        ? node.argumentExpression.text
        : stringKey(node.argumentExpression);
    return undefined;
  };
  const objectRest = (key) =>
    key !== null && typeof key === "object" && "excluded" in key;
  const writeOperators = new Set([
    ts.SyntaxKind.EqualsToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ]);
  const valueAlternatives = new Set([
    ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken,
  ]);
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
    if (ts.isArrayLiteralExpression(target))
      return target.elements.map((entry, index) => ({
        key: ts.isSpreadElement(entry) ? { rest: index } : String(index),
        target: ts.isSpreadElement(entry) ? entry.expression : entry,
      }));
    if (!ts.isObjectLiteralExpression(target)) return [];

    return target.properties.map((entry) => {
      if (ts.isSpreadAssignment(entry))
        return {
          key: {
            excluded: target.properties
              .filter((property) => !ts.isSpreadAssignment(property))
              .map((property) => propertyKey(property.name)),
          },
          target: entry.expression,
        };

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
      recordAssignmentTargets(target.left, target.right);
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
      writeOperators.has(node.operatorToken.kind)
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
    if (origin === "global") return key === "globalThis" ? "global" : undefined;
    if (origin === "module")
      return objectRest(key) || moduleMembers.has(key) ? "module" : undefined;
    if (origin === "process") {
      if (key === "process") return "global";

      return key === "default" ? "process" : undefined;
    }
    return key === "getBuiltinModule" && origin === "loader"
      ? "process"
      : undefined;
  };
  const builtinSelection = (value, keys, origin, seen) => {
    let sourceOrigin = origin;
    for (const key of keys.toReversed()) {
      sourceOrigin = memberSourceOrigin(key, sourceOrigin);
      if (!sourceOrigin) return false;
    }
    return hasOrigin(value, sourceOrigin, seen);
  };
  const boundSelection = (node, keys, seen, accept) => {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return false;

    const next = new Set(seen).add(symbol);
    const declared = (symbol.declarations ?? []).flatMap(declarationSources);
    return [...(assignments.get(symbol) ?? []), ...declared].some((source) =>
      selectValue(source.value, [...source.keys, ...keys], next, accept),
    );
  };
  const expandedLiteral = (node, seen) => {
    const array = ts.isArrayLiteralExpression(node);
    let alternatives = [[]];
    for (const entry of array ? node.elements : node.properties) {
      let choices = [[entry]];
      if (ts.isSpreadElement(entry) || ts.isSpreadAssignment(entry)) {
        const nested = literalContainers(entry.expression, seen).filter(
          ({ value }) => ts.isArrayLiteralExpression(value) === array,
        );
        if (nested.length)
          choices = nested.map(({ value }) =>
            array ? value.elements : value.properties,
          );
      }
      alternatives = alternatives.flatMap((previous) =>
        choices.map((choice) => [...previous, ...choice]),
      );
    }
    return alternatives.map((entries) => ({
      value: array
        ? ts.factory.createArrayLiteralExpression(entries)
        : ts.factory.createObjectLiteralExpression(entries),
      visited: seen,
    }));
  };
  const literalContainers = (node, seen) => {
    const values = [];
    selectValue(node, [], seen, (value, visited, keys) => {
      if (
        keys.length === 0 &&
        (ts.isObjectLiteralExpression(value) ||
          ts.isArrayLiteralExpression(value))
      )
        values.push(...expandedLiteral(value, visited));
      return false;
    });
    return values;
  };
  const objectSelection = (node, key, remaining, seen, accept) => {
    if (objectRest(key)) {
      const candidates = literalContainers(node, seen);
      return candidates.some(({ value, visited }) => {
        const properties = value.properties.filter((entry) => {
          const name = propertyKey(entry.name);
          return name === undefined || !key.excluded.includes(name);
        });
        const rest = ts.factory.createObjectLiteralExpression(properties);
        return selectValue(rest, remaining, visited, accept);
      });
    }

    return node.properties.some((entry) => {
      if (ts.isSpreadAssignment(entry))
        return selectValue(entry.expression, [key, ...remaining], seen, accept);
      const name = propertyKey(entry.name);
      if (key !== undefined && name !== undefined && name !== key) return false;

      if (ts.isPropertyAssignment(entry))
        return selectValue(entry.initializer, remaining, seen, accept);
      if (ts.isShorthandPropertyAssignment(entry))
        return selectValue(entry.name, remaining, seen, accept);
      return false;
    });
  };
  const arraySelection = (node, key, remaining, seen, accept) => {
    return literalContainers(node, seen).some(({ value, visited }) =>
      selectedArray(value, key, remaining, visited, accept),
    );
  };
  const selectedArray = (node, key, remaining, seen, accept) => {
    if (objectRest(key)) {
      const properties = node.elements.map((entry, index) =>
        ts.factory.createPropertyAssignment(String(index), entry),
      );
      return objectSelection(
        ts.factory.createObjectLiteralExpression(properties),
        key,
        remaining,
        seen,
        accept,
      );
    }
    if (typeof key === "object" && key !== null && "rest" in key) {
      const rest = ts.factory.createArrayLiteralExpression(
        node.elements.slice(key.rest),
      );
      return selectValue(rest, remaining, seen, accept);
    }
    if (key === undefined)
      return node.elements.some((entry) =>
        selectValue(entry, remaining, seen, accept),
      );
    if (typeof key !== "string") return false;

    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || String(index) !== key)
      return false;

    const spread = node.elements.findIndex(ts.isSpreadElement);
    if (spread >= 0 && index >= spread)
      return node.elements
        .slice(spread)
        .some((entry) =>
          ts.isSpreadElement(entry)
            ? selectValue(
                entry.expression,
                [undefined, ...remaining],
                seen,
                accept,
              )
            : selectValue(entry, remaining, seen, accept),
        );
    return selectValue(node.elements[index], remaining, seen, accept);
  };
  const selectValue = (node, keys, seen, accept) => {
    if (!node) return false;
    if (accept(node, seen, keys)) return true;
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))
      return selectValue(node.expression, keys, seen, accept);
    if (ts.isIdentifier(node)) return boundSelection(node, keys, seen, accept);
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    )
      return selectValue(
        node.expression,
        [memberKey(node), ...keys],
        seen,
        accept,
      );
    if (keys.length === 0) return false;

    const [key, ...remaining] = keys;
    if (ts.isObjectLiteralExpression(node))
      return objectSelection(node, key, remaining, seen, accept);
    if (ts.isArrayLiteralExpression(node))
      return arraySelection(node, key, remaining, seen, accept);
    return false;
  };
  const selectedOrigin = (value, keys, origin, seen = new Set()) => {
    return selectValue(value, keys, seen, (selected, visited, remaining) =>
      builtinSelection(selected, remaining, origin, visited),
    );
  };
  const selectedContainsModule = (value, keys, seen) =>
    selectValue(value, keys, seen, (selected, visited, remaining) =>
      remaining.length === 0
        ? containsModuleValue(selected, visited)
        : builtinSelection(selected, remaining, "module", visited),
    );
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
  const declarationSources = (declaration) => {
    if (ts.isVariableDeclaration(declaration))
      return [{ value: declaration.initializer, keys: [] }];
    if (ts.isFunctionDeclaration(declaration))
      return [{ value: declaration, keys: [] }];
    if (
      !ts.isBindingElement(declaration) ||
      !(
        ts.isObjectBindingPattern(declaration.parent) ||
        ts.isArrayBindingPattern(declaration.parent)
      )
    )
      return [];

    const parents = declarationSources(declaration.parent.parent);
    const key = bindingKey(declaration);
    const sources = parents.map(({ value, keys }) => ({
      value,
      keys: [...keys, key],
    }));
    if (declaration.initializer)
      sources.push({ value: declaration.initializer, keys: [] });
    return sources;
  };
  const bindingKey = (declaration) => {
    if (ts.isArrayBindingPattern(declaration.parent)) {
      const index = declaration.parent.elements.indexOf(declaration);
      return declaration.dotDotDotToken ? { rest: index } : String(index);
    }

    return declaration.dotDotDotToken
      ? {
          excluded: declaration.parent.elements
            .filter((entry) => !entry.dotDotDotToken)
            .map((entry) => propertyKey(entry.propertyName ?? entry.name)),
        }
      : propertyKey(declaration.propertyName ?? declaration.name);
  };
  const declarationOrigin = (declaration, origin, seen) => {
    const sources = declarationSources(declaration);
    if (sources.length)
      return sources.some(({ value, keys }) =>
        selectedOrigin(value, keys, origin, seen),
      );
    return importedOrigin(declaration, origin);
  };
  const identifierOrigin = (node, origin, seen) => {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return false;

    const next = new Set(seen).add(symbol);
    // Join possible writes: textual order cannot model conditional writes or closures.
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
    const declared = (symbol.declarations ?? []).flatMap(declarationSources);
    return [...(assignments.get(symbol) ?? []), ...declared].some(
      ({ value, keys }) => selectedContainsModule(value, keys, next),
    );
  };
  const returnedModule = (node, seen) => {
    if (!node.body) return false;
    if (!ts.isBlock(node.body)) return containsModuleValue(node.body, seen);

    const visitReturn = (child) => {
      if (ts.isReturnStatement(child))
        return containsModuleValue(child.expression, seen);
      if (ts.isFunctionLike(child)) return false;

      return ts.forEachChild(child, visitReturn) === true;
    };
    return ts.forEachChild(node.body, visitReturn) === true;
  };
  const alternativeValues = (node) => {
    if (ts.isConditionalExpression(node))
      return [node.whenTrue, node.whenFalse];
    if (
      ts.isBinaryExpression(node) &&
      valueAlternatives.has(node.operatorToken.kind)
    )
      return [node.left, node.right];
    return [];
  };
  const containsModuleValue = (node, seen = new Set()) => {
    if (!node) return false;
    if (moduleValue(node)) return true;
    const alternatives = alternativeValues(node);
    if (alternatives.length)
      return alternatives.some((value) => containsModuleValue(value, seen));
    if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node))
      return containsModuleValue(node.expression, seen);
    if (ts.isIdentifier(node)) return boundContainer(node, seen);
    if (ts.isFunctionLike(node)) return returnedModule(node, seen);
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    )
      return selectedContainsModule(node.expression, [memberKey(node)], seen);
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
      if (ts.isFunctionLike(entry)) return returnedModule(entry, seen);
      return false;
    });
  };
  const forbiddenKey = (node) => propertyKey(node) === "createRequire";
  const declarationEntries = (pattern) => {
    if (!(
      ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)
    ))
      return [];

    return pattern.elements.filter(ts.isBindingElement).map((entry) => ({
      key: bindingKey(entry),
      target: entry.name,
      fallback: entry.initializer,
    }));
  };
  const forbiddenPattern = (pattern, value, keys = []) => {
    if (
      ts.isBinaryExpression(pattern) &&
      pattern.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      return (
        forbiddenPattern(pattern.left, value, keys) ||
        forbiddenPattern(pattern.left, pattern.right)
      );

    const entries =
      ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)
        ? declarationEntries(pattern)
        : assignmentEntries(pattern);
    return entries.some(({ key, target, fallback }) => {
      if (
        (key === undefined || key === "createRequire") &&
        selectedOrigin(value, keys, "module")
      )
        return true;
      if (key === undefined && selectedOrigin(value, keys, "process"))
        return true;
      return (
        forbiddenPattern(target, value, [...keys, key]) ||
        (fallback !== undefined && forbiddenPattern(target, fallback))
      );
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
  const exportedNode = (node) => {
    if (ts.isExportDeclaration(node)) return moduleExport(node);
    if (ts.isExportAssignment(node))
      return containsModuleValue(node.expression);
    if (
      !node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      )
    )
      return false;

    if (ts.isFunctionDeclaration(node)) return returnedModule(node);
    if (ts.isVariableStatement(node))
      return node.declarationList.declarations.some((declaration) =>
        exportedBinding(declaration.name),
      );
    return false;
  };
  const forbiddenMember = (node) => {
    if (memberKey(node) === "createRequire")
      return moduleValue(node.expression);
    if (
      !ts.isElementAccessExpression(node) ||
      ts.isStringLiteralLike(node.argumentExpression)
    )
      return false;

    return (
      moduleValue(node.expression) ||
      (memberKey(node) === undefined && hasOrigin(node.expression, "process"))
    );
  };
  const visit = (node) => {
    let forbidden = forbiddenMember(node) || exportedNode(node);
    if (
      ts.isImportSpecifier(node) &&
      moduleSpecifier(node.parent.parent.parent.moduleSpecifier)
    )
      forbidden = forbiddenKey(node.propertyName ?? node.name);
    if (ts.isVariableDeclaration(node))
      forbidden = forbiddenPattern(node.name, node.initializer);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
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

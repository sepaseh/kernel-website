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
  const builtinOrigins = ["module", "process", "loader"];
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
  function* boundSelection(node, keys, seen) {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return;

    const next = new Set(seen).add(symbol);
    const declared = (symbol.declarations ?? []).flatMap(declarationSources);
    for (const source of [...(assignments.get(symbol) ?? []), ...declared])
      yield* selectionSources(source.value, [...source.keys, ...keys], next);
  }
  function* entryChoices(entry, array, seen) {
    let expanded = false;
    if (ts.isSpreadElement(entry) || ts.isSpreadAssignment(entry)) {
      for (const { value } of literalContainers(entry.expression, seen)) {
        if (ts.isArrayLiteralExpression(value) !== array) continue;

        expanded = true;
        yield array ? value.elements : value.properties;
      }
    }
    if (!expanded) yield [entry];
  }
  // Share the budget across the file, including nested and repeated expansions.
  let remainingSpreadWork = 32_768;
  function* expandedEntries(entries, index, prefix, array, seen) {
    if (index === entries.length) {
      yield prefix;
      return;
    }
    for (const choice of entryChoices(entries[index], array, seen)) {
      remainingSpreadWork -= 1 + prefix.length + choice.length;
      assert.ok(
        remainingSpreadWork >= 0,
        "Literal spread expansion exceeds the import analysis limit.",
      );
      yield* expandedEntries(
        entries,
        index + 1,
        [...prefix, ...choice],
        array,
        seen,
      );
    }
  }
  function* expandedLiteral(node, seen) {
    const array = ts.isArrayLiteralExpression(node);
    const entries = array ? node.elements : node.properties;
    for (const expanded of expandedEntries(entries, 0, [], array, seen))
      yield {
        value: array
          ? ts.factory.createArrayLiteralExpression(expanded)
          : ts.factory.createObjectLiteralExpression(expanded),
        visited: seen,
      };
  }
  function* literalContainers(node, seen) {
    for (const { value, visited, keys } of selectionSources(node, [], seen)) {
      if (keys.length !== 0) continue;
      if (
        ts.isObjectLiteralExpression(value) ||
        ts.isArrayLiteralExpression(value)
      )
        yield* expandedLiteral(value, visited);
    }
  }
  function* objectSelection(node, key, remaining, seen) {
    if (objectRest(key)) {
      for (const { value, visited } of literalContainers(node, seen)) {
        const properties = value.properties.filter((entry) => {
          const name = propertyKey(entry.name);
          return name === undefined || !key.excluded.includes(name);
        });
        const rest = ts.factory.createObjectLiteralExpression(properties);
        yield* selectionSources(rest, remaining, visited);
      }
      return;
    }
    for (const entry of node.properties) {
      if (ts.isSpreadAssignment(entry)) {
        yield* selectionSources(entry.expression, [key, ...remaining], seen);
        continue;
      }
      const name = propertyKey(entry.name);
      if (key !== undefined && name !== undefined && name !== key) continue;

      yield* propertySelection(entry, remaining, seen);
    }
  }
  function* propertySelection(entry, keys, seen) {
    if (ts.isPropertyAssignment(entry))
      yield* selectionSources(entry.initializer, keys, seen);
    if (ts.isShorthandPropertyAssignment(entry))
      yield* selectionSources(entry.name, keys, seen);
    if (ts.isGetAccessorDeclaration(entry))
      for (const value of outputExpressions(entry))
        yield* selectionSources(value, keys, seen);
  }
  function* arraySelection(node, key, remaining, seen) {
    for (const { value, visited } of literalContainers(node, seen))
      yield* selectedArray(value, key, remaining, visited);
  }
  function* uncertainArraySelection(entries, remaining, seen) {
    for (const entry of entries) {
      if (ts.isSpreadElement(entry))
        yield* selectionSources(
          entry.expression,
          [undefined, ...remaining],
          seen,
        );
      else yield* selectionSources(entry, remaining, seen);
    }
  }
  function* selectedArray(node, key, remaining, seen) {
    if (objectRest(key)) {
      const properties = node.elements.map((entry, index) =>
        ts.factory.createPropertyAssignment(String(index), entry),
      );
      yield* objectSelection(
        ts.factory.createObjectLiteralExpression(properties),
        key,
        remaining,
        seen,
      );
      return;
    }
    if (typeof key === "object" && key !== null && "rest" in key) {
      const rest = ts.factory.createArrayLiteralExpression(
        node.elements.slice(key.rest),
      );
      yield* selectionSources(rest, remaining, seen);
      return;
    }
    if (key === undefined) {
      for (const entry of node.elements)
        yield* selectionSources(entry, remaining, seen);
      return;
    }
    if (typeof key !== "string") return;

    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || String(index) !== key) return;

    const spread = node.elements.findIndex(ts.isSpreadElement);
    if (spread >= 0 && index >= spread) {
      yield* uncertainArraySelection(
        node.elements.slice(spread),
        remaining,
        seen,
      );
      return;
    }
    yield* selectionSources(node.elements[index], remaining, seen);
  }
  function* selectionSources(node, keys, seen) {
    if (!node) return;
    yield { value: node, visited: seen, keys };
    const alternatives = alternativeValues(node);
    if (alternatives.length) {
      for (const value of alternatives)
        yield* selectionSources(value, keys, seen);
      return;
    }
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node)) {
      yield* selectionSources(node.expression, keys, seen);
      return;
    }
    if (ts.isIdentifier(node)) {
      yield* boundSelection(node, keys, seen);
      return;
    }
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      yield* selectionSources(
        node.expression,
        [memberKey(node), ...keys],
        seen,
      );
      return;
    }
    if (keys.length === 0) return;

    const [key, ...remaining] = keys;
    if (ts.isObjectLiteralExpression(node))
      yield* objectSelection(node, key, remaining, seen);
    if (ts.isArrayLiteralExpression(node))
      yield* arraySelection(node, key, remaining, seen);
  }
  const selectValue = (node, keys, seen, accept) => {
    for (const source of selectionSources(node, keys, seen))
      if (accept(source.value, source.visited, source.keys)) return true;
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
        : builtinOrigins.some((origin) =>
            builtinSelection(selected, remaining, origin, visited),
          ),
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
    const alternatives = alternativeValues(node);
    if (alternatives.length)
      return alternatives.some((value) => hasOrigin(value, origin, seen));
    if (ts.isObjectLiteralExpression(node))
      return copiedOrigin(node, origin, seen);
    if (ts.isCallExpression(node)) return callOrigin(node, origin, seen);
    if (ts.isIdentifier(node)) {
      const globals = {
        global: "globalThis",
        loader: "require",
        process: "process",
      };
      return (
        globalIdentifier(node, globals[origin]) ||
        identifierOrigin(node, origin, seen)
      );
    }
    return selectedOrigin(node.expression, [memberKey(node)], origin, seen);
  };
  const copiedOrigin = (node, origin, seen) => {
    if (origin !== "module" && origin !== "process") return false;

    return node.properties.some(
      (entry) =>
        ts.isSpreadAssignment(entry) &&
        hasOrigin(entry.expression, origin, seen),
    );
  };
  const moduleValue = (node) => hasOrigin(node, "module");
  const builtinBearingValue = (node) =>
    builtinOrigins.some((origin) => hasOrigin(node, origin));
  const boundContainer = (node, seen) => {
    const symbol = bindingSymbol(node);
    if (!symbol || seen.has(symbol)) return false;

    const next = new Set(seen).add(symbol);
    const declared = (symbol.declarations ?? []).flatMap(declarationSources);
    return [...(assignments.get(symbol) ?? []), ...declared].some(
      ({ value, keys }) => selectedContainsModule(value, keys, next),
    );
  };
  function* outputNodes(node) {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) || ts.isYieldExpression(node))
      yield node.expression;

    const children = [];
    ts.forEachChild(node, (child) => {
      children.push(child);
    });
    for (const child of children) yield* outputNodes(child);
  }
  function* outputExpressions(node) {
    if (!node.body) return;
    if (ts.isBlock(node.body)) yield* outputNodes(node.body);
    else yield node.body;
  }
  const returnedModule = (node, seen) => {
    for (const value of outputExpressions(node))
      if (containsModuleValue(value, seen)) return true;
    return false;
  };
  const alternativeValues = (node) => {
    if (ts.isConditionalExpression(node))
      return [node.whenTrue, node.whenFalse];
    if (!ts.isBinaryExpression(node)) return [];
    const operator = node.operatorToken.kind;
    if (valueAlternatives.has(operator)) return [node.left, node.right];
    if (
      operator === ts.SyntaxKind.CommaToken ||
      operator === ts.SyntaxKind.EqualsToken
    )
      return [node.right];
    return [];
  };
  const containsModuleValue = (node, seen = new Set()) => {
    if (!node) return false;
    if (builtinBearingValue(node)) return true;
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
    // Reject builtin-bearing member writes instead of modeling mutable heap aliases.
    if (
      ts.isPropertyAccessExpression(pattern) ||
      ts.isElementAccessExpression(pattern)
    )
      return selectedContainsModule(value, keys, new Set());
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
      const module = moduleSpecifier(node.moduleSpecifier);
      const process = builtinSpecifier(node.moduleSpecifier, "process");
      if (!module && !process) return false;
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause))
        return true;
      return node.exportClause.elements.some((entry) => {
        const key = propertyKey(entry.propertyName ?? entry.name);
        return module
          ? key === "createRequire" || moduleMembers.has(key)
          : key === "getBuiltinModule" || key === "default";
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
      writeOperators.has(node.operatorToken.kind)
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

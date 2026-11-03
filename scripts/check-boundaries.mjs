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
    ts.SyntaxKind.AmpersandAmpersandEqualsToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.BarBarEqualsToken,
    ts.SyntaxKind.QuestionQuestionToken,
    ts.SyntaxKind.QuestionQuestionEqualsToken,
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
  const traversalState = () => ({
    bindings: new Map(),
    calls: new Set(),
    symbols: new Set(),
  });
  // Include unsuccessful branches and promise classification in the file budget.
  let remainingThenWork = 32_768;
  const consumeThenWork = () => {
    remainingThenWork--;
    assert.ok(
      remainingThenWork >= 0,
      "Promise callback traversal exceeds the import analysis limit.",
    );
  };
  const builtinSelection = (value, keys, origin, state) => {
    let sourceOrigin = origin;
    for (const key of keys.toReversed()) {
      sourceOrigin = memberSourceOrigin(key, sourceOrigin);
      if (!sourceOrigin) return false;
    }
    return hasOrigin(value, sourceOrigin, state);
  };
  function* boundSelection(node, keys, state) {
    const symbol = bindingSymbol(node);
    if (!symbol || state.symbols.has(symbol)) return;

    const next = { ...state, symbols: new Set(state.symbols).add(symbol) };
    const declared = (symbol.declarations ?? []).flatMap((declaration) =>
      declarationSources(declaration, next),
    );
    for (const source of [...(assignments.get(symbol) ?? []), ...declared])
      yield* selectionSources(source.value, [...source.keys, ...keys], {
        ...(source.state ?? next),
        promiseOnly: state.promiseOnly,
        terminalOnly: state.terminalOnly,
      });
  }
  const spreadEntry = (entry) =>
    ts.isSpreadElement(entry) || ts.isSpreadAssignment(entry);
  function* entryChoices(entry, array, state) {
    if (state.terminalOnly) {
      yield* argumentSpreadChoices(entry, array, state);
      return;
    }
    let expanded = false;
    for (const { value } of literalContainers(entry.expression, state)) {
      if (ts.isArrayLiteralExpression(value) !== array) continue;

      expanded = true;
      yield array ? value.elements : value.properties;
    }
    if (!expanded) yield [entry];
  }
  function* argumentSpreadChoices(entry, array, state) {
    for (const { value, visited, keys } of selectionSources(
      entry.expression,
      [],
      state,
    )) {
      const literal = array
        ? ts.isArrayLiteralExpression(value)
        : ts.isObjectLiteralExpression(value);
      if (keys.length || !literal) {
        yield [entry];
        continue;
      }
      for (const expanded of expandedLiteral(value, visited))
        yield array ? expanded.value.elements : expanded.value.properties;
    }
  }
  // Share the budget across the file, including nested and repeated expansions.
  let remainingSpreadWork = 32_768;
  const expandedPrefix = (prefix, entries, start, end, choice) => {
    remainingSpreadWork -= 1 + prefix.length + end - start + choice.length;
    assert.ok(
      remainingSpreadWork >= 0,
      "Literal spread expansion exceeds the import analysis limit.",
    );
    const expanded = [...prefix];
    for (let index = start; index < end; index++) expanded.push(entries[index]);
    for (const entry of choice) expanded.push(entry);
    return expanded;
  };
  function* expandedEntries(entries, index, prefix, array, state) {
    if (index === entries.length) {
      yield prefix;
      return;
    }

    let spread = index;
    while (spread < entries.length && !spreadEntry(entries[spread])) spread++;
    if (spread === entries.length) {
      yield expandedPrefix(prefix, entries, index, spread, []);
      return;
    }
    for (const choice of entryChoices(entries[spread], array, state)) {
      yield* expandedEntries(
        entries,
        spread + 1,
        expandedPrefix(prefix, entries, index, spread, choice),
        array,
        state,
      );
    }
  }
  function* expandedLiteral(node, state) {
    const array = ts.isArrayLiteralExpression(node);
    const entries = array ? node.elements : node.properties;
    if (!entries.some(spreadEntry)) {
      yield { value: node, visited: state };
      return;
    }

    for (const expanded of expandedEntries(entries, 0, [], array, state))
      yield {
        value: array
          ? ts.factory.createArrayLiteralExpression(expanded)
          : ts.factory.createObjectLiteralExpression(expanded),
        visited: state,
      };
  }
  function* literalContainers(node, state) {
    for (const { value, visited, keys } of selectionSources(node, [], state)) {
      if (keys.length !== 0) continue;
      if (
        ts.isObjectLiteralExpression(value) ||
        ts.isArrayLiteralExpression(value)
      )
        yield* expandedLiteral(value, visited);
    }
  }
  function* objectSelection(node, key, remaining, state) {
    if (objectRest(key)) {
      for (const { value, visited } of literalContainers(node, state)) {
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
        yield* selectionSources(entry.expression, [key, ...remaining], state);
        continue;
      }
      const name = propertyKey(entry.name);
      if (key !== undefined && name !== undefined && name !== key) continue;

      yield* propertySelection(entry, remaining, state);
    }
  }
  function* propertySelection(entry, keys, state) {
    if (ts.isPropertyAssignment(entry))
      yield* selectionSources(entry.initializer, keys, state);
    if (ts.isShorthandPropertyAssignment(entry))
      yield* selectionSources(entry.name, keys, state);
    if (ts.isGetAccessorDeclaration(entry))
      for (const value of outputExpressions(entry))
        yield* selectionSources(value, keys, state);
  }
  function* arraySelection(node, key, remaining, state) {
    for (const { value, visited } of literalContainers(node, state))
      yield* selectedArray(value, key, remaining, visited);
  }
  function* uncertainArraySelection(entries, remaining, state) {
    for (const entry of entries) {
      if (ts.isSpreadElement(entry))
        yield* selectionSources(
          entry.expression,
          [undefined, ...remaining],
          state,
        );
      else yield* selectionSources(entry, remaining, state);
    }
  }
  function* selectedArray(node, key, remaining, state) {
    if (objectRest(key)) {
      const properties = node.elements.map((entry, index) =>
        ts.factory.createPropertyAssignment(String(index), entry),
      );
      yield* objectSelection(
        ts.factory.createObjectLiteralExpression(properties),
        key,
        remaining,
        state,
      );
      return;
    }
    if (typeof key === "object" && key !== null && "rest" in key) {
      const rest = ts.factory.createArrayLiteralExpression(
        node.elements.slice(key.rest),
      );
      yield* selectionSources(rest, remaining, state);
      return;
    }
    if (key === undefined) {
      for (const entry of node.elements)
        yield* selectionSources(entry, remaining, state);
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
        state,
      );
      return;
    }
    yield* selectionSources(node.elements[index], remaining, state);
  }
  function* selectionSources(node, keys, state) {
    if (!node) return;
    if (state.promiseOnly || state.calls.size) consumeThenWork();
    if (!state.terminalOnly) yield { value: node, visited: state, keys };

    let expanded = false;
    for (const source of selectionChildren(node, keys, state)) {
      expanded = true;
      yield source;
    }
    if (state.terminalOnly && !expanded)
      yield { value: node, visited: state, keys };
  }
  function* selectionChildren(node, keys, state) {
    const alternatives = alternativeValues(node);
    if (alternatives.length) {
      for (const value of alternatives)
        yield* selectionSources(value, keys, state);
      return;
    }
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node)) {
      yield* selectionSources(node.expression, keys, state);
      return;
    }
    if (ts.isIdentifier(node)) {
      yield* boundSelection(node, keys, state);
      return;
    }
    if (ts.isCallExpression(node)) {
      if (!state.promiseOnly)
        for (const source of thenOutputs(node, state))
          yield* selectionSources(source.value, keys, source.visited);
      return;
    }
    yield* memberSelections(node, keys, state);
  }
  function* memberSelections(node, keys, state) {
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    ) {
      yield* selectionSources(
        node.expression,
        [memberKey(node), ...keys],
        state,
      );
      return;
    }
    if (keys.length === 0) return;

    const [key, ...remaining] = keys;
    if (ts.isObjectLiteralExpression(node))
      yield* objectSelection(node, key, remaining, state);
    if (ts.isArrayLiteralExpression(node))
      yield* arraySelection(node, key, remaining, state);
  }
  const selectValue = (node, keys, state, accept) => {
    for (const source of selectionSources(node, keys, state))
      if (accept(source.value, source.visited, source.keys)) return true;
    return false;
  };
  const selectedOrigin = (value, keys, origin, state = traversalState()) => {
    if (keys.length === 0) return hasOrigin(value, origin, state);
    return selectValue(value, keys, state, (selected, visited, remaining) =>
      builtinSelection(selected, remaining, origin, visited),
    );
  };
  const selectedContainsModule = (value, keys, state) => {
    if (keys.length === 0) return containsModuleValue(value, state);
    return selectValue(value, keys, state, (selected, visited, remaining) =>
      remaining.length === 0
        ? containsModuleValue(selected, visited)
        : builtinOrigins.some((origin) =>
            builtinSelection(selected, remaining, origin, visited),
          ),
    );
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
  const declarationSources = (declaration, state) => {
    if (ts.isVariableDeclaration(declaration))
      return [{ value: declaration.initializer, keys: [] }];
    if (ts.isFunctionDeclaration(declaration))
      return [{ value: declaration, keys: [] }];
    if (ts.isParameter(declaration))
      return (
        state.bindings.get(declaration) ?? [
          { value: declaration.initializer, keys: [] },
        ]
      );
    if (
      !ts.isBindingElement(declaration) ||
      !(
        ts.isObjectBindingPattern(declaration.parent) ||
        ts.isArrayBindingPattern(declaration.parent)
      )
    )
      return [];

    const parents = declarationSources(declaration.parent.parent, state);
    const key = bindingKey(declaration);
    const sources = parents.map((source) => ({
      ...source,
      keys: [...source.keys, key],
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
  const declarationOrigin = (declaration, origin, state) => {
    const sources = declarationSources(declaration, state);
    if (sources.length)
      return sources.some((source) =>
        selectedOrigin(
          source.value,
          source.keys,
          origin,
          source.state ?? state,
        ),
      );
    return importedOrigin(declaration, origin);
  };
  const identifierOrigin = (node, origin, state) => {
    const symbol = bindingSymbol(node);
    if (!symbol || state.symbols.has(symbol)) return false;

    const next = { ...state, symbols: new Set(state.symbols).add(symbol) };
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
  const callOrigin = (node, origin, state) => {
    if (
      origin !== "loader" &&
      node.arguments.length === 1 &&
      builtinSpecifier(node.arguments[0], origin) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        hasOrigin(node.expression, "loader", state))
    )
      return true;
    for (const { value, visited } of thenOutputs(node, state))
      if (hasOrigin(value, origin, visited)) return true;
    return false;
  };
  const hasOrigin = (node, origin, state = traversalState()) => {
    if (!node) return false;
    if (state.calls.size) consumeThenWork();
    if (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))
      return hasOrigin(node.expression, origin, state);
    const alternatives = alternativeValues(node);
    if (alternatives.length)
      return alternatives.some((value) => hasOrigin(value, origin, state));
    if (ts.isObjectLiteralExpression(node))
      return copiedOrigin(node, origin, state);
    if (ts.isCallExpression(node)) return callOrigin(node, origin, state);
    if (ts.isIdentifier(node)) {
      const globals = {
        global: "globalThis",
        loader: "require",
        process: "process",
      };
      return (
        globalIdentifier(node, globals[origin]) ||
        identifierOrigin(node, origin, state)
      );
    }
    return selectedOrigin(node.expression, [memberKey(node)], origin, state);
  };
  const copiedOrigin = (node, origin, state) => {
    if (origin !== "module" && origin !== "process") return false;

    return node.properties.some(
      (entry) =>
        ts.isSpreadAssignment(entry) &&
        hasOrigin(entry.expression, origin, state),
    );
  };
  const moduleValue = (node, state) => hasOrigin(node, "module", state);
  const builtinBearingValue = (node, state) =>
    builtinOrigins.some((origin) => hasOrigin(node, origin, state));
  const boundContainer = (node, state) => {
    if (globalIdentifier(node, "require") || globalIdentifier(node, "process"))
      return true;
    const symbol = bindingSymbol(node);
    if (!symbol || state.symbols.has(symbol)) return false;

    const next = { ...state, symbols: new Set(state.symbols).add(symbol) };
    if (
      (symbol.declarations ?? []).some((declaration) =>
        builtinOrigins.some((origin) => importedOrigin(declaration, origin)),
      )
    )
      return true;
    const declared = (symbol.declarations ?? []).flatMap((declaration) =>
      declarationSources(declaration, next),
    );
    return [...(assignments.get(symbol) ?? []), ...declared].some((source) =>
      selectedContainsModule(source.value, source.keys, source.state ?? next),
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
  const thenReceiver = (node) =>
    ts.isCallExpression(node) && memberKey(node.expression) === "then"
      ? node.expression.expression
      : undefined;
  const importPromise = (node, state) => {
    consumeThenWork();
    const lookup = { ...state, promiseOnly: true };
    for (const { value, visited, keys } of selectionSources(node, [], lookup)) {
      if (keys.length || !ts.isCallExpression(value)) continue;
      if (value.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
      const receiver = thenReceiver(value);
      if (!receiver || visited.calls.has(value)) continue;

      const next = { ...visited, calls: new Set(visited.calls).add(value) };
      if (importPromise(receiver, next)) return true;
    }
    return false;
  };
  const nonCallableHandler = (node) =>
    ts.isLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isArrayLiteralExpression(node) ||
    ts.isVoidExpression(node) ||
    [
      ts.SyntaxKind.FalseKeyword,
      ts.SyntaxKind.NullKeyword,
      ts.SyntaxKind.TrueKeyword,
    ].includes(node.kind) ||
    globalIdentifier(node, "undefined");
  function* callbackOutputs(callback, receiver, state, caller) {
    if (!ts.isFunctionLike(callback) || !callback.body) return;

    const bindings = new Map(state.bindings);
    const parameter = callback.parameters[0];
    if (parameter)
      bindings.set(parameter, [{ value: receiver, keys: [], state: caller }]);
    const visited = { ...state, bindings, symbols: new Set() };
    for (const value of outputExpressions(callback)) yield { value, visited };
  }
  function* firstArgumentSources(entries, state, index = 0) {
    consumeThenWork();
    const entry = entries[index];
    if (!entry) {
      yield { value: undefined, visited: state, keys: [], missing: true };
      return;
    }
    if (ts.isOmittedExpression(entry)) {
      yield { value: undefined, visited: state, keys: [] };
      return;
    }
    if (!ts.isSpreadElement(entry)) {
      yield* selectionSources(entry, [], state);
      return;
    }

    for (const source of spreadFirstArguments(entry.expression, state)) {
      if (source.missing)
        yield* firstArgumentSources(entries, state, index + 1);
      else yield source;
    }
  }
  function* spreadFirstArguments(node, state) {
    const lookup = { ...state, terminalOnly: true };
    for (const { value, visited, keys } of selectionSources(node, [], lookup)) {
      if (keys.length || !ts.isArrayLiteralExpression(value)) {
        yield { value: undefined, visited: state, keys: [] };
        yield { value: undefined, visited: state, keys: [], missing: true };
        continue;
      }
      for (const expanded of expandedLiteral(value, visited))
        yield* firstArgumentSources(expanded.value.elements, expanded.visited);
    }
  }
  function* thenOutputs(node, state) {
    const receiver = thenReceiver(node);
    if (!receiver || state.calls.has(node)) return;

    consumeThenWork();
    if (!importPromise(receiver, state)) return;

    const caller = { ...state, calls: new Set(state.calls).add(node) };
    for (const { value, visited, keys } of firstArgumentSources(
      node.arguments,
      caller,
    )) {
      if (keys.length) continue;
      if (value === undefined || nonCallableHandler(value)) {
        yield { value: receiver, visited: caller };
        continue;
      }
      yield* callbackOutputs(
        value,
        receiver,
        { ...visited, terminalOnly: state.terminalOnly },
        caller,
      );
    }
  }
  const returnedModule = (node, state) => {
    for (const value of outputExpressions(node))
      if (containsModuleValue(value, state)) return true;
    return false;
  };
  const alternativeValues = (node) => {
    if (ts.isConditionalExpression(node))
      return [node.whenTrue, node.whenFalse];
    if (!ts.isBinaryExpression(node)) return [];
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.QuestionQuestionToken) {
      let left = node.left;
      while (ts.isParenthesizedExpression(left)) left = left.expression;
      if (left.kind === ts.SyntaxKind.NullKeyword) return [node.right];
    }
    if (valueAlternatives.has(operator)) return [node.left, node.right];
    if (
      operator === ts.SyntaxKind.CommaToken ||
      operator === ts.SyntaxKind.EqualsToken
    )
      return [node.right];
    return [];
  };
  const callContainsModule = (node, state) => {
    for (const { value, visited } of thenOutputs(node, state))
      if (containsModuleValue(value, visited)) return true;
    return !thenReceiver(node) && builtinBearingValue(node, state);
  };
  const containsModuleValue = (node, state = traversalState()) => {
    if (!node) return false;
    if (state.calls.size) consumeThenWork();
    const alternatives = alternativeValues(node);
    if (alternatives.length)
      return alternatives.some((value) => containsModuleValue(value, state));
    if (ts.isParenthesizedExpression(node) || ts.isAwaitExpression(node))
      return containsModuleValue(node.expression, state);
    if (ts.isIdentifier(node)) return boundContainer(node, state);
    if (ts.isFunctionLike(node)) return returnedModule(node, state);
    if (ts.isCallExpression(node)) return callContainsModule(node, state);
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    )
      return selectedContainsModule(node.expression, [memberKey(node)], state);
    return literalContainsModule(node, state);
  };
  const literalContainsModule = (node, state) => {
    if (ts.isSpreadElement(node))
      return containsModuleValue(node.expression, state);
    if (ts.isArrayLiteralExpression(node))
      return node.elements.some((entry) => containsModuleValue(entry, state));
    if (!ts.isObjectLiteralExpression(node)) return false;

    return node.properties.some((entry) => {
      if (ts.isPropertyAssignment(entry))
        return containsModuleValue(entry.initializer, state);
      if (ts.isSpreadAssignment(entry))
        return containsModuleValue(entry.expression, state);
      if (ts.isShorthandPropertyAssignment(entry))
        return containsModuleValue(entry.name, state);
      if (ts.isFunctionLike(entry)) return returnedModule(entry, state);
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
      return selectedContainsModule(value, keys, traversalState());
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

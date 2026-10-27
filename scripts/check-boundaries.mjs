import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
const repository = fileURLToPath(new URL("../", import.meta.url));
const publishedProductionFiles = new Set([
  "src/shared/api/client.ts",
  "src/features/auth/api.ts",
  "src/features/account/api.ts",
  "src/features/login/api.ts",
  "src/features/register/api.ts",
  "src/features/recovery/api.ts",
  "src/shared/seo/config.ts",
  "src/shared/seo/metadata.ts",
  "src/shared/seo/structured-data.ts",
  "src/shared/performance/web-vitals.ts",
  "src/shared/fonts/preloads.ts",
  "src/i18n/client-messages.ts",
  "src/lib/utils.ts",
  "src/shared/api/proxy.ts",
  "src/shared/security/csp.ts",
  "src/shared/contracts/index.ts",
  "src/shared/settings/contracts.ts",
  "src/features/account/types.ts",
  "src/features/login/types.ts",
  "src/features/recovery/types.ts",
  "src/features/register/types.ts",
  "src/shared/lib/form-values.ts",
  "src/shared/api/origin.ts",
  "src/i18n/catalog-data/locales.ts",
  "src/i18n/catalog-data/website-types.ts",
  "src/i18n/catalog-data/locales/ar.ts",
  "src/i18n/catalog-data/locales/de.ts",
  "src/i18n/catalog-data/locales/en.ts",
  "src/i18n/catalog-data/locales/es.ts",
  "src/i18n/catalog-data/locales/fa.ts",
  "src/i18n/catalog-data/locales/fr.ts",
  "src/i18n/catalog-data/locales/it.ts",
  "src/i18n/catalog-data/locales/pt.ts",
  "src/i18n/catalog-data/locales/ru.ts",
  "src/i18n/catalog-data/locales/tr.ts",
  "src/i18n/catalogs.ts",
  "src/shared/settings/language.ts",
]);
const ownerPackages = new Map([
  [
    "src/shared/seo/metadata.ts",
    [{ specifier: "next", package: "next", typeOnly: true }],
  ],
  [
    "src/shared/performance/web-vitals.ts",
    [{ specifier: "next/web-vitals", package: "next", typeOnly: true }],
  ],
  [
    "src/i18n/client-messages.ts",
    [{ specifier: "next-intl", package: "next-intl", typeOnly: true }],
  ],
  [
    "src/lib/utils.ts",
    [
      { specifier: "clsx", package: "clsx", typeOnly: false },
      {
        specifier: "tailwind-merge",
        package: "tailwind-merge",
        typeOnly: false,
      },
    ],
  ],
]);
const runtimePackages = [
  "clsx",
  "next",
  "next-intl",
  "react",
  "react-dom",
  "tailwind-merge",
];
const inside = (root, file) => {
  const relative = path.relative(root, file);
  return (
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
  );
};

const isErasedTypeReference = (node) => {
  if (ts.isImportTypeNode(node)) return true;
  if (ts.isImportDeclaration(node))
    return node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
  if (ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node))
    return node.isTypeOnly;
  return false;
};

export const inspectImports = (content, filename = "source.ts") => {
  const source = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  const add = (node, value) =>
    imports.push({
      specifier:
        value && ts.isStringLiteralLike(value) ? value.text : undefined,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      typeOnly: isErasedTypeReference(node),
    });
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      add(node, node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      add(
        node,
        ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      add(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
};

export const boundaryViolation = ({
  root,
  file,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
}) => {
  if (!specifier)
    return "Use explicit module entrypoints instead of computed imports";
  const owner = path.relative(root, file).replaceAll(path.sep, "/");
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) {
    const allowed = ownerPackages
      .get(owner)
      ?.some(
        (entry) =>
          entry.specifier === specifier &&
          entry.package === resolvedPackage &&
          entry.typeOnly === typeOnly,
      );
    return allowed &&
      resolved &&
      inside(path.join(root, "node_modules"), resolved)
      ? undefined
      : "Package imports require an exact owner, installed package and runtime/type-only permission";
  }
  const relativeTarget =
    resolved && path.relative(root, resolved).replaceAll(path.sep, "/");
  if (relativeTarget === "src/shared/fonts/manifest.json")
    return owner === "src/shared/fonts/preloads.ts" && !typeOnly
      ? undefined
      : "Only the font preload helper may load the published font manifest";
  if (!relativeTarget || !publishedProductionFiles.has(relativeTarget))
    return "Published imports must resolve only to published local production modules";

  for (const directory of ["src/shared/contracts", "src/i18n/catalog-data"]) {
    const pure = path.resolve(root, directory);
    if (
      inside(pure, file) &&
      (!specifier.startsWith(".") || !inside(pure, resolved))
    )
      return "Contracts and locale data must remain pure local source";
  }
  if (inside(path.resolve(root, "src/i18n/catalog-data"), file) && !typeOnly)
    return "Catalog data may import only fully erased local types";
  const wireOwners = [
    "src/features/account/types.ts",
    "src/features/login/types.ts",
    "src/features/recovery/types.ts",
    "src/features/register/types.ts",
    "src/shared/settings/contracts.ts",
  ];
  if (
    wireOwners.some((owner) => path.resolve(root, owner) === file) &&
    !inside(path.resolve(root, "src/shared/contracts"), resolved)
  )
    return "Owned wire contracts may depend only on the local shared wire contract";
  return undefined;
};
const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map(async (entry) => {
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error("Source boundaries must not follow symbolic links");
      if (entry.isDirectory())
        return ["test", "__tests__", "node_modules"].includes(entry.name)
          ? []
          : sourceFiles(filename);
      return /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !/\.(?:test|spec|stories)\./.test(entry.name)
        ? [filename]
        : [];
    }),
  );
  return groups.flat();
};

export const checkBoundaries = async (root = repository) => {
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const violations = [];
  const dependencies = Object.keys(manifest.dependencies ?? {}).sort();
  if (
    JSON.stringify(dependencies) !== JSON.stringify(runtimePackages) ||
    Object.values(manifest.dependencies ?? {}).some(
      (version) =>
        typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version),
    )
  )
    violations.push(
      "This publication requires exactly its declared client/document packages",
    );
  if (
    Object.values(manifest.devDependencies ?? {}).some(
      (version) =>
        typeof version !== "string" ||
        /^(?:npm:|file:|link:|workspace:|git|https?:|\.|\/|[a-z]:[\\/])/i.test(
          version,
        ),
    )
  )
    violations.push(
      "Development packages must not link local source, aliases or remote repositories",
    );
  if (manifest.workspaces !== undefined)
    violations.push("A standalone project must not declare npm workspaces");
  for (const name of await readdir(root))
    if (["apps", "packages"].includes(name))
      violations.push("Retired source scaffold: " + name);
  const configPath = path.join(root, "tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  const { options, errors } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  if (errors.length)
    throw new Error(
      errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        )
        .join("\n"),
    );
  const cache = ts.createModuleResolutionCache(root, (value) => value, options);
  const files = await sourceFiles(path.join(root, "src"));
  const results = await Promise.all(
    files.map(async (file) => {
      const own = [];
      if (
        !publishedProductionFiles.has(
          path.relative(root, file).replaceAll(path.sep, "/"),
        )
      )
        own.push("Unpublished production module: " + path.relative(root, file));
      const edges = inspectImports(await readFile(file, "utf8"), file);
      const imports = await Promise.all(
        edges.map(async (edge) => {
          const resolved =
            edge.specifier &&
            ts.resolveModuleName(edge.specifier, file, options, ts.sys, cache)
              .resolvedModule;
          const target =
            resolved && (await realpath(resolved.resolvedFileName));
          const violation = !resolved
            ? "Every published import must resolve"
            : boundaryViolation({
                root,
                file,
                specifier: edge.specifier,
                resolved: target,
                typeOnly: edge.typeOnly,
                resolvedPackage: resolved?.packageId?.name,
              });
          return violation
            ? path.relative(root, file) +
                ":" +
                edge.line +
                ": " +
                (edge.specifier ?? "[computed import]") +
                ": " +
                violation
            : undefined;
        }),
      );
      return [...own, ...imports.filter((value) => value !== undefined)];
    }),
  );
  violations.push(...results.flat());
  return { files: files.length, violations };
};
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkBoundaries();
  if (result.violations.length) {
    console.error(result.violations.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Project boundaries checked: " +
        result.files +
        " production source files.",
    );
}

import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
const repository = fileURLToPath(new URL("../", import.meta.url));
const publishedProductionFiles = new Set([
  "src/app/(auth)/forgot-password/page.tsx",
  "src/app/(auth)/layout.tsx",
  "src/app/(auth)/login/page.tsx",
  "src/app/(auth)/register/page.tsx",
  "src/app/[...rest]/page.tsx",
  "src/app/account/page.tsx",
  "src/app/api/[...path]/route.ts",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/layout.tsx",
  "src/app/not-found.tsx",
  "src/app/page.tsx",
  "src/app/robots.ts",
  "src/app/sitemap.ts",
  "src/app/social-image/route.tsx",
  "src/i18n/request.ts",
  "src/proxy.ts",
  "src/shared/security/nonce.ts",
  "src/shared/settings/server.ts",
  "src/website/home/Home.tsx",
  "src/website/layouts/AuthLayout.tsx",
  "src/website/layouts/Footer.tsx",
  "src/website/layouts/Header.tsx",
  "src/website/layouts/HeaderAccountLink.tsx",
  "src/features/account/Account.tsx",
  "src/features/account/components/account-section/AccountSection.tsx",
  "src/features/account/components/email-form/EmailForm.tsx",
  "src/features/account/components/password-form/PasswordForm.tsx",
  "src/features/account/components/profile-form/ProfileForm.tsx",
  "src/features/account/components/username-form/UsernameForm.tsx",
  "src/features/account/index.ts",
  "src/features/auth/OtpForm.tsx",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/recovery/Recovery.tsx",
  "src/features/recovery/index.ts",
  "src/features/register/Register.tsx",
  "src/features/register/index.ts",
  "src/shared/hooks/use-operation-scope.ts",
  "src/shared/navigation/document.ts",

  "src/components/ui/alert.tsx",
  "src/components/ui/button.tsx",
  "src/components/ui/card.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/label.tsx",
  "src/shared/ui/FormField.tsx",
  "src/shared/ui/Feedback.tsx",
  "src/features/auth/SessionProvider.tsx",
  "src/shared/hooks/use-cooldown.ts",
  "src/website/shared/Preferences.tsx",
  "src/app/providers/Providers.tsx",
  "src/website/home/Reveal.tsx",
  "src/shared/performance/WebVitals.tsx",
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
const reactRuntimeImport = {
  specifier: "react",
  package: "@types/react",
  typeOnly: false,
};
const intlRuntimeImport = {
  specifier: "next-intl",
  package: "next-intl",
  typeOnly: false,
};
const localizedFormImports = [intlRuntimeImport, reactRuntimeImport];
const reactImports = [
  { specifier: "react", package: "@types/react", typeOnly: true },
  reactRuntimeImport,
];
const ownerPackages = new Map([
  [
    "src/features/account/Account.tsx",
    [
      { specifier: "lucide-react", package: "lucide-react", typeOnly: false },
      { specifier: "next/navigation", package: "next", typeOnly: false },
      ...localizedFormImports,
    ],
  ],
  [
    "src/features/account/components/account-section/AccountSection.tsx",
    [{ specifier: "react", package: "@types/react", typeOnly: true }],
  ],
  [
    "src/features/account/components/email-form/EmailForm.tsx",
    localizedFormImports,
  ],
  [
    "src/features/account/components/password-form/PasswordForm.tsx",
    localizedFormImports,
  ],
  [
    "src/features/account/components/profile-form/ProfileForm.tsx",
    localizedFormImports,
  ],
  [
    "src/features/account/components/username-form/UsernameForm.tsx",
    localizedFormImports,
  ],
  [
    "src/features/auth/OtpForm.tsx",
    [
      { specifier: "next/link", package: "next", typeOnly: false },
      { specifier: "next/navigation", package: "next", typeOnly: false },
      ...localizedFormImports,
    ],
  ],
  [
    "src/features/login/Login.tsx",
    [
      { specifier: "lucide-react", package: "lucide-react", typeOnly: false },
      { specifier: "next/link", package: "next", typeOnly: false },
      { specifier: "next/navigation", package: "next", typeOnly: false },
      ...localizedFormImports,
    ],
  ],
  [
    "src/shared/hooks/use-operation-scope.ts",
    [{ specifier: "react", package: "@types/react", typeOnly: false }],
  ],
  [
    "src/components/ui/alert.tsx",
    [
      { specifier: "react", package: "@types/react", typeOnly: true },
      {
        specifier: "class-variance-authority",
        package: "class-variance-authority",
        typeOnly: true,
      },
      {
        specifier: "class-variance-authority",
        package: "class-variance-authority",
        typeOnly: false,
      },
    ],
  ],
  [
    "src/components/ui/button.tsx",
    [
      { specifier: "react", package: "@types/react", typeOnly: true },
      {
        specifier: "class-variance-authority",
        package: "class-variance-authority",
        typeOnly: true,
      },
      {
        specifier: "class-variance-authority",
        package: "class-variance-authority",
        typeOnly: false,
      },
      { specifier: "radix-ui", package: "radix-ui", typeOnly: false },
    ],
  ],
  [
    "src/components/ui/card.tsx",
    [{ specifier: "react", package: "@types/react", typeOnly: true }],
  ],
  [
    "src/components/ui/input.tsx",
    [{ specifier: "react", package: "@types/react", typeOnly: true }],
  ],
  [
    "src/components/ui/label.tsx",
    [
      { specifier: "react", package: "@types/react", typeOnly: true },
      { specifier: "radix-ui", package: "radix-ui", typeOnly: false },
    ],
  ],
  ["src/shared/ui/FormField.tsx", reactImports],
  [
    "src/shared/ui/Feedback.tsx",
    [
      { specifier: "next-intl", package: "next-intl", typeOnly: false },
      { specifier: "lucide-react", package: "lucide-react", typeOnly: false },
    ],
  ],
  [
    "src/features/auth/SessionProvider.tsx",
    [...reactImports, intlRuntimeImport],
  ],
  [
    "src/shared/hooks/use-cooldown.ts",
    [{ specifier: "react", package: "@types/react", typeOnly: false }],
  ],
  [
    "src/website/shared/Preferences.tsx",
    [
      { specifier: "lucide-react", package: "lucide-react", typeOnly: false },
      { specifier: "next-themes", package: "next-themes", typeOnly: false },
    ],
  ],
  [
    "src/app/providers/Providers.tsx",
    [
      { specifier: "react", package: "@types/react", typeOnly: true },
      { specifier: "next-themes", package: "next-themes", typeOnly: false },
      { specifier: "motion/react", package: "motion", typeOnly: false },
    ],
  ],
  [
    "src/website/home/Reveal.tsx",
    [
      { specifier: "react", package: "@types/react", typeOnly: true },
      { specifier: "motion/react", package: "motion", typeOnly: false },
      { specifier: "motion/react-m", package: "motion", typeOnly: false },
    ],
  ],
  [
    "src/shared/performance/WebVitals.tsx",
    [{ specifier: "next/web-vitals", package: "next", typeOnly: false }],
  ],
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
const packageImport = (specifier, packageName, typeOnly = false) => ({
  specifier,
  package: packageName,
  typeOnly,
});
const serverIntlImport = packageImport("next-intl/server", "next-intl");
const linkImport = packageImport("next/link", "next");
const iconsImport = packageImport("lucide-react", "lucide-react");
const nextTypesImport = packageImport("next", "next", true);
const reactTypesImport = packageImport("react", "@types/react", true);
for (const owner of [
  "src/app/(auth)/forgot-password/page.tsx",
  "src/app/(auth)/login/page.tsx",
  "src/app/(auth)/register/page.tsx",
  "src/i18n/request.ts",
])
  ownerPackages.set(owner, [serverIntlImport]);
ownerPackages.set("src/app/(auth)/layout.tsx", [
  serverIntlImport,
  intlRuntimeImport,
  reactTypesImport,
]);
ownerPackages.set("src/app/account/page.tsx", [
  serverIntlImport,
  intlRuntimeImport,
]);
ownerPackages.set("src/app/layout.tsx", [
  serverIntlImport,
  intlRuntimeImport,
  nextTypesImport,
  reactTypesImport,
]);
ownerPackages.set("src/app/page.tsx", [serverIntlImport, nextTypesImport]);
ownerPackages.set("src/app/error.tsx", [intlRuntimeImport]);
ownerPackages.set("src/app/not-found.tsx", [serverIntlImport, linkImport]);
ownerPackages.set("src/app/[...rest]/page.tsx", [
  packageImport("next/navigation", "next"),
]);
ownerPackages.set("src/app/social-image/route.tsx", [
  packageImport("next/og", "next"),
]);
for (const owner of ["src/app/robots.ts", "src/app/sitemap.ts"])
  ownerPackages.set(owner, [
    nextTypesImport,
    packageImport("next/server", "next"),
  ]);
ownerPackages.set("src/proxy.ts", [packageImport("next/server", "next")]);
ownerPackages.set("src/shared/security/nonce.ts", [
  packageImport("server-only", "server-only"),
  packageImport("next/headers", "next"),
]);
ownerPackages.set("src/shared/settings/server.ts", [
  packageImport("server-only", "server-only"),
  reactRuntimeImport,
  packageImport("next/server", "next"),
]);
for (const owner of [
  "src/website/home/Home.tsx",
  "src/website/layouts/Header.tsx",
])
  ownerPackages.set(owner, [serverIntlImport, linkImport, iconsImport]);
ownerPackages.set("src/website/layouts/Footer.tsx", [
  serverIntlImport,
  linkImport,
]);
ownerPackages.set("src/website/layouts/HeaderAccountLink.tsx", [
  linkImport,
  iconsImport,
]);
ownerPackages.set("src/website/layouts/AuthLayout.tsx", [
  reactTypesImport,
  intlRuntimeImport,
  iconsImport,
]);
const runtimePackages = [
  "class-variance-authority",
  "lucide-react",
  "motion",
  "next-themes",
  "radix-ui",
  "clsx",
  "next",
  "next-intl",
  "react",
  "react-dom",
  "server-only",
  "tailwind-merge",
].sort((left, right) => left.localeCompare(right));
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

const localSourceViolation = ({
  root,
  file,
  specifier,
  resolved,
  typeOnly,
}) => {
  const composition = path.resolve(root, "src/app");
  if (inside(composition, resolved) && !inside(composition, file))
    return "Shared and feature modules must not depend on route composition";
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

const packageSourceViolation = ({
  root,
  owner,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
}) => {
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
    inside(path.join(root, "node_modules", resolvedPackage), resolved)
    ? undefined
    : "Package imports require an exact owner, installed package and runtime/type-only permission";
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
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return packageSourceViolation({
      root,
      owner,
      specifier,
      resolved,
      typeOnly,
      resolvedPackage,
    });
  const relativeTarget =
    resolved && path.relative(root, resolved).replaceAll(path.sep, "/");
  if (relativeTarget === "src/app/globals.css")
    return owner === "src/app/layout.tsx" &&
      specifier === "./globals.css" &&
      !typeOnly
      ? undefined
      : "Only the root layout may import the declared global stylesheet";
  if (relativeTarget === "src/shared/fonts/manifest.json")
    return owner === "src/shared/fonts/preloads.ts" && !typeOnly
      ? undefined
      : "Only the font preload helper may load the published font manifest";
  if (!relativeTarget || !publishedProductionFiles.has(relativeTarget))
    return "Published imports must resolve only to published local production modules";

  return localSourceViolation({ root, file, specifier, resolved, typeOnly });
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
  const dependencies = Object.keys(manifest.dependencies ?? {}).sort(
    (left, right) => left.localeCompare(right),
  );
  if (
    JSON.stringify(dependencies) !== JSON.stringify(runtimePackages) ||
    Object.values(manifest.dependencies ?? {}).some(
      (version) =>
        typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version),
    )
  )
    violations.push(
      "This publication requires exactly its declared runtime packages",
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
          if (edge.specifier?.endsWith(".css")) {
            const stylesheet = path.join(root, "src/app/globals.css");
            const permission = boundaryViolation({
              root,
              file,
              specifier: edge.specifier,
              resolved: stylesheet,
              typeOnly: edge.typeOnly,
            });
            if (permission)
              return `${path.relative(root, file)}:${edge.line}: ${edge.specifier}: ${permission}`;
            const metadata = await lstat(stylesheet).catch(() => undefined);
            const target =
              metadata?.isFile() && !metadata.isSymbolicLink()
                ? await realpath(stylesheet)
                : undefined;
            const violation = boundaryViolation({
              root,
              file,
              specifier: edge.specifier,
              resolved: target,
              typeOnly: edge.typeOnly,
            });
            return violation
              ? `${path.relative(root, file)}:${edge.line}: ${edge.specifier}: ${violation}`
              : undefined;
          }
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

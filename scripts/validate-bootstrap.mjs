import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const policyPath = ".github/bootstrap-policy.json";
const coreFiles = [
  policyPath,
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const foundationFiles = [
  ".agents/validation.json",
  ".github/workflows/ci.yml",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "package.json",
  "package-lock.json",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "src/shared/contracts/index.ts",
  "src/shared/settings/contracts.ts",
  "src/features/account/types.ts",
  "src/features/login/types.ts",
  "src/features/recovery/types.ts",
  "src/features/register/types.ts",
  "src/shared/lib/form-values.ts",
  "src/shared/lib/form-values.test.ts",
  "src/shared/api/origin.ts",
  "src/i18n/catalog-data/locales.ts",
  "src/shared/settings/language.ts",
  "src/shared/settings/language.test.ts",
  "tsconfig.json",
];
const foundationSource = new Set([
  "src/shared/contracts/index.ts",
  "src/shared/settings/contracts.ts",
  "src/features/account/types.ts",
  "src/features/login/types.ts",
  "src/features/recovery/types.ts",
  "src/features/register/types.ts",
  "src/shared/lib/form-values.ts",
  "src/shared/lib/form-values.test.ts",
  "src/shared/api/origin.ts",
  "src/i18n/catalog-data/locales.ts",
  "src/shared/settings/language.ts",
  "src/shared/settings/language.test.ts",
]);
const localizationFiles = [
  "docs/localization.md",
  "docs/localization.fa.md",
  "src/i18n/catalogs.ts",
  "src/i18n/catalog-data/integrity.test.ts",
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
];
const localizationSource = new Set(
  localizationFiles.filter((file) => file.startsWith("src/")),
);
const serverBoundaryFiles = [
  "src/shared/api/proxy.ts",
  "src/shared/api/proxy.test.ts",
  "src/shared/security/csp.ts",
  "src/shared/security/csp.test.ts",
  "docs/server-boundary.md",
  "docs/server-boundary.fa.md",
];
const serverBoundarySource = new Set(
  serverBoundaryFiles.filter((file) => file.startsWith("src/")),
);
const isPublishedSource = (file, phase) =>
  foundationSource.has(file) ||
  (["localization", "server-boundary"].includes(phase) &&
    localizationSource.has(file)) ||
  (phase === "server-boundary" && serverBoundarySource.has(file));
const publicationScopes = {
  "server-boundary":
    "Published contracts, catalogs, API forwarding and pure CSP helpers; Next.js routes/UI, nonce integration, browser behavior and deployment are not published or validated.",
  governance:
    "Published governance files only; website runtime is not published or validated.",
  foundation:
    "Published wire contracts, input helpers and settings-language loading only; Next.js UI, routes, browser behavior and deployment are not published or validated.",
  localization:
    "Published contracts, input helpers, API-authoritative settings-language loading and complete local catalogs; Next.js UI, rendering, browser behavior and deployment are not published or validated.",
};

export const validateBootstrapPolicy = (policy) => {
  if (
    policy?.schemaVersion !== 1 ||
    !Object.hasOwn(publicationScopes, policy.phase) ||
    policy.applicationReady !== false ||
    policy.maximumChangedFiles !== 100 ||
    !Array.isArray(policy.allowedFiles) ||
    !policy.allowedFiles.length
  )
    throw new Error("An explicit non-runnable publication phase is required.");
  const files = new Set();
  for (const file of policy.allowedFiles) {
    if (
      typeof file !== "string" ||
      !file ||
      file.includes("\\") ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      /[*?[\]{}:\r\n]/.test(file) ||
      /^(?:drizzle|collection|deploy|node_modules|server|coverage)(?:\/|$)/.test(
        file,
      ) ||
      file === "drizzle.config.ts" ||
      (file.startsWith("src/") &&
        (policy.phase === "governance" ||
          !isPublishedSource(file, policy.phase))) ||
      (policy.phase === "governance" &&
        /^package(?:-lock)?\.json$/.test(file)) ||
      /(?:^|\/)(?:\.env(?:\.|$)|settings\.local\.json$)/.test(file) ||
      /\.(?:pem|key|pfx|p12|sqlite|db)$/.test(file) ||
      files.has(file)
    )
      throw new Error(
        "Publication files must be unique, exact paths within their declared phase.",
      );
    files.add(file);
  }
  const requiredFiles = [
    ...coreFiles,
    ...(policy.phase === "governance"
      ? [".github/workflows/bootstrap.yml"]
      : foundationFiles),
    ...(["localization", "server-boundary"].includes(policy.phase)
      ? localizationFiles
      : []),
    ...(policy.phase === "server-boundary" ? serverBoundaryFiles : []),
  ];
  if (requiredFiles.some((file) => !files.has(file)))
    throw new Error(
      "The bootstrap policy cannot omit its mandatory guard files.",
    );
  return files;
};

export const inspectBootstrap = async (root) => {
  if (
    (await lstat(path.join(root, ".github"))).isSymbolicLink() ||
    (await lstat(path.join(root, policyPath))).isSymbolicLink()
  )
    throw new Error("Bootstrap snapshots must not contain symbolic links.");
  const policy = JSON.parse(
    await readFile(path.join(root, policyPath), "utf8"),
  );
  const allowed = validateBootstrapPolicy(policy);
  const directories = new Set(
    [...allowed].flatMap((file) => {
      const parts = file.split("/");
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );
  const found = new Set();
  const visit = async (directory) => {
    const entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === ".git") return;
        if (
          policy.phase !== "governance" &&
          ["node_modules", "coverage"].includes(relative)
        ) {
          if (entry.isSymbolicLink() || !entry.isDirectory())
            throw new Error(
              "Generated output must be an ordinary root directory.",
            );
          return;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            "Bootstrap snapshots must not contain symbolic links.",
          );
        if (entry.isDirectory() && directories.has(relative)) {
          await visit(relative);
        } else if (entry.isFile() && allowed.has(relative)) {
          found.add(relative);
        } else {
          throw new Error(`Unexpected bootstrap path: ${relative}`);
        }
      }),
    );
  };
  await visit("");
  if ([...allowed].some((file) => !found.has(file)))
    throw new Error(
      "The published bootstrap snapshot is missing declared files.",
    );

  await Promise.all(
    [...found].map(async (file) => {
      if (file.endsWith(".json"))
        JSON.parse(await readFile(path.join(root, file), "utf8"));
      if (file.endsWith(".md")) {
        const markdown = (
          await readFile(path.join(root, file), "utf8")
        ).replace(/```[\s\S]*?```/g, "");
        for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
          const link = match[1];
          if (/^(?:https?:|mailto:|#)/.test(link)) continue;
          const target = path
            .relative(
              root,
              path.resolve(
                path.dirname(path.join(root, file)),
                decodeURI(link.split("#")[0]),
              ),
            )
            .replaceAll(path.sep, "/");
          if (!allowed.has(target) && !directories.has(target))
            throw new Error(
              "Maintained document link is outside the declared snapshot: " +
                file,
            );
        }
      }
      if (file.endsWith(".mjs")) {
        const result = spawnSync(
          process.execPath,
          ["--check", path.join(root, file)],
          {
            cwd: root,
            encoding: "utf8",
            windowsHide: true,
          },
        );
        if (result.error || result.status !== 0)
          throw new Error(`Bootstrap JavaScript syntax is invalid: ${file}`);
      }
    }),
  );
  return {
    applicationReady: false,
    files: found.size,
    phase: policy.phase,
    scope: publicationScopes[policy.phase],
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await inspectBootstrap(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Bootstrap validation failed.",
    );
    process.exitCode = 1;
  }
}

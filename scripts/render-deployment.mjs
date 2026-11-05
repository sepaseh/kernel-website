import { randomUUID } from "node:crypto";
import { lstat, open, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";

import {
  ensureArtifactDirectory,
  readArtifactFile,
  runDeliveryCommand,
} from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

const hostPattern = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const releasePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const publicNames = new Set([
  "WEBSITE_HOST",
  "TLS_CERTIFICATE",
  "TLS_CERTIFICATE_KEY",
  "RELEASE_ID",
  "HTTPS_PORT",
]);

export function renderDeploymentTemplate(template, environment) {
  const values = { HTTPS_PORT: "443", ...environment };
  return template.replace(/\$\{([A-Z][A-Z0-9_]*)\}/g, (_, name) => {
    if (!publicNames.has(name))
      throw new Error(`Unknown public template field: ${name}.`);
    const value = values[name];
    if (typeof value !== "string" || !value)
      throw new Error(`${name} is required.`);
    if (name.endsWith("_HOST")) {
      if (
        !hostPattern.test(value) ||
        value
          .split(".")
          .some(
            (label) =>
              !label ||
              label.length > 63 ||
              label.startsWith("-") ||
              label.endsWith("-"),
          )
      ) {
        throw new Error(`${name} must be a bare DNS hostname.`);
      }
    } else if (name === "RELEASE_ID") {
      if (!releasePattern.test(value) || value.includes(".."))
        throw new Error("Invalid RELEASE_ID.");
    } else if (name === "HTTPS_PORT") {
      if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535)
        throw new Error("Invalid HTTPS_PORT.");
    } else if (
      !/^\/[A-Za-z0-9_./-]+$/.test(value) ||
      value.split("/").includes("..")
    ) {
      throw new Error(
        `${name} must be an absolute POSIX certificate path without spaces.`,
      );
    }
    return value;
  });
}

function validateLocalPath(value) {
  const root = path.parse(value).root;
  const hasControlCharacter = Array.from(value).some((character) => {
    const point = character.codePointAt(0);
    return point < 32 || point === 127;
  });
  if (
    !value.trim() ||
    hasControlCharacter ||
    value.includes("%") ||
    /^[\\/]{2}/.test(value) ||
    value.split(/[\\/]/).includes("..") ||
    value.slice(root.length).includes(":") ||
    (/^[A-Za-z]:/.test(value) && !path.isAbsolute(value)) ||
    (path.sep !== "\\" && value.includes("\\")) ||
    (path.sep === "\\" &&
      path.isAbsolute(value) &&
      !/^[A-Za-z]:[\\/]/.test(value))
  )
    throw new Error(
      "Renderer paths must be local files inside the owned repository.",
    );
}

async function outputEntry(filename) {
  try {
    const entry = await lstat(filename);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("Rendered output must be an unlinked regular file.");
    return entry;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  }
}

/** Publish through an owned handle; forced replacement never opens the target for writing. */
export async function writeRenderedConfiguration(output, rendered, force) {
  await ensureArtifactDirectory(path.dirname(output));
  if (!force) {
    const handle = await open(output, "wx");
    try {
      await handle.writeFile(rendered);
    } finally {
      await handle.close();
    }
    return;
  }

  const existing = await outputEntry(output);
  const staged = path.join(
    path.dirname(output),
    `.kernel-render-${randomUUID()}.partial`,
  );
  const handle = await open(staged, "wx");
  let published = false;
  try {
    try {
      await handle.writeFile(rendered);
      if (existing) await handle.chmod(existing.mode & 0o7777);
    } finally {
      await handle.close();
    }
    const current = await outputEntry(output);
    if (current?.dev !== existing?.dev || current?.ino !== existing?.ino)
      throw new Error("Rendered output was replaced before publication.");
    await rename(staged, output);
    published = true;
  } finally {
    if (!published) await rm(staged, { force: true });
  }
}

await runDeliveryCommand(import.meta.main, repository, async () => {
  const { values } = parseArgs({
    options: {
      template: { type: "string" },
      "public-values-file": { type: "string" },
      output: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  if (!values.template || !values["public-values-file"] || !values.output)
    throw new Error(
      "Use --template PATH --public-values-file PATH --output PATH [--force].",
    );
  for (const value of [
    values.template,
    values["public-values-file"],
    values.output,
  ])
    validateLocalPath(value);
  const root = path.resolve(repository);
  const templateRelative = path.relative(
    root,
    path.resolve(root, values.template),
  );
  const publicValuesRelative = path.relative(
    root,
    path.resolve(root, values["public-values-file"]),
  );
  const outputRelative = path.relative(root, path.resolve(root, values.output));
  if (
    [templateRelative, publicValuesRelative, outputRelative].some(
      (relative) =>
        !relative ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative),
    )
  )
    throw new Error("Renderer paths must stay inside the owned repository.");
  const templatePath = path.resolve(root, templateRelative);
  const publicValuesPath = path.resolve(root, publicValuesRelative);
  const output = path.resolve(root, outputRelative);
  const rootPrefix = `${root}${path.sep}`;
  if (
    !templatePath.startsWith(rootPrefix) ||
    !publicValuesPath.startsWith(rootPrefix) ||
    !output.startsWith(rootPrefix)
  )
    throw new Error("Renderer paths must stay inside the owned repository.");
  const [template, publicValues] = await Promise.all([
    readArtifactFile(templatePath),
    readArtifactFile(publicValuesPath),
  ]);
  const rendered = renderDeploymentTemplate(
    template.toString("utf8"),
    parseEnv(publicValues.toString("utf8")),
  );
  await writeRenderedConfiguration(output, rendered, values.force);
  console.info("Deployment configuration rendered.");
});

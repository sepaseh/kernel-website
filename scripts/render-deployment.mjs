import { lstat, writeFile } from "node:fs/promises";
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
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
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
  const [template, publicValues] = await Promise.all([
    readArtifactFile(path.resolve(values.template)),
    readArtifactFile(path.resolve(values["public-values-file"])),
  ]);
  const rendered = renderDeploymentTemplate(
    template.toString("utf8"),
    parseEnv(publicValues.toString("utf8")),
  );
  const output = path.resolve(values.output);
  await ensureArtifactDirectory(path.dirname(output));
  try {
    const entry = await lstat(output);
    if (entry.isSymbolicLink() || !entry.isFile())
      throw new Error("Rendered output must be an unlinked regular file.");
  } catch (error_) {
    if (error_.code !== "ENOENT") throw error_;
  }
  await writeFile(output, rendered, { flag: values.force ? "w" : "wx" });
  console.info("Deployment configuration rendered.");
});

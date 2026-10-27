import { fileURLToPath } from "node:url";

import { runDeliveryCommand } from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));

const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const requireValue = (environment, name) => {
  const value = environment[name];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required.`);
  return value;
};

export const validateOrigin = (value, publicOrigin = true) => {
  if (/[\\\s;"'{}<>`]/.test(value))
    throw new Error("Origin contains invalid characters.");
  const url = new URL(value);
  const canonical = value
    .replace(/^(https:\/\/[^/]+):443$/, "$1")
    .replace(/^(http:\/\/[^/]+):80$/, "$1");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    canonical !== url.origin ||
    (publicOrigin && url.protocol !== "https:" && !loopback.has(url.hostname))
  ) {
    throw new Error(
      "An exact HTTPS origin is required (HTTP only on loopback).",
    );
  }
  return url;
};

const validateWebsiteSeo = (environment) => {
  const flag = environment.WEBSITE_INDEXING_ENABLED ?? "false";
  if (flag !== "true" && flag !== "false")
    throw new Error("WEBSITE_INDEXING_ENABLED must be true or false.");
  const value = environment.WEBSITE_URL;
  if (value === undefined || value === "") {
    if (flag === "true")
      throw new Error(
        "WEBSITE_URL is required when website indexing is enabled.",
      );
    return;
  }
  if (
    !/^https?:\/\/[^/?#\\]+\/?$/i.test(value) ||
    /\s/.test(value) ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x20 || code === 0x7f;
    })
  )
    throw new Error("WEBSITE_URL must be an exact HTTP(S) origin.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("WEBSITE_URL must be an exact HTTP(S) origin.");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const local =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    /^127(?:\.\d{1,3}){3}$/.test(host) ||
    host === "[::1]" ||
    /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(host);
  if (
    (url.protocol === "http:" && (!local || flag === "true")) ||
    (flag === "true" && local)
  )
    throw new Error("Website indexing requires a public HTTPS WEBSITE_URL.");
};

export function validateDeploymentEnv(mode, environment = process.env) {
  if (environment.NODE_ENV !== "production") {
    throw new Error("NODE_ENV must be production for deployment.");
  }
  if (mode === "website") {
    validateOrigin(requireValue(environment, "API_BASE_URL"), false);
    validateWebsiteSeo(environment);
    if (
      !["report-only", "enforce"].includes(
        environment.WEBSITE_CSP_MODE ?? "report-only",
      )
    )
      throw new Error("WEBSITE_CSP_MODE must be report-only or enforce.");
    return;
  }

  throw new Error("This repository deploys only the website.");
}

await runDeliveryCommand(import.meta.main, repository, async () => {
  if (process.argv.length !== 3) throw new Error("Supply website.");
  validateDeploymentEnv(process.argv[2]);
  console.info("Deployment configuration is valid.");
});

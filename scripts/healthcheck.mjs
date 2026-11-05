import { fileURLToPath } from "node:url";

import { runDeliveryCommand } from "./release-files.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
export async function checkHealth(mode, target) {
  if (mode !== "api" && mode !== "website")
    throw new Error("Health mode must be api or website.");
  if (typeof target !== "string" || !target)
    throw new Error("Health checks require an explicit HTTP(S) target.");
  const url = new URL(target);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password)
    throw new Error(
      "Health target must be an HTTP(S) URL without credentials.",
    );
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    headers: { Accept: mode === "api" ? "application/json" : "text/html" },
  });
  if (response.status !== 200) throw new Error("Service is not ready.");
  if (mode === "api") {
    let body;
    try {
      body = await response.json();
    } catch (error_) {
      throw new Error("API readiness response is invalid.", { cause: error_ });
    }
    if (body?.status !== "ok")
      throw new Error("API readiness response is invalid.");
  } else {
    const mediaType = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (
      mediaType !== "text/html" ||
      !(await response.text()).toLowerCase().includes("<html")
    )
      throw new Error("Website readiness response is invalid.");
  }
}
await runDeliveryCommand(import.meta.main, repository, async () => {
  if (process.argv.length !== 4)
    throw new Error("Supply api|website and an explicit HTTP(S) URL.");
  await checkHealth(process.argv[2], process.argv[3]);
});

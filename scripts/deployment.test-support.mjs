import assert from "node:assert/strict";
import {
  copyFile,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const commandEnvironment = () =>
  Object.fromEntries(
    ["SystemRoot", "WINDIR", "PATH", "Path"].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );

async function markedCliFixture(directory, ready = true) {
  await mkdir(path.join(directory, "scripts"));
  await mkdir(path.join(directory, ".github"));
  await writeFile(
    path.join(directory, ".github/bootstrap-policy.json"),
    JSON.stringify({ schemaVersion: 1, applicationReady: ready }),
  );
  await Promise.all(
    [
      "render-deployment.mjs",
      "validate-deployment-env.mjs",
      "healthcheck.mjs",
      "release-files.mjs",
    ].map((name) =>
      copyFile(
        new URL(`./${name}`, import.meta.url),
        path.join(directory, "scripts", name),
      ),
    ),
  );
}

async function temporaryFixture(context) {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await realpath(
    await mkdtemp(path.join(temporaryRoot, "kernel-render-fixture-")),
  );
  context.after(async () => {
    assert.equal(path.dirname(directory), temporaryRoot);
    assert.ok(path.basename(directory).startsWith("kernel-render-fixture-"));
    await rm(directory, {
      recursive: true,
      force: true,
    });
  });
  return directory;
}

const publicValues = {
  WEBSITE_HOST: "kernel.test",
  TLS_CERTIFICATE: "/etc/kernel/tls/fullchain.pem",
  TLS_CERTIFICATE_KEY: "/etc/kernel/tls/privkey.pem",
  RELEASE_ID: "qa-0123456789",
};

export { commandEnvironment, markedCliFixture, publicValues, temporaryFixture };

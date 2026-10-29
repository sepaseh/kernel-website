import assert from "node:assert/strict";
import { lstat, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const websiteSmokeBuilder = (project) => {
  assert.match(project, /^kernel-website-test-[a-f0-9]{12}$/);
  return `${project}-builder`;
};

const ownedImages = (project, images) => {
  websiteSmokeBuilder(project);
  assert.ok(Array.isArray(images), "Test images must be an explicit array.");
  for (const image of images)
    assert.match(
      image,
      new RegExp(`^${project}/(?:api|website|gateway):smoke-[a-f0-9]{12}$`),
    );
  return [...new Set(images)];
};

const inspectFixture = async (fixture, parent) => {
  assert.equal(typeof fixture, "string");
  assert.equal(typeof parent, "string");
  const directory = path.resolve(fixture);
  assert.equal(path.resolve(parent), path.resolve(tmpdir()));
  assert.equal(path.dirname(directory), path.resolve(parent));
  assert.ok(path.basename(directory).startsWith("kernel-website-docker-"));
  let stat;
  try {
    // Windows file identifiers can exceed Number's integer precision.
    stat = await lstat(directory, { bigint: true });
  } catch (error) {
    if (error.code === "ENOENT") return { directory };
    throw error;
  }
  assert.ok(
    stat.isDirectory() && !stat.isSymbolicLink(),
    "Test fixture must be an unlinked temporary directory.",
  );
  assert.equal(path.dirname(await realpath(directory)), await realpath(parent));
  return { directory, stat };
};

const removeFixture = async (fixture, parent, original) => {
  const current = await inspectFixture(fixture, parent);
  if (!current.stat) return;
  assert.ok(original.stat, "An absent test fixture cannot be claimed later.");
  assert.equal(current.stat.dev, original.stat.dev);
  assert.equal(current.stat.ino, original.stat.ino);
  await rm(current.directory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
};

const builderExists = async (docker, builder) => {
  try {
    await docker(["buildx", "inspect", builder], { capture: true });
    return true;
  } catch (error) {
    if (
      error.exitCode === 1 &&
      error.stderr?.trim() === `ERROR: no builder "${builder}" found`
    )
      return false;
    throw error;
  }
};

export async function assertWebsiteBuilderAvailable(docker, project) {
  assert.ok(
    !(await builderExists(docker, websiteSmokeBuilder(project))),
    "The generated Docker test builder already exists; refusing to reuse it.",
  );
}

export async function assertWebsiteResourcesAvailable(docker, project, images) {
  const imageNames = ownedImages(project, images);
  const selectors = [
    [
      "container",
      "ls",
      "--all",
      "--quiet",
      "--filter",
      `name=^/${project}-certificate$`,
    ],
    [
      "container",
      "ls",
      "--all",
      "--quiet",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ],
    [
      "network",
      "ls",
      "--quiet",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ],
    [
      "volume",
      "ls",
      "--quiet",
      "--filter",
      `label=com.docker.compose.project=${project}`,
    ],
    ...imageNames.map((image) => [
      "image",
      "ls",
      "--quiet",
      "--filter",
      `reference=${image}`,
    ]),
  ];
  await Promise.all(
    selectors.map(async (selector) => {
      const found = await docker(selector, { capture: true });
      assert.equal(
        found.trim(),
        "",
        "A generated Docker test resource already exists; refusing to reuse it.",
      );
    }),
  );
}

export async function cleanupWebsiteDocker({
  project,
  images,
  builderAttempted,
  docker,
  compose,
  fixture,
  parent,
}) {
  const builder = websiteSmokeBuilder(project);
  const imageNames = ownedImages(project, images);
  const originalFixture =
    fixture === undefined ? undefined : await inspectFixture(fixture, parent);
  const errors = [];
  const attempt = async (label, operation) => {
    try {
      await operation();
    } catch (cause) {
      errors.push(new Error(`Could not remove ${label}.`, { cause }));
    }
  };
  // The certificate helper is not a Compose service and may survive an
  // interrupted attached Docker CLI even though its normal run uses --rm.
  const certificate = `${project}-certificate`;
  if (imageNames.length)
    await attempt("the test certificate container", async () => {
      const found = await docker(
        [
          "container",
          "ls",
          "--all",
          "--quiet",
          "--filter",
          `name=^/${certificate}$`,
        ],
        { capture: true },
      );
      if (found.trim())
        await docker(["container", "rm", "--force", certificate]);
    });
  if (compose)
    await attempt("the test Compose resources", () =>
      compose(["down", "--volumes", "--remove-orphans"]),
    );
  if (builderAttempted)
    await attempt("the test builder and its build cache", async () => {
      if (await builderExists(docker, builder))
        await docker(["buildx", "rm", "--force", builder]);
    });
  await Promise.all(
    imageNames.map((image) =>
      attempt(`the test image ${image}`, async () => {
        const found = await docker(
          ["image", "ls", "--quiet", "--filter", `reference=${image}`],
          { capture: true },
        );
        if (found.trim()) await docker(["image", "rm", image]);
      }),
    ),
  );
  if (originalFixture)
    await attempt("the temporary test files", () =>
      removeFixture(fixture, parent, originalFixture),
    );
  if (errors.length)
    throw new AggregateError(errors, "Website Docker test cleanup failed.");
}

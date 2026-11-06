import assert from "node:assert/strict";
import fsPromises, {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertWebsiteBuilderAvailable,
  assertWebsiteResourcesAvailable,
  cleanupWebsiteDocker,
  websiteSmokeBuilder,
} from "./docker-smoke-cleanup.mjs";

const project = "kernel-website-test-123456abcdef";
const images = ["api", "website", "gateway"].map(
  (name) => `${project}/${name}:smoke-abcdef123456`,
);

async function fixture(context, failures = new Set()) {
  const parent = os.tmpdir();
  const directory = await mkdtemp(path.join(parent, "kernel-website-docker-"));
  context.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(parent));
    await rm(directory, { recursive: true, force: true });
  });
  const state = {
    builders: new Set([websiteSmokeBuilder(project)]),
    images: new Set(images),
    certificate: true,
    collisions: new Set(),
    calls: [],
  };
  const docker = async (args) => {
    state.calls.push(args);
    if (args[0] === "buildx" && args[1] === "inspect") {
      if (failures.has("inspect")) {
        const error = new Error("local engine unavailable");
        error.exitCode = 1;
        error.stderr = "ERROR: local engine unavailable";
        throw error;
      }
      if (state.builders.has(args.at(-1))) return `Name: ${args.at(-1)}`;
      const error = new Error("missing builder");
      error.exitCode = 1;
      error.stderr = `ERROR: no builder "${args.at(-1)}" found\n`;
      throw error;
    }
    if (args[0] === "buildx" && args[1] === "rm") {
      if (failures.has("builder")) throw new Error("builder removal failed");
      state.builders.delete(args.at(-1));
    } else if (args[0] === "container" && args[1] === "ls") {
      if (args.at(-1).startsWith("name="))
        return state.certificate ? "synthetic-container-id" : "";
      return state.collisions.has("container") ? "synthetic-compose-id" : "";
    } else if (args[0] === "container" && args[1] === "rm") {
      if (failures.has("certificate"))
        throw new Error("certificate removal failed");
      state.certificate = false;
    } else if (["network", "volume"].includes(args[0])) {
      return state.collisions.has(args[0]) ? "synthetic-resource-id" : "";
    } else if (args[0] === "image" && args[1] === "ls") {
      const reference = args.at(-1).slice("reference=".length);
      return state.images.has(reference) ? "synthetic-image-id" : "";
    } else if (args[0] === "image" && args[1] === "rm") {
      if (failures.has(args.at(-1))) throw new Error("image removal failed");
      state.images.delete(args.at(-1));
    }
    return "";
  };
  const options = {
    project,
    images,
    builderAttempted: true,
    docker,
    compose: async (args) => {
      state.calls.push(["compose", ...args]);
      if (failures.has("compose")) throw new Error("compose removal failed");
    },
    fixture: directory,
    parent,
  };
  return { state, options };
}

test("Docker cleanup removes only the owned project, builder/cache, images and TEMP files and is repeatable", async (context) => {
  const { state, options } = await fixture(context);
  await cleanupWebsiteDocker({ ...options, images: [...images, images[0]] });
  assert.equal(state.certificate, false);
  assert.equal(state.builders.size, 0);
  assert.equal(state.images.size, 0);
  await assert.rejects(access(options.fixture), { code: "ENOENT" });
  assert.ok(
    state.calls.some(
      (args) =>
        args.join(" ") === `buildx rm --force ${websiteSmokeBuilder(project)}`,
    ),
  );
  assert.ok(
    state.calls.some(
      (args) => args.join(" ") === "compose down --volumes --remove-orphans",
    ),
  );
  assert.equal(
    state.calls.some((args) => args.includes("prune")),
    false,
  );
  assert.equal(
    state.calls.some((args) => args[0] === "buildx" && args[1] === "ls"),
    false,
  );
  await cleanupWebsiteDocker(options);
  assert.equal(
    state.calls.filter((args) => args[0] === "image" && args[1] === "rm")
      .length,
    3,
  );
});

test("an engine inspection failure is not treated as an absent builder", async (context) => {
  const { state, options } = await fixture(context, new Set(["inspect"]));
  await assert.rejects(
    assertWebsiteBuilderAvailable(options.docker, project),
    /engine unavailable/,
  );
  await assert.rejects(cleanupWebsiteDocker(options), /cleanup failed/);
  assert.equal(state.builders.size, 1);
  assert.equal(state.images.size, 0);
  await assert.rejects(access(options.fixture), { code: "ENOENT" });
});

test("cleanup continues through Compose, builder and image errors and reports every failure", async (context) => {
  const { state, options } = await fixture(
    context,
    new Set(["compose", "builder", images[0]]),
  );
  await assert.rejects(cleanupWebsiteDocker(options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 3);
    return true;
  });
  assert.equal(state.certificate, false);
  assert.deepEqual([...state.images], [images[0]]);
  await assert.rejects(access(options.fixture), { code: "ENOENT" });
});

test("a preexisting builder cannot be claimed and cleanup rejects foreign resource names", async (context) => {
  const { state, options } = await fixture(context);
  await assert.rejects(
    assertWebsiteBuilderAvailable(options.docker, project),
    /already exists/,
  );
  assert.equal(
    state.calls.some((args) => args.includes("rm")),
    false,
  );
  await assert.rejects(
    cleanupWebsiteDocker({ ...options, images: ["production/api:latest"] }),
  );
  assert.equal(
    state.calls.some((args) => args.includes("rm")),
    false,
  );
  await access(options.fixture);
});

test("preflight refuses existing certificate containers or exact image tags before they can be claimed", async (context) => {
  const { state, options } = await fixture(context);
  await assert.rejects(
    assertWebsiteResourcesAvailable(options.docker, project, images),
    /already exists/,
  );
  state.certificate = false;
  await assert.rejects(
    assertWebsiteResourcesAvailable(options.docker, project, images),
    /already exists/,
  );
  state.images.clear();
  await assertWebsiteResourcesAvailable(options.docker, project, images);
  assert.equal(
    state.calls.some((args) => args.includes("rm")),
    false,
  );
});

test("preflight rejects every generated Compose resource collision without mutation", async (context) => {
  const { state, options } = await fixture(context);
  state.certificate = false;
  state.images.clear();
  for (const kind of ["container", "network", "volume"]) {
    state.collisions = new Set([kind]);
    await assert.rejects(
      assertWebsiteResourcesAvailable(options.docker, project, images),
      /already exists/,
    );
  }
  assert.equal(
    state.calls.some((args) => args.includes("rm")),
    false,
  );
});

test("resource preflight drains independent queries and preserves every failure", async () => {
  const failures = [
    Error("certificate query failed"),
    Error("network query failed"),
  ];
  const inspected = [];
  await assert.rejects(
    assertWebsiteResourcesAvailable(
      async (selector) => {
        inspected.push(selector);
        if (selector.at(-1).startsWith("name=")) throw failures[0];
        if (selector[0] === "network") throw failures[1];
        return "";
      },
      project,
      images,
    ),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.deepEqual(error.errors, failures);
      return true;
    },
  );
  assert.equal(inspected.length, 4 + images.length);
  assert.equal(
    inspected.some((selector) => selector.includes("rm")),
    false,
  );
});

test("invalid image and fixture ownership fails before any Docker callback", async (context) => {
  const { state, options } = await fixture(context);
  for (const invalid of [
    { images: ["foreign/website:latest"] },
    { images: "not-an-array" },
    { project: "kernel-website-test-nothex" },
    { fixture: path.dirname(options.fixture) },
    { fixture: path.join(options.fixture, "nested") },
    { fixture: path.join(os.tmpdir(), "foreign-directory") },
    { parent: options.fixture },
    { fixture: null },
  ])
    await assert.rejects(cleanupWebsiteDocker({ ...options, ...invalid }));
  assert.equal(state.calls.length, 0);
  await access(options.fixture);
});

test("cleanup preserves a linked fixture while still draining owned Docker resources", async (context) => {
  const { state, options } = await fixture(context);
  const target = await mkdtemp(
    path.join(os.tmpdir(), "kernel-website-docker-target-"),
  );
  context.after(async () => {
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    await rm(target, { recursive: true, force: true });
  });
  const marker = path.join(target, "owned-marker.txt");
  await writeFile(marker, "preserve target");
  await rm(options.fixture, { recursive: true });
  await symlink(target, options.fixture, "junction");
  await assert.rejects(cleanupWebsiteDocker(options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].cause.message, /unlinked temporary directory/);
    return true;
  });
  assert.equal(state.images.size, 0);
  assert.equal(state.builders.size, 0);
  assert.equal(state.certificate, false);
  assert.equal(
    state.calls.some((args) => args[0] === "compose"),
    false,
  );
  assert.ok(
    state.calls.some(
      (args) =>
        args[0] === "container" &&
        args.at(-1) === `label=com.docker.compose.project=${project}`,
    ),
  );
  assert.equal(await readFile(marker, "utf8"), "preserve target");
});

test("fixture inspection errors remain visible after independent Docker cleanup", async (context) => {
  const { state, options } = await fixture(context);
  const failure = Object.assign(Error("fixture inspection denied"), {
    code: "EACCES",
  });
  const original = fsPromises.lstat;
  const inspected = context.mock.method(
    fsPromises,
    "lstat",
    (filename, settings) =>
      filename === options.fixture
        ? Promise.reject(failure)
        : original(filename, settings),
  );
  syncBuiltinESMExports();
  try {
    await assert.rejects(cleanupWebsiteDocker(options), (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0].cause, failure);
      return true;
    });
  } finally {
    inspected.mock.restore();
    syncBuiltinESMExports();
  }
  assert.equal(state.builders.size, 0);
  assert.equal(state.images.size, 0);
  assert.equal(
    state.calls.some((args) => args[0] === "compose"),
    false,
  );
  await access(options.fixture);
});

test("fallback cleanup removes containers before draining independent network and volume work", async (context) => {
  const { options } = await fixture(context);
  await rm(options.fixture, { recursive: true });
  const containerStarted = Promise.withResolvers();
  const releaseContainer = Promise.withResolvers();
  const networkStarted = Promise.withResolvers();
  const releaseNetwork = Promise.withResolvers();
  const releaseVolume = Promise.withResolvers();
  let containersRemoved = false;
  let volumeStarted = false;
  let networkFinished = false;
  let volumeFinished = false;
  const operation = cleanupWebsiteDocker({
    ...options,
    images: [],
    builderAttempted: false,
    docker: async (args) => {
      if (args[0] === "container") {
        if (args[1] === "ls") return "a".repeat(12);
        containerStarted.resolve();
        await releaseContainer.promise;
        containersRemoved = true;
      } else if (args[0] === "network") {
        assert.equal(containersRemoved, true);
        networkStarted.resolve();
        await releaseNetwork.promise;
        networkFinished = true;
      } else if (args[0] === "volume") {
        assert.equal(containersRemoved, true);
        volumeStarted = true;
        await releaseVolume.promise;
        volumeFinished = true;
      }
      return "";
    },
    compose() {
      throw Error("An absent fixture must not be read through Compose.");
    },
  });
  const completedTooEarly = operation.then(() => {
    throw Error("Cleanup completed before the controlled resource transition.");
  });
  try {
    await Promise.race([containerStarted.promise, completedTooEarly]);
    assert.equal(volumeStarted, false);
    releaseContainer.resolve();
    await Promise.race([networkStarted.promise, completedTooEarly]);
    assert.equal(volumeStarted, true);
  } finally {
    releaseContainer.resolve();
    releaseNetwork.resolve();
    releaseVolume.resolve();
    await operation;
  }
  assert.equal(networkFinished, true);
  assert.equal(volumeFinished, true);
});

test("fallback cleanup still attempts networks and volumes after a container failure", async (context) => {
  const { options } = await fixture(context);
  await rm(options.fixture, { recursive: true });
  const failure = Error("owned container query failed");
  const calls = [];
  await assert.rejects(
    cleanupWebsiteDocker({
      ...options,
      images: [],
      builderAttempted: false,
      docker: async (args) => {
        calls.push(args[0]);
        if (args[0] === "container") throw failure;
        return "";
      },
      compose() {
        throw Error("An absent fixture must not be read through Compose.");
      },
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 1);
      assert.equal(error.errors[0].cause, failure);
      return true;
    },
  );
  assert.deepEqual(calls, ["container", "network", "volume"]);
});

test("fixture replacement during resource cleanup is preserved and reported", async (context) => {
  const { options } = await fixture(context);
  const saved = `${options.fixture}-original`;
  context.after(async () => {
    assert.equal(path.dirname(saved), path.resolve(os.tmpdir()));
    await rm(saved, { recursive: true, force: true });
  });
  options.compose = async () => {
    await rename(options.fixture, saved);
    await mkdir(options.fixture);
    await writeFile(
      path.join(options.fixture, "replacement.txt"),
      "do not claim replacement",
    );
  };
  await assert.rejects(cleanupWebsiteDocker(options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /temporary test files/);
    return true;
  });
  assert.equal(
    await readFile(path.join(options.fixture, "replacement.txt"), "utf8"),
    "do not claim replacement",
  );
  await access(saved);
});

test("an absent fixture cannot be claimed if another directory appears during cleanup", async (context) => {
  const { options } = await fixture(context);
  await rm(options.fixture, { recursive: true });
  const docker = options.docker;
  let appeared = false;
  options.docker = async (...args) => {
    if (!appeared) {
      appeared = true;
      await mkdir(options.fixture);
      await writeFile(
        path.join(options.fixture, "replacement.txt"),
        "new directory",
      );
    }
    return docker(...args);
  };
  await assert.rejects(cleanupWebsiteDocker(options), (error) => {
    assert.match(error.errors[0].cause.message, /cannot be claimed later/);
    return true;
  });
  assert.equal(
    await readFile(path.join(options.fixture, "replacement.txt"), "utf8"),
    "new directory",
  );
});

test("replacement identities that alias as Numbers preserve the replacement", async (context) => {
  const { options } = await fixture(context);
  const saved = `${options.fixture}-original`;
  context.after(async () => {
    assert.equal(path.dirname(saved), path.resolve(os.tmpdir()));
    await rm(saved, { recursive: true, force: true });
  });
  const originalIdentity = 2n ** 53n;
  const replacementIdentity = originalIdentity + 1n;
  assert.equal(Number(originalIdentity), Number(replacementIdentity));
  let replaced = false;
  const actualLstat = fsPromises.lstat;
  const inspected = context.mock.method(
    fsPromises,
    "lstat",
    async (file, statOptions) => {
      const stat = await actualLstat(file, statOptions);
      if (file !== options.fixture) return stat;
      const identity = replaced ? replacementIdentity : originalIdentity;
      return Object.assign(Object.create(stat), {
        ino: statOptions?.bigint ? identity : Number(identity),
      });
    },
  );
  syncBuiltinESMExports();
  options.compose = async () => {
    await rename(options.fixture, saved);
    await mkdir(options.fixture);
    await writeFile(
      path.join(options.fixture, "replacement.txt"),
      "preserve distinct identity",
    );
    replaced = true;
  };
  try {
    await assert.rejects(cleanupWebsiteDocker(options), (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors.length, 1);
      assert.match(error.errors[0].message, /temporary test files/);
      return true;
    });
    assert.equal(
      await readFile(path.join(options.fixture, "replacement.txt"), "utf8"),
      "preserve distinct identity",
    );
    await access(saved);
  } finally {
    inspected.mock.restore();
    syncBuiltinESMExports();
  }
});

test("all image removals and local cleanup finish after certificate or builder errors", async (context) => {
  const { state, options } = await fixture(
    context,
    new Set(["certificate", "builder", images[0], images[1]]),
  );
  await assert.rejects(cleanupWebsiteDocker(options), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.equal(error.errors.length, 4);
    return true;
  });
  assert.equal(state.certificate, true);
  assert.deepEqual([...state.images], images.slice(0, 2));
  await assert.rejects(access(options.fixture), { code: "ENOENT" });
});

test("empty partial startup cleanup needs no Docker callback", async (context) => {
  const { options } = await fixture(context);
  await cleanupWebsiteDocker({
    ...options,
    images: [],
    builderAttempted: false,
    docker: undefined,
    compose: undefined,
  });
  await assert.rejects(access(options.fixture), { code: "ENOENT" });
  await cleanupWebsiteDocker({ project, images: [], builderAttempted: false });
});

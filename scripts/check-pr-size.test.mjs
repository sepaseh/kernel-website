import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateFiles, inspectPullRequest } from "./check-pr-size.mjs";

const head = "a".repeat(40);
const base = "b".repeat(40);
const files = (count) =>
  Array.from({ length: count }, (_, index) => ({
    filename: `src/file-${index}.ts`,
    status: "added",
  }));
const pull = (changedFiles, overrides = {}) => ({
  base: { sha: base },
  changed_files: changedFiles,
  head: { sha: head },
  ...overrides,
});
const response = (data, link) =>
  new Response(JSON.stringify(data), {
    headers: link ? { link } : {},
    status: 200,
  });
const inspect = (fetchImpl, overrides = {}) =>
  inspectPullRequest({
    expectedHeadSha: head,
    fetchImpl,
    pullNumber: 1,
    repository: "example/api",
    ...overrides,
  });

test("accepts 99 and 100 changed files and rejects 101 without exclusions", () => {
  assert.equal(evaluateFiles(files(99), 99).changedFiles, 99);
  assert.equal(evaluateFiles(files(100), 100).changedFiles, 100);
  assert.throws(() => evaluateFiles(files(101), 101), /maximum is 100/);
});

test("counts removed, renamed and binary files as GitHub file entries", () => {
  const result = evaluateFiles(
    [
      { filename: "removed.ts", status: "removed" },
      {
        filename: "renamed.ts",
        previous_filename: "old.ts",
        status: "renamed",
      },
      { filename: "image.png", status: "modified" },
    ],
    3,
  );
  assert.equal(result.changedFiles, 3);
  assert.deepEqual(result.statusCounts, {
    modified: 1,
    removed: 1,
    renamed: 1,
  });
});

test("rejects duplicate, incomplete, malformed and unknown file results", () => {
  assert.throws(() => evaluateFiles(files(2), 3), /incomplete/);
  assert.throws(
    () => evaluateFiles([files(1)[0], files(1)[0]], 2),
    /duplicate/,
  );
  assert.throws(() => evaluateFiles(null, 0), /invalid/);
  for (const file of [
    {},
    { filename: "x", status: "invented" },
    { filename: "x", status: "renamed" },
  ])
    assert.throws(() => evaluateFiles([file], 1), /incomplete/);
});

test("reads exactly 100 files in one page and checks the same head and count afterward", async () => {
  const requests = [];
  const fixture = files(100);
  fixture[0] = {
    filename: "renamed.ts",
    previous_filename: "old.ts",
    status: "renamed",
  };
  fixture[1] = { filename: "image.png", status: "modified" };
  const result = await inspect(async (url, options) => {
    requests.push({ url, options });
    if (!url.includes("/files")) return response(pull(100));
    return response(fixture);
  });
  assert.equal(result.changedFiles, 100);
  assert.equal(result.statusCounts.renamed, 1);
  assert.equal(result.statusCounts.modified, 1);
  assert.equal(requests.length, 3);
  assert.equal(
    requests[1].url,
    "https://api.github.com/repos/example/api/pulls/1/files?per_page=100",
  );
  assert.equal(requests[1].options.redirect, "error");
});

test("rejects an unexpected next page without following any pagination target", async () => {
  const requests = [];
  const endpoint = "https://api.github.com/repos/example/api/pulls/1/files";
  await assert.rejects(
    inspect(async (url) => {
      requests.push(url);
      if (!url.includes("/files")) return response(pull(2));
      return response(
        files(1),
        [
          `<${endpoint}?page=1>; rel="first"`,
          `<${endpoint}?page=2>; rel="next"`,
          `<${endpoint}?page=3>; rel="last"`,
        ].join(", "),
      );
    }),
    /unexpected file pagination/,
  );
  assert.equal(requests.length, 2);
});

test("rejects incomplete results with long malformed or embedded pagination links", async () => {
  const validLink =
    '<https://api.github.com/repos/example/api/pulls/1/files?page=2>; rel="next"';
  for (const header of [
    "<".repeat(200_000),
    `unexpected-prefix${validLink}`,
    `${validLink}unexpected-suffix`,
  ]) {
    let requests = 0;
    await assert.rejects(
      inspect(async (url) => {
        requests++;
        if (!url.includes("/files")) return response(pull(2));
        if (url.includes("page=2")) return response(files(2).slice(1));
        return response(files(1), header);
      }),
      /incomplete/,
    );
    assert.equal(requests, 3);
  }
});

test("rejects ambiguous next-page links before requesting either target", async () => {
  let requests = 0;
  await assert.rejects(
    inspect(async (url) => {
      requests++;
      return url.includes("/files")
        ? response(
            files(1),
            '<https://api.github.com/repos/example/api/pulls/1/files?page=2>; rel="next", <https://api.github.com/repos/example/api/pulls/1/files?page=3>; rel="next"',
          )
        : response(pull(2));
    }),
    /ambiguous/,
  );
  assert.equal(requests, 2);
});

test("rejects 101 files before requesting the file list", async () => {
  const requests = [];
  await assert.rejects(
    inspect(async (url) => {
      requests.push(url);
      assert.equal(url.includes("/files"), false);
      return response(pull(101));
    }),
    /maximum is 100/,
  );
  assert.equal(requests.length, 1);
});

test("fails closed for incomplete results and changed head, base or count", async () => {
  await assert.rejects(
    inspect(async (url) =>
      response(url.includes("/files") ? files(1) : pull(2)),
    ),
    /incomplete/,
  );
  for (const field of ["head", "base"]) {
    let reads = 0;
    await assert.rejects(
      inspect(async (url) => {
        if (url.includes("/files")) return response(files(1));
        reads++;
        return response(
          pull(1, reads === 2 ? { [field]: { sha: "c".repeat(40) } } : {}),
        );
      }),
      /PR changed/,
    );
  }
  let reads = 0;
  await assert.rejects(
    inspect(async (url) => {
      if (url.includes("/files")) return response(files(1));
      reads++;
      return response(pull(reads === 2 ? 2 : 1));
    }),
    /PR changed/,
  );
});

test("never sends authorization to an off-host or off-endpoint pagination URL", async () => {
  for (const next of [
    "https://untrusted.example/files",
    "https://api.github.com/repos/other/api/pulls/1/files",
    "https://user:pass@api.github.com/repos/example/api/pulls/1/files",
  ]) {
    let requests = 0;
    await assert.rejects(
      inspect(
        async (url) => {
          requests++;
          return url.includes("/files")
            ? response(files(1), `<${next}>; rel="next"`)
            : response(pull(1));
        },
        { token: "synthetic-token" },
      ),
      /unexpected file pagination/,
    );
    assert.equal(requests, 2);
  }
});

test("rejects repeated pagination and invalid HTTP, file-page or metadata responses", async () => {
  await assert.rejects(
    inspect(async (url) =>
      url.includes("/files")
        ? response(files(1), `<${url}>; rel="next"`)
        : response(pull(1)),
    ),
    /unexpected file pagination/,
  );
  await assert.rejects(
    inspect(async (url) => response(url.includes("/files") ? {} : pull(1))),
    /invalid pull request file page/,
  );
  await assert.rejects(
    inspect(async () => new Response("unavailable", { status: 503 })),
    /HTTP 503/,
  );
  await assert.rejects(
    inspect(async () => response({})),
    /incomplete/,
  );
  await assert.rejects(
    inspect(async () => response(pull(1, { head: { sha: "c".repeat(40) } }))),
    /older PR head/,
  );
});

test("validates its target before making requests", async () => {
  let requests = 0;
  const fetchImpl = () => {
    requests++;
    throw new Error("No request should be made");
  };
  for (const options of [
    { repository: "../private/repo" },
    { repository: "../.." },
    { pullNumber: 0 },
    { expectedHeadSha: undefined },
    { apiUrl: "http://api.github.com" },
  ]) {
    await assert.rejects(
      inspect(fetchImpl, options),
      options.apiUrl ? /HTTPS/ : /required/,
    );
    assert.equal(requests, 0);
  }
});

test("CLI emits structured counts and escapes untrusted errors as one log line", async (context) => {
  const eventPath = path.join(tmpdir(), `website-pr-size-${randomUUID()}.json`);
  await writeFile(
    eventPath,
    JSON.stringify({ pull_request: { head: { sha: head }, number: 1 } }),
    { flag: "wx" },
  );
  context.after(() => unlink(eventPath));
  const cli = (preload) =>
    spawnSync(
      process.execPath,
      [
        "--import",
        `data:text/javascript,${encodeURIComponent(preload)}`,
        fileURLToPath(new URL("./check-pr-size.mjs", import.meta.url)),
      ],
      {
        encoding: "utf8",
        env: {
          GITHUB_API_URL: "https://api.github.com",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_REPOSITORY: "example/api",
        },
        windowsHide: true,
      },
    );

  const passed =
    cli(`globalThis.fetch = async (url) => new Response(JSON.stringify(
    url.includes('/files') ? ${JSON.stringify(files(3))} : ${JSON.stringify(pull(3))}
  ));`);
  assert.equal(passed.error, undefined);
  assert.equal(passed.status, 0);
  assert.equal(passed.stderr, "");
  assert.equal(passed.stdout.trim().split(/\r?\n/).length, 1);
  assert.deepEqual(JSON.parse(passed.stdout), {
    baseSha: base,
    changedFiles: 3,
    headSha: head,
    maximumChangedFiles: 100,
    message:
      "PR file limit passed; additions, deletions, renames and binary files all count.",
    status: "passed",
    statusCounts: { added: 3 },
  });

  const message =
    "Synthetic provider failure\r\n::error::forged\u001b[31m\u2028first\u2029second";
  const failed = cli(`globalThis.fetch = async () => {
    throw new Error(${JSON.stringify(message)});
  };`);
  assert.equal(failed.error, undefined);
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, "");
  assert.equal(failed.stderr.trim().split(/\r?\n/).length, 1);
  assert.equal(failed.stderr.includes("\u001b"), false);
  assert.equal(failed.stderr.includes("\u2028"), false);
  assert.equal(failed.stderr.includes("\u2029"), false);
  assert.deepEqual(JSON.parse(failed.stderr), {
    message:
      "Synthetic provider failure\r\n::error::forged\u001b[31m first second",
    status: "failed",
  });
});

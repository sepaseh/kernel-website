import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  approvalContext,
  decideApproval,
  runReviewPolicy,
} from "./review-policy.mjs";

const repository = "sepaseh/kernel-website";
const head = "a".repeat(40);
const source = "b".repeat(40);
const changed = "c".repeat(40);
const bot = { id: 136622811, login: "coderabbitai[bot]", type: "Bot" };
const actions = { id: 41898282, login: "github-actions[bot]", type: "Bot" };
const pull = () => ({
  id: 11,
  number: 1,
  state: "open",
  draft: false,
  head: { sha: head },
  base: { repo: { full_name: repository } },
});
const review = (extra = {}) => ({
  id: 1,
  user: bot,
  state: "APPROVED",
  commit_id: head,
  submitted_at: "2026-11-01T12:00:00Z",
  ...extra,
});
const check = (extra = {}) => ({
  id: 21,
  name: "CodeRabbit",
  app: { id: 347564 },
  head_sha: head,
  status: "completed",
  conclusion: "success",
  ...extra,
});
const response = (data, link = null, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  headers: { get: () => link },
});

function fixture(options = {}) {
  const posts = [];
  const reads = [];
  let pullReads = 0;
  const context = {
    repository,
    token: "synthetic-policy-token",
    eventName: "pull_request_target",
    event: { pull_request: { number: 1 } },
    runId: 99,
    workflowRef: `${repository}/.github/workflows/review-policy.yml@refs/heads/main`,
    workflowSha: source,
    ...options.context,
  };
  context.fetchImpl = async (url, init) => {
    assert.equal(init.redirect, "error");
    assert.equal(init.headers.Authorization, "Bearer synthetic-policy-token");
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.ok(new URL(url).pathname.startsWith(`/repos/${repository}`));
    const route =
      new URL(url).pathname.slice(`/repos/${repository}`.length) +
      new URL(url).search;
    reads.push(route);
    if (options.intercept) {
      const overridden = await options.intercept(route, init);
      if (overridden !== undefined) return overridden;
    }
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      posts.push({ route, ...body });
      return response({ creator: actions, ...body, ...options.status });
    }
    if (route === "")
      return response({
        full_name: repository,
        default_branch: "main",
        ...options.repo,
      });
    if (route === "/actions/runs/99")
      return response({
        id: 99,
        head_sha: source,
        repository: { full_name: repository },
        path: ".github/workflows/review-policy.yml",
        name: "CodeRabbit approval policy",
        event: context.eventName,
        ...options.own,
      });
    if (route === `/compare/${source}...main`)
      return response({
        status: "identical",
        merge_base_commit: { sha: source },
        ...options.comparison,
      });
    if (route === "/pulls/1") {
      pullReads++;
      return response(
        options.pullAt
          ? options.pullAt(pullReads)
          : { ...pull(), ...options.pull },
      );
    }
    if (route === "/pulls/1/reviews?per_page=100&page=1")
      return response(options.reviews ?? [review()]);
    if (route === `/commits/${head}/check-runs?filter=all&per_page=100&page=1`)
      return response(
        options.checks ?? { total_count: 1, check_runs: [check()] },
      );
    if (route === "/pulls?state=open&per_page=100&page=1")
      return response(options.open ?? [pull()]);
    if (route === "/actions/runs/55")
      return response({
        id: 55,
        workflow_id: 8,
        repository: { full_name: repository },
        path: ".github/workflows/review-signal.yml",
        name: "CodeRabbit review signal",
        event: "pull_request_review",
        status: "completed",
        head_sha: head,
        ...options.signal,
      });
    if (route === "/actions/workflows/review-signal.yml")
      return response({
        id: 8,
        path: ".github/workflows/review-signal.yml",
        ...options.signalWorkflow,
      });
    if (route === "/check-runs/21") return response(check(options.wakeCheck));
    if (route === `/commits/${head}/pulls?per_page=100&page=1`)
      return response(options.associated ?? [pull()]);
    throw new Error(`Unexpected synthetic route: ${route}`);
  };
  return { context, posts, reads };
}

test("approval requires the latest decisive, current-head bot review and its own provider check", () => {
  assert.equal(decideApproval(pull(), [review()], [check()]).state, "success");
  assert.equal(
    decideApproval(
      pull(),
      [review(), review({ id: 2, state: "COMMENTED" })],
      [check()],
    ).state,
    "success",
  );
  for (const [candidate, reviews, checks] of [
    [{ ...pull(), draft: true }, [review()], [check()]],
    [{ ...pull(), state: "closed" }, [review()], [check()]],
    [pull(), [], [check()]],
    [pull(), [review({ commit_id: changed })], [check()]],
    [pull(), [review({ state: "CHANGES_REQUESTED" })], [check()]],
    [pull(), [review({ state: "DISMISSED" })], [check()]],
    [pull(), [review({ state: "PENDING" })], [check()]],
    [
      pull(),
      [review({ user: { id: 7, login: "human", type: "User" } })],
      [check()],
    ],
    [pull(), [review()], []],
    [pull(), [review()], [check({ app: { id: 15368 } })]],
    [pull(), [review()], [check({ name: "Unrelated" })]],
    [pull(), [review()], [check({ head_sha: changed })]],
    [pull(), [review()], [check({ status: "in_progress" })]],
    [pull(), [review()], [check({ conclusion: "skipped" })]],
    [pull(), [review()], [check({ id: 0 })]],
  ])
    assert.equal(decideApproval(candidate, reviews, checks).state, "failure");
  const older = review({ id: 10 });
  const newer = review({
    id: 9,
    submitted_at: "2026-11-01T13:00:00Z",
    state: "CHANGES_REQUESTED",
  });
  assert.equal(
    decideApproval(pull(), [newer, older], [check()]).state,
    "failure",
  );
  assert.equal(
    decideApproval(
      pull(),
      [review(), review({ id: 2, state: "DISMISSED" })],
      [check()],
    ).state,
    "failure",
  );
  assert.equal(
    decideApproval(
      pull(),
      [review()],
      [check(), check({ id: 22, conclusion: "failure" })],
    ).state,
    "failure",
  );
});

test("malformed or mismatched bot evidence never establishes approval", () => {
  for (const extra of [
    { user: { ...bot, login: "lookalike" } },
    { user: { ...bot, type: "User" } },
    { id: 0 },
    { commit_id: "unknown" },
    { state: "unknown" },
    { submitted_at: null },
  ])
    assert.throws(
      () => decideApproval(pull(), [review(extra)], [check()]),
      /identity|evidence|time/,
    );
});

test("trusted PR verification publishes pending then an explicit current-head approval status", async () => {
  const f = fixture();
  const [outcome] = await runReviewPolicy(f.context);
  assert.equal(outcome.state, "success");
  assert.deepEqual(
    f.posts.map(({ context, state, route }) => [context, state, route]),
    [
      [approvalContext, "pending", `/statuses/${head}`],
      [approvalContext, "success", `/statuses/${head}`],
    ],
  );
  assert.equal(
    f.posts[1].target_url,
    `https://github.com/${repository}/actions/runs/99`,
  );
});

test("remote branch metadata stays encoded as a repository-local path component", async () => {
  const branch = "main/../../foreign?query#fragment";
  const comparison = `/compare/${source}...${encodeURIComponent(branch)}`;
  const f = fixture({
    repo: { default_branch: branch },
    context: {
      workflowRef: `${repository}/.github/workflows/review-policy.yml@refs/heads/${branch}`,
    },
    intercept: (route) =>
      route === comparison
        ? response({ status: "identical", merge_base_commit: { sha: source } })
        : undefined,
  });
  assert.equal((await runReviewPolicy(f.context))[0].state, "success");
  assert.ok(f.reads.includes(comparison));
});

test("wrong repository, workflow provenance or default-branch history cannot publish a status", async () => {
  for (const options of [
    { repo: { full_name: "foreign/repo" } },
    { repo: { default_branch: null } },
    { context: { runId: 0 } },
    { context: { workflowSha: "invalid" } },
    {
      context: {
        workflowRef: `${repository}/.github/workflows/review-policy.yml@refs/heads/untrusted`,
      },
    },
    { own: { id: 98 } },
    { own: { head_sha: "invalid" } },
    { own: { head_sha: changed } },
    { own: { repository: { full_name: "foreign/repo" } } },
    { own: { path: ".github/workflows/untrusted.yml" } },
    { own: { name: "Imitation" } },
    { own: { event: "push" } },
    { comparison: { status: "diverged" } },
    { comparison: { merge_base_commit: { sha: changed } } },
  ]) {
    const f = fixture(options);
    await assert.rejects(runReviewPolicy(f.context));
    assert.deepEqual(f.posts, []);
  }
});

test("invalid transport selection and event metadata fail before publication", async () => {
  for (const context of [
    { repository: "../repo" },
    { repository: "not-a-repository" },
    { token: "" },
    { apiUrl: "http://api.github.com" },
    { apiUrl: "https://foreign.test/" },
    { apiUrl: "https://api.github.com/foreign/" },
    { apiUrl: "https://secret@api.github.com" },
    { apiUrl: "https://api.github.com?foreign=1" },
    { apiUrl: "https://api.github.com/#fragment" },
  ])
    await assert.rejects(runReviewPolicy({ ...fixture().context, ...context }));
  for (const event of [{}, { pull_request: { number: 0 } }]) {
    const f = fixture({ context: { event } });
    await assert.rejects(runReviewPolicy(f.context), /event number/);
    assert.deepEqual(f.posts, []);
  }
  const unsupported = fixture({ context: { eventName: "push" } });
  await assert.rejects(runReviewPolicy(unsupported.context), /Unsupported/);
  const invalidFetch = fixture();
  invalidFetch.context.fetchImpl = null;
  await assert.rejects(runReviewPolicy(invalidFetch.context), /implementation/);
});

test("a real signal or provider completion only wakes verification; its payload cannot assert approval", async () => {
  for (const [eventName, event] of [
    [
      "workflow_run",
      {
        workflow_run: {
          id: 55,
          conclusion: "success",
          pull_requests: [{ number: 999 }],
        },
      },
    ],
    [
      "check_run",
      { check_run: { id: 21, conclusion: "success", app: { id: 347564 } } },
    ],
  ]) {
    const f = fixture({ context: { eventName, event }, reviews: [] });
    const [outcome] = await runReviewPolicy(f.context);
    assert.equal(outcome.number, 1);
    assert.equal(outcome.state, "failure");
    assert.ok(f.reads.includes(`/commits/${head}/pulls?per_page=100&page=1`));
  }
  const dispatched = fixture({
    context: {
      eventName: "workflow_dispatch",
      event: { inputs: { pull: 999 } },
    },
  });
  assert.equal((await runReviewPolicy(dispatched.context))[0].state, "success");
  const empty = fixture({
    context: { eventName: "workflow_dispatch", event: {} },
    open: [],
  });
  assert.deepEqual(await runReviewPolicy(empty.context), []);
  assert.deepEqual(empty.posts, []);
});

test("imitation wake-up runs, unrelated checks and malformed associated PRs are rejected", async () => {
  for (const options of [
    { signal: { id: 54 } },
    { signal: { repository: { full_name: "foreign/repo" } } },
    { signal: { workflow_id: 7 } },
    { signal: { path: ".github/workflows/foreign.yml" } },
    { signalWorkflow: { path: ".github/workflows/foreign.yml" } },
    { signalWorkflow: { id: 0 }, signal: { workflow_id: 0 } },
    { signal: { name: "Other" } },
    { signal: { event: "push" } },
    { signal: { status: "in_progress" } },
    { signal: { head_sha: "invalid" } },
  ]) {
    const f = fixture({
      ...options,
      context: {
        eventName: "workflow_run",
        event: { workflow_run: { id: 55 } },
      },
    });
    await assert.rejects(runReviewPolicy(f.context));
    assert.deepEqual(f.posts, []);
  }
  for (const wakeCheck of [
    { id: 22 },
    { app: { id: 15368 } },
    { name: "Other" },
    { status: "queued" },
    { head_sha: "invalid" },
  ]) {
    const f = fixture({
      wakeCheck,
      context: { eventName: "check_run", event: { check_run: { id: 21 } } },
    });
    await assert.rejects(runReviewPolicy(f.context));
  }
  for (const eventName of ["check_run", "workflow_run"]) {
    const f = fixture({ context: { eventName, event: {} } });
    await assert.rejects(runReviewPolicy(f.context), /identifier/);
  }
  const invalid = fixture({
    associated: [{ id: 2, number: 0 }],
    context: { eventName: "check_run", event: { check_run: { id: 21 } } },
  });
  await assert.rejects(runReviewPolicy(invalid.context), /PR number/);
});

test("head changes, readiness changes and multiple PRs sharing a head remain blocked", async () => {
  for (const options of [
    { pullAt: (n) => ({ ...pull(), head: { sha: n >= 2 ? changed : head } }) },
    { pullAt: (n) => ({ ...pull(), head: { sha: n >= 3 ? changed : head } }) },
    { pullAt: (n) => ({ ...pull(), draft: n >= 3 }) },
    { pullAt: (n) => ({ ...pull(), state: n >= 3 ? "closed" : "open" }) },
    { open: [pull(), { ...pull(), id: 12, number: 2 }] },
    { open: [] },
    { reviews: [] },
  ]) {
    const f = fixture(options);
    assert.equal((await runReviewPolicy(f.context))[0].state, "failure");
    assert.equal(f.posts.at(-1).state, "failure");
  }
});

test("incomplete API evidence and failed queries fail closed after pending publication", async () => {
  for (const options of [
    { reviews: {} },
    { reviews: [{ id: 0 }] },
    { reviews: Array.from({ length: 101 }, (_, id) => review({ id: id + 1 })) },
    { reviews: [review(), review()] },
    { checks: { total_count: 2, check_runs: [check()] } },
    { checks: { total_count: -1, check_runs: [] } },
    { checks: { total_count: 1, check_runs: null } },
    { reviews: [review({ submitted_at: "invalid" })] },
    {
      intercept: (route) =>
        route.includes("/reviews?") ? response({}, null, 403) : undefined,
    },
    {
      intercept: (route) => {
        if (route.includes("/reviews?"))
          throw new Error("synthetic transport failure");
      },
    },
  ]) {
    const f = fixture(options);
    assert.equal((await runReviewPolicy(f.context))[0].state, "failure");
    assert.deepEqual(
      f.posts.map((post) => post.state),
      ["pending", "failure"],
    );
  }
  for (const candidate of [
    { ...pull(), number: 2 },
    { ...pull(), head: { sha: "invalid" } },
    { ...pull(), base: { repo: { full_name: "foreign/repo" } } },
    { ...pull(), draft: "false" },
    { ...pull(), state: "unknown" },
  ]) {
    const f = fixture({ pull: candidate });
    await assert.rejects(runReviewPolicy(f.context), /metadata/);
    assert.deepEqual(f.posts, []);
  }
});

test("every review and check page is inspected using only validated API pagination", async () => {
  const humans = Array.from({ length: 100 }, (_, index) =>
    review({ id: index + 1, user: { id: 7 } }),
  );
  const otherChecks = Array.from({ length: 100 }, (_, index) =>
    check({ id: index + 100, name: "Other" }),
  );
  const f = fixture({
    intercept: (route) => {
      const reviewRoute = "/pulls/1/reviews?per_page=100&page=";
      const checkRoute = `/commits/${head}/check-runs?filter=all&per_page=100&page=`;
      if (route === reviewRoute + "1")
        return response(
          humans,
          `<https://api.github.com/repos/${repository}${reviewRoute}2>; rel="next"`,
        );
      if (route === reviewRoute + "2") return response([review({ id: 201 })]);
      if (route === checkRoute + "1")
        return response(
          { total_count: 101, check_runs: otherChecks },
          `<https://api.github.com/repos/${repository}${checkRoute}2>; rel="next"`,
        );
      if (route === checkRoute + "2")
        return response({ total_count: 101, check_runs: [check()] });
    },
  });
  assert.equal((await runReviewPolicy(f.context))[0].state, "success");
  for (const link of [
    `<https://foreign.test/reviews?page=2>; rel="next"`,
    `<https://api.github.com/repos/${repository}/pulls/1/reviews?per_page=100&page=2>; rel="next", <https://foreign.test/>; rel="next"`,
  ]) {
    const bad = fixture({
      intercept: (route) =>
        route.includes("/reviews?") ? response(humans, link) : undefined,
    });
    assert.equal((await runReviewPolicy(bad.context))[0].state, "failure");
    assert.ok(bad.reads.every((route) => !route.includes("foreign.test")));
  }
  const inconsistent = fixture({
    intercept: (route) =>
      route.includes("/reviews?")
        ? response([review()], `<https://foreign.test/>; rel="next"`)
        : undefined,
  });
  assert.equal(
    (await runReviewPolicy(inconsistent.context))[0].state,
    "failure",
  );
  const changedCount = fixture({
    intercept: (route) => {
      const base = `/commits/${head}/check-runs?filter=all&per_page=100&page=`;
      if (route === base + "1")
        return response(
          { total_count: 101, check_runs: otherChecks },
          `<https://api.github.com/repos/${repository}${base}2>; rel="next"`,
        );
      if (route === base + "2")
        return response({ total_count: 102, check_runs: [check()] });
    },
  });
  assert.equal(
    (await runReviewPolicy(changedCount.context))[0].state,
    "failure",
  );
});

test("the emitted status must come from the verified GitHub Actions identity and exact context", async () => {
  for (const status of [
    { creator: { ...actions, id: 1 } },
    { creator: { ...actions, login: "imitation" } },
    { creator: { ...actions, type: "User" } },
    { context: "Other" },
    { state: "success" },
  ]) {
    const f = fixture({ status });
    await assert.rejects(runReviewPolicy(f.context), /Actions source/);
  }
});

test("policy imports are inert and an unconfigured CLI cannot contact GitHub", () => {
  const target = new URL("review-policy.mjs", import.meta.url);
  const env = process.env.SystemRoot
    ? { SystemRoot: process.env.SystemRoot }
    : {};
  const imported = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "globalThis.fetch=()=>{throw Error('network during import')};await import(process.argv[1]);",
      target.href,
    ],
    { env, encoding: "utf8", windowsHide: true },
  );
  assert.ifError(imported.error);
  assert.equal(imported.status, 0, imported.stderr);
  const cli = spawnSync(process.execPath, [fileURLToPath(target)], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(cli.error);
  assert.equal(cli.status, 1);
});

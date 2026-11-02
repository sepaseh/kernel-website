import { readFile } from "node:fs/promises";

export const approvalContext = "CodeRabbit approval";
const providerApp = 347564;
const reviewBot = { id: 136622811, login: "coderabbitai[bot]", type: "Bot" };
const actionsBot = { id: 41898282, login: "github-actions[bot]", type: "Bot" };
const sha = (value) =>
  typeof value === "string" && /^[a-f\d]{40}$/i.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const identity = (actual, expected) =>
  actual?.id === expected.id &&
  actual.login === expected.login &&
  actual.type === expected.type;
const blocked = (description) => ({ state: "failure", description });

function pullMetadata(pull, repository, number) {
  if (
    !positive(pull?.number) ||
    pull.number !== number ||
    !sha(pull.head?.sha) ||
    pull.base?.repo?.full_name !== repository ||
    !["open", "closed"].includes(pull.state) ||
    typeof pull.draft !== "boolean"
  )
    throw new Error("GitHub returned incomplete or foreign PR metadata.");
  return pull;
}

export function decideApproval(pull, reviews, checks) {
  if (pull.state !== "open" || pull.draft)
    return blocked("An open, ready pull request is required.");
  const decisive = [];
  for (const review of reviews) {
    if (review?.user?.id !== reviewBot.id) continue;
    if (!identity(review.user, reviewBot))
      throw new Error("The review bot identity did not match.");
    if (
      !positive(review.id) ||
      !sha(review.commit_id) ||
      ![
        "APPROVED",
        "CHANGES_REQUESTED",
        "DISMISSED",
        "COMMENTED",
        "PENDING",
      ].includes(review.state)
    )
      throw new Error("GitHub returned incomplete bot review evidence.");
    if (["COMMENTED", "PENDING"].includes(review.state)) continue;
    const time = Date.parse(review.submitted_at);
    if (!Number.isFinite(time))
      throw new Error("GitHub returned an invalid review submission time.");
    decisive.push({ ...review, time });
  }
  decisive.sort((a, b) => b.time - a.time || b.id - a.id);
  const latest = decisive[0];
  if (latest?.state !== "APPROVED" || latest.commit_id !== pull.head.sha)
    return blocked("CodeRabbit has not approved this exact PR head.");
  const provider = checks
    .filter(
      (check) => check.name === "CodeRabbit" && check.app?.id === providerApp,
    )
    .sort((a, b) => b.id - a.id)[0];
  if (
    !positive(provider?.id) ||
    provider.head_sha !== pull.head.sha ||
    provider.status !== "completed" ||
    provider.conclusion !== "success"
  )
    return blocked("The exact-head CodeRabbit provider check must pass.");
  return {
    state: "success",
    description:
      "CodeRabbit approved this exact head and its provider check passed.",
  };
}

function githubAddress(repository, route) {
  const prefix = `/repos/${repository.split("/").map(encodeURIComponent).join("/")}`;
  const address = new URL("https://api.github.com");
  const query = route.indexOf("?");
  const pathname = query < 0 ? route : route.slice(0, query);
  address.pathname = prefix + (pathname ? "/" + pathname : "");
  address.search = query < 0 ? "" : route.slice(query + 1);
  // Set path/query on a fixed origin, then reject normalization outside the
  // selected repository. Remote branch names can never select a new host/repo.
  if (address.pathname !== prefix && !address.pathname.startsWith(prefix + "/"))
    throw new Error(
      "Approval requests must remain in the selected repository.",
    );
  return address.href;
}

function collectPolicyRows(result, field, state) {
  const rows = field ? result.data?.[field] : result.data;
  if (!Array.isArray(rows) || rows.length > 100)
    throw new Error("GitHub returned an invalid policy page.");
  if (field) updateCheckCount(result.data.total_count, state);
  rows.forEach((row) => {
    const id = row?.id ?? row?.number;
    if (!positive(id) || state.ids.has(id))
      throw new Error("GitHub returned incomplete or repeated policy entries.");
    state.ids.add(id);
    state.collected.push(row);
  });
  return rows;
}

function updateCheckCount(total, state) {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("GitHub returned an invalid check count.");
  if (state.total !== undefined && state.total !== total)
    throw new Error("GitHub checks changed during pagination.");
  state.total = total;
}

function hasNextPolicyPage(result, rows, expectedUrl) {
  const links = result.link?.split(",").map((part) => part.trim());
  if (
    links?.some(
      (part) => !/^<[^<>]+>;\s*rel="(?:next|prev|first|last)"$/.test(part),
    )
  )
    throw new Error("GitHub returned malformed policy pagination.");
  const next = links?.filter((part) => /;\s*rel="next"$/.test(part));
  if (!next?.length) return false;
  if (next.length !== 1 || rows.length !== 100)
    throw new Error("GitHub returned inconsistent policy pagination.");
  if (next[0] !== `<${expectedUrl}>; rel="next"`)
    throw new Error("GitHub returned an untrusted pagination target.");
  return true;
}

function githubClient(repository, token, apiUrl, fetchImpl) {
  if (
    typeof repository !== "string" ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    repository.split("/").some((part) => [".", ".."].includes(part)) ||
    typeof token !== "string" ||
    !token ||
    typeof fetchImpl !== "function"
  )
    throw new Error(
      "An exact repository, token and HTTP implementation are required.",
    );
  if (!["https://api.github.com", "https://api.github.com/"].includes(apiUrl))
    throw new Error("Approval tokens must remain on the canonical GitHub API.");
  const request = async (route, body) => {
    const response = await fetchImpl(githubAddress(repository, route), {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new Error(`GitHub policy query failed (HTTP ${response.status}).`);
    return { data: await response.json(), link: response.headers.get("link") };
  };
  const pages = (route, field) => {
    const separator = route.includes("?") ? "&" : "?";
    const pagedRoute = (page) =>
      `${route}${separator}per_page=100&page=${page}`;
    const state = { collected: [], ids: new Set(), total: undefined };
    // Each page depends on the preceding API response. Recursion keeps that
    // dependency explicit and never follows a server-supplied URL.
    const readPage = async (page) => {
      const result = await request(pagedRoute(page));
      const rows = collectPolicyRows(result, field, state);
      if (
        hasNextPolicyPage(
          result,
          rows,
          githubAddress(repository, pagedRoute(page + 1)),
        )
      )
        return readPage(page + 1);
      if (state.total !== undefined && state.total !== state.collected.length)
        throw new Error("GitHub returned incomplete check evidence.");
      return state.collected;
    };
    return readPage(1);
  };
  return { request, pages };
}

async function verifyWorkflowSource(client, context) {
  const { repository, runId, workflowRef, workflowSha, eventName } = context;
  const repo = (await client.request("")).data;
  if (
    repo.full_name !== repository ||
    typeof repo.default_branch !== "string" ||
    !repo.default_branch
  )
    throw new Error("GitHub returned invalid repository ownership.");
  if (
    !positive(runId) ||
    !sha(workflowSha) ||
    workflowRef !==
      `${repository}/.github/workflows/review-policy.yml@refs/heads/${repo.default_branch}`
  )
    throw new Error(
      "Approval policy must run from the trusted default-branch workflow.",
    );
  const own = (await client.request(`actions/runs/${runId}`)).data;
  if (
    own.id !== runId ||
    own.head_sha !== workflowSha ||
    own.repository?.full_name !== repository ||
    own.path !== ".github/workflows/review-policy.yml" ||
    own.name !== "CodeRabbit approval policy" ||
    own.event !== eventName
  )
    throw new Error("The approval workflow's own GitHub source did not match.");
  const comparison = (
    await client.request(
      `compare/${workflowSha}...${encodeURIComponent(repo.default_branch)}`,
    )
  ).data;
  if (
    !["ahead", "identical"].includes(comparison.status) ||
    comparison.merge_base_commit?.sha !== workflowSha
  )
    throw new Error(
      "Approval workflow source is not in default-branch history.",
    );
}

async function reviewSignalHead(client, repository, id) {
  const [run, definition] = await Promise.all([
    client.request(`actions/runs/${id}`),
    client.request("actions/workflows/review-signal.yml"),
  ]);
  const signal = run.data;
  const workflow = definition.data;
  if (
    signal.id !== id ||
    signal.repository?.full_name !== repository ||
    !positive(workflow.id) ||
    signal.workflow_id !== workflow.id ||
    workflow.path !== ".github/workflows/review-signal.yml" ||
    signal.path !== workflow.path ||
    signal.name !== "CodeRabbit review signal" ||
    signal.event !== "pull_request_review" ||
    signal.status !== "completed"
  )
    throw new Error("The real GitHub review signal did not match.");
  return signal.head_sha;
}

async function providerSignalHead(client, id) {
  const check = (await client.request(`check-runs/${id}`)).data;
  if (
    check.id !== id ||
    check.app?.id !== providerApp ||
    check.name !== "CodeRabbit" ||
    check.status !== "completed"
  )
    throw new Error("The real provider wake-up check did not match.");
  return check.head_sha;
}

async function associatedPullNumbers(client, context) {
  const { eventName, event, repository } = context;
  if (eventName === "pull_request_target") {
    const number = event.pull_request?.number;
    if (!positive(number)) throw new Error("A PR event number is required.");
    if (event.action !== "closed") return [number];

    const closed = pullMetadata(
      (await client.request(`pulls/${number}`)).data,
      repository,
      number,
    );
    const open = (await client.pages("pulls?state=open")).map((pull) =>
      pullMetadata(pull, repository, pull.number),
    );
    return [
      number,
      ...open
        .filter(
          (pull) => pull.state === "open" && pull.head.sha === closed.head.sha,
        )
        .map((pull) => pull.number),
    ];
  }
  if (eventName === "workflow_dispatch")
    return (await client.pages("pulls?state=open")).map((pull) => pull.number);
  if (!["workflow_run", "check_run"].includes(eventName))
    throw new Error("Unsupported approval-policy event.");
  const id = event[eventName]?.id;
  if (!positive(id))
    throw new Error("A GitHub wake-up identifier is required.");
  const head =
    eventName === "workflow_run"
      ? await reviewSignalHead(client, repository, id)
      : await providerSignalHead(client, id);
  if (!sha(head)) throw new Error("The wake-up source has no valid commit.");
  return (await client.pages(`commits/${head}/pulls`)).map(
    (pull) => pull.number,
  );
}

async function publishApproval(client, context, head, decision) {
  const status = (
    await client.request(`statuses/${head}`, {
      context: approvalContext,
      ...decision,
      target_url: `https://github.com/${context.repository}/actions/runs/${context.runId}`,
    })
  ).data;
  if (
    !identity(status.creator, actionsBot) ||
    status.context !== approvalContext ||
    status.state !== decision.state
  )
    throw new Error(
      "The emitted approval status did not have the expected Actions source.",
    );
}

async function assessPull(client, repository, initial) {
  const pullRoute = `pulls/${initial.number}`;
  try {
    const [reviews, checks, open] = await Promise.all([
      client.pages(`${pullRoute}/reviews`),
      client.pages(
        `commits/${initial.head.sha}/check-runs?filter=all`,
        "check_runs",
      ),
      client.pages("pulls?state=open"),
    ]);
    const examined = pullMetadata(
      (await client.request(pullRoute)).data,
      repository,
      initial.number,
    );
    let decision =
      examined.head.sha !== initial.head.sha
        ? blocked("The PR head changed; verification must run again.")
        : decideApproval(examined, reviews, checks);
    const openPulls = open.map((pull) =>
      pullMetadata(pull, repository, pull.number),
    );
    if (
      openPulls.filter(
        (pull) => pull.state === "open" && pull.head.sha === examined.head.sha,
      ).length !== 1
    )
      decision = blocked(
        "Approval status requires one unambiguous open PR for this head.",
      );
    return {
      examined,
      decision,
      evidence: JSON.stringify({ checks, open, reviews }),
    };
  } catch {
    return {
      examined: initial,
      decision: blocked(
        "Complete live review evidence is unavailable; verification failed closed.",
      ),
    };
  }
}

async function verifyPull(client, context, number) {
  if (!positive(number))
    throw new Error("GitHub returned an invalid PR number.");
  const route = `pulls/${number}`;
  const initial = pullMetadata(
    (await client.request(route)).data,
    context.repository,
    number,
  );
  await publishApproval(client, context, initial.head.sha, {
    state: "pending",
    description: "Checking actual current-head CodeRabbit approval.",
  });
  const assessed = await assessPull(client, context.repository, initial);
  // Independent live reads catch dismissals and provider changes during the
  // first assessment. GitHub's read and status APIs are not one transaction.
  const confirmed = await assessPull(
    client,
    context.repository,
    assessed.examined,
  );
  const current = confirmed.examined;
  const { examined } = assessed;
  let decision = assessed.decision;
  if (
    current.head.sha !== examined.head.sha ||
    current.state !== examined.state ||
    current.draft !== examined.draft
  )
    decision = blocked(
      "The PR changed before status publication; run verification again.",
    );
  else if (
    assessed.decision.state === "success" &&
    (confirmed.decision.state !== "success" ||
      assessed.evidence !== confirmed.evidence)
  )
    decision = blocked(
      "Review evidence changed before publication; run verification again.",
    );
  await publishApproval(client, context, current.head.sha, decision);
  return { number, head: current.head.sha, ...decision };
}

export async function runReviewPolicy({
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
  ...context
}) {
  const client = githubClient(
    context.repository,
    context.token,
    apiUrl,
    fetchImpl,
  );
  await verifyWorkflowSource(client, context);
  const numbers = await associatedPullNumbers(client, context);
  // Commit statuses are shared by SHA: preserve serial publication even when
  // one wake-up identifies several PRs. Every PR gets fresh independent reads.
  return [...new Set(numbers)].reduce(
    (prior, number) =>
      prior.then(async (outcomes) => [
        ...outcomes,
        await verifyPull(client, context, number),
      ]),
    Promise.resolve([]),
  );
}
if (import.meta.main) {
  try {
    const outcomes = await runReviewPolicy({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
      eventName: process.env.GITHUB_EVENT_NAME,
      event: JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8")),
      runId: Number(process.env.GITHUB_RUN_ID),
      workflowRef: process.env.GITHUB_WORKFLOW_REF,
      workflowSha: process.env.GITHUB_WORKFLOW_SHA,
      apiUrl: process.env.GITHUB_API_URL,
    });
    console.log(JSON.stringify(outcomes));
    if (outcomes.some((outcome) => outcome.state !== "success"))
      process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Approval policy failed.",
    );
    process.exitCode = 1;
  }
}

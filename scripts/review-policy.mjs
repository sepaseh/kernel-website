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
  const api = new URL(apiUrl);
  if (api.href !== "https://api.github.com/")
    throw new Error("Approval tokens must remain on the canonical GitHub API.");
  const prefix = `repos/${repository.split("/").map(encodeURIComponent).join("/")}/`;
  const request = async (route, body) => {
    const response = await fetchImpl(
      new URL(
        route ? prefix + route : prefix.slice(0, -1),
        api.href.endsWith("/") ? api : api.href + "/",
      ).href,
      {
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    );
    if (!response.ok)
      throw new Error(`GitHub policy query failed (HTTP ${response.status}).`);
    return { data: await response.json(), link: response.headers.get("link") };
  };
  const pages = async (route, field) => {
    const collected = [];
    const ids = new Set();
    let page = 1;
    let total;
    while (true) {
      const separator = route.includes("?") ? "&" : "?";
      const result = await request(
        `${route}${separator}per_page=100&page=${page}`,
      );
      const rows = field ? result.data?.[field] : result.data;
      if (!Array.isArray(rows) || rows.length > 100)
        throw new Error("GitHub returned an invalid policy page.");
      if (field) {
        if (
          !Number.isSafeInteger(result.data.total_count) ||
          result.data.total_count < 0
        )
          throw new Error("GitHub returned an invalid check count.");
        if (total !== undefined && total !== result.data.total_count)
          throw new Error("GitHub checks changed during pagination.");
        total = result.data.total_count;
      }
      for (const row of rows) {
        const id = row?.id ?? row?.number;
        if (!positive(id) || ids.has(id))
          throw new Error(
            "GitHub returned incomplete or repeated policy entries.",
          );
        ids.add(id);
        collected.push(row);
      }
      const links = result.link?.split(",").map((part) => part.trim());
      if (
        links?.some(
          (part) => !/^<[^<>]+>;\s*rel="(?:next|prev|first|last)"$/.test(part),
        )
      )
        throw new Error("GitHub returned malformed policy pagination.");
      const next = links?.filter((part) => /;\s*rel="next"$/.test(part));
      if (!next?.length) break;
      if (next.length !== 1 || rows.length !== 100)
        throw new Error("GitHub returned inconsistent policy pagination.");
      const nextUrl = new URL(
        `${prefix}${route}${separator}per_page=100&page=${page + 1}`,
        api.href.endsWith("/") ? api : api.href + "/",
      ).href;
      if (next[0].trim() !== `<${nextUrl}>; rel="next"`)
        throw new Error("GitHub returned an untrusted pagination target.");
      page++;
    }
    if (total !== undefined && total !== collected.length)
      throw new Error("GitHub returned incomplete check evidence.");
    return collected;
  };
  return { request, pages };
}

export async function runReviewPolicy({
  repository,
  token,
  eventName,
  event,
  runId,
  workflowRef,
  workflowSha,
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
}) {
  const { request, pages } = githubClient(repository, token, apiUrl, fetchImpl);
  const repo = (await request("")).data;
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
  const own = (await request(`actions/runs/${runId}`)).data;
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
    await request(
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
  let numbers;
  if (eventName === "pull_request_target") {
    if (!positive(event.pull_request?.number))
      throw new Error("A PR event number is required.");
    numbers = [event.pull_request.number];
  } else if (eventName === "workflow_dispatch") {
    numbers = (await pages("pulls?state=open")).map((pull) => pull.number);
  } else if (eventName === "workflow_run" || eventName === "check_run") {
    const id = event[eventName]?.id;
    if (!positive(id))
      throw new Error("A GitHub wake-up identifier is required.");
    let head;
    if (eventName === "workflow_run") {
      const signal = (await request(`actions/runs/${id}`)).data;
      const workflow = (await request("actions/workflows/review-signal.yml"))
        .data;
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
      head = signal.head_sha;
    } else {
      const check = (await request(`check-runs/${id}`)).data;
      if (
        check.id !== id ||
        check.app?.id !== providerApp ||
        check.name !== "CodeRabbit" ||
        check.status !== "completed"
      )
        throw new Error("The real provider wake-up check did not match.");
      head = check.head_sha;
    }
    if (!sha(head)) throw new Error("The wake-up source has no valid commit.");
    numbers = (await pages(`commits/${head}/pulls`)).map((pull) => pull.number);
  } else throw new Error("Unsupported approval-policy event.");
  const outcomes = [];
  for (const number of new Set(numbers)) {
    if (!positive(number))
      throw new Error("GitHub returned an invalid PR number.");
    const pullRoute = `pulls/${number}`;
    const initial = pullMetadata(
      (await request(pullRoute)).data,
      repository,
      number,
    );
    const publish = async (head, decision) => {
      const status = (
        await request(`statuses/${head}`, {
          context: approvalContext,
          ...decision,
          target_url: `https://github.com/${repository}/actions/runs/${runId}`,
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
    };
    await publish(initial.head.sha, {
      state: "pending",
      description: "Checking actual current-head CodeRabbit approval.",
    });
    let decision;
    let examined = initial;
    try {
      const [reviews, checks, open] = await Promise.all([
        pages(`${pullRoute}/reviews`),
        pages(
          `commits/${initial.head.sha}/check-runs?filter=all`,
          "check_runs",
        ),
        pages("pulls?state=open"),
      ]);
      examined = pullMetadata(
        (await request(pullRoute)).data,
        repository,
        number,
      );
      decision =
        examined.head.sha !== initial.head.sha
          ? blocked("The PR head changed; verification must run again.")
          : decideApproval(examined, reviews, checks);
      const openPulls = open.map((pull) =>
        pullMetadata(pull, repository, pull.number),
      );
      if (
        openPulls.filter(
          (pull) =>
            pull.state === "open" && pull.head.sha === examined.head.sha,
        ).length !== 1
      )
        decision = blocked(
          "Approval status requires one unambiguous open PR for this head.",
        );
    } catch {
      decision = blocked(
        "Complete live review evidence is unavailable; verification failed closed.",
      );
    }
    const current = pullMetadata(
      (await request(pullRoute)).data,
      repository,
      number,
    );
    if (
      current.head.sha !== examined.head.sha ||
      current.state !== examined.state ||
      current.draft !== examined.draft
    )
      decision = blocked(
        "The PR changed before status publication; run verification again.",
      );
    await publish(current.head.sha, decision);
    outcomes.push({ number, head: current.head.sha, ...decision });
  }
  return outcomes;
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

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Accept object-shaped hook containers while rejecting null and array payloads. */
const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const shellWord = /(?:[^\s"';&|]|"[^"\r\n]*"|'[^'\r\n]*')+/.source;
const gitValueOption = `(?:-[Cc]\\s*|--(?:git-dir|work-tree|namespace|config-env)(?:=|\\s+))${shellWord}`;
const gitFlagOption =
  /(?:-[pP]|--(?:no-pager|paginate|bare|no-replace-objects|literal-pathspecs|glob-pathspecs|noglob-pathspecs|icase-pathspecs|no-optional-locks|no-lazy-fetch))/
    .source;
const gitPrefix = `\\bgit(?:\\.exe)?\\s+(?:(?:${gitValueOption}|${gitFlagOption})\\s+)*`;
// Exclusion operands can look like force flags; consume them with their option.
const cleanArgument = `(?:(?:-e|--exclude)\\s+${shellWord}|(?!(?:--|-e|--exclude)(?:\\s|$))${shellWord})`;
const pushRemote = `(?:--repo(?:=|[ \\t]+))?(?:origin|upstream|"(?:origin|upstream)"|'(?:origin|upstream)')`;
const protectedPushRefspec =
  /(?!-)\+?(?:[^\s"';&|:]*:)?(?:refs\/heads\/)?(?:main|master)/.source;
const pushDestination = `(?:${protectedPushRefspec}|"${protectedPushRefspec}"|'${protectedPushRefspec}')`;

/**
 * Return a blocking reason for malformed payloads or recognized unsafe patterns.
 * An undefined result is only a pattern check, not authorization or shell parsing;
 * the assistant must still enforce repository policy and existing task consent.
 */
export const inspectHookPayload = (payload) => {
  let input;
  try {
    input = typeof payload === "string" ? JSON.parse(payload) : payload;
  } catch {
    return "Safety hook received invalid JSON; command blocked.";
  }
  if (
    !record(input) ||
    (input.tool_input !== undefined && !record(input.tool_input))
  )
    return "Safety hook requires an object payload; command blocked.";
  const tool = input.tool_input ?? input;
  const command = tool.command ?? tool.cmd ?? "";
  const filePath = tool.file_path ?? tool.path ?? "";
  if (typeof command !== "string" || typeof filePath !== "string")
    return "Safety hook command and file path must be strings; command blocked.";

  const dangerousGit = [
    /push\b[^\r\n]*--force(?:-with-lease|-if-includes)?(?:[=\s]|$)/,
    /push\b[^\r\n]*-[fF](?:\s|$)/,
    /reset\b[^\r\n]*--hard(?:\s|$)/,
    new RegExp(
      `clean\\s+(?:${cleanArgument}[ \\t]+)*(?:-[a-zA-Z]*f[a-zA-Z]*|--force)(?=[\\s;&|]|$)`,
    ),
    /branch\b[^\r\n]*--delete(?:\s|$)/,
    /branch\b[^\r\n]*-[dD](?:\s|$)/,
  ].map((pattern) => new RegExp(`${gitPrefix}${pattern.source}`));
  const directMainPush = new RegExp(
    `${gitPrefix}push(?:[ \\t]+${shellWord})*[ \\t]+${pushRemote}(?:[ \\t]+${shellWord})*[ \\t]+${pushDestination}(?=[\\s;&|]|$)`,
  );
  const environmentExposure = [
    /\b(?:printenv|export -p)\b/i,
    /echo[^\r\n]*(?:TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL)/i,
    /(?:^|[;&|\s])env(?:\s+-[^\s;&|]+)*(?:\s*$|\s*\|)/i,
    /\b(?:Get-ChildItem|gci)\s+Env:/i,
  ];
  const productionEndpoint =
    /\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b[^\r\n]*https?:\/\/[^\s"']*(?:production|mainnet|api\.etherscan\.io)/i;
  const sensitiveFile =
    /(?:^|[/\\])\.env(?:\.|$)|\.(?:pem|p12|key)$|credentials\.|secret\.|keystore/i;
  const publicExample = /(?:^|[/\\])\.env\.example$/i.test(filePath);

  if (dangerousGit.some((pattern) => pattern.test(command)))
    return "Dangerous git pattern blocked by optional hook; consult existing task authorization.";
  if (directMainPush.test(command))
    return "Direct push to main/master blocked by optional hook; follow repository policy.";
  if (!publicExample && sensitiveFile.test(filePath))
    return "Secret or credential path blocked by optional hook; consult existing task authorization.";
  if (environmentExposure.some((pattern) => pattern.test(command)))
    return "Environment variable exposure blocked.";
  if (productionEndpoint.test(command))
    return "Production endpoint pattern blocked by optional hook; consult existing task authorization.";
  return undefined;
};

if (typeof import.meta.main !== "boolean") {
  process.stderr.write(
    "Safety hook requires the repository's Node.js 24 runtime; command blocked.\n",
  );
  process.exitCode = 2;
} else if (import.meta.main) {
  let problem;
  try {
    const entrypoint = process.argv[1];
    if (
      !entrypoint ||
      realpathSync(entrypoint) !== realpathSync(fileURLToPath(import.meta.url))
    )
      problem = "Safety hook could not verify its entrypoint; command blocked.";
    else problem = inspectHookPayload(readFileSync(0, "utf8"));
  } catch {
    problem =
      "Safety hook could not resolve its entrypoint or read input; command blocked.";
  }
  if (problem) {
    process.stderr.write(`${problem}\n`);
    process.exitCode = 2;
  }
}

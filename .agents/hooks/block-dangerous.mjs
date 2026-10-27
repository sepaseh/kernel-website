import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// This optional pattern guard is a fast host aid, not a shell interpreter or
// evidence of authorization. The assistant must still follow repository policy.
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

  const dangerousGit =
    /\bgit(?:\.exe)?\s+(?:push\b[^\r\n]*(?:--force(?:-with-lease|-if-includes)?(?:[=\s]|$)|-[fF](?:\s|$))|reset\b[^\r\n]*--hard(?:\s|$)|clean\s+-[a-z]*f|branch\b[^\r\n]*(?:--delete(?:\s|$)|-[dD](?:\s|$)))/;
  const directMainPush =
    /\bgit(?:\.exe)?\s+push\b[^\r\n]*(?:origin|upstream)\b[^\r\n]*(?:main|master)(?:\s|$)/;
  const environmentExposure =
    /\b(?:printenv|export -p)\b|echo[^\r\n]*(?:TOKEN|API_KEY|SECRET|PASSWORD|CREDENTIAL)|(?:^|[;&|\s])env(?:\s*$|\s*\|)|\b(?:Get-ChildItem|gci)\s+Env:/i;
  const productionEndpoint =
    /\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b[^\r\n]*https?:\/\/[^\s"']*(?:production|mainnet|api\.etherscan\.io)/i;
  const sensitiveFile =
    /(?:^|[/\\])\.env(?:\.|$)|\.(?:pem|p12|key)$|credentials\.|secret\.|keystore/i;
  const publicExample = /(?:^|[/\\])\.env\.example$/i.test(filePath);

  if (dangerousGit.test(command))
    return "Dangerous git pattern blocked by optional hook; consult existing task authorization.";
  if (directMainPush.test(command))
    return "Direct push to main/master blocked by optional hook; follow repository policy.";
  if (!publicExample && sensitiveFile.test(filePath))
    return "Secret or credential path blocked by optional hook; consult existing task authorization.";
  if (environmentExposure.test(command))
    return "Environment variable exposure blocked.";
  if (productionEndpoint.test(command))
    return "Production endpoint pattern blocked by optional hook; consult existing task authorization.";
  return undefined;
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problem = inspectHookPayload(readFileSync(0, "utf8"));
  if (problem) {
    process.stderr.write(`${problem}\n`);
    process.exitCode = 2;
  }
}

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsers as htmlParsers } from "prettier/plugins/html";
import { parsers } from "prettier/plugins/markdown";

import { validateCheckManifest } from "./check-ci.mjs";
import {
  completePublicationWork,
  getPublicationFiles,
  publicationFiles,
  publicationInventories,
  readPublishedFile,
} from "./validate-bootstrap.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const present = (filename, files = publicationFiles) =>
  files.includes(filename);
const references = (values, files) => {
  assert.ok(Array.isArray(values), "Expected a list of published references.");
  assert.equal(new Set(values).size, values.length, "Duplicate reference.");
  for (const value of values)
    assert.ok(
      present(value, files),
      "Unpublished guidance reference: " + value,
    );
};

export function validateGuidanceIndexes(settings, navigation, manifest) {
  validateCheckManifest(manifest);
  const files = publicationInventories[manifest.phase];
  assert.equal(settings.navigation, ".agents/navigation.json");
  assert.equal(settings.validation, ".agents/validation.json");
  for (const field of ["rules", "skills", "optionalHooks"])
    references(settings[field], files);
  assert.deepEqual(
    settings.recommendedChecks,
    manifest.profiles.full.map(
      (id) => manifest.checks.find((check) => check.id === id).command,
    ),
  );
  assert.deepEqual(settings.recommendedChecksSource, {
    path: ".agents/validation.json",
    profile: "full",
  });
  assert.equal(navigation.schemaVersion, 1);
  assert.ok(Array.isArray(navigation.tasks) && navigation.tasks.length);
  const ids = navigation.tasks.map((task) => task.id);
  assert.ok(
    ids.every((id) => typeof id === "string" && /^[a-z][a-z\d-]*$/.test(id)),
  );
  assert.equal(new Set(ids).size, ids.length, "Navigation IDs must be unique.");
  for (const task of navigation.tasks) {
    assert.equal(typeof task.when, "string");
    for (const field of ["owners", "contracts", "tests", "rules"])
      references(task[field] ?? [], files);
    assert.ok(
      task.owners.length && task.tests.length,
      "Tasks need actual owners and tests.",
    );
    assert.ok(Array.isArray(task.checks) && task.checks.length);
    assert.equal(new Set(task.checks).size, task.checks.length);
    for (const id of task.checks)
      assert.ok(
        manifest.checks.some((check) => check.id === id),
        "Unknown navigation check.",
      );
  }
}

export function validateReadme(content, phase = "governance", ready = false) {
  assert.match(
    content,
    new RegExp(String.raw`\b${phase}\b`, "i"),
    "README must identify the published scope.",
  );
  assert.match(
    content,
    new RegExp(
      String.raw`application readiness\s+is\s+\*{0,2}${ready}\*{0,2}`,
      "i",
    ),
    "README readiness must match its reviewed phase.",
  );
}

const trimHtmlWhitespace = (value) => {
  const whitespace = "\t\n\f\r ";
  let start = 0;
  let end = value.length;
  while (start < end && whitespace.includes(value[start])) start++;
  while (end > start && whitespace.includes(value[end - 1])) end--;
  return value.slice(start, end);
};

const decodeHtmlHref = (value) => {
  const quoted = value.replaceAll('"', "&#34;");
  const parsed = htmlParsers.html.parse(`<a href="${quoted}">`, {});
  return trimHtmlWhitespace(
    parsed.children[0].attrs[0].valueTokens
      .map((token) => token.parts[0])
      .join(""),
  );
};

const htmlAttributeValue = (attributes, start) => {
  const quote = attributes[start];
  if (quote === '"' || quote === "'") {
    const end = attributes.indexOf(quote, start + 1);
    if (end < 0)
      throw new Error("HTML attribute values require a closing quote.");

    return { end: end + 1, value: attributes.slice(start + 1, end) };
  }

  const boundary = attributes.slice(start).search(/[\t\n\f\r "'`=<>]/);
  const end = boundary < 0 ? attributes.length : start + boundary;
  return { end, value: attributes.slice(start, end) };
};

const openingTagHrefs = (tag) => {
  const attributes = tag.replace(/^<[A-Za-z][\w:-]*/, "").slice(0, -1);
  const values = [];
  const names = /([^\t\n\f\r "'<>/=]+)([\t\n\f\r ]*=[\t\n\f\r ]*)?/g;
  let match;
  while ((match = names.exec(attributes))) {
    let value = "";
    if (match[2]) {
      const attribute = htmlAttributeValue(attributes, names.lastIndex);
      value = attribute.value;
      names.lastIndex = attribute.end;
    }

    if (match[1].toLowerCase() === "href") values.push(decodeHtmlHref(value));
  }
  return values;
};

const htmlHrefs = (fragments) => {
  const tagTail = `(?:[^"'<>]|"[^"]*"|'[^']*')*>`;
  const tokens = new RegExp(
    [
      String.raw`<!--[\s\S]*?(?:-->|$)`,
      String.raw`<!\[CDATA\[[\s\S]*?(?:\]\]>|$)`,
      String.raw`<\?[^>]*(?:>|$)`,
      `<!${tagTail}`,
      String.raw`<(script|style|textarea|title)(?=[\t\n\f\r />])${tagTail}[\s\S]*?(?:<\/\1(?=[\t\n\f\r />])${tagTail}|$)`,
      String.raw`<[A-Za-z][\w:-]*(?=[\t\n\f\r />])${tagTail}`,
    ].join("|"),
    "gi",
  );
  const markup = fragments.join("\n");
  const values = [];
  for (const token of markup.matchAll(tokens)) {
    let escapes = 0;
    for (let index = token.index - 1; markup[index] === "\\"; index--)
      escapes++;
    if (escapes % 2 || token[1] || /^<[!?]/.test(token[0])) continue;

    values.push(...openingTagHrefs(token[0]));
  }
  return values;
};

export function validateGuideLinks(
  filename,
  content,
  files = publicationFiles,
) {
  assert.equal(
    filename.endsWith(".fa.md"),
    false,
    "Maintained documentation is English-only.",
  );

  const prose = content.replace(/```[\s\S]*?```/g, "");
  assert.equal(
    /[\u0600-\u06ff]/.test(prose),
    false,
    "Maintained documentation is English-only.",
  );

  const nodes = [parsers.markdown.parse(content)];
  const links = [];
  const html = [];
  while (nodes.length) {
    const node = nodes.pop();
    if (["definition", "image", "link"].includes(node.type))
      links.push(node.url);
    if (node.type === "html") html.push(node.value);
    if (node.type === "text") {
      const text = content.slice(
        node.position.start.offset,
        node.position.end.offset,
      );
      if (
        /<[A-Za-z][\w:-]*(?=[\t\n\f\r />])(?:[^"'<>]|"[^"]*"|'[^']*')*>/.test(
          text,
        )
      )
        html.push(text);
    }
    nodes.push(...(node.children ?? []).toReversed());
  }
  links.push(...htmlHrefs(html));

  for (const link of links) {
    if (link === "" || /^(?:https?:|mailto:|codex:|[?#])/i.test(link)) continue;

    const target = decodeURIComponent(link.split(/[?#]/, 1)[0]);
    assert.equal(
      target.startsWith("/"),
      false,
      "Guide links must be relative to their file: " + filename + ": " + link,
    );
    const relative = path.posix.normalize(
      path.posix.join(path.posix.dirname(filename), target),
    );
    assert.ok(
      present(relative, files),
      "Missing or unpublished guide link: " + filename + ": " + link,
    );
  }
}

export function validateEvaluation(evaluation, navigation, manifest, files) {
  assert.equal(evaluation.schemaVersion, 1);
  assert.ok(
    Array.isArray(evaluation.cases) && evaluation.cases.length,
    "Published evaluation needs actual scoped cases.",
  );
  const ids = evaluation.cases.map((item) => item.id);
  assert.ok(
    ids.every((id) => typeof id === "string" && /^[a-z][a-z\d-]*$/.test(id)),
  );
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Evaluation case IDs must be unique.",
  );
  for (const item of evaluation.cases) {
    assert.deepEqual(
      Object.keys(item.prompt),
      ["en"],
      "Evaluation prompts must be English-only.",
    );
    assert.ok(
      typeof item.prompt.en === "string" &&
        item.prompt.en.trim() &&
        !/[\u0600-\u06ff]/.test(item.prompt.en),
    );
    assert.ok(Array.isArray(item.taskIds) && item.taskIds.length);
    for (const id of item.taskIds)
      assert.ok(
        navigation.tasks.some((task) => task.id === id),
        "Unpublished evaluation task.",
      );
    references(item.evidence, files);
    assert.ok(item.evidence.length, "Cases need actual evidence.");
    assert.ok(Array.isArray(item.checks) && item.checks.length);
    for (const id of item.checks)
      assert.ok(
        manifest.checks.some((check) => check.id === id),
        "Unpublished evaluation check.",
      );
    for (const field of ["mustExplain", "mustNot"])
      assert.ok(
        Array.isArray(item[field]) &&
          item[field].length &&
          item[field].every(
            (value) => typeof value === "string" && value.trim(),
          ),
      );
  }
}
export function validateEvaluationTemplate(template) {
  assert.equal(template.schemaVersion, 1);
  assert.equal(template.state, "not-run");
  assert.deepEqual(template.caseResults, []);
  for (const field of [
    "startedAt",
    "repositoryCommit",
    "workingTreeFingerprint",
  ])
    assert.equal(
      template[field],
      null,
      "Execution evidence belongs outside maintained source.",
    );
}

export async function inspectGuidance(root = repository) {
  const json = async (filename) =>
    JSON.parse(await readPublishedFile(root, filename));
  const [settings, navigation, manifest] = await Promise.all([
    json(".agents/settings.json"),
    json(".agents/navigation.json"),
    json(".agents/validation.json"),
  ]);
  validateGuidanceIndexes(settings, navigation, manifest);
  validateReadme(
    await readPublishedFile(root, "README.md"),
    manifest.phase,
    manifest.applicationReady,
  );
  const currentFiles = await getPublicationFiles(root);
  await completePublicationWork(
    currentFiles
      .filter((file) => file.endsWith(".md"))
      .map(async (filename) =>
        validateGuideLinks(
          filename,
          await readPublishedFile(root, filename),
          currentFiles,
        ),
      ),
  );
}

if (import.meta.main) {
  await inspectGuidance();
  console.log(
    "Published English guidance, task references and canonical check indexes passed.",
  );
}

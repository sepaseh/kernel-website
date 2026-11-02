import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsers as htmlParsers } from "prettier/plugins/html";
import { parsers } from "prettier/plugins/markdown";

import { validateCheckManifest } from "./check-ci.mjs";
import {
  completePublicationWork,
  publicationFiles,
  readPublishedFile,
} from "./validate-bootstrap.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const present = (filename) => publicationFiles.includes(filename);
const references = (values) => {
  assert.ok(Array.isArray(values), "Expected a list of published references.");
  assert.equal(new Set(values).size, values.length, "Duplicate reference.");
  for (const value of values)
    assert.ok(present(value), "Unpublished guidance reference: " + value);
};

export function validateGuidanceIndexes(settings, navigation, manifest) {
  validateCheckManifest(manifest);
  assert.equal(settings.navigation, ".agents/navigation.json");
  assert.equal(settings.validation, ".agents/validation.json");
  for (const field of ["rules", "skills", "optionalHooks"])
    references(settings[field]);
  assert.deepEqual(
    settings.recommendedChecks,
    manifest.checks.map((check) => check.command),
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
      references(task[field] ?? []);
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

export function validateReadme(content) {
  assert.match(
    content,
    /\bgovernance\b/i,
    "README must identify the published scope.",
  );
  assert.match(
    content,
    /application readiness\s+is\s+\*{0,2}false\*{0,2}/i,
    "README must keep application readiness false.",
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

const openingTagHrefs = (tag) => {
  const attributes = tag.replace(/^<[A-Za-z][\w:-]*/, "").slice(0, -1);
  const values = [];
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'`=<>]+))?/g;
  for (const match of attributes.matchAll(pattern)) {
    if (match[1].toLowerCase() !== "href") continue;

    const value = match[2] ?? "";
    const unquoted = /^["']/.test(value) ? value.slice(1, -1) : value;
    values.push(decodeHtmlHref(unquoted));
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
      String.raw`<(script|style|textarea|title)(?=[\s/>])${tagTail}[\s\S]*?(?:<\/\1\s*>|$)`,
      String.raw`<[A-Za-z][\w:-]*(?=[\s/>])${tagTail}`,
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

export function validateGuideLinks(filename, content) {
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
      if (/<[A-Za-z][\w:-]*(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/.test(text))
        html.push(text);
    }
    nodes.push(...(node.children ?? []).toReversed());
  }
  links.push(...htmlHrefs(html));

  for (const link of links) {
    if (link === "" || /^(?:https?:|mailto:|codex:|#)/i.test(link)) continue;

    const target = decodeURIComponent(link.split("#")[0]);
    assert.equal(
      target.startsWith("/"),
      false,
      "Guide links must be relative to their file: " + filename + ": " + link,
    );
    const relative = path.posix.normalize(
      path.posix.join(path.posix.dirname(filename), target),
    );
    assert.ok(
      present(relative),
      "Missing or unpublished guide link: " + filename + ": " + link,
    );
  }
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
  validateReadme(await readPublishedFile(root, "README.md"));
  await completePublicationWork(
    publicationFiles
      .filter((file) => file.endsWith(".md"))
      .map(async (filename) =>
        validateGuideLinks(filename, await readPublishedFile(root, filename)),
      ),
  );
}

if (import.meta.main) {
  await inspectGuidance();
  console.log(
    "Published English guidance, task references and canonical check indexes passed.",
  );
}

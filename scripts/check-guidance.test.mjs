import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  inspectGuidance,
  validateGuidanceIndexes,
  validateGuideLinks,
  validateReadme,
} from "./check-guidance.mjs";

const manifest = JSON.parse(
  await readFile(
    new URL("../.agents/validation.json", import.meta.url),
    "utf8",
  ),
);
const settings = () => ({
  navigation: ".agents/navigation.json",
  validation: ".agents/validation.json",
  rules: [".agents/rules/git.md"],
  skills: [".agents/skills/commit/SKILL.md"],
  optionalHooks: [],
  recommendedChecks: manifest.checks.map((check) => check.command),
  recommendedChecksSource: { path: ".agents/validation.json", profile: "full" },
});
const navigation = () => ({
  schemaVersion: 1,
  tasks: [
    {
      id: "governance",
      when: "Change published quality tooling",
      owners: ["scripts/check-ci.mjs"],
      contracts: [".agents/validation.json"],
      tests: ["scripts/check-ci.test.mjs"],
      rules: [".agents/rules/testing.md"],
      checks: ["ci-policy"],
    },
  ],
});

test("guidance indexes reference actual published owners, tests, rules and all canonical commands", async () => {
  validateGuidanceIndexes(settings(), navigation(), manifest);
  await inspectGuidance();
});

test("guidance rejects private or unpublished owners, unsafe rule references and imaginary checks", () => {
  for (const change of [
    (value) => {
      value.rules = ["../outside.md"];
    },
    (value) => {
      value.skills = [".env.local"];
    },
    (value) => {
      value.optionalHooks = [".agents/hooks/unpublished.mjs"];
    },
    (value) => value.rules.push(value.rules[0]),
    (value) => value.recommendedChecks.pop(),
    (value) => {
      value.recommendedChecksSource.profile = "focused";
    },
    (value) => {
      value.navigation = "src/unpublished.json";
    },
    (value) => {
      value.validation = "other.json";
    },
  ]) {
    const value = settings();
    change(value);
    assert.throws(() => validateGuidanceIndexes(value, navigation(), manifest));
  }
  for (const change of [
    (value) => {
      value.schemaVersion = 2;
    },
    (value) => {
      value.tasks = [];
    },
    (value) => value.tasks.push(value.tasks[0]),
    (value) => {
      value.tasks[0].id = "../bad";
    },
    (value) => {
      value.tasks[0].owners = ["src/app/page.tsx"];
    },
    (value) => {
      value.tasks[0].tests = [];
    },
    (value) => {
      value.tasks[0].when = null;
    },
    (value) => {
      value.tasks[0].checks = ["build"];
    },
    (value) => value.tasks[0].checks.push(value.tasks[0].checks[0]),
  ]) {
    const value = navigation();
    change(value);
    assert.throws(() => validateGuidanceIndexes(settings(), value, manifest));
  }
});

test("English guides accept published relative references and reject hidden, missing or malformed links", () => {
  validateGuideLinks(
    "docs/testing.md",
    "Read [root](../README.md), [CI](../scripts/check-ci.mjs#checks), [guide](<validation.md>) and [external](https://example.test). [Mail](mailto:public@example.test) [Chat](codex://threads/example) [Anchor](#local).",
  );
  validateGuideLinks("README.md", "```text\n[example](unpublished.md)\n```\n");
  for (const title of ['"Read me"', "'Read me'", "(Read me)"])
    for (const target of ["../README.md", "<../README.md>"])
      validateGuideLinks("docs/testing.md", `[root](${target} ${title})`);
  validateGuideLinks(
    "docs/testing.md",
    '[guide](validation.md#checks "Read (the) guide")',
  );
  for (const content of [
    "[private](../.env.local)",
    "[missing](missing.md)",
    "[escape](../../outside.md)",
    "[malformed](%zz.md)",
    "[runtime](../src/app/page.tsx)",
    '[missing](missing.md "Read me")',
    "[private](<../.env.local> 'Private')",
    "[root](/validation.md)",
    "[encoded-root](%2fvalidation.md)",
    "[absolute](/docs/validation.md)",
    "متن فارسی",
  ])
    assert.throws(() => validateGuideLinks("docs/testing.md", content));
  assert.throws(() => validateGuideLinks("docs/testing.fa.md", "English body"));
  validateReadme("Governance publication. Application readiness is **false**.");
  assert.throws(() => validateReadme("Application readiness is **false**."));
  assert.throws(() =>
    validateReadme("Governance. Application readiness is true."),
  );
});

test("escaped title delimiters and multiline titles cannot hide unpublished destinations", () => {
  for (const title of [
    String.raw`"Read \"me\""`,
    String.raw`'Read \'me\''`,
    String.raw`(Read \) me)`,
    '"Read\nme"',
    "'Read\nme'",
    "(Read\nme)",
  ]) {
    for (const target of ["../README.md", "<../README.md>"])
      validateGuideLinks("docs/testing.md", `[guide](${target} ${title})`);
    for (const target of ["missing.md", "<missing.md>"])
      assert.throws(
        () =>
          validateGuideLinks("docs/testing.md", `[guide](${target} ${title})`),
        /Missing or unpublished guide link/,
      );
  }
});

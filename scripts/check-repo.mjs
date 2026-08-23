#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const promotedBuckets = ["engineering", "productivity"];
const nonPromotedBuckets = ["in-progress", "misc", "deprecated"];
const allBuckets = [...promotedBuckets, ...nonPromotedBuckets];
const errors = [];

const read = (path) => readFileSync(join(repo, path), "utf8");
const json = (path) => JSON.parse(read(path));
const fail = (message) => errors.push(message);

function skillDirs(bucket) {
  const root = join(repo, "skills", bucket);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((name) => join(root, name))
    .filter((path) => statSync(path).isDirectory())
    .filter((path) => existsSync(join(path, "SKILL.md")))
    .sort();
}

const packageJson = json("package.json");
const plugin = json(".claude-plugin/plugin.json");
const marketplace = json(".claude-plugin/marketplace.json");
const codexMarketplace = json(".agents/plugins/marketplace.json");

if (packageJson.version !== plugin.version) {
  fail(
    `version mismatch: package.json=${packageJson.version}, plugin.json=${plugin.version}`,
  );
}

if (
  !marketplace.plugins.some(
    (entry) => entry.name === "tomstack-skills" && entry.source === "./",
  )
) {
  fail("Claude marketplace must expose tomstack-skills from ./");
}

for (const entry of codexMarketplace.plugins) {
  if (!entry.policy?.installation || !entry.policy?.authentication) {
    fail(`Codex marketplace entry ${entry.name} is missing policy metadata`);
  }
  if (!entry.category) {
    fail(`Codex marketplace entry ${entry.name} is missing category`);
  }
}

const rootReadme = read("README.md");
const names = new Map();
const promotedPaths = [];

for (const bucket of allBuckets) {
  const bucketReadmePath = `skills/${bucket}/README.md`;
  if (!existsSync(join(repo, bucketReadmePath))) {
    fail(`missing ${bucketReadmePath}`);
    continue;
  }
  const bucketReadme = read(bucketReadmePath);

  for (const dir of skillDirs(bucket)) {
    const path = relative(repo, dir).replaceAll("\\", "/");
    const skill = read(`${path}/SKILL.md`);
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
    const name = frontmatter?.[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];

    if (!frontmatter || !name) {
      fail(`${path}/SKILL.md has invalid frontmatter or no name`);
      continue;
    }

    if (name !== dir.split("/").at(-1)) {
      fail(`${path} directory and skill name differ (${name})`);
    }
    if (names.has(name)) {
      fail(`duplicate skill name ${name}: ${names.get(name)} and ${path}`);
    }
    names.set(name, path);

    const openaiPath = `${path}/agents/openai.yaml`;
    if (!existsSync(join(repo, openaiPath))) {
      fail(`missing ${openaiPath}`);
    } else {
      const openai = read(openaiPath);
      const claudeExplicit = /^disable-model-invocation:\s*true\s*$/m.test(
        frontmatter[1],
      );
      const codexExplicit = /^\s*allow_implicit_invocation:\s*false\s*$/m.test(
        openai,
      );
      if (claudeExplicit !== codexExplicit) {
        fail(`${path} has inconsistent Claude/Codex invocation policy`);
      }
    }

    if (!bucketReadme.includes(`./${name}/SKILL.md`)) {
      fail(`${bucketReadmePath} does not link ${name}`);
    }

    if (promotedBuckets.includes(bucket)) {
      promotedPaths.push(`./${path}`);
      if (!rootReadme.includes(`./${path}/SKILL.md`)) {
        fail(`README.md does not link promoted skill ${name}`);
      }
      const docsPath = `docs/${bucket}/${name}.md`;
      if (!existsSync(join(repo, docsPath))) {
        fail(`missing ${docsPath}`);
      }
    }
  }
}

const manifestPaths = [...plugin.skills].sort();
const expectedPaths = [...promotedPaths].sort();
if (JSON.stringify(manifestPaths) !== JSON.stringify(expectedPaths)) {
  fail(
    `Claude plugin skills differ from promoted set\nexpected=${expectedPaths.join(",")}\nactual=${manifestPaths.join(",")}`,
  );
}

for (const required of ["LICENSE", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md"]) {
  if (!existsSync(join(repo, required))) fail(`missing ${required}`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Tomstack contract valid: ${promotedPaths.length} promoted skills, ${names.size} total skills`,
);

#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = join(repo, "package.json");
const pluginPath = join(repo, ".claude-plugin", "plugin.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
const source = readFileSync(pluginPath, "utf8");
const plugin = JSON.parse(source);

if (plugin.version === version) {
  console.log(`plugin.json version is ${version} (already in sync)`);
  process.exit(0);
}

if (process.argv.includes("--check")) {
  console.error(
    `plugin.json version is ${plugin.version}, package.json is ${version}`,
  );
  process.exit(1);
}

const updated = source.replace(
  /("version"\s*:\s*")[^"]*(")/,
  `$1${version}$2`,
);

if (JSON.parse(updated).version !== version) {
  console.error(`Could not update ${pluginPath}`);
  process.exit(1);
}

writeFileSync(pluginPath, updated);
console.log(`plugin.json version ${plugin.version} -> ${version}`);

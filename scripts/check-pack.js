#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const REQUIRED_FILES = [
  "index.ts",
  "openclaw.plugin.json",
  "skills/TotalReClaw/SKILL.md",
  "src/engine.ts",
  "examples/demo-lessons.jsonl",
];

function runPackDryRun() {
  const stdout = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("npm pack --dry-run --json returned no package metadata");
  }
  return parsed[0];
}

function main() {
  const packResult = runPackDryRun();
  const included = new Set((packResult.files ?? []).map((entry) => entry.path));
  const missing = REQUIRED_FILES.filter((path) => !included.has(path));

  if (missing.length > 0) {
    console.error("Pack check failed. Missing packaged files:");
    for (const path of missing) {
      console.error(`- ${path}`);
    }
    process.exit(1);
  }

  console.log("Pack check passed.");
  for (const path of REQUIRED_FILES) {
    console.log(`- ${path}`);
  }
}

main();

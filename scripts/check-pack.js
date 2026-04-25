#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REQUIRED_FILES = [
  "index.ts",
  "openclaw.plugin.json",
  "docs/ARCHITECTURE.md",
  "docs/images/totalreclaw-header-vip.svg",
  "docs/images/totalreclaw-architecture-vip.svg",
  "docs/images/totalreclaw-workflow-vip.svg",
  "skills/TotalReClaw/SKILL.md",
  "src/engine.ts",
  "examples/demo-lessons.jsonl",
  "scripts/install-remote.sh",
  "scripts/verify-remote.sh",
];

const FORBIDDEN_FILES = [
  "docs/images/totalreclaw-header.svg",
  "docs/images/totalreclaw-architecture.svg",
  "docs/images/totalreclaw-workflow.svg",
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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must be ${expected}; found ${actual ?? "missing"}`);
  }
}

function assertMetadata() {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const lockRoot = packageLock.packages?.[""];

  assertEqual(packageJson.version, "0.3.0", "package.json version");
  assertEqual(packageJson.peerDependencies?.openclaw, ">=2026.4.24", "package.json OpenClaw peer");
  assertEqual(packageJson.engines?.node, ">=22.14.0", "package.json Node engine");
  assertEqual(lockRoot?.version, packageJson.version, "package-lock root version");
  assertEqual(lockRoot?.peerDependencies?.openclaw, packageJson.peerDependencies.openclaw, "package-lock OpenClaw peer");
  assertEqual(lockRoot?.engines?.node, packageJson.engines.node, "package-lock Node engine");
}

function main() {
  assertMetadata();
  const packResult = runPackDryRun();
  const included = new Set((packResult.files ?? []).map((entry) => entry.path));
  const missing = REQUIRED_FILES.filter((path) => !included.has(path));
  const forbidden = FORBIDDEN_FILES.filter((path) => included.has(path));

  if (missing.length > 0) {
    console.error("Pack check failed. Missing packaged files:");
    for (const path of missing) {
      console.error(`- ${path}`);
    }
    process.exit(1);
  }

  if (forbidden.length > 0) {
    console.error("Pack check failed. Forbidden packaged files:");
    for (const path of forbidden) {
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

import path from "node:path";
import { homedir } from "node:os";

import type { ResolvedConfig } from "./types.ts";

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function readString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function resolveConfig(raw: unknown, pluginRoot: string): ResolvedConfig {
  const config =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const home = process.env.HOME?.trim() || homedir();
  const root = path.join(home, ".openclaw", "totalreclaw");
  const enableAutoRecall = readBoolean(config.enableAutoRecall, readBoolean(config.enableAutoCheck, true));

  return {
    enabled: readBoolean(config.enabled, true),
    enableAutoRecall,
    enableAutoCheck: enableAutoRecall,
    enableAutoCapture: readBoolean(config.enableAutoCapture, true),
    dbPath: readString(config.dbPath, path.join(root, "totalreclaw.db")),
    storePath: readString(config.storePath, path.join(root, "lessons.jsonl")),
    draftPath: readString(config.draftPath, path.join(root, "review")),
    sessionStatePath: readString(config.sessionStatePath, path.join(root, "state", "sessions")),
    hookTimeoutMs: readNumber(config.hookTimeoutMs, 800, 50, 1500),
    summaryModel: readString(config.summaryModel, "deterministic"),
    priorFixThreshold: readNumber(config.priorFixThreshold, 0.65, 0, 1),
    noMatchThreshold: readNumber(config.noMatchThreshold, 0.4, 0, 1),
    conflictWindow: readNumber(config.conflictWindow, 0.1, 0, 1),
    maxRecordsInjected: readNumber(config.maxRecordsInjected, 3, 1, 6),
    maxTokensInjected: readNumber(config.maxTokensInjected, 500, 100, 1200),
    demoStorePath: path.join(pluginRoot, "examples", "demo-lessons.jsonl"),
    pluginRoot,
  };
}

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createResolvedConfig, runAutoCheck } from "../index.ts";

function makeConfig(root: string) {
  return createResolvedConfig(
    {
      dbPath: path.join(root, "totalreclaw.db"),
      storePath: path.join(root, "lessons.jsonl"),
      draftPath: path.join(root, "review"),
      sessionStatePath: path.join(root, "state", "sessions"),
      enableAutoRecall: true,
      maxRecordsInjected: 3,
      maxTokensInjected: 500,
    },
    root,
  );
}

describe("auto recall hook", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
  });

  it("injects context for operational prompts with a matching prior fix", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-hook-"));
    roots.push(root);
    const storePath = path.join(root, "lessons.jsonl");
    await writeFile(
      storePath,
      `${JSON.stringify({
        lesson_id: "trc_hook",
        scope: "openclaw",
        source_type: "openclaw_session",
        task_summary: "Fix missing skill after plugin install",
        failure_symptom: "skill missing from openclaw skills check",
        root_cause: "plugin manifest omitted skills path",
        fix: "add skills/TotalReClaw to openclaw.plugin.json and restart",
        commands_involved: ["openclaw skills check"],
        files_involved: ["openclaw.plugin.json"],
        tools_involved: ["openclaw"],
        source_pointer: "test-hook",
        trust_class: "validated",
        confidence: 0.9,
        created_at: "2026-04-18T00:00:00.000Z",
        last_validated_at: "2026-04-18T00:00:00.000Z"
      })}\n`,
      "utf8",
    );

    const config = makeConfig(root);
    const injected = await runAutoCheck("fix missing OpenClaw skill after plugin install", config);
    expect(injected).toContain("[TotalReClaw Reference Only]");
    expect(injected).toContain("prior_fix_found");
    expect(injected).toContain("record");
  });

  it("returns nothing for non-operational prompts", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-hook-safe-"));
    roots.push(root);
    const config = makeConfig(root);

    const injected = await runAutoCheck("write a short project summary", config);
    expect(injected).toBeNull();
  });
});

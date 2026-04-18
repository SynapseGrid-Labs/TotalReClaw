import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { checkTask, createResolvedConfig, executeTotalReClawCommand } from "../index.ts";

async function makeConfig(lines: string[] = []) {
  const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-check-"));
  const storePath = path.join(root, "lessons.jsonl");
  if (lines.length > 0) {
    await writeFile(storePath, `${lines.join("\n")}\n`, "utf8");
  }
  const config = createResolvedConfig(
    {
      dbPath: path.join(root, "totalreclaw.db"),
      storePath,
      draftPath: path.join(root, "review"),
      sessionStatePath: path.join(root, "state", "sessions"),
      enableAutoRecall: true,
    },
    root,
  );
  return { root, config, storePath };
}

describe("checkTask", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
  });

  it("returns no_match for an empty store", async () => {
    const { root, config } = await makeConfig();
    roots.push(root);

    const result = await checkTask("fix missing plugin skill", config);
    expect(result.verdict).toBe("no_match");
  });

  it("migrates legacy lessons and returns prior_fix_found", async () => {
    const { root, config } = await makeConfig([
      JSON.stringify({
        lesson_id: "trc1",
        scope: "openclaw",
        source_type: "openclaw_session",
        task_summary: "OpenClaw skill missing after plugin install",
        failure_symptom: "skill did not appear in openclaw skills check",
        root_cause: "plugin manifest bundled no skills path",
        fix: "add skills/TotalReClaw to openclaw.plugin.json and restart the gateway",
        commands_involved: ["openclaw skills check", "openclaw gateway restart"],
        files_involved: ["openclaw.plugin.json"],
        tools_involved: ["openclaw"],
        source_pointer: "test",
        trust_class: "validated",
        confidence: 0.9,
        created_at: "2026-04-18T00:00:00.000Z",
        last_validated_at: "2026-04-18T00:00:00.000Z",
      }),
    ]);
    roots.push(root);

    const result = await checkTask("fix missing OpenClaw skill after plugin install", config);
    expect(result.verdict).toBe("prior_fix_found");
    expect(result.recommended_next_step).toContain("Fix:");
  });

  it("returns conflicting_memory for conflicting legacy records", async () => {
    const { root, config } = await makeConfig([
      JSON.stringify({
        lesson_id: "trc_a",
        scope: "openclaw",
        source_type: "openclaw_session",
        task_summary: "Gateway restart after config change",
        failure_symptom: "stale plugin behavior remained after config change",
        root_cause: "service process never restarted",
        fix: "run openclaw gateway restart",
        commands_involved: ["openclaw gateway restart"],
        files_involved: ["~/.openclaw/openclaw.json"],
        tools_involved: ["openclaw"],
        source_pointer: "test-a",
        trust_class: "manual",
        confidence: 0.72,
        created_at: "2026-04-18T00:00:00.000Z",
        last_validated_at: "2026-04-18T00:00:00.000Z",
      }),
      JSON.stringify({
        lesson_id: "trc_b",
        scope: "openclaw",
        source_type: "openclaw_session",
        task_summary: "Gateway restart after config change",
        failure_symptom: "stale plugin behavior remained after config change",
        root_cause: "foreground gateway process still running old config",
        fix: "stop the foreground gateway and run openclaw gateway run again",
        commands_involved: ["openclaw gateway run"],
        files_involved: ["~/.openclaw/openclaw.json"],
        tools_involved: ["openclaw"],
        source_pointer: "test-b",
        trust_class: "manual",
        confidence: 0.7,
        created_at: "2026-04-17T23:00:00.000Z",
        last_validated_at: "2026-04-17T23:00:00.000Z",
      }),
    ]);
    roots.push(root);

    const result = await checkTask("stale plugin behavior remained after config change", config);
    expect(result.verdict).toBe("conflicting_memory");
    expect(result.matched_items).toHaveLength(2);
  });

  it("returns context_found for non-failure operational memory", async () => {
    const { root, config } = await makeConfig();
    roots.push(root);

    const draft = await executeTotalReClawCommand(
      'capture --stdin "Category: decision\nSummary: Move accepted memory to SQLite\nDetails: Decision: keep SQLite for durable records and JSON for drafts."',
      config,
    );
    const draftId = draft.text.match(/Draft created: (\S+)/)?.[1];
    expect(draftId).toBeTruthy();
    await executeTotalReClawCommand(`capture --accept ${draftId}`, config);

    const result = await checkTask("what did we decide about durable storage", config);
    expect(result.verdict).toBe("context_found");
  });

  it("keeps check as an alias of recall", async () => {
    const { root, config } = await makeConfig([
      JSON.stringify({
        lesson_id: "trc_alias",
        scope: "openclaw",
        source_type: "openclaw_session",
        task_summary: "Install the plugin on the remote host",
        failure_symptom: "plugin not visible after sync",
        root_cause: "skills path omitted from config",
        fix: "restore the skills path and restart OpenClaw",
        commands_involved: ["openclaw gateway restart"],
        files_involved: ["openclaw.plugin.json"],
        tools_involved: ["openclaw"],
        source_pointer: "alias-test",
        trust_class: "validated",
        confidence: 0.9,
        created_at: "2026-04-18T00:00:00.000Z",
        last_validated_at: "2026-04-18T00:00:00.000Z",
      }),
    ]);
    roots.push(root);

    const check = await executeTotalReClawCommand('check "install plugin on the remote host"', config);
    const recall = await executeTotalReClawCommand('recall "install plugin on the remote host"', config);
    expect(check.text).toContain("Verdict: prior_fix_found");
    expect(recall.text).toContain("Verdict: prior_fix_found");
  });
});

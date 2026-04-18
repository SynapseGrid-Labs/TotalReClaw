import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createResolvedConfig, executeTotalReClawCommand, finalizeSession, recordAgentTurn } from "../index.ts";

function makeConfig(root: string) {
  return createResolvedConfig(
    {
      dbPath: path.join(root, "totalreclaw.db"),
      storePath: path.join(root, "lessons.jsonl"),
      draftPath: path.join(root, "review"),
      sessionStatePath: path.join(root, "state", "sessions"),
      enableAutoRecall: true,
      enableAutoCapture: true,
    },
    root,
  );
}

describe("capture flow", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
  });

  it("creates a draft and redacts inline secrets", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-capture-"));
    roots.push(root);
    const config = makeConfig(root);

    const response = await executeTotalReClawCommand(
      'capture --stdin "Summary: Fix plugin auth. Details: bearer token leaked in logs. Fix: redact the token before saving. Authorization: Bearer abcdefghijklmnop."',
      config,
    );

    expect(response.text).toContain("Draft created:");
    const draftId = response.text.match(/Draft created: (\S+)/)?.[1];
    expect(draftId).toBeTruthy();

    const draftPath = path.join(root, "review", `${draftId}.json`);
    const draft = await readFile(draftPath, "utf8");
    expect(draft).toContain("[REDACTED_TOKEN]");
    expect(draft).not.toContain("abcdefghijklmnop");
  });

  it("accepts a manual record into the durable sqlite store", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-accept-"));
    roots.push(root);
    const config = makeConfig(root);

    const draft = await executeTotalReClawCommand(
      'capture --stdin "Task Summary: Fix missing skill. Failure Symptom: skill missing from openclaw skills check. Root Cause: plugin manifest omitted the skills path. Fix: add skills/TotalReClaw to openclaw.plugin.json and restart."',
      config,
    );
    const draftId = draft.text.match(/Draft created: (\S+)/)?.[1];
    expect(draftId).toBeTruthy();

    const accepted = await executeTotalReClawCommand(`capture --accept ${draftId}`, config);
    expect(accepted.text).toContain("Accepted draft");

    const recall = await executeTotalReClawCommand('recall "fix missing skill after plugin install"', config);
    expect(recall.text).toContain("Verdict: prior_fix_found");
  });

  it("finalizes a session into a draft and accepts the session summary bundle", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-session-"));
    roots.push(root);
    const config = makeConfig(root);

    await recordAgentTurn(
      {
        agent: { id: "openclaw-agent" },
        session: { id: "sess-123" },
        prompt: "Install TotalReClaw on the remote host and verify the plugin is visible.",
        messages: [
          { role: "user", content: "Install TotalReClaw on the remote host and verify the plugin is visible." },
          {
            role: "assistant",
            content:
              "Decision: use SQLite for durable records. Outcome: the installer should update the remote config and restart OpenClaw. Command: ssh remote-host openclaw gateway restart",
          },
        ],
      },
      {},
      config,
    );

    const draftResult = await finalizeSession("current", config);
    expect(draftResult.text).toContain("Session draft created:");
    const draftId = draftResult.text.match(/Session draft created: (\S+)/)?.[1];
    expect(draftId).toBeTruthy();

    const draftPath = path.join(root, "review", `${draftId}.json`);
    const draft = JSON.parse(await readFile(draftPath, "utf8")) as { linked_records: unknown[]; session_summary?: { session_id: string } };
    expect(draft.session_summary?.session_id).toBe("sess-123");
    expect(draft.linked_records.length).toBeGreaterThan(0);

    const accepted = await executeTotalReClawCommand(`capture --accept ${draftId}`, config);
    expect(accepted.text).toContain("with");

    const summary = await executeTotalReClawCommand("summary --latest", config);
    expect(summary.text).toContain("Session: sess-123");

    const timeline = await executeTotalReClawCommand("timeline --session sess-123", config);
    expect(timeline.text).toContain("# TotalReClaw timeline");
  });

  it("writes session state only during agent_end accumulation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-accumulator-"));
    roots.push(root);
    const config = makeConfig(root);

    await recordAgentTurn(
      {
        agent: { id: "openclaw-agent" },
        session: { id: "sess-live" },
        prompt: "Check the remote plugin config on the target host.",
        messages: [{ role: "assistant", content: "Blocked waiting on the remote gateway state. ssh remote-host openclaw plugins info totalreclaw" }],
      },
      {},
      config,
    );

    const sessions = await executeTotalReClawCommand("sessions", config);
    expect(sessions.text).toContain("Active accumulators:");

    const stateDir = path.join(root, "state", "sessions");
    const files = await readdir(stateDir);
    expect(files.some((entry) => entry.endsWith(".pending.json"))).toBe(true);

    const recall = await executeTotalReClawCommand('recall "remote plugin config on the target host"', config);
    expect(recall.text).toContain("Verdict: no_match");
  });
});

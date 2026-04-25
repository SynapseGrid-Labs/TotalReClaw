import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import plugin, { createResolvedConfig, runAutoCheck } from "../index.ts";

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

  it("expands tilde-prefixed configured paths", async () => {
    const config = createResolvedConfig(
      {
        dbPath: "~/.openclaw/totalreclaw/custom.db",
        draftPath: "~/.openclaw/totalreclaw/custom-review",
        sessionStatePath: "~/.openclaw/totalreclaw/custom-state",
      },
      "/tmp/totalreclaw-plugin",
    );

    expect(config.dbPath).toContain(path.join(".openclaw", "totalreclaw", "custom.db"));
    expect(config.draftPath).toContain(path.join(".openclaw", "totalreclaw", "custom-review"));
    expect(config.sessionStatePath).toContain(path.join(".openclaw", "totalreclaw", "custom-state"));
    expect(config.dbPath.startsWith("~")).toBe(false);
  });

  it("finalizes the matching session for reset hooks", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-hook-register-"));
    roots.push(root);

    const handlers = new Map<
      string,
      {
        handler: (event: Record<string, unknown>, ctx: Record<string, unknown>) => unknown;
        opts?: { priority?: number };
      }
    >();
    plugin.register({
      pluginConfig: {
        dbPath: path.join(root, "totalreclaw.db"),
        storePath: path.join(root, "lessons.jsonl"),
        draftPath: path.join(root, "review"),
        sessionStatePath: path.join(root, "state", "sessions"),
        enableAutoRecall: true,
        enableAutoCapture: true,
      },
      logger: {
        info() {},
        warn(message: string) {
          throw new Error(message);
        },
        error(message: string) {
          throw new Error(message);
        },
      },
      resolvePath(input: string) {
        return input === "." ? root : path.resolve(root, input);
      },
      registerTool() {},
      on(hookName, handler, opts) {
        handlers.set(hookName, { handler, opts });
      },
    });

    expect(handlers.has("before_prompt_build")).toBe(true);
    expect(handlers.has("before_message_write")).toBe(true);
    expect(handlers.has("before_reset")).toBe(true);

    const beforeMessageWrite = handlers.get("before_message_write");
    const beforeReset = handlers.get("before_reset");
    expect(beforeMessageWrite).toBeTruthy();
    expect(beforeReset).toBeTruthy();
    expect(beforeMessageWrite?.opts?.priority).toBeLessThan(0);

    const firstWriteResult = beforeMessageWrite!.handler(
      {
        agentId: "openclaw-agent",
        sessionKey: "sess-a",
        message: {
          role: "assistant",
          content: "Decision: restart the gateway after the plugin sync.",
        },
      },
      {},
    );
    expect(firstWriteResult).toBeUndefined();

    beforeMessageWrite!.handler(
      {
        agentId: "openclaw-agent",
        sessionKey: "sess-b",
        message: {
          role: "assistant",
          content: "Outcome: session B is still in progress.",
        },
      },
      {},
    );

    await beforeReset!.handler(
      {
        agentId: "openclaw-agent",
        sessionKey: "sess-a",
        reason: "reset",
      },
      {},
    );

    const draftFiles = await readdir(path.join(root, "review"));
    expect(draftFiles).toHaveLength(1);
    const savedDraft = JSON.parse(
      await readFile(path.join(root, "review", draftFiles[0]!), "utf8"),
    ) as { session_summary?: { session_id: string } };
    expect(savedDraft.session_summary?.session_id).toBe("sess-a");

    const remainingSessionFiles = await readdir(path.join(root, "state", "sessions"));
    const remainingPayloads = await Promise.all(
      remainingSessionFiles.map((entry) =>
        readFile(path.join(root, "state", "sessions", entry), "utf8").then((raw) => JSON.parse(raw) as { session_id: string }),
      ),
    );
    expect(remainingPayloads.some((entry) => entry.session_id === "sess-b")).toBe(true);
    expect(remainingPayloads.some((entry) => entry.session_id === "sess-a")).toBe(false);
  });
});

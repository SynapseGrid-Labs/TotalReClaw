import { afterEach, describe, expect, it } from "vitest";
import { cp, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createResolvedConfig, executeTotalReClawCommand } from "../index.ts";

describe("demo command", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(roots.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
  });

  it("runs against the bundled example store path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "totalreclaw-demo-"));
    roots.push(root);

    await mkdir(path.join(root, "examples"), { recursive: true });
    await cp(new URL("../examples/demo-lessons.jsonl", import.meta.url), path.join(root, "examples", "demo-lessons.jsonl"));

    const config = createResolvedConfig(
      {
        dbPath: path.join(root, "totalreclaw.db"),
        draftPath: path.join(root, "review"),
        sessionStatePath: path.join(root, "state", "sessions"),
      },
      root,
    );

    const result = await executeTotalReClawCommand("demo", config);

    expect(result.text).toContain("# TotalReClaw demo");
    expect(result.text).toContain(`Demo store: ${path.join(root, "examples", "demo-lessons.jsonl")}`);
    expect(result.text).toContain("Query: fix OpenClaw skill not appearing after plugin install");
    expect(result.text).toContain("This demo is read-only and uses the bundled legacy example store.");
  });
});

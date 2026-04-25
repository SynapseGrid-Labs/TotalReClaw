---
name: TotalReClaw
description: OpenClaw operational memory that recalls prior records and session summaries before you repeat work.
metadata: {"category":"memory"}
user-invocable: true
command-dispatch: tool
command-tool: totalreclaw
command-arg-mode: raw
---

# TotalReClaw

Use `/totalreclaw` when you want to recall prior OpenClaw operational context, capture a new durable record, review a session summary draft, explain why a recommendation appeared, or resolve contradictory memory.

## Commands

```text
/totalreclaw check "<task>"
/totalreclaw recall "<query>"
/totalreclaw sessions [<query>]
/totalreclaw summary --latest|--session <id>
/totalreclaw timeline --session <id>|"<query>"
/totalreclaw session close [--current|--session <id>]
/totalreclaw session import [--db <path>] [--limit <n>] [--conversation <id>|--session <id>] [--accept]
/totalreclaw capture --file <path>
/totalreclaw capture --stdin "<summary>"
/totalreclaw capture --accept <draft-id>
/totalreclaw explain "<query>"
/totalreclaw resolve "<query>" [--action keep-newer|keep-older|merge|defer] [--left <record-id> --right <record-id>]
/totalreclaw demo
```

## Workflow docs

- [Check](Workflows/Check.md)
- [Capture](Workflows/Capture.md)
- [Session Import](Workflows/SessionImport.md)
- [Explain](Workflows/Explain.md)
- [Resolve Conflict](Workflows/ResolveConflict.md)
- [Demo](Workflows/Demo.md)

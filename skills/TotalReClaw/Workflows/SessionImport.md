# Session Import

Use session import to backfill historical OpenClaw conversations into TotalReClaw review drafts.

```text
/totalreclaw session import --limit 25
/totalreclaw session import --conversation <id>
/totalreclaw session import --session <id>
```

Add `--db <path>` when the OpenClaw history database is not at the default location.

By default, imported sessions become review drafts. Add `--accept` only when you intentionally want matching imported sessions promoted into durable memory during the import.

# Capture

Capture is manual and reviewable.

Create a draft:

```text
/totalreclaw capture --file path/to/notes.md
/totalreclaw capture --stdin "Task Summary: ... Fix: ..."
/totalreclaw session close --current
```

Accept a draft after review:

```text
/totalreclaw capture --accept draft_abc123
```

Useful fields in the source text:

- category
- summary
- details
- commands
- files
- tools

`session close` creates a review draft from the active accumulator. `capture --accept` promotes a reviewed draft into durable memory. Sensitive material is redacted before any draft is saved.

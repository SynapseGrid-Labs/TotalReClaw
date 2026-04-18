# Capture

Capture is manual and reviewable.

Create a draft:

```text
/totalreclaw capture --file path/to/notes.md
/totalreclaw capture --stdin "Task Summary: ... Fix: ..."
```

Accept a draft after review:

```text
/totalreclaw capture --accept draft_abc123
/totalreclaw session close --current
```

Useful fields in the source text:

- category
- summary
- details
- commands
- files
- tools

`session close` creates a review draft from the active accumulator. Sensitive material is redacted before any draft is saved.

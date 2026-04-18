# Examples

`demo-lessons.jsonl` is a small seed dataset used by `/totalreclaw demo`.

It exists to show the recall and explanation flow without requiring a live accepted-memory database first.

## What it contains

Each line is a JSON object representing a legacy lesson-style record that can be imported or migrated into the current storage model.

Typical fields include:

- `task_summary`
- `failure_symptom`
- `root_cause`
- `fix`
- `commands_involved`
- `files_involved`
- `tools_involved`
- `confidence`

## How it is used

- `demo` points TotalReClaw at this file as a bundled example store
- tests use the same legacy-style shape to verify migration and recall behavior

The file is for demonstration only. Real accepted memory should go through the normal capture and accept flow.

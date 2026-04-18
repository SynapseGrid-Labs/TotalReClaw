# Architecture

TotalReClaw is a local operational-memory layer for OpenClaw. It is designed to keep recall explainable, storage reviewable, and automatic behavior bounded.

## Core design goals

- keep accepted memory durable and queryable locally
- keep new memory reviewable before it becomes durable
- surface prior fixes and prior context without turning historical text into executable instructions
- fail open when hooks time out or encounter unexpected input

## Main components

### Plugin entrypoint

`index.ts` wires TotalReClaw into OpenClaw as a plugin and resolves runtime configuration.

Two hooks matter most:

- `before_prompt_build`: attempts a bounded recall pass for operational prompts
- `agent_end`: accumulates session context for a later explicit summary draft

### Engine

`src/engine.ts` holds the command execution and recall pipeline:

- classify query intent
- search accepted records and accepted session summaries
- compute verdicts such as `prior_fix_found`, `context_found`, `no_match`, or `conflicting_memory`
- build reference-only injected context for the prompt hook
- create review drafts for manual capture and session close
- explain why a recommendation or match appeared

### Storage

`src/store.ts` manages local persistence.

Accepted memory:

- durable SQLite store
- includes accepted records and accepted session summaries

Reviewable state:

- JSON draft files for new captures
- JSON session accumulator files for active work before close/finalization

Legacy compatibility:

- optional JSONL lesson-store import path for one-time migration of older memory formats

## Data flow

### Recall path

1. User prompt or `/totalreclaw recall|check` arrives
2. Query is normalized and matched against accepted memory
3. Best matches are scored and classified
4. TotalReClaw returns a verdict and recommended next step
5. For auto recall, a small reference-only block is prepended to the prompt

### Capture path

1. Operator creates a draft from `--stdin` or `--file`
2. Text is normalized and redacted
3. Draft JSON is written to the review directory
4. Operator explicitly accepts the draft
5. Accepted content moves into SQLite

### Session path

1. `agent_end` appends session context into the active accumulator
2. `/totalreclaw session close` turns that accumulator into a review draft
3. Operator reviews and accepts the draft if it should become durable memory

## Safety model

TotalReClaw is intentionally conservative:

- historical context is injected as reference only
- automatic paths create context or drafts, not durable accepted memory
- redaction runs before drafts are saved
- hook execution is bounded by timeout and token limits
- conflicts are surfaced instead of auto-merged

## Files of interest

- `index.ts` plugin registration
- `src/config.ts` config resolution and defaults
- `src/engine.ts` command and recall pipeline
- `src/store.ts` storage access
- `src/redact.ts` sensitive data scrubbing
- `skills/TotalReClaw/` operator-facing skill docs

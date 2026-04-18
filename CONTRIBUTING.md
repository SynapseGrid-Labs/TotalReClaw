# Contributing

Thanks for contributing to TotalReClaw.

## Development expectations

Keep changes narrow and verifiable:

1. Read the existing command, hook, and storage flow before changing behavior.
2. Avoid unrelated refactors in the same PR.
3. Add or update tests for command parsing, recall behavior, capture flow, storage changes, or redaction logic that you touch.
4. Run `npm run verify` before opening a PR.
5. Update public-facing docs when behavior, flags, storage paths, or install steps change.

## Local workflow

```bash
npm install
npm run verify
```

Primary checks:

- `tsc --noEmit`
- `vitest run`

## Pull requests

A good PR for this repo should include:

- a short description of the operator problem being solved
- the narrow behavioral change
- verification notes
- follow-up items if any scope was intentionally deferred

## Scope guidance

Treat this repo as operator-facing infrastructure software:

- preserve backwards compatibility where practical
- prefer explicit and reviewable storage behavior over hidden automation
- keep recall bounded, explainable, and fail-open
- do not weaken redaction or draft review guarantees

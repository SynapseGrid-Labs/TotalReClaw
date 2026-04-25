# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning once it reaches `1.0.0`.

## [0.3.0] - 2026-04-25

### Changed

- Raise the supported OpenClaw baseline to `2026.4.24+` and document Node `22.14.0+` as the minimum runtime.
- Align automatic session capture with the current OpenClaw message-write and reset hook policy.
- Move CI to `actions/checkout@v6` and `actions/setup-node@v6`.
- Include public docs and remote helper scripts in the npm package allowlist without shipping dev-only scripts.

### Fixed

- Refresh the package lockfile metadata to match the published package version and dependency baseline.
- Remove distracting origin copy from public-facing README and header artwork.
- Replace README imagery with updated VIP SVG assets.
- Correct VIP artwork labels for the current OpenClaw hook path.
- Clarify issue-report redaction guidance and session import skill documentation.

## [0.2.0] - 2026-04-18

### Added

- Historical OpenClaw session import through `/totalreclaw session import`.
- Session lookup, summary, and timeline documentation for accepted session memory.
- Public visual documentation for architecture and workflow.

## [0.1.1] - 2026-04-18

### Fixed

- Tightened session handling and runtime safety around hook behavior.
- Synced the lockfile for Node 22 CI runners.

## [0.1.0] - 2026-04-18

### Added

- OpenClaw plugin entrypoint with automatic pre-prompt recall and session accumulation hooks.
- `TotalReClaw` skill and `/totalreclaw` command surface for recall, capture, session summary, explanation, and conflict resolution.
- Local SQLite-backed accepted memory store plus JSON draft and session-state workflow.
- Remote install and verification scripts for OpenClaw hosts.
- Unit tests covering capture, recall/check behavior, and hook integration.
- Public release hardening for repo metadata, README depth, CI, contributor docs, and packaged-asset verification.

### Fixed

- npm package contents now include the bundled demo dataset required by `/totalreclaw demo`.

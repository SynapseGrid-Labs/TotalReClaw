# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning once it reaches `1.0.0`.

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

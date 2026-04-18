#!/usr/bin/env bash
set -euo pipefail

: "${REMOTE_HOST:?Set REMOTE_HOST to the SSH alias or hostname for your OpenClaw machine}"

echo "[totalreclaw] validating remote OpenClaw config"
ssh "${REMOTE_HOST}" "openclaw config validate"

echo "[totalreclaw] auditing remote OpenClaw security"
ssh "${REMOTE_HOST}" "openclaw security audit"

echo "[totalreclaw] checking plugin status"
ssh "${REMOTE_HOST}" "openclaw plugins info totalreclaw"

echo "[totalreclaw] checking skill status"
ssh "${REMOTE_HOST}" "openclaw skills info TotalReClaw || openclaw skills info totalreclaw"
ssh "${REMOTE_HOST}" "openclaw skills check | grep -i totalreclaw"

echo "[totalreclaw] checking gateway status"
ssh "${REMOTE_HOST}" "openclaw gateway status"

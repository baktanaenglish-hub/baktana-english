#!/bin/bash
# SessionStart hook: install dependencies so tests, lint and typecheck work right away.
# Runs only in Claude Code on the web (remote) sessions; local machines manage their own installs.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Root install also installs server/ deps via the postinstall script (tools/if-server.mjs).
npm install --no-audit --no-fund

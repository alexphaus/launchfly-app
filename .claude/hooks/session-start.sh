#!/bin/bash
# SessionStart hook: make a fresh remote checkout able to verify its own work.
#
# Without this a session opens into a repo with no node_modules and no
# .env.local, so the three commands CLAUDE.md asks for all fail for reasons that
# have nothing to do with the change being made.
set -euo pipefail

# Local checkouts already have their own dependencies and real credentials.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# install, not ci: the container image is cached after this hook completes, and
# install reuses what is already there instead of deleting it first.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "session-start: installing dependencies"
  npm install --no-audit --no-fund
else
  echo "session-start: node_modules is up to date"
fi

# Playwright's browser is preinstalled in this image; never let a postinstall
# re-download it. Appended once, so a resumed session does not stack duplicates.
ENV_OUT="${CLAUDE_ENV_FILE:-/dev/null}"
if [ "$ENV_OUT" = /dev/null ] || ! grep -qs PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD "$ENV_OUT"; then
  echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1' >> "$ENV_OUT"
fi

./.claude/hooks/bootstrap-env.sh

echo "session-start: ready — npx tsc --noEmit | npx tsx scripts/tests/copilot-core.test.ts | npm run build"

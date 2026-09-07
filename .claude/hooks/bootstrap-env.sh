#!/bin/bash
# Write a placeholder .env.local so `npm run build` and the copilot tests can run
# in a fresh clone.
#
# .env.local is gitignored, so a new checkout has none — and without one the
# build dies at "supabaseUrl is required" from a module-level Supabase client,
# long before anything reaches your change. Every value here is a placeholder:
# enough for a client to be constructed and for the build to collect page data,
# never enough to reach a real service.
#
# DISABLE_EXPENSIVE_AI_FUNCTIONS is not optional. Without it the build fails on a
# pre-existing duplicate registration in src/lib/inngest/functions/index.js
# (lines 77-78 register enhancedColdEmailOutreach twice).
#
# Safe to run any number of times. An existing .env.local is never touched, so
# this cannot clobber real credentials.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
ENV_FILE="$ROOT/.env.local"

if [ -f "$ENV_FILE" ]; then
  echo "bootstrap-env: .env.local already exists, leaving it alone"
  exit 0
fi

cat > "$ENV_FILE" <<'ENVEOF'
# Placeholders written by .claude/hooks/bootstrap-env.sh so the build can run.
# Nothing here reaches a real service. Replace any value you actually need.
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
SUPABASE_SERVICE_KEY=placeholder-service-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-key

# Module-level SDK clients across the Launchfly half construct at import time and
# throw without a key, which fails page-data collection for unrelated routes.
# These exist so the build can walk every route, not to call anything.
OPENAI_API_KEY=sk-placeholder
ANTHROPIC_API_KEY=sk-ant-placeholder
DEEPSEEK_API_KEY=sk-placeholder
RESEND_API_KEY=re_placeholder
QSTASH_TOKEN=placeholder-qstash-token

STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder

COPILOT_SESSION_SECRET=placeholder-session-secret-at-least-32-chars
# The copilot cron route reads CRON_SECRET, not COPILOT_CRON_SECRET. See
# CLAUDE.md -> Deploying: production may be setting the wrong name.
CRON_SECRET=placeholder-cron-secret

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Required for the build to succeed. See the comment at the top of this script.
DISABLE_EXPENSIVE_AI_FUNCTIONS=true
ENVEOF

echo "bootstrap-env: wrote placeholder .env.local"

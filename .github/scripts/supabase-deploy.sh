#!/usr/bin/env bash
# Updates the Supabase project from the repo (see docs/supabase.md):
#   1. Runs supabase/schema.sql – it is safe to re-run (if not exists / or replace / drop if exists).
#   2. Sets the Edge Function secrets that are present in GitHub (never printed).
#   3. Deploys every function under supabase/functions and checks that call-turn and billing-webhook answer.
# Works through the Supabase Management API with SUPABASE_ACCESS_TOKEN (a personal access token).
set -euo pipefail

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "::warning::Missing secret SUPABASE_ACCESS_TOKEN – run schema.sql and deploy the functions by hand"
  exit 0
fi

# The project ref is the subdomain of VITE_SUPABASE_URL (https://<ref>.supabase.co).
REF=$(sed -E 's#^https://([a-z0-9]+)\.supabase\.co/?$#\1#' <<<"${SUPABASE_URL:?Missing variable VITE_SUPABASE_URL}")
API="https://api.supabase.com/v1/projects/$REF"

# ---------- 1. SQL ----------
echo "▶ supabase/schema.sql"
jq -Rs '{query: .}' < supabase/schema.sql | curl -sS --fail-with-body -X POST "$API/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @- >/dev/null
echo "✓ schema"

# ---------- 2. Secrets ----------
secrets=()
[ -n "${ANTHROPIC_API_KEY:-}" ] && secrets+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
[ -n "${PREMIUM_EMAILS:-}" ] && secrets+=("PREMIUM_EMAILS=$PREMIUM_EMAILS")
[ -n "${TESTER_EMAILS:-}" ] && secrets+=("TESTER_EMAILS=$TESTER_EMAILS")
[ -n "${CALL_MODEL:-}" ] && secrets+=("CALL_MODEL=$CALL_MODEL")
[ -n "${REVENUECAT_WEBHOOK_SECRET:-}" ] && secrets+=("REVENUECAT_WEBHOOK_SECRET=$REVENUECAT_WEBHOOK_SECRET")
[ -n "${REVENUECAT_API_KEY:-}" ] && secrets+=("REVENUECAT_API_KEY=$REVENUECAT_API_KEY")
if [ ${#secrets[@]} -gt 0 ]; then
  supabase secrets set --project-ref "$REF" "${secrets[@]}" >/dev/null
  echo "✓ ${#secrets[@]} secret(s) set"
fi
[ -z "${ANTHROPIC_API_KEY:-}" ] && echo "::warning::Missing secret ANTHROPIC_API_KEY – calls answer 503 until it is set"
[ -z "${PREMIUM_EMAILS:-}" ] && echo "::warning::Missing secret PREMIUM_EMAILS – nobody is premium until it is set"
[ -z "${REVENUECAT_WEBHOOK_SECRET:-}" ] || [ -z "${REVENUECAT_API_KEY:-}" ] &&
  echo "::notice::REVENUECAT_WEBHOOK_SECRET / REVENUECAT_API_KEY not set – billing-webhook answers 503 (docs/subscriptions.md)"

# ---------- 3. Functions ----------
for fn in supabase/functions/*/; do
  name=$(basename "$fn")
  echo "▶ deploying $name"
  # RevenueCat calls billing-webhook with its own secret, not a Supabase token.
  flags=()
  [ "$name" = "billing-webhook" ] && flags+=(--no-verify-jwt)
  supabase functions deploy "$name" --project-ref "$REF" --use-api "${flags[@]}"
done

# Without a signed-in user the function must answer 401 (anything else means it isn't running right).
status=$(curl -sS -o /dev/null -w '%{http_code}' "$SUPABASE_URL/functions/v1/call-turn" \
  -H "apikey: ${SUPABASE_ANON_KEY:-}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY:-}")
echo "call-turn without a user → $status"
[ "$status" = "401" ] || { echo "::error::call-turn answered $status instead of 401"; exit 1; }

# Without the webhook secret billing-webhook must refuse: 401, or 503 while the secrets aren't set yet.
status=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SUPABASE_URL/functions/v1/billing-webhook" \
  -H "Content-Type: application/json" --data '{}')
echo "billing-webhook without the secret → $status"
case "$status" in 401 | 503) ;; *) echo "::error::billing-webhook answered $status instead of 401/503"; exit 1 ;; esac

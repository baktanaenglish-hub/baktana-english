#!/usr/bin/env sh
# Runs the Supabase SQL (schema, analytics views, seed) and its acceptance checks against a plain
# PostgreSQL database, with a small stand-in for Supabase's auth schema and roles.
#
#   DATABASE_URL=postgres://postgres@localhost:5432/scratch npm run test:supabase
#
# Use an empty scratch database: the scripts create tables, roles and seed data in it.
set -eu
: "${DATABASE_URL:?set DATABASE_URL to an empty scratch PostgreSQL database}"
cd "$(dirname "$0")/../.."
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X -f "$1" >/dev/null; }
run supabase/tests/00-stub-auth.sql
run supabase/schema.sql
run supabase/schema.sql # idempotent: a second run must succeed too
run supabase/analytics-views.sql
run supabase/analytics-seed.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -X -t -f supabase/tests/10-acceptance.sql | grep -v '^\s*$' | tail -1

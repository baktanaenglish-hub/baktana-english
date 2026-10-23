# Handoff – bi (v2)

Branch: `v2/bi` (based on `04e0494`). Spec: `docs/spec/v2.md` §5.5, §7.7, §8, §10.2 (bi).

## What I built

| File                           | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/analytics.ts`         | Real client module per §8.3, replacing the no-op scaffold. Frozen exports unchanged (`track`, `flush`, `setAnalyticsEnabled`, `identify`, `anonId`, `ANON_ID_KEY`, `EVENT_QUEUE_KEY`, `APP_VERSION`). New exports (additive): `createAnalytics(options)` (factory, used by tests), `toEventRow` (camelCase → `public.events` columns), `localContext`, `randomUuid`, `FLUSH_THRESHOLD`, `FLUSH_INTERVAL_MS`, types `EventRow`, `AnalyticsOptions`, `KeyValueStorage`, `AnalyticsBackend`, `Analytics`.                                                                        |
| `src/lib/analytics.test.ts`    | 23 tests: lesson event order (US-T1 AC1), anonId is a stable UUID and no PII keys (AC2), 500 cap and offline queue then send on reconnect (AC3), opt-out clears and blocks (AC4), snake_case mapping without `user_id`, batches of 50, auto-flush at 10, events removed only after success, 400 drops the batch while 429/5xx/network retry, `Authorization` only when signed in, `identify()` flushes, never throws when storage is blocked. Supabase and `fetch` are mocked.                                                                                                |
| `src/data/content.test.ts`     | Validator extensions (all pass on current content and on anything that matches §4): every word and sentence key is a valid unique `isItemKey` (fits `events.item_key` and `srs_state.item_key`); lesson ids are ≤ 12 chars and match `^u\d{1,2}l\d{1,2}$` (`events.lesson_id`, funnel sorting); the CEFR level never goes down along the course; no duplicate error code within a sentence.                                                                                                                                                                                   |
| `supabase/analytics-views.sql` | All §8.5 views, idempotent, service role only (`revoke all … from public, anon, authenticated`). Materialized: `analytics_learner_days` (helper), `v_daily_active`, `v_cohort_retention`, `v_review_engagement`. Plain: `analytics_cohorts` (helper), `v_lesson_funnel`, `v_item_difficulty`, `v_exercise_type_accuracy`, `v_error_code_accuracy`, `v_signup_funnel`. Helper functions `analytics_unit`, `analytics_lesson_no`, `analytics_item_lesson`, `analytics_pct`; `refresh_analytics_views()` (security definer, revoked from clients; pg_cron line in the comments). |
| `supabase/analytics-seed.sql`  | US-T1 AC7: 300 deterministic synthetic learners over the last 45 days (`app_version = 'seed'`, removable). Sets `created_at` = event time so the rate-limit trigger does not skip rows. Refreshes the materialized views at the end.                                                                                                                                                                                                                                                                                                                                          |
| `docs/bi/kpis.md`              | Every KPI from §8.4: exact definition, view/column, target, queries (activation, weighted retention, box 4–5 recall, review engagement), baseline snapshot (§8.7). Hebrew.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `docs/bi/dashboards.md`        | Setup order, nightly refresh and purge with pg_cron, permissions (read-only `bi_reader` role for Metabase), Supabase Studio and Metabase connection, recommended dashboard, 11 example queries. Hebrew.                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/bi/content-health.md`    | §8.6 weekly report for teachers: 4 queries (accuracy < 60 / > 95, completion < 70 / abandon > 25, items > 40% errors, `listen` vs `build-en` gap), plus error codes over time. Hebrew.                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/analytics.md`            | Hebrew overview of the analytics layer: privacy, the events, the client module, storage and views, and how to add an event. The workflow task asked for it; it is a new file that nobody else owns. The detailed docs are in `docs/bi/` (the files §10.1 assigns).                                                                                                                                                                                                                                                                                                            |

## How to verify

```bash
npm install
npx tsc -b && npm run lint
npx vitest run src/lib/analytics.test.ts src/data   # BI tests
npm test                                            # all: 183 web + 71 server tests pass
```

SQL (AC7): I ran `analytics-views.sql` (twice, so it is idempotent), then `analytics-seed.sql`, then every view and every ` ```sql ` block in `docs/bi/*.md` on PGlite (Postgres 17 in WASM). The setup used Supabase stand-ins: roles `anon`/`authenticated`, `auth.uid()`, `auth.users`, and the `events` DDL copied from spec §6.6 section (3). Result: all 8 views return rows on the seed (300 learners, tens of thousands of events); every doc query runs. Running as `anon`: `insert` into `events` works, and `select` returns 0 rows. Reading any view or materialized view gives "permission denied", and so does calling `refresh_analytics_views()`.
To repeat on a real staging project: `schema.sql` → `analytics-views.sql` → `analytics-seed.sql` → `select * from public.v_lesson_funnel;` etc.

## Decisions and deviations

- **Extra columns (additive):** `v_daily_active.wau/mau` ("+ WAU/MAU" in the spec). `v_cohort_retention.activation` (KPI Activation, which has no view of its own in the spec). `v_lesson_funnel.first_try_accuracy` and `answers` (the KPI for accuracy per lesson). `v_signup_funnel.learners` and `signup_by_lesson3_rate` (the KPI for sign-up conversion). `v_signup_funnel.by_lessons_completed` is a jsonb object `{ "<lessonsCompleted>": { shown, accepted, dismissed } }`.
- **Definitions I had to choose:**
  - A learner is an `anon_id`, and days use `local_date`.
  - "Active" means any event except `identify`. Retention counts `lesson_complete`/`review_complete` exactly on day N, as §8.4 says.
  - Retention cells are NULL until day N exists in the data.
  - `v_review_engagement.d7_*` is the D7 of the cohort that starts on that day, split by "finished a review in days 0–6".
  - `top_ex_type` is the exercise type where the item failed most often.
  - Sign-up conversion: learners with an `app_open` whose first `signup_complete` came after at most 3 `lesson_complete`.
- **Indexes on `public.events`:** `analytics-views.sql` adds two indexes to the backend-owned table, `events_name_local_date` and a partial `events_lesson`. Both use `create index if not exists` and never change the table itself.
- **Client failure handling:**
  - A 4xx response other than 401/403/408/425/429 (for example 400 from `POST /api/events` or a Supabase check violation) **drops** that batch, so one bad event cannot block the queue forever. Everything else is retried.
  - Only one flush runs at a time; a flush requested meanwhile runs again after it.
  - Events tracked while a flush is in flight are never removed by that flush (each queued event has a local sequence number `q`, which is never sent).
- **Initial opt-in:** the module reads `analytics` from `baktana-english:settings:v1` when it loads (missing → on). So the first `app_open` respects a saved opt-out even before App's `useEffect(() => setAnalyticsEnabled(...))` runs. ui still owns that key and `parseSettings`.
- **Client-side cleaning** (so a bad call cannot poison a batch): unknown names are dropped; `lessonId` > 12 chars and `itemKey` > 80 chars are dropped; `durationMs` is clamped to 0…3,600,000; non-primitive props are removed, and all props are dropped if they are ≥ 1024 bytes.
- **Listeners** (`online`, `visibilitychange`, 60 s interval, start-up flush) start lazily, on the first `track`/`identify`/`setAnalyticsEnabled(true)` in a browser. They never start in node tests.
- Seeded rows have `user_id = null` (no `auth.users` rows), so `signed_in` is 0 in the seed.

## Notes / requests for others

- **ui:** follow §7.7 (`Settings.analytics`, Profile toggle, `setAnalyticsEnabled` in App). The module already reads the saved value on start. For the "box 4–5 recall" KPI, send `props.box` on review `exercise_answer` (Should). Keep it a number.
- **backend:**
  - `POST /api/events` gets `{ events: AnalyticsEvent[] }` (camelCase, `ts` in ms; there is no `q` field). The client treats 2xx as success, 400 as "drop this batch" and 429/5xx as "retry later", so please keep those statuses.
  - The Supabase insert uses `.insert(rows)` without `.select()`, which is correct because there is no select policy.
  - The views need `public.events` exactly as in §6.6.
- **integrator:** merge order backend → bi is fine; there are no shared files. Run `supabase/analytics-views.sql` after `schema.sql`. Then schedule `refresh_analytics_views()` and `purge_old_events()` with pg_cron (commands are in `docs/bi/dashboards.md`). Do not run the seed in production.

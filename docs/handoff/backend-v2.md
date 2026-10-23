# Handoff – backend (v2)

Branch: `v2/backend`, based on `04e0494` (spec + scaffold + content-a units). Spec: `docs/spec/v2.md`.
All changes stay inside the files §10.1 assigns to backend.

## What was built

| Spec | Built | Files |
|---|---|---|
| §6.7.1 F1 | High-water unlock rule `isUnlocked`, `isCatchUp`, new `currentLessonId` (unknown ids and `__practice__` ignored) | `src/lib/progress.ts` |
| §6.7.2 F2 | Tolerant `sanitizeProgress`: keeps known lessons + ids matching `^u\d{1,2}(l\d{1,2}\|cp)$`, max 500 keys (known lessons first; `mergeProgress` keeps the same cap). New exports `MAX_COMPLETED_KEYS`, `LESSON_ID_RE`, `isKeepableLessonId` | `shared/progress-merge.ts` |
| §6.3 F6 | Real SRS engine: `loadSrs`/`saveSrs` (try/catch, corrupt store → `emptySrs()`, items re-validated), `seedFromProgress`, `applyAnswers` (exact §6.3 table), `dueKeys`, `upcomingKeys`, `useSrs` | `src/lib/srs.ts` |
| D8 | `sanitizeItemStates`, `mergeItemState(s)`; additions `isDateKey`, `sameItemState`, `applySrsUpload` (merge + 3000 cap, used by Express and mirrored in SQL) | `shared/srs-merge.ts` |
| §8 | `sanitizeEvents(input, now?)` | `shared/analytics.ts` |
| §6.5 F11/F14 | SQLite migrations #2 `srs_state`, #3 `events`; `GET/PUT /api/srs`; `POST /api/events` (optional auth, 60 req/min/IP) | `server/src/db.ts`, `repo.ts`, `app.ts`, `routes/srs.ts`, `routes/events.ts` |
| §6.4 | `api.getSrs()` / `api.putSrs(items)` (REST) and the same in the Supabase client (`select … from srs_state`, `rpc('merge_srs')`) | `src/lib/api.ts`, `src/lib/cloud.ts` |
| §6.6 | Everything in §6.6 (trigger `keep_completed_lessons`, `srs_state` + RLS, `merge_srs`, `events` + insert-only RLS, `events_rate_limit`, `purge_old_events`), idempotent | `supabase/schema.sql` |
| docs | `/api/srs`, `/api/events`, unlock rule, tolerant sanitize; Supabase v2 upgrade steps + manual checks + pg_cron | `docs/api.md`, `docs/supabase.md` |

## How to verify

```bash
npm install
npx tsc -b && npm run lint
npx vitest run                  # web + shared
(cd server && npx vitest run)   # Express
```

Test files, mapped to acceptance criteria:
- `src/lib/progress-v2.test.ts` – US-U1 AC1–AC5, the §6.7.3 migration check (old `u1l1…u4l2` save → `u4l3` current, the added `u1l4`, `u1l5`, `u2l3–5`, `u3l3–5` open and catch-up, `u4l4` locked), 500-key cap.
- `src/lib/srs.test.ts` – US-R3 AC1–AC8, due/upcoming order, US-R5 AC1–AC3 (seeding 25 words + 16 sentences, runs once; blocked/corrupt storage), sync helpers (US-R6 AC1, AC5).
- `shared/srs-merge.test.ts` – D8, US-R6 AC2–AC3, the 3000 cap.
- `shared/analytics.test.ts` – `sanitizeEvents` (US-T1 AC5).
- `server/src/v2.test.ts` – migrations, US-U1 AC6, US-R6 AC1–AC4 (+413, cap), US-T1 AC5 (user_id from the token only, 51 events, 400, rate limit).
- `src/lib/cloud-srs.test.ts` – Supabase path of getSrs/putSrs with a fake client.

Manual (Supabase can't run in CI): US-U1 AC7, US-T1 AC6, RLS of `srs_state` – steps in `docs/supabase.md` → "עדכון לגרסה 2".

## Deviations / decisions (spec was silent or ambiguous)

1. **`merge_srs` 3000 cap.** The spec SQL raised `too_many_items` after the insert (rolls back the whole upload). §6.5 says Express doesn't save items beyond the cap. To keep both backends the same, `merge_srs` only adds *new* keys while there is room (in key order, `collate "C"`), like `applySrsUpload` in Express. It also skips invalid items (key regex, box, date ≤ today+401, integer fields) and caps `last` at now. Updates to existing keys are always applied. Execute is revoked from `anon`.
2. **`sanitizeEvents`** drops a whole event if any field breaks the `events` column limits (so Express accepts exactly what Postgres would). `appVersion` and `platform` are required (they're required in `AnalyticsEvent`). A batch over 50 keeps the first 50. Optional `now` parameter added (additive).
3. **`applyAnswers`** combines all answers to a key into one update, as the §6.3 rules say. The scaffold comment "the first answer counts" was the stub's wording; the spec rule wins (and US-R3 AC7 passes).
4. **`useSrs` sync:** it pulls (`getSrs` → merge → mark differing keys dirty → push) on sign-in *and* when the app starts already signed in, so a second device gets changes without needing local edits first. Pushes run when `dirty` changes (after `record`, after a pull, at start) and on `online`. Failures are ignored. Keys that changed while a push was in flight stay dirty. `useSrs` takes an optional third parameter `client` (default `api`), which is additive.
5. **`sanitizeItemStates`** allows `due` up to today + 401 (one day of slack because the learner's local date can be ahead of the server's). Locally (`loadSrs`) the item cap is not applied.
6. **Local SRS on sign-out** is kept (like local progress). If the integrator wants it cleared on sign-out, call `saveSrs(emptySrs())` from the sign-out flow (ui/App).
7. **Could items not done:** `minClientVersion` in `/api/health` and `award_xp`. `HealthResponse` already has the optional field.
8. `server/src/app.ts` already had a Prettier difference on the `staticDir` line before my change. I left it as it was (I didn't reformat).

## Notes for the integrator / other agents

- **ui:** `useSrs(progress, account.user !== null)` is ready. `record(answers, mode)` must be called once per finished session. `isCatchUp`/`currentLessonId` are live, so `LearningPath` gets the new rule automatically.
- **bi:** the Express `/api/events` expects camelCase `AnalyticsEvent`. The Supabase insert must use the snake_case columns of §6.6 and **must not send `user_id`** (the default `auth.uid()` fills it). `client_ts` is an ISO timestamp in Postgres, while Express stores ms.
- Deployment order (§6.7.3): run `supabase/schema.sql` → deploy the server (migrations run on start) → site + APK.

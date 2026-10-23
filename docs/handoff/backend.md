# Handoff: Backend (agent/backend)

## What was built
An Express 5 API in `server/` that implements `shared/api.ts` exactly (contract unchanged).

- `server/src/index.ts`: entry point. Listens on `PORT` (default 3001) and sets `TZ=Asia/Jerusalem` unless `TZ` is already set (more on this below).
- `server/src/app.ts`: `createApp(db, options)`, used by tests and by `index.ts`. It adds security headers and, outside production, CORS for localhost origins only. JSON bodies are limited to 100kb and API responses get `Cache-Control: no-store`. In production it serves `../dist` with an SPA fallback.
- `server/src/db.ts`: `openDb()` uses built-in `node:sqlite` and stores the file at `DATABASE_PATH` (default `./data/baktana.db`, or `:memory:`). Migrations are tracked with `PRAGMA user_version`. Tables:
  - `users`
  - `progress` (one JSON row per user)
  - `xp_events`
- `server/src/auth.ts`:
  - Passwords: scrypt with a per-user salt, compared with `timingSafeEqual`.
  - Tokens: JWT HS256 built with `node:crypto`, valid for 30 days.
  - Secret: read from `JWT_SECRET`. Without it the server warns in dev and refuses to start in production.
  - Middleware: auth middleware and an in-memory rate limit (20 requests per 15 min per IP on register and login).
- `server/src/merge.ts`: two pure, tested functions, `sanitizeProgress` and `mergeProgress`.
- `server/src/repo.ts`: all SQL lives here. `server/src/routes/*.ts` holds the endpoints. `server/src/errors.ts` turns `HttpError` into `ApiError` JSON with a Hebrew `message`.

## Endpoint behavior worth knowing (frontend)

### Register and login
- `POST /api/auth/register` returns **201** with `AuthResponse`. Error codes:
  - 400 `invalid_email`, `weak_password` (fewer than 8 characters), `invalid_display_name` (must be 2–30 characters)
  - 409 `email_taken`
  - 429 `rate_limited`
- Emails are trimmed and lowercased.
- `POST /api/auth/login` returns 200 `AuthResponse`. Errors: 401 `invalid_credentials` (same response for an unknown email and a wrong password), 400 `missing_credentials`, 429.

### Auth failures
- Any missing, invalid or expired token, or a token for a deleted user, gets **401** `{error:'unauthorized'}`.
- The frontend should drop the token and fall back to guest mode when it sees this.

### Progress
- `PUT /api/progress`:
  - Unknown lesson ids are dropped and values are clamped.
  - A malformed body gets 400 `invalid_progress`.
  - Merge rules:
    - xp: the maximum of the two
    - completed: the union of lessons, keeping the higher count for each
    - lastActiveDate: the later date wins, and streak and xpToday come with it. On the same date, the higher of each is kept.
    - hearts: refills are applied to both sides first, then the **lower** heart count is kept along with its clock.
  - PUT also records the XP it adds (merged xp minus stored xp, capped at 50 per sync) as a league `xp_event`, so practice and offline lessons count towards the weekly league. (Added during integration.)

### Completing a lesson
- `POST /api/lessons/:id/complete` takes `{ xp, accuracy }`, where accuracy is **0–100** (the same percent `LessonScreen` computes). XP is rounded and clamped to 0–50.
- Errors:
  - 404 `lesson_not_found`
  - 403 `lesson_locked`, checked with `isUnlocked` against the progress stored on the server
  - 400 `invalid_xp` / `invalid_accuracy`
- It records an `xp_event` and returns the new progress.
- **Wiring tip:** before calling `complete` for a guest who just signed in, PUT the local progress first. Otherwise the server may still see the lesson as locked.

### Leaderboard
- `GET /api/leaderboard` returns the top 20 by XP over the last 7 days.
- Auth is optional. An invalid token is treated as a guest, not rejected.
- If the caller is not in the top 20, they do not appear (the contract has no "my rank" field).

## How to run
```bash
cd server && npm install
npm run dev        # tsx watch, port 3001; Vite proxies /api here
npm test           # vitest + supertest, in-memory DB (53 tests)
npm run typecheck
# production (after `npm run build` at the repo root):
NODE_ENV=production JWT_SECRET=... PORT=3001 npm start   # serves ../dist + /api
```
Environment variables:
- `PORT`
- `DATABASE_PATH`
- `JWT_SECRET` (required in production)
- `NODE_ENV`
- `TRUST_PROXY=1` behind a reverse proxy, so rate limiting sees real client IPs
- `TZ`

Requires Node ≥ 22.5. `node:sqlite` prints an ExperimentalWarning, which is harmless.

## For infra / integrator
- **Root vitest picks up `server/src/*.test.ts`.** The root `vite.config.ts` has no `include`/`exclude`. These tests pass from the root, but only when `server/node_modules` is installed. Pick one fix in the root config:
  - add `test.exclude: ['server/**', 'node_modules/**']` and run server tests with `npm --prefix server test`, or
  - add a root `postinstall`/CI step that runs `npm --prefix server install`.
- Root `tsc -b` does not cover `server/`. Add `npm --prefix server run typecheck` to CI.
- Root `.gitignore` already ignores `node_modules` everywhere. `server/.gitignore` ignores `data/` (the SQLite file).
- No root dependencies were added. All server dependencies are in `server/package.json` and `server/package-lock.json`. The `tsx` runtime is a regular dependency so that `npm start` works in production.
- A Dockerfile or deploy setup would build the web app at the root (`npm run build`), then run `npm ci --omit=dev` and `npm start` in `server/`. It must keep `../dist`, `../src/lib`, `../src/data` and `../shared` available, because the server imports those pure modules at runtime.

## Open issues
- **Time zones:** `src/lib/progress.ts` uses the process's local date. The server defaults to `TZ=Asia/Jerusalem` so streaks and daily XP match Israeli learners. Fixed in QA: `POST /lessons/:id/complete` now takes an optional `date` (the client's local `YYYY-MM-DD`, accepted within one day of the server's date), so streaks follow the learner's calendar; `TZ` is only the fallback.
- The rate limiter and leaderboard are single-process (in memory and SQLite). That is fine for one instance.
- There is no logout endpoint, because tokens are stateless; the client just deletes the token. There are also no password-reset or delete-account endpoints.

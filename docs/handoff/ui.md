# Handoff – UI (branch `agent/ui`)

## What I built

- **`src/lib/api.ts`** – a typed client for every endpoint in `shared/api.ts` (`api.health/register/login/me/getProgress/putProgress/completeLesson/leaderboard`). It uses relative `/api/...` URLs, a 10s timeout, and sends `Authorization: Bearer` when a token is stored. Failures throw `ApiRequestError` with these fields:
  - `message` – the server's Hebrew `ApiError.message`.
  - `status` – `0` means the server could not be reached. That covers network errors and a 404 or 5xx with no JSON body (for example the Vite proxy's error page).
  - `code` – the server's `ApiError.error`.
  - Auth is stored in localStorage under `baktana-english:auth:v1` as `{ token, user }`.
- **`src/lib/account.ts`** – the `useAccount` hook, which handles sign-in, sign-out and background sync:
  - Local progress is always the source of truth. Server calls never block the UI.
  - When a learner signs in, and again on every app start and on the browser's `online` event, the app does a `PUT /api/progress` with local progress and keeps the merged result. That is the retry mechanism for anything that failed offline.
  - Finishing a lesson updates local state first, then calls `POST /api/lessons/:id/complete` in the background.
  - Finishing a practice session triggers a `PUT /api/progress` (see open issues).
  - A 401 on an authenticated call quietly signs the learner out and keeps local progress.
- **`src/lib/sync.ts`** – `mergeProgress(local, server)`, which applies the server's merge rules on the client too. Hearts and `dailyGoal` stay device-local.
- **Screens**
  - `Onboarding`: a welcome screen, then picking a daily goal (10/20/30/50). The "כבר יש לי חשבון" button opens login.
  - `AuthScreen`: sign-up and login, reachable from Profile, from the League tab and from onboarding.
  - `Leaderboard`: the new bottom-nav tab "ליגה". It loads with a skeleton and shows an error with a retry button. Guests get a prompt to sign in.
  - `Profile`: account card with sync status, "sync now" and sign-out; daily goal chips; theme (auto/light/dark); sound switch.
- **Practice** – the "💪 תרגול" button sits in a daily-goal card at the top of the path. `src/lib/practice.ts` builds 10 exercises from up to 3 random completed lessons, with at most one match round. Practice is worth 10 XP plus a 5 XP bonus for no mistakes. It does not cost hearts and does not change `completed`.
- **Polish**
  - Dark mode: `prefers-color-scheme`, plus a manual override through `data-theme` on `<html>`. A small inline script in the `<body>` of `index.html` applies the saved choice before first paint.
  - Animations: slide-in exercises, slide-up feedback, a shake on a wrong answer, a heart "hit", confetti and pop-in on lesson complete. All of it respects `prefers-reduced-motion`.
  - Sound effects come from Web Audio in `src/lib/sound.ts` (no audio files).
  - Keyboard: Enter checks and continues (`useEnterKey`); number keys still pick options.
  - Accessibility: `aria-live` feedback, visible focus rings, progressbar roles, radio and switch roles.
  - English and number+XP text is wrapped in `dir="ltr"` or `<bdi>` so it reads correctly in the RTL layout.
- **Additive change to `src/lib/progress.ts`** – one new optional field, `Progress.dailyGoal?: number`. No existing signature changed. Older saves without it fall back to `DAILY_GOAL_XP` (`dailyGoalOf` in `src/lib/goals.ts`). Onboarding only shows for brand-new learners: no goal, 0 XP, nothing completed.
- **`LessonScreen` API changed (only `App` uses it)** – it now takes `exercises: Exercise[]` instead of `lesson`, and `hearts: number | null`, where null means practice.

## How to run

```bash
npm install
npm run dev        # UI works with no backend (guest mode)
npm test           # 9 files, 37 tests, node environment (no jsdom)
npx tsc -b && npx vite build
```

## For the other agents and the integrator

- **Infra**: `vite.config.ts` needs `server.proxy['/api'] = 'http://localhost:3001'`. Without it the client treats `/api` as offline, which is harmless. I did not touch `<head>` in `index.html`; the manifest link is yours to add.
- **Backend**:
  - PUT bodies may include the extra optional field `dailyGoal`. Please accept it: store it or ignore it, but do not reject the request.
  - `GET /api/leaderboard` is called with the bearer token when there is one, so `isMe` can be filled in. Signed-out users never reach that call from the UI.
  - Please return errors as `{ error, message }` JSON. `message` is shown to the learner as-is.
- **Root dependencies**: none added. No jsdom.

## Open issues

- ~~Practice XP and the league~~ – resolved during integration: the server now counts XP gained through `PUT /api/progress` (capped at 50 per sync) towards the weekly league. A `lesson_locked` answer to a lesson report now triggers a full `PUT` sync instead of showing "offline". Guests can now view the league (US-B1 AC5) with an invitation to sign up above it.
- Signing out keeps the progress on the device, so a second account signing in on the same device would absorb it. A "clear device progress on sign-out" option may be worth adding.
- The lesson-complete screen was not screenshotted, because reaching it needs a full lesson run.
- Screens checked with Playwright at 400x800, light and dark: welcome, goal, path, lesson, feedback, practice, league (guest and signed in), profile (guest and signed in), auth.

# Handoff – UI v2 (branch `v2/ui`)

Spec: `docs/spec/v2.md` (§7.1–§7.7, §8.2, §9, §10.2 "ui"). Every file touched is in the ui row of §10.1.
The file is named `ui-v2.md` like `content-a-v2.md` and the ownership table; the workflow asked for `v2-ui.md` – same document.

## What I built

| Spec | Where | What |
|---|---|---|
| §7.5 item keys + heAlt | `src/lib/exercises.ts` | Every exercise carries `itemKey` (choice → `w:…`, build/listen → `s:<lesson>:<i>` + `errors`) or `itemKeys` (match, parallel to `pairs`). Hebrew builds accept `[he, ...heAlt]`; the words of `heAlt[0]` missing from `he` are added to the bank on top of the 2–4 distractors. New exports: `wordChoice`, `buildSentence`, `vocabularyUpTo`, `exerciseType` (§6.1 table). The RNG call order for existing exercises is unchanged. |
| §7.2 answers | `LessonScreen.tsx`, `MatchExercise.tsx` | `LessonResult` now has `answers: ItemAnswer[]` (first attempt only – a position inside the original exercise list), `mistakes`, `firstTryCorrect`, `durationMs`. Match reports one answer per pair; a pair that was part of a wrong match (either side) is `correct:false`. `itemAnswers()` is the pure helper. |
| §7.2 review | `src/lib/review.ts` | `generateReview(srs, progress, rng, now)` (frozen signature) + `buildReview()` which also returns `source` (`due`/`mixed`/`practice`) and the due count for `review_start`. Due keys weakest first (up to 10), then upcoming, then – below 4 items – `generatePractice` exercises for other items. Words → choice in a random direction with distractors up to the word's lesson; sentences → build-en / listen (0.25) / build-he (0.2). Keys not in the course are skipped. |
| §7.2 path + App | `LearningPath.tsx`, `ReviewCard.tsx`, `App.tsx` | `useSrs(progress, account.user !== null)`; button "🧠 חזרה (N)" / "💪 תרגול" / disabled (`reviewButtonState`), pinned card at `due ≥ 3`. Lesson end → `srs.record(answers,'lesson')`; review end → `srs.record(answers,'review')` + `completePractice(p, REVIEW_XP)`. Review: `hearts={null}`, opens with 0 hearts. |
| §7.1 | `LearningPath.tsx` | "חדש!" chip on `isCatchUp` lessons (also " (חדש!)" in the aria-label), the path scrolls the current lesson to the centre on load. |
| §7.3 | `UnitIntro.tsx`, `RichTip.tsx`, `src/lib/intro-seen.ts` | Bottom sheet with title, level chip, goals, tip. Auto before a lesson in a unit with nothing completed and not in `baktana-english:intro-seen:v1`; "יאללה, מתחילים" marks it seen and opens the lesson. 📖 on every banner opens it manually. Level chip on every banner. `RichTip` renders `[[…]]` as `<bdi dir="ltr" lang="en">` (punctuation inside the brackets stays inside); goals go through it too (unit 2's goals contain `[[…]]`). |
| §7.6 (Should) | `TipCard.tsx` | `lesson.tip` card before the first exercise, "הבנתי" (or Enter). Not counted as an exercise. |
| §7.4 | `SignupPrompt.tsx`, `src/lib/signup-prompt.ts`, `LessonComplete.tsx` | Card on a lesson's completion screen (never after a review) by `signupRound()`; state `{ dismissCount, lastShownAt }` in `baktana-english:signup-prompt:v1`. "הרשמה" → `AuthScreen` register → back to the path. |
| §7.7 | `settings.ts`, `Profile.tsx`, `Onboarding.tsx`, `App.tsx` | `Settings.analytics` (default true, missing → true), switch "שליחת נתוני שימוש אנונימיים", onboarding line, `setAnalyticsEnabled` effect (declared before `app_open`). |
| §8.2 | `App.tsx`, `LessonScreen.tsx` | All ui events: `app_open` (once per launch), `onboarding_complete`, `lesson_start`, `exercise_answer`, `lesson_complete`, `lesson_abandon`, `hearts_out`, `review_start`, `review_complete`, `unit_intro_shown`, `signup_prompt_shown/accepted/dismissed`, `signup_complete`, `identify()` after every sign-in/up. |

## How to verify

```bash
npm install
npx tsc -b && npm run lint && npm test     # web: 17 files / 196 tests, server: 71
npx playwright test                        # 19 e2e: 17 pass, 2 skip (see below)
```

New unit tests: `src/lib/review.test.ts` (US-R2 AC1–AC4 – it mocks `dueKeys`/`upcomingKeys` with the §6.3 contract so it does not depend on the engine), `signup-prompt.test.ts` (US-S1), `intro-seen.test.ts` (US-I1), `exercises.test.ts` (keys on every exercise of every lesson, heAlt buildable + accepted, US-G1, `exerciseType`), `components.test.ts` (US-R1 `reviewButtonState`, `itemAnswers`, `parseRichTip`), `settings.test.ts`, `acceptance.test.ts` (US-R4 AC2, US-C2 AC4/AC5).

New e2e (`e2e/app.spec.ts`, "v2" block): US-I1, US-S1 AC1–AC3, US-R1 AC4, US-R4, US-T1 (skips while `src/lib/analytics.ts` is the no-op scaffold), US-U1 AC3 (skips while `isCatchUp` is the stub). Helper `openLesson()` gets past the intro and the tip card; the existing tests use it. Practice XP in the old account test is now the review's flat +10 (45 → 40).

Visual check with Playwright at 400×800, light and dark: onboarding, auto intro, intro from 📖, path with pinned review card and level chips, "חדש!" chips (with a temporary local stub of the unlock rule, not committed), tip card, review session, lesson complete with the sign-up card, profile switch.

## Decisions where the spec left room (keep other agents unaffected)

- **No match round in a review.** Allowed, not required, by §7.2; a match answer never moves an item to a higher box (§6.3 "eligible"), so due words get a choice each and the session has exactly up to 10 exercises (US-R2 AC1). Practice fill-up may still contain one match.
- **`exercise_answer` for a match** is one event per exercise (US-T1 AC1: 12–13 per lesson) with no `itemKey`, `exType:'match'`, `correct` = no wrong pair. Per-pair results go to SRS only.
- **Review XP** is exactly `REVIEW_XP` (10), no flawless bonus. The completion screen says "החזרה הושלמה!" (or "התרגול הושלם!" when the session came only from random practice).
- `review_complete.props.correct` = exercises right on the first attempt. `lesson_complete.props.heartsLeft` = hearts when the lesson ended. Durations are clamped to 0…`MAX_DURATION_MS`.
- `lesson_abandon` is sent for ✕ only (not for "חזרה למסלול" on the out-of-hearts screen – that is `hearts_out`).
- `UnitIntro` from 📖 shows "הבנתי" instead of "יאללה, מתחילים" (it starts nothing). ✕ / Escape / tap outside close an auto intro without marking it seen.
- After any sign-in/up the prompt is retired by setting `dismissCount` to 2 (no new field in the stored shape).
- `signup_complete.from`: `prompt`, `onboarding` (login link there), anything else `profile` (profile and league buttons).
- `AuthScreen.onSignedIn(res, mode)` gained a `mode` argument; `App` passes only `{ xp, accuracy }` to `account.reportLesson` (the richer `LessonResult` is never sent to the server).
- The out-of-hearts text now points to the review ("בחזרה אין הורדת לבבות").

## Notes for the integrator / other agents

- **backend:** "חדש!", the high-water unlock and `currentLessonId` light up as soon as `src/lib/progress.ts` is implemented – no ui change needed; the US-U1 AC3 e2e stops skipping then. The review button/card read `srs.due` and `srs.store` from `useSrs`; with the stub (nothing due) the button is "💪 תרגול" and builds a practice session.
- **bi:** events are sent exactly as in §8.2 through `track()`; match answers have no `itemKey` (above). The US-T1 e2e reads `baktana-english:events:v1` and expects an array of events with `name`.
- **content:** exercises read `heAlt`, `errors`, `tip`, `intro.goals` (goals may contain `[[…]]`).
- No new dependencies; no contract file touched.

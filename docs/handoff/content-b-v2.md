# Handoff v2 – content-b (Israeli English teacher)

Branch: `v2/content-b`, built on the scaffold commit `d315960` (my worktree started on `6ecce61`, so I fast-forwarded it to the spec commit first).

> Renamed at integration to the spec name (§10.1) `docs/handoff/content-b-v2.md`.

## What I built

| File | Content |
|---|---|
| `src/data/units/u04.ts` | §4.0 cleanup (u4l1 s3, u4l2 heAlt, u4l3 s1–s2) + `errors` on existing sentences + new `u4l4`, `u4l5`, `u4l6` |
| `src/data/units/u05.ts` | §4.0 heAlt (u5l2, u5l3) + `errors` on existing sentences + new `u5l4`, `u5l5` |
| `src/data/units/u06.ts` | §4.0 (question sound, heAlt in u6l2/u6l3) + `errors` on existing sentences + new `u6l4`, `u6l5` |
| `src/data/units/u10.ts` | `u10l1`–`u10l5` |
| `src/data/units/u11.ts` | `u11l1`–`u11l5` |
| `src/data/units/u12.ts` | `u12l1`–`u12l6` |
| `src/data/units/content-b.test.ts` | new test: lesson count/numbering per unit, 5 words with unique en/he and a Hebrew `sound`, 3–4 sentences, no word id or Hebrew reused across my units, heAlt on every "אתה …" sentence, and every lesson run through `generateExercises` with 4 seeds. Each build exercise must be buildable from its bank. Once ui adds heAlt to build-he exercises, `heAlt[0]` must be buildable too |
| `docs/curriculum.md` | updated to 12 units: unit table, E16–E27, a section for each unit, and the §5.4 style guide |

That makes 23 new lessons (u4: +3, u5: +2, u6: +2, u10: 5, u11: 5, u12: 6), all with ids and order exactly as in §4. Every new lesson also has a `tip` (Should, F16).

Existing lesson ids, word lists and sentence order are unchanged. The only sentences replaced are the §4.0 rows. `course.ts` is not touched: it already imports the unit files.

## Deviations from the spec (all small, listed per §4)

- **Gender heAlt beyond §4.0** (rule §5.4.6 / US-C2 AC4): `u4l2` s0 `בת כמה את?`, `u6l2` s3 `אני לא יודעת` (this one was already in §4.0).
- **Extra `alt` answers** (only more accepted answers; no main text changed): u4l5 s3 `Is it late already`; u4l6 s0 `I work on Sundays`, s3 `What day is today`; u5l5 s2 `We eat pizza often`; u10l1 s0/s3, u10l2 s0, u10l3 s2 (time word first); u10l2 s3 `They stayed home`; u11l2 s0, s1, s2 (`my grandma`); u11l3 s3 `…for the holiday`; u11l4 s1 `I think that it will rain`; u11l5 s2 `Sorry, I can't. I am busy`; u12l1 s0 without "please"; u12l3 s3 `My new phone's better`; u12l4 s1 `Eilat's the hottest…`; u12l6 s2 `Please, I need help`.
- **Extra `errors` tags** where the spec gave none but the sentence clearly trains a code: u11l1 s0 E4 (new shoes), u11l4 s2 E27, u12l1 s3 E1, u12l6 s1 E3 (my, not the), plus Should tags on all existing sentences in units 4–6 (by the "איפה מתורגל" column). u5l1 s3 has E2+E6. Sentences where no code fits honestly have no `errors`, rather than a misleading tag: u5l5 s2, u10l1 s3, u10l3 s1–s2, u11l1 s1–s2, u11l4 s3, u11l5 s1, u12l2 s3, u12l5 s2.
- No word, main `en` or main `he` was changed from §4.

## How to verify

```
npm install
npx vitest run src/data src/lib/exercises.test.ts   # content validator + solvability + my unit test
CONTENT_REPORT=1 npx vitest run src/data             # untaught-word report (warnings only)
npx tsc -b && npm run lint && npm test
```

## Notes for the integrator / other agents

- **Merge order:** content-b goes last. Before the merge, check word uniqueness across the whole course against content-a's units. I checked every word table in spec §4 (all 64 lessons, plus the existing words). No en/he collides, so if content-a followed the spec, `content.test.ts` passes after both merges.
- **ui (§7.5):** my test already covers build-he exercises that accept `heAlt`. When `answers` includes `heAlt[0]`, its tiles must be in the bank. Also, `abroad`/`לחו״ל` contains a gershayim (״). `tokenize` keeps it inside the tile, and `normalize` turns it into a space on both sides, so answers still compare correctly.
- **bi:** existing sentences in units 4–6 now carry `errors`. That is a tag-only change: indices and the number of sentences stay the same.
- **QA cross-review (§5.2):** content-a should review my English. I am happy to review content-a's Hebrew after the merge.

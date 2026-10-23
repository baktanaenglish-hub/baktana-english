# Handoff: content-a (v2)

Owner: content-a (native English-speaking ESL teacher). Spec: `docs/spec/v2.md` §4, §5, §10.

## What was built

| File | Contents |
|---|---|
| `src/data/units/u01.ts` | Cleanup from §4.0 + new `u1l4` (מילות נימוס), `u1l5` (נעים להכיר) |
| `src/data/units/u02.ts` | Cleanup from §4.0 + new `u2l3`, `u2l4`, `u2l5` |
| `src/data/units/u03.ts` | `heAlt` from §4.0 + new `u3l3`, `u3l4`, `u3l5` |
| `src/data/units/u07.ts` | Unit 7 in full: `u7l1`–`u7l6` |
| `src/data/units/u08.ts` | Unit 8 in full: `u8l1`–`u8l6` |
| `src/data/units/u09.ts` | Unit 9 in full: `u9l1`–`u9l5` |
| `src/data/units/content-a.test.ts` | Tests for the six units (see below) |

That makes 25 new lessons and 32 lessons in my units altogether. Every new lesson has 5 words with a `sound` and 4 sentences. Sentences carry `alt` for contractions and other wordings, `heAlt` for the feminine Hebrew form, and the `errors` codes listed in §4.

- **§4.0 cleanup, all rows done:** `u1l1` s0 → `Thanks, goodbye!`; `u1l2` you → `אתה/את` and `heAlt` on s0 and s1; `u1l3` s3 alt `I'm Dana`, `I am Dana`; `u2l2` s2 → `This is my father`; `heAlt` on `u3l1` s1 and on `u3l2` s0 and s1. Lesson ids, sentence order and sentence counts did not change.
- **(Should) `errors` on existing sentences** in units 1–3, following the "where practised" column of the error map in `docs/curriculum.md`. For example, `I am a boy` gets E1 and E2, and `I drink water` gets E12.
- **(Should) `tip`** on the lessons that introduce a new structure: `u1l2`, `u1l4`, `u1l5`, `u2l3`–`u2l5`, `u3l3`–`u3l5`, `u7l1`–`u7l6`, `u8l1`, `u8l4`, `u8l5` and `u9l1`–`u9l5`. Each tip is one or two Hebrew sentences, with English marked by `[[...]]`.

## How to verify

```
npm install
npx vitest run src/data src/lib/exercises.test.ts   # validator + my tests + solvability
npm test && npx tsc -b && npm run lint               # all pass in this worktree
CONTENT_REPORT=1 npx vitest run src/data/content.test.ts   # untaught-word warnings (info only)
```

`content-a.test.ts` checks that:
- the lesson ids are exactly the ones in the spec, in order;
- every lesson has 5 words, `en` and `he` are unique inside the lesson, and every word has a `sound`;
- every lesson has 3–4 sentences;
- lesson ids, word ids and Hebrew words are unique in the whole course;
- every sentence with a common contraction or full form (I am, he is, don't, there's, …) has an `alt`;
- no `errors` list is empty;
- every lesson builds solvable exercises through `generateExercises` with 4 seeded rngs. These are the same checks as in `src/lib/exercises.test.ts`: the choice answer is in the options with no duplicate options, the primary answer of every build exercise can be made from its bank, and every match exercise has at least 4 pairs.

## Changes from the spec (all small; §4 allows changes only for natural English or accepted answers)

1. **More accepted answers (`alt`).** Each one is a correct wording a learner could reasonably build:
   - `u7l1` s2: `There is no shop here`
   - `u7l2` s1: `Go straight ahead`
   - `u7l4` s3: `I'd like to buy this`, `I would like to buy this`
   - `u8l5` s0: `I am taking the bus today`, `I'm taking the bus today`
   - `u9l4` s2: the two mixed contractions (`I'm happy because it is Friday`, `I am happy because it's Friday`)
2. **Removed `alt`:**
   - `u8l5` s3: `The bus's slow`. In writing it reads as a possessive, so it is not good English to accept.
   - `u3l3` s2: `The menu please`. After normalisation it is the same as the main sentence, which already accepts it.
   - `u1l4` s3 (`Yes, please`) has no alt, as in the spec. A punctuation-only variant would add nothing.
3. **Kept as written in the spec:** the `u1l1` alt `Thanks goodbye`, even though it differs from the main sentence only in punctuation.
4. **Sentences without `errors`.** These have no `errors` in §4 either, on purpose, because they are fixed phrases:
   - `u1l4` s2, s3
   - `u1l5` s0
   - `u2l3` s3
   - `u3l4` s0
   - `u7l2` s1
   - `u7l4` s3
   - `u8l6` s2
   - `u9l2` s1
   - `u9l3` s0
   - `u9l5` s1, s3
5. **Handoff filename:** the workflow task named `docs/handoff/v2-content-a.md`, but the spec ownership table (§10.1) names this file, `docs/handoff/content-a-v2.md`. I followed the spec.

## Notes for the integrator and other agents

- `src/data/course.ts` already imports every unit file, so these lessons appear as soon as this branch is merged. No wiring is needed.
- **ui:** the build-he exercise does not yet accept `heAlt` answers, and the bank does not yet include `heAlt` words (§7.5, ui's job). Many sentences here have `heAlt`, for example `u2l4` s1 `I am happy` → `אני שמחה` for US-G1.
- **content-b, cross-review (§5.2):** please check the Hebrew and niqqud in my `sound` fields and in the `heAlt` forms.
- Words introduced in my units that content-b must not reuse: `bag`, `big`, `small`, `tall`, `happy`, `tired`, `late`, `ready`, `breakfast`, `lunch`, `dinner`, `shekel`, `price`, `phone`, `today`, `tomorrow`, `call`, `number` and the other words in u1–u3 and u7–u9. The course-wide uniqueness check in `src/data/content.test.ts` catches any collision after the merge.

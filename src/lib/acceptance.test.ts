/**
 * Pure-logic checks for the acceptance criteria in docs/user-stories.md.
 * Each test name starts with the story/criterion id it covers.
 */
import { describe, expect, it } from 'vitest';
import { allLessons, course } from '../data/course';
import { lessonResult } from '../components/LessonScreen';
import { isCorrect, tokenize } from './answer';
import { generateExercises } from './exercises';
import { reachesGoal, setDailyGoal } from './goals';
import { completePractice, generatePractice } from './practice';
import {
  DAILY_GOAL_XP,
  HEART_REFILL_MS,
  MAX_HEARTS,
  completeLesson,
  dateKey,
  initialProgress,
  isUnlocked,
  loseHeart,
  msUntilNextHeart,
  refresh,
  shiftDateKey,
  visibleStreak,
  type Progress,
} from './progress';
import { seededRng } from './random';
import { mergeProgress } from './sync';
import { REVIEW_XP } from '../../shared/srs';
import { wordKey } from '../../shared/item-keys';
import { buildSentence } from './exercises';

const at = (d: number, hour = 12, min = 0) => new Date(2026, 9, d, hour, min).getTime();
const MIN = 60 * 1000;

describe('lesson structure (US-L1 … US-L4)', () => {
  it('US-L1 AC1/AC2: 5 choices, then a match, then sentence and speaking exercises; 3 sentences → 14, 4 → 15', () => {
    for (const lesson of allLessons) {
      const n = lesson.sentences.length;
      const exercises = generateExercises(lesson, seededRng(1));
      expect(exercises).toHaveLength(lesson.words.length + 1 + n + 2 + (n > 1 ? 1 : 0) + Math.min(2, n));
      expect(exercises.slice(0, lesson.words.length).every((e) => e.kind === 'choice')).toBe(true);
      expect(exercises[lesson.words.length].kind).toBe('match');
      const rest = exercises.slice(lesson.words.length + 1);
      expect(rest.every((e) => ['build', 'type', 'blank', 'speak'].includes(e.kind))).toBe(true);
      // Fill in the blank (US-K3): at most one per lesson, never on the typed sentence.
      expect(rest.filter((e) => e.kind === 'blank').length).toBeLessThanOrEqual(1);
      expect(rest.filter((e) => e.kind === 'speak')).toHaveLength(Math.min(2, n));
      const sentences = rest.filter((e) => e.kind === 'build' || e.kind === 'type');
      expect(sentences.filter((e) => e.listen)).toHaveLength(n > 1 ? 2 : 1);
      expect(sentences.filter((e) => e.kind === 'build' && e.answerLang === 'he')).toHaveLength(1);
      // Typing (US-K1): none in unit 1, one translation from unit 2, plus typing what you hear from unit 4.
      const unit = course.findIndex((u) => u.lessons.includes(lesson));
      const typed = rest.filter((e) => e.kind === 'type');
      expect(typed.filter((e) => !e.listen)).toHaveLength(unit >= 1 ? 1 : 0);
      expect(typed.filter((e) => e.listen)).toHaveLength(unit >= 3 ? 1 : 0);
      if (lesson.words.length === 5) expect(exercises).toHaveLength(n === 3 ? 14 : 15);
    }
  });

  it('US-L2 AC1/AC2: four distinct options with exactly one answer; English prompts alternate', () => {
    for (const lesson of allLessons) {
      for (const ex of generateExercises(lesson, seededRng(5))) {
        if (ex.kind !== 'choice') continue;
        expect(ex.options).toHaveLength(4);
        expect(new Set(ex.options).size).toBe(4);
        expect(ex.options.filter((o) => o === ex.answer)).toHaveLength(1);
      }
    }
  });

  it('US-L3 AC1: the bank holds every answer tile plus 2–4 distractors (+ the words of heAlt)', () => {
    for (const lesson of allLessons) {
      for (const ex of generateExercises(lesson, seededRng(9))) {
        if (ex.kind !== 'build') continue;
        const tiles = tokenize(ex.answers[0]);
        // v2 §7.5: words of the first Hebrew alternative are added on top of the distractors.
        const altWords =
          ex.answerLang === 'he' && ex.answers.length > 1
            ? new Set(tokenize(ex.answers[1]).filter((t) => !tiles.includes(t))).size
            : 0;
        const extra = ex.bank.length - tiles.length - altWords;
        expect(extra).toBeGreaterThanOrEqual(2);
        expect(extra).toBeLessThanOrEqual(4);
      }
    }
  });

  it('US-L3 AC2/AC3: checking ignores case, punctuation, spaces, niqqud and accepts alt answers', () => {
    expect(isCorrect('yes thanks', ['Yes, thanks'])).toBe(true);
    expect(isCorrect('  YES ,  thanks!! ', ['Yes, thanks'])).toBe(true);
    expect(isCorrect('כֵּן תּוֹדָה', ['כן, תודה'])).toBe(true);
    expect(isCorrect("I'm good", ['I am good', "I'm good"])).toBe(true);
    expect(isCorrect('thanks yes', ['Yes, thanks'])).toBe(false);
  });

  it('US-L3 AC4: listening exercises speak an English prompt', () => {
    const builds = generateExercises(allLessons[0], seededRng(2)).filter((e) => e.kind === 'build');
    for (const ex of builds.filter((e) => e.listen)) expect(ex.promptLang).toBe('en');
  });

  it('US-L4 AC1: matching shows at most 5 pairs from the lesson', () => {
    for (const lesson of allLessons) {
      const match = generateExercises(lesson, seededRng(4)).find((e) => e.kind === 'match');
      expect(match && match.kind === 'match' && match.pairs.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('lesson result and unlocking (US-L6, US-L7, US-P1)', () => {
  it('US-L6 AC1/AC2: +15 and 100% when flawless, otherwise +10 and round(T/(T+M)·100)', () => {
    expect(lessonResult(12, 0)).toEqual({ xp: 15, accuracy: 100 });
    expect(lessonResult(12, 3)).toEqual({ xp: 10, accuracy: 80 });
  });

  it('US-L6 AC3 / US-L7 AC1: completing a lesson unlocks the next, also across units', () => {
    let p = initialProgress(at(1));
    for (let i = 0; i < allLessons.length - 1; i++) {
      expect(isUnlocked(p, allLessons[i + 1].id)).toBe(false);
      p = completeLesson(p, allLessons[i].id, 10, at(1));
      expect(isUnlocked(p, allLessons[i + 1].id)).toBe(true);
    }
    const firstOfUnit2 = course[1].lessons[0].id;
    const lastOfUnit1 = course[0].lessons.at(-1)!.id;
    const only = completeLesson(initialProgress(), lastOfUnit1, 10);
    expect(isUnlocked(only, firstOfUnit2)).toBe(true);
  });

  it('US-L6 AC4 / US-P1 AC2: repeating a lesson counts it again and awards XP again', () => {
    let p = completeLesson(initialProgress(at(1)), 'u1l1', 15, at(1));
    p = completeLesson(p, 'u1l1', 10, at(1, 13));
    expect(p.completed.u1l1).toBe(2);
    expect(p.xp).toBe(25);
  });

  it('US-L7 AC2: unknown lessons are never unlocked', () => {
    expect(isUnlocked(initialProgress(), 'nope')).toBe(false);
  });
});

describe('hearts (US-H1, US-H2)', () => {
  it('US-H1 AC1/AC2: a mistake costs one heart, never below zero', () => {
    let p = initialProgress(at(1));
    p = loseHeart(p, at(1));
    expect(p.hearts).toBe(4);
    for (let i = 0; i < 10; i++) p = loseHeart(p, at(1));
    expect(p.hearts).toBe(0);
  });

  it('US-H2 AC1: dropping from 5 to 4 at t is back to 5 at t+30 min', () => {
    const p = loseHeart(initialProgress(at(1)), at(1));
    expect(refresh(p, at(1) + HEART_REFILL_MS - 1).hearts).toBe(4);
    expect(refresh(p, at(1) + HEART_REFILL_MS).hearts).toBe(5);
  });

  it('US-H2 AC2/AC4: 2 hearts with the clock started 65 min ago → 4 hearts, next one in 25 min', () => {
    const p: Progress = { ...initialProgress(), hearts: 2, heartsUpdatedAt: at(1) };
    const now = at(1) + 65 * MIN;
    const r = refresh(p, now);
    expect(r.hearts).toBe(4);
    expect(Math.ceil(msUntilNextHeart(r, now) / MIN)).toBe(25);
  });

  it('US-H2 AC3/AC5: never above 5, even after a long time closed', () => {
    const p: Progress = { ...initialProgress(), hearts: 0, heartsUpdatedAt: at(1) };
    expect(refresh(p, at(10)).hearts).toBe(MAX_HEARTS);
    expect(msUntilNextHeart(refresh(p, at(10)), at(10))).toBe(0);
  });
});

describe('streak (US-S1, US-S2)', () => {
  it('US-S1 AC1–AC3: starts at 1, grows on consecutive days, not twice a day', () => {
    let p = completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1, 9));
    expect(p.streak).toBe(1);
    p = completeLesson(p, 'u1l2', 10, at(1, 22));
    expect(p.streak).toBe(1);
    p = { ...p, streak: 3 };
    p = completeLesson(p, 'u1l3', 10, at(2, 8));
    expect(p.streak).toBe(4);
  });

  it('US-S1 AC4: a day is the local calendar date', () => {
    expect(dateKey(at(1, 0, 1))).toBe('2026-10-01');
    expect(dateKey(at(1, 23, 59))).toBe('2026-10-01');
    const late = completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1, 23, 50));
    expect(completeLesson(late, 'u1l2', 10, at(2, 0, 10)).streak).toBe(2);
  });

  it('US-S2 AC1–AC3: shown until the end of the next day, then 0; restarts at 1', () => {
    const p = { ...completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1)), streak: 3 };
    expect(visibleStreak(p, at(2, 23))).toBe(3);
    expect(visibleStreak(p, at(3, 0, 1))).toBe(0);
    expect(completeLesson(p, 'u1l2', 10, at(3)).streak).toBe(1);
  });

  // Regression: the server used its own time zone for the streak date; it now passes the learner's date.
  it('counts the streak by an explicitly given local date (server side)', () => {
    let p = completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1, 20), '2026-09-30');
    expect(p.lastActiveDate).toBe('2026-09-30');
    p = completeLesson(p, 'u1l2', 10, at(2, 20), '2026-10-01');
    expect(p).toMatchObject({ streak: 2, lastActiveDate: '2026-10-01', xpToday: 10 });
    p = completeLesson(p, 'u1l3', 15, at(2, 21), '2026-10-01');
    expect(p).toMatchObject({ streak: 2, xpToday: 25 });
  });

  it('shiftDateKey crosses month, year and leap-day boundaries', () => {
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('daily goal (US-D1)', () => {
  it('US-D1 AC2: a new day resets XP of the day but not the total', () => {
    const p = { ...completeLesson(initialProgress(at(1)), 'u1l1', 25, at(1)) };
    const next = refresh(p, at(2));
    expect(next.xpToday).toBe(0);
    expect(next.xp).toBe(25);
  });

  it('US-D1 AC3: two flawless lessons reach the default goal of 30', () => {
    const p = initialProgress(at(1));
    const one = completeLesson(p, 'u1l1', 15, at(1));
    const two = completeLesson(one, 'u1l2', 15, at(1));
    expect(two.xpToday).toBe(DAILY_GOAL_XP);
    expect(reachesGoal(one, two)).toBe(true);
    expect(reachesGoal(p, one)).toBe(false);
    expect(reachesGoal(one, completeLesson(one, 'u1l2', 15, at(1)))).toBe(true);
    expect(reachesGoal(setDailyGoal(p, 50), setDailyGoal(two, 50))).toBe(false);
  });
});

describe('practice (US-P2)', () => {
  it('US-P2 AC1: built only from completed lessons', () => {
    const p = completeLesson(initialProgress(), 'u1l1', 10);
    const words = new Set(allLessons[0].words.flatMap((w) => [w.en, w.he]));
    const sentences = new Set(allLessons[0].sentences.flatMap((s) => [s.en, s.he]));
    for (const ex of generatePractice(p, seededRng(11))) {
      if (ex.kind === 'choice') expect(words.has(ex.prompt)).toBe(true);
      if (ex.kind === 'build') expect(sentences.has(ex.prompt)).toBe(true);
      if (ex.kind === 'match') for (const pair of ex.pairs) expect(words.has(pair.en)).toBe(true);
    }
  });

  it('US-P2 AC2: unlocks nothing and keeps completion counts, but counts for XP, streak and goal', () => {
    const p = completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1));
    const after = completePractice(p, 10, at(2));
    expect(after.completed).toEqual({ u1l1: 1 });
    expect(isUnlocked(after, 'u1l3')).toBe(false);
    expect(after).toMatchObject({ xp: 20, xpToday: 10, streak: 2 });
  });
});

describe('client merge (US-A3)', () => {
  const local: Progress = { ...initialProgress(at(18)), xp: 45, completed: { u1l1: 1, u1l2: 1 } };
  const server: Progress = { ...initialProgress(at(18)), xp: 30, completed: { u1l1: 2 } };

  it('US-A3 AC1/AC2: never loses XP or lessons', () => {
    const merged = mergeProgress(local, server, at(18));
    expect(merged.xp).toBe(45);
    expect(merged.completed).toEqual({ u1l1: 2, u1l2: 1 });
  });

  it('US-A3 AC4: merging again changes nothing', () => {
    const once = mergeProgress(local, server, at(18));
    expect(mergeProgress(once, server, at(18))).toEqual(once);
  });
});

describe('content (US-C1)', () => {
  // v2 (docs/spec/v2.md §4): the course grows unit by unit towards 12 units / 64 lessons.
  it('US-C1 AC3: at least 6 units and 16 lessons, each with 5 words and 3–4 sentences', () => {
    expect(course.length).toBeGreaterThanOrEqual(6);
    expect(allLessons.length).toBeGreaterThanOrEqual(16);
    for (const lesson of allLessons) {
      expect(lesson.words).toHaveLength(5);
      expect(lesson.sentences.length).toBeGreaterThanOrEqual(3);
      expect(lesson.sentences.length).toBeLessThanOrEqual(4);
    }
  });

  it('US-C1 AC4: existing lesson ids keep their places', () => {
    const ids = allLessons.map((l) => l.id);
    expect(ids.slice(0, 3)).toEqual(['u1l1', 'u1l2', 'u1l3']);
    expect(ids).toContain('u2l1');
    expect(ids).toContain('u3l1');
  });
});

describe('v2 – review reward and gendered answers (docs/spec/v2.md §9)', () => {
  it('US-R4 AC2: a review gives +10 XP, counts for goal and streak, and leaves completed alone', () => {
    const p = completeLesson(initialProgress(at(1)), 'u1l1', 10, at(1));
    const after = completePractice(p, REVIEW_XP, at(2));
    expect(REVIEW_XP).toBe(10);
    expect(after).toMatchObject({ xp: 20, xpToday: 10, streak: 2, completed: { u1l1: 1 } });
  });

  it('US-C2 AC4: every gendered Hebrew build accepts the feminine form', () => {
    for (const lesson of allLessons) {
      lesson.sentences.forEach((s, i) => {
        if (!s.heAlt) return;
        const ex = buildSentence(lesson, i, 'he', seededRng(i));
        if (ex.kind !== 'build') return;
        for (const alt of s.heAlt) expect(isCorrect(alt, ex.answers)).toBe(true);
      });
    }
  });

  it('US-C2 AC5: "you" is shown as אתה/את in the choice exercise', () => {
    const lesson = allLessons.find((l) => l.words.some((w) => w.en === 'you'))!;
    const you = generateExercises(lesson, seededRng(1)).find(
      (e) => e.kind === 'choice' && e.itemKey === wordKey({ en: 'you' }),
    );
    expect(you && you.kind === 'choice' && [you.prompt, you.answer]).toContain('אתה/את');
  });
});

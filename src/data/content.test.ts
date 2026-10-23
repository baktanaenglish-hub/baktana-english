/**
 * Content validator (docs/spec/v2.md §5.5). Runs in `npm test` / CI.
 * Created by the analyst scaffold; owned by the BI agent from v2 on (content authors only read it).
 * Set CONTENT_REPORT=1 to print sentences that use words not taught yet (a warning, not a failure).
 */
import { describe, expect, it } from 'vitest';
import { isItemKey, sentenceKey, wordId, wordKey } from '../../shared/item-keys';
import { tokenize } from '../lib/answer';
import type { CefrLevel, ErrorCode } from '../types';
import { allLessons, allUnits, course } from './course';

/** Lessons learners may have saved progress for: they must exist, in this relative order. */
const FROZEN_LESSONS: Record<string, number> = {
  // lesson id → number of sentences in the v1 release (sentences may be appended, never removed)
  u1l1: 3, u1l2: 3, u1l3: 4, u2l1: 3, u2l2: 3, u3l1: 3, u3l2: 4, u4l1: 4,
  u4l2: 4, u4l3: 4, u5l1: 4, u5l2: 4, u5l3: 4, u6l1: 4, u6l2: 4, u6l3: 4,
};

const ERROR_CODES = new Set<ErrorCode>(Array.from({ length: 27 }, (_, i) => `E${i + 1}` as ErrorCode));

describe('content: structure', () => {
  it('has units u1…u12 in order, each with a level and an intro tip', () => {
    expect(allUnits.map((u) => u.id)).toEqual(allUnits.map((_, i) => `u${i + 1}`));
    for (const unit of allUnits) {
      expect(unit.level, unit.id).toBeTruthy();
      expect(unit.intro?.tip.trim().length ?? 0, `${unit.id} intro.tip`).toBeGreaterThan(10);
      expect(unit.title.trim(), unit.id).not.toBe('');
      expect(unit.color, unit.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps every frozen lesson id, in its original relative order, without dropping sentences', () => {
    const order = allLessons.map((l) => l.id).filter((id) => id in FROZEN_LESSONS);
    expect(order).toEqual(Object.keys(FROZEN_LESSONS));
    for (const lesson of allLessons) {
      const before = FROZEN_LESSONS[lesson.id];
      if (before !== undefined) expect(lesson.sentences.length, lesson.id).toBeGreaterThanOrEqual(before);
    }
  });

  it('names lessons u<unit>l<n>, numbered 1…n inside each unit', () => {
    for (const unit of course) {
      unit.lessons.forEach((lesson, i) => expect(lesson.id).toBe(`${unit.id}l${i + 1}`));
    }
  });

  it('has 5 words and 3–4 sentences per lesson, all with Hebrew and a transliteration', () => {
    for (const lesson of allLessons) {
      expect(lesson.title.trim(), lesson.id).not.toBe('');
      expect(lesson.words.length, lesson.id).toBe(5);
      expect(lesson.sentences.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.sentences.length, lesson.id).toBeLessThanOrEqual(4);
      for (const w of lesson.words) {
        expect(w.he.trim(), `${lesson.id} ${w.en}`).not.toBe('');
        expect(w.sound?.trim(), `${lesson.id} ${w.en} sound`).toBeTruthy();
      }
    }
  });
});

describe('content: words and sentences', () => {
  it('uses every word id and every Hebrew translation only once in the whole course', () => {
    const ids = new Map<string, string>();
    const he = new Map<string, string>();
    for (const lesson of allLessons) {
      for (const w of lesson.words) {
        const id = wordId(w);
        expect(ids.get(id), `word "${id}" in ${lesson.id} already taught in ${ids.get(id)}`).toBeUndefined();
        expect(he.get(w.he), `Hebrew "${w.he}" in ${lesson.id} already used in ${he.get(w.he)}`).toBeUndefined();
        ids.set(id, lesson.id);
        he.set(w.he, lesson.id);
      }
    }
  });

  it('keeps sentences short and their extras well-formed', () => {
    for (const lesson of allLessons) {
      for (const s of lesson.sentences) {
        const n = tokenize(s.en).length;
        expect(n, `${lesson.id} "${s.en}"`).toBeGreaterThanOrEqual(1);
        expect(n, `${lesson.id} "${s.en}"`).toBeLessThanOrEqual(8);
        expect(s.he.trim(), `${lesson.id} "${s.en}"`).not.toBe('');
        for (const a of [...(s.alt ?? []), ...(s.heAlt ?? [])]) expect(a.trim(), `${lesson.id} "${s.en}"`).not.toBe('');
        expect(s.heAlt ?? [], `${lesson.id} heAlt repeats he`).not.toContain(s.he);
        for (const code of s.errors ?? []) expect(ERROR_CODES.has(code), `${lesson.id} ${code}`).toBe(true);
      }
    }
  });

  it('reports words used in sentences before they are taught (warning only)', () => {
    const taught = new Set<string>();
    const report: string[] = [];
    for (const lesson of allLessons) {
      for (const w of lesson.words) for (const t of tokenize(w.en.toLowerCase())) taught.add(t);
      for (const s of lesson.sentences) {
        const missing = tokenize(s.en.toLowerCase()).filter((t) => !taught.has(t));
        if (missing.length > 0) report.push(`${lesson.id}: "${s.en}" → ${missing.join(', ')}`);
      }
    }
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
    if (env?.CONTENT_REPORT) console.info(`Untaught words:\n${report.join('\n')}`);
    expect(Array.isArray(report)).toBe(true);
  });
});

/** CEFR levels in course order: a unit never drops below the level of the unit before it. */
const LEVEL_ORDER: CefrLevel[] = ['Pre-A1', 'A1', 'A1+', 'A2'];

describe('content: keys for spaced repetition and analytics (BI)', () => {
  it('gives every word and sentence a valid, unique item key (w:<wordId> / s:<lessonId>:<index>)', () => {
    const keys = new Set<string>();
    for (const lesson of allLessons) {
      const lessonKeys = [...lesson.words.map(wordKey), ...lesson.sentences.map((_, i) => sentenceKey(lesson.id, i))];
      for (const key of lessonKeys) {
        // Keys go into srs_state.item_key and events.item_key (at most 80 characters).
        expect(isItemKey(key), `${lesson.id} ${key}`).toBe(true);
        expect(keys.has(key), `${lesson.id} ${key} duplicated`).toBe(false);
        keys.add(key);
      }
    }
  });

  it('uses lesson ids the events table and the lesson funnel can store and sort', () => {
    for (const lesson of allLessons) {
      // events.lesson_id is at most 12 characters; v_lesson_funnel parses unit and lesson number from the id.
      expect(lesson.id.length, lesson.id).toBeLessThanOrEqual(12);
      expect(lesson.id, lesson.id).toMatch(/^u\d{1,2}l\d{1,2}$/);
    }
  });

  it('raises the CEFR level along the course, never lowering it', () => {
    let previous = 0;
    for (const unit of allUnits) {
      const level = LEVEL_ORDER.indexOf(unit.level as CefrLevel);
      expect(level, `${unit.id} level ${unit.level}`).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it('tags each sentence with an error code at most once (keeps per-code accuracy honest)', () => {
    for (const lesson of allLessons) {
      for (const s of lesson.sentences) {
        const codes = s.errors ?? [];
        expect(new Set(codes).size, `${lesson.id} "${s.en}" ${codes.join(',')}`).toBe(codes.length);
      }
    }
  });
});

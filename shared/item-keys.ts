/**
 * Item keys shared by spaced repetition (src/lib/srs.ts), the review generator,
 * analytics and the dashboards. Spec: docs/spec/v2.md §6.2.
 *
 * - word:     `w:<wordId>` – one learning state per word across the whole course;
 * - sentence: `s:<lessonId>:<index>` – index of the sentence inside its lesson (0-based).
 *
 * Because sentence keys use the position, sentences inside an existing lesson are never
 * reordered or deleted; new ones are appended (style rule in docs/spec/v2.md §5.4).
 * Contract file – owned by the backend agent, changes are additive only.
 */
import type { Word } from '../src/types';

export type ItemKind = 'word' | 'sentence';

export interface ParsedItemKey {
  kind: ItemKind;
  /** wordId for words, lessonId for sentences. */
  id: string;
  /** Sentence index (sentences only). */
  index?: number;
}

/** Longest key accepted by the backends. */
export const MAX_ITEM_KEY_LENGTH = 80;

const ITEM_KEY_RE = /^(w:[^\s].{0,77}|s:u\d{1,2}l\d{1,2}:\d{1,2})$/;

/** The stable id of a word: `word.id`, or the English text lower-cased and trimmed. */
export function wordId(word: Pick<Word, 'en' | 'id'>): string {
  return (word.id ?? word.en).trim().toLowerCase();
}

export function wordKey(word: Pick<Word, 'en' | 'id'>): string {
  return `w:${wordId(word)}`;
}

export function sentenceKey(lessonId: string, index: number): string {
  return `s:${lessonId}:${index}`;
}

/** True for strings shaped like a word or sentence key (used to sanitize uploads). */
export function isItemKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_ITEM_KEY_LENGTH && ITEM_KEY_RE.test(value);
}

export function parseItemKey(key: string): ParsedItemKey | null {
  if (!isItemKey(key)) return null;
  if (key.startsWith('w:')) return { kind: 'word', id: key.slice(2) };
  const [, lessonId, index] = key.split(':');
  return { kind: 'sentence', id: lessonId, index: Number(index) };
}

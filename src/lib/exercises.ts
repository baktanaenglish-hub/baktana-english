import { sentenceKey, wordKey } from '../../shared/item-keys';
import { allLessons, course } from '../data/course';
import type { Exercise, ExerciseType, Lesson, Word } from '../types';
import { tokenize } from './answer';
import { blankSentence } from './blank';
import { pickDistinct, shuffle, type Rng } from './random';

function lessonsUpTo(lesson: Lesson): Lesson[] {
  const index = allLessons.findIndex((l) => l.id === lesson.id);
  return index === -1 ? [lesson] : allLessons.slice(0, index + 1);
}

/** Words from this lesson and every lesson before it – used for distractors. */
export function vocabularyUpTo(lesson: Lesson): Word[] {
  return lessonsUpTo(lesson).flatMap((l) => l.words);
}

function tilesUpTo(lesson: Lesson, lang: 'en' | 'he'): string[] {
  return lessonsUpTo(lesson).flatMap((l) => l.sentences.flatMap((s) => tokenize(s[lang])));
}

/** A multiple-choice question about one word, in either direction. */
export function wordChoice(word: Word, vocab: Word[], toEnglish: boolean, rng: Rng): Exercise {
  const lang = toEnglish ? 'en' : 'he';
  const answer = word[lang];
  const distractors = pickDistinct(
    vocab.map((w) => w[lang]),
    3,
    [answer],
    rng,
  );
  return {
    kind: 'choice',
    prompt: toEnglish ? word.he : word.en,
    promptLang: toEnglish ? 'he' : 'en',
    options: shuffle([answer, ...distractors], rng),
    answer,
    itemKey: wordKey(word),
  };
}

/**
 * Sentence building from a word bank. When answering in Hebrew the other forms
 * (`heAlt`, mainly feminine) are accepted too, and the words the first one needs are
 * added to the bank (they count as distractors for the main answer).
 */
export function buildSentence(
  lesson: Lesson,
  index: number,
  answerLang: 'en' | 'he',
  rng: Rng,
  listen = false,
): Exercise {
  const sentence = lesson.sentences[index];
  const promptLang = listen ? 'en' : answerLang === 'en' ? 'he' : 'en';
  const tiles = tokenize(sentence[answerLang]);
  const heAlt = answerLang === 'he' ? (sentence.heAlt ?? []) : [];
  const altTiles = heAlt.length > 0 ? [...new Set(tokenize(heAlt[0]).filter((t) => !tiles.includes(t)))] : [];
  const extra = pickDistinct(
    tilesUpTo(lesson, answerLang),
    Math.min(4, Math.max(2, tiles.length)),
    [...tiles, ...altTiles],
    rng,
  );
  return {
    kind: 'build',
    prompt: sentence[promptLang],
    promptLang,
    answerLang,
    bank: shuffle([...tiles, ...altTiles, ...extra], rng),
    answers: answerLang === 'en' ? [sentence.en, ...(sentence.alt ?? [])] : [sentence.he, ...heAlt],
    listen,
    itemKey: sentenceKey(lesson.id, index),
    ...(sentence.errors?.length ? { errors: sentence.errors } : {}),
  };
}

/** Typing: translate one of the lesson's sentences into English, or type it after hearing it. */
export function typeSentence(lesson: Lesson, index: number, listen = false): Exercise {
  const sentence = lesson.sentences[index];
  return {
    kind: 'type',
    prompt: listen ? sentence.en : sentence.he,
    listen,
    answers: [sentence.en, ...(sentence.alt ?? [])],
    itemKey: sentenceKey(lesson.id, index),
    ...(sentence.errors?.length ? { errors: sentence.errors } : {}),
  };
}

/** Lessons of the first unit only build from word banks; typing starts in unit 2, typing what you hear in unit 4. */
export const TYPING_FROM_UNIT = 1;
export const TYPED_LISTENING_FROM_UNIT = 3;

/** Zero-based position of the lesson's unit in the course (-1 when unknown). */
function unitIndexOf(lesson: Lesson): number {
  return course.findIndex((u) => u.lessons.some((l) => l.id === lesson.id));
}

/** Speaking: read one of the lesson's English sentences out loud. */
export function speakSentence(lesson: Lesson, index: number): Exercise {
  const sentence = lesson.sentences[index];
  return { kind: 'speak', prompt: sentence.en, he: sentence.he, answers: [sentence.en, ...(sentence.alt ?? [])] };
}

/** Drops the speaking exercises – for devices without speech recognition, or when the learner turned them off. */
export function withoutSpeaking(exercises: Exercise[]): Exercise[] {
  return exercises.filter((e) => e.kind !== 'speak');
}

/** The exercise type reported to analytics (docs/spec/v2.md §6.1). */
export function exerciseType(exercise: Exercise): ExerciseType {
  if (exercise.kind === 'match') return 'match';
  if (exercise.kind === 'speak') return 'speak';
  if (exercise.kind === 'choice') return exercise.promptLang === 'he' ? 'choice-en' : 'choice-he';
  // Typed and fill-in-the-blank answers are reported like their word-bank twins (analytics marks
  // them with props.typed / props.blank), so the dashboards and events table need no new types.
  if (exercise.kind === 'type') return exercise.listen ? 'listen' : 'build-en';
  if (exercise.kind === 'blank') return 'build-en';
  if (exercise.listen) return 'listen';
  return exercise.answerLang === 'en' ? 'build-en' : 'build-he';
}

function shortestSentence(lesson: Lesson): number {
  let best = 0;
  lesson.sentences.forEach((s, i) => {
    if (s.en.length < lesson.sentences[best].en.length) best = i;
  });
  return best;
}

/**
 * Builds the exercise sequence for a lesson: new words first (recognition),
 * then a matching round, then sentence building, listening and speaking.
 * Every exercise but speaking carries its spaced-repetition item key(s).
 */
export function generateExercises(lesson: Lesson, rng: Rng = Math.random): Exercise[] {
  const vocab = vocabularyUpTo(lesson);
  const exercises: Exercise[] = lesson.words.map((word, i) => wordChoice(word, vocab, i % 2 === 0, rng));

  const pairs = shuffle(lesson.words, rng).slice(0, 5);
  exercises.push({ kind: 'match', pairs, itemKeys: pairs.map(wordKey) });

  const n = lesson.sentences.length;
  const unit = unitIndexOf(lesson);
  // From unit 2 the shortest sentence is typed instead of built from tiles (free recall).
  const typed = unit >= TYPING_FROM_UNIT && n > 0 ? shortestSentence(lesson) : -1;
  // One other sentence becomes fill-in-the-blank, when it has a word worth blanking.
  const blank = n > 1 ? (Math.max(typed, 0) + 1) % n : -1;
  const practice: Exercise[] = lesson.sentences.map((_, i) => {
    if (i === typed) return typeSentence(lesson, i);
    return (i === blank && blankSentence(lesson, i, rng)) || buildSentence(lesson, i, 'en', rng);
  });
  if (n > 0) {
    practice.push(
      unit >= TYPED_LISTENING_FROM_UNIT ? typeSentence(lesson, 0, true) : buildSentence(lesson, 0, 'en', rng, true),
    );
    practice.push(buildSentence(lesson, n - 1, 'he', rng));
  }
  if (n > 1) {
    practice.push(buildSentence(lesson, 1, 'en', rng, true));
  }
  // Two sentences to say out loud (Duolingo-style speaking practice).
  for (const index of shuffle([...Array(n).keys()], rng).slice(0, 2)) practice.push(speakSentence(lesson, index));
  exercises.push(...shuffle(practice, rng));
  return exercises;
}

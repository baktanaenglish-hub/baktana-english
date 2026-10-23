import { describe, expect, it } from 'vitest';
import { checkTyped, editDistance } from './typing';

describe('editDistance', () => {
  it('counts a swap of neighbours as one edit', () => {
    expect(editDistance('teh', 'the')).toBe(1);
    expect(editDistance('freind', 'friend')).toBe(1);
    expect(editDistance('cat', 'dog')).toBe(3);
  });
});

describe('checkTyped', () => {
  const answers = ['My brother works in Tel Aviv', "My brother's working in Tel Aviv"];

  it('accepts exact answers regardless of case and punctuation', () => {
    expect(checkTyped('my brother works in tel aviv.', answers)).toEqual({ kind: 'correct' });
    expect(checkTyped('  My   Brother works in Tel-Aviv ', answers)).toEqual({ kind: 'correct' });
    expect(checkTyped("I'm fine, thanks!", ['I am fine, thanks', "I'm fine thanks"])).toEqual({ kind: 'correct' });
  });

  it('forgives one spelling slip and shows the right spelling', () => {
    expect(checkTyped('My brohter works in Tel Aviv', answers)).toEqual({ kind: 'typo', expected: answers[0] });
    expect(checkTyped('My brother works in Tel Avive', answers).kind).toBe('typo');
  });

  it('keeps grammar mistakes wrong (third person -s, past -ed)', () => {
    expect(checkTyped('My brother work in Tel Aviv', answers).kind).toBe('wrong');
    expect(checkTyped('I watch TV yesterday', ['I watched TV yesterday']).kind).toBe('wrong');
  });

  it('does not forgive slips in short words or missing words', () => {
    expect(checkTyped('My brother works on Tel Aviv', answers).kind).toBe('wrong');
    expect(checkTyped('My brother works Tel Aviv', answers).kind).toBe('wrong');
    expect(checkTyped('Brohter works in Tel Aviv', answers).kind).toBe('wrong');
  });

  it('allows two slips only in longer sentences', () => {
    expect(checkTyped('Thsi is good', ['This is good']).kind).toBe('typo');
    expect(checkTyped('My brohter wroks in Tel Aviv', answers).kind).toBe('typo');
    expect(checkTyped('Hlelo frined', ['Hello friend']).kind).toBe('wrong');
  });

  it('spots a Hebrew keyboard and empty input', () => {
    expect(checkTyped('יקךךם', ['hello'])).toEqual({ kind: 'hebrew' });
    expect(checkTyped('  ?! ', ['hello'])).toEqual({ kind: 'empty' });
  });
});

describe('typed answers in lessons', () => {
  it('reports typed exercises like their word-bank twins, with the sentence key and errors', async () => {
    const { itemAnswers } = await import('../components/LessonScreen');
    const { exerciseType, typeSentence } = await import('./exercises');
    const { allLessons } = await import('../data/course');
    const lesson = allLessons.find((l) => l.sentences.some((s) => s.errors?.length))!;
    const index = lesson.sentences.findIndex((s) => s.errors?.length);
    const typed = typeSentence(lesson, index);
    expect(exerciseType(typed)).toBe('build-en');
    expect(exerciseType(typeSentence(lesson, index, true))).toBe('listen');
    expect(itemAnswers(typed, true)).toEqual([
      { itemKey: `s:${lesson.id}:${index}`, correct: true, exType: 'build-en', errors: lesson.sentences[index].errors },
    ]);
  });
});

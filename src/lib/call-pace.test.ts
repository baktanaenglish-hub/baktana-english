import { describe, expect, it } from 'vitest';
import { judgeTurn, paceFor, speechRate, wordsPerMinute } from './call-pace';

describe('wordsPerMinute', () => {
  it('measures spoken turns only, without the listening tail', () => {
    expect(wordsPerMinute({ text: 'I like to play football', spokenMs: 4000 })).toBe(100);
    expect(wordsPerMinute({ text: 'I like football' })).toBeNull();
    expect(wordsPerMinute({ text: '', spokenMs: 3000 })).toBeNull();
  });
});

describe('judgeTurn', () => {
  it('reads the speaking speed', () => {
    expect(judgeTurn({ text: 'I went to the beach with my family', spokenMs: 4000 })).toBe('fluent');
    expect(judgeTurn({ text: 'I go school', spokenMs: 6000 })).toBe('struggling');
    expect(judgeTurn({ text: 'Yes', spokenMs: 1500 })).toBe('neutral');
    expect(judgeTurn({ text: 'I went to the beach with my family' })).toBe('neutral');
  });

  it('notices getting stuck, Hebrew and asking for it slower', () => {
    expect(judgeTurn({ text: '' })).toBe('struggling');
    expect(judgeTurn({ text: 'אני לא יודע' })).toBe('struggling');
    expect(judgeTurn({ text: "Sorry I don't understand", spokenMs: 2000 })).toBe('lost');
    expect(judgeTurn({ text: 'can you speak slower' })).toBe('lost');
    expect(judgeTurn({ text: 'לא הבנתי' })).toBe('lost');
  });

  it('treats asking for a word as learning, not as being stuck', () => {
    expect(judgeTurn({ text: 'How do I say "שולחן" in English?' })).toBe('neutral');
    expect(judgeTurn({ text: 'how did I say shulchan', spokenMs: 9000 })).toBe('neutral');
    expect(judgeTurn({ text: 'איך אומרים מחברת' })).toBe('neutral');
  });
});

describe('paceFor', () => {
  it('slows down when the learner struggles and speeds up again', () => {
    expect(paceFor([])).toBe('normal');
    expect(paceFor(['struggling'])).toBe('normal');
    expect(paceFor(['struggling', 'struggling'])).toBe('slow');
    expect(paceFor(['lost'])).toBe('slow');
    expect(paceFor(['struggling', 'struggling', 'fluent'])).toBe('normal');
    expect(paceFor(['struggling', 'struggling', 'neutral', 'neutral', 'fluent'])).toBe('normal');
  });

  it('speaks slower when slow', () => {
    expect(speechRate('slow')).toBeLessThan(speechRate('normal'));
  });
});

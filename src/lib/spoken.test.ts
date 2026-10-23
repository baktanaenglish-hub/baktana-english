import { describe, expect, it } from 'vitest';
import { isSpokenCorrectly, spokenScore, spokenWords } from './spoken';

describe('spokenWords', () => {
  it('ignores case and punctuation, expands contractions and spells out numbers', () => {
    expect(spokenWords("I'm fine, thanks!")).toEqual(['i', 'am', 'fine', 'thanks']);
    expect(spokenWords('I have 2 cats.')).toEqual(['i', 'have', 'two', 'cats']);
    expect(spokenWords('I can’t swim')).toEqual(['i', 'can', 'not', 'swim']);
  });
});

describe('spokenScore', () => {
  it('counts expected words heard in order', () => {
    expect(spokenScore('hello how are you', 'Hello, how are you?')).toBe(1);
    expect(spokenScore('hello how you', 'Hello, how are you?')).toBe(0.75);
    expect(spokenScore('you are how hello', 'Hello, how are you?')).toBe(0.25);
    expect(spokenScore('', 'Hello')).toBe(0);
  });
});

describe('isSpokenCorrectly', () => {
  it('accepts any recognizer guess matching any accepted answer', () => {
    expect(isSpokenCorrectly(['I am fine'], ["I'm fine"])).toBe(true);
    expect(isSpokenCorrectly(['hi', 'I am hungry'], ['I am hungry'])).toBe(true);
    expect(isSpokenCorrectly(['good morning'], ['Good evening', 'Good morning'])).toBe(true);
  });

  it('allows one missed word in a longer sentence, not in a short one', () => {
    expect(isSpokenCorrectly(['my name is dan and I am ten'], ['My name is Dan and I am ten years old'])).toBe(true);
    expect(isSpokenCorrectly(['I hungry'], ['I am hungry'])).toBe(false);
    expect(isSpokenCorrectly(['cat'], ['dog'])).toBe(false);
    expect(isSpokenCorrectly([], ['dog'])).toBe(false);
  });
});

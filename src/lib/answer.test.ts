import { describe, expect, it } from 'vitest';
import { isCorrect, normalize, tokenize } from './answer';

describe('normalize', () => {
  it('ignores case, punctuation and extra spaces', () => {
    expect(normalize('  How ARE you? ')).toBe('how are you');
    expect(normalize('Yes,   thanks!')).toBe('yes thanks');
  });

  it('keeps apostrophes and unifies curly ones', () => {
    expect(normalize('I’m good')).toBe("i'm good");
  });

  it('strips Hebrew niqqud', () => {
    expect(normalize('שָׁלוֹם')).toBe('שלום');
  });
});

describe('tokenize', () => {
  it('splits into tiles without punctuation', () => {
    expect(tokenize('Yes, thanks!')).toEqual(['Yes', 'thanks']);
    expect(tokenize('מה שלומך?')).toEqual(['מה', 'שלומך']);
    expect(tokenize("What's your name?")).toEqual(["What's", 'your', 'name']);
  });
});

describe('isCorrect', () => {
  it('accepts any listed alternative', () => {
    expect(isCorrect('i am good', ['I am good', "I'm good"])).toBe(true);
    expect(isCorrect("I'm good", ['I am good', "I'm good"])).toBe(true);
    expect(isCorrect('good I am', ['I am good'])).toBe(false);
  });
});

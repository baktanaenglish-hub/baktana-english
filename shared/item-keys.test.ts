import { describe, expect, it } from 'vitest';
import { isItemKey, parseItemKey, sentenceKey, wordId, wordKey } from './item-keys';

describe('item keys', () => {
  it('builds word keys from the English text or an explicit id', () => {
    expect(wordId({ en: ' Hello ' })).toBe('hello');
    expect(wordKey({ en: 'English' })).toBe('w:english');
    expect(wordKey({ en: 'orange', id: 'orange#fruit' })).toBe('w:orange#fruit');
  });

  it('builds and parses sentence keys', () => {
    expect(sentenceKey('u4l3', 2)).toBe('s:u4l3:2');
    expect(parseItemKey('s:u4l3:2')).toEqual({ kind: 'sentence', id: 'u4l3', index: 2 });
    expect(parseItemKey("w:i'm")).toEqual({ kind: 'word', id: "i'm" });
  });

  it('rejects malformed keys', () => {
    for (const bad of ['', 'x:abc', 's:u4l3', 's:lesson:1', 'w:', 'w: x', 42, null, `w:${'a'.repeat(90)}`]) {
      expect(isItemKey(bad)).toBe(false);
    }
  });
});

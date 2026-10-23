import { describe, expect, it } from 'vitest';
import { dateKey, shiftDateKey } from '../src/lib/progress';
import type { ItemState, ItemStates } from './srs';
import { applySrsUpload, isDateKey, mergeItemState, mergeItemStates, sanitizeItemStates } from './srs-merge';

const NOW = new Date(2026, 2, 10, 12).getTime();
const TODAY = dateKey(NOW);
const st = (over: Partial<ItemState> = {}): ItemState => ({
  box: 2,
  due: TODAY,
  seen: 3,
  wrong: 1,
  last: 100,
  ...over,
});

describe('mergeItemState (D8, US-R6)', () => {
  it('AC1: the newer last wins box and due', () => {
    const a = st({ box: 1, last: 200, due: TODAY });
    const b = st({ box: 3, last: 100, due: shiftDateKey(TODAY, 7) });
    expect(mergeItemState(a, b)).toMatchObject({ box: 1, due: TODAY, last: 200 });
    expect(mergeItemState(b, a)).toMatchObject({ box: 1, due: TODAY, last: 200 });
  });

  it('AC2: on equal last the lower box wins; seen and wrong take the maximum', () => {
    const a = st({ box: 4, seen: 9, wrong: 1, due: '2026-04-01' });
    const b = st({ box: 2, seen: 5, wrong: 3, due: '2026-03-12' });
    expect(mergeItemState(a, b)).toEqual({ box: 2, due: '2026-03-12', seen: 9, wrong: 3, last: 100 });
    expect(mergeItemState(b, a)).toEqual(mergeItemState(a, b));
  });

  it('mergeItemStates keeps keys from both sides', () => {
    const merged = mergeItemStates(
      { 'w:a': st(), 'w:b': st({ box: 5, last: 1 }) },
      { 'w:b': st({ box: 0, last: 2 }), 'w:c': st() },
    );
    expect(Object.keys(merged).sort()).toEqual(['w:a', 'w:b', 'w:c']);
    expect(merged['w:b'].box).toBe(0);
  });
});

describe('sanitizeItemStates (US-R6 AC3)', () => {
  it('returns null for a non-object', () => {
    for (const v of [null, undefined, 3, 'x', [st()]]) expect(sanitizeItemStates(v, NOW)).toBeNull();
  });

  it('drops invalid keys, boxes, dates and numbers, keeping the valid items', () => {
    const input = {
      'w:ok': st(),
      's:u1l1:0': st({ box: 0 }),
      'bad key': st(),
      'w:box7': st({ box: 7 as ItemState['box'] }),
      'w:two-years': st({ due: shiftDateKey(TODAY, 730) }),
      'w:feb31': st({ due: '2026-02-31' }),
      'w:neg': st({ seen: -1 }),
      'w:frac': st({ wrong: 1.5 }),
      'w:str': { ...st(), box: '2' },
      'w:missing': { box: 1, due: TODAY },
      'w:null': null,
    };
    expect(sanitizeItemStates(input, NOW)).toEqual({ 'w:ok': st(), 's:u1l1:0': st({ box: 0 }) });
  });

  it('accepts due up to 400 days ahead and lowers a future last to now', () => {
    const out = sanitizeItemStates({ 'w:a': st({ due: shiftDateKey(TODAY, 400), last: NOW + 99_999 }) }, NOW)!;
    expect(out['w:a']).toMatchObject({ last: NOW, due: shiftDateKey(TODAY, 400) });
  });

  it('keeps at most `limit` items', () => {
    const input: ItemStates = {};
    for (let i = 0; i < 20; i++) input[`w:item${i}`] = st();
    expect(Object.keys(sanitizeItemStates(input, NOW, 5)!)).toHaveLength(5);
  });

  it('isDateKey only accepts real dates', () => {
    expect(isDateKey('2026-03-10')).toBe(true);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-3-1')).toBe(false);
  });
});

describe('applySrsUpload', () => {
  it('returns the merged state and only the items that changed', () => {
    const stored = { 'w:a': st({ last: 100 }), 'w:b': st({ last: 100 }) };
    const { items, changed } = applySrsUpload(stored, {
      'w:a': st({ last: 100 }),
      'w:b': st({ box: 0, last: 200 }),
      'w:c': st(),
    });
    expect(Object.keys(changed).sort()).toEqual(['w:b', 'w:c']);
    expect(items['w:b'].box).toBe(0);
    expect(Object.keys(items).sort()).toEqual(['w:a', 'w:b', 'w:c']);
  });

  it('adds new keys only while the total stays within the limit (in key order)', () => {
    const stored = { 'w:a': st(), 'w:b': st() };
    const { items, changed } = applySrsUpload(stored, { 'w:z': st(), 'w:y': st(), 'w:a': st({ last: 999 }) }, 3);
    expect(Object.keys(items).sort()).toEqual(['w:a', 'w:b', 'w:y']);
    expect(Object.keys(changed).sort()).toEqual(['w:a', 'w:y']);
  });
});

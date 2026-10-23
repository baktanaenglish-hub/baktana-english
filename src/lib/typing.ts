import { normalize } from './answer';

/** How a typed answer compares with the accepted sentences. */
export type TypedResult =
  | { kind: 'correct' }
  /** Right apart from a small spelling slip – counts as correct, the spelling is shown. */
  | { kind: 'typo'; expected: string }
  | { kind: 'wrong' }
  /** Hebrew letters: the keyboard is probably still in Hebrew – not checked, no heart lost. */
  | { kind: 'hebrew' }
  | { kind: 'empty' };

const HEBREW = /[֐-׿]/;

/** Edit distance with adjacent transpositions ("teh" → "the" is one edit). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * A grammar ending, not a typo: "work"/"works", "watch"/"watched", "like"/"liked".
 * These are exactly the mistakes Hebrew speakers make (third person -s, past tense),
 * so they must stay wrong.
 */
function differsByEnding(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return long.startsWith(short) && ['s', 'es', 'd', 'ed'].includes(long.slice(short.length));
}

/** One word typed with a slip: same length class, one edit, at least 4 letters, not a grammar ending. */
function isTypo(typed: string, expected: string): boolean {
  if (expected.length < 4 || typed.length < 3) return false;
  if (differsByEnding(typed, expected)) return false;
  return editDistance(typed, expected) === 1;
}

/** Up to one slipped word in short sentences, two in longer ones. */
function typoAgainst(given: string[], expected: string[]): boolean {
  if (given.length !== expected.length) return false;
  let slips = 0;
  for (let i = 0; i < expected.length; i++) {
    if (given[i] === expected[i]) continue;
    if (!isTypo(given[i], expected[i])) return false;
    slips += 1;
  }
  return slips > 0 && slips <= (expected.length > 4 ? 2 : 1);
}

/** Checks a typed English answer against the accepted sentences (case and punctuation don't matter). */
export function checkTyped(given: string, accepted: readonly string[]): TypedResult {
  if (HEBREW.test(given)) return { kind: 'hebrew' };
  const g = normalize(given);
  if (!g) return { kind: 'empty' };
  if (accepted.some((a) => normalize(a) === g)) return { kind: 'correct' };
  const words = g.split(' ');
  const close = accepted.find((a) => typoAgainst(words, normalize(a).split(' ')));
  return close ? { kind: 'typo', expected: close } : { kind: 'wrong' };
}

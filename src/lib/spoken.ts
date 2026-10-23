import { normalize } from './answer';

/** Share of the expected words that must be heard, in order, for a spoken answer to count. */
export const SPOKEN_PASS = 0.8;

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "it's": 'it is',
  "he's": 'he is',
  "she's": 'she is',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "there's": 'there is',
  "here's": 'here is',
  "let's": 'let us',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "it'll": 'it will',
  "i'd": 'i would',
  "you'd": 'you would',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "can't": 'can not',
  cannot: 'can not',
  "won't": 'will not',
  "haven't": 'have not',
  "hasn't": 'has not',
};

const NUMBERS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];

/**
 * The words of an English sentence for comparing speech: normalized, contractions expanded
 * ("I'm" = "I am") and small numbers spelled out, since recognizers write "2" for "two".
 */
export function spokenWords(text: string): string[] {
  return normalize(text)
    .split(' ')
    .flatMap((word) => {
      const number = /^\d+$/.test(word) ? NUMBERS[Number(word)] : undefined;
      return (CONTRACTIONS[word] ?? number ?? word).split(' ');
    })
    .map((word) => word.replace(/'/g, ''))
    .filter(Boolean);
}

/** Length of the longest common subsequence of two word lists. */
function commonWords(a: readonly string[], b: readonly string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const word of a) {
    const row = [0];
    for (let j = 0; j < b.length; j++) row.push(word === b[j] ? prev[j] + 1 : Math.max(prev[j + 1], row[j]));
    prev = row;
  }
  return prev[b.length];
}

/** How much of `expected` was heard in `heard`, in order: 0–1. */
export function spokenScore(heard: string, expected: string): number {
  const want = spokenWords(expected);
  if (want.length === 0) return 0;
  return commonWords(spokenWords(heard), want) / want.length;
}

/**
 * Whether any of the recognizer's guesses says one of the accepted sentences. Lenient on purpose:
 * recognition of learners' accents is imperfect, so a missed word in a longer sentence still passes.
 */
export function isSpokenCorrectly(heard: readonly string[], accepted: readonly string[]): boolean {
  return heard.some((h) => accepted.some((a) => spokenScore(h, a) >= SPOKEN_PASS));
}

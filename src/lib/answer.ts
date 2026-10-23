/** Normalizes an answer so that case, punctuation and spacing don't matter. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’׳]/g, "'")
    .replace(/[֑-ׇ]/g, '') // Hebrew niqqud and cantillation marks
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a sentence into word-bank tiles, dropping punctuation. */
export function tokenize(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ''))
    .filter(Boolean);
}

export function isCorrect(given: string, accepted: readonly string[]): boolean {
  const g = normalize(given);
  return accepted.some((a) => normalize(a) === g);
}

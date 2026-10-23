import { sentenceKey } from '../../shared/item-keys';
import type { Exercise, Lesson } from '../types';
import { pickDistinct, shuffle, type Rng } from './random';

/**
 * Fill in the blank: one word of an English sentence is missing and the learner picks it.
 * The blank goes on the grammar Hebrew speakers find hardest – the verb "be", articles,
 * prepositions, do/does – with the other members of the same group as options; otherwise on
 * one of the lesson's words, with other lesson words as options.
 */
export const CONFUSABLE_GROUPS: readonly (readonly string[])[] = [
  ['am', 'is', 'are'],
  ['was', 'were'],
  ['a', 'an', 'the'],
  ['in', 'on', 'at'],
  ['do', 'does', 'did'],
  ['have', 'has'],
  // Not that/those: the Hebrew זה/זאת doesn't tell "this" from "that".
  ['this', 'these'],
  ['my', 'your', 'his', 'her'],
];

const CORE = /^([^\p{L}\p{N}']*)(.*?)([^\p{L}\p{N}']*)$/u;

function splitWord(word: string): { lead: string; core: string; trail: string } {
  const [, lead, core, trail] = CORE.exec(word)!;
  return { lead, core, trail };
}

const matchCase = (option: string, like: string) =>
  like[0] === like[0].toUpperCase() && like[0] !== like[0].toLowerCase()
    ? option[0].toUpperCase() + option.slice(1)
    : option;

/** The word to blank and its options, or undefined when the sentence has no good candidate. */
function chooseBlank(words: string[], lesson: Lesson, rng: Rng): { index: number; options: string[] } | undefined {
  const cores = words.map((w) => splitWord(w).core.toLowerCase());
  for (let i = 0; i < cores.length; i++) {
    const group = CONFUSABLE_GROUPS.find((g) => g.includes(cores[i]));
    if (group) return { index: i, options: group.filter((o) => o !== cores[i]).slice(0, 3) };
  }
  const vocab = lesson.words.map((w) => w.en.toLowerCase()).filter((w) => !w.includes(' '));
  const candidates = cores.map((c, i) => (vocab.includes(c) ? i : -1)).filter((i) => i >= 0);
  if (candidates.length === 0) return undefined;
  const index = candidates[Math.floor(rng() * candidates.length)];
  const options = pickDistinct(vocab, 3, [cores[index]], rng);
  return options.length >= 2 ? { index, options } : undefined;
}

/** A fill-in-the-blank exercise for one sentence of the lesson, if it has a word worth blanking. */
export function blankSentence(lesson: Lesson, index: number, rng: Rng): Exercise | undefined {
  const sentence = lesson.sentences[index];
  const words = sentence.en.split(' ');
  const choice = chooseBlank(words, lesson, rng);
  if (!choice) return undefined;
  const { lead, core, trail } = splitWord(words[choice.index]);
  const rest = words.slice(choice.index + 1);
  // "She is a girl." blanking "girl" → before "She is a", after "." (punctuation stays put).
  const before = [...words.slice(0, choice.index), lead].filter(Boolean).join(' ');
  const after = trail + (rest.length ? ` ${rest.join(' ')}` : '');
  const options = shuffle(
    [core, ...choice.options.map((o) => matchCase(o, core))].filter((o, i, all) => all.indexOf(o) === i),
    rng,
  );
  return {
    kind: 'blank',
    before,
    after,
    he: sentence.he,
    options,
    answer: core,
    itemKey: sentenceKey(lesson.id, index),
    ...(sentence.errors?.length ? { errors: sentence.errors } : {}),
  };
}

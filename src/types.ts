/**
 * Course and exercise types. Spec: docs/spec/v2.md §6.1.
 * Contract file – owned by the backend agent, changes are additive only.
 */

/** Hebrew-speaker error codes from docs/curriculum.md (E1–E15) and docs/spec/v2.md (E16–E27). */
export type ErrorCode =
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'E7'
  | 'E8'
  | 'E9'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E13'
  | 'E14'
  | 'E15'
  | 'E16'
  | 'E17'
  | 'E18'
  | 'E19'
  | 'E20'
  | 'E21'
  | 'E22'
  | 'E23'
  | 'E24'
  | 'E25'
  | 'E26'
  | 'E27';

export type CefrLevel = 'Pre-A1' | 'A1' | 'A1+' | 'A2';

/** A vocabulary item taught in a lesson. */
export interface Word {
  en: string;
  he: string;
  /** Optional transliteration help, e.g. "הלו" for "hello". */
  sound?: string;
  /**
   * Stable id for spaced repetition. Defaults to `en` lower-cased and trimmed
   * (see wordId() in shared/item-keys.ts). Set it only for homographs, e.g. "orange#fruit".
   */
  id?: string;
}

/** A full sentence with its translation. `alt` lists other accepted English answers. */
export interface Sentence {
  en: string;
  he: string;
  alt?: string[];
  /** Other accepted Hebrew answers – mainly the feminine form ("אני רעבה" for "אני רעב"). */
  heAlt?: string[];
  /** Error-map codes this sentence trains. Sent with analytics and used by review weighting. */
  errors?: ErrorCode[];
}

export interface Lesson {
  id: string;
  title: string;
  words: Word[];
  sentences: Sentence[];
  /** Optional short Hebrew grammar/usage note shown before the first exercise. `[[...]]` marks English. */
  tip?: string;
}

export interface UnitIntro {
  /** 1–3 Hebrew sentences shown before the unit's first lesson. `[[...]]` marks English text. */
  tip: string;
  /** Optional short list of goals ("לברך ולהיפרד"). */
  goals?: string[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  color: string;
  /** CEFR level chip shown on the unit banner. */
  level?: CefrLevel;
  intro?: UnitIntro;
  lessons: Lesson[];
}

export type Exercise =
  | {
      kind: 'choice';
      /** Text shown to the learner. */
      prompt: string;
      /** Language of the prompt – English prompts get a speaker button. */
      promptLang: 'en' | 'he';
      options: string[];
      answer: string;
      /** Spaced-repetition / analytics key of the word asked about (`w:<wordId>`). */
      itemKey?: string;
    }
  | {
      kind: 'build';
      prompt: string;
      promptLang: 'en' | 'he';
      /** Language the learner builds the answer in. */
      answerLang: 'en' | 'he';
      bank: string[];
      answers: string[];
      /** When true the prompt is only spoken (listening exercise). */
      listen?: boolean;
      /** Key of the sentence (`s:<lessonId>:<index>`). */
      itemKey?: string;
      /** Error codes of the sentence, copied for analytics. */
      errors?: ErrorCode[];
    }
  | {
      kind: 'match';
      pairs: Word[];
      /** Item keys in the same order as `pairs`. */
      itemKeys?: string[];
    }
  | {
      /** Typing: the learner types the English sentence – a translation or what they heard. */
      kind: 'type';
      /** The Hebrew sentence to translate, or the English one to play when `listen` is set. */
      prompt: string;
      /** When true the prompt is only spoken (type what you hear). */
      listen?: boolean;
      /** Accepted English sentences (the main one and its alternatives). */
      answers: string[];
      /** Key of the sentence (`s:<lessonId>:<index>`). */
      itemKey?: string;
      /** Error codes of the sentence, copied for analytics. */
      errors?: ErrorCode[];
    }
  | {
      /** Fill in the blank: one word of the English sentence is missing; pick it from the options. */
      kind: 'blank';
      /** The sentence before and after the missing word (punctuation included). */
      before: string;
      after: string;
      /** The Hebrew translation, shown as the meaning. */
      he: string;
      options: string[];
      answer: string;
      /** Key of the sentence (`s:<lessonId>:<index>`). */
      itemKey?: string;
      /** Error codes of the sentence, copied for analytics. */
      errors?: ErrorCode[];
    }
  | {
      /** Speaking: the learner reads an English sentence out loud (speech recognition). */
      kind: 'speak';
      /** The English sentence to say. */
      prompt: string;
      /** Its Hebrew translation, shown as a hint. */
      he: string;
      /** Accepted sentences (the prompt and its alternatives). */
      answers: string[];
      /** Speaking isn't scheduled for review, so it has no item key. */
      itemKey?: never;
    };

/**
 * Exercise type as reported to analytics (docs/spec/v2.md §8).
 * 'speak' is local only: speaking answers are not reported or scheduled for review,
 * since a misheard sentence says more about the microphone than about the learner.
 */
export type ExerciseType = 'choice-en' | 'choice-he' | 'match' | 'build-en' | 'build-he' | 'listen' | 'speak';

/**
 * One answered item, reported by LessonScreen through `onAnswer` – once per exercise,
 * for its first attempt only (a match exercise reports one answer per pair).
 */
export interface ItemAnswer {
  itemKey: string;
  correct: boolean;
  exType: ExerciseType;
  errors?: ErrorCode[];
}

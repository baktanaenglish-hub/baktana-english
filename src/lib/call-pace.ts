import type { CallPace } from '../../shared/call';

/**
 * How the learner is coping on an AI call, measured on the device from each turn: how fast they spoke into the
 * microphone, whether they fell back to Hebrew, asked for it slower, or said nothing at all. When they struggle,
 * the call switches to `slow`: the character says less, in simpler sentences (shared/call-prompts.ts), and
 * speaks a little slower. Pure functions, tested in call-pace.test.ts.
 */

/** One learner turn as the screen saw it. */
export interface PaceSample {
  /** What the learner said or typed (empty when the microphone heard nothing). */
  text: string;
  /** How long the microphone listened, when the turn was spoken (not typed). */
  spokenMs?: number;
}

/** `lost`: the learner said they don't follow, or asked for it slower – reason enough on its own. */
export type PaceSignal = 'fluent' | 'neutral' | 'struggling' | 'lost';

/** Recognition keeps listening for about this long after the learner stops, so it isn't speaking time. */
const LISTEN_TAIL_MS = 1000;
/** Below this many words per minute the learner is searching for words. Fluent learners say 100+. */
const SLOW_WPM = 55;
const FLUENT_WPM = 90;
/** Turns the pace looks back on. */
const WINDOW = 3;

const HEBREW = /[א-ת]/;
const LOST =
  /\b(?:(?:i\s+)?(?:don'?t|do\s+not|didn'?t|did\s+not|can'?t|cannot)\s+(?:understand|follow)|(?:more\s+)?slow(?:er|ly)|say\s+(?:it|that)\s+again|repeat(?:\s+(?:it|that|please))?|what\s+do\s+you\s+mean|i'?m\s+(?:lost|confused))\b/i;
const LOST_HE = /לא\s+(?:הבנתי|מבין|מבינה)|יותר\s+לאט|לאט\s+יותר|שוב\s+בבקשה|תחזור|תחזרי/;
/** Asking for a word ("how do I say…", "איך אומרים…") is learning, not being stuck. */
const WORD_REQUEST =
  /\b(?:how\s+(?:do|did|can|would)\s+(?:i|you|we)\s+say|what(?:'s|\s+is)\s+(?:the\s+word\s+for|.+\s+in\s+english)|how\s+to\s+say)\b|איך\s+אומרים|איך\s+(?:זה\s+)?ב?אנגלית|מה\s+זה\s+באנגלית/i;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Words per minute of a spoken turn, or null when there is nothing to measure. */
export function wordsPerMinute(sample: PaceSample): number | null {
  if (sample.spokenMs === undefined) return null;
  const words = wordCount(sample.text);
  if (words === 0) return null;
  const speakingMs = Math.max(1000, sample.spokenMs - LISTEN_TAIL_MS);
  return (words * 60_000) / speakingMs;
}

/** What one learner turn says about how they cope. */
export function judgeTurn(sample: PaceSample): PaceSignal {
  const text = sample.text.trim();
  // The microphone was on and nothing came out.
  if (!text) return 'struggling';
  if (LOST.test(text) || LOST_HE.test(text)) return 'lost';
  if (WORD_REQUEST.test(text)) return 'neutral';
  if (HEBREW.test(text)) return 'struggling';
  const wpm = wordsPerMinute(sample);
  if (wpm === null) return 'neutral';
  if (wpm < SLOW_WPM) return 'struggling';
  // A word or two said fast isn't fluency yet.
  if (wpm >= FLUENT_WPM && wordCount(text) >= 4) return 'fluent';
  return 'neutral';
}

/**
 * The pace for the next turn from the signals so far (oldest first): slow when the last few turns lean towards
 * struggling, back to normal once the learner gets going again.
 */
export function paceFor(signals: readonly PaceSignal[]): CallPace {
  const recent = signals.slice(-WINDOW);
  let score = 0;
  for (const s of recent) {
    if (s === 'lost') score += 2;
    else if (s === 'struggling') score += 1;
    else if (s === 'fluent') score -= 1;
  }
  return score >= 2 ? 'slow' : 'normal';
}

/** The speech rate for the character's voice (speech.ts uses 0.95 by default). */
export function speechRate(pace: CallPace): number {
  return pace === 'slow' ? 0.8 : 0.95;
}

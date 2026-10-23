import {
  CALL_LIMITS,
  type CallMessage,
  type CallPace,
  type CorrectionLevel,
  type CallStatusResponse,
  type CallTurnRequest,
  type CallTurnResponse,
  type Correction,
  type Persona,
} from '../../shared/call';

/**
 * Conversation state of an AI "video call" (src/components/call/). Pure functions, so the
 * screen stays thin and the rules are tested in call.test.ts.
 */

/** One line on the call: the contract's message plus what the screen shows with it. */
export interface CallLine extends CallMessage {
  /** Hebrew translation of a character's line (none for the greeting). */
  he?: string;
  /** The teacher's corrections of this learner line. */
  corrections?: Correction[];
  /** A character's line that steered the conversation away from something unsafe. */
  flagged?: CallTurnResponse['flagged'];
}

export interface CallState {
  persona: Persona;
  lines: CallLine[];
  /** True once the character hung up (turn limit). */
  ended: boolean;
}

/** A new call: the character's greeting is the first line. */
export function startCall(persona: Persona): CallState {
  return { persona, lines: [{ role: 'assistant', text: persona.greeting }], ended: false };
}

/** Tidies what the learner said or typed: single spaces, at most CALL_LIMITS.maxMessageChars. */
export function cleanMessage(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, CALL_LIMITS.maxMessageChars).trim();
}

export function appendUser(state: CallState, text: string): CallState {
  return { ...state, lines: [...state.lines, { role: 'user', text }] };
}

/**
 * Adds the character's reply. Corrections are attached to the learner's last line, and only
 * when the persona corrects – the friend and the role-plays never show any, whatever comes back.
 */
export function appendReply(state: CallState, res: CallTurnResponse): CallState {
  const lines = [...state.lines];
  const corrections = state.persona.corrects ? (res.corrections ?? []) : [];
  const last = lines.length - 1;
  if (corrections.length > 0 && lines[last]?.role === 'user') {
    lines[last] = { ...lines[last], corrections };
  }
  lines.push({ role: 'assistant', text: res.reply, he: res.replyHe || undefined, flagged: res.flagged });
  return { ...state, lines, ended: state.ended || res.ended === true };
}

/**
 * The request for the learner's `message`: the latest CALL_LIMITS.maxHistory lines of the
 * conversation before it (plain role/text only), oldest first. `pace` is sent only when slow, `level` (the teacher's
 * correction level) only when it isn't the default.
 */
export function turnRequest(
  state: CallState,
  message: string,
  pace: CallPace = 'normal',
  level: CorrectionLevel = 'normal',
): CallTurnRequest {
  const req: CallTurnRequest = {
    persona: state.persona.id,
    history: state.lines.slice(-CALL_LIMITS.maxHistory).map(({ role, text }) => ({ role, text })),
    message,
  };
  if (pace === 'slow') req.pace = 'slow';
  if (level !== 'normal' && state.persona.corrects) req.correctionLevel = level;
  return req;
}

/** The request for a learner line that is already on the call (sending it again after an error). */
export function retryRequest(
  state: CallState,
  pace: CallPace = 'normal',
  level: CorrectionLevel = 'normal',
): CallTurnRequest | null {
  const last = state.lines.at(-1);
  if (last?.role !== 'user') return null;
  return turnRequest({ ...state, lines: state.lines.slice(0, -1) }, last.text, pace, level);
}

const CORRECTION_LEVEL_KEY = 'baktana-english:call-correction-level:v1';

/** The teacher's correction level the learner picked last time on this device ('normal' if none). */
export function loadCorrectionLevel(): CorrectionLevel {
  try {
    const saved = localStorage.getItem(CORRECTION_LEVEL_KEY);
    return saved === 'light' || saved === 'full' ? saved : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveCorrectionLevel(level: CorrectionLevel) {
  try {
    localStorage.setItem(CORRECTION_LEVEL_KEY, level);
  } catch {
    // Private mode or storage blocked: the choice just lasts for this call.
  }
}

/** What the learner sends when they say a Hebrew word into the "how do you say…?" microphone. */
export function wordRequest(hebrew: string): string {
  return `How do I say "${hebrew.trim()}" in English?`;
}

export function learnerTurns(state: CallState): number {
  return state.lines.filter((l) => l.role === 'user').length;
}

/** Whether the learner may still talk: the character hasn't hung up and the turn limit isn't reached. */
export function canTalk(state: CallState): boolean {
  return !state.ended && learnerTurns(state) < CALL_LIMITS.maxTurns;
}

/** Every correction in the call, in order, for the "what we learned" summary. */
export function allCorrections(state: CallState): Correction[] {
  return state.lines.flatMap((l) => l.corrections ?? []);
}

/** `mm:ss` (minutes keep counting past 59). */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Calls the learner can still start today (never negative). */
export function callsLeft(status: CallStatusResponse): number {
  return Math.max(0, status.callsPerDay - status.callsToday);
}

/** "נשארו לכם 3 מתוך 10 שיחות היום", with the singular for one call. */
export function remainingText(left: number, perDay: number): string {
  if (left === 1) return `נשארה לכם שיחה אחת מתוך ${perDay} היום`;
  return `נשארו לכם ${left} מתוך ${perDay} שיחות היום`;
}

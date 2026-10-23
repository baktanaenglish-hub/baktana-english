/**
 * Deterministic guards for the AI "video call" (contract: shared/call.ts), used by the server before and after
 * the model: keyword/regex checks in English and Hebrew, safe in-character replies, and request validation.
 * Pure TypeScript with no imports except './call', so it runs in Node, the browser and Deno.
 *
 * The lists are deliberately small and precise: learners say things like "kill time" or "I am 14 years old",
 * and a false positive interrupts a practice conversation. The system prompt (shared/call-prompts.ts) is the
 * main line of defence; these checks catch the clear cases deterministically.
 */
import { CALL_LIMITS, findPersona } from './call';
import type { CallMessage, CallTurnRequest, Persona, PersonaId } from './call';

export type CallFlag = 'inappropriate' | 'personal_info' | 'self_harm';

/** Longest history line kept by sanitizeTurnRequest. */
export const MAX_HISTORY_TEXT_CHARS = 600;

/** Hebrew letters (incl. niqqud); used as the "word boundary" for Hebrew, since \b only knows ASCII. */
const HE = '\\u0590-\\u05FF';
/** Whole Hebrew words; `prefixes` allows the one-letter prefixes (ו, ה, ש, ב, ל, מ, כ) in front. */
const heWord = (words: string, prefixes = false): string =>
  `(?<![${HE}])${prefixes ? '[והשבלמכ]{0,2}' : ''}(?:${words})(?![${HE}])`;

// --- Self-harm ---------------------------------------------------------------------------------------------

const SELF_HARM = [
  // Not "I hurt myself playing football" / "I cut myself cooking": only killing, or wanting to hurt.
  /\b(?:kill|killing|harm|harming)\s+my\s?self\b/i,
  /\b(?:want|wanna|going|try|trying)\s+to\s+(?:hurt|cut|harm)\s+my\s?self\b/i,
  /\bself[\s-]?harm/i,
  /\bsuicid(?:e|al)\b/i,
  /\b(?:want|wanna|wish|plan|planning)\s+(?:to\s+)?die\b(?!\s+(?:my|her|his|your|our|the)\s+hair)/i,
  /\bwish\s+i\s+(?:was|were)\s+dead\b/i,
  /\bend\s+my\s+life\b/i,
  /\b(?:don'?t|do\s+not)\s+want\s+to\s+(?:live|be\s+alive)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  new RegExp(heWord('להתאבד|התאבדות|מתאבד|מתאבדת', true), 'u'),
  /לא\s+רוצה\s+לחיות/u,
  /רוצה\s+למות/u,
  /לפגוע\s+בעצמי/u,
  /לחתוך\s+את\s+עצמי/u,
  /לשים\s+קץ\s+לחיים/u,
];

// --- Sexual / explicit and severe slurs ----------------------------------------------------------------------

const INAPPROPRIATE = [
  /\b(?:sex|sexy|sexual|sexting|porn|porno|pornography|nude|nudes|naked|horny|boobs?|tits|penis|vagina|dick|pussy|blowjob|handjob|orgasm|masturbat\w*|erotic|onlyfans)\b/i,
  /\bf+u+c+k+\w*/i,
  /\b(?:nigg(?:er|a)s?|faggots?|fags?|kikes?|spics?|chinks?|retards?|trann(?:y|ies))\b/i,
  new RegExp(heWord('סקס|סקסי|פורנו|עירום|עירומה|זין|כוסית|זונה|שרמוטה|מזדיין|לזיין|זיון|כושי|הומו מסריח'), 'u'),
  /כוס\s?(?:אמא|אמק|אמאש|אמך)/u,
];

// --- Personal details ----------------------------------------------------------------------------------------

const DIGIT_WORD = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)';

const PERSONAL_INFO = [
  // Israeli mobiles: 050-1234567, 054 123 4567, +972 54 123 4567, 972541234567.
  /(?<!\d)(?:\+?972[\s-]?|0)5\d(?:[\s-]?\d){7}(?!\d)/,
  // Israeli landlines (02-6543210), international numbers (+44 20 7946 0958), or 9–13 digits in a row.
  // Not plain lists of numbers such as years ("2010 2011 2012").
  /(?<!\d)0[2-9][\s-]?\d{7}(?!\d)/,
  /(?<!\w)\+\d{1,3}(?:[\s-]?\d){7,12}(?!\d)/,
  /(?<![\d.,])\d{9,13}(?![\d.,])/,
  // A number dictated digit by digit, starting with zero ("zero five four one two three four...").
  new RegExp(`\\b(?:zero|oh)(?:[\\s,-]+${DIGIT_WORD}){6,}\\b`, 'i'),
  // Email, also as dictated ("noa at gmail dot com").
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
  /\bat\s+(?:gmail|yahoo|hotmail|outlook|walla|icloud)\s*(?:dot|\.)\s*(?:com|co)\b/i,
  // Addresses.
  /\bmy\s+(?:home\s+)?address\s+is\b/i,
  /\bi\s+live\s+(?:at|on)\s+(?:number\s+)?\d+/i,
  // "12 Herzl Street", but not "2 blocks down the street".
  /\b\d+[a-z]?\s+(?:(?!(?:the|a|this|that|my|our|down|up|on|in)\b)[a-z]+\s+){1,2}(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane)\b/i,
  /\b(?:street|road|avenue|rehov)\s+[a-z]+\s+\d+\b/i,
  // Asking to be contacted elsewhere.
  /\bmy\s+(?:phone|mobile|cell|whatsapp|telephone)(?:\s+number)?\s+is\b/i,
  /\bmy\s+(?:instagram|insta|snapchat|snap|tiktok|facebook|discord|telegram)(?:\s+(?:account|username|name|handle))?\s+is\b/i,
  /\badd\s+me\s+on\s+(?:instagram|insta|snapchat|snap|tiktok|facebook|discord|telegram|whatsapp)\b/i,
  /(?:הכתובת|כתובת\s+המגורים)\s+שלי/u,
  /(?:מספר\s+(?:ה)?טלפון|הטלפון|הפלאפון|הנייד)\s+שלי/u,
  /(?:גר|גרה)\s+ברחוב/u,
  /(?:האינסטגרם|הסנאפ|הטיקטוק)\s+שלי/u,
];

// The model must never ask for personal details or propose meeting (checked on its replies only).
const ASKS_PERSONAL_INFO = [
  /\bwhat(?:'s|\s+is)\s+your\s+(?:home\s+address|address|phone\s+number|phone|number|email|full\s+name|last\s+name|surname|instagram|snapchat|password)\b/i,
  /\b(?:where\s+exactly\s+do\s+you\s+live|which\s+street\s+do\s+you\s+live)\b/i,
  /\bsend\s+me\s+(?:a\s+)?(?:photo|picture|pic|selfie)s?\b/i,
  /\b(?:let'?s|we\s+(?:can|could|should))\s+meet\b/i,
  /\bmeet\s+(?:in\s+person|in\s+real\s+life|irl)\b/i,
];

const matchesAny = (patterns: RegExp[], text: string): boolean => patterns.some((re) => re.test(text));

/** Flags a learner's message. Order matters: self-harm wins, then explicit content, then personal details. */
export function checkUserMessage(text: string): { flagged?: CallFlag } {
  if (typeof text !== 'string' || !text.trim()) return {};
  if (matchesAny(SELF_HARM, text)) return { flagged: 'self_harm' };
  if (matchesAny(INAPPROPRIATE, text)) return { flagged: 'inappropriate' };
  if (matchesAny(PERSONAL_INFO, text)) return { flagged: 'personal_info' };
  return {};
}

/**
 * True when the model's reply is safe to show. Self-harm words are not blocked here on purpose: a caring reply
 * ("If you feel like hurting yourself, please call ERAN at 1201") must get through.
 */
export function checkModelReply(text: string): boolean {
  if (typeof text !== 'string') return false;
  return !matchesAny(INAPPROPRIATE, text) && !matchesAny(PERSONAL_INFO, text) && !matchesAny(ASKS_PERSONAL_INFO, text);
}

// --- Safe replies ----------------------------------------------------------------------------------------------

interface SafeReply {
  reply: string;
  replyHe: string;
}

/** A question in the character's world, to steer the conversation back. */
const BACK_ON_TRACK: Record<PersonaId, SafeReply> = {
  teacher: { reply: 'So, tell me, what did you do today?', replyHe: 'אז ספר/י לי, מה עשית היום?' },
  friend: {
    reply: 'So, what music are you listening to these days?',
    replyHe: 'אז איזו מוזיקה את/ה שומע/ת בימים האלה?',
  },
  barista: { reply: 'So, what can I get for you today?', replyHe: 'אז מה אפשר להביא לך היום?' },
  interviewer: {
    reply: "Let's go back to the interview. Why do you want this job?",
    replyHe: 'בוא/י נחזור לראיון. למה את/ה רוצה את העבודה הזאת?',
  },
};

/** A gentle in-character answer used instead of the model when a message (or a reply) is flagged. */
export function safeReply(flag: CallFlag, persona: Persona): SafeReply {
  const next = BACK_ON_TRACK[persona.id] ?? BACK_ON_TRACK.teacher;
  switch (flag) {
    case 'self_harm':
      return {
        reply:
          "I'm really sorry you feel this way, and I'm glad you said it. Please talk to a trusted adult, like a parent, a teacher or a school counselor. You can also call ERAN at 1201, any time, for free.",
        replyHe:
          'אני ממש מצטער/ת שאת/ה מרגיש/ה ככה, וטוב שסיפרת. חשוב לדבר עם מבוגר/ת שסומכים עליו – הורה, מורה או יועצ/ת בבית הספר. אפשר גם להתקשר לער"ן בטלפון 1201, בכל שעה ובחינם.',
      };
    case 'personal_info':
      return {
        reply: `Let's keep personal details private. I'm an AI, so you never need to tell me things like your address or phone number. ${next.reply}`,
        replyHe: `בוא/י נשמור על פרטים אישיים בפרטיות. אני בינה מלאכותית, אז אף פעם לא צריך לספר לי דברים כמו כתובת או מספר טלפון. ${next.replyHe}`,
      };
    case 'inappropriate':
    default:
      return {
        reply: `Hmm, let's talk about something else. ${next.reply}`,
        replyHe: `המממ, בוא/י נדבר על משהו אחר. ${next.replyHe}`,
      };
  }
}

// --- Request validation -------------------------------------------------------------------------------------

/** Control characters except tab and newline. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

const cleanText = (text: string): string => text.replace(CONTROL_CHARS, '').trim();

function sanitizeHistoryEntry(value: unknown): CallMessage | null {
  if (!value || typeof value !== 'object') return null;
  const { role, text } = value as Record<string, unknown>;
  if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') return null;
  const clean = cleanText(text).slice(0, MAX_HISTORY_TEXT_CHARS);
  return clean ? { role, text: clean } : null;
}

/**
 * Validates a POST /api/call/turn body: a known persona, a non-empty message of at most
 * CALL_LIMITS.maxMessageChars, and a history of valid lines (invalid ones dropped, each truncated, only the last
 * CALL_LIMITS.maxHistory kept). `pace` is kept only when it is 'slow'. Returns null when the body is unusable.
 */
export function sanitizeTurnRequest(body: unknown): CallTurnRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const { persona, message, history, pace } = body as Record<string, unknown>;
  if (typeof persona !== 'string' || !findPersona(persona)) return null;
  if (typeof message !== 'string') return null;
  const text = cleanText(message);
  if (!text || text.length > CALL_LIMITS.maxMessageChars) return null;
  const lines = Array.isArray(history)
    ? history
        .map(sanitizeHistoryEntry)
        .filter((m): m is CallMessage => m !== null)
        .slice(-CALL_LIMITS.maxHistory)
    : [];
  const req: CallTurnRequest = { persona: persona as PersonaId, message: text, history: lines };
  if (pace === 'slow') req.pace = 'slow';
  return req;
}

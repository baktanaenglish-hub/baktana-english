import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  CORRECTION_LEVELS,
  CORRECTION_LEVEL_LABELS,
  type CallTurnRequest,
  type CallTurnResponse,
  type CorrectionLevel,
  type Persona,
} from '../../../shared/call';
import { errorMessage } from '../../lib/api';
import {
  allCorrections,
  appendReply,
  appendUser,
  canTalk,
  cleanMessage,
  formatDuration,
  learnerTurns,
  loadCorrectionLevel,
  retryRequest,
  saveCorrectionLevel,
  startCall,
  turnRequest,
  wordRequest,
  type CallLine,
  type CallState,
} from '../../lib/call';
import { isCallBlocked, sendTurn } from '../../lib/call-api';
import { judgeTurn, paceFor, speechRate, type PaceSignal } from '../../lib/call-pace';
import type { ApiRequestError } from '../../lib/api-error';
import { canListen, listen, type ListenError, type Listening } from '../../lib/listen';
import { speakAsync, stopSpeaking, warmUpVoices } from '../../lib/speech';
import { PERSONA_VOICES } from '../../lib/voices';
import type { CallResult } from './CallSummary';
import { CorrectionView } from './CallSummary';
import { Icon, type IconName } from '../Icon';
import { PersonaPortrait } from './PersonaPortrait';
import { personaStyle } from './persona-style';

interface Props {
  persona: Persona;
  onEnd: (result: CallResult) => void;
  /** Leaves without a summary (a call that was blocked before the learner got an answer). */
  onBack: () => void;
  /** Today's call count from the server, after each turn. */
  onCallsToday?: (callsToday: number) => void;
  /** The server refused the call: signed out (401), not premium (403) or daily limit (429). */
  onBlocked?: (error: ApiRequestError) => void;
}

type Phase = 'connecting' | 'ready' | 'speaking' | 'listening' | 'thinking' | 'error' | 'blocked';
/** What the microphone listens for: an English sentence, or a Hebrew word to ask "how do you say…?". */
type ListenFor = 'sentence' | 'word';

/** How long the "calling…" ring shows before the character picks up. */
const RING_MS = 1200;
/** A pause after the character's goodbye before the summary, so the last line can be read. */
const GOODBYE_MS = 1500;

const MIC_ERRORS: Record<ListenError, string> = {
  denied: 'אין גישה למיקרופון. אפשר לאשר אותה בהגדרות, או לכתוב במקלדת.',
  'no-speech': 'לא שמענו כלום. לחצו על המיקרופון ודברו ברור.',
  unavailable: 'זיהוי דיבור לא זמין במכשיר הזה. אפשר לכתוב במקלדת.',
  error: 'משהו השתבש בזיהוי הדיבור. נסו שוב.',
};

const FLAG_NOTES: Record<NonNullable<CallTurnResponse['flagged']>, { icon: IconName; text: string }> = {
  personal_info: { icon: 'shield-alert', text: 'זכרו: לא משתפים פרטים אישיים כמו כתובת, טלפון או שם בית הספר.' },
  inappropriate: { icon: 'shield-alert', text: 'בואו נשמור על שיחה נעימה ומכבדת.' },
  self_harm: {
    icon: 'heart-handshake',
    text: 'אם קשה לכם, אתם לא לבד. דברו עם מבוגר שאתם סומכים עליו, או התקשרו לער״ן – 1201, בכל שעה.',
  },
};

/**
 * A phone call with an AI character: the character's contact photo, a voice wave while someone
 * speaks, live captions, and a push-to-talk microphone (or typing). No camera, no moving face.
 */
export function CallScreen({ persona, onEnd, onBack, onCallsToday, onBlocked }: Props) {
  const [call, setCallState] = useState<CallState>(() => startCall(persona));
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [muted, setMuted] = useState(false);
  const [showHe, setShowHe] = useState(false);
  const [keyboard, setKeyboard] = useState(!canListen);
  const [draft, setDraft] = useState('');
  const [listenFor, setListenFor] = useState<ListenFor>('sentence');
  /** How picky the teacher is; the learner can change it any time during the call (sent with every turn). */
  const [level, setLevel] = useState<CorrectionLevel>(loadCorrectionLevel);

  const callRef = useRef(call);
  const mutedRef = useRef(false);
  const alive = useRef(true);
  const speechToken = useRef(0);
  const listening = useRef<Listening | null>(null);
  const pending = useRef<AbortController | null>(null);
  const connectedRef = useRef<number | null>(null);
  const ended = useRef(false);
  const micBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const captions = useRef<HTMLElement>(null);
  /** How the learner coped on each turn so far; slows the character down when they struggle (call-pace.ts). */
  const paceSignals = useRef<PaceSignal[]>([]);

  const setCall = useCallback((next: CallState) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  /** Stops the character mid-sentence (the learner starts talking, mutes or hangs up). */
  const interrupt = useCallback(() => {
    speechToken.current++;
    stopSpeaking();
    setPhase((p) => (p === 'speaking' ? 'ready' : p));
  }, []);

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    speechToken.current++;
    stopSpeaking();
    listening.current?.stop();
    listening.current = null;
    pending.current?.abort();
    const state = callRef.current;
    onEnd({
      persona: state.persona,
      durationMs: connectedRef.current === null ? 0 : Date.now() - connectedRef.current,
      turns: learnerTurns(state),
      corrections: allCorrections(state),
    });
  }, [onEnd]);

  /** The character says `text` (slowly for a correction, unless the speaker is muted); resolves when done. */
  const say = useCallback(async (text: string, slow = false) => {
    const token = ++speechToken.current;
    if (mutedRef.current) {
      setPhase('ready');
      return;
    }
    setPhase('speaking');
    // A correction gets the slow "listen again" speed; otherwise the pace follows how the learner is coping.
    await speakAsync(
      text,
      slow ? true : speechRate(paceFor(paceSignals.current)),
      PERSONA_VOICES[callRef.current.persona.id],
    );
    if (alive.current && speechToken.current === token) setPhase((p) => (p === 'speaking' ? 'ready' : p));
  }, []);

  // Ring, then pick up with the greeting. Everything stops when the screen goes away.
  useEffect(() => {
    alive.current = true;
    // The voice list loads while the call rings, so the greeting already has the character's voice.
    warmUpVoices();
    const ring = setTimeout(() => {
      const at = Date.now();
      connectedRef.current = at;
      setConnectedAt(at);
      setNow(at);
      void say(persona.greeting);
    }, RING_MS);
    return () => {
      alive.current = false;
      clearTimeout(ring);
      stopSpeaking();
      listening.current?.stop();
      listening.current = null;
      pending.current?.abort();
    };
  }, [persona, say]);

  // The call timer.
  useEffect(() => {
    if (connectedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [connectedAt]);

  // Once connected, focus where the learner answers.
  useEffect(() => {
    if (connectedAt === null) return;
    (keyboard ? input.current : micBtn.current)?.focus();
    // Only on pick-up; toggling the keyboard moves focus itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAt]);

  // Keep the newest caption in view (the character's reply sits below the learner's line and its corrections).
  useEffect(() => {
    const el = captions.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [call.lines.length, phase]);

  const request = useCallback(
    (req: CallTurnRequest) => {
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      setPhase('thinking');
      setError(null);
      setMicNote(null);
      sendTurn(req, controller.signal).then(
        (res) => {
          if (controller.signal.aborted || !alive.current) return;
          pending.current = null;
          if (res.callsToday !== undefined) onCallsToday?.(res.callsToday);
          const next = appendReply(callRef.current, res);
          setCall(next);
          setShowHe(false);
          // A teacher's correction turn is only the correction: say it slowly so it's easy to catch.
          const correcting = callRef.current.persona.corrects && (res.corrections?.length ?? 0) > 0;
          void say(res.reply, correcting).then(() => {
            // The character hung up, or this was the last turn allowed (CALL_LIMITS.maxTurns).
            if (!canTalk(next) && alive.current) setTimeout(() => alive.current && finish(), GOODBYE_MS);
          });
        },
        (err) => {
          if (controller.signal.aborted || !alive.current) return;
          pending.current = null;
          setError(errorMessage(err));
          if (isCallBlocked(err)) {
            // No retry: the call can't go on today (or without signing in / premium).
            listening.current?.stop();
            listening.current = null;
            setPhase('blocked');
            onBlocked?.(err);
          } else setPhase('error');
        },
      );
    },
    [finish, say, setCall, onCallsToday, onBlocked],
  );

  /** `spokenMs`: how long the microphone listened, when the learner said it rather than typed it. */
  function send(text: string, spokenMs?: number) {
    const message = cleanMessage(text);
    const state = callRef.current;
    if (!message || !canTalk(state) || phase === 'thinking' || phase === 'connecting' || phase === 'blocked') return;
    interrupt();
    paceSignals.current = [...paceSignals.current, judgeTurn({ text: message, spokenMs })];
    setCall(appendUser(state, message));
    request(turnRequest(state, message, paceFor(paceSignals.current), level));
  }

  function retry() {
    const req = retryRequest(callRef.current, paceFor(paceSignals.current), level);
    if (req) request(req);
  }

  async function toggleMic(target: ListenFor = 'sentence') {
    if (listening.current) {
      listening.current.stop();
      return;
    }
    interrupt();
    setMicNote(null);
    const startedAt = Date.now();
    const current = listen(target === 'word' ? 'he-IL' : 'en-US');
    listening.current = current;
    setListenFor(target);
    setPhase('listening');
    try {
      const heard = await current.result;
      if (listening.current !== current) return;
      listening.current = null;
      setPhase('ready');
      const text = heard[0]?.trim() ?? '';
      if (text)
        send(target === 'word' ? wordRequest(text) : text, target === 'word' ? undefined : Date.now() - startedAt);
      else setMicNote(MIC_ERRORS['no-speech']);
    } catch (e) {
      if (listening.current !== current) return;
      listening.current = null;
      setPhase('ready');
      const code: ListenError = (e as ListenError) in MIC_ERRORS ? (e as ListenError) : 'error';
      // The learner opened the microphone for a sentence and nothing came out: they may be stuck.
      if (code === 'no-speech' && target === 'sentence') {
        paceSignals.current = [...paceSignals.current, judgeTurn({ text: '' })];
      }
      setMicNote(MIC_ERRORS[code]);
    }
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) interrupt();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  }

  const connecting = phase === 'connecting';
  const busy = connecting || phase === 'thinking';
  const blocked = phase === 'blocked';
  const talkable = canTalk(call) && !connecting && !blocked;
  const lastUserIndex = lastIndexOf(call.lines, 'user');
  const lastUser: CallLine | undefined = call.lines[lastUserIndex];
  const lastReply = call.lines[lastIndexOf(call.lines, 'assistant')];
  // The reply to the learner's newest line hasn't arrived yet.
  const awaiting = lastUserIndex === call.lines.length - 1;
  // Lines the character answered – a blocked call with none goes straight back, without a summary.
  const answered = learnerTurns(call) - (awaiting ? 1 : 0);
  const isListening = phase === 'listening';

  let status: string;
  if (micNote) status = micNote;
  else if (connecting) status = `מתקשרים ל${persona.name}…`;
  else if (call.ended) status = 'השיחה הסתיימה.';
  else if (!canTalk(call)) status = 'הגעתם למספר ההודעות המרבי בשיחה – עוד רגע נראה סיכום.';
  else if (isListening && listenFor === 'word') status = 'אמרו את המילה בעברית… לחצו שוב כשסיימתם';
  else if (isListening) status = 'מקשיבים… לחצו שוב כשסיימתם';
  else if (phase === 'thinking') status = 'מחכים לתשובה…';
  else if (phase === 'speaking') status = `${persona.name} עונה…`;
  else if (phase === 'error' || blocked) status = '';
  else status = keyboard && !canListen ? 'כתבו באנגלית ולחצו על שליחה' : 'לחצו על המיקרופון ודברו באנגלית';

  const wordListening = isListening && listenFor === 'word';
  const sentenceListening = isListening && listenFor === 'sentence';

  return (
    <div className="call-screen" style={personaStyle(persona.color)}>
      <header className="call-top">
        <span className="call-kind">
          <Icon name="phone" />
          שיחת תרגול באנגלית
        </span>
      </header>

      <div className="call-stage">
        <Avatar persona={persona} talking={phase === 'speaking'} ringing={connecting} />
        <div className="call-id">
          <span className="call-name" dir="ltr">
            {persona.name}
          </span>
          <span className="ai-badge" title="בינה מלאכותית">
            AI
          </span>
        </div>
        <div className="call-role">{persona.roleHe}</div>
        <div className="call-timer" aria-label={connecting ? 'מתקשרים' : 'משך השיחה'}>
          {connecting || connectedAt === null ? 'מתקשרים…' : <span dir="ltr">{formatDuration(now - connectedAt)}</span>}
        </div>
        <VoiceWave active={phase === 'speaking' || isListening} you={isListening} />
      </div>

      {persona.corrects && (
        <div className="call-level" role="radiogroup" aria-label="מה המורה מתקנת">
          <span className="call-level-title" aria-hidden="true">
            תיקונים:
          </span>
          {CORRECTION_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              className={`call-level-option${level === l ? ' selected' : ''}`}
              onClick={() => {
                setLevel(l);
                saveCorrectionLevel(l);
              }}
            >
              {CORRECTION_LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      )}

      <section ref={captions} className="call-captions" aria-label="כתוביות" aria-live="polite">
        {lastUser && (
          <div className="caption you">
            <span className="caption-who">אתם</span>
            <p className="caption-text" dir="ltr" lang="en">
              {lastUser.text}
            </p>
            {persona.corrects && lastUser.corrections && lastUser.corrections.length > 0 && (
              <div className="caption-corrections">
                <span className="caption-corrections-title">
                  <Icon name="lightbulb" /> אפשר לומר כך:
                </span>
                {lastUser.corrections.map((c, i) => (
                  <CorrectionView key={i} correction={c} />
                ))}
              </div>
            )}
          </div>
        )}

        {!connecting && (
          <div className="caption them">
            <span className="caption-who" dir="ltr">
              {persona.name}
            </span>
            {phase === 'thinking' ? (
              <div className="typing-dots" role="img" aria-label="מקלידים…">
                <span />
                <span />
                <span />
              </div>
            ) : blocked ? (
              <div className="caption-error blocked" role="alert">
                <p>{error}</p>
                <button type="button" className="btn primary small" onClick={answered > 0 ? finish : onBack}>
                  {answered > 0 ? 'לסיכום השיחה' : 'חזרה לדמויות'}
                </button>
              </div>
            ) : phase === 'error' && awaiting ? (
              <div className="caption-error" role="alert">
                <p>
                  <Icon name="wifi-off" /> {error}
                </p>
                <button type="button" className="btn ghost small" onClick={retry}>
                  נסו שוב
                </button>
              </div>
            ) : (
              <>
                <p className="caption-text" dir="ltr" lang="en">
                  {lastReply.text}
                </p>
                {lastReply.he && (
                  <>
                    <button
                      type="button"
                      className="link-btn caption-translate"
                      aria-expanded={showHe}
                      onClick={() => setShowHe((v) => !v)}
                    >
                      {showHe ? 'הסתרת התרגום' : 'תרגום'}
                    </button>
                    {showHe && <p className="caption-he">{lastReply.he}</p>}
                  </>
                )}
                {lastReply.flagged && (
                  <p className="caption-flag">
                    <Icon name={FLAG_NOTES[lastReply.flagged].icon} /> {FLAG_NOTES[lastReply.flagged].text}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <div className="call-status" role="status">
        {status}
      </div>

      {keyboard && (
        <form className="call-type" dir="ltr" onSubmit={submit}>
          <input
            ref={input}
            className="call-input"
            lang="en"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type in English…"
            aria-label="כתבו באנגלית"
            maxLength={400}
            enterKeyHint="send"
            autoComplete="off"
            disabled={!talkable}
          />
          <button type="submit" className="call-send" aria-label="שליחה" disabled={!talkable || busy || !draft.trim()}>
            <Icon name="send-horizontal" />
          </button>
        </form>
      )}

      <div className="call-controls">
        <div className="call-actions">
          <button
            type="button"
            className={`call-ctrl${muted ? ' on' : ''}`}
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? 'הפעלת הרמקול' : 'השתקת הרמקול'}
          >
            <span className="call-ctrl-icon">
              <Icon name={muted ? 'volume-x' : 'volume-2'} />
            </span>
            <span className="call-ctrl-label" aria-hidden="true">
              {muted ? 'מושתק' : 'רמקול'}
            </span>
          </button>
          {canListen && (
            <button
              type="button"
              className={`call-ctrl${keyboard ? ' on' : ''}`}
              onClick={() => {
                const next = !keyboard;
                setKeyboard(next);
                if (next) setTimeout(() => input.current?.focus(), 0);
              }}
              aria-pressed={keyboard}
              aria-label={keyboard ? 'הסתרת המקלדת' : 'כתיבה במקלדת'}
            >
              <span className="call-ctrl-icon">
                <Icon name="keyboard" />
              </span>
              <span className="call-ctrl-label" aria-hidden="true">
                מקלדת
              </span>
            </button>
          )}
          {canListen && (
            <button
              type="button"
              className={`call-ctrl${wordListening ? ' on listening' : ''}`}
              onClick={() => void toggleMic('word')}
              disabled={!talkable || busy || sentenceListening}
              aria-pressed={wordListening}
              aria-label={wordListening ? 'סיימתי לומר את המילה' : 'איך אומרים באנגלית? אמרו מילה בעברית'}
            >
              <span className="call-ctrl-icon">
                <Icon
                  name={wordListening ? 'square' : 'languages'}
                  className={wordListening ? 'icon-stop' : undefined}
                />
              </span>
              <span className="call-ctrl-label" aria-hidden="true">
                {wordListening ? 'סיימתי' : 'איך אומרים?'}
              </span>
            </button>
          )}
        </div>

        <div className="call-main">
          {canListen && (
            <button
              ref={micBtn}
              type="button"
              className={`call-mic${sentenceListening ? ' listening' : ''}`}
              onClick={() => void toggleMic()}
              disabled={!talkable || busy || wordListening}
              aria-pressed={sentenceListening}
              aria-label={sentenceListening ? 'סיום הדיבור' : 'לחצו ודברו'}
            >
              <Icon
                name={sentenceListening ? 'square' : 'mic'}
                className={sentenceListening ? 'icon-stop' : undefined}
              />
            </button>
          )}
          <button type="button" className="call-hangup" onClick={finish} aria-label="ניתוק השיחה">
            <Icon name="phone" />
          </button>
        </div>
      </div>
    </div>
  );
}

function lastIndexOf(lines: CallLine[], role: CallLine['role']): number {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].role === role) return i;
  return -1;
}

/** The character's contact photo, with soft rings while the phone rings or the character speaks. */
function Avatar({ persona, talking, ringing }: { persona: Persona; talking: boolean; ringing: boolean }) {
  return (
    <div className={`call-avatar${talking ? ' talking' : ''}${ringing ? ' ringing' : ''}`} aria-hidden="true">
      <PersonaPortrait persona={persona} still className="call-face" />
    </div>
  );
}

/** Sound bars under the name: moving while someone speaks (the character, or the learner), flat otherwise. */
function VoiceWave({ active, you }: { active: boolean; you: boolean }) {
  return (
    <div className={`call-wave${active ? ' active' : ''}${you ? ' you' : ''}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} />
      ))}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { CallTurnRequest, CallTurnResponse, Persona } from '../../../shared/call';
import { errorMessage } from '../../lib/api';
import {
  allCorrections,
  appendReply,
  appendUser,
  canTalk,
  cleanMessage,
  formatDuration,
  learnerTurns,
  retryRequest,
  startCall,
  turnRequest,
  type CallLine,
  type CallState,
} from '../../lib/call';
import { isCallBlocked, sendTurn } from '../../lib/call-api';
import type { ApiRequestError } from '../../lib/api-error';
import { canListen, listen, type ListenError, type Listening } from '../../lib/listen';
import { speakAsync, stopSpeaking } from '../../lib/speech';
import type { CallResult } from './CallSummary';
import { CorrectionView } from './CallSummary';
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
type Camera = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

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

const FLAG_NOTES: Record<NonNullable<CallTurnResponse['flagged']>, string> = {
  personal_info: '🛡️ זכרו: לא משתפים פרטים אישיים כמו כתובת, טלפון או שם בית הספר.',
  inappropriate: '🛡️ בואו נשמור על שיחה נעימה ומכבדת.',
  self_harm: '💙 אם קשה לכם, אתם לא לבד. דברו עם מבוגר שאתם סומכים עליו, או התקשרו לער״ן – 1201, בכל שעה.',
};

/**
 * A "video call" with an AI character: the character's animated face, live captions, push-to-talk
 * microphone (or typing), and an optional self-view that never leaves the device.
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
  const [camera, setCamera] = useState<Camera>('off');

  const callRef = useRef(call);
  const mutedRef = useRef(false);
  const alive = useRef(true);
  const speechToken = useRef(0);
  const listening = useRef<Listening | null>(null);
  const pending = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const connectedRef = useRef<number | null>(null);
  const ended = useRef(false);
  const micBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const setCall = useCallback((next: CallState) => {
    callRef.current = next;
    setCallState(next);
  }, []);

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
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
    stopCamera();
    const state = callRef.current;
    onEnd({
      persona: state.persona,
      durationMs: connectedRef.current === null ? 0 : Date.now() - connectedRef.current,
      turns: learnerTurns(state),
      corrections: allCorrections(state),
    });
  }, [onEnd, stopCamera]);

  /** The character says `text` (unless the speaker is muted); resolves when done. */
  const say = useCallback(async (text: string) => {
    const token = ++speechToken.current;
    if (mutedRef.current) {
      setPhase('ready');
      return;
    }
    setPhase('speaking');
    await speakAsync(text);
    if (alive.current && speechToken.current === token) setPhase((p) => (p === 'speaking' ? 'ready' : p));
  }, []);

  // Ring, then pick up with the greeting. Everything stops when the screen goes away.
  useEffect(() => {
    alive.current = true;
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
      stopCamera();
    };
  }, [persona, say, stopCamera]);

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
          void say(res.reply).then(() => {
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

  function send(text: string) {
    const message = cleanMessage(text);
    const state = callRef.current;
    if (!message || !canTalk(state) || phase === 'thinking' || phase === 'connecting' || phase === 'blocked') return;
    interrupt();
    setCall(appendUser(state, message));
    request(turnRequest(state, message));
  }

  function retry() {
    const req = retryRequest(callRef.current);
    if (req) request(req);
  }

  async function toggleMic() {
    if (listening.current) {
      listening.current.stop();
      return;
    }
    interrupt();
    setMicNote(null);
    const current = listen();
    listening.current = current;
    setPhase('listening');
    try {
      const heard = await current.result;
      if (listening.current !== current) return;
      listening.current = null;
      setPhase('ready');
      const text = heard[0]?.trim() ?? '';
      if (text) send(text);
      else setMicNote(MIC_ERRORS['no-speech']);
    } catch (e) {
      if (listening.current !== current) return;
      listening.current = null;
      setPhase('ready');
      setMicNote(MIC_ERRORS[(e as ListenError) in MIC_ERRORS ? (e as ListenError) : 'error']);
    }
  }

  function toggleMute() {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) interrupt();
  }

  async function toggleCamera() {
    if (stream.current || camera === 'on') {
      stopCamera();
      setCamera('off');
      return;
    }
    if (camera === 'starting') return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    setCamera('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      setCamera('on');
    } catch (e) {
      if (!alive.current) return;
      setCamera(e instanceof DOMException && e.name === 'NotAllowedError' ? 'denied' : 'unavailable');
    }
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
  else if (isListening) status = 'מקשיבים… לחצו שוב כשסיימתם';
  else if (phase === 'thinking') status = 'מחכים לתשובה…';
  else if (phase === 'speaking') status = `🔊 ${persona.name} עונה`;
  else if (phase === 'error' || blocked) status = '';
  else status = keyboard && !canListen ? 'כתבו באנגלית ולחצו על שליחה' : 'לחצו על המיקרופון ודברו באנגלית';

  return (
    <div className="call-screen" style={personaStyle(persona.color)}>
      <header className="call-top">
        <div className="call-id">
          <span className="call-name" dir="ltr">
            {persona.name}
          </span>
          <span className="ai-badge" title="בינה מלאכותית">
            AI
          </span>
        </div>
        <div className="call-role">{persona.roleHe}</div>
        <div className="call-timer" dir="ltr" aria-label={connecting ? 'מתקשרים' : 'משך השיחה'}>
          {connecting || connectedAt === null ? 'מתקשר...' : formatDuration(now - connectedAt)}
        </div>
      </header>

      <div className="call-stage">
        <Avatar persona={persona} talking={phase === 'speaking'} ringing={connecting} />

        {camera === 'on' && (
          <div className="self-view" aria-label="המצלמה שלכם – רק אצלכם, לא נשלחת לאף אחד">
            <video
              ref={(el) => {
                if (el && el.srcObject !== stream.current) el.srcObject = stream.current;
              }}
              autoPlay
              muted
              playsInline
            />
          </div>
        )}
        {(camera === 'denied' || camera === 'unavailable') && (
          <p className="self-view-note" role="status">
            {camera === 'denied' ? 'אין גישה למצלמה – אפשר להמשיך בלעדיה.' : 'המצלמה לא זמינה במכשיר הזה.'}
          </p>
        )}
      </div>

      <section className="call-captions" aria-label="כתוביות" aria-live="polite">
        {lastUser && (
          <div className="caption you">
            <span className="caption-who">אתם</span>
            <p className="caption-text" dir="ltr" lang="en">
              {lastUser.text}
            </p>
            {persona.corrects && lastUser.corrections && lastUser.corrections.length > 0 && (
              <div className="caption-corrections">
                <span className="caption-corrections-title">💡 אפשר לומר כך:</span>
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
                <p>📡 {error}</p>
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
                {lastReply.flagged && <p className="caption-flag">{FLAG_NOTES[lastReply.flagged]}</p>}
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
            <span aria-hidden="true">➤</span>
          </button>
        </form>
      )}

      <div className="call-controls">
        <button
          type="button"
          className={`call-ctrl${camera === 'on' ? ' on' : ''}`}
          onClick={() => void toggleCamera()}
          aria-pressed={camera === 'on'}
          aria-label={camera === 'on' ? 'כיבוי המצלמה' : 'הפעלת המצלמה (רק אצלכם)'}
          disabled={camera === 'starting'}
        >
          <span aria-hidden="true">📷</span>
          {camera !== 'on' && <span className="ctrl-slash" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className={`call-ctrl${muted ? '' : ' on'}`}
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? 'הפעלת הרמקול' : 'השתקת הרמקול'}
        >
          <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
        </button>
        {canListen && (
          <button
            ref={micBtn}
            type="button"
            className={`call-mic${isListening ? ' listening' : ''}`}
            onClick={() => void toggleMic()}
            disabled={!talkable || busy}
            aria-pressed={isListening}
            aria-label={isListening ? 'סיום הדיבור' : 'לחצו ודברו'}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        )}
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
            <span aria-hidden="true">⌨️</span>
          </button>
        )}
        <button type="button" className="call-hangup" onClick={finish} aria-label="ניתוק השיחה">
          <span aria-hidden="true">📞</span>
        </button>
      </div>
    </div>
  );
}

function lastIndexOf(lines: CallLine[], role: CallLine['role']): number {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].role === role) return i;
  return -1;
}

/** The character on the call: an animated portrait with call rings while ringing or speaking. */
function Avatar({ persona, talking, ringing }: { persona: Persona; talking: boolean; ringing: boolean }) {
  return (
    <div className={`call-avatar${talking ? ' talking' : ''}${ringing ? ' ringing' : ''}`} aria-hidden="true">
      <PersonaPortrait persona={persona} talking={talking} className="call-face" />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '../../types';
import { listen, type ListenError, type Listening } from '../../lib/listen';
import { isSpokenCorrectly } from '../../lib/spoken';
import { SpeakButton } from '../SpeakButton';

interface Props {
  exercise: Extract<Exercise, { kind: 'speak' }>;
  locked: boolean;
  onCheck: (correct: boolean, solution: string) => void;
  /** "Can't speak now": skips the speaking exercises left in this session. */
  onSkip: () => void;
}

type Status =
  | { state: 'idle' }
  | { state: 'listening' }
  | { state: 'retry'; heard: string }
  | { state: 'failed'; error: ListenError };

const ERRORS: Record<ListenError, string> = {
  denied: 'אין גישה למיקרופון. אפשר לאשר אותה בהגדרות ולנסות שוב.',
  'no-speech': 'לא שמענו כלום. לחצו על המיקרופון ודברו ברור.',
  unavailable: 'זיהוי דיבור לא זמין במכשיר הזה.',
  error: 'משהו השתבש בזיהוי הדיבור. נסו שוב.',
};

/**
 * Speaking: the learner presses the microphone and reads the sentence out loud. A wrong guess
 * just asks to try again – recognition mistakes don't cost hearts – and the exercise is checked
 * as correct once the sentence is heard.
 */
export function SpeakExercise({ exercise, locked, onCheck, onSkip }: Props) {
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const current = useRef<Listening | null>(null);

  // Stop the microphone when leaving the exercise mid-sentence.
  useEffect(
    () => () => {
      current.current?.stop();
      current.current = null;
    },
    [],
  );

  async function toggle() {
    if (locked) return;
    if (current.current) {
      current.current.stop();
      return;
    }
    const listening = listen();
    current.current = listening;
    setStatus({ state: 'listening' });
    try {
      const heard = await listening.result;
      if (current.current !== listening) return;
      if (isSpokenCorrectly(heard, exercise.answers)) {
        setStatus({ state: 'idle' });
        onCheck(true, exercise.prompt);
      } else {
        setStatus({ state: 'retry', heard: heard[0] ?? '' });
      }
    } catch (e) {
      if (current.current === listening) setStatus({ state: 'failed', error: e as ListenError });
    } finally {
      if (current.current === listening) current.current = null;
    }
  }

  const listening = status.state === 'listening';

  return (
    <>
      <div className="exercise">
        <h2 className="exercise-title">אמרו בקול</h2>
        <div className="prompt-row">
          <SpeakButton text={exercise.prompt} />
          <span className="prompt-bubble speak-prompt" dir="ltr">
            {exercise.prompt}
          </span>
        </div>
        <p className="speak-hint">{exercise.he}</p>
        <div className="mic-area">
          <button
            type="button"
            className={`mic-btn${listening ? ' listening' : ''}`}
            onClick={toggle}
            disabled={locked}
            aria-pressed={listening}
            aria-label={listening ? 'סיום הקלטה' : 'לחצו ודברו'}
          >
            <span aria-hidden="true">🎤</span>
          </button>
          <div className="mic-status" role="status">
            {status.state === 'idle' && !locked && 'לחצו על המיקרופון ואמרו את המשפט'}
            {listening && 'מקשיבים… לחצו שוב כשסיימתם'}
            {status.state === 'retry' && (
              <>
                <div>כמעט! נסו שוב.</div>
                {status.heard && (
                  <div className="mic-heard">
                    שמענו: <span dir="ltr">{status.heard}</span>
                  </div>
                )}
              </>
            )}
            {status.state === 'failed' && ERRORS[status.error]}
          </div>
        </div>
      </div>
      {!locked && (
        <footer className="lesson-footer">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              current.current?.stop();
              current.current = null;
              onSkip();
            }}
          >
            לא יכול/ה לדבר עכשיו
          </button>
        </footer>
      )}
    </>
  );
}

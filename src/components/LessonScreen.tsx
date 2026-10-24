import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorCode, Exercise, ItemAnswer } from '../types';
import { track } from '../lib/analytics';
import { exerciseType } from '../lib/exercises';
import { useBackButton } from '../lib/back';
import { MAX_HEARTS } from '../lib/progress';
import { sounds } from '../lib/sound';
import { useEnterKey } from '../lib/useEnterKey';
import { BuildExercise } from './exercises/BuildExercise';
import { ChoiceExercise } from './exercises/ChoiceExercise';
import { MatchExercise } from './exercises/MatchExercise';
import { SpeakExercise } from './exercises/SpeakExercise';
import { TypeExercise } from './exercises/TypeExercise';
import { BlankExercise } from './exercises/BlankExercise';
import { TipCard } from './TipCard';

/** XP and accuracy – what is reported to the server for a lesson. */
export interface LessonScore {
  xp: number;
  accuracy: number;
}

export interface LessonResult extends LessonScore {
  /** First-attempt answers per item (spaced repetition). */
  answers: ItemAnswer[];
  mistakes: number;
  /** Exercises answered right on the first attempt. */
  firstTryCorrect: number;
  durationMs: number;
}

/** Called when an exercise is checked, before the learner presses "continue". */
export type CheckHandler = (correct: boolean, solution: string, missedPairs?: number[], note?: string) => void;

interface Props {
  exercises: Exercise[];
  /** The lesson being played, or null for a review session (analytics). */
  lessonId: string | null;
  /** Current hearts, or null for a review session where mistakes are free. */
  hearts: number | null;
  onMistake: () => void;
  onFinish: (result: LessonResult) => void;
  onQuit: () => void;
  /** XP for finishing; a flawless run earns a bonus of 5. */
  baseXp?: number;
  /** Optional lesson tip shown before the first exercise. */
  tip?: string;
  tipTitle?: string;
  /** Review only: the SRS box of an item before this session (analytics `props.box`). */
  boxOf?: (itemKey: string) => number | undefined;
  /** When the next heart refills (ms), shown when the hearts run out. */
  nextHeartAt?: number;
  /** Out of hearts: start a review instead (absent when there is nothing to review). */
  onReview?: () => void;
  /** Out of hearts: the gem shop, for bonus hearts. */
  onShop?: () => void;
}

interface Feedback {
  correct: boolean;
  solution: string;
  /** Shown with a correct answer, together with the solution (e.g. a spelling slip). */
  note?: string;
}

/** "The next heart in N minutes" for the out-of-hearts screen. */
export function heartCountdown(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 1) return 'לב חדש בעוד פחות מדקה';
  return `לב חדש בעוד ${minutes} דקות`;
}

const PRAISE = ['מצוין!', 'כל הכבוד!', 'נהדר!', 'מעולה!', 'יפה מאוד!'];

export function lessonResult(total: number, mistakes: number, baseXp = 10): LessonScore {
  return {
    xp: baseXp + (mistakes === 0 ? 5 : 0),
    accuracy: Math.round((total / (total + mistakes)) * 100),
  };
}

/**
 * The first-attempt answers of one exercise: one per item key, a match exercise one per pair
 * (wrong when the pair was part of a wrong match). Exercises without keys report nothing.
 */
export function itemAnswers(exercise: Exercise, correct: boolean, missedPairs: readonly number[] = []): ItemAnswer[] {
  const exType = exerciseType(exercise);
  if (exercise.kind === 'match') {
    return (exercise.itemKeys ?? []).map((itemKey, i) => ({ itemKey, correct: !missedPairs.includes(i), exType }));
  }
  if (!exercise.itemKey) return [];
  const errors: ErrorCode[] | undefined =
    exercise.kind === 'build' || exercise.kind === 'type' || exercise.kind === 'blank' ? exercise.errors : undefined;
  return [{ itemKey: exercise.itemKey, correct, exType, ...(errors?.length ? { errors } : {}) }];
}

/**
 * Runs one lesson or review session. A wrong answer costs a heart (not in a review) and the
 * exercise is queued again at the end, so the session only ends once everything was answered right.
 * "Can't speak now" drops the speaking exercises left in the session.
 */
export function LessonScreen({
  exercises,
  lessonId,
  hearts,
  onMistake,
  onFinish,
  onQuit,
  baseXp = 10,
  tip,
  tipTitle = 'טיפ לשיעור',
  boxOf,
  nextHeartAt,
  onReview,
  onShop,
}: Props) {
  const [queue, setQueue] = useState<Exercise[]>(exercises);
  /** How many of the original exercises are still in the session (speaking ones can be skipped). */
  const [total, setTotal] = useState(exercises.length);
  const [position, setPosition] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [solved, setSolved] = useState(0);
  const [showTip, setShowTip] = useState(Boolean(tip));
  /** "Leave the lesson?" is open (✕ or the back button after answering something). */
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const answers = useRef<ItemAnswer[]>([]);
  const firstTry = useRef({ answered: 0, correct: 0 });

  const exercise = queue[position];
  const percent = (solved / total) * 100;
  const review = lessonId === null;

  const handleCheck = useCallback<CheckHandler>(
    (correct, solution, missedPairs = [], note) => {
      const current = queue[position];
      // Repeats are appended after the original exercises, so a position inside the original
      // list is always a first attempt. Speaking isn't reported (see ExerciseType).
      if (position < total && current) {
        const firstCorrect = correct && missedPairs.length === 0;
        answers.current.push(...itemAnswers(current, correct, missedPairs));
        firstTry.current.answered += 1;
        if (firstCorrect) firstTry.current.correct += 1;
        if (current.kind !== 'speak') {
          const errors =
            current.kind === 'build' || current.kind === 'type' || current.kind === 'blank'
              ? current.errors
              : undefined;
          const itemKey = current.kind !== 'match' ? current.itemKey : undefined;
          const box = itemKey && boxOf ? boxOf(itemKey) : undefined;
          const props = {
            ...(errors?.length ? { errors: [...errors] } : {}),
            ...(box !== undefined ? { box } : {}),
            ...(current.kind === 'type' ? { typed: true } : {}),
            ...(current.kind === 'blank' ? { blank: true } : {}),
          };
          track({
            name: 'exercise_answer',
            lessonId,
            ...(itemKey ? { itemKey } : {}),
            exType: exerciseType(current),
            correct: firstCorrect,
            firstTry: true,
            ...(Object.keys(props).length ? { props } : {}),
          });
        }
      }
      setFeedback({ correct, solution, ...(note ? { note } : {}) });
      if (correct) {
        sounds.correct();
        setSolved((n) => n + 1);
      } else {
        sounds.wrong();
        setMistakes((m) => m + 1);
        setQueue((q) => [...q, q[position]]);
        if (hearts === 1 && lessonId) track({ name: 'hearts_out', lessonId });
        onMistake();
      }
    },
    [queue, position, total, lessonId, hearts, onMistake, boxOf],
  );

  function finish(count: number) {
    onFinish({
      ...lessonResult(count, mistakes, baseXp),
      answers: answers.current,
      mistakes,
      firstTryCorrect: firstTry.current.correct,
      durationMs: Date.now() - startedAt,
    });
  }

  function next() {
    setFeedback(null);
    if (position + 1 >= queue.length) {
      finish(total);
      return;
    }
    setPosition(position + 1);
  }

  /** Drops the current and later speaking exercises. Speaking never fails, so none are repeats. */
  function skipSpeaking() {
    const rest = queue.slice(position).filter((e) => e.kind !== 'speak');
    const left = total - queue.slice(position, total).filter((e) => e.kind === 'speak').length;
    if (rest.length === 0) {
      finish(left);
      return;
    }
    setQueue([...queue.slice(0, position), ...rest]);
    setTotal(left);
  }

  function quit() {
    track({
      name: 'lesson_abandon',
      lessonId,
      props: { answered: firstTry.current.answered, total, review },
    });
    onQuit();
  }

  /** ✕: leaving right away loses nothing, later the learner is asked first. */
  function requestQuit() {
    if (firstTry.current.answered > 0) setConfirmQuit(true);
    else quit();
  }

  const outOfHearts = hearts === 0 && !feedback;

  useBackButton(() => {
    if (confirmQuit) setConfirmQuit(false);
    else if (outOfHearts) onQuit();
    else requestQuit();
  });

  useEnterKey(next, feedback !== null && !confirmQuit);

  // The countdown to the next heart, refreshed while the learner waits.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!outOfHearts) return;
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [outOfHearts]);

  if (outOfHearts) {
    return (
      <div className="lesson out-of-hearts">
        <div className="big-emoji pop">💔</div>
        <h2>נגמרו הלבבות</h2>
        {nextHeartAt !== undefined && (
          <p className="next-heart" role="timer">
            ❤️ {heartCountdown(nextHeartAt - now)}
          </p>
        )}
        <p>
          לב חדש מתמלא כל 30 דקות. בינתיים אפשר לעשות חזרה על מה שלמדתם – בחזרה אין הורדת לבבות. ובחנות 💎 אפשר לקנות
          לבבות בונוס.
        </p>
        <div className="out-of-hearts-actions">
          {onReview && (
            <button type="button" className="btn primary" onClick={onReview} autoFocus>
              🧠 לחזרה בלי לבבות
            </button>
          )}
          {onShop && (
            <button type="button" className="btn secondary" onClick={onShop}>
              💎 לבבות בחנות
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onQuit} autoFocus={!onReview}>
            חזרה למסלול
          </button>
        </div>
      </div>
    );
  }

  if (!exercise) return null;

  const props = { locked: feedback !== null, onCheck: handleCheck };
  const praise = PRAISE[position % PRAISE.length];
  const liveText = feedback ? (feedback.correct ? praise : `לא בדיוק. התשובה הנכונה: ${feedback.solution}`) : '';

  return (
    <div className="lesson">
      <header className="lesson-header">
        <button
          type="button"
          className="icon-btn"
          onClick={requestQuit}
          aria-label={review ? 'יציאה מהחזרה' : 'יציאה מהשיעור'}
        >
          ✕
        </button>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={review ? 'התקדמות בחזרה' : 'התקדמות בשיעור'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {hearts === null ? (
          <span className="hearts practice-badge">🧠 חזרה</span>
        ) : (
          <span
            className={`hearts${feedback && !feedback.correct ? ' hit' : ''}`}
            aria-label={hearts > MAX_HEARTS ? `${hearts} לבבות` : `${hearts} לבבות מתוך ${MAX_HEARTS}`}
          >
            ❤️ {hearts}
          </span>
        )}
      </header>

      {showTip && tip ? (
        <main className="lesson-body" key="tip">
          <TipCard title={tipTitle} tip={tip} onDone={() => setShowTip(false)} />
        </main>
      ) : (
        <main
          className={`lesson-body${feedback ? (feedback.correct ? ' is-correct' : ' is-wrong') : ''}`}
          key={position}
        >
          {exercise.kind === 'choice' && <ChoiceExercise exercise={exercise} {...props} />}
          {exercise.kind === 'build' && <BuildExercise exercise={exercise} {...props} />}
          {exercise.kind === 'match' && <MatchExercise exercise={exercise} {...props} />}
          {exercise.kind === 'type' && <TypeExercise exercise={exercise} {...props} />}
          {exercise.kind === 'blank' && <BlankExercise exercise={exercise} {...props} />}
          {exercise.kind === 'speak' && <SpeakExercise exercise={exercise} {...props} onSkip={skipSpeaking} />}
        </main>
      )}

      <div className="sr-only" role="status" aria-live="assertive">
        {liveText}
      </div>

      {feedback && (
        <footer className={`lesson-footer feedback ${feedback.correct ? 'good' : 'bad'}`}>
          <div className="feedback-text">
            <strong>
              <span className="feedback-icon" aria-hidden="true">
                {feedback.correct ? '✓' : '✕'}
              </span>
              {feedback.correct ? praise : 'לא בדיוק…'}
            </strong>
            {!feedback.correct && (
              <div>
                התשובה הנכונה: <span dir="auto">{feedback.solution}</span>
              </div>
            )}
            {feedback.correct && feedback.note && (
              <div>
                {feedback.note}: <span dir="ltr">{feedback.solution}</span>
              </div>
            )}
          </div>
          <button type="button" className={`btn ${feedback.correct ? 'primary' : 'danger'}`} onClick={next} autoFocus>
            המשך
          </button>
        </footer>
      )}

      {confirmQuit && (
        <div className="sheet-backdrop" onClick={() => setConfirmQuit(false)}>
          <div
            className="sheet quit-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="quit-title"
            aria-describedby="quit-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="big-emoji" aria-hidden="true">
              🥺
            </div>
            <h2 id="quit-title">{review ? 'לצאת מהחזרה?' : 'לצאת מהשיעור?'}</h2>
            <p id="quit-text">
              {review
                ? 'ההתקדמות בחזרה הזאת לא תישמר.'
                : 'ההתקדמות בשיעור הזה לא תישמר, ובפעם הבאה תתחילו אותו מההתחלה.'}
            </p>
            <button type="button" className="btn primary" onClick={() => setConfirmQuit(false)} autoFocus>
              {review ? 'ממשיכים בחזרה' : 'ממשיכים ללמוד'}
            </button>
            <button type="button" className="btn ghost" onClick={quit}>
              יציאה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

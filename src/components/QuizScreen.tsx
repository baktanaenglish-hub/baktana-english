import { useState, type ReactNode } from 'react';
import type { Exercise } from '../types';
import { sounds } from '../lib/sound';
import { useEnterKey } from '../lib/useEnterKey';
import { Icon } from './Icon';
import { BuildExercise } from './exercises/BuildExercise';
import { ChoiceExercise } from './exercises/ChoiceExercise';
import { TypeExercise } from './exercises/TypeExercise';
import { BlankExercise } from './exercises/BlankExercise';

interface Props {
  /** Shown in the header instead of hearts, e.g. a target icon and "מבחן מיקום". */
  badge: ReactNode;
  exercises: Exercise[];
  /** Called after each answer; true ends the quiz early (e.g. a placement unit was failed). */
  stop?: (answers: boolean[]) => boolean;
  onFinish: (answers: boolean[]) => void;
  onQuit: () => void;
  /** Answers already given in an earlier visit: the quiz resumes at the next question. */
  initialAnswers?: boolean[];
  /** Called with all the answers so far each time one is given (e.g. to save the test). */
  onAnswer?: (answers: boolean[]) => void;
}

interface Feedback {
  correct: boolean;
  solution: string;
  note?: string;
}

/**
 * A test run (placement, end of unit): every question is asked once – no hearts and no
 * repeats – and the answers, right or wrong, go to `onFinish`. Supports the exercise kinds
 * tests use: choice, build, type and blank.
 */
export function QuizScreen({ badge, exercises, stop, onFinish, onQuit, initialAnswers = [], onAnswer }: Props) {
  const [position, setPosition] = useState(initialAnswers.length);
  const [answers, setAnswers] = useState<boolean[]>(initialAnswers);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const exercise = exercises[position];

  function check(correct: boolean, solution: string, _missed?: number[], note?: string) {
    if (correct) sounds.correct();
    else sounds.wrong();
    const next = [...answers, correct];
    setAnswers(next);
    onAnswer?.(next);
    setFeedback({ correct, solution, ...(note ? { note } : {}) });
  }

  function next() {
    setFeedback(null);
    if (position + 1 >= exercises.length || stop?.(answers)) {
      onFinish(answers);
      return;
    }
    setPosition(position + 1);
  }

  useEnterKey(next, feedback !== null);

  if (!exercise) return null;
  const props = { locked: feedback !== null, onCheck: check };
  const percent = (answers.length / exercises.length) * 100;

  return (
    <div className="lesson">
      <header className="lesson-header">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label="יציאה מהמבחן">
          <Icon name="x" />
        </button>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="התקדמות במבחן"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="hearts practice-badge">{badge}</span>
      </header>

      <main className={`lesson-body${feedback ? (feedback.correct ? ' is-correct' : ' is-wrong') : ''}`} key={position}>
        {exercise.kind === 'choice' && <ChoiceExercise exercise={exercise} {...props} />}
        {exercise.kind === 'build' && <BuildExercise exercise={exercise} {...props} />}
        {exercise.kind === 'type' && <TypeExercise exercise={exercise} {...props} />}
        {exercise.kind === 'blank' && <BlankExercise exercise={exercise} {...props} />}
      </main>

      <div className="sr-only" role="status" aria-live="assertive">
        {feedback ? (feedback.correct ? 'נכון' : `לא בדיוק. התשובה הנכונה: ${feedback.solution}`) : ''}
      </div>

      {feedback && (
        <footer className={`lesson-footer feedback ${feedback.correct ? 'good' : 'bad'}`}>
          <div className="feedback-text">
            <strong>
              <span className="feedback-icon" aria-hidden="true">
                <Icon name={feedback.correct ? 'check' : 'x'} />
              </span>
              {feedback.correct ? 'נכון!' : 'לא בדיוק…'}
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
    </div>
  );
}

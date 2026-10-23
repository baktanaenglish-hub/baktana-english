import { useState } from 'react';
import type { Exercise } from '../../types';
import { speak } from '../../lib/speech';
import { CheckFooter } from '../CheckFooter';

interface Props {
  exercise: Extract<Exercise, { kind: 'blank' }>;
  locked: boolean;
  onCheck: (correct: boolean, solution: string) => void;
}

/** Fill in the blank: pick the missing word; the chosen word fills the gap in the sentence. */
export function BlankExercise({ exercise, locked, onCheck }: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const sentence = `${exercise.before}${exercise.before ? ' ' : ''}${exercise.answer}${exercise.after}`;

  function choose(option: string) {
    if (locked) return;
    setChosen(option);
    speak(option);
  }

  return (
    <>
      <div className="exercise">
        <h2 className="exercise-title">השלימו את המשפט</h2>
        <p className="speak-hint blank-meaning">{exercise.he}</p>
        <p className="blank-sentence" dir="ltr">
          {exercise.before}{' '}
          <span className={`blank-gap${chosen ? ' filled' : ''}`} aria-label={chosen ?? 'מילה חסרה'}>
            {chosen ?? ' '}
          </span>
          {exercise.after}
        </p>
        <div className="bank" dir="ltr">
          {exercise.options.map((option) => (
            <button
              key={option}
              type="button"
              className={`tile${chosen === option ? ' selected' : ''}`}
              onClick={() => choose(option)}
              disabled={locked}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {!locked && <CheckFooter ready={chosen !== null} onCheck={() => onCheck(chosen === exercise.answer, sentence)} />}
    </>
  );
}

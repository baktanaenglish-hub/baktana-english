import { useEffect, useState } from 'react';
import type { Exercise } from '../../types';
import { isCorrect } from '../../lib/answer';
import { speak } from '../../lib/speech';
import { CheckFooter } from '../CheckFooter';
import { SpeakButton } from '../SpeakButton';

interface Props {
  exercise: Extract<Exercise, { kind: 'build' }>;
  locked: boolean;
  onCheck: (correct: boolean, solution: string) => void;
}

/** Sentence building from a word bank. Tiles are tracked by index since words can repeat. */
export function BuildExercise({ exercise, locked, onCheck }: Props) {
  const [chosen, setChosen] = useState<number[]>([]);
  const dir = exercise.answerLang === 'en' ? 'ltr' : 'rtl';

  useEffect(() => {
    if (exercise.listen) speak(exercise.prompt);
  }, [exercise]);

  function add(index: number) {
    if (locked || chosen.includes(index)) return;
    setChosen([...chosen, index]);
    if (exercise.answerLang === 'en') speak(exercise.bank[index]);
  }

  function remove(index: number) {
    if (locked) return;
    setChosen(chosen.filter((i) => i !== index));
  }

  const answer = chosen.map((i) => exercise.bank[i]).join(' ');

  return (
    <>
      <div className="exercise">
        <h2 className="exercise-title">
          {exercise.listen ? 'מה שמעתם?' : exercise.answerLang === 'en' ? 'תרגמו לאנגלית' : 'תרגמו לעברית'}
        </h2>
        {exercise.listen ? (
          <div className="listen-row">
            <SpeakButton text={exercise.prompt} big />
            <SpeakButton text={exercise.prompt} slow big />
          </div>
        ) : (
          <div className="prompt-row">
            {exercise.promptLang === 'en' && <SpeakButton text={exercise.prompt} />}
            <span className="prompt-bubble" dir={exercise.promptLang === 'en' ? 'ltr' : 'rtl'}>
              {exercise.prompt}
            </span>
          </div>
        )}
        <div className="answer-line" dir={dir}>
          {chosen.map((i) => (
            <button key={i} type="button" className="tile" onClick={() => remove(i)} disabled={locked}>
              {exercise.bank[i]}
            </button>
          ))}
        </div>
        <div className="bank" dir={dir}>
          {exercise.bank.map((word, i) => (
            <button
              key={i}
              type="button"
              className={`tile${chosen.includes(i) ? ' used' : ''}`}
              onClick={() => add(i)}
              disabled={locked || chosen.includes(i)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
      {!locked && (
        <CheckFooter
          ready={chosen.length > 0}
          onCheck={() => onCheck(isCorrect(answer, exercise.answers), exercise.answers[0])}
        />
      )}
    </>
  );
}

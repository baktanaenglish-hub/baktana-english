import { useEffect, useState } from 'react';
import type { Exercise } from '../../types';
import { speak } from '../../lib/speech';
import { CheckFooter } from '../CheckFooter';
import { SpeakButton } from '../SpeakButton';

interface Props {
  exercise: Extract<Exercise, { kind: 'choice' }>;
  locked: boolean;
  onCheck: (correct: boolean, solution: string) => void;
}

export function ChoiceExercise({ exercise, locked, onCheck }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const englishOptions = exercise.promptLang === 'he';
  const english = englishOptions ? exercise.answer : exercise.prompt;
  const hebrew = englishOptions ? exercise.prompt : exercise.answer;

  function choose(option: string) {
    if (locked) return;
    setSelected(option);
    if (englishOptions) speak(option);
  }

  // Number keys pick an option, like the labels on the cards.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const option = exercise.options[Number(e.key) - 1];
      if (option && !locked) {
        setSelected(option);
        if (englishOptions) speak(option);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exercise, locked, englishOptions]);

  /** Before checking the pick is blue; after it the answer is green and a wrong pick red. */
  function optionState(option: string): string {
    if (!locked || selected === null) return selected === option ? ' selected' : '';
    if (option === exercise.answer) return ' correct';
    return option === selected ? ' wrong' : '';
  }

  return (
    <>
      <div className="exercise">
        {exercise.newWord && (
          <div className="new-word" role="note" aria-label={`מילה חדשה: ${english} – ${hebrew}`}>
            <span className="new-word-badge">✨ מילה חדשה</span>
            <div className="new-word-pair">
              <SpeakButton text={english} />
              <span dir="ltr" className="new-word-en">
                {english}
              </span>
              <span aria-hidden="true">=</span>
              <span>{hebrew}</span>
            </div>
          </div>
        )}
        <h2 className="exercise-title">{exercise.promptLang === 'he' ? 'איך אומרים באנגלית?' : 'מה הפירוש בעברית?'}</h2>
        <div className="prompt-row">
          {exercise.promptLang === 'en' && <SpeakButton text={exercise.prompt} />}
          <span className="prompt-word" dir={exercise.promptLang === 'en' ? 'ltr' : 'rtl'}>
            {exercise.prompt}
          </span>
        </div>
        <div className="options">
          {exercise.options.map((option, i) => (
            <button
              key={option}
              type="button"
              className={`option${optionState(option)}`}
              onClick={() => choose(option)}
              disabled={locked}
              dir={englishOptions ? 'ltr' : 'rtl'}
            >
              <span className="option-key">{i + 1}</span>
              {option}
            </button>
          ))}
        </div>
      </div>
      {!locked && (
        <CheckFooter ready={selected !== null} onCheck={() => onCheck(selected === exercise.answer, exercise.answer)} />
      )}
    </>
  );
}

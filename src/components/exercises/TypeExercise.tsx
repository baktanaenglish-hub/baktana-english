import { useEffect, useRef, useState } from 'react';
import type { Exercise } from '../../types';
import { speak } from '../../lib/speech';
import { checkTyped } from '../../lib/typing';
import { CheckFooter } from '../CheckFooter';
import { SpeakButton } from '../SpeakButton';

interface Props {
  exercise: Extract<Exercise, { kind: 'type' }>;
  locked: boolean;
  /** `note` is shown with a correct answer – here the right spelling after a small slip. */
  onCheck: (correct: boolean, solution: string, missedPairs?: number[], note?: string) => void;
}

/**
 * Typing: translate the Hebrew sentence into English, or type what you heard. Case and
 * punctuation don't matter and a small spelling slip still counts (the spelling is shown).
 * Hebrew letters mean the keyboard is still in Hebrew: nothing is checked and no heart is lost.
 */
export function TypeExercise({ exercise, locked, onCheck }: Props) {
  const [text, setText] = useState('');
  const [hebrew, setHebrew] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (exercise.listen) speak(exercise.prompt);
  }, [exercise]);

  function check() {
    if (locked) return;
    const result = checkTyped(text, exercise.answers);
    if (result.kind === 'empty') return;
    if (result.kind === 'hebrew') {
      setHebrew(true);
      input.current?.focus();
      return;
    }
    // Hand the Enter key to the feedback bar's "continue".
    input.current?.blur();
    if (result.kind === 'typo') onCheck(true, result.expected, undefined, 'שימו לב לאיות');
    else onCheck(result.kind === 'correct', exercise.answers[0]);
  }

  return (
    <>
      <div className="exercise">
        <h2 className="exercise-title">{exercise.listen ? 'הקלידו את מה ששמעתם' : 'כתבו באנגלית'}</h2>
        {exercise.listen ? (
          <div className="listen-row">
            <SpeakButton text={exercise.prompt} big />
            <SpeakButton text={exercise.prompt} slow big />
          </div>
        ) : (
          <div className="prompt-row">
            <span className="prompt-bubble">{exercise.prompt}</span>
          </div>
        )}
        <textarea
          ref={input}
          className="type-input"
          dir="ltr"
          lang="en"
          rows={3}
          value={text}
          placeholder="Type in English…"
          aria-label="התשובה באנגלית"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          disabled={locked}
          onChange={(e) => {
            setText(e.target.value);
            if (hebrew) setHebrew(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              check();
            }
          }}
        />
        {hebrew && (
          <p className="type-warning" role="alert">
            ⌨️ נראה שהמקלדת בעברית. החליפו לאנגלית ונסו שוב – זה לא נחשב טעות.
          </p>
        )}
      </div>
      {!locked && <CheckFooter ready={text.trim().length > 0} onCheck={check} />}
    </>
  );
}

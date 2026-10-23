import { useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise } from '../../types';
import { shuffle } from '../../lib/random';
import { sounds } from '../../lib/sound';
import { speak } from '../../lib/speech';

interface Props {
  exercise: Extract<Exercise, { kind: 'match' }>;
  locked: boolean;
  /** `missedPairs`: indexes into `pairs` of every pair that was part of a wrong match. */
  onCheck: (correct: boolean, solution: string, missedPairs?: number[]) => void;
}

/** Tap an English word and its Hebrew meaning. Completes by itself once every pair is found. */
export function MatchExercise({ exercise, locked, onCheck }: Props) {
  const english = useMemo(() => shuffle(exercise.pairs.map((p) => p.en)), [exercise]);
  const hebrew = useMemo(() => shuffle(exercise.pairs.map((p) => p.he)), [exercise]);
  const [en, setEn] = useState<string | null>(null);
  const [he, setHe] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState(false);
  const missed = useRef(new Set<number>());

  useEffect(() => {
    if (en === null || he === null) return;
    const ok = exercise.pairs.some((p) => p.en === en && p.he === he);
    if (ok) {
      sounds.tap();
      setMatched((m) => [...m, en]);
      setEn(null);
      setHe(null);
      return;
    }
    missed.current.add(exercise.pairs.findIndex((p) => p.en === en));
    missed.current.add(exercise.pairs.findIndex((p) => p.he === he));
    setWrong(true);
    sounds.wrong();
    const timer = setTimeout(() => {
      setWrong(false);
      setEn(null);
      setHe(null);
    }, 600);
    return () => clearTimeout(timer);
  }, [en, he, exercise]);

  useEffect(() => {
    if (!locked && matched.length === exercise.pairs.length)
      onCheck(
        true,
        '',
        [...missed.current].sort((a, b) => a - b),
      );
  }, [matched, exercise, locked, onCheck]);

  const isMatchedHe = (word: string) => exercise.pairs.some((p) => p.he === word && matched.includes(p.en));

  function cls(selected: boolean, done: boolean) {
    return `tile match-tile${done ? ' done' : ''}${selected ? (wrong ? ' wrong' : ' selected') : ''}`;
  }

  return (
    <div className="exercise">
      <h2 className="exercise-title">התאימו את הזוגות</h2>
      <div className="match-grid">
        <div className="match-col" dir="ltr">
          {english.map((word) => (
            <button
              key={word}
              type="button"
              className={cls(en === word, matched.includes(word))}
              disabled={locked || matched.includes(word) || wrong}
              onClick={() => {
                setEn(word);
                speak(word);
              }}
            >
              {word}
            </button>
          ))}
        </div>
        <div className="match-col">
          {hebrew.map((word) => (
            <button
              key={word}
              type="button"
              className={cls(he === word, isMatchedHe(word))}
              disabled={locked || isMatchedHe(word) || wrong}
              onClick={() => setHe(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

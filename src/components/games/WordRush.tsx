import { useEffect, useState } from 'react';
import type { Word } from '../../types';
import { RUSH_MS, RUSH_PENALTY_MS, rushPoints, rushQuestion, type RushQuestion } from '../../lib/games';
import { sounds } from '../../lib/sound';

interface Props {
  pool: Word[];
  onFinish: (score: number) => void;
  onQuit: () => void;
}

/** "מרוץ מילים": pick the Hebrew meaning of as many English words as possible in 60 seconds. */
export function WordRush({ pool, onFinish, onQuit }: Props) {
  const [question, setQuestion] = useState<RushQuestion>(() => rushQuestion(pool));
  const [deadline, setDeadline] = useState(() => Date.now() + RUSH_MS);
  const [now, setNow] = useState(() => Date.now());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [flash, setFlash] = useState<{ choice: string; correct: boolean } | null>(null);
  const left = Math.max(0, deadline - now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left === 0) onFinish(score);
    // Ends once, when the clock runs out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left === 0]);

  function pick(choice: string) {
    if (flash || left === 0) return;
    const correct = choice === question.word.he;
    if (correct) {
      sounds.correct();
      setScore((s) => s + rushPoints(combo + 1));
      setCombo((c) => c + 1);
    } else {
      sounds.wrong();
      setCombo(0);
      setDeadline((d) => d - RUSH_PENALTY_MS);
    }
    setFlash({ choice, correct });
    setTimeout(
      () => {
        setFlash(null);
        setQuestion((q) => rushQuestion(pool, Math.random, q.word.en));
      },
      correct ? 250 : 700,
    );
  }

  const multiplier = Math.min(5, Math.max(1, combo));
  return (
    <div className="game rush">
      <header className="lesson-header">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label="יציאה מהמשחק">
          ✕
        </button>
        <div className="progress-track" role="timer" aria-label={`${Math.ceil(left / 1000)} שניות`}>
          <div
            className={`progress-fill${left < 10_000 ? ' hurry' : ''}`}
            style={{ width: `${(left / RUSH_MS) * 100}%` }}
          />
        </div>
        <span className="rush-time" dir="ltr">
          ⏱ {Math.ceil(left / 1000)}
        </span>
      </header>
      <main className="lesson-body rush-body">
        <div className="rush-stats">
          <span className="rush-score" aria-label={`ניקוד ${score}`}>
            ⭐ {score}
          </span>
          {combo >= 2 && (
            <span className="rush-combo pop" key={combo}>
              🔥 x{multiplier}
            </span>
          )}
        </div>
        <div className={`rush-word${flash ? (flash.correct ? ' good' : ' bad') : ''}`} dir="ltr" key={question.word.en}>
          {question.word.en}
        </div>
        <div className="rush-options">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              className={`option rush-option${
                flash && option === question.word.he
                  ? ' correct'
                  : flash?.choice === option && !flash.correct
                    ? ' wrong'
                    : ''
              }`}
              onClick={() => pick(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {flash && !flash.correct && <p className="rush-penalty pop">−3 שניות</p>}
      </main>
    </div>
  );
}

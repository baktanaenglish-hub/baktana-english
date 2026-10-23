import { useEffect, useState } from 'react';
import type { Word } from '../../types';
import { MEMORY_PAIRS, memoryDeck, memoryScore, type MemoryCard } from '../../lib/games';
import { sounds } from '../../lib/sound';

interface Props {
  pool: Word[];
  onFinish: (score: number) => void;
  onQuit: () => void;
}

/** "זיכרון": turn two cards at a time and find each English word with its Hebrew meaning. */
export function MemoryGame({ pool, onFinish, onQuit }: Props) {
  const [deck] = useState<MemoryCard[]>(() => memoryDeck(pool));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const pairs = deck.length / 2;

  useEffect(() => {
    if (matched.length !== pairs) return;
    const timer = setTimeout(() => onFinish(memoryScore(moves, pairs)), 700);
    return () => clearTimeout(timer);
    // Ends once, when the last pair is found.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched.length]);

  function flip(card: MemoryCard) {
    if (open.length === 2 || open.includes(card.id) || matched.includes(card.pair)) return;
    sounds.tap();
    const next = [...open, card.id];
    setOpen(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => deck[id]);
    if (a.pair === b.pair) {
      setTimeout(() => {
        sounds.correct();
        setMatched((m) => [...m, a.pair]);
        setOpen([]);
      }, 300);
    } else {
      setTimeout(() => setOpen([]), 900);
    }
  }

  return (
    <div className="game memory">
      <header className="lesson-header">
        <button type="button" className="icon-btn" onClick={onQuit} aria-label="יציאה מהמשחק">
          ✕
        </button>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="זוגות שנמצאו"
          aria-valuemin={0}
          aria-valuemax={pairs}
          aria-valuenow={matched.length}
        >
          <div className="progress-fill gem" style={{ width: `${(matched.length / pairs) * 100}%` }} />
        </div>
        <span className="memory-moves">👆 {moves}</span>
      </header>
      <main className="lesson-body">
        <h2 className="memory-title">מצאו את {MEMORY_PAIRS} הזוגות</h2>
        <div className="memory-grid">
          {deck.map((card) => {
            const shown = open.includes(card.id) || matched.includes(card.pair);
            return (
              <button
                key={card.id}
                type="button"
                className={`memory-card${shown ? ' shown' : ''}${matched.includes(card.pair) ? ' matched' : ''}`}
                onClick={() => flip(card)}
                data-pair={card.pair}
                aria-label={shown ? card.text : 'קלף הפוך'}
                aria-pressed={shown}
              >
                <span className="memory-face" dir={card.lang === 'en' ? 'ltr' : 'rtl'}>
                  {shown ? card.text : '❓'}
                </span>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}

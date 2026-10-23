import { useEnterKey } from '../lib/useEnterKey';
import { RichTip } from './RichTip';

interface Props {
  title: string;
  tip: string;
  onDone: () => void;
}

/** A lesson's grammar tip, shown before its first exercise (docs/spec/v2.md §7.6). Not an exercise. */
export function TipCard({ title, tip, onDone }: Props) {
  useEnterKey(onDone, true);
  return (
    <>
      <div className="exercise tip-card">
        <h2 className="exercise-title">💡 לפני שמתחילים</h2>
        <div className="tip-box">
          <span className="tip-label">{title}</span>
          <RichTip text={tip} />
        </div>
      </div>
      <footer className="lesson-footer">
        <button type="button" className="btn primary" onClick={onDone} autoFocus>
          הבנתי
        </button>
      </footer>
    </>
  );
}

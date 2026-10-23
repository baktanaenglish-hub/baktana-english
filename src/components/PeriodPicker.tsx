import { PERIODS, PERIOD_LABELS, type Period } from '../../shared/groups';

interface Props {
  value: Period;
  onChange: (period: Period) => void;
  label: string;
}

/** Week / month / all-time switch for the leaderboards. */
export function PeriodPicker({ value, onChange, label }: Props) {
  return (
    <div className="chips period-picker" role="radiogroup" aria-label={label}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          className={`chip${value === p ? ' selected' : ''}`}
          onClick={() => onChange(p)}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

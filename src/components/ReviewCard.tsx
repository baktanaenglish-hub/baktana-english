interface Props {
  due: number;
  onReview: () => void;
}

/** Pinned at the top of the path once enough items are due (docs/spec/v2.md §7.2). */
export function ReviewCard({ due, onReview }: Props) {
  return (
    <section className="review-card" aria-labelledby="review-card-title">
      <span className="review-icon" aria-hidden="true">
        🧠
      </span>
      <p id="review-card-title">
        יש לך <strong>{due}</strong> מילים ומשפטים לחזרה
      </p>
      <button type="button" className="btn primary review-go" onClick={onReview}>
        לחזרה
      </button>
    </section>
  );
}

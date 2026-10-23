interface Props {
  onAccept: () => void;
  onDismiss: () => void;
}

/** Card on a guest's lesson-complete screen offering a free account (docs/spec/v2.md §7.4). */
export function SignupPrompt({ onAccept, onDismiss }: Props) {
  return (
    <section className="signup-prompt rise" aria-labelledby="signup-prompt-title" style={{ animationDelay: '0.4s' }}>
      <h3 id="signup-prompt-title">שמרו את ההתקדמות שלכם 💾</h3>
      <p>
        חשבון חינמי שומר את ה־<bdi dir="ltr">XP</bdi> והרצף בכל מכשיר
      </p>
      <div className="signup-actions">
        <button type="button" className="btn secondary" onClick={onAccept}>
          הרשמה
        </button>
        <button type="button" className="btn ghost" onClick={onDismiss}>
          אולי אחר כך
        </button>
      </div>
    </section>
  );
}

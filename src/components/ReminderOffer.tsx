import { useState } from 'react';
import { requestReminderPermission } from '../lib/reminders';

interface Props {
  time: string;
  /** Turns the reminder on (after the notification permission was granted). */
  onAccept: () => void;
  onDismiss: () => void;
}

/** Card on the lesson-complete screen offering the daily reminder, once (src/lib/reminder-offer.ts). */
export function ReminderOffer({ time, onAccept, onDismiss }: Props) {
  const [denied, setDenied] = useState(false);

  async function accept() {
    const allowed = await requestReminderPermission();
    if (allowed) onAccept();
    else setDenied(true);
  }

  return (
    <section className="signup-prompt rise" aria-labelledby="reminder-offer-title" style={{ animationDelay: '0.4s' }}>
      <h3 id="reminder-offer-title">רוצים תזכורת כל יום? ⏰</h3>
      <p>
        {denied ? (
          'בלי הרשאה להתראות אי אפשר להזכיר. אפשר לאשר בהגדרות הטלפון ולהפעיל בפרופיל.'
        ) : (
          <>
            נזכיר לכם לתרגל ב־<bdi dir="ltr">{time}</bdi> כדי לשמור על הרצף. אפשר לשנות בפרופיל.
          </>
        )}
      </p>
      <div className="signup-actions">
        {!denied && (
          <button type="button" className="btn secondary" onClick={() => void accept()}>
            כן, להזכיר לי
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onDismiss}>
          {denied ? 'סגירה' : 'לא תודה'}
        </button>
      </div>
    </section>
  );
}

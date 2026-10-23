import { useState } from 'react';
import { downloadReminderCalendar, remindersNative, requestReminderPermission } from '../lib/reminders';
import type { Settings } from '../lib/settings';

interface Props {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
}

/**
 * Daily reminder settings. In the Android app: a switch and a time for local notifications.
 * On the web, where a closed browser can't notify, a daily calendar event instead.
 */
export function ReminderSettings({ settings, onSettings }: Props) {
  const [denied, setDenied] = useState(false);

  async function toggle() {
    if (settings.reminder) {
      onSettings({ reminder: false });
      return;
    }
    const allowed = await requestReminderPermission();
    setDenied(!allowed);
    if (allowed) onSettings({ reminder: true });
  }

  const time = (
    <input
      type="time"
      className="time-input"
      dir="ltr"
      value={settings.reminderTime}
      aria-label="שעת התזכורת"
      onChange={(e) => e.target.value && onSettings({ reminderTime: e.target.value })}
    />
  );

  return (
    <section className="panel">
      <h3>⏰ תזכורת יומית</h3>
      {remindersNative ? (
        <>
          <div className="setting-row">
            <span id="reminder-label">תזכורת לתרגל כל יום</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.reminder}
              aria-labelledby="reminder-label"
              className={`switch${settings.reminder ? ' on' : ''}`}
              onClick={() => void toggle()}
            >
              <span className="switch-knob" />
            </button>
          </div>
          {settings.reminder && (
            <div className="setting-row">
              <span>באיזו שעה?</span>
              {time}
            </div>
          )}
          {settings.reminder && <p className="muted">ביום שכבר תרגלת לא תגיע תזכורת.</p>}
          {denied && (
            <p className="form-error" role="alert">
              לא קיבלנו הרשאה להתראות. אפשר לאשר אותה בהגדרות הטלפון ← אפליקציות ← Baktana English ← התראות.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="muted">הדפדפן לא יכול לשלוח תזכורות כשהאתר סגור – אבל אפשר להוסיף תזכורת יומית ליומן.</p>
          <div className="setting-row">
            <span>באיזו שעה?</span>
            {time}
          </div>
          <button
            type="button"
            className="btn secondary wide"
            onClick={() => downloadReminderCalendar(settings.reminderTime)}
          >
            📅 הוספה ליומן
          </button>
        </>
      )}
    </section>
  );
}

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { petReminderText } from './pet';

/**
 * Daily practice reminders. The Android app schedules local notifications for the next week
 * (rescheduled whenever the app opens or a lesson is finished, so a day already practised gets
 * none). Browsers can't notify while closed without a push server, so the web offers a daily
 * calendar event (.ics) instead.
 */

export const DEFAULT_REMINDER_TIME = '20:00';
/** Days scheduled ahead; the app reschedules on every open, so a week covers short breaks. */
export const REMINDER_DAYS = 7;
const FIRST_ID = 1001;

export const remindersNative = Capacitor.isNativePlatform();

/** True for a 24-hour "HH:MM" time. */
export function isValidTime(time: unknown): time is string {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/** "HH:MM" → [hours, minutes], falling back to the default time for anything malformed. */
export function parseTime(time: string): [number, number] {
  const [h, min] = (isValidTime(time) ? time : DEFAULT_REMINDER_TIME).split(':').map(Number);
  return [h, min];
}

/**
 * When to remind, in local time: the next `days` days at `time`, skipping today when the
 * learner already practised or the time has passed.
 */
export function reminderTimes(now: Date, time: string, practicedToday: boolean, days = REMINDER_DAYS): Date[] {
  const [h, m] = parseTime(time);
  const out: Date[] = [];
  for (let i = 0; out.length < days && i <= days; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 0, 0);
    if (i === 0 && (practicedToday || at <= now)) continue;
    out.push(at);
  }
  return out;
}

/** The reminder text: mentions the streak at stake when there is one. `day` varies the wording. */
export function reminderText(streak: number, day: number): { title: string; body: string } {
  if (streak > 0) {
    const days = streak === 1 ? 'יום אחד' : `${streak} ימים`;
    return { title: `🔥 הרצף שלך: ${days}`, body: 'כמה דקות של אנגלית היום, וממשיכים את הרצף!' };
  }
  const bodies = [
    'הגיע הזמן לשיעור קצר באנגלית 📚',
    'חמש דקות ביום עושות את ההבדל. נתרגל?',
    'יש לך כמה מילים לחזור עליהן 🧠',
  ];
  return { title: 'Baktana English', body: bodies[day % bodies.length] };
}

export interface ReminderState {
  enabled: boolean;
  time: string;
  practicedToday: boolean;
  streak: number;
  /** The learner's pet signs the reminders once it has the 'remind' ability. */
  pet?: { name: string; emoji: string } | null;
}

/** Android: replaces the scheduled reminders with a fresh week (or cancels them when off). */
export async function syncReminders(state: ReminderState, now = new Date()): Promise<void> {
  if (!remindersNative) return;
  try {
    const ids = Array.from({ length: REMINDER_DAYS }, (_, i) => ({ id: FIRST_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
    if (!state.enabled) return;
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== 'granted') return;
    const times = reminderTimes(now, state.time, state.practicedToday);
    await LocalNotifications.schedule({
      notifications: times.map((at, i) => {
        // Each later reminder assumes the learner kept the streak going until then.
        const streak = state.streak > 0 ? state.streak + i : 0;
        return {
          id: FIRST_ID + i,
          ...(state.pet ? petReminderText(state.pet, streak, at.getDate()) : reminderText(streak, at.getDate())),
          schedule: { at, allowWhileIdle: true },
          smallIcon: 'ic_stat_notify',
        };
      }),
    });
  } catch {
    // Notifications unavailable – the app works the same without them.
  }
}

/** Android: asks for notification permission; true when reminders can be shown. */
export async function requestReminderPermission(): Promise<boolean> {
  if (!remindersNative) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === 'granted') return true;
    const asked = await LocalNotifications.requestPermissions();
    return asked.display === 'granted';
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A daily calendar event with an alert, for calendars on any device (web fallback). */
export function reminderCalendar(time: string, now = new Date()): string {
  const [h, m] = parseTime(time);
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Baktana English//Daily reminder//HE',
    'BEGIN:VEVENT',
    `UID:baktana-english-daily-${day}@baktana`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${day}T${pad(h)}${pad(m)}00`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:🔥 תרגול אנגלית – Baktana English',
    'DESCRIPTION:כמה דקות של אנגלית: https://baktanaenglish-hub.github.io/baktana-english/',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:הגיע הזמן לתרגל אנגלית',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Web: downloads the calendar event so the learner can add it to their calendar. */
export function downloadReminderCalendar(time: string) {
  const blob = new Blob([reminderCalendar(time)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'baktana-english-reminder.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

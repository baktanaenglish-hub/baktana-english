/**
 * The one-time "remind you every day?" card after a finished lesson. Reminders are the strongest
 * reason to come back, but the switch lives deep in the profile, so the app offers it once.
 */

const STORAGE_KEY = 'baktana-english:reminder-offer:v1';

/** Whether the offer was already answered (accepted or declined) on this device. */
export function loadReminderOffered(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveReminderOffered(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage unavailable: the offer may show again, which is harmless.
  }
}

interface OfferState {
  /** The device can notify (the Android app). */
  native: boolean;
  /** The reminder is already on. */
  reminderOn: boolean;
  offered: boolean;
  lessonsCompleted: number;
}

/** Offer once, in the app, after the first finished lesson, unless the reminder is already on. */
export function shouldOfferReminder({ native, reminderOn, offered, lessonsCompleted }: OfferState): boolean {
  return native && !reminderOn && !offered && lessonsCompleted >= 1;
}

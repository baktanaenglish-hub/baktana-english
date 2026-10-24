import { describe, expect, it } from 'vitest';
import { shouldOfferReminder } from './reminder-offer';

const base = { native: true, reminderOn: false, offered: false, lessonsCompleted: 1 };

describe('the daily reminder offer', () => {
  it('shows in the app after the first finished lesson', () => {
    expect(shouldOfferReminder(base)).toBe(true);
    expect(shouldOfferReminder({ ...base, lessonsCompleted: 4 })).toBe(true);
  });

  it('stays away before a lesson, once answered, with the reminder on, or in a browser', () => {
    expect(shouldOfferReminder({ ...base, lessonsCompleted: 0 })).toBe(false);
    expect(shouldOfferReminder({ ...base, offered: true })).toBe(false);
    expect(shouldOfferReminder({ ...base, reminderOn: true })).toBe(false);
    expect(shouldOfferReminder({ ...base, native: false })).toBe(false);
  });
});

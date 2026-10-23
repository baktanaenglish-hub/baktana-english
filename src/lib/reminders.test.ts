import { describe, expect, it } from 'vitest';
import { DEFAULT_REMINDER_TIME, parseTime, reminderCalendar, reminderText, reminderTimes } from './reminders';

describe('reminderTimes', () => {
  const morning = new Date(2026, 9, 19, 9, 30);

  it('reminds today and the next six days at the chosen time', () => {
    const times = reminderTimes(morning, '20:15', false);
    expect(times).toHaveLength(7);
    expect(times[0]).toEqual(new Date(2026, 9, 19, 20, 15));
    expect(times[6]).toEqual(new Date(2026, 9, 25, 20, 15));
  });

  it('skips today once the learner practised or the time has passed', () => {
    expect(reminderTimes(morning, '20:00', true)[0]).toEqual(new Date(2026, 9, 20, 20, 0));
    expect(reminderTimes(new Date(2026, 9, 19, 21, 0), '20:00', false)[0]).toEqual(new Date(2026, 9, 20, 20, 0));
    expect(reminderTimes(morning, '20:00', true)).toHaveLength(7);
  });

  it('crosses month ends', () => {
    expect(reminderTimes(new Date(2026, 9, 31, 22, 0), '08:00', false)[0]).toEqual(new Date(2026, 10, 1, 8, 0));
  });
});

describe('parseTime', () => {
  it('reads HH:MM and falls back to the default', () => {
    expect(parseTime('07:05')).toEqual([7, 5]);
    expect(parseTime('25:00')).toEqual(parseTime(DEFAULT_REMINDER_TIME));
    expect(parseTime('nonsense')).toEqual([20, 0]);
  });
});

describe('reminderText', () => {
  it('mentions the streak at stake', () => {
    expect(reminderText(5, 0).title).toContain('5 ימים');
    expect(reminderText(1, 0).title).toContain('יום אחד');
  });

  it('varies the wording without a streak', () => {
    expect(reminderText(0, 0).body).not.toBe(reminderText(0, 1).body);
  });
});

describe('reminderCalendar', () => {
  it('is a daily recurring event with an alert at the chosen time', () => {
    const ics = reminderCalendar('19:45', new Date(2026, 9, 19, 9, 0));
    expect(ics).toContain('DTSTART:20261019T194500');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The Android path, with the Capacitor plugin replaced by a recorder.
const plugin = vi.hoisted(() => ({
  cancel: vi.fn(async () => {}),
  schedule: vi.fn(async () => ({ notifications: [] })),
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));

const { requestReminderPermission, syncReminders } = await import('./reminders');

type Scheduled = { notifications: { id: number; title: string; schedule: { at: Date } }[] };

describe('syncReminders on Android', () => {
  beforeEach(() => vi.clearAllMocks());
  const now = new Date(2026, 9, 19, 9, 0);

  it('replaces the week of reminders, skipping a day already practised', async () => {
    await syncReminders({ enabled: true, time: '20:00', practicedToday: true, streak: 4 }, now);
    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    const { notifications } = (plugin.schedule.mock.calls[0] as unknown as [Scheduled])[0];
    expect(notifications).toHaveLength(7);
    expect(notifications[0].schedule.at).toEqual(new Date(2026, 9, 20, 20, 0));
    expect(notifications[0].title).toContain('4 ימים');
    expect(new Set(notifications.map((n) => n.id)).size).toBe(7);
  });

  it('only cancels when reminders are off or not allowed', async () => {
    await syncReminders({ enabled: false, time: '20:00', practicedToday: false, streak: 0 }, now);
    plugin.checkPermissions.mockResolvedValueOnce({ display: 'denied' });
    await syncReminders({ enabled: true, time: '20:00', practicedToday: false, streak: 0 }, now);
    expect(plugin.cancel).toHaveBeenCalledTimes(2);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('asks for permission only when it is not granted yet', async () => {
    expect(await requestReminderPermission()).toBe(true);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    plugin.checkPermissions.mockResolvedValueOnce({ display: 'prompt' });
    plugin.requestPermissions.mockResolvedValueOnce({ display: 'denied' });
    expect(await requestReminderPermission()).toBe(false);
  });
});

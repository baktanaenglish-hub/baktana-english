import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';

// In-app updates for the Android app: CI publishes version.json next to the APK in the
// "android-latest" release (.github/workflows/android.yml); the native AppUpdate plugin
// (android/.../AppUpdatePlugin.java) downloads the APK and opens Android's installer.
const RELEASE_URL = 'https://github.com/baktanaenglish-hub/baktana-english/releases/download/android-latest';
export const VERSION_URL = `${RELEASE_URL}/version.json`;
export const APK_URL = `${RELEASE_URL}/BaktanaEnglish.apk`;

interface AppUpdatePlugin {
  /** `inAppUpdates` is false in the Google Play build – Play updates it (older APKs omit it). */
  getInstalledVersion(): Promise<{ versionCode: number; versionName: string; inAppUpdates?: boolean }>;
  fetchText(options: { url: string }): Promise<{ text: string }>;
  downloadAndInstall(options: { url: string }): Promise<void>;
  addListener(event: 'progress', listener: (e: { percent: number }) => void): Promise<PluginListenerHandle>;
}

const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');

/**
 * Whether this is the Google Play edition of the Android app (the "play" flavor, which has no in-app
 * updates). Store billing (src/lib/billing.ts) is only offered there.
 */
export async function isPlayBuild(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    return (await AppUpdate.getInstalledVersion()).inAppUpdates === false;
  } catch {
    return false;
  }
}

export interface LatestVersion {
  versionCode: number;
  versionName: string;
}

/** Reads the published version.json; null when it is missing or malformed. */
export function parseLatestVersion(text: string): LatestVersion | null {
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== 'object' || data === null) return null;
    const { versionCode, versionName } = data as Record<string, unknown>;
    if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) return null;
    return { versionCode, versionName: typeof versionName === 'string' ? versionName : `1.0.${versionCode}` };
  } catch {
    return null;
  }
}

/** The published version when it is newer than the installed one, otherwise null. */
export function newerVersion(installedCode: number, latest: LatestVersion | null): LatestVersion | null {
  return latest && latest.versionCode > installedCode ? latest : null;
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: LatestVersion }
  | { status: 'downloading'; version: LatestVersion; percent: number }
  | { status: 'failed'; version: LatestVersion };

/** How often returning to the app checks for an update again. */
const RECHECK_MS = 10 * 60 * 1000;

/**
 * Checks on launch and whenever the app comes back to the foreground (at most every RECHECK_MS),
 * for the sideloaded Android app only, and drives the download + install. Android keeps the app
 * alive in the background, so a launch-only check would miss updates for days.
 */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const dismissed = useRef(0);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let cancelled = false;
    let lastCheck = 0;
    const check = async () => {
      if (Date.now() - lastCheck < RECHECK_MS) return;
      lastCheck = Date.now();
      try {
        const installed = await AppUpdate.getInstalledVersion();
        if (installed.inAppUpdates === false) return;
        const { text } = await AppUpdate.fetchText({ url: `${VERSION_URL}?t=${Date.now()}` });
        const version = newerVersion(installed.versionCode, parseLatestVersion(text));
        if (!version || cancelled || version.versionCode <= dismissed.current) return;
        setState((s) => (s.status === 'idle' ? { status: 'available', version } : s));
      } catch {
        // Offline, or the release is being republished – try again later.
        lastCheck = 0;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const install = useCallback(async () => {
    if (state.status !== 'available' && state.status !== 'failed') return;
    const { version } = state;
    setState({ status: 'downloading', version, percent: 0 });
    const listener = await AppUpdate.addListener('progress', ({ percent }) =>
      setState({ status: 'downloading', version, percent }),
    );
    try {
      await AppUpdate.downloadAndInstall({ url: APK_URL });
      // Android's installer is open now; if the learner backs out, offer the button again.
      setState({ status: 'available', version });
    } catch {
      setState({ status: 'failed', version });
    } finally {
      void listener.remove();
    }
  }, [state]);

  // "Later" hides this version until the next launch; a newer one is offered again.
  const dismiss = useCallback(() => {
    setState((s) => {
      if (s.status !== 'idle') dismissed.current = s.version.versionCode;
      return { status: 'idle' };
    });
  }, []);

  return { state, install, dismiss };
}

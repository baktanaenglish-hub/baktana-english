import { useCallback, useEffect, useState } from 'react';
import { initialProgress, refresh, type Progress } from './progress';

const STORAGE_KEY = 'baktana-english:progress:v1';

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return refresh({ ...initialProgress(), ...JSON.parse(raw) });
  } catch {
    // Storage unavailable or corrupt – start fresh.
  }
  return initialProgress();
}

function save(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Ignore – progress just won't persist (e.g. private mode).
  }
}

/** Progress state persisted in localStorage, refreshed every minute for heart refills. */
export function useProgress() {
  const [progress, setProgress] = useState<Progress>(load);

  useEffect(() => save(progress), [progress]);

  useEffect(() => {
    const timer = setInterval(() => setProgress((p) => refresh(p)), 60_000);
    return () => clearInterval(timer);
  }, []);

  const update = useCallback((fn: (p: Progress) => Progress) => setProgress(fn), []);
  const reset = useCallback(() => setProgress(initialProgress()), []);

  return { progress, update, reset };
}

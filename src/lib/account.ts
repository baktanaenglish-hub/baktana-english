import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthResponse, CompleteLessonRequest } from '../../shared/api';
import { ApiRequestError, api, clearAuth, loadAuth, saveAuth, type StoredAuth } from './api';
import { dateKey, type Progress } from './progress';
import { mergeProgress } from './sync';

export type SyncStatus = 'guest' | 'syncing' | 'synced' | 'offline';

/**
 * Optional account + progress sync. Local progress stays the source of truth:
 * every server call runs in the background and failures only flip the status
 * to "offline". Signed-in learners push their progress on every app start (and
 * when the browser comes back online), so anything missed is retried then.
 */
export function useAccount(progress: Progress, update: (fn: (p: Progress) => Progress) => void) {
  const [auth, setAuth] = useState<StoredAuth | null>(loadAuth);
  const [status, setStatus] = useState<SyncStatus>(auth ? 'syncing' : 'guest');
  const progressRef = useRef(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiRequestError && error.unauthorized) {
      // Token expired or revoked – fall back to guest mode, keep local progress.
      clearAuth();
      setAuth(null);
      setStatus('guest');
      return;
    }
    setStatus('offline');
  }, []);

  const adopt = useCallback(
    (server: Progress) => {
      update((local) => mergeProgress(local, server));
      setStatus('synced');
    },
    [update],
  );

  /**
   * Uploads local progress; the server merges and returns the combined result.
   * Pass `latest` right after an update() in the same event – the ref only
   * catches up after React re-renders, so it would still hold the old state.
   */
  const sync = useCallback(
    async (latest?: Progress) => {
      if (!loadAuth()) return;
      setStatus('syncing');
      try {
        const res = await api.putProgress(latest ?? progressRef.current);
        adopt(res.progress);
      } catch (error) {
        handleError(error);
      }
    },
    [adopt, handleError],
  );

  useEffect(() => {
    void sync();
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [sync]);

  const signIn = useCallback(
    (res: AuthResponse) => {
      const stored = { token: res.token, user: res.user };
      saveAuth(stored);
      setAuth(stored);
      void sync();
    },
    [sync],
  );

  const signOut = useCallback(() => {
    void api.signOut();
    clearAuth();
    setAuth(null);
    setStatus('guest');
  }, []);

  /**
   * Deletes the account on the server, then continues as a guest. Progress on this device
   * stays (the learner can reset it separately). Errors are thrown for the form to show.
   */
  const deleteAccount = useCallback(async (password: string) => {
    await api.deleteAccount(password);
    clearAuth();
    setAuth(null);
    setStatus('guest');
  }, []);

  /** Call after the local state was already updated – reports the lesson in the background. */
  const reportLesson = useCallback(
    (lessonId: string, result: CompleteLessonRequest) => {
      if (!loadAuth()) return;
      // The device's calendar date, so the server counts the streak in the learner's time zone.
      api.completeLesson(lessonId, { ...result, date: dateKey(Date.now()) }).then(
        (res) => adopt(res.progress),
        (error) => {
          // The server's copy is behind (e.g. earlier lessons were finished offline):
          // upload local progress instead, which carries this lesson too.
          if (error instanceof ApiRequestError && error.code === 'lesson_locked') void sync();
          else handleError(error);
        },
      );
    },
    [adopt, handleError, sync],
  );

  return { user: auth?.user ?? null, status, signIn, signOut, deleteAccount, sync, reportLesson };
}

export type Account = ReturnType<typeof useAccount>;

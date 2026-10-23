import { Router, type RequestHandler } from 'express';
import type { CompleteLessonRequest, ProgressResponse } from '../../../shared/api';
import { findLesson } from '../../../src/data/course';
import { completeLesson, dateKey, isUnlocked } from '../../../src/lib/progress';
import { HttpError, badRequest } from '../errors';
import { MAX_LESSON_XP, mergeProgress, plausibleLocalDate, sanitizeProgress } from '../merge';
import type { Repo } from '../repo';

export { MAX_LESSON_XP };

export function progressRouter(repo: Repo, requireAuth: RequestHandler) {
  const router = Router();

  router.get('/progress', requireAuth, (_req, res) => {
    const body: ProgressResponse = { progress: repo.getProgress(res.locals.userId!) };
    res.json(body);
  });

  router.put('/progress', requireAuth, (req, res) => {
    const now = Date.now();
    const incoming = sanitizeProgress(req.body, now);
    if (!incoming) throw badRequest('invalid_progress', 'נתוני ההתקדמות אינם תקינים');
    const userId = res.locals.userId!;
    const stored = repo.getProgress(userId, now);
    const merged = mergeProgress(stored, incoming, now);
    // XP earned on the device that never reached /lessons/:id/complete (practice sessions,
    // lessons finished offline) still counts towards the weekly league, capped per sync
    // like a single lesson so an upload can't flood the leaderboard.
    const gained = Math.max(0, Math.min(MAX_LESSON_XP, merged.xp - stored.xp));
    repo.saveLessonResult(userId, merged, gained, now);
    const body: ProgressResponse = { progress: merged };
    res.json(body);
  });

  router.post('/lessons/:lessonId/complete', requireAuth, (req, res) => {
    const lessonId = String(req.params.lessonId);
    if (!findLesson(lessonId)) throw new HttpError(404, 'lesson_not_found', 'השיעור לא נמצא');
    const b = (req.body ?? {}) as Partial<CompleteLessonRequest>;
    if (typeof b.xp !== 'number' || !Number.isFinite(b.xp)) throw badRequest('invalid_xp', 'ניקוד ה-XP אינו תקין');
    if (typeof b.accuracy !== 'number' || !(b.accuracy >= 0 && b.accuracy <= 100)) {
      throw badRequest('invalid_accuracy', 'אחוז הדיוק אינו תקין');
    }
    const xp = Math.max(0, Math.min(MAX_LESSON_XP, Math.round(b.xp)));
    const now = Date.now();
    const userId = res.locals.userId!;
    const current = repo.getProgress(userId, now);
    if (!isUnlocked(current, lessonId)) {
      throw new HttpError(403, 'lesson_locked', 'השיעור הזה עדיין נעול – סיימו קודם את השיעור הקודם');
    }
    const today = plausibleLocalDate(b.date, now) ?? dateKey(now);
    const progress = completeLesson(current, lessonId, xp, now, today);
    repo.saveLessonResult(userId, progress, xp, now, true);
    const body: ProgressResponse = { progress };
    res.json(body);
  });

  return router;
}

import { useEffect, useRef } from 'react';
import { REVIEW_PIN_THRESHOLD } from '../../shared/srs';
import { course } from '../data/course';
import { dailyGoalOf } from '../lib/goals';
import { canPractice } from '../lib/practice';
import { currentLessonId, isCatchUp, isUnlocked, type Progress } from '../lib/progress';
import type { Unit } from '../types';
import { unitTestOpen, unitTestPassed } from '../lib/unit-test';
import { ReviewCard } from './ReviewCard';

interface Props {
  progress: Progress;
  /** Spaced-repetition items due now. */
  due: number;
  onStart: (lessonId: string) => void;
  onReview: () => void;
  /** Opens the unit's intro sheet (📖 on the banner). */
  onIntro: (unit: Unit) => void;
  /** Starts the placement test (offered until the learner gets past unit 1). */
  onPlacement?: () => void;
  /** Starts the end-of-unit test (open once every lesson of the unit is done). */
  onUnitTest?: (unit: Unit) => void;
}

export interface ReviewButtonState {
  label: string;
  disabled: boolean;
  /** Pin the review card at the top of the path. */
  pinned: boolean;
}

/** The review button in the daily card: "🧠 חזרה (N)", "💪 תרגול" or disabled (docs/spec/v2.md §7.2). */
export function reviewButtonState(due: number, anyCompleted: boolean): ReviewButtonState {
  if (due > 0) return { label: `🧠 חזרה (${due})`, disabled: false, pinned: due >= REVIEW_PIN_THRESHOLD };
  return { label: '💪 תרגול', disabled: !anyCompleted, pinned: false };
}

/** Zig-zag offsets for the lesson bubbles, like a winding path. */
const OFFSETS = [0, 60, 90, 60, 0, -60, -90, -60];

/** The placement test is offered until the learner has finished a lesson beyond unit 1. */
export function offerPlacement(progress: Progress): boolean {
  return !course.slice(1).some((unit) => unit.lessons.some((l) => (progress.completed[l.id] ?? 0) > 0));
}

export function LearningPath({ progress, due, onStart, onReview, onIntro, onPlacement, onUnitTest }: Props) {
  const current = currentLessonId(progress);
  const goal = dailyGoalOf(progress);
  const goalPercent = Math.min(100, (progress.xpToday / goal) * 100);
  const review = reviewButtonState(due, canPractice(progress));
  const currentRef = useRef<HTMLDivElement>(null);

  // Bring the lesson to continue with into view when the path opens.
  useEffect(() => {
    currentRef.current?.scrollIntoView?.({ block: 'center' });
  }, []);

  return (
    <div className="path">
      {review.pinned && <ReviewCard due={due} onReview={onReview} />}
      {onPlacement && offerPlacement(progress) && (
        <section className="placement-card">
          <p>
            <strong>כבר יודעים קצת אנגלית?</strong>
            <br />
            <span className="muted">מבחן מיקום קצר ותדלגו לרמה שלכם.</span>
          </p>
          <button type="button" className="btn secondary" onClick={onPlacement}>
            🎯 מבחן מיקום
          </button>
        </section>
      )}
      <section className="today-card">
        <div className="today-goal">
          <div className="today-head">
            <strong>🎯 יעד יומי</strong>
            <span className="muted" dir="ltr">
              {Math.min(progress.xpToday, goal)}/{goal} XP
            </span>
          </div>
          <div className="progress-track small" aria-hidden="true">
            <div className="progress-fill gold" style={{ width: `${goalPercent}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="btn secondary practice-btn"
          onClick={onReview}
          disabled={review.disabled}
          title={
            review.disabled
              ? 'סיימו שיעור כדי לפתוח תרגול'
              : due > 0
                ? 'חזרה על מילים ומשפטים שהגיע זמנם'
                : 'חזרה על שיעורים שסיימתם'
          }
        >
          {review.label}
        </button>
      </section>

      {course.map((unit) => (
        <section key={unit.id} className="unit">
          <div className="unit-banner" style={{ background: unit.color }}>
            <div className="unit-banner-text">
              <h2>
                {unit.title}
                {unitTestPassed(progress, unit) && (
                  <span className="unit-crown" title="עברת את מבחן היחידה">
                    {' '}
                    👑
                  </span>
                )}
              </h2>
              <p>{unit.description}</p>
            </div>
            <div className="unit-banner-side">
              {unit.level && (
                <span className="level-chip on-color" dir="ltr">
                  {unit.level}
                </span>
              )}
              {unit.intro && (
                <button
                  type="button"
                  className="intro-btn"
                  onClick={() => onIntro(unit)}
                  aria-label={`טיפ פתיחה: ${unit.title}`}
                  title="טיפ פתיחה"
                >
                  <span aria-hidden="true">📖</span>
                </button>
              )}
            </div>
          </div>
          <div className="unit-lessons">
            {unit.lessons.map((lesson, i) => {
              const done = (progress.completed[lesson.id] ?? 0) > 0;
              const open = isUnlocked(progress, lesson.id);
              const isCurrent = lesson.id === current;
              const catchUp = !done && isCatchUp(progress, lesson.id);
              return (
                <div
                  key={lesson.id}
                  ref={isCurrent ? currentRef : undefined}
                  className={`lesson-node${isCurrent ? ' has-label' : ''}`}
                  style={{ transform: `translateX(${OFFSETS[i % OFFSETS.length]}px)` }}
                >
                  {isCurrent && <span className="start-label">התחילו!</span>}
                  <button
                    type="button"
                    className={`node-btn${done ? ' done' : ''}${isCurrent ? ' current' : ''}`}
                    style={open ? { background: unit.color } : undefined}
                    disabled={!open}
                    onClick={() => onStart(lesson.id)}
                    data-lesson-id={lesson.id}
                    aria-label={`${lesson.title}${done ? ' (הושלם)' : open ? '' : ' (נעול)'}${catchUp ? ' (חדש!)' : ''}`}
                  >
                    {done ? '✓' : open ? '★' : '🔒'}
                  </button>
                  {catchUp && (
                    <span className="new-chip" aria-hidden="true">
                      חדש!
                    </span>
                  )}
                  <span className="node-title">{lesson.title}</span>
                </div>
              );
            })}
            {onUnitTest && unit.lessons.length > 0 && (
              <UnitTestNode
                passed={unitTestPassed(progress, unit)}
                open={unitTestOpen(progress, unit)}
                color={unit.color}
                onStart={() => onUnitTest(unit)}
              />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

interface UnitTestNodeProps {
  passed: boolean;
  open: boolean;
  color: string;
  onStart: () => void;
}

/** The end-of-unit test at the bottom of each unit: locked, open (🏆) or passed (👑, retakable). */
function UnitTestNode({ passed, open, color, onStart }: UnitTestNodeProps) {
  return (
    <div className="lesson-node unit-test-node">
      <button
        type="button"
        className={`node-btn test-btn${passed ? ' done' : ''}`}
        style={open ? { background: color } : undefined}
        disabled={!open}
        onClick={onStart}
        aria-label={`מבחן יחידה${passed ? ' (עברת)' : open ? '' : ' (נעול – סיימו את כל השיעורים)'}`}
      >
        {passed ? '👑' : open ? '🏆' : '🔒'}
      </button>
      <span className="node-title">מבחן יחידה</span>
    </div>
  );
}

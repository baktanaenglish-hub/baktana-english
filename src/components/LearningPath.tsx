import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { REVIEW_PIN_THRESHOLD } from '../../shared/srs';
import { allLessons, course } from '../data/course';
import { dailyGoalOf } from '../lib/goals';
import { canPractice } from '../lib/practice';
import { currentLessonId, isCatchUp, isUnlocked, type Progress } from '../lib/progress';
import type { Unit } from '../types';
import { unitTestOpen, unitTestPassed } from '../lib/unit-test';
import { Icon, type IconName } from './Icon';
import { ReviewCard } from './ReviewCard';

interface Props {
  progress: Progress;
  /** Spaced-repetition items due now. */
  due: number;
  onStart: (lessonId: string) => void;
  onReview: () => void;
  /** Opens the unit's intro sheet (the book button on the banner). */
  onIntro: (unit: Unit) => void;
  /** Starts the placement test (offered until the learner gets past unit 1). */
  onPlacement?: () => void;
  /** Starts the end-of-unit test (open once every lesson of the unit is done). */
  onUnitTest?: (unit: Unit) => void;
}

export interface ReviewButtonState {
  icon: IconName;
  label: string;
  disabled: boolean;
  /** Pin the review card at the top of the path. */
  pinned: boolean;
}

/** The review button in the daily card: "חזרה (N)", "תרגול" or disabled (docs/spec/v2.md §7.2). */
export function reviewButtonState(due: number, anyCompleted: boolean): ReviewButtonState {
  if (due > 0) return { icon: 'brain', label: `חזרה (${due})`, disabled: false, pinned: due >= REVIEW_PIN_THRESHOLD };
  return { icon: 'dumbbell', label: 'תרגול', disabled: !anyCompleted, pinned: false };
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
  /** What a tap on a locked bubble explains, for a few seconds. */
  const [lockedNote, setLockedNote] = useState<string | null>(null);
  useEffect(() => {
    if (!lockedNote) return;
    const id = window.setTimeout(() => setLockedNote(null), 3000);
    return () => window.clearTimeout(id);
  }, [lockedNote]);
  const currentTitle = allLessons.find((l) => l.id === current)?.title;
  const lockedLessonNote = currentTitle
    ? `השיעור הזה עוד נעול. סיימו קודם את "${currentTitle}".`
    : 'השיעור הזה עוד נעול.';

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
            <Icon name="target" /> מבחן מיקום
          </button>
        </section>
      )}
      <section className="today-card">
        <div className="today-goal">
          <div className="today-head">
            <strong>
              <Icon name="target" /> יעד יומי
            </strong>
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
          <Icon name={review.icon} /> {review.label}
        </button>
      </section>

      {course.map((unit) => (
        <UnitSection key={unit.id} unit={unit}>
          <div className="unit-banner" style={{ background: unit.color }}>
            <div className="unit-banner-text">
              <h2>
                {unit.title}
                {unitTestPassed(progress, unit) && (
                  <span className="unit-crown" title="עברתם את מבחן היחידה">
                    {' '}
                    <Icon name="crown" filled />
                  </span>
                )}
              </h2>
              <p>{unit.description}</p>
              <UnitProgress unit={unit} progress={progress} />
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
                  <Icon name="book-open" />
                </button>
              )}
            </div>
          </div>
          <UnitLessons unit={unit} progress={progress} current={current}>
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
                    aria-disabled={!open}
                    onClick={() => (open ? onStart(lesson.id) : setLockedNote(lockedLessonNote))}
                    data-lesson-id={lesson.id}
                    aria-label={`${lesson.title}${done ? ' (הושלם)' : open ? '' : ' (נעול)'}${catchUp ? ' (חדש!)' : ''}`}
                  >
                    {/* Locked bubbles show a grey star, like the rest of the path; the label and a tap say why. */}
                    <Icon name={done ? 'check' : 'star'} filled={!done} className="node-icon" />
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
                onLocked={() => setLockedNote('המבחן נפתח אחרי שמסיימים את כל השיעורים ביחידה.')}
              />
            )}
          </UnitLessons>
        </UnitSection>
      ))}
      {lockedNote && (
        <p className="path-toast" role="status">
          {lockedNote}
        </p>
      )}
    </div>
  );
}

interface UnitTestNodeProps {
  passed: boolean;
  open: boolean;
  color: string;
  onStart: () => void;
  onLocked: () => void;
}

/** The end-of-unit test at the bottom of each unit: locked, open (trophy) or passed (crown, retakable). */
function UnitTestNode({ passed, open, color, onStart, onLocked }: UnitTestNodeProps) {
  return (
    <div className="lesson-node unit-test-node">
      <button
        type="button"
        className={`node-btn test-btn${passed ? ' done' : ''}`}
        style={open ? { background: color } : undefined}
        aria-disabled={!open}
        onClick={open ? onStart : onLocked}
        aria-label={`מבחן יחידה${passed ? ' (עברתם)' : open ? '' : ' (נעול – סיימו את כל השיעורים)'}`}
      >
        <Icon name={passed ? 'crown' : 'trophy'} filled className="node-icon" />
      </button>
      <span className="node-title">מבחן יחידה</span>
    </div>
  );
}

interface UnitPartProps {
  unit: Unit;
  progress: Progress;
  current: string | undefined;
  children: ReactNode;
}

/** A unit of the path; `--unit` lets the CSS tint the current bubble and the trail in the unit's color. */
function UnitSection({ unit, children }: { unit: Unit; children: ReactNode }) {
  return (
    <section className="unit" style={{ '--unit': unit.color } as CSSProperties}>
      {children}
    </section>
  );
}

/** "3/5" and a thin bar on the unit banner. */
function UnitProgress({ unit, progress }: { unit: Unit; progress: Progress }) {
  const total = unit.lessons.length;
  if (total === 0) return null;
  const done = unit.lessons.filter((l) => (progress.completed[l.id] ?? 0) > 0).length;
  return (
    <div className="unit-progress">
      <div className="unit-progress-track" aria-hidden="true">
        <div className="unit-progress-fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="unit-progress-text">
        <span dir="ltr">
          {done}/{total}
        </span>
        <span className="sr-only"> שיעורים הושלמו</span>
      </span>
    </div>
  );
}

/** The bubbles of a unit over a winding trail: solid up to where the learner is, dotted after. */
function UnitLessons({ unit, progress, current, children }: UnitPartProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The last bubble the learner has reached: done, or the one to continue with.
  let reached = -1;
  unit.lessons.forEach((l, i) => {
    if ((progress.completed[l.id] ?? 0) > 0 || l.id === current) reached = i;
  });
  if (reached === unit.lessons.length - 1 && unitTestOpen(progress, unit)) reached = unit.lessons.length;
  const points = useNodeCenters(ref, `${current}:${reached}`);
  return (
    <div className="unit-lessons" ref={ref}>
      {points.length > 1 && (
        <svg className="path-trail" aria-hidden="true" focusable="false">
          <path className="trail-rest" d={trailPath(points.slice(Math.max(reached, 0)))} />
          {reached > 0 && <path className="trail-walked" d={trailPath(points.slice(0, reached + 1))} />}
        </svg>
      )}
      {children}
    </div>
  );
}

interface Point {
  x: number;
  y: number;
}

/** Centers of the `.node-btn` bubbles inside `ref`, re-measured when its size changes. */
function useNodeCenters(ref: RefObject<HTMLDivElement | null>, key: string): Point[] {
  const [points, setPoints] = useState<Point[]>([]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const next = [...el.querySelectorAll('.node-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2 - box.left), y: Math.round(r.top + r.height / 2 - box.top) };
      });
      setPoints((prev) =>
        prev.length === next.length && prev.every((p, i) => p.x === next[i].x && p.y === next[i].y) ? prev : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, key]);
  return points;
}

/** A smooth S-curve through the points (vertical tangents at each bubble). */
export function trailPath(points: Point[]): string {
  if (points.length < 2) return '';
  return points
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = points[i - 1];
      const midY = (prev.y + p.y) / 2;
      return `C ${prev.x} ${midY} ${p.x} ${midY} ${p.x} ${p.y}`;
    })
    .join(' ');
}

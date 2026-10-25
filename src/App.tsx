import { useCallback, useEffect, useState } from 'react';
import { MAX_DURATION_MS } from '../shared/analytics';
import type { AuthResponse } from '../shared/api';
import type { CallStatusResponse, Persona } from '../shared/call';
import { REVIEW_XP } from '../shared/srs';
import { course, findLesson } from './data/course';
import { AuthScreen, type Mode as AuthMode } from './components/AuthScreen';
import { ResetPassword } from './components/ResetPassword';
import { CallPicker } from './components/call/CallPicker';
import { CallScreen } from './components/call/CallScreen';
import { CallSummary, type CallResult } from './components/call/CallSummary';
import { LearningPath } from './components/LearningPath';
import { League, type LeagueView } from './components/League';
import { LessonComplete } from './components/LessonComplete';
import { LessonScreen, type LessonResult } from './components/LessonScreen';
import { Onboarding } from './components/Onboarding';
import { Paywall } from './components/Paywall';
import { Profile } from './components/Profile';
import { SignupPrompt } from './components/SignupPrompt';
import { TopBar } from './components/TopBar';
import { UnitIntro } from './components/UnitIntro';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAccount } from './lib/account';
import { api } from './lib/api';
import { identify, setAnalyticsEnabled, track } from './lib/analytics';
import { PREMIUM_ON_SALE, subscriptionText, syncBillingUser } from './lib/billing';
import { CALLS_ENABLED, CALLS_LOCKED, getCallStatus } from './lib/call-api';
import { ACCOUNTS_ENABLED, PASSWORD_RESET, isPasswordRecoveryLink } from './lib/config';
import { generateExercises, markNewWords, withoutSpeaking } from './lib/exercises';
import { canListen } from './lib/listen';
import { takeDuelCode, useDuels } from './lib/duels';
import { takeJoinCode, useGroups } from './lib/groups';
import { needsOnboarding, reachesGoal, setDailyGoal } from './lib/goals';
import { loadIntroSeen, markIntroSeen, shouldAutoShowIntro } from './lib/intro-seen';
import { canPractice, completePractice } from './lib/practice';
import {
  applyStreakFreeze,
  avatarEmoji,
  buy,
  chooseAvatar,
  earn,
  openChest,
  rewardActivity,
  rewardUnitTest,
  useGems,
  type GameId,
  type Reward,
} from './lib/gems';
import { DailyRewards } from './components/DailyRewards';
import { PetBubble, PetCard } from './components/pet/PetCard';
import { PetScreen } from './components/pet/PetScreen';
import {
  adoptPet,
  applyDesign,
  growPet,
  hasAbility,
  petBadge,
  petLook,
  reactionLine,
  recordChallenge,
  recordDuelWin,
  recordGroupChallenge,
  stageFor,
  toggleAccessory,
  usePet,
  type Milestones,
} from './lib/pet';
import { Shop } from './components/Shop';
import { Arcade } from './components/Arcade';
import { GameResult } from './components/games/GameResult';
import { MemoryGame } from './components/games/MemoryGame';
import { WordRush } from './components/games/WordRush';
import { finishGame, gameInfo, gameUnlocked, unlockGame, wordPool } from './lib/games';
import {
  completeLesson,
  dateKey,
  HEART_REFILL_MS,
  isCatchUp,
  loseHeart,
  resetProgress,
  visibleStreak,
  type Progress,
} from './lib/progress';
import { remindersNative, syncReminders } from './lib/reminders';
import { loadReminderOffered, saveReminderOffered, shouldOfferReminder } from './lib/reminder-offer';
import { ReminderOffer } from './components/ReminderOffer';
import { applyPlacement, placementDone, placementQuestions, unitsPassed } from './lib/placement';
import { QuizScreen } from './components/QuizScreen';
import { PlacementResult } from './components/PlacementResult';
import { UnitTestResult } from './components/UnitTestResult';
import { applyUnitTest, unitTestPassed, unitTestQuestions, unitTestScore } from './lib/unit-test';
import { buildReview, type ReviewSource } from './lib/review';
import {
  dismiss,
  lessonsCompleted,
  loadSignupPrompt,
  markShown,
  retire,
  saveSignupPrompt,
  signupRound,
  type SignupRound,
} from './lib/signup-prompt';
import { setSoundEnabled, sounds } from './lib/sound';
import { useSettings } from './lib/settings';
import { useSrs } from './lib/srs';
import { stashUserData, takeUserStash } from './lib/user-stash';
import { useBackFallback } from './lib/back';
import { useProgress } from './lib/store';
import { useAppUpdate } from './lib/update';
import type { Exercise, Unit } from './types';

/** 'pet' is opened from the path and 'shop' from the 💎 in the top bar, not from the bottom bar. */
type Tab = 'path' | 'arcade' | 'shop' | 'league' | 'call' | 'profile' | 'pet';

/** Where a sign-up started, reported with `signup_complete`. */
type AuthFrom = 'prompt' | 'profile' | 'onboarding';

type Screen =
  /** `view` opens the league tab on a given board (e.g. "my groups" after an invite link). */
  | { name: Tab; view?: LeagueView }
  /** An arcade game; `round` remounts it for "another round". */
  | { name: 'game'; game: GameId; round: number }
  | { name: 'game-done'; game: GameId; score: number; record: boolean; rewards: Reward[] }
  | { name: 'placement'; exercises: Exercise[] }
  | { name: 'placement-done'; units: number }
  | { name: 'unit-test'; unit: Unit; exercises: Exercise[] }
  | { name: 'unit-test-done'; unit: Unit; right: number; passed: boolean; rewards: Reward[] }
  | { name: 'auth'; back: Tab | 'onboarding'; mode?: AuthMode; from: AuthFrom }
  /** Opened from the password-reset email. */
  | { name: 'reset-password' }
  /** `lessonId` is null for a review session. */
  | {
      name: 'lesson';
      lessonId: string | null;
      exercises: Exercise[];
      tip?: string;
      tipTitle?: string;
      source?: ReviewSource;
    }
  | {
      name: 'complete';
      result: LessonResult;
      goalReached: boolean;
      kind: 'lesson' | 'review' | 'practice';
      rewards: Reward[];
      signup: { round: SignupRound; lessonsCompleted: number } | null;
      /** What the pet says about the session (null without a pet). */
      petLine: string | null;
    }
  /** An AI video call in progress, and its summary after hanging up. */
  | { name: 'call-active'; persona: Persona }
  | { name: 'call-summary'; result: CallResult }
  /** The premium screen (plans, buying, restoring). */
  | { name: 'premium'; back: Tab };

interface IntroState {
  unit: Unit;
  trigger: 'auto' | 'button';
  /** The lesson to open after "יאללה, מתחילים" (auto only). */
  lessonId?: string;
}

/** Five tabs at most; the shop opens from the 💎 in the top bar and from the profile. */
const ALL_TABS: { name: Exclude<Tab, 'pet' | 'shop'>; icon: string; label: string }[] = [
  { name: 'path', icon: '🏠', label: 'לימוד' },
  { name: 'arcade', icon: '🎮', label: 'משחקים' },
  { name: 'league', icon: '🏆', label: 'ליגה' },
  { name: 'call', icon: '📞', label: 'שיחה' },
  { name: 'profile', icon: '👤', label: 'פרופיל' },
];

// The league and AI calls need a backend, so static deploys without one leave them out.
const TABS = ALL_TABS.filter(
  (tab) => (tab.name !== 'league' || ACCOUNTS_ENABLED) && (tab.name !== 'call' || CALLS_ENABLED),
);

const PET_SHARED_KEY = 'baktana-english:pet-shared:v1';

/** Sends the pet badge (JSON) to the learner's groups unless this exact badge was already sent. */
async function sharePet(userId: string, badge: string) {
  const key = `${PET_SHARED_KEY}:${userId}`;
  try {
    if (localStorage.getItem(key) === badge) return;
  } catch {
    // No storage: just send it.
  }
  try {
    await api.setPet(JSON.parse(badge));
    localStorage.setItem(key, badge);
  } catch {
    // Offline, or a server from before pets: try again on the next change or launch.
  }
}

/** `app_open` is sent once per launch (StrictMode mounts effects twice in development). */
let appOpenSent = false;

export default function App() {
  const update = useAppUpdate();
  return (
    <>
      <Screens />
      <UpdatePrompt state={update.state} onInstall={() => void update.install()} onDismiss={update.dismiss} />
    </>
  );
}

function Screens() {
  const { progress, update, reset } = useProgress();
  const { settings, change: changeSettings } = useSettings();
  const account = useAccount(progress, update);
  const srs = useSrs(progress, account.user !== null);
  const { gems, update: updateGems, reset: resetGems } = useGems();
  const { pet, update: updatePet, reset: resetPet } = usePet();
  /** Days a streak freeze covered since the app opened (shown once on the path). */
  const [frozeDays, setFrozeDays] = useState(0);
  const [screen, setScreen] = useState<Screen>(() =>
    PASSWORD_RESET && isPasswordRecoveryLink() ? { name: 'reset-password' } : { name: 'path' },
  );
  const [intro, setIntro] = useState<IntroState | null>(null);
  /** An invite code from a `?join=` link, until the learner joins (or signs in to join). */
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [duelCode, setDuelCode] = useState<string | null>(null);
  /** Premium and today's call count, as last heard from the server (the call tab refreshes it). */
  const [callStatus, setCallStatus] = useState<CallStatusResponse | null>(null);
  const [reminderOffered, setReminderOffered] = useState(loadReminderOffered);
  const streak = visibleStreak(progress);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);
  // Declared before app_open so an opted-out learner sends nothing.
  useEffect(() => setAnalyticsEnabled(settings.analytics), [settings.analytics]);

  // Reschedule the week of Android reminders on launch, on settings changes and after practice,
  // so a day that was already practised gets no reminder.
  const practicedToday = progress.lastActiveDate === dateKey(Date.now());
  // Once the pet can remind, the reminders come from it.
  const reminderPet = pet && hasAbility(progress.xp, 'remind') ? pet.name : null;
  const reminderEmoji = pet ? petLook(pet, progress.xp).emoji : '';
  useEffect(() => {
    const from = reminderPet ? { name: reminderPet, emoji: reminderEmoji } : null;
    void syncReminders({ enabled: settings.reminder, time: settings.reminderTime, practicedToday, streak, pet: from });
  }, [settings.reminder, settings.reminderTime, practicedToday, streak, reminderPet, reminderEmoji]);

  // Progress made outside lessons (placement, unit tests, another device) also grows the pet.
  const milestones: Milestones = { xp: progress.xp, lessons: lessonsCompleted(progress), streak };
  useEffect(() => {
    if (!pet) return;
    const grown = growPet(pet, milestones);
    if (grown.pet === pet) return;
    updatePet(() => grown.pet);
    if (grown.gems) updateGems((s) => earn(s, grown.gems));
    // Only the milestones themselves call for growing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet !== null, milestones.xp, milestones.lessons, milestones.streak]);

  useEffect(() => {
    if (appOpenSent) return;
    appOpenSent = true;
    track({
      name: 'app_open',
      props: { guest: account.user === null, srsDue: srs.due, lessonsCompleted: lessonsCompleted(progress) },
    });
    // Only the state at launch matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A missed day is covered by a streak freeze bought with gems, so the streak survives.
  const today = dateKey(Date.now());
  useEffect(() => {
    const frozen = applyStreakFreeze(progress, gems.freezes);
    if (!frozen) return;
    update(() => frozen.progress);
    updateGems((s) => ({ ...s, freezes: Math.max(0, s.freezes - frozen.used) }));
    setFrozeDays((n) => n + frozen.used);
    void account.sync(frozen.progress);
    // Only a change of the last active day (or of the date) can call for a freeze.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.lastActiveDate, gems.freezes, today]);

  // Bonus hearts (from the gem shop) are spent before the regular ones.
  const bonusHearts = gems.bonusHearts;
  const onMistake = useCallback(() => {
    if (bonusHearts > 0) updateGems((s) => ({ ...s, bonusHearts: Math.max(0, s.bonusHearts - 1) }));
    else update((p) => loseHeart(p));
  }, [update, updateGems, bonusHearts]);
  const noop = useCallback(() => {}, []);
  const closeIntro = useCallback(() => setIntro(null), []);
  const onCallsToday = useCallback((callsToday: number) => setCallStatus((s) => (s ? { ...s, callsToday } : s)), []);

  // Another learner may sign in on this device: forget the last one's call status, then ask the
  // server again so the premium badge shows without opening the call tab first.
  const userId = account.user?.id ?? null;
  // The pet is shown to the learner's groups: send its badge whenever it looks different.
  const badgeKey = pet && userId && ACCOUNTS_ENABLED ? JSON.stringify(petBadge(pet, progress.xp)) : '';
  useEffect(() => {
    if (!userId || !badgeKey) return;
    void sharePet(userId, badgeKey);
  }, [userId, badgeKey]);
  useEffect(() => {
    setCallStatus(null);
    if (!userId || !CALLS_ENABLED) return;
    const controller = new AbortController();
    getCallStatus(controller.signal).then(
      (res) => {
        if (!controller.signal.aborted) setCallStatus(res);
      },
      () => {}, // Offline or signed out: no badge until the call tab or a sign-in tries again.
    );
    return () => controller.abort();
  }, [userId]);
  // RevenueCat follows the signed-in learner, so a purchase is linked to their account.
  useEffect(() => {
    void syncBillingUser(userId);
  }, [userId]);
  const premium = account.user !== null && callStatus?.premium === true;
  const groups = useGroups(ACCOUNTS_ENABLED ? userId : null);
  const duels = useDuels(ACCOUNTS_ENABLED ? userId : null);
  const leagueBadge = groups.unread + duels.unread + duels.unclaimed;

  // The window scrolls, not each screen, so a new screen would open where the last one was
  // scrolled to (the long path left the profile at its bottom). The path centers itself on the
  // current lesson.
  useEffect(() => {
    if (screen.name !== 'path') window.scrollTo(0, 0);
  }, [screen.name]);

  // A shared invite link opens "my groups" with the code filled in.
  useEffect(() => {
    const code = ACCOUNTS_ENABLED ? takeJoinCode() : null;
    if (!code) return;
    setJoinCode(code);
    setScreen({ name: 'league', view: 'mine' });
  }, []);
  // A shared duel link opens "head to head" with the code filled in.
  useEffect(() => {
    const code = ACCOUNTS_ENABLED ? takeDuelCode() : null;
    if (!code) return;
    setDuelCode(code);
    setScreen({ name: 'league', view: 'duels' });
  }, []);

  // Group standings change as everyone learns: refresh when the league opens or a lesson is done.
  const { refresh: refreshGroups } = groups;
  const { refresh: refreshDuels } = duels;
  useEffect(() => {
    if (screen.name !== 'league' && screen.name !== 'path') return;
    void refreshGroups();
    void refreshDuels();
  }, [screen.name, refreshGroups, refreshDuels]);

  // The Android back button: a lesson answers it itself (src/lib/back.ts); elsewhere it closes the
  // unit sheet or goes back one screen, and on the path it leaves the app.
  useBackFallback(() => {
    if (intro) {
      setIntro(null);
      return true;
    }
    switch (screen.name) {
      case 'path':
        return false;
      // A call is ended with its own button, so a stray press doesn't hang up.
      case 'call-active':
        return true;
      case 'game':
      case 'game-done':
        setScreen({ name: 'arcade' });
        return true;
      case 'auth':
        setScreen({ name: screen.back === 'onboarding' ? 'path' : screen.back });
        return true;
      case 'premium':
        setScreen({ name: screen.back });
        return true;
      case 'reset-password':
        void api.signOut();
        setScreen({ name: 'path' });
        return true;
      default:
        setScreen({ name: 'path' });
        return true;
    }
  });

  function signedIn(res: AuthResponse, mode: AuthMode, from: AuthFrom, back: Tab | 'onboarding') {
    // Gems and the pet this learner left on the device when signing out come back with them.
    const stash = takeUserStash(res.user.id);
    if (stash) {
      updateGems(() => stash.gems);
      updatePet(() => stash.pet);
    }
    account.signIn(res);
    saveSignupPrompt(retire(loadSignupPrompt()));
    if (mode === 'register') track({ name: 'signup_complete', props: { from } });
    identify();
    // Signing in from the call tab goes back to the characters; with an invite link, back to joining.
    if (joinCode) setScreen({ name: 'league', view: 'mine' });
    else if (duelCode) setScreen({ name: 'league', view: 'duels' });
    else setScreen({ name: from === 'prompt' ? 'path' : back === 'call' ? 'call' : 'profile' });
  }

  /**
   * Signing out leaves a fresh guest on the device: the account's progress and reviews stay on the
   * server (sent one last time first), and its device-only gems and pet are put aside for its next
   * sign-in, so neither the guest nor the next learner to sign in here inherits them.
   */
  async function signOut() {
    const user = account.user;
    if (!user) return;
    // A slow network doesn't hold the sign-out for long; whatever didn't get through is lost.
    await Promise.race([Promise.all([account.sync(), srs.flush()]), new Promise((done) => setTimeout(done, 5_000))]);
    stashUserData(user.id, { gems, pet });
    account.signOut();
    reset();
    srs.clear();
    resetGems();
    resetPet();
    setScreen({ name: 'path' });
  }

  /** The pet's part in a finished lesson or review: it grows, advances today's challenge and reacts. */
  function petReaction(
    after: Progress,
    kind: 'lesson' | 'review' | 'practice',
    flawless: boolean,
    goalReached: boolean,
  ) {
    if (!pet) return { rewards: [] as Reward[], gems: 0, line: null };
    const grown = growPet(pet, { xp: after.xp, lessons: lessonsCompleted(after), streak: visibleStreak(after) });
    const challenge = recordChallenge(grown.pet, { kind, flawless, xpToday: after.xpToday }, after.xp);
    updatePet(() => challenge.pet);
    const rewards: Reward[] = [];
    if (grown.gems) {
      const label = grown.evolvedTo === 1 ? `${pet.name} בקעה מהביצה!` : `${pet.name} התפתחה!`;
      rewards.push({ icon: '🐣', label, gems: grown.gems });
    }
    if (challenge.completed) {
      rewards.push({ icon: '⚡', label: `האתגר של ${pet.name}: ${challenge.completed.title}`, gems: challenge.gems });
    }
    const line = reactionLine(challenge.pet, {
      kind,
      flawless,
      goalReached,
      evolvedTo: grown.evolvedTo,
      newAccessories: grown.newAccessories,
      challenge: challenge.completed,
    });
    return { rewards, gems: grown.gems + challenge.gems, line };
  }

  if (screen.name === 'premium') {
    const { back } = screen;
    return (
      <Paywall
        user={account.user}
        status={callStatus}
        onStatus={setCallStatus}
        onSignIn={() => setScreen({ name: 'auth', back, from: 'profile' })}
        onClose={() => setScreen({ name: back })}
        onCalls={() => setScreen({ name: 'call' })}
      />
    );
  }

  if (screen.name === 'auth') {
    const { from, back } = screen;
    return (
      <AuthScreen
        initialMode={screen.mode}
        onSignedIn={(res, mode) => signedIn(res, mode, from, back)}
        onCancel={() => setScreen({ name: screen.back === 'onboarding' ? 'path' : screen.back })}
      />
    );
  }

  if (screen.name === 'reset-password') {
    return (
      <ResetPassword
        onDone={(res) => signedIn(res, 'login', 'profile', 'path')}
        onCancel={() => {
          // The link signed supabase-js in; without a new password the learner stays a guest.
          void api.signOut();
          setScreen({ name: 'path' });
        }}
        onNewLink={() => setScreen({ name: 'auth', back: 'path', mode: 'forgot', from: 'profile' })}
      />
    );
  }

  if (needsOnboarding(progress)) {
    return (
      <Onboarding
        onDone={(goal, level) => {
          update((p) => setDailyGoal(p, goal));
          track({ name: 'onboarding_complete', props: { dailyGoal: goal, level } });
          if (level === 'some') setScreen({ name: 'placement', exercises: placementQuestions() });
        }}
        onSignIn={
          ACCOUNTS_ENABLED
            ? () => setScreen({ name: 'auth', back: 'onboarding', mode: 'login', from: 'onboarding' })
            : undefined
        }
      />
    );
  }

  if (screen.name === 'lesson') {
    const { lessonId, exercises, source } = screen;
    const review = lessonId === null;
    return (
      <LessonScreen
        // A review started from the out-of-hearts screen replaces the lesson: start it fresh.
        key={lessonId ?? 'review'}
        exercises={exercises}
        lessonId={lessonId}
        hearts={review ? null : progress.hearts + gems.bonusHearts}
        onMistake={review ? noop : onMistake}
        onQuit={() => setScreen({ name: 'path' })}
        tip={screen.tip}
        tipTitle={screen.tipTitle}
        boxOf={review ? (key) => srs.store.items[key]?.box : undefined}
        nextHeartAt={progress.heartsUpdatedAt + HEART_REFILL_MS}
        onReview={srs.due > 0 || canPractice(progress) ? startReview : undefined}
        onShop={() => setScreen({ name: 'shop' })}
        onFinish={(raw) => {
          const durationMs = Math.min(MAX_DURATION_MS, Math.max(0, raw.durationMs));
          if (review) {
            const result = { ...raw, xp: REVIEW_XP };
            const after = completePractice(progress, REVIEW_XP);
            update((p) => completePractice(p, REVIEW_XP));
            // Review XP only reaches the server through a sync; send the updated progress itself.
            void account.sync(after);
            srs.record(result.answers, 'review');
            const kind = source === 'practice' ? 'practice' : 'review';
            const goalReached = reachesGoal(progress, after);
            const earned = rewardActivity(gems, { kind, flawless: raw.mistakes === 0, goalReached });
            const petPart = petReaction(after, kind, raw.mistakes === 0, goalReached);
            updateGems(() => earn(earned.state, petPart.gems));
            track({
              name: 'review_complete',
              durationMs,
              props: { size: exercises.length, correct: result.firstTryCorrect },
            });
            setScreen({
              name: 'complete',
              result,
              goalReached,
              kind,
              rewards: [...earned.rewards, ...petPart.rewards],
              signup: null,
              petLine: petPart.line,
            });
            return;
          }
          const after = completeLesson(progress, lessonId, raw.xp);
          update((p) => completeLesson(p, lessonId, raw.xp));
          account.reportLesson(lessonId, { xp: raw.xp, accuracy: raw.accuracy });
          srs.record(raw.answers, 'lesson');
          const goalReached = reachesGoal(progress, after);
          const earned = rewardActivity(gems, { kind: 'lesson', flawless: raw.mistakes === 0, goalReached });
          const petPart = petReaction(after, 'lesson', raw.mistakes === 0, goalReached);
          updateGems(() => earn(earned.state, petPart.gems));
          track({
            name: 'lesson_complete',
            lessonId,
            durationMs,
            props: { accuracy: raw.accuracy, mistakes: raw.mistakes, xp: raw.xp, heartsLeft: progress.hearts },
          });
          const done = lessonsCompleted(after);
          const prompt = loadSignupPrompt();
          const round = signupRound({
            accountsEnabled: ACCOUNTS_ENABLED,
            signedIn: account.user !== null,
            lessonsCompleted: done,
            state: prompt,
          });
          if (round) {
            saveSignupPrompt(markShown(prompt));
            track({ name: 'signup_prompt_shown', props: { lessonsCompleted: done, round } });
          }
          setScreen({
            name: 'complete',
            result: raw,
            goalReached,
            kind: 'lesson',
            rewards: [...earned.rewards, ...petPart.rewards],
            signup: round ? { round, lessonsCompleted: done } : null,
            petLine: petPart.line,
          });
        }}
        baseXp={10}
      />
    );
  }

  if (screen.name === 'placement') {
    return (
      <QuizScreen
        badge="🎯 מבחן מיקום"
        exercises={screen.exercises}
        stop={placementDone}
        onQuit={() => setScreen({ name: 'path' })}
        onFinish={(answers) => {
          const units = unitsPassed(answers);
          if (units > 0) {
            const after = applyPlacement(progress, units);
            update((p) => applyPlacement(p, units));
            void account.sync(after);
          }
          setScreen({ name: 'placement-done', units });
        }}
      />
    );
  }

  if (screen.name === 'placement-done') {
    return <PlacementResult units={screen.units} onContinue={() => setScreen({ name: 'path' })} />;
  }

  if (screen.name === 'unit-test') {
    const { unit } = screen;
    return (
      <QuizScreen
        badge="🏆 מבחן יחידה"
        exercises={screen.exercises}
        onQuit={() => setScreen({ name: 'path' })}
        onFinish={(answers) => {
          const { right, passed } = unitTestScore(answers);
          let rewards: Reward[] = [];
          if (passed && !unitTestPassed(progress, unit)) {
            const earned = rewardUnitTest(gems);
            updateGems(() => earned.state);
            rewards = earned.rewards;
          }
          if (passed) {
            const after = applyUnitTest(progress, unit);
            update((p) => applyUnitTest(p, unit));
            void account.sync(after);
          }
          setScreen({ name: 'unit-test-done', unit, right, passed, rewards });
        }}
      />
    );
  }

  if (screen.name === 'unit-test-done') {
    return (
      <UnitTestResult
        unit={screen.unit}
        right={screen.right}
        passed={screen.passed}
        rewards={screen.rewards}
        onRetry={() => startUnitTest(screen.unit)}
        onContinue={() => setScreen({ name: 'path' })}
      />
    );
  }

  if (screen.name === 'complete') {
    const { signup } = screen;
    return (
      <LessonComplete
        result={screen.result}
        streak={streak}
        goalReached={screen.goalReached}
        kind={screen.kind}
        rewards={screen.rewards}
        pet={pet && screen.petLine && <PetBubble pet={pet} xp={progress.xp} line={screen.petLine} />}
        onContinue={() => setScreen({ name: 'path' })}
        signupPrompt={
          signup ? (
            <SignupPrompt
              onAccept={() => {
                track({ name: 'signup_prompt_accepted', props: { ...signup } });
                setScreen({ name: 'auth', back: 'path', mode: 'register', from: 'prompt' });
              }}
              onDismiss={() => {
                saveSignupPrompt(dismiss(loadSignupPrompt()));
                track({ name: 'signup_prompt_dismissed', props: { ...signup } });
                setScreen({ ...screen, signup: null });
              }}
            />
          ) : (
            screen.kind === 'lesson' &&
            shouldOfferReminder({
              native: remindersNative,
              reminderOn: settings.reminder,
              offered: reminderOffered,
              lessonsCompleted: lessonsCompleted(progress),
            }) && (
              <ReminderOffer
                time={settings.reminderTime}
                onAccept={() => {
                  changeSettings({ reminder: true });
                  saveReminderOffered();
                  setReminderOffered(true);
                }}
                onDismiss={() => {
                  saveReminderOffered();
                  setReminderOffered(true);
                }}
              />
            )
          )
        }
      />
    );
  }

  if (screen.name === 'game') {
    const { game, round } = screen;
    const Game = game === 'rush' ? WordRush : MemoryGame;
    return (
      <Game
        key={round}
        pool={wordPool(progress)}
        onQuit={() => setScreen({ name: 'arcade' })}
        onFinish={(score) => {
          const done = finishGame(gems, game, score);
          updateGems(() => done.state);
          if (done.rewards.length) sounds.gem();
          setScreen({ name: 'game-done', game, score, record: done.record, rewards: done.rewards });
        }}
      />
    );
  }

  if (screen.name === 'game-done') {
    return (
      <GameResult
        title={gameInfo(screen.game).title}
        score={screen.score}
        best={gems.games.best[screen.game]}
        record={screen.record}
        rewards={screen.rewards}
        onAgain={() => setScreen({ name: 'game', game: screen.game, round: Date.now() })}
        onBack={() => setScreen({ name: 'arcade' })}
      />
    );
  }

  if (screen.name === 'call-active') {
    return (
      <CallScreen
        key={screen.persona.id}
        persona={screen.persona}
        onEnd={(result) => setScreen({ name: 'call-summary', result })}
        onBack={() => setScreen({ name: 'call' })}
        onCallsToday={onCallsToday}
        onBlocked={(error) => {
          if (error.status === 401) setCallStatus(null);
          else
            setCallStatus(
              (s) =>
                s &&
                (error.status === 403 ? { ...s, premium: false, tester: false } : { ...s, callsToday: s.callsPerDay }),
            );
        }}
      />
    );
  }

  if (screen.name === 'call-summary') {
    return (
      <CallSummary
        result={screen.result}
        onNewCall={() => setScreen({ name: 'call' })}
        onBack={() => setScreen({ name: 'path' })}
      />
    );
  }

  function openLesson(lessonId: string) {
    const found = findLesson(lessonId);
    if (!found) return;
    track({
      name: 'lesson_start',
      lessonId,
      props: { catchup: isCatchUp(progress, lessonId), attempt: (progress.completed[lessonId] ?? 0) + 1 },
    });
    const generated = generateExercises(found.lesson);
    setScreen({
      name: 'lesson',
      lessonId,
      exercises: markNewWords(
        canListen && settings.speaking ? generated : withoutSpeaking(generated),
        (key) => key in srs.store.items,
      ),
      tip: found.lesson.tip,
      tipTitle: found.lesson.title,
    });
  }

  function startLesson(lessonId: string) {
    const found = findLesson(lessonId);
    if (!found) return;
    if (shouldAutoShowIntro(found.unit, progress, loadIntroSeen())) {
      track({ name: 'unit_intro_shown', props: { unitId: found.unit.id, trigger: 'auto' } });
      setIntro({ unit: found.unit, trigger: 'auto', lessonId });
      return;
    }
    openLesson(lessonId);
  }

  function showIntro(unit: Unit) {
    track({ name: 'unit_intro_shown', props: { unitId: unit.id, trigger: 'button' } });
    setIntro({ unit, trigger: 'button' });
  }

  function confirmIntro() {
    if (!intro) return;
    setIntro(null);
    if (intro.trigger === 'auto' && intro.lessonId) {
      markIntroSeen(intro.unit.id);
      openLesson(intro.lessonId);
    }
  }

  function startReview() {
    const session = buildReview(srs.store, progress);
    if (session.exercises.length === 0) return;
    track({
      name: 'review_start',
      props: { due: srs.due, size: session.exercises.length, source: session.source },
    });
    setScreen({ name: 'lesson', lessonId: null, exercises: session.exercises, source: session.source });
  }

  function startUnitTest(unit: Unit) {
    setScreen({ name: 'unit-test', unit, exercises: unitTestQuestions(unit, course.indexOf(unit)) });
  }

  const goAuth = () => setScreen({ name: 'auth', back: screen.name, from: 'profile' });
  const goShop = () => {
    setIntro(null);
    setScreen({ name: 'shop' });
  };

  function spend(next: typeof gems | null) {
    if (!next) return;
    sounds.gem();
    updateGems(() => next);
  }

  return (
    <div className="app">
      <TopBar
        streak={streak}
        xp={progress.xp}
        hearts={progress.hearts + gems.bonusHearts}
        gems={gems.gems}
        onGems={goShop}
        premium={premium}
        name={account.user?.displayName ?? null}
        avatar={avatarEmoji(gems)}
        onProfile={() => {
          setIntro(null);
          setScreen({ name: 'profile' });
        }}
      />
      <main className="content" key={screen.name}>
        {screen.name === 'path' && frozeDays > 0 && (
          <p className="freeze-banner pop" role="status">
            🧊 הקפאת רצף שמרה על הרצף שלכם ({frozeDays === 1 ? 'יום אחד' : `${frozeDays} ימים`}). עכשיו תורכם!
          </p>
        )}
        {screen.name === 'path' && (
          <DailyRewards
            gems={gems}
            today={today}
            onOpenChest={() => {
              const opened = openChest(gems);
              if (!opened) return null;
              sounds.gem();
              updateGems(() => opened.state);
              return opened.amount;
            }}
          />
        )}
        {screen.name === 'path' && (
          <PetCard
            pet={pet}
            xp={progress.xp}
            streak={streak}
            practicedToday={practicedToday}
            onOpen={() => setScreen({ name: 'pet' })}
          />
        )}
        {screen.name === 'pet' && (
          <PetScreen
            pet={pet}
            xp={progress.xp}
            streak={streak}
            practicedToday={practicedToday}
            today={today}
            premium={premium}
            canDesignWithAi={CALLS_ENABLED && account.user !== null}
            onAdopt={(species, name) => {
              const adopted = adoptPet(species, name);
              if (!adopted) return;
              sounds.gem();
              // A learner who adopts later starts at their stage, with the accessories they already earned.
              const grown = growPet({ ...adopted, stageSeen: stageFor(progress.xp) }, milestones);
              updatePet(() => grown.pet);
            }}
            onToggleAccessory={(id) => updatePet((p) => p && toggleAccessory(p, id))}
            onDesign={(design) => updatePet((p) => p && applyDesign(p, design))}
            onPremium={
              CALLS_ENABLED && PREMIUM_ON_SALE && !CALLS_LOCKED
                ? () => setScreen({ name: 'premium', back: 'pet' })
                : undefined
            }
            onLeague={ACCOUNTS_ENABLED ? () => setScreen({ name: 'league', view: 'mine' }) : undefined}
          />
        )}
        {screen.name === 'arcade' && (
          <Arcade
            gems={gems}
            progress={progress}
            today={today}
            onPlay={(game) => {
              if (gameUnlocked(gems, progress, game)) setScreen({ name: 'game', game, round: 0 });
            }}
            onUnlock={(game) => spend(unlockGame(gems, game))}
          />
        )}
        {screen.name === 'shop' && (
          <Shop gems={gems} onBuy={(id) => spend(buy(gems, id))} onAvatar={(id) => spend(chooseAvatar(gems, id))} />
        )}
        {screen.name === 'path' && (
          <LearningPath
            progress={progress}
            due={srs.due}
            onStart={startLesson}
            onReview={startReview}
            onIntro={showIntro}
            onPlacement={() => setScreen({ name: 'placement', exercises: placementQuestions() })}
            onUnitTest={startUnitTest}
          />
        )}
        {screen.name === 'league' && (
          <League
            user={account.user}
            groups={groups}
            initialView={screen.view}
            onSignIn={goAuth}
            onGems={(amount) => {
              sounds.gem();
              // A shared prize: the pet of every member who collects it gets the group accessories.
              const shared = pet ? recordGroupChallenge(pet, milestones) : null;
              if (shared) updatePet(() => shared.pet);
              updateGems((s) => earn(s, amount + (shared?.gems ?? 0)));
              const accessory = shared?.newAccessories[0];
              if (!pet || !accessory) return null;
              return `🐾 ${pet.name} קיבלה ${accessory.name} ${accessory.icon} – פרס משותף לכל הקבוצה!`;
            }}
            joinCode={joinCode}
            onJoinCodeUsed={() => setJoinCode(null)}
            duels={duels}
            onDuelPrize={(result, gems) => {
              sounds.gem();
              // The winner's pet counts the win and earns the winner's medal.
              const won = result === 'won' && pet ? recordDuelWin(pet, milestones) : null;
              if (won) updatePet(() => won.pet);
              updateGems((s) => earn(s, gems + (won?.gems ?? 0)));
              const accessory = won?.newAccessories[0];
              if (!pet || !accessory) return null;
              return `🐾 ${pet.name} קיבלה ${accessory.name} ${accessory.icon}!`;
            }}
            duelCode={duelCode}
            onDuelCodeUsed={() => setDuelCode(null)}
            guestXp={account.user ? 0 : progress.xp}
          />
        )}
        {screen.name === 'call' && (
          <CallPicker
            user={account.user}
            status={callStatus}
            onStatus={setCallStatus}
            onSignIn={goAuth}
            onCall={(persona) => setScreen({ name: 'call-active', persona })}
            onPremium={PREMIUM_ON_SALE ? () => setScreen({ name: 'premium', back: 'call' }) : undefined}
          />
        )}
        {screen.name === 'profile' && (
          <Profile
            progress={progress}
            streak={streak}
            user={account.user}
            premium={premium}
            subscription={premium ? subscriptionText(callStatus) : ''}
            onPremium={
              // Premium is the calls, so it isn't offered while the call tab is locked.
              CALLS_ENABLED && PREMIUM_ON_SALE && !CALLS_LOCKED
                ? () => setScreen({ name: 'premium', back: 'profile' })
                : undefined
            }
            syncStatus={account.status}
            settings={settings}
            onSettings={changeSettings}
            onGoal={(xp) => update((p) => setDailyGoal(p, xp))}
            onSignIn={ACCOUNTS_ENABLED ? goAuth : undefined}
            onSignOut={() => void signOut()}
            onDeleteAccount={account.deleteAccount}
            onSync={() => void account.sync()}
            avatar={avatarEmoji(gems)}
            gems={gems.gems}
            onShop={goShop}
            onReset={() => {
              srs.reset();
              resetGems();
              // The pet starts over as an egg, keeping its kind, name and premium design.
              updatePet((p) => p && { ...adoptPet(p.species, p.name)!, design: p.design });
              if (account.user) {
                // Signed in: the reset is marked with its time so it wins over every older copy –
                // on the server and on the learner's other devices.
                const fresh = resetProgress(progress);
                update(() => fresh);
                void account.sync(fresh);
              } else {
                reset();
              }
            }}
          />
        )}
      </main>
      <nav className="bottom-nav" aria-label="ניווט ראשי">
        {TABS.map((tab) => {
          const locked = tab.name === 'call' && CALLS_LOCKED;
          return (
            <button
              key={tab.name}
              type="button"
              className={screen.name === tab.name ? 'active' : locked ? 'locked' : ''}
              aria-current={screen.name === tab.name ? 'page' : undefined}
              disabled={locked}
              title={locked ? 'בפיתוח – בקרוב' : undefined}
              onClick={() => {
                setIntro(null);
                setScreen({ name: tab.name });
              }}
            >
              <span aria-hidden="true">{locked ? '🔒' : tab.icon}</span> <span>{tab.label}</span>
              {tab.name === 'league' && leagueBadge > 0 && screen.name !== 'league' && (
                <span className="badge nav-badge" aria-label={`${leagueBadge} עדכונים חדשים בליגה`}>
                  {leagueBadge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {intro && screen.name === 'path' && (
        <UnitIntro unit={intro.unit} trigger={intro.trigger} onConfirm={confirmIntro} onClose={closeIntro} />
      )}
    </div>
  );
}

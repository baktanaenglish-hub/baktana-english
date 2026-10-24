import { expect, type Page } from '@playwright/test';
import { allLessons } from '../src/data/course';
import { tokenize } from '../src/lib/answer';
import type { Progress } from '../src/lib/progress';
import type { Lesson } from '../src/types';

export const PROGRESS_KEY = 'baktana-english:progress:v1';
export const AUTH_KEY = 'baktana-english:auth:v1';

export const lesson = (id: string): Lesson => {
  const found = allLessons.find((l) => l.id === id);
  if (!found) throw new Error(`no lesson ${id}`);
  return found;
};

/**
 * Replaces speech synthesis with a recorder, so listening exercises can be
 * solved from what the app "said" (and headless runs stay silent).
 * Also hides speech recognition, so lessons have no speaking exercises unless a test adds
 * fakeRecognition() after this.
 */
export async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    w.__spoken = [];
    const synth = {
      speak: (u: { text: string }) => w.__spoken.push(u.text),
      cancel: () => {},
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    if (!('SpeechSynthesisUtterance' in window)) {
      (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = class {
        constructor(public text: string) {}
      };
    }
  });
}

/**
 * A fake microphone for speaking exercises: it "hears" `window.__heard` when set, otherwise the
 * sentence on screen. Call after recordSpeech().
 */
export async function fakeRecognition(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown> & { __heard: string | null };
    w.__heard = null;
    w.webkitSpeechRecognition = class {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          const transcript = w.__heard ?? document.querySelector('.speak-prompt')?.textContent ?? '';
          this.onresult?.({ results: [[{ transcript }]] });
          this.onend?.();
        }, 50);
      }
      stop() {}
    };
  });
}

/** Opens the app as a brand-new visitor and gets past onboarding. */
export async function openFresh(page: Page) {
  await recordSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'בואו נתחיל' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('button', { name: /מתחילים מאפס/ }).click();
  await expect(page.locator('.path')).toBeVisible();
}

/** Seeds local progress before the app loads (the page must not be open yet). */
export async function seedProgress(page: Page, patch: Partial<Progress>) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('e2e-seeded', '1');
      }
    },
    [
      PROGRESS_KEY,
      JSON.stringify({
        xp: 0,
        completed: {},
        streak: 0,
        lastActiveDate: null,
        xpToday: 0,
        hearts: 5,
        heartsUpdatedAt: Date.now(),
        dailyGoal: 30,
        ...patch,
      }),
    ] as const,
  );
}

/** The path bubble of a lesson; its accessible name is the title plus (הושלם)/(נעול). */
// By id: some titles are prefixes of others (e.g. "בדרך כלל" / "בדרך כלל או עכשיו?").
export const lessonButton = (page: Page, id: string) => page.locator(`.node-btn[data-lesson-id="${lesson(id).id}"]`);

/**
 * Opens a lesson from the path, getting past the unit intro (first lesson of a new unit)
 * and the lesson tip card when they appear. Stops on the out-of-hearts screen too.
 */
export async function openLesson(page: Page, id: string) {
  await lessonButton(page, id).click();
  await expect(page.locator('.lesson-header, .unit-intro, .out-of-hearts').first()).toBeVisible();
  const intro = page.locator('.unit-intro');
  if (await intro.isVisible()) {
    await intro.getByRole('button', { name: 'יאללה, מתחילים' }).click();
  }
  await expect(page.locator('.lesson-header, .out-of-hearts').first()).toBeVisible();
  const tip = page.locator('.tip-card');
  if (await tip.isVisible()) {
    await page.locator('.lesson-footer').getByRole('button', { name: 'הבנתי' }).click();
    await expect(tip).toHaveCount(0);
  }
}

export async function localProgress(page: Page): Promise<Progress> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), PROGRESS_KEY);
}

export async function token(page: Page): Promise<string | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.token ?? null, AUTH_KEY);
}

type Kind = 'choice' | 'build' | 'listen' | 'match' | 'speak' | 'type' | 'blank';

/** Identifies the exercise on screen and the prompt that identifies it. */
async function current(page: Page): Promise<{ kind: Kind; prompt: string }> {
  const title = page.locator('.exercise-title');
  await expect(title).toBeVisible();
  if (await page.locator('.match-grid').count()) return { kind: 'match', prompt: 'match' };
  if (await page.locator('.mic-btn').count()) {
    return { kind: 'speak', prompt: `speak:${(await page.locator('.speak-prompt').textContent())!.trim()}` };
  }
  if (await page.locator('.blank-sentence').count()) {
    return { kind: 'blank', prompt: (await page.locator('.blank-meaning').textContent())!.trim() };
  }
  if (await page.locator('.type-input').count()) {
    // Typing: the Hebrew prompt is shown, or (type what you hear) only spoken.
    const bubble = page.locator('.prompt-bubble');
    const prompt = (await bubble.count())
      ? (await bubble.textContent())!.trim()
      : `listen:${await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1) ?? '')}`;
    return { kind: 'type', prompt };
  }
  if (await page.locator('.prompt-word').count()) {
    return { kind: 'choice', prompt: (await page.locator('.prompt-word').textContent())!.trim() };
  }
  if (await page.locator('.prompt-bubble').count()) {
    return { kind: 'build', prompt: (await page.locator('.prompt-bubble').textContent())!.trim() };
  }
  // Listening: the prompt is only spoken – read it back from the recorder.
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.at(-1) ?? '');
  return { kind: 'listen', prompt: `listen:${spoken}` };
}

async function clickTiles(page: Page, words: string[]) {
  for (const word of words) {
    // Tiles may show a sentence-start capital in lower case ("Thanks" → "thanks").
    const name = new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    await page.locator('.bank').getByRole('button', { name }).and(page.locator(':enabled')).first().click();
  }
}

/** Answers the exercise on screen (right or deliberately wrong) and returns its prompt. */
export async function answer(page: Page, l: Lesson, correct = true): Promise<string> {
  const ex = await current(page);
  if (ex.kind === 'match') {
    for (const pair of l.words) {
      const en = page.locator('.match-col[dir=ltr]').getByRole('button', { name: pair.en, exact: true });
      if (!(await en.count()) || (await en.isDisabled())) continue;
      await en.click();
      await page.locator('.match-col:not([dir])').getByRole('button', { name: pair.he, exact: true }).click();
    }
  } else if (ex.kind === 'speak') {
    // Needs fakeRecognition(); speaking can't be answered wrong, only retried.
    await page.getByRole('button', { name: 'לחצו ודברו' }).click();
  } else if (ex.kind === 'blank') {
    // The missing word: the sentence's word where the gap is (the shown words line up with it).
    const sentence = l.sentences.find((s) => s.he === ex.prompt)!;
    expect(sentence, `sentence for "${ex.prompt}"`).toBeTruthy();
    const before = (await page.locator('.blank-sentence').evaluate((p) => p.firstChild?.textContent ?? '')).trim();
    const missing = tokenize(sentence.en)[before ? tokenize(before).length : 0];
    const tiles = page.locator('.bank .tile');
    const options = (await tiles.allTextContents()).map((t) => t.trim());
    await tiles.nth(options.indexOf(correct ? missing : options.find((o) => o !== missing)!)).click();
    await page.getByRole('button', { name: 'בדיקה' }).click();
  } else if (ex.kind === 'type') {
    const text = ex.prompt.replace(/^listen:/, '');
    const sentence = l.sentences.find((s) => s.en === text || s.he === text)!;
    expect(sentence, `sentence for "${text}"`).toBeTruthy();
    await page.locator('.type-input').fill(correct ? sentence.en : 'zzz');
    await page.getByRole('button', { name: 'בדיקה' }).click();
  } else if (ex.kind === 'choice') {
    const word = l.words.find((w) => w.he === ex.prompt || w.en === ex.prompt)!;
    const right = word.he === ex.prompt ? word.en : word.he;
    const options = page.locator('.option');
    const texts = (await options.allTextContents()).map((t) => t.replace(/^\d/, '').trim());
    const pick = correct ? right : texts.find((t) => t !== right)!;
    await options.nth(texts.indexOf(pick)).click();
    await page.getByRole('button', { name: 'בדיקה' }).click();
  } else {
    const title = (await page.locator('.exercise-title').textContent()) ?? '';
    const lang = title.includes('לעברית') ? 'he' : 'en';
    const text = ex.prompt.replace(/^listen:/, '');
    const sentence = l.sentences.find((s) => s.en === text || s.he === text)!;
    expect(sentence, `sentence for "${text}"`).toBeTruthy();
    const words = tokenize(sentence[lang]);
    // A wrong answer: only the first word (every course sentence has at least two).
    await clickTiles(page, correct ? words : words.slice(0, 1));
    await page.getByRole('button', { name: 'בדיקה' }).click();
  }
  return ex.prompt;
}

/** Presses "continue" on the feedback bar. */
export async function next(page: Page) {
  await page.locator('.lesson-footer.feedback').getByRole('button', { name: 'המשך' }).click();
}

/** Answers everything correctly until the completion screen; returns the prompts seen in order. */
export async function finishLesson(page: Page, l: Lesson): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.lesson-complete').isVisible()) return seen;
    seen.push(await answer(page, l));
    await expect(page.locator('.lesson-footer.feedback.good')).toBeVisible();
    await next(page);
    await expect(page.locator('.lesson-complete, .lesson-body').first()).toBeVisible();
  }
  throw new Error('lesson did not finish');
}

export const SRS_KEY = 'baktana-english:srs:v1';
export const EVENTS_KEY = 'baktana-english:events:v1';

/**
 * Seeds the spaced-repetition store before the app loads: every key gets `box`, due `dueInDays`
 * after the browser's local date. Like seedProgress, only on the first load of the test.
 */
export async function seedSrs(page: Page, keys: string[], opts: { box?: number; dueInDays?: number } = {}) {
  await page.addInitScript(
    ([storageKey, itemKeys, box, dueInDays]) => {
      if (sessionStorage.getItem('e2e-srs-seeded')) return;
      const d = new Date();
      d.setDate(d.getDate() + dueInDays);
      const pad = (n: number) => String(n).padStart(2, '0');
      const due = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const items = Object.fromEntries(itemKeys.map((k) => [k, { box, due, seen: 1, wrong: 0, last: 1000 }]));
      localStorage.setItem(storageKey, JSON.stringify({ v: 1, items, seeded: true, dirty: [] }));
      sessionStorage.setItem('e2e-srs-seeded', '1');
    },
    [SRS_KEY, keys, opts.box ?? 1, opts.dueInDays ?? 0] as const,
  );
}

export interface StoredSrs {
  v: 1;
  items: Record<string, { box: number; due: string; seen: number; wrong: number; last: number }>;
  seeded: boolean;
  dirty: string[];
}

export async function localSrs(page: Page): Promise<StoredSrs | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), SRS_KEY);
}

/** The browser's local date, shifted by `days` (YYYY-MM-DD). */
export async function browserDate(page: Page, days = 0): Promise<string> {
  return page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, days);
}

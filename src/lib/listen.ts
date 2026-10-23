import { Capacitor, registerPlugin } from '@capacitor/core';

/** Why listening ended without words: no microphone permission, nothing heard, or anything else. */
export type ListenError = 'denied' | 'no-speech' | 'unavailable' | 'error';

/** Native speech recognition in the Android app (android/.../SpeechRecognizerPlugin.java). */
interface SpeechRecognizerPlugin {
  listen(options: { lang: string }): Promise<{ matches: string[] }>;
  stop(): Promise<void>;
}

const native = Capacitor.isNativePlatform();
const SpeechRecognizer = registerPlugin<SpeechRecognizerPlugin>('SpeechRecognizer');

/** The parts of the Web Speech API's SpeechRecognition used here (Chrome still prefixes it). */
interface WebRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function webRecognition(): (new () => WebRecognition) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as Record<string, (new () => WebRecognition) | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Whether speaking exercises can run here: the Android app, or a browser with speech recognition (Chrome). */
export const canListen = native || webRecognition() !== undefined;

export interface Listening {
  /** What the learner probably said, best guess first. Rejects with a ListenError. */
  result: Promise<string[]>;
  /** Stops listening early; the result still arrives for what was said so far. */
  stop(): void;
}

function webErrorCode(error: string): ListenError {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'denied';
  if (error === 'no-speech' || error === 'aborted') return 'no-speech';
  if (error === 'audio-capture') return 'unavailable';
  return 'error';
}

/** Listens for one sentence through the microphone – English, unless `lang` says otherwise (e.g. 'he-IL'). */
export function listen(lang = 'en-US'): Listening {
  if (native) {
    return {
      result: SpeechRecognizer.listen({ lang }).then(
        ({ matches }) => {
          if (matches.length === 0) throw 'no-speech';
          return matches;
        },
        (e: { code?: string }) => {
          const code = e?.code;
          throw code === 'denied' || code === 'no-speech' || code === 'unavailable' ? code : 'error';
        },
      ),
      stop: () => void SpeechRecognizer.stop().catch(() => {}),
    };
  }
  const Recognition = webRecognition();
  if (!Recognition) return { result: Promise.reject<string[]>('unavailable'), stop: () => {} };
  const recognition = new Recognition();
  recognition.lang = lang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  const result = new Promise<string[]>((resolve, reject) => {
    recognition.onresult = (e) => {
      const first = e.results[0];
      resolve(Array.from({ length: first?.length ?? 0 }, (_, i) => first[i].transcript));
    };
    recognition.onerror = (e) => reject(webErrorCode(e.error));
    // Settles the promise if the recognizer stopped without a result or an error.
    recognition.onend = () => reject('no-speech');
  });
  try {
    recognition.start();
  } catch {
    return { result: Promise.reject<string[]>('error'), stop: () => {} };
  }
  return { result, stop: () => recognition.stop() };
}

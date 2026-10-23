import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

// Android's WebView has no Web Speech API, so the installed app uses the
// device's native text-to-speech engine instead.
const native = Capacitor.isNativePlatform();

/**
 * Speaks English text with the browser's built-in speech synthesis (or native TTS in the app).
 * `onEnd` runs once when the speech finishes, fails or is interrupted (or right away when the
 * device can't speak); it may never run on engines that drop the event – see speakAsync.
 */
export function speak(text: string, slow = false, onEnd?: () => void) {
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd?.();
  };
  if (native) {
    void TextToSpeech.stop()
      .then(() => TextToSpeech.speak({ text, lang: 'en-US', rate: slow ? 0.6 : 0.95 }))
      .catch(() => {
        // No English voice installed – exercises still work from the written text.
      })
      .finally(end);
    return;
  }
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    end();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = slow ? 0.6 : 0.95;
  const voice = synth.getVoices().find((v) => v.lang.startsWith('en'));
  if (voice) utterance.voice = voice;
  if (onEnd) {
    utterance.onend = end;
    utterance.onerror = end;
  }
  synth.speak(utterance);
}

/** A generous guess of how long speaking `text` takes, for engines that never report the end. */
export function speechDurationMs(text: string, slow = false): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(20_000, 1200 + words * (slow ? 650 : 400));
}

/** Like speak(), but resolves when the speech has finished (or should have, at the latest). */
export function speakAsync(text: string, slow = false): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, speechDurationMs(text, slow));
    speak(text, slow, () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Stops whatever is being spoken. */
export function stopSpeaking() {
  if (native) {
    void TextToSpeech.stop().catch(() => {});
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export const canSpeak = native || (typeof window !== 'undefined' && 'speechSynthesis' in window);

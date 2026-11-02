import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { pickVoice, type VoiceInfo, type VoiceProfile } from './voice-pick';

// Android's WebView has no Web Speech API, so the installed app uses the
// device's native text-to-speech engine instead.
const native = Capacitor.isNativePlatform();

/** `slow` is the slow "listen again" speed, or an exact rate (1 = the engine's normal speed). */
export type SpeechSpeed = boolean | number;

const rateOf = (slow: SpeechSpeed): number => (typeof slow === 'number' ? slow : slow ? 0.6 : 0.95);

/** The installed native voices, asked for once (the list doesn't change while the app runs). */
let nativeVoices: Promise<VoiceInfo[]> | null = null;
function loadNativeVoices(): Promise<VoiceInfo[]> {
  nativeVoices ??= TextToSpeech.getSupportedVoices()
    .then((r) => r.voices)
    .catch(() => []);
  return nativeVoices;
}

/**
 * Speaks English text with the browser's built-in speech synthesis (or native TTS in the app).
 * `voice` picks a character's voice (an AI call); without it, the first English voice is used.
 * `onEnd` runs once when the speech finishes, fails or is interrupted (or right away when the
 * device can't speak); it may never run on engines that drop the event – see speakAsync.
 */
export function speak(text: string, slow: SpeechSpeed = false, onEnd?: () => void, voice?: VoiceProfile) {
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    onEnd?.();
  };
  const rate = rateOf(slow) * (voice?.rate ?? 1);
  const pitch = voice?.pitch ?? 1;
  if (native) {
    void TextToSpeech.stop()
      .then(async () => {
        const index = voice ? pickVoice(await loadNativeVoices(), voice) : -1;
        const lang = voice?.lang ?? 'en-US';
        await TextToSpeech.speak(index >= 0 ? { text, lang, rate, pitch, voice: index } : { text, lang, rate, pitch });
      })
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
  const voices = synth.getVoices();
  const chosen = voice ? voices[pickVoice(voices, voice)] : voices.find((v) => v.lang.startsWith('en'));
  utterance.lang = chosen?.lang ?? voice?.lang ?? 'en-US';
  utterance.rate = rate;
  utterance.pitch = pitch;
  if (chosen) utterance.voice = chosen;
  if (onEnd) {
    utterance.onend = end;
    utterance.onerror = end;
  }
  synth.speak(utterance);
}

/** A generous guess of how long speaking `text` takes, for engines that never report the end. */
export function speechDurationMs(text: string, slow: SpeechSpeed = false, voice?: VoiceProfile): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const rate = rateOf(slow) * (voice?.rate ?? 1);
  return Math.min(20_000, 1200 + words * Math.round(380 / rate));
}

/** Like speak(), but resolves when the speech has finished (or should have, at the latest). */
export function speakAsync(text: string, slow: SpeechSpeed = false, voice?: VoiceProfile): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, speechDurationMs(text, slow, voice));
    speak(
      text,
      slow,
      () => {
        clearTimeout(timer);
        resolve();
      },
      voice,
    );
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

/** Starts loading the voice list early: browsers fill getVoices() asynchronously. */
export function warmUpVoices() {
  if (native) {
    void loadNativeVoices();
    return;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
}

export const canSpeak = native || (typeof window !== 'undefined' && 'speechSynthesis' in window);

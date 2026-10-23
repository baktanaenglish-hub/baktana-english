/** Small synthesized sound effects (Web Audio, no audio files). */

type Note = [frequency: number, start: number, duration: number];

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function play(notes: Note[], type: OscillatorType, volume = 0.12) {
  if (!enabled) return;
  const audio = context();
  if (!audio) return;
  const t0 = audio.currentTime + 0.01;
  for (const [freq, start, duration] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0 + start);
    gain.gain.linearRampToValueAtTime(volume, t0 + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + duration + 0.02);
  }
}

export const sounds = {
  correct: () =>
    play(
      [
        [880, 0, 0.12],
        [1318.5, 0.09, 0.22],
      ],
      'sine',
    ),
  wrong: () =>
    play(
      [
        [220, 0, 0.16],
        [174.6, 0.12, 0.26],
      ],
      'triangle',
      0.14,
    ),
  complete: () =>
    play(
      [
        [523.3, 0, 0.14],
        [659.3, 0.12, 0.14],
        [784, 0.24, 0.14],
        [1046.5, 0.36, 0.4],
      ],
      'sine',
    ),
  tap: () => play([[660, 0, 0.05]], 'sine', 0.05),
  gem: () =>
    play(
      [
        [1318.5, 0, 0.08],
        [1760, 0.07, 0.08],
        [2093, 0.14, 0.25],
      ],
      'triangle',
      0.1,
    ),
};

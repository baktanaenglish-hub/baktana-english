import type { VoiceProfile } from '../voice-pick';

/**
 * Sam, the barista at Sunny Café in London: a relaxed, friendly young man with a British accent.
 *
 * - Android (Google TTS, the main platform): the en-GB male speakers are gbb, gbd and rjs. The
 *   `-network` (WaveNet) variants sound the most human; gbb/gbd are the newer "gb" set, rjs is older
 *   and stiffer. The app's voice name is "English United Kingdom", so the match is on voiceURI.
 * - Edge: "Ryan Online (Natural)" is the warm, conversational UK male of Edge's Read Aloud voices;
 *   Thomas is the other one. Windows' offline UK male is "Microsoft George".
 * - Apple: Jamie (Premium) and Arthur/Daniel (Enhanced) are the en-GB male voices (voiceURI
 *   "com.apple.voice.<quality>.en-GB.<Name>"); compact Daniel is the default UK voice.
 * - Chrome: "Google UK English Male".
 * Without a UK voice, other accents that still sound natural in a London café come first, then US.
 * Pitch is left alone (shifting a neural voice makes it sound processed); a touch slower than the
 * call pace keeps a beginner with the accent.
 * Sources: Android voice ids from TextToSpeech.getVoices() as listed in Google TTS discussions;
 * Microsoft Edge Read Aloud / Azure neural voice list; Apple VoiceOver voice list (iOS 17, macOS 14).
 */
export const baristaVoice: VoiceProfile = {
  lang: 'en-GB',
  fallbackLangs: ['en-IE', 'en-AU', 'en-NZ', 'en-US'],
  gender: 'male',
  preferred: [
    'en-gb-x-gbb-network',
    'en-gb-x-gbd-network',
    'Ryan Online (Natural)',
    'Thomas Online (Natural)',
    'premium.en-GB.Jamie',
    'Jamie (Premium)',
    'enhanced.en-GB.Arthur',
    'Arthur (Enhanced)',
    'enhanced.en-GB.Daniel',
    'Daniel (Enhanced)',
    'en-gb-x-gbb-local',
    'en-gb-x-gbd-local',
    'en-gb-x-rjs-network',
    'Google UK English Male',
    'en-gb-x-rjs-local',
    'en-GB.Arthur',
    'en-GB.Daniel',
    'Microsoft George',
  ],
  // Edge sometimes lists its online voices as "Microsoft undefined Online (Natural) - undefined",
  // which then speak in the default voice.
  avoid: ['undefined'],
  pitch: 1,
  rate: 0.95,
};

import type { VoiceProfile } from '../voice-pick';

/**
 * Emma, the English teacher: a warm, clear adult US-English woman.
 *
 * Voices, best first per platform (names from Readium's curated voice list, readium/speech json/en.json):
 * - Android app (Google TTS): `tpc` is Google's default en-US female voice (newer speaker data, rated "high"),
 *   then the other high-quality females `tpf`, `iog`, `iob`; `sfg` is only "normal" quality. Network
 *   (neural) before local, since a call needs a connection anyway.
 * - Edge: Microsoft's Online (Natural) voices. Emma (clear, conversational, and the character's own name),
 *   then Ava (caring), Jenny, Aria, Michelle.
 * - Safari / Mac / iPhone: Ava and Zoe Premium or Enhanced, then Samantha (the default Apple US voice).
 * - Chrome desktop: "Google US English", the female network voice, ahead of the old SAPI voice Zira.
 * Child voices (Edge's Ana and Maisie, Apple's Joelle) and the very-low-quality Chrome OS voices are avoided.
 *
 * Pitch stays at 1: neural voices sound most human at their recorded pitch, and Edge's Natural voices
 * ignore pitch changes anyway. Rate 0.97 takes the call pace (0.95) to about 0.92: a clear, unhurried teacher
 * who still sounds like natural speech, and corrections at the slow speed don't drag.
 */
export const teacherVoice: VoiceProfile = {
  lang: 'en-US',
  fallbackLangs: ['en-GB', 'en-CA', 'en-AU', 'en-IE', 'en-NZ'],
  gender: 'female',
  preferred: [
    // Edge – first and well ahead of Jenny and the rest: voiceGender() can't read "EmmaMultilingual"
    'EmmaMultilingual Online (Natural)',
    'Emma Online (Natural)',
    'AvaMultilingual Online (Natural)',
    'Ava Online (Natural)',
    // Android (voiceURI) and Chrome OS
    'en-us-x-tpc-network',
    'en-us-x-tpf-network',
    'en-us-x-iog-network',
    'en-us-x-iob-network',
    'en-us-x-tpc-local',
    'en-us-x-tpf-local',
    'en-us-x-iog-local',
    'en-us-x-iob-local',
    'Google US English 5 (Natural)',
    'Google US English 7 (Natural)',
    'Google US English 2 (Natural)',
    'Google US English 1 (Natural)',
    // Apple (name in Chrome/macOS Safari, voiceURI in Safari/iOS)
    'Ava (Premium)',
    'premium.en-US.Ava',
    'Zoe (Premium)',
    'premium.en-US.Zoe',
    'Ava (Enhanced)',
    'enhanced.en-US.Ava',
    'Zoe (Enhanced)',
    'enhanced.en-US.Zoe',
    'Samantha (Enhanced)',
    'enhanced.en-US.Samantha',
    // Chrome desktop
    'Google US English',
    // Other Edge voices
    'Jenny Online (Natural)',
    'Aria Online (Natural)',
    'Michelle Online (Natural)',
    // Plain Apple default, then British fallbacks
    'Samantha',
    'Sonia Online (Natural)',
    'Libby Online (Natural)',
    'en-gb-x-gba',
    'en-gb-x-gbc',
    'Google UK English Female',
    'en-us-x-sfg',
  ],
  avoid: ['Ana Online', 'Maisie', 'Joelle', 'Chrome OS US English 8', 'Chrome OS UK English 7'],
  pitch: 1,
  rate: 0.97,
};

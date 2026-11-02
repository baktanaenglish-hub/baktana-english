import type { VoiceProfile } from '../voice-pick';

/**
 * Maya, the friend: a young, upbeat US woman on a casual video call. We rank the brighter,
 * more conversational neural voices first and leave the calmer "narrator" voices (Jenny, Samantha,
 * en-us-x-sfg/iog) lower so she sounds different from Emma the teacher.
 *
 * - Android (Google TTS, the main platform): speaker codes from Google's voice list; tpf/iob are
 *   the lighter female speakers, sfg/iog the classic default ones. The "-network" build of each is
 *   the neural one and wins on its own (NATURAL + localService), the "-local" one is the offline copy.
 * - Edge: "Online (Natural)" neural voices; Ava and Michelle are described by Microsoft as
 *   expressive/friendly, Aria as cheerful. "Microsoft Ana" is a child voice, so it is avoided.
 * - Apple: Zoe and Ava in their Premium/Enhanced builds are the most natural downloadable voices
 *   (Siri voices are not exposed to Web Speech). Chrome desktop: "Google US English" (female).
 *
 * Pitch and rate are only nudged up: a touch livelier than a teacher, still easy for a beginner,
 * and close enough to 1 that neural voices keep sounding human.
 * Sources: Android Developers Blog (TTS upgrades, Sep 2022), 9to5Google Google TTS guide,
 * Microsoft Azure TTS voice gallery, Apple "Spoken Content" voice list.
 */
export const friendVoice: VoiceProfile = {
  lang: 'en-US',
  fallbackLangs: ['en-CA', 'en-AU', 'en-GB'],
  gender: 'female',
  // Ordered by tier, not by platform (each platform only sees its own names). Zoe and
  // "Google US English" sit high because voice-pick can't tell their gender and would otherwise
  // lose to a lower-ranked voice it knows is female (Ava, Zira).
  preferred: [
    'Microsoft Ava', // Edge neural, also matches AvaMultilingual
    'Zoe (Premium)', // Apple: name in Safari/Chrome on Mac
    'premium.en-US.Zoe', // Apple: voiceURI on iOS
    'en-us-x-tpf', // Android Google TTS (-network neural first, -local offline)
    'Google US English', // Chrome desktop network voice (female)
    'Microsoft Michelle Online',
    'Zoe (Enhanced)',
    'enhanced.en-US.Zoe',
    'en-us-x-iob',
    'Microsoft Aria Online',
    'Nicky',
    'en-us-x-tpc',
    'Microsoft Emma',
    'en-us-x-sfg',
    'Ava (Premium)',
    'premium.en-US.Ava',
    'Microsoft Jenny',
    'en-us-x-iog',
    'Ava (Enhanced)',
    'enhanced.en-US.Ava',
    // Compact desktop fallbacks, then other accents (only when no US voice exists)
    'Samantha',
    'Microsoft Zira',
    'Google UK English Female',
    'en-gb-x-gba',
  ],
  avoid: ['Microsoft Ana'],
  pitch: 1.05,
  rate: 1.05,
};

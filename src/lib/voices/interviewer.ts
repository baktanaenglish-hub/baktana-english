import type { VoiceProfile } from '../voice-pick';

/**
 * Daniel, the job interviewer: a calm, warm, professional US man, ideally a conversational voice
 * rather than a newsreader.
 * - Android (Google TTS): the male US speakers are iom, iol and tpd. iom and iol are the newer,
 *   smoother ones, and the -network builds are the neural ones. tpd is an older voice and comes
 *   last. Sources: community voice lists and pitch measurements, e.g. github.com/aaditya-v-more/google-tts-local
 *   and majorsilence/Majorsilence.Forms#467.
 * - Edge: the "Online (Natural)" voices. Andrew (Azure: warm, confident) and Brian (approachable)
 *   sound conversational. Eric, Christopher and Steffan are steadier. Guy and Roger sound like
 *   newscasters or announcers, so they come later.
 * - Apple: Evan/Nathan/Tom (Premium/Enhanced) and Aaron are US men. Alex is the old macOS voice.
 *   "Daniel" is Apple's British man. He is allowed on purpose, as a fallback that still sounds
 *   human (his name matches the character, but his accent is en-GB).
 * - Chrome desktop: "Google UK English Male" is Chrome's only male voice ("Google US English" is
 *   female). It sounds more natural than Windows' SAPI David/Mark, so it comes first. David and
 *   Mark are left out of `preferred` on purpose. A US-English bonus would otherwise outrank it. The
 *   gender score still picks them over a female voice when they are the only men.
 * Fred, Ralph, Junior and the Eloquence/novelty voices sound robotic and are never used.
 * Pitch stays at the engine's natural value, because shifting it makes neural voices sound
 * synthetic. The rate is a touch slower, for a measured interview pace.
 */
export const interviewerVoice: VoiceProfile = {
  lang: 'en-US',
  fallbackLangs: ['en-GB', 'en-CA', 'en-AU'],
  gender: 'male',
  preferred: [
    // Android – Google TTS
    'en-us-x-iom-network',
    'en-us-x-iol-network',
    'en-us-x-iom',
    'en-us-x-iol',
    'en-us-x-tpd',
    // Edge – Microsoft neural voices
    'Andrew Online (Natural)',
    'AndrewMultilingual Online (Natural)',
    'Brian Online (Natural)',
    'BrianMultilingual Online (Natural)',
    'Eric Online (Natural)',
    'Christopher Online (Natural)',
    'Steffan Online (Natural)',
    'Guy Online (Natural)',
    'Roger Online (Natural)',
    // Apple – US male voices
    'Evan (Premium)',
    'Nathan (Premium)',
    'Evan (Enhanced)',
    'Nathan (Enhanced)',
    'Tom (Premium)',
    'Tom (Enhanced)',
    'Aaron',
    'Evan',
    'Nathan',
    'Alex',
    // Apple – British Daniel (en-GB), when no US man is installed
    'Daniel (Premium)',
    'Daniel (Enhanced)',
    // Chrome desktop's only male voice (en-GB, network)
    'Google UK English Male',
    'Daniel',
  ],
  avoid: [
    'Google US English',
    'Fred',
    'Ralph',
    'Junior',
    'Albert',
    'Reed',
    'Eddy',
    'Rocko',
    'Grandpa',
    'Zarvox',
    'Trinoids',
    'eSpeak',
  ],
  pitch: 1,
  rate: 0.95,
};

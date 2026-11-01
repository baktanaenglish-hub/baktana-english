/**
 * Picks the most human-sounding installed voice for an AI call character. Each character has a
 * VoiceProfile (src/lib/voices/<persona>.ts); the device offers whatever voices its engine has
 * (Chrome/Edge/Safari voices on the web, the Android TTS engine in the app), so the profile ranks
 * what to look for instead of naming one voice. Pure functions, tested in voice-pick.test.ts.
 */

/** The fields we read from a browser or Capacitor voice. */
export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI?: string;
  localService?: boolean;
}

export interface VoiceProfile {
  /** BCP 47 tag the character speaks, e.g. 'en-US' or 'en-GB'. */
  lang: string;
  /** Other English accents that still fit the character, best first (used when `lang` has no voice). */
  fallbackLangs?: readonly string[];
  gender: 'female' | 'male';
  /**
   * Voices to look for, best first. Each entry matches when it appears (case-insensitively) in the
   * voice's name or voiceURI, e.g. 'Aria Online (Natural)', 'Google UK English Male', 'en-gb-x-gbd'.
   */
  preferred: readonly string[];
  /** Voices that must not be used for this character (wrong gender, novelty or robotic voices). */
  avoid?: readonly string[];
  /** 1 = the engine's normal pitch. Keep within about 0.85–1.15 or the voice starts to sound synthetic. */
  pitch: number;
  /** Multiplies the call's speech rate (1 = unchanged). */
  rate: number;
}

/** Words in a voice name that mark a neural / natural-sounding voice. */
const NATURAL = /\b(natural|neural|online|enhanced|premium|network|wavenet|studio|journey|siri)\b/i;
/** Voices that sound robotic or are joke voices (macOS novelty voices, eSpeak). */
const ROBOTIC =
  /\b(espeak|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|eddy|flo|reed|sandy|shelley)\b/i;

/** Well-known voice names by gender, across Windows/Edge, macOS/iOS, Chrome and Android. */
const FEMALE =
  /\b(female|woman|aria|jenny|michelle|ana|sonia|libby|maisie|hollie|abbie|bella|olivia|zira|hazel|susan|samantha|allison|ava|karen|moira|tessa|serena|kate|fiona|victoria|veena|catherine|nicky|zoe|joelle|stephanie|martha|emma|amy|joanna|salli|kendra|kimberly|ivy|natasha|clara|emily|sara|jane|nancy|ashley|cora|elizabeth|monica|amber)\b/i;
const MALE =
  /\b(male|man|guy|davis|tony|jason|brandon|christopher|eric|roger|steffan|ryan|thomas|alfie|elliot|ethan|noah|oliver|david|mark|george|james|daniel|alex|aaron|arthur|gordon|lee|rishi|tom|evan|jamie|nathan|matthew|joey|justin|kevin|brian|andrew|william|liam|connor)\b/i;
/**
 * Google's Android voices are named like "en-us-x-tpd-network": the 3-letter code is the speaker.
 * Genders as documented for Google TTS; voices not listed here count as unknown.
 */
const ANDROID_GENDER: Record<string, 'female' | 'male'> = {
  iob: 'female',
  iog: 'female',
  iol: 'male',
  iom: 'male',
  sfg: 'female',
  tpc: 'female',
  tpd: 'male',
  tpf: 'female',
  gba: 'female',
  gbb: 'male',
  gbc: 'female',
  gbd: 'male',
  gbg: 'female',
  rjs: 'male',
  fis: 'female',
};

/** The voice's gender when its name gives it away. */
export function voiceGender(voice: VoiceInfo): 'female' | 'male' | null {
  const id = `${voice.name} ${voice.voiceURI ?? ''}`;
  const android = /-x-([a-z]{3})-/i.exec(id);
  if (android) {
    const g = ANDROID_GENDER[android[1].toLowerCase()];
    if (g) return g;
  }
  // "Male" is inside "Female", so test female first.
  if (/\bfemale\b/i.test(id)) return 'female';
  if (/\bmale\b/i.test(id)) return 'male';
  // Chrome's "Google US English" is a woman's voice without saying so.
  if (/^google us english\b/i.test(voice.name)) return 'female';
  // Edge writes "Microsoft EmmaMultilingual Online (Natural)": split the name off before matching.
  const name = voice.name.replace(/multilingual/gi, ' ');
  if (FEMALE.test(name)) return 'female';
  if (MALE.test(name)) return 'male';
  return null;
}

const norm = (lang: string | undefined) => (lang ?? '').replace('_', '-').toLowerCase();

/** How well a voice fits a profile; higher is better, -Infinity means never. */
export function scoreVoice(voice: VoiceInfo, profile: VoiceProfile): number {
  const lang = norm(voice.lang);
  if (!lang.startsWith('en')) return -Infinity;
  const id = `${voice.name} ${voice.voiceURI ?? ''}`.toLowerCase();
  if (profile.avoid?.some((a) => id.includes(a.toLowerCase()))) return -Infinity;
  // Edge 150 sometimes lists broken "Microsoft undefined Online (Natural) - undefined" voices that speak
  // with the default voice.
  if (/\bundefined\b/.test(id)) return -Infinity;

  // A voice the character asks for by name wins, in the profile's order: the profile already weighed
  // accent, gender and quality when ranking it.
  const rank = profile.preferred.findIndex((p) => id.includes(p.toLowerCase()));
  if (rank >= 0) return 10_000 - rank * 10;

  let score = 0;
  const langs = [profile.lang, ...(profile.fallbackLangs ?? [])].map(norm);
  const langRank = langs.indexOf(lang);
  if (langRank === 0) score += 200;
  else if (langRank > 0) score += 150 - langRank * 10;

  const gender = voiceGender(voice);
  if (gender === profile.gender) score += 120;
  else if (gender !== null) score -= 300;

  if (NATURAL.test(id)) score += 80;
  if (ROBOTIC.test(voice.name)) score -= 500;
  // Network voices are the neural ones on Android and Chrome, but need a connection – a small nudge only.
  if (voice.localService === false) score += 10;
  return score;
}

/** Index of the best voice for the profile, or -1 when no English voice is installed. */
export function pickVoice(voices: readonly VoiceInfo[], profile: VoiceProfile): number {
  let best = -1;
  let bestScore = -Infinity;
  voices.forEach((v, i) => {
    const s = scoreVoice(v, profile);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

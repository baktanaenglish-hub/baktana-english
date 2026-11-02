import { describe, expect, it } from 'vitest';
import { pickVoice, voiceGender, type VoiceInfo, type VoiceProfile } from './voice-pick';
import { PERSONA_VOICES } from './voices';
import { PERSONAS } from '../../shared/call';

const v = (name: string, lang: string, extra: Partial<VoiceInfo> = {}): VoiceInfo => ({ name, lang, ...extra });

const female: VoiceProfile = { lang: 'en-US', gender: 'female', preferred: [], pitch: 1, rate: 1 };

describe('voiceGender', () => {
  it('reads common voice names and Android speaker codes', () => {
    expect(voiceGender(v('Microsoft Aria Online (Natural) - English (United States)', 'en-US'))).toBe('female');
    expect(voiceGender(v('Google UK English Male', 'en-GB'))).toBe('male');
    expect(voiceGender(v('Google UK English Female', 'en-GB'))).toBe('female');
    expect(voiceGender(v('en-us-x-tpd-network', 'en-US'))).toBe('male');
    expect(voiceGender(v('en-gb-x-gba-local', 'en-GB'))).toBe('female');
    expect(voiceGender(v('Google US English', 'en-US'))).toBe('female');
    expect(voiceGender(v('Microsoft EmmaMultilingual Online (Natural) - English (United States)', 'en-US'))).toBe(
      'female',
    );
    expect(voiceGender(v('Jamie (Premium)', 'en-GB'))).toBe('male');
    expect(voiceGender(v('English United States', 'en-US', { voiceURI: 'en-us-x-iom-local' }))).toBe('male');
    expect(voiceGender(v('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'))).toBe('female');
    expect(voiceGender(v('Karen', 'en-AU'))).toBe('female');
    expect(voiceGender(v('Unknown voice', 'en-US'))).toBeNull();
  });
});

describe('pickVoice', () => {
  it('prefers the listed voices, then accent, gender and natural voices', () => {
    const voices = [
      v('Hebrew', 'he-IL'),
      v('Microsoft David - English (United States)', 'en-US'),
      v('Microsoft Zira - English (United States)', 'en-US'),
      v('Microsoft Aria Online (Natural) - English (United States)', 'en-US'),
      v('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB'),
    ];
    expect(pickVoice(voices, female)).toBe(3);
    expect(pickVoice(voices, { ...female, preferred: ['Zira'] })).toBe(2);
    expect(pickVoice(voices, { ...female, lang: 'en-GB' })).toBe(4);
    expect(pickVoice(voices, { ...female, gender: 'male' })).toBe(1);
  });

  it('never picks avoided, non-English or novelty voices when anything else exists', () => {
    expect(pickVoice([v('Hebrew', 'he-IL')], female)).toBe(-1);
    expect(pickVoice([v('Zarvox', 'en-US'), v('Samantha', 'en-US')], female)).toBe(1);
    expect(pickVoice([v('Samantha', 'en-US')], { ...female, avoid: ['samantha'] })).toBe(-1);
    expect(
      pickVoice([v('Microsoft undefined Online (Natural) - undefined', undefined as unknown as string)], female),
    ).toBe(-1);
  });

  it('follows the profile order for named voices, whatever their accent or gender tables say', () => {
    const voices = [v('Arthur (Enhanced)', 'en-GB'), v('Jamie (Premium)', 'en-GB'), v('Mark', 'en-US')];
    const sam: VoiceProfile = { lang: 'en-US', gender: 'male', preferred: ['Jamie', 'Arthur'], pitch: 1, rate: 1 };
    expect(pickVoice(voices, sam)).toBe(1);
  });
});

describe('PERSONA_VOICES', () => {
  it('gives every character an English voice with sane pitch and rate', () => {
    for (const p of PERSONAS) {
      const voice = PERSONA_VOICES[p.id];
      expect(voice.lang).toMatch(/^en-/);
      expect(voice.pitch).toBeGreaterThanOrEqual(0.8);
      expect(voice.pitch).toBeLessThanOrEqual(1.2);
      expect(voice.rate).toBeGreaterThanOrEqual(0.85);
      expect(voice.rate).toBeLessThanOrEqual(1.15);
    }
  });
});

/** Android's Capacitor plugin names voices by language; the speaker is in the voiceURI. */
const android = (uri: string, lang: string): VoiceInfo => ({
  name: lang === 'en-GB' ? 'English United Kingdom' : 'English United States',
  lang,
  voiceURI: uri,
  localService: uri.endsWith('-local'),
});

const PLATFORMS: Record<string, VoiceInfo[]> = {
  android: [
    ...['sfg', 'iob', 'iog', 'iol', 'iom', 'tpc', 'tpd', 'tpf'].flatMap((s) => [
      android(`en-us-x-${s}-network`, 'en-US'),
      android(`en-us-x-${s}-local`, 'en-US'),
    ]),
    ...['gba', 'gbb', 'gbc', 'gbd', 'gbg', 'rjs'].flatMap((s) => [
      android(`en-gb-x-${s}-network`, 'en-GB'),
      android(`en-gb-x-${s}-local`, 'en-GB'),
    ]),
  ],
  edge: [
    'Microsoft David - English (United States)',
    'Microsoft Zira - English (United States)',
    'Microsoft Mark - English (United States)',
    'Microsoft undefined Online (Natural) - undefined',
    ...['Ana', 'Andrew', 'AndrewMultilingual', 'Aria', 'Ava', 'AvaMultilingual', 'Brian', 'Christopher', 'Emma'].map(
      (n) => `Microsoft ${n} Online (Natural) - English (United States)`,
    ),
    ...['EmmaMultilingual', 'Eric', 'Guy', 'Jenny', 'Michelle', 'Roger', 'Steffan'].map(
      (n) => `Microsoft ${n} Online (Natural) - English (United States)`,
    ),
    ...['Libby', 'Maisie', 'Ryan', 'Sonia', 'Thomas'].map(
      (n) => `Microsoft ${n} Online (Natural) - English (United Kingdom)`,
    ),
  ].map((name) =>
    v(
      name,
      name.includes('undefined') ? (undefined as unknown as string) : name.includes('Kingdom') ? 'en-GB' : 'en-US',
    ),
  ),
  chromeWindows: [
    v('Microsoft David - English (United States)', 'en-US'),
    v('Microsoft Mark - English (United States)', 'en-US'),
    v('Microsoft Zira - English (United States)', 'en-US'),
    v('Google US English', 'en-US', { localService: false }),
    v('Google UK English Female', 'en-GB', { localService: false }),
    v('Google UK English Male', 'en-GB', { localService: false }),
  ],
  iphone: [
    v('Samantha', 'en-US', { voiceURI: 'com.apple.voice.compact.en-US.Samantha' }),
    v('Aaron', 'en-US', { voiceURI: 'com.apple.ttsbundle.siri_Aaron_en-US_compact' }),
    v('Daniel', 'en-GB', { voiceURI: 'com.apple.voice.compact.en-GB.Daniel' }),
    v('Arthur', 'en-GB', { voiceURI: 'com.apple.voice.compact.en-GB.Arthur' }),
    v('Fred', 'en-US', { voiceURI: 'com.apple.speech.synthesis.voice.Fred' }),
    v('Karen', 'en-AU', { voiceURI: 'com.apple.voice.compact.en-AU.Karen' }),
  ],
};

describe('the call characters on real voice lists', () => {
  const picked = (platform: string, id: keyof typeof PERSONA_VOICES) => {
    const voices = PLATFORMS[platform];
    const i = pickVoice(voices, PERSONA_VOICES[id]);
    return i < 0 ? null : (voices[i].voiceURI ?? voices[i].name);
  };

  it('gives each character a fitting voice on every platform', () => {
    const table = Object.fromEntries(
      Object.keys(PLATFORMS).map((p) => [
        p,
        Object.fromEntries(PERSONAS.map((persona) => [persona.id, picked(p, persona.id)])),
      ]),
    );
    expect(table).toMatchInlineSnapshot(`
      {
        "android": {
          "barista": "en-gb-x-gbb-network",
          "friend": "en-us-x-tpf-network",
          "interviewer": "en-us-x-iom-network",
          "teacher": "en-us-x-tpc-network",
        },
        "chromeWindows": {
          "barista": "Google UK English Male",
          "friend": "Google US English",
          "interviewer": "Google UK English Male",
          "teacher": "Google US English",
        },
        "edge": {
          "barista": "Microsoft Ryan Online (Natural) - English (United Kingdom)",
          "friend": "Microsoft Ava Online (Natural) - English (United States)",
          "interviewer": "Microsoft Andrew Online (Natural) - English (United States)",
          "teacher": "Microsoft EmmaMultilingual Online (Natural) - English (United States)",
        },
        "iphone": {
          "barista": "com.apple.voice.compact.en-GB.Arthur",
          "friend": "com.apple.voice.compact.en-US.Samantha",
          "interviewer": "com.apple.ttsbundle.siri_Aaron_en-US_compact",
          "teacher": "com.apple.voice.compact.en-US.Samantha",
        },
      }
    `);
  });

  it('keeps the two women apart where the device has more than one natural voice', () => {
    for (const p of ['android', 'edge']) expect(picked(p, 'teacher')).not.toBe(picked(p, 'friend'));
  });

  it('matches every character to a voice of the right gender', () => {
    for (const p of Object.keys(PLATFORMS)) {
      for (const persona of PERSONAS) {
        const voices = PLATFORMS[p];
        const voice = voices[pickVoice(voices, PERSONA_VOICES[persona.id])];
        expect([PERSONA_VOICES[persona.id].gender, null]).toContain(voiceGender(voice));
      }
    }
  });
});

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
    expect(voiceGender(v('Google US English', 'en-US'))).toBeNull();
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

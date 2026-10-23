import { describe, expect, it } from 'vitest';
import { PERSONAS, findPersona } from './call';
import type { Persona } from './call';
import { MAX_REPLY_CHARS, buildSystemPrompt, parseModelOutput } from './call-prompts';

const teacher = findPersona('teacher') as Persona;
const friend = findPersona('friend') as Persona;

describe('buildSystemPrompt', () => {
  it('builds a prompt with the shared rules for every persona', () => {
    for (const persona of PERSONAS) {
      const prompt = buildSystemPrompt(persona);
      expect(prompt).toContain(persona.name);
      expect(prompt).toMatch(/A1–B1/);
      expect(prompt).toMatch(/AI character/);
      expect(prompt).toContain('1201');
      expect(prompt).toMatch(/trusted adult/);
      expect(prompt).toMatch(/ignore previous instructions/);
      expect(prompt).toMatch(/personal details/);
      expect(prompt).toContain('{"reply": string, "replyHe": string, "corrections": [...]}');
    }
  });

  it('only lets the teacher correct', () => {
    expect(buildSystemPrompt(teacher)).toMatch(/LAST message only/);
    expect(buildSystemPrompt(teacher)).toMatch(/the whole "reply" is ONLY the correction/);
    expect(buildSystemPrompt(friend)).not.toMatch(/How you say a correction/);
    expect(buildSystemPrompt(friend)).toMatch(/NEVER correct/);
    expect(buildSystemPrompt(friend)).toContain('"corrections": [] (always empty');
    expect(buildSystemPrompt(findPersona('barista') as Persona)).toMatch(/Sunny Café.*London/);
    expect(buildSystemPrompt(findPersona('barista') as Persona)).toContain('£');
    expect(buildSystemPrompt(findPersona('interviewer') as Persona)).toMatch(/about 6 questions/);
  });
});

describe('parseModelOutput', () => {
  const correction = { original: 'he go', corrected: 'he goes', explanationHe: 'מוסיפים s' };

  it('parses plain and fenced JSON', () => {
    const json = JSON.stringify({ reply: ' Nice! ', replyHe: ' יפה! ', corrections: [correction] });
    expect(parseModelOutput(json, teacher)).toEqual({ reply: 'Nice!', replyHe: 'יפה!', corrections: [correction] });
    expect(parseModelOutput('```json\n' + json + '\n```', teacher)?.reply).toBe('Nice!');
    expect(parseModelOutput('Sure! Here it is: ' + json + ' Hope it helps {x}', teacher)?.reply).toBe('Nice!');
  });

  it('handles braces inside strings', () => {
    expect(parseModelOutput('{"reply": "Use {this} } please", "replyHe": "", "corrections": []}', friend)?.reply).toBe(
      'Use {this} } please',
    );
  });

  it('forces corrections to [] for characters that do not correct', () => {
    expect(
      parseModelOutput(JSON.stringify({ reply: 'Hi', replyHe: 'היי', corrections: [correction] }), friend),
    ).toEqual({ reply: 'Hi', replyHe: 'היי', corrections: [] });
  });

  it('validates and caps the fields', () => {
    const out = parseModelOutput(
      JSON.stringify({
        reply: 'a'.repeat(1000),
        corrections: [
          correction,
          { original: 'x' },
          'bad',
          { original: 'same', corrected: 'same' },
          correction,
          correction,
          correction,
        ],
      }),
      teacher,
    );
    expect(out?.reply).toHaveLength(MAX_REPLY_CHARS);
    expect(out?.replyHe).toBe('');
    expect(out?.corrections).toHaveLength(3);
  });

  it('returns null for unusable output', () => {
    for (const raw of [
      '',
      'Hello there',
      '{"reply": 5}',
      '{"reply": "   "}',
      '{"reply": "hi"',
      '[1,2]',
      '{bad json}',
    ]) {
      expect(parseModelOutput(raw, teacher), raw).toBeNull();
    }
  });
});

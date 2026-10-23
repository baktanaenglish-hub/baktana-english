import { describe, expect, it } from 'vitest';
import {
  MAX_TRAITS,
  PET_DESIGN_SCHEMA,
  buildDesignUserMessage,
  parsePetBadge,
  parsePetDesign,
  sanitizeDesignRequest,
} from './pet-design';

describe('parsePetDesign', () => {
  it('keeps a valid design', () => {
    const d = { name: 'זוהר', base: '🦊', color: 'lilac', traits: ['stars'], personality: 'funny', bio: 'שועל קטן' };
    expect(parsePetDesign(d)).toEqual(d);
  });

  it('repairs or drops what is not allowed', () => {
    const d = parsePetDesign({
      name: '  <b>זוהר</b>  ',
      base: '💩',
      color: 'neon',
      traits: ['stars', 'stars', 'laser', 'fire', 'snow', 'music'],
      personality: 'evil',
      bio: 'x'.repeat(500),
    })!;
    expect(d.name).toBe('b זוהר /b');
    expect(d.base).toBe('🐶');
    expect(d.color).toBe('sky');
    expect(d.traits).toEqual(['stars', 'fire', 'snow'].slice(0, MAX_TRAITS));
    expect(d.personality).toBe('cheerful');
    expect(d.bio.length).toBeLessThanOrEqual(140);
  });

  it('needs a name', () => {
    expect(parsePetDesign({ name: '   ' })).toBeNull();
    expect(parsePetDesign(null)).toBeNull();
  });
});

describe('sanitizeDesignRequest', () => {
  it('needs a prompt and caps it', () => {
    expect(sanitizeDesignRequest({ prompt: '  ' })).toBeNull();
    expect(sanitizeDesignRequest({ prompt: 'x'.repeat(1000) })!.prompt).toHaveLength(300);
  });

  it('keeps a valid current design to refine', () => {
    const req = sanitizeDesignRequest({ prompt: 'יותר כוכבים', current: { name: 'זוהר' } })!;
    expect(req.current?.name).toBe('זוהר');
    expect(buildDesignUserMessage(req)).toContain('זוהר');
  });
});

it('the schema lists every allowed value', () => {
  expect(PET_DESIGN_SCHEMA.properties.color.enum).toContain('lilac');
  expect(PET_DESIGN_SCHEMA.required).toContain('personality');
});

describe('parsePetBadge', () => {
  const badge = { name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: ['🧢'] };

  it('keeps a valid badge', () => {
    expect(parsePetBadge(badge)).toEqual(badge);
  });

  it('rejects unknown looks and stages, and drops unknown accessories', () => {
    expect(parsePetBadge({ ...badge, emoji: '💣' })).toBeNull();
    expect(parsePetBadge({ ...badge, stage: 9 })).toBeNull();
    expect(parsePetBadge({ ...badge, name: '' })).toBeNull();
    expect(parsePetBadge({ ...badge, color: 'red', worn: ['🧢', '🔪', '🧢'] })).toMatchObject({
      color: '#5ab8ff',
      worn: ['🧢'],
    });
  });
});

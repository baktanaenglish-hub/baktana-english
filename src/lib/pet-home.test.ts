import { describe, expect, it } from 'vitest';
import {
  HELP_MINUTES,
  HOME_ITEMS,
  currentHouse,
  formatDuration,
  helpProject,
  initialHome,
  parseHome,
  projectFraction,
  rushCost,
  rushProject,
  settleHome,
  startBlock,
  startProject,
  toggleOutfit,
} from './pet-home';
import { adoptPet, parsePet } from './pet';

const T0 = 1_000_000;
const MIN = 60_000;

describe('home projects', () => {
  it('needs a hatched pet, gems and a free builder, and charges the price', () => {
    const home = initialHome();
    expect(startBlock(home, 'tent', 100, false)).toBe('unhatched');
    expect(startBlock(home, 'tent', 5, true)).toBe('poor');
    expect(startBlock(home, 'bed', 100, true)).toBe('locked');
    const started = startProject(home, 'tent', 100, true, T0)!;
    expect(started.cost).toBe(10);
    expect(started.home.project).toEqual({ id: 'tent', startedAt: T0, endsAt: T0 + 5 * MIN });
    expect(startBlock(started.home, 'shirt', 100, true)).toBe('busy');
  });

  it('finishes by the clock, unlocking what needed it, and wears new clothes', () => {
    const started = startProject(initialHome(), 'tent', 100, true, T0)!.home;
    expect(settleHome(started, T0 + 4 * MIN).home).toBe(started);
    const done = settleHome(started, T0 + 5 * MIN);
    expect(done.finished?.id).toBe('tent');
    expect(currentHouse(done.home)?.id).toBe('tent');
    expect(startBlock(done.home, 'bed', 100, true)).toBeNull();

    const shirt = settleHome(startProject(done.home, 'shirt', 100, true, T0)!.home, T0 + 10 * MIN);
    expect(shirt.home.outfit).toBe('shirt');
    expect(toggleOutfit(shirt.home, 'shirt').outfit).toBeNull();
    expect(toggleOutfit(shirt.home, 'tent')).toBe(shirt.home);
  });

  it('is sped up by lessons and rushed with gems', () => {
    const started = startProject(initialHome(), 'tent', 100, true, T0)!.home;
    const helped = helpProject(started);
    // 15 minutes is more than the whole 5-minute tent: it is done, not before it started.
    expect(helped.project!.endsAt).toBe(T0);
    const long = startProject(initialHome(), 'vest', 100, true, T0)!.home;
    expect(helpProject(long).project!.endsAt).toBe(T0 + 60 * MIN - HELP_MINUTES * MIN);
    expect(helpProject(initialHome())).toEqual(initialHome());

    expect(rushCost(started, T0)).toBe(1);
    expect(rushProject(started, 0, T0)).toBeNull();
    const rushed = rushProject(started, 3, T0)!;
    expect(rushed.cost).toBe(1);
    expect(rushed.home.built).toEqual(['tent']);
    expect(projectFraction(started, T0 + 2.5 * MIN)).toBeCloseTo(0.5);
  });
});

describe('saving', () => {
  it('survives a round trip and ignores junk', () => {
    const pet = adoptPet('owl', 'מוקה', 1)!;
    const home = settleHome(startProject(pet.home, 'tent', 50, true, T0)!.home, T0 + 5 * MIN).home;
    expect(parsePet(JSON.stringify({ ...pet, home }))!.home).toEqual(home);
    expect(parsePet(JSON.stringify({ ...pet, home: undefined }))!.home).toEqual(initialHome());
    expect(
      parseHome({ built: ['tent', 'tent', 'nope', 7], project: { id: 'tent', endsAt: 5 }, outfit: 'tent' }),
    ).toEqual({
      built: ['tent'],
      project: null,
      outfit: null,
    });
  });

  it('has unique items that only require earlier ones', () => {
    const ids = HOME_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    HOME_ITEMS.forEach((item, i) => {
      if (item.requires) expect(ids.indexOf(item.requires)).toBeLessThan(i);
    });
    expect(formatDuration(5)).toBe('5 דק׳');
    expect(formatDuration(130)).toBe('2 שע׳ ו־10 דק׳');
    expect(formatDuration(1440)).toBe('יום');
  });
});

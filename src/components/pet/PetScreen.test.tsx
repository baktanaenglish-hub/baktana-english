import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { adoptPet, growPet } from '../../lib/pet';
import { DuelCard, Duels } from '../Duels';
import { MemberPet } from '../MyGroups';
import { PetScreen } from './PetScreen';

const noop = () => {};
const base = {
  xp: 0,
  streak: 0,
  practicedToday: false,
  today: '2026-10-22',
  premium: false,
  canDesignWithAi: false,
  onAdopt: noop,
  onToggleAccessory: noop,
  onDesign: noop,
};

describe('PetScreen', () => {
  it('offers to adopt a pet first', () => {
    const html = renderToStaticMarkup(<PetScreen {...base} pet={null} />);
    expect(html).toContain('בחרו חיה שתלווה אתכם');
    expect(html).toContain('דרקון');
  });

  it('shows the egg before the first lesson', () => {
    const html = renderToStaticMarkup(<PetScreen {...base} pet={adoptPet('owl', 'חכמה')} />);
    expect(html).toContain('חכמה');
    expect(html).toContain('אני עוד בביצה');
  });

  it('shows the challenge, accessories and abilities as the pet grows', () => {
    const pet = growPet(adoptPet('dragon', 'שלהבת')!, { xp: 250, lessons: 3, streak: 3 }).pet;
    const html = renderToStaticMarkup(<PetScreen {...base} xp={250} streak={3} pet={pet} />);
    expect(html).toContain('האתגר של היום');
    expect(html).toContain('צעיף');
    expect(html).toContain('🧢');
    expect(html).toContain('שתפו את שלהבת');
  });

  it('locks the designer for non-premium learners and opens it for premium', () => {
    const pet = adoptPet('dragon', 'שלהבת');
    expect(renderToStaticMarkup(<PetScreen {...base} pet={pet} onPremium={noop} />)).toContain('לפרטים על פרימיום');
    expect(renderToStaticMarkup(<PetScreen {...base} pet={pet} premium />)).toContain('לעצב חיה ייחודית');
  });
});

describe('MemberPet', () => {
  it("shows a member's pet with what it wears", () => {
    const html = renderToStaticMarkup(
      <MemberPet pet={{ name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: ['🧢'] }} />,
    );
    expect(html).toContain('🐲');
    expect(html).toContain('🧢');
    expect(html).toContain('החיה שלהבת');
  });
});

describe('DuelCard', () => {
  const duel = {
    id: 'd1',
    inviteCode: 'ABC234',
    isChallenger: true,
    createdAt: 0,
    startsAt: 1,
    endsAt: 2,
    me: { displayName: 'דנה', xp: 40, pet: { name: 'שלהבת', emoji: '🐲', stage: 2, color: '#4caf50', worn: [] } },
    opponent: { displayName: 'יוסי', xp: 25 },
  };

  it('shows both sides and the prize of a won duel', () => {
    const html = renderToStaticMarkup(
      <DuelCard duel={{ ...duel, state: 'finished', result: 'won' }} claimed={false} onClaim={() => null} />,
    );
    expect(html).toContain('🐲');
    expect(html).toContain('יוסי');
    expect(html).toContain('ניצחתם');
    expect(html).toContain('קבלת 30 💎');
  });

  it('shows who leads while it runs', () => {
    const html = renderToStaticMarkup(
      <DuelCard
        duel={{ ...duel, state: 'active', result: null, endsAt: Date.now() + 3_600_000 * 30 }}
        claimed={false}
        onClaim={() => null}
      />,
    );
    expect(html).toContain('אתם מובילים ב־15 XP');
  });
});

describe('Duels notices', () => {
  it('shows that a friend accepted the invite', () => {
    const notice = { id: 'd1|accepted', duelId: 'd1', icon: '⚔️', text: 'יוסי קיבל/ה את ההזמנה שלכם', at: 2 };
    const state = {
      duels: [],
      error: null,
      claimed: [],
      notices: [notice],
      readAt: 1,
      unclaimed: 0,
      unread: 1,
      refresh: async () => {},
      markRead: () => {},
      claim: () => null,
    };
    const user = { id: 'u1', email: 'a@b.co', displayName: 'דנה', createdAt: '2026-10-01T00:00:00Z' };
    const html = renderToStaticMarkup(
      <Duels user={user} state={state} onSignIn={noop} onPrize={noop} duelCode={null} onDuelCodeUsed={noop} />,
    );
    expect(html).toContain('יוסי קיבל/ה את ההזמנה שלכם');
    expect(html).toContain('class="unread"');
  });
});

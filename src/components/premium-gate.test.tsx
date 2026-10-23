import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CallPicker } from './call/CallPicker';

const user = { id: 'u1', email: 'a@b.co', displayName: 'דנה', createdAt: '2026-10-01T00:00:00Z' };
const notPremium = { premium: false, callsToday: 0, callsPerDay: 10 };
const noop = () => {};

function render(onPremium?: () => void) {
  return renderToStaticMarkup(
    <CallPicker user={user} status={notPremium} onStatus={noop} onSignIn={noop} onCall={noop} onPremium={onPremium} />,
  );
}

describe('the call tab before and after premium goes on sale', () => {
  it('says "coming soon" without a way to the premium screen', () => {
    const html = render();
    expect(html).toContain('בקרוב! שיחות וידאו יהיו חלק מפרימיום');
    expect(html).not.toContain('לפרטים על פרימיום');
  });

  it('offers the premium screen once on sale', () => {
    const html = render(noop);
    expect(html).toContain('שיחות וידאו הן חלק מפרימיום');
    expect(html).toContain('לפרטים על פרימיום');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReminderOffer } from './ReminderOffer';

const noop = () => {};

describe('the reminder offer card', () => {
  it('names the reminder time and offers yes or no', () => {
    const html = renderToStaticMarkup(<ReminderOffer time="20:00" onAccept={noop} onDismiss={noop} />);
    expect(html).toContain('רוצים תזכורת כל יום?');
    expect(html).toContain('20:00');
    expect(html).toContain('כן, להזכיר לי');
    expect(html).toContain('לא תודה');
  });
});

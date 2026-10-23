import { describe, expect, it } from 'vitest';
import { CALL_LIMITS, findPersona, type CallTurnResponse } from '../../shared/call';
import {
  allCorrections,
  appendReply,
  appendUser,
  callsLeft,
  canTalk,
  cleanMessage,
  formatDuration,
  learnerTurns,
  remainingText,
  retryRequest,
  startCall,
  turnRequest,
  wordRequest,
  type CallState,
} from './call';

const teacher = findPersona('teacher')!;
const friend = findPersona('friend')!;

const fix = { original: 'I go yesterday', corrected: 'I went yesterday', explanationHe: 'עבר: went' };
const reply = (patch: Partial<CallTurnResponse> = {}): CallTurnResponse => ({
  reply: 'Nice!',
  replyHe: 'נחמד!',
  corrections: [],
  ...patch,
});

describe('call state', () => {
  it('starts with the greeting', () => {
    const call = startCall(teacher);
    expect(call.lines).toEqual([{ role: 'assistant', text: teacher.greeting }]);
    expect(learnerTurns(call)).toBe(0);
    expect(canTalk(call)).toBe(true);
  });

  it('attaches the teacher’s corrections to the learner line', () => {
    let call = appendUser(startCall(teacher), 'I go yesterday');
    call = appendReply(call, reply({ corrections: [fix] }));
    expect(call.lines[1]).toEqual({ role: 'user', text: 'I go yesterday', corrections: [fix] });
    expect(call.lines[2]).toMatchObject({ role: 'assistant', text: 'Nice!', he: 'נחמד!' });
    expect(allCorrections(call)).toEqual([fix]);
  });

  it('never keeps corrections for personas that do not correct', () => {
    let call = appendUser(startCall(friend), 'I go yesterday');
    call = appendReply(call, reply({ corrections: [fix] }));
    expect(call.lines[1].corrections).toBeUndefined();
    expect(allCorrections(call)).toEqual([]);
  });

  it('collects corrections across the call in order', () => {
    const second = { original: 'he go', corrected: 'he goes', explanationHe: 'גוף שלישי' };
    let call: CallState = startCall(teacher);
    call = appendReply(appendUser(call, 'a'), reply({ corrections: [fix] }));
    call = appendReply(appendUser(call, 'b'), reply());
    call = appendReply(appendUser(call, 'c'), reply({ corrections: [second] }));
    expect(allCorrections(call)).toEqual([fix, second]);
    expect(learnerTurns(call)).toBe(3);
  });

  it('marks flagged replies and the end of the call', () => {
    let call = appendReply(appendUser(startCall(friend), 'x'), reply({ flagged: 'personal_info' }));
    expect(call.lines.at(-1)?.flagged).toBe('personal_info');
    expect(canTalk(call)).toBe(true);
    call = appendReply(appendUser(call, 'bye'), reply({ ended: true }));
    expect(call.ended).toBe(true);
    expect(canTalk(call)).toBe(false);
  });

  it('stops at the turn limit', () => {
    let call = startCall(friend);
    for (let i = 0; i < CALL_LIMITS.maxTurns; i++) call = appendReply(appendUser(call, `m${i}`), reply());
    expect(canTalk(call)).toBe(false);
  });
});

describe('turnRequest', () => {
  it('sends the history before the message, without screen-only fields', () => {
    const call = appendReply(appendUser(startCall(teacher), 'I go yesterday'), reply({ corrections: [fix] }));
    expect(turnRequest(call, 'Hello')).toEqual({
      persona: 'teacher',
      history: [
        { role: 'assistant', text: teacher.greeting },
        { role: 'user', text: 'I go yesterday' },
        { role: 'assistant', text: 'Nice!' },
      ],
      message: 'Hello',
    });
  });

  it('keeps only the latest maxHistory messages', () => {
    let call = startCall(friend);
    for (let i = 0; i < 30; i++) call = appendReply(appendUser(call, `m${i}`), reply({ reply: `r${i}` }));
    const req = turnRequest(call, 'next');
    expect(req.history).toHaveLength(CALL_LIMITS.maxHistory);
    expect(req.history.at(-1)).toEqual({ role: 'assistant', text: 'r29' });
    expect(req.history[0]).toEqual({ role: 'user', text: 'm20' });
  });

  it('rebuilds the request for a learner line that failed', () => {
    const call = appendUser(startCall(friend), 'Hi Maya');
    expect(retryRequest(call)).toEqual({
      persona: 'friend',
      history: [{ role: 'assistant', text: friend.greeting }],
      message: 'Hi Maya',
    });
    expect(retryRequest(startCall(friend))).toBeNull();
  });

  it('sends the pace only when slow', () => {
    const call = startCall(friend);
    expect(turnRequest(call, 'hi', 'normal')).not.toHaveProperty('pace');
    expect(turnRequest(call, 'hi', 'slow').pace).toBe('slow');
    expect(retryRequest(appendUser(call, 'hi'), 'slow')?.pace).toBe('slow');
  });

  it('turns a Hebrew word into a "how do I say" question', () => {
    expect(wordRequest(' שולחן ')).toBe('How do I say "שולחן" in English?');
  });
});

describe('cleanMessage', () => {
  it('collapses spaces and caps the length', () => {
    expect(cleanMessage('  I   like\n pizza  ')).toBe('I like pizza');
    expect(cleanMessage('a'.repeat(1000))).toHaveLength(CALL_LIMITS.maxMessageChars);
    expect(cleanMessage('   ')).toBe('');
  });
});

describe('formatDuration', () => {
  it('formats mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(5_999)).toBe('00:05');
    expect(formatDuration(65_000)).toBe('01:05');
    expect(formatDuration(61 * 60_000)).toBe('61:00');
    expect(formatDuration(-10)).toBe('00:00');
  });
});

describe('daily calls', () => {
  it('counts the calls left, never below zero', () => {
    expect(callsLeft({ premium: true, callsToday: 3, callsPerDay: 10 })).toBe(7);
    expect(callsLeft({ premium: true, callsToday: 12, callsPerDay: 10 })).toBe(0);
  });

  it('says how many are left, with the singular for one', () => {
    expect(remainingText(7, 10)).toBe('נשארו לכם 7 מתוך 10 שיחות היום');
    expect(remainingText(1, 10)).toBe('נשארה לכם שיחה אחת מתוך 10 היום');
  });
});

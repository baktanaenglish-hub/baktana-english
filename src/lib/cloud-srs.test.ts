import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { ItemState, ItemStates } from '../../shared/srs';
import { applySrsUpload } from '../../shared/srs-merge';
import { createCloudApi } from './cloud';
import { dateKey, shiftDateKey } from './progress';

/**
 * Fake of the srs_state table and the merge_srs RPC (supabase/schema.sql). The RPC is
 * emulated with the shared merge rules, as the SQL implements them; the point here is what
 * cloud.ts sends and how it reads the rows back.
 */
function fakeSupabase(opts: { signedIn?: boolean; failWith?: { message: string; code?: string } } = {}) {
  const rows: Record<string, ItemStates> = { u1: {}, u2: { 'w:other': st() } };
  const rpcCalls: { fn: string; args: { items: ItemStates } }[] = [];
  const session = opts.signedIn === false ? null : { user: { id: 'u1' } };
  const toRows = (userId: string) =>
    Object.entries(rows[userId]).map(([item_key, s]) => ({ user_id: userId, item_key, ...s, last: String(s.last) }));
  const client = {
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: async (col: string, value: string) => {
          expect(table).toBe('srs_state');
          expect(columns).toBe('item_key, box, due, seen, wrong, last');
          expect(col).toBe('user_id');
          return opts.failWith ? { data: null, error: opts.failWith } : { data: toRows(value), error: null };
        },
      }),
    }),
    rpc: async (fn: string, args: { items: ItemStates }) => {
      rpcCalls.push({ fn, args });
      if (opts.failWith) return { data: null, error: opts.failWith };
      rows.u1 = applySrsUpload(rows.u1, args.items).items;
      return { data: toRows('u1'), error: null };
    },
  };
  return { rows, rpcCalls, api: createCloudApi(async () => client as unknown as SupabaseClient) };
}

const TODAY = dateKey(Date.now());
function st(over: Partial<ItemState> = {}): ItemState {
  return { box: 2, due: TODAY, seen: 3, wrong: 1, last: 100, ...over };
}

describe('cloud SRS sync (US-R6, same behaviour as /api/srs)', () => {
  it('reads only the learner’s own rows and converts bigint strings', async () => {
    const { api, rows } = fakeSupabase();
    rows.u1 = { 'w:cat': st({ last: 1_700_000_000_000 }) };
    expect(await api.getSrs()).toEqual({ items: { 'w:cat': st({ last: 1_700_000_000_000 }) } });
  });

  it('sends sanitized items to merge_srs and returns the merged full state', async () => {
    const { api, rpcCalls } = fakeSupabase();
    await api.putSrs({ 'w:cat': st({ box: 3, last: 100 }) });
    const res = await api.putSrs({
      'w:cat': st({ box: 1, last: 200 }),
      'w:box7': st({ box: 7 as ItemState['box'] }),
      'bad key': st(),
      'w:later': st({ due: shiftDateKey(TODAY, 730) }),
    });
    expect(rpcCalls.map((c) => c.fn)).toEqual(['merge_srs', 'merge_srs']);
    expect(Object.keys(rpcCalls[1].args.items)).toEqual(['w:cat']);
    expect(res).toEqual({ items: { 'w:cat': st({ box: 1, last: 200 }) } });
  });

  it('rejects a non-object with invalid_srs and more than 1000 items with 413', async () => {
    const { api, rpcCalls } = fakeSupabase();
    await expect(api.putSrs([] as unknown as ItemStates)).rejects.toMatchObject({ status: 400, code: 'invalid_srs' });
    const many: ItemStates = {};
    for (let i = 0; i < 1001; i++) many[`w:w${i}`] = st();
    await expect(api.putSrs(many)).rejects.toMatchObject({ status: 413, code: 'too_many_items' });
    expect(rpcCalls).toHaveLength(0);
  });

  it('requires a session', async () => {
    const { api } = fakeSupabase({ signedIn: false });
    await expect(api.getSrs()).rejects.toMatchObject({ status: 401 });
    await expect(api.putSrs({})).rejects.toMatchObject({ status: 401 });
  });

  it('maps database and network errors', async () => {
    await expect(fakeSupabase({ failWith: { message: 'invalid_srs' } }).api.putSrs({})).rejects.toMatchObject({
      status: 400,
      code: 'invalid_srs',
    });
    await expect(fakeSupabase({ failWith: { message: 'Failed to fetch' } }).api.getSrs()).rejects.toMatchObject({
      status: 0,
      code: 'network',
    });
  });
});

-- Acceptance checks for the Supabase SQL (docs/spec/v2.md §9): run by supabase/tests/run.sh
-- after 00-stub-auth.sql, schema.sql, analytics-views.sql and analytics-seed.sql.
-- Every check raises an exception when it fails, so psql -v ON_ERROR_STOP=1 exits non-zero.
\set ON_ERROR_STOP 1

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.com', '{"display_name":"Learner A"}'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.com', '{"display_name":"Learner B"}')
on conflict do nothing;

-- US-U1 AC7: an old client saving progress without u7l1 keeps it (trigger keep_completed_lessons).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
insert into public.progress (user_id, data)
values ('00000000-0000-4000-8000-00000000000a', '{"xp":100,"completed":{"u1l1":1,"u7l1":1}}');
update public.progress set data = '{"xp":110,"completed":{"u1l1":2}}'
where user_id = '00000000-0000-4000-8000-00000000000a';
do $$ declare c jsonb; begin
  select data -> 'completed' into c from public.progress where user_id = '00000000-0000-4000-8000-00000000000a';
  if c is distinct from '{"u1l1":2,"u7l1":1}'::jsonb then raise exception 'US-U1 AC7 failed: %', c; end if;
end $$;

-- US-A5: a progress reset (newer resetAt) clears the lessons; an older save afterwards doesn't
-- bring them back through the trigger.
update public.progress set data = '{"xp":0,"completed":{},"resetAt":5000}'
where user_id = '00000000-0000-4000-8000-00000000000a';
do $$ declare c jsonb; begin
  select data -> 'completed' into c from public.progress where user_id = '00000000-0000-4000-8000-00000000000a';
  if c is distinct from '{}'::jsonb then raise exception 'US-A5 reset failed: %', c; end if;
end $$;
update public.progress set data = '{"xp":0,"completed":{"u1l1":1},"resetAt":5000}'
where user_id = '00000000-0000-4000-8000-00000000000a';
do $$ declare c jsonb; begin
  select data -> 'completed' into c from public.progress where user_id = '00000000-0000-4000-8000-00000000000a';
  if c is distinct from '{"u1l1":1}'::jsonb then raise exception 'US-A5 after reset failed: %', c; end if;
end $$;

-- US-R6 AC1/AC2/AC3: merge_srs – newer last wins, equal last keeps the lower box and max seen/wrong,
-- invalid keys, box 7 and a due date two years ahead are skipped.
select count(*) from public.merge_srs(jsonb_build_object(
  'w:dog', jsonb_build_object('box', 3, 'due', current_date::text, 'seen', 2, 'wrong', 0, 'last', 100),
  's:u1l1:0', jsonb_build_object('box', 2, 'due', current_date::text, 'seen', 1, 'wrong', 1, 'last', 50)));
select count(*) from public.merge_srs(jsonb_build_object(
  'w:dog', jsonb_build_object('box', 1, 'due', current_date::text, 'seen', 3, 'wrong', 1, 'last', 200),
  's:u1l1:0', jsonb_build_object('box', 4, 'due', current_date::text, 'seen', 5, 'wrong', 0, 'last', 50),
  'bad key', jsonb_build_object('box', 1, 'due', current_date::text, 'seen', 1, 'wrong', 0, 'last', 1),
  'w:seven', jsonb_build_object('box', 7, 'due', current_date::text, 'seen', 1, 'wrong', 0, 'last', 1),
  'w:later', jsonb_build_object('box', 1, 'due', (current_date + 730)::text, 'seen', 1, 'wrong', 0, 'last', 1)));
do $$ declare r record; n int; begin
  select * into r from public.srs_state where item_key = 'w:dog';
  if r.box <> 1 or r.last <> 200 or r.seen <> 3 or r.wrong <> 1 then raise exception 'US-R6 AC1 failed: %', r; end if;
  select * into r from public.srs_state where item_key = 's:u1l1:0';
  if r.box <> 2 or r.seen <> 5 or r.wrong <> 1 then raise exception 'US-R6 AC2 failed: %', r; end if;
  select count(*) into n from public.srs_state;
  if n <> 2 then raise exception 'US-R6 AC3 failed: % rows', n; end if;
end $$;
do $$ begin
  perform public.merge_srs('[1,2]'::jsonb);
  raise exception 'US-R6 AC3 failed: a non-object body was accepted';
exception when raise_exception then
  if sqlerrm <> 'invalid_srs' then raise; end if;
end $$;

-- US-R6 AC4: learner B sees none of A's rows.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
do $$ declare n int; begin
  select count(*) into n from public.srs_state;
  if n <> 0 then raise exception 'US-R6 AC4 failed: B sees % rows', n; end if;
  select count(*) into n from public.merge_srs('{}'::jsonb);
  if n <> 0 then raise exception 'US-R6 AC4 failed: merge_srs returned % rows to B', n; end if;
  -- B deleting "all" review rows (as a reset does) leaves A's untouched.
  delete from public.srs_state;
end $$;

-- US-A5: A's reset deletes A's own review rows.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
do $$ declare n int; begin
  select count(*) into n from public.srs_state;
  if n = 0 then raise exception 'US-A5 failed: B deleted A''s review rows'; end if;
  delete from public.srs_state where user_id = '00000000-0000-4000-8000-00000000000a';
  select count(*) into n from public.srs_state;
  if n <> 0 then raise exception 'US-A5 failed: % review rows left after reset', n; end if;
end $$;
reset role;

-- US-T1 AC6: anon can insert an event but cannot read any row of events (or the views).
set role anon;
select set_config('request.jwt.claim.sub', '', false);
insert into public.events (anon_id, name, client_ts, local_date, local_hour, platform)
values ('11111111-1111-4111-8111-111111111111', 'app_open', now(), current_date, 9, 'web');
do $$ declare n int; begin
  select count(*) into n from public.events;
  if n <> 0 then raise exception 'US-T1 AC6 failed: anon reads % events', n; end if;
end $$;
do $$ begin
  perform 1 from public.v_lesson_funnel limit 1;
  raise exception 'US-T1 AC6 failed: anon can read v_lesson_funnel';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.events (anon_id, user_id, name, client_ts, local_date, local_hour, platform)
  values ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-00000000000a', 'app_open',
          now(), current_date, 9, 'web');
  raise exception 'US-T1 AC6 failed: anon inserted an event for another user';
exception when insufficient_privilege then null;
end $$;
reset role;

-- US-T1 AC7: every view of §8.5 runs on the seed data.
do $$ declare v text; n bigint; begin
  foreach v in array array['v_daily_active', 'v_cohort_retention', 'v_lesson_funnel', 'v_item_difficulty',
                           'v_exercise_type_accuracy', 'v_error_code_accuracy', 'v_review_engagement',
                           'v_signup_funnel'] loop
    execute format('select count(*) from public.%I', v) into n;
    raise notice '% rows: %', v, n;
  end loop;
end $$;
do $$ declare n bigint; begin
  select count(*) into n from public.v_lesson_funnel;
  if n = 0 then raise exception 'US-T1 AC7 failed: v_lesson_funnel is empty on the seed'; end if;
end $$;

-- Video-call usage: clients can neither read call_usage nor call increment_call_usage; the service
-- role counts turns and calls and refuses past the limits.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', false);
do $$ begin
  perform count(*) from public.call_usage;
  raise exception 'call_usage: authenticated could read it';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.increment_call_usage('00000000-0000-4000-8000-00000000000a', current_date, true, 10, 400);
  raise exception 'increment_call_usage: authenticated was allowed to call it';
exception when insufficient_privilege then null;
end $$;
reset role;
set role anon;
do $$ begin
  perform public.increment_call_usage('00000000-0000-4000-8000-00000000000a', current_date, true, 10, 400);
  raise exception 'increment_call_usage: anon was allowed to call it';
exception when insufficient_privilege then null;
end $$;
reset role;
set role service_role;
do $$ declare j json; a uuid := '00000000-0000-4000-8000-00000000000a'; d date := '2026-01-05'; begin
  j := public.increment_call_usage(a, d, true, 2, 4);
  if (j->>'allowed')::boolean is not true or (j->>'calls')::int <> 1 then raise exception 'call usage 1: %', j; end if;
  j := public.increment_call_usage(a, d, false, 2, 4);
  if (j->>'calls')::int <> 1 then raise exception 'call usage 2 (continuing turn counted as a call): %', j; end if;
  j := public.increment_call_usage(a, d, true, 2, 4);
  if (j->>'allowed')::boolean is not true or (j->>'calls')::int <> 2 then raise exception 'call usage 3: %', j; end if;
  j := public.increment_call_usage(a, d, true, 2, 4);
  if (j->>'allowed')::boolean or j->>'reason' <> 'calls' then raise exception 'call usage 4 (3rd call allowed): %', j; end if;
  j := public.increment_call_usage(a, d, false, 2, 4);
  if (j->>'allowed')::boolean is not true then raise exception 'call usage 5: %', j; end if;
  j := public.increment_call_usage(a, d, false, 2, 4);
  if (j->>'allowed')::boolean or j->>'reason' <> 'turns' then raise exception 'call usage 6 (5th turn allowed): %', j; end if;
  if (select turns from public.call_usage where user_id = a and day = d) <> 4 then
    raise exception 'call usage: refused turns were counted';
  end if;
  j := public.increment_call_usage(a, d + 1, true, 2, 4);
  if (j->>'calls')::int <> 1 then raise exception 'call usage: the next day did not start from zero: %', j; end if;
  perform public.increment_call_usage('00000000-0000-4000-8000-00000000000b', d, true, 2, 4);
end $$;
reset role;

-- Paid premium: clients can neither read nor write entitlements or billing_events; the service role can.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
do $$ begin
  perform count(*) from public.entitlements;
  raise exception 'entitlements: authenticated could read it';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into public.entitlements (user_id, premium_until)
    values ('00000000-0000-4000-8000-00000000000b', now() + interval '1 year');
  raise exception 'entitlements: a learner could give themselves premium';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform count(*) from public.billing_events;
  raise exception 'billing_events: authenticated could read it';
exception when insufficient_privilege then null;
end $$;
reset role;
set role anon;
do $$ begin
  perform count(*) from public.entitlements;
  raise exception 'entitlements: anon could read it';
exception when insufficient_privilege then null;
end $$;
reset role;
set role service_role;
insert into public.entitlements (user_id, premium_until, source, product_id, will_renew)
  values ('00000000-0000-4000-8000-00000000000b', now() + interval '1 month', 'play', 'premium:monthly', true)
  on conflict (user_id) do update set premium_until = excluded.premium_until;
insert into public.billing_events (event_id, type) values ('evt-1', 'INITIAL_PURCHASE') on conflict do nothing;
insert into public.billing_events (event_id, type) values ('evt-1', 'INITIAL_PURCHASE') on conflict do nothing;
do $$ begin
  insert into public.entitlements (user_id, source) values ('00000000-0000-4000-8000-00000000000b', 'paypal')
    on conflict (user_id) do update set source = excluded.source;
  raise exception 'entitlements: an unknown source was accepted';
exception when check_violation then null;
end $$;
reset role;

-- Account deletion: anon can't call delete_my_account; a learner deleting their account takes all
-- their rows with them and leaves everyone else's.
set role anon;
do $$ begin
  perform public.delete_my_account();
  raise exception 'delete_my_account: anon was allowed to call it';
exception when insufficient_privilege then null;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000b', false);
insert into public.progress (user_id, data) values ('00000000-0000-4000-8000-00000000000b', '{"xp":5}');
insert into public.xp_events (xp) values (5);
select count(*) from public.merge_srs(jsonb_build_object(
  'w:cat', jsonb_build_object('box', 1, 'due', current_date::text, 'seen', 1, 'wrong', 0, 'last', 1)));
select public.delete_my_account();
reset role;
do $$ declare n int; b uuid := '00000000-0000-4000-8000-00000000000b'; begin
  select (select count(*) from auth.users where id = b) + (select count(*) from public.profiles where id = b)
       + (select count(*) from public.progress where user_id = b) + (select count(*) from public.xp_events where user_id = b)
       + (select count(*) from public.srs_state where user_id = b) + (select count(*) from public.events where user_id = b)
       + (select count(*) from public.call_usage where user_id = b)
       + (select count(*) from public.entitlements where user_id = b)
    into n;
  if n <> 0 then raise exception 'delete_my_account failed: % rows of B remain', n; end if;
  select count(*) into n from public.progress where user_id = '00000000-0000-4000-8000-00000000000a';
  if n <> 1 then raise exception 'delete_my_account removed another learner''s progress'; end if;
end $$;

-- Groups (shared/groups.ts): no direct table access; create, join with a messy code, member-only
-- boards, XP counted from joining, ownership passing on and empty groups removed.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'c1@example.com', '{"display_name":"Group C1"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'c2@example.com', '{"display_name":"Group C2"}'),
  ('00000000-0000-4000-8000-0000000000c3', 'c3@example.com', '{"display_name":"Group C3"}')
on conflict do nothing;
-- Old XP from before anyone joined a group.
insert into public.xp_events (user_id, xp, created_at)
values ('00000000-0000-4000-8000-0000000000c1', 40, now() - interval '400 days');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', false);
do $$ begin
  perform * from public.groups;
  raise exception 'groups: a learner could read the table directly';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform public.create_group(' x ');
  raise exception 'groups: a one-letter name was accepted';
exception when raise_exception then
  if sqlerrm <> 'invalid_name' then raise; end if;
end $$;
create temporary table if not exists test_group (id uuid, code text);
grant all on test_group to authenticated;
insert into test_group (id) select public.create_group('  The   Family ');
insert into public.xp_events (xp, lesson) values (15, true);
reset role;
update test_group set code = (select invite_code from public.groups where id = test_group.id);
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c2', false);
do $$ declare gid uuid; begin
  select public.join_group(lower(substr(code, 1, 3)) || ' - ' || substr(code, 4)) into gid from test_group;
  if gid is distinct from (select id from test_group) then raise exception 'join_group failed: %', gid; end if;
end $$;
do $$ begin
  perform public.join_group((select code from test_group));
  raise exception 'join_group: joined twice';
exception when raise_exception then
  if sqlerrm <> 'already_member' then raise; end if;
end $$;
insert into public.xp_events (xp, lesson) values (10, true);
do $$ declare r record; n int; begin
  select * into strict r from public.my_groups(now() - interval '1 day', now() + interval '1 day');
  if r.name <> 'The Family' or r.member_count <> 2 or r.is_owner or r.xp <> 25 or r.lessons <> 2 or r.active_days <> 2 then
    raise exception 'my_groups failed: %', r;
  end if;
  select count(*) into n from public.group_member_stats((select id from test_group), '-infinity', null);
  if n <> 2 then raise exception 'group_member_stats failed: % rows', n; end if;
  select total_xp into n from public.group_totals('-infinity', null) where is_mine;
  if n <> 25 then raise exception 'group_totals failed: % (old XP from before joining must not count)', n; end if;
  select xp into n from public.xp_leaderboard(now() - interval '1 day', null) where is_me;
  if n <> 10 then raise exception 'xp_leaderboard failed: %', n; end if;
end $$;
-- Pets: C2 shares a pet badge through their own profile; the group board shows it, and no one else's changes.
update public.profiles set pet = '{"name":"Flame","emoji":"🐲","stage":2,"color":"#4caf50","worn":["🧢"]}'
  where id = auth.uid();
update public.profiles set pet = '{"name":"Hacked"}' where id = '00000000-0000-4000-8000-0000000000c1';
do $$ declare mine jsonb; other jsonb; begin
  select pet into mine from public.group_member_stats((select id from test_group), '-infinity', null) where is_me;
  select pet into other from public.group_member_stats((select id from test_group), '-infinity', null) where not is_me;
  if mine ->> 'name' <> 'Flame' or other is not null then
    raise exception 'pets on the group board failed: % / %', mine, other;
  end if;
end $$;
do $$ begin
  update public.profiles set pet = jsonb_build_object('name', repeat('x', 700)) where id = auth.uid();
  raise exception 'profiles: an oversized pet was stored';
exception when check_violation then null;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c3', false);
do $$ begin
  perform public.group_member_stats((select id from test_group), '-infinity', null);
  raise exception 'group_member_stats: a stranger saw the members';
exception when raise_exception then
  if sqlerrm <> 'not_member' then raise; end if;
end $$;
-- The owner leaves: C2 owns the group; C2 leaves too: the group is gone.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', false);
select public.leave_group((select id from test_group));
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c2', false);
do $$ declare r record; begin
  select * into strict r from public.my_groups(now() - interval '1 day', now() + interval '1 day');
  if not r.is_owner or r.member_count <> 1 then raise exception 'ownership did not pass on: %', r; end if;
end $$;
select public.leave_group((select id from test_group));
reset role;
do $$ begin
  if exists (select 1 from public.groups) then raise exception 'an empty group was kept'; end if;
end $$;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  perform public.create_group('Guests');
  raise exception 'create_group: anon was allowed to call it';
exception when insufficient_privilege then null;
end $$;
select count(*) from public.group_totals(now() - interval '7 days', null);
reset role;

-- Duels: C1 opens one, C2 accepts it; only XP from the start on counts. C3 can't join or see it.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', false);
do $$ begin
  perform * from public.duels;
  raise exception 'duels: a learner could read the table directly';
exception when insufficient_privilege then null;
end $$;
create temporary table if not exists test_duel (id uuid, code text);
grant all on test_duel to authenticated;
insert into test_duel (id) select public.create_duel();
update test_duel set code = (select d.invite_code from public.my_duels() d where d.id = test_duel.id);
do $$ begin
  perform public.join_duel((select code from test_duel));
  raise exception 'join_duel: the challenger joined their own duel';
exception when raise_exception then
  if sqlerrm <> 'own_duel' then raise; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c2', false);
select public.join_duel(lower((select code from test_duel)));
insert into public.xp_events (xp, lesson) values (20, true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c1', false);
do $$ declare r record; begin
  select * into strict r from public.my_duels();
  if not r.is_challenger or r.starts_at is null or r.my_xp <> 0 or r.opp_xp <> 20 or r.opp_name <> 'Group C2' then
    raise exception 'my_duels failed: %', r;
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000c3', false);
do $$ begin
  perform public.join_duel((select code from test_duel));
  raise exception 'join_duel: a duel was joined a second time';
exception when raise_exception then
  if sqlerrm <> 'duel_not_found' then raise; end if;
end $$;
do $$ begin
  if exists (select 1 from public.my_duels()) then raise exception 'my_duels: a stranger saw a duel'; end if;
  perform public.cancel_duel((select id from test_duel));
  raise exception 'cancel_duel: a stranger cancelled a duel';
exception when raise_exception then
  if sqlerrm <> 'not_in_duel' then raise; end if;
end $$;
-- At most 3 open duels; withdrawing an invite frees a place.
select public.create_duel() from generate_series(1, 3);
do $$ begin
  perform public.create_duel();
  raise exception 'create_duel: more than 3 open duels';
exception when raise_exception then
  if sqlerrm <> 'too_many_duels' then raise; end if;
end $$;
select public.cancel_duel((select d.id from public.my_duels() d limit 1));
select public.create_duel();
reset role;

select 'supabase acceptance: all checks passed' as result;

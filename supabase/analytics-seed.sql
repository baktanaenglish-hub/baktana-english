-- Baktana English – synthetic analytics events for testing the views (US-T1 AC7).
-- NOT for production data. Every seeded row has app_version = 'seed', so it can be removed with:
--   delete from public.events where app_version = 'seed';
--
-- Usage (a test / staging project, SQL Editor, service role):
--   1. supabase/schema.sql   2. supabase/analytics-views.sql   3. this file
--   4. select public.refresh_analytics_views();   5. select * from public.v_lesson_funnel; …
--
-- Deterministic (setseed): 300 learners whose first app_open falls in the last 45 days,
-- with decaying retention, lessons from units 1–6, reviews, abandons, hearts-out, error codes
-- and the sign-up prompt. created_at is set to the event time so the rate-limit trigger
-- (600 events per anon_id per hour) does not skip seeded rows.

delete from public.events where app_version = 'seed';

do $$
declare
  -- Lessons of units 1–6 in course order (docs/spec/v2.md §4).
  lessons text[] := array[
    'u1l1','u1l2','u1l3','u1l4','u1l5','u2l1','u2l2','u2l3','u2l4','u2l5',
    'u3l1','u3l2','u3l3','u3l4','u3l5','u4l1','u4l2','u4l3','u4l4','u4l5','u4l6',
    'u5l1','u5l2','u5l3','u5l4','u5l5','u6l1','u6l2','u6l3','u6l4','u6l5'];
  ex_types text[] := array['choice-en','choice-he','match','build-en','build-he','listen'];
  platforms text[] := array['web','pwa','android'];
  u integer;
  d integer;
  n integer;
  k integer;
  aid uuid;
  first_day date;
  day date;
  plat text;
  next_lesson integer;
  lesson text;
  difficulty numeric;
  hearts integer;
  wrong integer;
  done integer;
  reviewer boolean;
  signs_up boolean;
  signed boolean;
  prompted boolean;
  ts timestamptz;
  item text;
  ex text;
  ok boolean;
  review_size integer;
  review_ok integer;
begin
  perform setseed(0.42);
  for u in 1..300 loop
    aid := md5('baktana-seed-' || u)::uuid;
    first_day := current_date - 44 + (u % 45);
    plat := platforms[1 + (u % 3)];
    reviewer := random() < 0.45;
    signs_up := random() < 0.3;
    signed := false;
    prompted := false;
    next_lesson := 1;

    for d in 0..(current_date - first_day) loop
      -- Day 0 always; later days with a decaying chance (reviewers come back more often).
      if d > 0 and random() > (0.42 * exp(-d / 9.0) + 0.06 + case when reviewer then 0.06 else 0 end) then
        continue;
      end if;
      day := first_day + d;
      ts := day + make_interval(hours => 7 + floor(random() * 15)::int, mins => floor(random() * 50)::int);

      insert into public.events (anon_id, user_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
      values (aid, null, 'app_open',
              jsonb_build_object('guest', not signed, 'srsDue', floor(random() * 12)::int, 'lessonsCompleted', next_lesson - 1),
              ts, day, extract(hour from ts)::int, 'seed', plat, ts);

      if d = 0 then
        insert into public.events (anon_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
        values (aid, 'onboarding_complete', jsonb_build_object('dailyGoal', (array[10, 20, 30])[1 + u % 3]),
                ts + interval '1 minute', day, extract(hour from ts)::int, 'seed', plat, ts + interval '1 minute');
      end if;

      -- 1–3 lessons on an active day.
      for n in 1..(1 + floor(random() * 3)::int) loop
        exit when next_lesson > array_length(lessons, 1);
        lesson := lessons[next_lesson];
        -- Each lesson has its own difficulty (accuracy roughly 65–95%); u4l5 is the hard one.
        difficulty := 0.65 + (abs(hashtext(lesson)) % 30) / 100.0 - case when lesson = 'u4l5' then 0.15 else 0 end;
        ts := ts + interval '3 minutes';

        if lesson in ('u1l1', 'u2l1', 'u3l1', 'u4l1', 'u5l1', 'u6l1') and random() < 0.9 then
          insert into public.events (anon_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
          values (aid, 'unit_intro_shown',
                  jsonb_build_object('unitId', substring(lesson from '^(u\d+)'), 'trigger', 'auto'),
                  ts, day, extract(hour from ts)::int, 'seed', plat, ts);
        end if;

        insert into public.events (anon_id, name, lesson_id, props, client_ts, local_date, local_hour, app_version, platform, created_at)
        values (aid, 'lesson_start', lesson, jsonb_build_object('catchup', false, 'attempt', 1),
                ts, day, extract(hour from ts)::int, 'seed', plat, ts);

        hearts := 5;
        wrong := 0;
        done := 0;
        for k in 0..11 loop
          -- Abandon mid-lesson now and then.
          exit when random() < 0.012;
          if k % 3 = 2 then
            item := 's:' || lesson || ':' || (k / 3) % 4;
          else
            item := 'w:' || lesson || '-word' || (k % 5);
          end if;
          ex := ex_types[1 + ((k + u) % 6)];
          ok := random() < difficulty - case when ex = 'listen' then 0.08 else 0 end;
          ts := ts + make_interval(secs => 5 + floor(random() * 10)::int);
          insert into public.events (anon_id, name, lesson_id, item_key, ex_type, correct, first_try, props,
                                     client_ts, local_date, local_hour, app_version, platform, created_at)
          values (aid, 'exercise_answer', lesson, item, ex, ok, true,
                  case when item like 's:%' then jsonb_build_object('errors', jsonb_build_array('E' || (1 + abs(hashtext(item)) % 12)))
                       else '{}'::jsonb end,
                  ts, day, extract(hour from ts)::int, 'seed', plat, ts);
          done := done + 1;
          if not ok then
            wrong := wrong + 1;
            hearts := hearts - 1;
          end if;
          if hearts = 0 then
            insert into public.events (anon_id, name, lesson_id, client_ts, local_date, local_hour, app_version, platform, created_at)
            values (aid, 'hearts_out', lesson, ts, day, extract(hour from ts)::int, 'seed', plat, ts);
            exit;
          end if;
        end loop;

        if done = 12 then
          insert into public.events (anon_id, name, lesson_id, duration_ms, props, client_ts, local_date, local_hour, app_version, platform, created_at)
          values (aid, 'lesson_complete', lesson, 60000 + floor(random() * 180000)::int,
                  jsonb_build_object('accuracy', round((12 - wrong) / 12.0, 2), 'mistakes', wrong, 'xp', 10, 'heartsLeft', hearts),
                  ts, day, extract(hour from ts)::int, 'seed', plat, ts);
          next_lesson := next_lesson + 1;

          -- Sign-up prompt for guests after their first lesson (round 1).
          if not signed and not prompted then
            prompted := true;
            insert into public.events (anon_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
            values (aid, 'signup_prompt_shown', jsonb_build_object('lessonsCompleted', next_lesson - 1, 'round', 1),
                    ts, day, extract(hour from ts)::int, 'seed', plat, ts);
            insert into public.events (anon_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
            values (aid, case when signs_up then 'signup_prompt_accepted' else 'signup_prompt_dismissed' end,
                    jsonb_build_object('lessonsCompleted', next_lesson - 1, 'round', 1),
                    ts + interval '5 seconds', day, extract(hour from ts)::int, 'seed', plat, ts + interval '5 seconds');
            if signs_up then
              signed := true;
              ts := ts + interval '1 minute';
              insert into public.events (anon_id, name, props, client_ts, local_date, local_hour, app_version, platform, created_at)
              values (aid, 'signup_complete', jsonb_build_object('from', 'prompt'),
                      ts, day, extract(hour from ts)::int, 'seed', plat, ts);
              insert into public.events (anon_id, name, client_ts, local_date, local_hour, app_version, platform, created_at)
              values (aid, 'identify', ts, day, extract(hour from ts)::int, 'seed', plat, ts);
            end if;
          end if;
        else
          insert into public.events (anon_id, name, lesson_id, props, client_ts, local_date, local_hour, app_version, platform, created_at)
          values (aid, 'lesson_abandon', lesson, jsonb_build_object('answered', done, 'total', 12, 'review', false),
                  ts, day, extract(hour from ts)::int, 'seed', plat, ts);
        end if;
      end loop;

      -- A review session on later days (reviewers mostly).
      if d > 0 and random() < (case when reviewer then 0.7 else 0.08 end) then
        review_size := 6 + floor(random() * 5)::int;
        review_ok := 0;
        ts := ts + interval '2 minutes';
        insert into public.events (anon_id, name, lesson_id, props, client_ts, local_date, local_hour, app_version, platform, created_at)
        values (aid, 'review_start', null, jsonb_build_object('due', review_size, 'size', review_size, 'source', 'due'),
                ts, day, extract(hour from ts)::int, 'seed', plat, ts);
        for k in 1..review_size loop
          item := 'w:' || lessons[1 + floor(random() * greatest(next_lesson - 1, 1))::int] || '-word' || (k % 5);
          ok := random() < 0.82;
          if ok then review_ok := review_ok + 1; end if;
          ts := ts + make_interval(secs => 6);
          insert into public.events (anon_id, name, lesson_id, item_key, ex_type, correct, first_try, props,
                                     client_ts, local_date, local_hour, app_version, platform, created_at)
          values (aid, 'exercise_answer', null, item, ex_types[1 + (k % 6)], ok, true,
                  jsonb_build_object('box', 1 + floor(random() * 5)::int),
                  ts, day, extract(hour from ts)::int, 'seed', plat, ts);
        end loop;
        insert into public.events (anon_id, name, duration_ms, props, client_ts, local_date, local_hour, app_version, platform, created_at)
        values (aid, 'review_complete', review_size * 7000, jsonb_build_object('size', review_size, 'correct', review_ok),
                ts, day, extract(hour from ts)::int, 'seed', plat, ts);
      end if;
    end loop;
  end loop;
end; $$;

-- Refresh the materialized views so the dashboards see the seed.
select public.refresh_analytics_views();

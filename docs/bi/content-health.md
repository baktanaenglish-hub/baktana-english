# דוח "בריאות תוכן" – שבועי, למורים

הדוח מוצא שיעורים ופריטים שצריך לשכתב, לפי הכללים ב־§8.6 וב־D12 באפיון (`docs/spec/v2.md`).
מריצים את ארבע השאילתות פעם בשבוע (Supabase Studio → SQL Editor, או כשאלה שמורה ב־Metabase, ראו [`dashboards.md`](dashboards.md)) ושולחים את התוצאה למורים.

כל השאילתות מסתכלות על **28 הימים האחרונים**, כדי שתיקון בשיעור יופיע בדוח אחרי כמה שבועות ולא יוסתר על ידי נתונים ישנים. סף מינימלי של ניסיונות מונע החלטות על בסיס מעט לומדים.

| ממצא                               | סף                                                            | מה עושים                                                   |
| ---------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| דיוק בניסיון ראשון בשיעור          | מתחת ל־60% או מעל 95% (לפחות 100 תשובות)                      | שכתוב השיעור: קשה מדי או קל מדי                            |
| השלמה / נטישה בשיעור               | השלמה מתחת ל־70% או נטישה מעל 25% (לפחות 30 התחלות)           | שיעור גישור עם id חדש בסוף היחידה (D2)                     |
| פריט עם שיעור טעות גבוה            | מעל 40% (לפחות 30 ניסיונות)                                   | שכתוב, או הוספת `alt` / `heAlt` (תשובה נכונה שנספרה כטעות) |
| `listen` מול `build-en` לאותו משפט | `listen` נמוך ב־15 נקודות או יותר (לפחות 20 ניסיונות בכל סוג) | בעיית TTS או הגייה (E11, E12): לבדוק את המשפט ב־TTS        |

> המשפטים ממופים לפי מיקום (`s:<lessonId>:<index>`, אינדקס מ־0). לכן, כדי למצוא משפט: פותחים את `src/data/units/uNN.ts`, את השיעור, וסופרים מ־0. מילים ממופות לפי `w:<wordId>`.

## 1. שיעורים לשכתוב – דיוק בניסיון ראשון

```sql
select lesson_id,
       public.analytics_unit(lesson_id) as unit,
       public.analytics_lesson_no(lesson_id) as lesson_no,
       count(*) as answers,
       round(100.0 * count(*) filter (where correct) / count(*), 1) as first_try_accuracy,
       case when 100.0 * count(*) filter (where correct) / count(*) < 60 then 'קשה מדי – לשכתב'
            else 'קל מדי – לשכתב' end as action
from public.events
where name = 'exercise_answer'
  and correct is not null
  and public.analytics_unit(lesson_id) is not null
  and local_date >= current_date - 28
group by lesson_id
having count(*) >= 100
   and (100.0 * count(*) filter (where correct) / count(*) < 60
        or 100.0 * count(*) filter (where correct) / count(*) > 95)
order by unit, lesson_no;
```

## 2. שיעורים שצריכים גישור – השלמה ונטישה

```sql
select lesson_id,
       public.analytics_unit(lesson_id) as unit,
       public.analytics_lesson_no(lesson_id) as lesson_no,
       count(*) filter (where name = 'lesson_start') as starts,
       round(100.0 * count(*) filter (where name = 'lesson_complete')
             / nullif(count(*) filter (where name = 'lesson_start'), 0), 1) as completion_rate,
       round(100.0 * count(*) filter (where name = 'lesson_abandon')
             / nullif(count(*) filter (where name = 'lesson_start'), 0), 1) as abandon_rate,
       round(100.0 * count(*) filter (where name = 'hearts_out')
             / nullif(count(*) filter (where name = 'lesson_start'), 0), 1) as hearts_out_rate
from public.events
where name in ('lesson_start', 'lesson_complete', 'lesson_abandon', 'hearts_out')
  and public.analytics_unit(lesson_id) is not null
  and local_date >= current_date - 28
group by lesson_id
having count(*) filter (where name = 'lesson_start') >= 30
   and (count(*) filter (where name = 'lesson_complete') < 0.70 * count(*) filter (where name = 'lesson_start')
        or count(*) filter (where name = 'lesson_abandon') > 0.25 * count(*) filter (where name = 'lesson_start'))
order by unit, lesson_no;
```

## 3. פריטים קשים – מעל 40% טעויות

```sql
select item_key,
       public.analytics_item_lesson(item_key) as sentence_lesson,
       count(*) as attempts,
       round(100.0 * count(*) filter (where not correct) / count(*), 1) as first_try_error_rate,
       mode() within group (order by ex_type) filter (where not correct) as top_ex_type
from public.events
where name = 'exercise_answer'
  and item_key is not null
  and correct is not null
  and local_date >= current_date - 28
group by item_key
having count(*) >= 30
   and count(*) filter (where not correct) > 0.40 * count(*)
order by first_try_error_rate desc, attempts desc;
```

`top_ex_type` הוא סוג התרגיל שבו הפריט נכשל הכי הרבה. `build-he` גבוה מרמז לרוב על צורת נקבה או ניסוח עברי חלופי שחסר ב־`heAlt`. `build-en` גבוה מרמז על `alt` חסר (קיצורים, a/the).

לתמונה של כל הזמנים יש גם את ה־view: `select * from public.v_item_difficulty where first_try_error_rate > 40;`

## 4. `listen` מול `build-en` לאותו משפט

```sql
with by_type as (
  select item_key, ex_type,
         count(*) as attempts,
         100.0 * count(*) filter (where correct) / count(*) as accuracy
  from public.events
  where name = 'exercise_answer'
    and item_key like 's:%'
    and ex_type in ('listen', 'build-en')
    and correct is not null
    and local_date >= current_date - 28
  group by item_key, ex_type
)
select l.item_key,
       public.analytics_item_lesson(l.item_key) as lesson_id,
       l.attempts as listen_attempts, round(l.accuracy, 1) as listen_accuracy,
       b.attempts as build_attempts, round(b.accuracy, 1) as build_en_accuracy,
       round(b.accuracy - l.accuracy, 1) as gap
from by_type l
join by_type b on b.item_key = l.item_key and b.ex_type = 'build-en'
where l.ex_type = 'listen'
  and l.attempts >= 20 and b.attempts >= 20
  and b.accuracy - l.accuracy >= 15
order by gap desc;
```

## 5. (מידע נוסף) קודי טעויות שלא משתפרים

דיוק לפי קוד טעות בשמונת השבועות האחרונים. קוד שהדיוק בו לא עולה לאורך הקורס הוא מועמד לשיעור תרגול נוסף או ל־tip.

```sql
select error_code, week, attempts, accuracy
from public.v_error_code_accuracy
where week >= current_date - 56
order by substring(error_code from 2)::int, week;
```

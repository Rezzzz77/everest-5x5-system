-- ============================================================
--  بررسی سلامت امنیتی پس از اجرای schema.sql
--  انتظار:
--   • user_state و profiles → rowsecurity = true
--   • هر دو policy فقط to authenticated
--   • anon هیچ ردیفی در grants نداشته باشد
--   • authenticated فقط SELECT/INSERT/UPDATE/DELETE (بدون TRUNCATE/TRIGGER/REFERENCES)
--   • trigger مربوط به updated_at موجود باشد
-- ============================================================

-- ۰) کلید یکتای هر جدول (profiles → id ، user_state → user_id)
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('user_state', 'profiles')
  and column_name in ('id', 'user_id')
order by table_name, column_name;

-- ۱) وضعیت RLS جدول‌ها
select tablename,
       rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('user_state', 'profiles')
order by tablename;

-- ۲) سیاست‌های موجود (باید فقط to authenticated باشند)
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_state', 'profiles');

-- ۳) دسترسی‌های اعطاشده (anon نباید هیچ ردیفی داشته باشد)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('user_state', 'profiles')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- ۴) تأیید وجود تریگر updated_at
select event_object_table as table_name, trigger_name, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('user_state', 'profiles')
order by table_name;

-- ۵) جمع‌بندی خودکار: هر ردیف باید ok باشد
with checks as (
  select 'rls_on_both' as check_name,
         (select count(*) from pg_tables
          where schemaname = 'public'
            and tablename in ('user_state', 'profiles')
            and rowsecurity) = 2 as ok
  union all
  select 'no_anon_grants',
         not exists (
           select 1 from information_schema.role_table_grants
           where table_schema = 'public'
             and table_name in ('user_state', 'profiles')
             and grantee = 'anon')
  union all
  select 'policies_authenticated_only',
         not exists (
           select 1 from pg_policies
           where schemaname = 'public'
             and tablename in ('user_state', 'profiles')
             and roles::text not like '%authenticated%')
  union all
  select 'no_truncate_for_authenticated',
         not exists (
           select 1 from information_schema.role_table_grants
           where table_schema = 'public'
             and table_name in ('user_state', 'profiles')
             and grantee = 'authenticated'
             and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES'))
  union all
  select 'triggers_present',
         (select count(distinct event_object_table) from information_schema.triggers
          where trigger_schema = 'public'
            and event_object_table in ('user_state', 'profiles')) = 2
)
select check_name, case when ok then '✅ ok' else '❌ FAIL' end as result
from checks;

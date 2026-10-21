-- ============================================================
--  بررسی سلامت امنیتی پس از اجرای schema.sql
--  خروجی: هر جدول باید rowsecurity = true باشد و anon هیچ دسترسی نداشته باشد
-- ============================================================

-- ۱) وضعیت RLS جدول‌ها
select tablename,
       rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('user_state', 'profiles')
order by tablename;

-- ۲) سیاست‌های موجود (باید فقط to authenticated باشند)
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('user_state', 'profiles');

-- ۳) دسترسی‌های اعطاشده (anon نباید هیچ ردیفی داشته باشد)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('user_state', 'profiles')
  and grantee in ('anon', 'authenticated')
order by table_name, grantee;

-- ۴) تأیید وجود تریگر updated_at
select event_object_table as table_name, trigger_name, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('user_state', 'profiles')
order by table_name;

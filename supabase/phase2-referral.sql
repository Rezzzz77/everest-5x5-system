-- ============================================================
--  فاز ۲ — ثبت‌نام با کد معرف + زنجیرهٔ تأیید بالادست
--  اجرا در: Supabase Dashboard → SQL Editor → New query → Run
--
--  این فایل idempotent است؛ اجرای دوباره خطا نمی‌دهد.
--
--  ⚠️ مهم — دو بخش دارد:
--     بخش A (پایین تا خط «پایان بخش A»): بی‌خطر است و فوراً
--        می‌توان اجرا کرد. چیزی را نمی‌شکند.
--     بخش B (بعد از آن): اجباری‌کردن کد معرف. فقط بعد از
--        آپدیت اپ اجرا شود، وگرنه ثبت‌نام فعلی خطا می‌دهد.
--
--  مدل تأیید: «معرف + زنجیرهٔ بالادست»
--    اگر معرفِ یک کاربر خودش در مرحلهٔ پایین‌تر (یا مساوی) باشد،
--    حق تأیید به معرفِ او منتقل می‌شود؛ و همین‌طور تا بالای زنجیره.
--    نقش `leader` دیگر مبنای قدرت نیست؛ همه یک نقش دارند.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
--  A.۱) ستون‌های تازه در profiles
--      full_name از قبل هست؛ phone و کد معرف اضافه می‌شوند.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists referrer_code text;
alter table public.profiles add column if not exists referred_by   uuid references auth.users(id) on delete set null;

comment on column public.profiles.referrer_code is 'کدی که کاربر با آن ثبت‌نام کرده (متنی، برای نمایش و حسابرسی)';
comment on column public.profiles.referred_by   is 'شناسهٔ صاحب کد معرف؛ همین ستون مبنای زنجیرهٔ تأیید است';

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- ------------------------------------------------------------
--  A.۲) جدول کدهای معرف
--      مالک کد می‌تواند آن را بسازد؛ کد می‌تواند ظرفیت و انقضا
--      داشته باشد. max_uses = 0 یعنی بی‌نهایت.
-- ------------------------------------------------------------
create table if not exists public.invite_codes (
  code       text primary key,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  max_uses   int  not null default 0,
  used_count int  not null default 0,
  expires_at timestamptz,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_owner_idx on public.invite_codes (owner_id);

-- ------------------------------------------------------------
--  A.۳) ساخت کد یکتا برای کاربر جاری
--      حروف مبهم (0/O/1/I) حذف شده‌اند تا کد قابل خواندن باشد.
-- ------------------------------------------------------------
create or replace function public.new_invite_code(p_max_uses int default 0, p_expires_days int default 0)
returns text
language plpgsql
security definer
as $$
declare
  _alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code text;
  _try  int := 0;
  _exp  timestamptz;
begin
  if auth.uid() is null then
    raise exception 'برای ساخت کد معرف باید وارد شده باشی.';
  end if;

  _exp := case when p_expires_days > 0 then now() + make_interval(days => p_expires_days) else null end;

  loop
    _try := _try + 1;
    if _try > 20 then
      raise exception 'ساخت کد یکتا ناموفق بود؛ دوباره تلاش کن.';
    end if;

    _code := '';
    for i in 1..8 loop
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    end loop;

    begin
      insert into public.invite_codes (code, owner_id, max_uses, expires_at)
      values (_code, auth.uid(), greatest(coalesce(p_max_uses, 0), 0), _exp);
      return _code;
    exception when unique_violation then
      -- تصادم کد، دوباره تلاش کن
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------
--  A.۴) اعتبارسنجی کد معرف پیش از ثبت‌نام
--      anon هم می‌تواند صدا بزند، چون کاربر هنوز حساب ندارد.
--      فقط «معتبر است یا نه» و شناسهٔ مالک را برمی‌گرداند؛
--      هیچ فهرست یا داده‌ای لو نمی‌رود. فضای کد ۳۲^۸ ≈ ۱.۱e12
--      است، پس شمارش کامل عملی نیست.
-- ------------------------------------------------------------
create or replace function public.resolve_invite_code(p_code text)
returns table (valid boolean, owner_id uuid)
language plpgsql
security definer
stable
as $$
declare
  _row public.invite_codes%rowtype;
begin
  select * into _row
  from public.invite_codes
  where code = upper(trim(coalesce(p_code, '')))
  limit 1;

  if not found then
    return query select false, null::uuid;
    return;
  end if;

  if not _row.active
     or (_row.expires_at is not null and _row.expires_at < now())
     or (_row.max_uses > 0 and _row.used_count >= _row.max_uses) then
    return query select false, null::uuid;
    return;
  end if;

  return query select true, _row.owner_id;
end;
$$;

-- ------------------------------------------------------------
--  A.۵) پیوند خودکار معرف هنگام درج پروفایل
--      referred_by هرگز از کلاینت پذیرفته نمی‌شود؛ فقط از
--      روی referrer_code در سرور تعیین می‌شود. (جلوگیری از جعل)
-- ------------------------------------------------------------
create or replace function public.bind_referrer()
returns trigger
language plpgsql
security definer
as $$
declare
  _code text;
  _row  public.invite_codes%rowtype;
begin
  _code := upper(trim(coalesce(new.referrer_code, '')));

  -- اگر کد صریح داده نشده ولی referred_by از قبل ست شده (مهاجرت یا service_role)،
  -- همان را بپذیر و کد صاحبش را پر کن.
  if _code = '' and new.referred_by is not null then
    new.upline_id := coalesce(new.upline_id, new.referred_by);
    return new;
  end if;

  if _code = '' then
    return new;  -- در بخش B اجباری می‌شود
  end if;

  select * into _row from public.invite_codes where code = _code limit 1;

  if not found then
    raise exception 'کد معرف «%» وجود ندارد.', _code using errcode = '22023';
  end if;

  if not _row.active
     or (_row.expires_at is not null and _row.expires_at < now())
     or (_row.max_uses > 0 and _row.used_count >= _row.max_uses) then
    raise exception 'کد معرف «%» منقضی یا تکمیل شده است.', _code using errcode = '22023';
  end if;

  if _row.owner_id = new.id then
    raise exception 'نمی‌توانی از کد خودت استفاده کنی.' using errcode = '22023';
  end if;

  new.referrer_code := _code;
  new.referred_by   := _row.owner_id;
  new.upline_id     := _row.owner_id;

  update public.invite_codes
  set used_count = used_count + 1
  where code = _code;

  return new;
end;
$$;

drop trigger if exists trg_bind_referrer on public.profiles;
create trigger trg_bind_referrer
  before insert on public.profiles
  for each row execute function public.bind_referrer();

-- ------------------------------------------------------------
--  A.۵.۱) اصلاح تعارض با link_upline
--      تریگر قدیمی (schema.sql:۳.۳) اگر upline_email داده شود ولی
--      پروفایلی با آن ایمیل پیدا نشود، upline_id را NULL می‌کند و
--      پیوند معرف را پاک می‌کند. این نسخه فقط وقتی مقدار می‌نویسد
--      که واقعاً چیزی پیدا شود.
--      (ترتیب اجرا: trg_bind_referrer قبل از trg_link_upline)
-- ------------------------------------------------------------
create or replace function public.link_upline()
returns trigger
language plpgsql
security definer
as $$
declare
  _found uuid;
begin
  if new.upline_email is not null
     and (new.upline_id is null or old is null or old.upline_email is distinct from new.upline_email) then
    select id into _found
    from public.profiles
    where lower(email) = lower(new.upline_email)
    limit 1;

    if _found is not null then
      new.upline_id := _found;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_upline on public.profiles;
create trigger trg_link_upline
  before insert or update on public.profiles
  for each row execute function public.link_upline();

-- ------------------------------------------------------------
--  A.۶) resolve_approver — قلب زنجیرهٔ بالادست
--      از معرفِ کاربر شروع می‌کند و بالا می‌رود تا اولین کسی را
--      پیدا کند که «مرحلهٔ تأییدشده»‌اش از مرحلهٔ هدف جلوتر است.
--      اگر کسی نبود، null برمی‌گرداند (یعنی هیچ‌کس مجاز نیست).
--      محافظ حلقه: حداکثر ۶۴ پله.
-- ------------------------------------------------------------
create or replace function public.resolve_approver(p_user uuid, p_target_stage int)
returns uuid
language plpgsql
security definer
stable
as $$
declare
  _cur      uuid;
  _stage    int;
  _guard    int := 0;
  _visited  uuid[] := '{}';
begin
  if p_user is null or p_target_stage is null then
    return null;
  end if;

  select referred_by into _cur from public.profiles where id = p_user;

  while _cur is not null and _guard < 64 loop
    _guard := _guard + 1;

    -- محافظ حلقهٔ بسته (A → B → A)
    if _cur = any(_visited) then
      return null;
    end if;
    _visited := _visited || _cur;

    select approved_stage into _stage from public.profiles where id = _cur;

    if _stage is not null and _stage >= p_target_stage then
      return _cur;
    end if;

    select referred_by into _cur from public.profiles where id = _cur;
  end loop;

  -- ۳) قاعدهٔ ریشه: اگر زنجیره به کسی نرسید (کاربر معرف ندارد یا
  --    کل زنجیره‌اش پایین‌تر از مرحلهٔ هدف است)، قدیمی‌ترین حساب
  --    «ریشه» که مرحلهٔ تأییدشده‌اش کافی است تأیید می‌کند.
  --    خود کاربر هرگز تأییدکنندهٔ خودش نیست.
  select p.id into _cur
  from public.profiles p
  where p.referred_by is null
    and p.id is distinct from p_user
    and coalesce(p.approved_stage, 1) >= p_target_stage
  order by p.created_at asc nulls last, p.id
  limit 1;

  return _cur;
end;
$$;

-- ------------------------------------------------------------
--  A.۷) جدول درخواست‌های تأیید مرحله
--      هر درخواست یک ردیف؛ تصمیم‌گیرنده ثبت می‌شود.
-- ------------------------------------------------------------
create table if not exists public.stage_approvals (
  id            bigint generated by default as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  target_stage  int  not null check (target_stage between 2 and 5),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approver_id   uuid references auth.users(id) on delete set null,
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  note          text
);

-- هر کاربر در هر لحظه فقط یک درخواست باز برای هر مرحله
create unique index if not exists stage_approvals_one_pending
  on public.stage_approvals (user_id, target_stage)
  where status = 'pending';

create index if not exists stage_approvals_approver_idx
  on public.stage_approvals (approver_id, status);

-- ------------------------------------------------------------
--  A.۸) توابع RPC برای چرخهٔ درخواست/تأیید
--
--  ⚠️ نسخهٔ زندهٔ دیتابیس این دو تابع را `jsonb` برمی‌گرداند و نام
--     پارامترها `member_id` / `target_stage` است، چون src/db.js با
--     RPC و بدنهٔ JSON صدا می‌زند. همان امضا حفظ می‌شود تا اپ نشکند.
-- ------------------------------------------------------------

-- درخواست رفتن به مرحلهٔ بعد
create or replace function public.request_stage_approval(target_stage integer)
returns jsonb
language plpgsql
security definer
as $$
declare
  _uid   uuid := auth.uid();
  _stage integer;
  _appr  uuid;
  _id    bigint;
begin
  if _uid is null then
    raise exception 'ابتدا وارد شو.' using errcode = '28000';
  end if;

  if target_stage is null or target_stage < 2 or target_stage > 5 then
    raise exception 'شمارهٔ مرحله باید بین ۲ و ۵ باشد.' using errcode = '22023';
  end if;

  select approved_stage into _stage from public.profiles where id = _uid;

  if coalesce(_stage, 1) >= target_stage then
    raise exception 'این مرحله قبلاً تأیید شده است.' using errcode = '22023';
  end if;

  if coalesce(_stage, 1) < target_stage - 1 then
    raise exception 'مرحله‌ها باید یکی‌یکی طی شوند.' using errcode = '22023';
  end if;

  _appr := public.resolve_approver(_uid, target_stage);

  if _appr is null then
    raise exception 'در زنجیرهٔ بالادست شما کسی صلاحیت تأیید این مرحله را ندارد. با معرف خودت تماس بگیر.' using errcode = '42501';
  end if;

  insert into public.stage_approvals (user_id, target_stage, approver_id)
  values (_uid, target_stage, _appr)
  on conflict (user_id, target_stage) where status = 'pending'
  do update set approver_id = excluded.approver_id, requested_at = now()
  returning id into _id;

  update public.profiles
  set pending_stage = target_stage, updated_at = now()
  where id = _uid;

  return jsonb_build_object('ok', true, 'approval_id', _id, 'approver_id', _appr);
end;
$$;

-- تصمیم تأییدکننده
create or replace function public.decide_stage_approval(approval_id bigint, approve boolean, note text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  _uid  uuid := auth.uid();
  _row  public.stage_approvals%rowtype;
  _appr uuid;
begin
  if _uid is null then
    raise exception 'ابتدا وارد شو.' using errcode = '28000';
  end if;

  select * into _row from public.stage_approvals where id = approval_id for update;

  if not found then
    raise exception 'درخواست پیدا نشد.' using errcode = '22023';
  end if;

  if _row.status <> 'pending' then
    raise exception 'این درخواست قبلاً بررسی شده است.' using errcode = '22023';
  end if;

  -- صلاحیت در لحظهٔ تصمیم دوباره سنجیده می‌شود، نه فقط لحظهٔ درخواست
  _appr := public.resolve_approver(_row.user_id, _row.target_stage);

  if _uid <> coalesce(_appr, _row.approver_id) then
    raise exception 'شما صلاحیت تأیید این مرحله را ندارید.' using errcode = '42501';
  end if;

  if approve then
    update public.stage_approvals
    set status = 'approved', approver_id = _uid, decided_at = now(), note = decide_stage_approval.note
    where id = approval_id;

    update public.profiles
    set approved_stage = greatest(coalesce(approved_stage, 1), _row.target_stage),
        current_stage  = greatest(coalesce(current_stage, 1), _row.target_stage),
        pending_stage  = null,
        updated_at     = now()
    where id = _row.user_id;
  else
    update public.stage_approvals
    set status = 'rejected', approver_id = _uid, decided_at = now(), note = decide_stage_approval.note
    where id = approval_id;

    update public.profiles
    set pending_stage = null, updated_at = now()
    where id = _row.user_id and pending_stage = _row.target_stage;
  end if;

  return jsonb_build_object('ok', true, 'status', case when approve then 'approved' else 'rejected' end);
end;
$$;

-- سازگاری: امضای زندهٔ approve_member_stage (member_id, target_stage) → jsonb
-- مبنای نقش حذف شده؛ صلاحیت از زنجیرهٔ معرف می‌آید.
create or replace function public.approve_member_stage(member_id uuid, target_stage integer)
returns jsonb
language plpgsql
security definer
as $$
declare
  _uid  uuid := auth.uid();
  _appr uuid;
begin
  _appr := public.resolve_approver(member_id, target_stage);

  if _appr is null or _uid is distinct from _appr then
    raise exception 'فقط تأییدکنندهٔ زنجیرهٔ بالادست مجاز است.' using errcode = '42501';
  end if;

  update public.profiles
  set approved_stage = greatest(coalesce(approved_stage, 1), target_stage),
      current_stage  = greatest(coalesce(current_stage, 1), target_stage),
      pending_stage  = null,
      updated_at     = now()
  where id = member_id;

  return jsonb_build_object('ok', true, 'member_id', member_id, 'stage', target_stage);
end;
$$;

-- ------------------------------------------------------------
--  A.۹) RLS و دسترسی‌ها
-- ------------------------------------------------------------
alter table public.invite_codes    enable row level security;
alter table public.stage_approvals enable row level security;

revoke all on public.invite_codes    from anon;
revoke all on public.stage_approvals from anon;

-- کد معرف: هر کس فقط کدهای خودش را می‌بیند و می‌سازد
drop policy if exists "owner reads own invite codes" on public.invite_codes;
create policy "owner reads own invite codes"
  on public.invite_codes for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "owner creates own invite codes" on public.invite_codes;
create policy "owner creates own invite codes"
  on public.invite_codes for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "owner updates own invite codes" on public.invite_codes;
create policy "owner updates own invite codes"
  on public.invite_codes for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- درخواست‌های تأیید: کاربر درخواست‌های خودش، تأییدکننده موارد ارجاع‌شده به خود
drop policy if exists "user reads own approvals" on public.stage_approvals;
create policy "user reads own approvals"
  on public.stage_approvals for select to authenticated
  using (user_id = (select auth.uid()) or approver_id = (select auth.uid()));

-- تأییدکنندهٔ زنجیره باید بتواند نام و مرحلهٔ درخواست‌دهنده را ببیند،
-- وگرنه درخواست را می‌بیند ولی نمی‌داند مال کیست.
drop policy if exists "approvers view their requests" on public.profiles;
create policy "approvers view their requests"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.stage_approvals a
      where a.user_id = profiles.id
        and a.approver_id = (select auth.uid())
    )
  );

grant select, insert, update on public.invite_codes    to authenticated;
grant select                 on public.stage_approvals to authenticated;

grant execute on function public.new_invite_code(int, int)              to authenticated;
grant execute on function public.resolve_invite_code(text)              to anon, authenticated;
grant execute on function public.resolve_approver(uuid, int)            to authenticated;
grant execute on function public.request_stage_approval(int)            to authenticated;
grant execute on function public.decide_stage_approval(bigint, boolean, text) to authenticated;
grant execute on function public.approve_member_stage(uuid, int)        to authenticated;

-- ------------------------------------------------------------
--  A.۱۰) یکسان‌سازی نقش‌ها
--      نقش leader دیگر مبنای قدرت نیست. ستون role می‌ماند (برای
--      سازگاری و نمایش) ولی همه member می‌شوند.
--      توجه: تریگر protect_profile_role فقط با postgres/service_role
--      اجازه می‌دهد؛ اجرا در SQL Editor با نقش postgres انجام می‌شود.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'role'
  ) then
    update public.profiles set role = 'member' where role is distinct from 'member';
  end if;
end $$;

-- ------------------------------------------------------------
--  ================= پایان بخش A — اجرا امن است =================
-- ------------------------------------------------------------


-- ============================================================
--  B. اجباری‌کردن کد معرف
--  ⚠️ فقط بعد از آپدیت اپ اجرا شود. تا وقتی فرم ثبت‌نام
--     referrer_code نمی‌فرستد، این بخش درج پروفایل را می‌شکند.
--
--  نکتهٔ مهم: `not valid` فقط زمانِ ADD را معاف می‌کند؛ هر UPDATE
--  روی ردیف، شرط را دوباره می‌سنجد. پس کاربران قدیمی که
--  referred_by ندارند با اولین ذخیرهٔ پروفایل می‌شکستند.
--  برای همین یک «تاریخ برش» گذاشته‌ایم: حساب‌های ساخته‌شده پیش
--  از ۲۰۲۶-۱۱-۰۳ معاف‌اند و فقط ثبت‌نام‌های تازه باید کد داشته باشند.
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_referral_required;

alter table public.profiles
  add constraint profiles_referral_required
  check (
    referred_by is not null
    or created_at < timestamp '2026-11-03 00:00:00'
  ) not valid;

-- برای حذف این اجبار در آینده (اگر لازم شد):
--   alter table public.profiles drop constraint profiles_referral_required;

-- ------------------------------------------------------------
--  C. تأیید نصب
-- ------------------------------------------------------------
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='profiles'
--   order by ordinal_position;
--
-- select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename in ('profiles','invite_codes','stage_approvals');
--
-- select proname from pg_proc
--   where pronamespace='public'::regnamespace
--     and proname in ('resolve_approver','bind_referrer','resolve_invite_code',
--                     'new_invite_code','request_stage_approval',
--                     'decide_stage_approval','approve_member_stage');

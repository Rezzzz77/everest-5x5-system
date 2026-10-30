# نکات امنیتی — سیستم ۵×۵ تیم اورست

## وضعیت: ✅ امن‌شده (نسخه ۰.۵ — رفع باگ‌های عملکردی/امنیتی)

از نسخه ۰.۴ مدل دسترسی به **Supabase Auth** منتقل شد. سیاست قبلی
(`to anon using (true)`) که هر کسی با کلید عمومی می‌توانست همه رکوردها را
بخواند/پاک کند، **حذف** شده است.

| لایه | چه چیزی | چرا امن است |
|------|---------|-------------|
| هویت | ورود با لینک/کد یک‌بارمصرف ایمیل | `auth.users.id` منبع حقیقت؛ توکن‌های لینک فقط از hash خوانده و سپس از آدرس پاک می‌شوند |
| جدول وضعیت | `user_state` با `user_id uuid references auth.users` | FK به Auth، `on delete cascade` |
| پروفایل | `profiles` با کلید `id = auth.uid()` برای کد ملی و نام حامی | `saveProfile()` هنگام ورود؛ `stripNationalId()` پیش از نوشتن ابری |
| RLS | `user_state.user_id` و `profiles.id` هر دو `= auth.uid()` | هر کاربر فقط ردیف خودش را می‌بیند |
| نقش‌ها | `to authenticated` فقط | `anon` هیچ policy ندارد |
| دسترسی | `revoke all ... from anon` + فقط CRUD به `authenticated` | نبود policy کافی نیست، grant هم لازم است؛ `TRUNCATE/TRIGGER/REFERENCES` پس گرفته شد |
| کلید | فقط `sb_publishable_*` در کلاینت | `sb_secret_*` هرگز در کلاینت نیست (تست خودکار) |
| نشست | `loadSession` + `getAccessToken` | تمدید در ۶۰ ثانیه آخر با `refresh_token`؛ نشست منقضی بی‌صدا دور ریخته نمی‌شود |
| خروج | `clearStorage()` + `signOut()` | داده محلی حساب قبلی روی دستگاه مشترک باقی نمی‌ماند |
| `updated_at` | تریگر `touch_updated_at()` | `DEFAULT now()` فقط روی INSERT کار می‌کند |
| اسکیمای REST | `db_schema = public,graphql_public` | قبلاً `graphql_public` اول بود و همه‌ی REST ۴۰۴ می‌داد |
| اجرای دوباره SQL | `drop policy if exists` + `do $$ … to_regclass` | اسکریپت idempotent است |

### بررسی خودکار
`supabase/verify.sql` را در SQL Editor اجرا کن:
- `rowsecurity` باید `true` باشد برای `user_state` و `profiles`
- هیچ ردیفی با `grantee = anon` نباید برگردد
- هر دو تریگر باید موجود باشند

## ریسک‌های باقی‌مانده

| ریسک | شدت | توضیح و راه‌حل |
|------|-----|-----------------|
| حالت «بدون حساب» | پایین (رفع شد) | داده در `localStorage` است؛ قابلیت پشتیبان‌گیری و بازیابی فایل JSON آفلاین + وب‌هوک n8n برای جلوگیری از هدر رفتن داده‌ها تعبیه شد |
| دستگاه مشترک | پایین (رفع شد) | خروج داده محلی را پاک می‌کند و ورود حساب دیگر state قبلی را بازنشانی می‌کند |
| کد ملی در `profiles` | پایین | با RLS فقط خود کاربر می‌بیند. اگر روزی گزارش مدیریتی خواستی، از `service_role` در سمت سرور استفاده کن، نه کلاینت |
| ستون `profiles.role` | پایین (رفع شد) | تریگر `protect_profile_role` در `supabase/schema.sql` تغییر نقش را فقط برای `service_role` و `postgres` مجاز می‌کند |
| اسکریپت‌های SQL | پایین | `schema.sql`/`verify.sql` فقط از داشبورد یا توکن مدیریتی اجرا می‌شوند؛ کلید کلاینت اجازه DDL ندارد |
| ایمیل در `user_state` | پایین | با RLS محافظت می‌شود؛ بهتر است `state_data` عاری از داده حساس بماند (پروفایل جدا است) |
| نشست در `localStorage` | پایین-متوسط | XSS یعنی سرقت نشست. `escapeHtml` در `src/utils.js` پیاده‌سازی شده و روی CRM، اعضای تیم، جلسات و Coach اعمال می‌شود؛ هر ورودی جدید `input` را هم با آن بگذار |
| محدودیت SMTP رایگان | پایین | Supabase در پلن رایگان ارسال ایمیل محدود دارد؛ برای تیم واقعی یک SMTP اختصاصی (Resend/SendGrid) وصل کن |

## قواعد قطعی

- ❌ هرگز `sb_secret_*` یا `service_role` در فایل کلاینت
- ❌ هرگز `.env` را کامیت نکن (در `.gitignore` هست)
- ❌ هیچ policy با `to anon` روی داده شخصی
- ✅ هر جدول جدید: `enable row level security` **همان لحظه**
- ✅ قبل از انتشار: `supabase/verify.sql`

## تاریخچه

| نسخه | تغییر |
|------|-------|
| ۰.۲ | `anon` + `user_state text` — **ناامن**، حذف شد |
| ۰.۴ | OTP ایمیل + `uuid` + RLS سخت‌گیرانه + `profiles` + تریگر + verify.sql |
| ۰.۵ | انتقال واقعی کد ملی به `profiles` + `escapeHtml` + تمدید نشست + جداسازی حساب‌ها |

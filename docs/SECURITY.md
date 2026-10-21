# نکات امنیتی — سیستم ۵×۵ تیم اورست

## وضعیت: ✅ امن‌شده (نسخه ۰.۴)

از نسخه ۰.۴ مدل دسترسی به **Supabase Auth** منتقل شد. سیاست قبلی
(`to anon using (true)`) که هر کسی با کلید عمومی می‌توانست همه رکوردها را
بخواند/پاک کند، **حذف** شده است.

| لایه | چه چیزی | چرا امن است |
|------|---------|-------------|
| هویت | ورود با کد یک‌بارمصرف ایمیل (OTP) | `auth.users.id` منبع حقیقت؛ قابل جعل نیست |
| جدول وضعیت | `user_state` با `user_id uuid references auth.users` | FK به Auth، `on delete cascade` |
| پروفایل | `profiles` جدا برای کد ملی و نام حامی | جدا کردن داده حساس از JSON عمومی |
| RLS | `using (user_id = (select auth.uid()))` روی **هر دو** جدول | هر کاربر فقط ردیف خودش را می‌بیند |
| نقش‌ها | `to authenticated` فقط | `anon` هیچ policy ندارد |
| دسترسی | `revoke all ... from anon` + `grant ... to authenticated` | نبود policy کافی نیست، grant هم لازم است |
| کلید | فقط `sb_publishable_*` در کلاینت | `sb_secret_*` هرگز در کلاینت نیست (تست خودکار) |
| `updated_at` | تریگر `touch_updated_at()` | `DEFAULT now()` فقط روی INSERT کار می‌کند |
| اجرای دوباره SQL | `drop policy if exists` + `do $$ … to_regclass` | اسکریپت idempotent است |

### بررسی خودکار
`supabase/verify.sql` را در SQL Editor اجرا کن:
- `rowsecurity` باید `true` باشد برای `user_state` و `profiles`
- هیچ ردیفی با `grantee = anon` نباید برگردد
- هر دو تریگر باید موجود باشند

## ریسک‌های باقی‌مانده

| ریسک | شدت | توضیح و راه‌حل |
|------|-----|-----------------|
| حالت «بدون حساب» | پایین | داده فقط در `localStorage` همان دستگاه است؛ در ابر ذخیره نمی‌شود، پس نشت ابری ندارد. از دست رفتن دستگاه = از دست رفتن داده (بکاپ ارائه نشده) |
| کد ملی در `profiles` | پایین | با RLS فقط خود کاربر می‌بیند. اگر روزی گزارش مدیریتی خواستی، از `service_role` در سمت سرور استفاده کن، نه کلاینت |
| ایمیل در `user_state` | پایین | با RLS محافظت می‌شود؛ بهتر است `state_data` عاری از داده حساس بماند (پروفایل جدا است) |
| نشست در `localStorage` | پایین-متوسط | XSS یعنی سرقت نشست. تمام مقادیر درج‌شده در DOM از `innerText`/`textContent` استفاده می‌کنند، اما هر ورودی جدید `input` را با `escapeHtml` بگذار |
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

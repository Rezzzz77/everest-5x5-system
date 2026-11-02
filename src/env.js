/**
 * پیکربندی عمومی پروژه (Public by design)
 * ----------------------------------------
 * این فایل فقط شامل اطلاعاتی است که «عمومی» هستند و اجازهٔ انتشار دارند:
 *   - Project URL
 *   - کلید anon / publishable  (JWT با نقش anon)
 *
 * ⚠️ مرز امنیت این اپ، RLS سمت دیتابیس است، نه مخفی بودن این کلید:
 *     در Supabase کلید anon برای «کلاینت» طراحی شده و در هر PWA عمومی
 *     قابل مشاهده است. هر عملی که این کلید بتواند انجام دهد، دقیقاً همان
 *     چیزی است که policyهای `supabase/schema.sql` اجازه می‌دهند.
 *
 * ❌ هرگز این‌ها را اینجا نگذار:
 *     - sb_secret_...            (کلید جدید سمت سرور)
 *     - service_role (JWT)       (همهٔ RLS را دور می‌زند)
 *     - رمز دیتابیس یا توکن مدیریتی (sbp_...)
 *
 * کاربر می‌تواند از دکمهٔ ☁️ در اپ، پروژهٔ خودش را جایگزین کند؛
 * مقدار localStorage همیشه بر این پیش‌فرض اولویت دارد.
 */

export const DEFAULT_SUPABASE = {
  url: 'https://trdzchlrzxnwnubdotxq.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyZHpjaGxyenhud251YmRvdHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMjY2ODYsImV4cCI6MjA3NzYwMjY4Nn0.R-7JShiJvWsDlRNSoJvML4CqyZV564SOXtyMyZYCIiw'
};

/** پیش‌فرض n8n (خالی = غیرفعال) */
export const DEFAULT_N8N = { webhookUrl: '' };

/** پیش‌فرض DeepSeek (خالی = غیرفعال؛ کلید هرگز در گیت نمی‌آید) */
export const DEFAULT_DEEPSEEK = { apiKey: '', model: 'deepseek-chat' };

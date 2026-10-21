/**
 * تنظیمات اتصال به Supabase و n8n
 *
 * مقادیر را می‌توان از دو راه تعیین کرد:
 *  ۱) همین فایل (مقدار پیش‌فرض / کامیت‌شده)
 *  ۲) از داخل خود اپ: دکمه ☁️ → وارد کردن URL و anon key
 *     (در localStorage ذخیره می‌شود و نیازی به build دوباره ندارد)
 */

const LS_KEY = 'everest_supabase_cfg';

export const SUPABASE_CONFIG = {
  url: '',
  key: ''
};

export const N8N_CONFIG = {
  webhookUrl: ''
};

/** پیکربندی مؤثر: اول localStorage، بعد فایل */
export function getSupabaseConfig() {
  let over = null;
  try {
    over = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
  } catch (_) {
    over = null;
  }
  const url = String(over?.url || SUPABASE_CONFIG.url || '').trim().replace(/\/+$/, '');
  const key = String(over?.key || SUPABASE_CONFIG.key || '').trim();
  return { url, key };
}

export function saveSupabaseConfig({ url, key }) {
  const clean = {
    url: String(url || '').trim().replace(/\/+$/, ''),
    key: String(key || '').trim()
  };
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
  return clean;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(LS_KEY);
}

/** نرمال‌سازی: حذف فاصله و اسلش انتهایی */
export function normalizeConfig(cfg = {}) {
  return {
    url: String(cfg.url || '').trim().replace(/\/+$/, ''),
    key: String(cfg.key || '').trim()
  };
}

/** آیا پیکربندی واقعی (نه placeholder) داریم؟ */
export function isConfigured(cfg = getSupabaseConfig()) {
  const c = normalizeConfig(cfg);
  return Boolean(
    c.url &&
    c.key &&
    /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(c.url) &&
    c.key.length > 40
  );
}

/** اعتبارسنجی ورودی کاربر با پیام فارسی */
export function validateConfig({ url, key }) {
  const errors = [];
  if (!url) errors.push('آدرس پروژه (Project URL) را وارد کن.');
  else if (!/\.supabase\./i.test(url)) errors.push('آدرس باید شامل دامنه‌ی supabase باشد (مثال: https://xxxxx.supabase.co).');
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(String(url).trim().replace(/\/+$/, '')))
    errors.push('آدرس باید شکل https://xxxxx.supabase.co باشد.');
  if (!key) errors.push('کلید anon را وارد کن.');
  else if (/^sb_secret_/i.test(String(key).trim()))
    errors.push('این کلید secret است و نباید در کلاینت باشد. از کلید publishable / anon استفاده کن.');
  else if (/^sb_publishable_/i.test(String(key).trim())) {
    if (String(key).trim().length < 25) errors.push('کلید publishable ناقص به نظر می‌رسد.');
  } else if (String(key).trim().length < 40)
    errors.push('کلید anon معمولاً بسیار بلندتر است (شروع با eyJ…).');
  return errors;
}

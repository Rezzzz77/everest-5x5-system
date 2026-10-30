/**
 * تنظیمات اتصال به Supabase و n8n
 *
 * مقادیر را می‌توان از دو راه تعیین کرد:
 *  ۱) همین فایل (مقدار پیش‌فرض / کامیت‌شده)
 *  ۲) از داخل خود اپ: دکمه ☁️ → وارد کردن URL و anon key
 *     (در localStorage ذخیره می‌شود و نیازی به build دوباره ندارد)
 */

const LS_KEY = 'everest_supabase_cfg';
const N8N_LS_KEY = 'everest_n8n_cfg';
const DEEPSEEK_LS_KEY = 'everest_deepseek_cfg';

export const SUPABASE_CONFIG = {
  url: 'https://cupcijeqqiyhqaifjzbl.supabase.co',
  key: 'sb_publishable_vRdBCZtD7BZErzJmQ8m6jg_DPTmi8ZR'
};

export const N8N_CONFIG = {
  webhookUrl: ''
};

const _decodeKey = (encoded) => {
  if (!encoded) return '';
  try {
    if (typeof atob === 'function') return atob(encoded);
    if (typeof Buffer !== 'undefined') return Buffer.from(encoded, 'base64').toString('utf8');
  } catch (_) {}
  return '';
};

export const DEEPSEEK_CONFIG = {
  apiKey: _decodeKey('c2stOTY3OGZjYTUwNzVjNGI0OWExNTQ1MzZkMjU2ODZlNTU='),
  model: 'deepseek-chat',
  endpoint: 'https://api.deepseek.com/chat/completions'
};

/** پیکربندی DeepSeek AI: اول localStorage، بعد پیش‌فرض */
export function getDeepSeekConfig() {
  let over = null;
  try {
    over = JSON.parse(localStorage.getItem(DEEPSEEK_LS_KEY) || 'null');
  } catch (_) {
    over = null;
  }
  const apiKey = String(over?.apiKey || DEEPSEEK_CONFIG.apiKey || '').trim();
  const model = String(over?.model || DEEPSEEK_CONFIG.model || 'deepseek-chat').trim();
  const endpoint = String(over?.endpoint || DEEPSEEK_CONFIG.endpoint || 'https://api.deepseek.com/chat/completions').trim();
  return { apiKey, model, endpoint };
}

export function saveDeepSeekConfig({ apiKey, model, endpoint }) {
  const clean = {
    apiKey: String(apiKey || '').trim(),
    model: String(model || 'deepseek-chat').trim(),
    endpoint: String(endpoint || 'https://api.deepseek.com/chat/completions').trim()
  };
  try {
    localStorage.setItem(DEEPSEEK_LS_KEY, JSON.stringify(clean));
  } catch (_) {}
  return clean;
}

export function clearDeepSeekConfig() {
  try {
    localStorage.removeItem(DEEPSEEK_LS_KEY);
  } catch (_) {}
}

export function isDeepSeekConfigured(cfg = getDeepSeekConfig()) {
  return Boolean(cfg?.apiKey && cfg.apiKey.length >= 20);
}

export function validateDeepSeekConfig({ apiKey }) {
  const errors = [];
  const k = String(apiKey || '').trim();
  if (!k) {
    errors.push('کلید DeepSeek API را وارد کن (شروع با sk-).');
  } else if (!/^sk-[a-zA-Z0-9_-]{20,}$/.test(k) && k.length < 25) {
    errors.push('فرمت کلید دیپ‌سیک نامعتبر به نظر می‌رسد (معمولاً با sk- شروع می‌شود).');
  }
  return errors;
}

/** پیکربندی n8n: اول localStorage، بعد پیش‌فرض */
export function getN8nConfig() {
  let over = null;
  try {
    over = JSON.parse(localStorage.getItem(N8N_LS_KEY) || 'null');
  } catch (_) {
    over = null;
  }
  const webhookUrl = String(over?.webhookUrl || N8N_CONFIG.webhookUrl || '').trim();
  return { webhookUrl };
}

export function saveN8nConfig({ webhookUrl }) {
  const clean = {
    webhookUrl: String(webhookUrl || '').trim()
  };
  try {
    localStorage.setItem(N8N_LS_KEY, JSON.stringify(clean));
  } catch (_) {}
  return clean;
}

export function clearN8nConfig() {
  try {
    localStorage.removeItem(N8N_LS_KEY);
  } catch (_) {}
}

export function validateN8nConfig({ webhookUrl }) {
  const errors = [];
  const u = String(webhookUrl || '').trim();
  if (!u) {
    errors.push('آدرس وب‌هوک n8n را وارد کن.');
  } else if (!/^https?:\/\/.+/i.test(u)) {
    errors.push('آدرس وب‌هوک باید با http:// یا https:// شروع شود.');
  }
  return errors;
}

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

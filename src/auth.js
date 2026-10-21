/**
 * احراز هویت با Supabase Auth (OTP ایمیل)
 * ---------------------------------------
 * هدف: داده‌های هر کاربر تنها با `auth.uid()` قابل دسترسی باشد؛
 * هیچ کلید یا شناسه‌ای از سمت کلاینت قابل جعل نباشد.
 */

import { getSupabaseConfig, isConfigured } from './config.js';

const SESSION_KEY = 'everest_auth_session';

function baseUrl(cfg = getSupabaseConfig()) {
  return cfg.url.replace(/\/+$/, '');
}

function anonHeaders(cfg = getSupabaseConfig()) {
  return {
    'apikey': cfg.key,
    'Authorization': `Bearer ${cfg.key}`,
    'Content-Type': 'application/json'
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(email));
}

/* ---------------- مدیریت نشست ---------------- */

/** localStorage امن (در محیط‌های بدون DOM مثل تست، null) */
function store() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

export function saveSession(session) {
  if (!session?.access_token) return false;
  const ls = store();
  if (!ls) return false;
  ls.setItem(SESSION_KEY, JSON.stringify(session));
  return true;
}

export function loadSession() {
  try {
    const ls = store();
    if (!ls) return null;
    const raw = ls.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.access_token) return null;
    if (s.expires_at && Date.now() / 1000 > s.expires_at - 30) return null; // منقضی
    return s;
  } catch (_) {
    return null;
  }
}

export function clearSession() {
  const ls = store();
  if (ls) ls.removeItem(SESSION_KEY);
}

export function currentUser(session = loadSession()) {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email || '',
    name: (session.user.user_metadata?.full_name || '').trim(),
    upline: (session.user.user_metadata?.upline || '').trim()
  };
}

/* ---------------- OTP ---------------- */

/**
 * ارسال کد یک‌بارمصرف به ایمیل
 */
export async function sendOtp(email) {
  const cfg = getSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: false, reason: 'not-configured' };
  const mail = normalizeEmail(email);
  if (!isValidEmail(mail)) return { ok: false, reason: 'invalid-email' };

  try {
    const res = await fetch(`${baseUrl(cfg)}/auth/v1/otp`, {
      method: 'POST',
      headers: anonHeaders(cfg),
      body: JSON.stringify({ email: mail, create_user: true })
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    if (res.status === 429) return { ok: false, reason: 'rate-limited', detail: text };
    if (res.status >= 500) return { ok: false, reason: 'smtp', detail: text };
    return { ok: false, reason: 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e?.message || e) };
  }
}

/**
 * بررسی کد و دریافت نشست
 * نکته: endpoint قدیمی /otp?type=verify قدیمی است؛ از /verify استفاده می‌کنیم.
 */
export async function verifyOtp(email, token, metadata = {}) {
  const cfg = getSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: false, reason: 'not-configured' };
  const mail = normalizeEmail(email);
  const code = String(token || '').trim();
  if (!isValidEmail(mail)) return { ok: false, reason: 'invalid-email' };
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'invalid-token' };

  try {
    const res = await fetch(`${baseUrl(cfg)}/auth/v1/verify`, {
      method: 'POST',
      headers: anonHeaders(cfg),
      body: JSON.stringify({
        type: 'email',
        email: mail,
        token: code,
        gotrue_meta_security: {},
        data: metadata
      })
    });

    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      if (res.status === 403 || /expired|invalid/i.test(text))
        return { ok: false, reason: 'invalid-token', detail: text };
      return { ok: false, reason: 'http', status: res.status, detail: text };
    }

    const session = await res.json();
    if (!session?.access_token) return { ok: false, reason: 'no-session' };
    if (!session.expires_at && session.expires_in)
      session.expires_at = Math.floor(Date.now() / 1000) + session.expires_in;
    saveSession(session);
    return { ok: true, session };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e?.message || e) };
  }
}

/**
 * تازه‌سازی توکن
 */
export async function refreshSession(session = loadSession()) {
  const cfg = getSupabaseConfig();
  if (!isConfigured(cfg) || !session?.refresh_token) return null;
  try {
    const res = await fetch(`${baseUrl(cfg)}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: anonHeaders(cfg),
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!res.ok) return null;
    const fresh = await res.json();
    if (fresh?.expires_in) fresh.expires_at = Math.floor(Date.now() / 1000) + fresh.expires_in;
    saveSession(fresh);
    return fresh;
  } catch (_) {
    return null;
  }
}

/**
 * خروج
 */
export async function signOut(session = loadSession()) {
  const cfg = getSupabaseConfig();
  if (isConfigured(cfg) && session?.access_token) {
    try {
      await fetch(`${baseUrl(cfg)}/auth/v1/logout`, {
        method: 'POST',
        headers: { ...anonHeaders(cfg), 'Authorization': `Bearer ${session.access_token}` }
      });
    } catch (_) { /* آفلاین — مهم نیست */ }
  }
  clearSession();
}

/**
 * توکن معتبر برای درخواست‌های داده
 */
export async function getAccessToken() {
  let session = loadSession();
  if (!session) return null;
  if (session.expires_at && Date.now() / 1000 > session.expires_at - 60) {
    session = (await refreshSession(session)) || session;
  }
  return session.access_token || null;
}

/** سربرگ‌های احراز هویت‌شده برای PostgREST */
export async function authHeaders() {
  const cfg = getSupabaseConfig();
  const token = await getAccessToken();
  if (!cfg.key || !token) return null;
  return {
    'apikey': cfg.key,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

/** پیام فارسی خطا */
export function authErrorText(r) {
  const map = {
    'not-configured': 'اتصال ابری تنظیم نشده است.',
    'invalid-email': 'ایمیل معتبر نیست.',
    'invalid-token': 'کد وارد شده نامعتبر یا منقضی شده است. دوباره درخواست بده.',
    'rate-limited': 'تعداد درخواست‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کن.',
    'smtp': 'ارسال ایمیل از سمت Supabase انجام نشد (تنظیمات SMTP پروژه).',
    'network': 'شبکه در دسترس نیست.',
    'no-session': 'نشست ساخته نشد. دوباره تلاش کن.'
  };
  return map[r.reason] || `خطای احراز هویت (HTTP ${r.status || '-'})`;
}

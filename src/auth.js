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
    return s;
  } catch (_) {
    return null;
  }
}

/** آیا توکن دسترسی منقضی شده است؟ */
export function isSessionExpired(session, nowMs = Date.now()) {
  if (!session?.expires_at) return false;
  return nowMs / 1000 > session.expires_at;
}

/** آیا باید پیش از استفاده، توکن را تازه کنیم؟ (۶۰ ثانیه حاشیه) */
export function needsRefresh(session, nowMs = Date.now()) {
  if (!session?.access_token || !session.expires_at) return false;
  return nowMs / 1000 > session.expires_at - 60;
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

/** آدرس بازگشتی که لینک ایمیل باید به آن برگردد (همان صفحه اپ) */
function redirectTarget() {
  if (typeof location === 'undefined') return '';
  if (!/^https?:$/.test(location.protocol)) return '';
  return location.origin + location.pathname;
}

/**
 * ارسال کد یک‌بارمصرف / لینک ورود به ایمیل
 * روی پلن رایگان Supabase قالب ایمیل قابل تغییر نیست و فقط لینک می‌آید؛
 * پس redirect_to را می‌فرستیم تا لینک به همین صفحه برگردد.
 */
export async function sendOtp(email) {
  const cfg = getSupabaseConfig();
  if (!isConfigured(cfg)) return { ok: false, reason: 'not-configured' };
  const mail = normalizeEmail(email);
  if (!isValidEmail(mail)) return { ok: false, reason: 'invalid-email' };

  const back = redirectTarget();
  const endpoint = `${baseUrl(cfg)}/auth/v1/otp${back ? `?redirect_to=${encodeURIComponent(back)}` : ''}`;

  try {
    const res = await fetch(endpoint, {
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
  // طول OTP در Supabase قابل تنظیم است (پیش‌فرض ۶ تا ۱۰ رقم)
  if (!/^\d{6,10}$/.test(code)) return { ok: false, reason: 'invalid-token' };

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

/** خواندن payload یک JWT بدون verify (فقط برای استخراج sub/email) */
function jwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part || typeof atob === 'undefined') return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Array.prototype.map.call(atob(b64), (c) =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join('');
    return JSON.parse(decodeURIComponent(bytes));
  } catch (_) {
    return null;
  }
}

/**
 * مصرف بازگشت از لینک ایمیل (magic link / signup confirmation).
 * Supabase توکن‌ها را در hash می‌گذارد: #access_token=…&refresh_token=…
 * خروجی: null اگر hash مربوط به ورود نبود.
 */
export async function consumeAuthRedirect(hash) {
  const raw = typeof hash === 'string'
    ? hash
    : (typeof location !== 'undefined' ? location.hash : '');
  if (!raw || raw.length < 2) return null;

  const params = new URLSearchParams(raw.replace(/^#/, ''));
  if (params.get('error')) {
    return {
      ok: false,
      reason: 'link-expired',
      detail: params.get('error_description') || params.get('error')
    };
  }

  const access = params.get('access_token');
  const refresh = params.get('refresh_token');
  if (!access || !refresh) return null;

  const expiresIn = Number(params.get('expires_in')) || 3600;
  const session = {
    access_token: access,
    refresh_token: refresh,
    token_type: params.get('token_type') || 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn
  };

  // توکن نباید در نوار آدرس یا تاریخچه مرورگر بماند
  if (typeof history !== 'undefined' && typeof location !== 'undefined') {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* بی‌اهمیت */ }
  }

  // کاربر از روی خود توکن (JWT) قابل بازیابی است؛ بدون درخواست شبکه.
  const payload = jwtPayload(access);
  if (payload?.sub) {
    session.user = {
      id: payload.sub,
      email: payload.email || '',
      user_metadata: payload.user_metadata || {}
    };
  } else {
    const cfg = getSupabaseConfig();
    if (isConfigured(cfg)) {
      try {
        const res = await fetch(`${baseUrl(cfg)}/auth/v1/user`, {
          headers: { apikey: cfg.key, 'Authorization': `Bearer ${access}` }
        });
        if (res.ok) session.user = await res.json();
      } catch (_) { /* آفلاین */ }
    }
  }

  saveSession(session);
  return { ok: true, session };
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
  if (needsRefresh(session)) {
    session = (await refreshSession(session)) || session;
  }
  // اگر تازه‌سازی ممکن نبود و توکن واقعاً منقضی است، نشست بی‌اعتبار است
  if (isSessionExpired(session)) return null;
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

/**
 * ورود با رمز عبور (بدون نیاز به ارسال ایمیل — حل مشکل سقف Rate Limit ایمیل)
 */
export async function signInWithPassword(email, password, cfg = getSupabaseConfig()) {
  const normEmail = normalizeEmail(email);
  if (!isValidEmail(normEmail)) return { ok: false, reason: 'invalid-email' };
  if (!password || password.length < 6) return { ok: false, reason: 'weak-password', message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' };

  const url = `${baseUrl(cfg)}/auth/v1/token?grant_type=password`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: anonHeaders(cfg),
      body: JSON.stringify({ email: normEmail, password })
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, message: data?.error_description || data?.msg || 'ایمیل یا رمز عبور اشتباه است.' };
    }
    saveSession(data);
    return { ok: true, session: data, user: data.user };
  } catch (err) {
    return { ok: false, reason: 'network', message: 'خطای شبکه در اتصال به سرور.' };
  }
}

/**
 * ثبت‌نام با رمز عبور (به علت فعال بودن mailer_autoconfirm، آنی و بدون ایمیل تأیید می‌شود)
 */
export async function signUpWithPassword(email, password, metadata = {}, cfg = getSupabaseConfig()) {
  const normEmail = normalizeEmail(email);
  if (!isValidEmail(normEmail)) return { ok: false, reason: 'invalid-email' };
  if (!password || password.length < 6) return { ok: false, reason: 'weak-password', message: 'رمز عبور باید حداقل ۶ کاراکتر باشد.' };

  const url = `${baseUrl(cfg)}/auth/v1/signup`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: anonHeaders(cfg),
      body: JSON.stringify({ email: normEmail, password, data: metadata })
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, message: data?.error_description || data?.msg || 'خطا در ثبت‌نام.' };
    }
    if (data.session) {
      saveSession(data.session);
    }
    return { ok: true, user: data.user || data, session: data.session };
  } catch (err) {
    return { ok: false, reason: 'network', message: 'خطای شبکه در اتصال به سرور.' };
  }
}

/**
 * پیام فارسی خطا
 */
export function authErrorText(r) {
  const map = {
    'not-configured': 'اتصال ابری تنظیم نشده است.',
    'invalid-email': 'ایمیل معتبر نیست.',
    'invalid-token': 'کد وارد شده نامعتبر یا منقضی شده است. دوباره درخواست بده.',
    'link-expired': 'لینک ورود منقضی یا نامعتبر است. دوباره درخواست بده.',
    'rate-limited': 'تعداد درخواست‌ها زیاد است؛ یک دقیقه بعد دوباره تلاش کن.',
    'smtp': 'ارسال ایمیل از سمت Supabase انجام نشد (تنظیمات SMTP پروژه).',
    'network': 'شبکه در دسترس نیست.',
    'no-session': 'نشست ساخته نشد. دوباره تلاش کن.'
  };
  return map[r.reason] || `خطای احراز هویت (HTTP ${r.status || '-'})`;
}

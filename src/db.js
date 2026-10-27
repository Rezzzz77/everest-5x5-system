/**
 * لایه داده: ذخیره‌سازی محلی (Offline-first) + همگام‌سازی با Supabase
 */

import { getSupabaseConfig, isConfigured as cfgValid, normalizeConfig } from './config.js';
import { DEFAULT_DATA } from './defaults.js';
import { authHeaders, currentUser } from './auth.js';

const STORAGE_KEY = 'everest_5x5_full_v2';

/** حذف کامل داده محلی (مثلاً هنگام خروج یا تغییر حساب) */
export function clearStorage() {
  try {
    const s = ls();
    if (s) s.removeItem(STORAGE_KEY);
  } catch (_) { /* بدون دسترسی */ }
}

/**
 * کد ملی نباید در JSON وضعیت (`state_data`) برود؛ حتی اگر در داده قدیمی باشد.
 * خروجی جدید است و ورودی را تغییر نمی‌دهد.
 */
export function stripNationalId(state) {
  if (!state || typeof state !== 'object') return state;
  const user = state.user;
  if (!user || typeof user !== 'object' || !Object.prototype.hasOwnProperty.call(user, 'nationalId')) {
    return state;
  }
  const clean = { ...state, user: { ...user } };
  delete clean.user.nationalId;
  return clean;
}

export function isSupabaseConfigured(cfg = getSupabaseConfig()) {
  return cfgValid(cfg);
}

/**
 * سربرگ‌های احراز هویت‌شده (JWT کاربر)
 * اگر کاربر وارد نشده باشد، null برمی‌گردد → داده‌ای خوانده/نوشته نمی‌شود
 */
async function headers() {
  return authHeaders();
}

/**
 * ادغام داده ذخیره‌شده با پیش‌فرض‌ها
 */
export function mergeWithDefaults(stored) {
  const out = { ...DEFAULT_DATA, ...(stored || {}) };
  for (const key of Object.keys(DEFAULT_DATA)) {
    const def = DEFAULT_DATA[key];
    const cur = out[key];
    if (Array.isArray(def) && (!Array.isArray(cur) || cur.length === 0) && def.length > 0 && key !== 'crm' && key !== 'dupTeam' && key !== 'meetings') {
      out[key] = JSON.parse(JSON.stringify(def));
    }
    if (cur === undefined || cur === null) {
      out[key] = Array.isArray(def) ? JSON.parse(JSON.stringify(def)) : def;
    }
  }

  // KPI یک شیء تودرتوست؛ کلیدهای جاافتاده باید از پیش‌فرض پر شوند.
  const kpi = out.kpi && typeof out.kpi === 'object' && !Array.isArray(out.kpi) ? out.kpi : {};
  out.kpi = { ...DEFAULT_DATA.kpi };
  for (const key of Object.keys(DEFAULT_DATA.kpi)) {
    const n = Number(kpi[key]);
    out.kpi[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  }

  return out;
}

function ls() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

export function loadFromStorage() {
  try {
    const s = ls();
    if (!s) return mergeWithDefaults(null);
    const raw = s.getItem(STORAGE_KEY);
    return mergeWithDefaults(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.error('خطا در بارگذاری داده:', e);
    return mergeWithDefaults(null);
  }
}

export function saveToStorage(state) {
  try {
    const s = ls();
    if (!s) return false;
    s.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('خطا در ذخیره داده:', e);
    return false;
  }
}

/**
 * تست اتصال — بدون نوشتن داده
 * خروجی: { ok, reason?, status?, detail? }
 */
export async function testConnection(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();

  // بدون نشست: فقط سلامت Auth را می‌سنجیم (بدون نیاز به دسترسی جدول)
  if (!h) {
    try {
      const res = await fetch(`${cfg.url}/auth/v1/health`, { cache: 'no-store' });
      if (res.ok) return { ok: true, status: res.status, scope: 'auth-only' };
      return { ok: false, reason: 'http', status: res.status };
    } catch (e) {
      return { ok: false, reason: 'network', detail: String(e?.message || e) };
    }
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?select=user_id&limit=1`,
      { headers: h, cache: 'no-store' }
    );

    if (res.ok) return { ok: true, status: res.status, scope: 'full' };

    const text = (await res.text()).slice(0, 400);
    if (res.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(text))
      return { ok: false, reason: 'table-missing', status: res.status, detail: text };
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: 'auth', status: res.status, detail: text };
    return { ok: false, reason: 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * ذخیره در Supabase (upsert روی user_id)
 */
export async function saveToCloud(state, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();
  if (!h) return { ok: false, reason: 'no-session' };

  const user = currentUser();
  const userId = user?.id;
  if (!userId) return { ok: false, reason: 'no-session' };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/user_state?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        state_data: stripNationalId(state),
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'auth' : 'http', status: res.status, detail: text };
  } catch (e) {
    console.error('خطا در اتصال به Supabase:', e);
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * خواندن از Supabase
 */
export async function loadFromCloud(_ignoredUserId, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return null;

  const h = await headers();
  if (!h) return null;

  const userId = currentUser()?.id;
  if (!userId) return null;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_data`,
      { headers: h, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.state_data ? mergeWithDefaults(rows[0].state_data) : null;
  } catch (e) {
    console.error('خطا در خواندن از Supabase:', e);
    return null;
  }
}

/**
 * ذخیره پروفایل در جدول جدا (`profiles`).
 * کد ملی هرگز داخل `state_data` نمی‌رود و فقط با RLS خود کاربر ذخیره می‌شود.
 * کلید این جدول `id` است (همان شناسه کاربر در Auth)؛ با جدول موجود سازگاریم.
 */
export async function saveProfile(profile = {}, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();
  if (!h) return { ok: false, reason: 'no-session' };
  const userId = currentUser()?.id;
  if (!userId) return { ok: false, reason: 'no-session' };

  const row = { id: userId };
  if (profile.full_name != null) row.full_name = String(profile.full_name).slice(0, 200);
  if (profile.upline != null) row.upline = String(profile.upline).slice(0, 200);
  // فقط اگر مقدار واقعی آمده باشد؛ در غیر این صورت مقدار قبلی پاک نمی‌شود.
  if (profile.national_id) row.national_id = String(profile.national_id).slice(0, 40);

  try {
    const res = await fetch(`${cfg.url}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row)
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    if (res.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(text))
      return { ok: false, reason: 'table-missing', status: res.status, detail: text };
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'auth' : 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

export async function syncState(state, cfg = getSupabaseConfig()) {
  const local = saveToStorage(state);
  const cloud = await saveToCloud(state, cfg);
  return { local, cloud };
}

export function getDefaultData() {
  return mergeWithDefaults(null);
}

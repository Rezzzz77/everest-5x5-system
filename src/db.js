/**
 * لایه داده: ذخیره‌سازی محلی (Offline-first) + همگام‌سازی با Supabase
 */

import { getSupabaseConfig, isConfigured as cfgValid, normalizeConfig } from './config.js';
import { DEFAULT_DATA } from './defaults.js';

const STORAGE_KEY = 'everest_5x5_full_v2';

export function isSupabaseConfigured(cfg = getSupabaseConfig()) {
  return cfgValid(cfg);
}

function headers(cfg) {
  const c = normalizeConfig(cfg);
  return {
    'apikey': c.key,
    'Authorization': `Bearer ${c.key}`,
    'Content-Type': 'application/json'
  };
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
  return out;
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return mergeWithDefaults(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.error('خطا در بارگذاری داده:', e);
    return mergeWithDefaults(null);
  }
}

export function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?select=user_id&limit=1`,
      { headers: headers(cfg), cache: 'no-store' }
    );

    if (res.ok) return { ok: true, status: res.status };

    const text = (await res.text()).slice(0, 400);
    if (res.status === 404 || /42P01|does not exist|Could not find the table/i.test(text))
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

  const userId = state.user?.id;
  if (!userId) return { ok: false, reason: 'no-user' };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/user_state?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers(cfg), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        state_data: state,
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
export async function loadFromCloud(userId, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg) || !userId) return null;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_data`,
      { headers: headers(cfg), cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.state_data ? mergeWithDefaults(rows[0].state_data) : null;
  } catch (e) {
    console.error('خطا در خواندن از Supabase:', e);
    return null;
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

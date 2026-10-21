/**
 * لایه داده: ذخیره‌سازی محلی (Offline-first) + همگام‌سازی با Supabase
 */

import { SUPABASE_CONFIG } from './config.js';
import { DEFAULT_DATA } from './defaults.js';

const STORAGE_KEY = 'everest_5x5_full_v2';

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_CONFIG.url &&
    SUPABASE_CONFIG.key &&
    !SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_CONFIG.key.includes('YOUR_PUBLIC_ANON_KEY')
  );
}

function headers() {
  return {
    'apikey': SUPABASE_CONFIG.key,
    'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
    'Content-Type': 'application/json'
  };
}

/**
 * ادغام داده ذخیره‌شده با پیش‌فرض‌ها
 * (کلیدهای ناقص یا آرایه‌های خالی با مقدار پیش‌فرض پر می‌شوند)
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
 * ذخیره در Supabase
 */
export async function saveToCloud(state) {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'not-configured' };

  const userId = state.user?.id;
  if (!userId) return { ok: false, reason: 'no-user' };

  try {
    const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/user_state?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        state_data: state,
        updated_at: new Date().toISOString()
      })
    });
    return res.ok ? { ok: true } : { ok: false, reason: res.statusText, status: res.status };
  } catch (e) {
    console.error('خطا در اتصال به Supabase:', e);
    return { ok: false, reason: 'network' };
  }
}

/**
 * خواندن از Supabase
 */
export async function loadFromCloud(userId) {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    const res = await fetch(
      `${SUPABASE_CONFIG.url}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_data`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.state_data ? mergeWithDefaults(rows[0].state_data) : null;
  } catch (e) {
    console.error('خطا در خواندن از Supabase:', e);
    return null;
  }
}

export async function syncState(state) {
  const local = saveToStorage(state);
  const cloud = await saveToCloud(state);
  return { local, cloud };
}

export function getDefaultData() {
  return mergeWithDefaults(null);
}

export { isSupabaseConfigured };

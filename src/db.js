/**
 * لایه داده برای ذخیره‌سازی محلی و ابری
 * پشتیبانی از Offline-first و Sync با Supabase
 */

import { SUPABASE_CONFIG } from './config.js';

const STORAGE_KEY = 'everest_5x5_full_v2';
const DEFAULT_DATA = {
  user: null,
  startTime: null,
  why: '',
  story: '',
  s1Steps: [],
  s2Streak: 0,
  s2Counters: [],
  s3Counters: [],
  s3Pass: [],
  crm: [],
  dupTeam: [],
  s4Pass: [],
  meetings: [],
  s5Standards: []
};

/**
 * بارگذاری داده از LocalStorage
 */
export function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { ...DEFAULT_DATA };
  } catch (e) {
    console.error('خطا در بارگذاری داده:', e);
    return { ...DEFAULT_DATA };
  }
}

/**
 * ذخیره داده در LocalStorage
 */
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
 * ذخیره در Supabase (اگر تنظیم شده باشد)
 */
export async function saveToCloud(state) {
  if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID')) {
    console.warn('Supabase تنظیم نشده است. داده فقط به صورت محلی ذخیره می‌شود.');
    return false;
  }

  try {
    const userId = state.user?.id;
    if (!userId) return false;

    const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/user_state`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId,
        state_data: state,
        updated_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.warn('خطا در ذخیره ابری:', response.statusText);
    }
    return response.ok;
  } catch (e) {
    console.error('خطا در اتصال به Supabase:', e);
    return false;
  }
}

/**
 * همگام‌سازی کامل
 */
export async function syncState(state) {
  const savedLocally = saveToStorage(state);
  if (savedLocally) {
    await saveToCloud(state);
  }
  return savedLocally;
}

/**
 * خواندنه پیش‌فرض
 */
export function getDefaultData() {
  return { ...DEFAULT_DATA };
}

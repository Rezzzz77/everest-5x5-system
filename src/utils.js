/**
 * ابزارهای کوچک مشترک
 * -------------------
 * خروجی این ماژول باید بدون DOM هم قابل تست باشد.
 */

/** فرار دادن متن برای درج امن در HTML (متن و attribute) */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** فقط رقم‌ها را نگه می‌دارد؛ برای tel / sms / wa.me */
export function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** کلید تاریخ محلی به شکل YYYY-MM-DD (نه UTC) */
export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * شمارنده‌های «روزانه» را با تغییر روز صفر می‌کند.
 * state را در جا تغییر می‌دهد و می‌گوید آیا تغییری داده شد.
 */
export function resetDailyCounters(state, today = localDateKey()) {
  if (!state || typeof state !== 'object') return false;
  if (state.counterDate === today) return false;

  for (const key of ['s2Counters', 's3Counters']) {
    if (!Array.isArray(state[key])) continue;
    for (const item of state[key]) {
      if (item && typeof item === 'object') item.count = 0;
    }
  }
  state.counterDate = today;
  return true;
}

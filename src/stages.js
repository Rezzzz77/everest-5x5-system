/**
 * منطق باز شدن مراحل سیستم ۵×۵
 * -----------------------------
 * این ماژول خالص است (بدون DOM و بدون state سراسری) تا هم app.js و هم
 * Coach بتوانند از آن استفاده کنند و تست‌پذیر باشد.
 */

const LAST_STAGE = 5;

function isDone(item) {
  return Boolean(item && item.done);
}

function allDone(list) {
  return Array.isArray(list) && list.length > 0 && list.every(isDone);
}

/**
 * بالاترین مرحله‌ای که بر اساس معیارهای عملی کاربر پاس شده است.
 * @param {object} state وضعیت اپلیکیشن
 * @returns {number} ۱ تا ۵
 */
export function getCriteriaStage(state = {}) {
  const s = state || {};
  if (!allDone(s.s1Steps)) return 1;
  if ((Number(s.s2Streak) || 0) < 7) return 2;
  if (!allDone(s.s3Pass)) return 3;
  if (!allDone(s.s4Pass)) return 4;
  return LAST_STAGE;
}

/**
 * بالاترین مرحله‌ای که کاربر مجاز به ورود است.
 * برای اعضای تیم (مشاوران)، ورود به مراحل بعد منوط به تأیید رسمی راهبر (approvedStage) است.
 * @param {object} state وضعیت اپلیکیشن
 * @returns {number} ۱ تا ۵
 */
export function getHighestUnlockedStage(state = {}) {
  const s = state || {};
  const crit = getCriteriaStage(s);

  // اگر نقش کاربر راهبر است، نیازی به تایید ندارد و بر اساس معیارها باز می‌شود
  if (s.user?.role === 'leader') return crit;

  // برای اعضای تیم (یا حالتی که approvedStage ست شده)، منوط به تایید راهبر است
  if (s.user?.role === 'member' || s.approvedStage != null) {
    const approved = Math.max(1, Number(s.approvedStage) || 1);
    return Math.min(crit, approved);
  }

  return crit;
}

/**
 * آیا مرحله مورد نظر معیارها را تکمیل کرده اما منتظر تأیید راهبر است؟
 */
export function isWaitingForApproval(stage, state = {}) {
  const s = state || {};
  const n = Number(stage);
  if (!Number.isInteger(n) || n <= 1 || n > LAST_STAGE) return false;
  const crit = getCriteriaStage(s);
  const highest = getHighestUnlockedStage(s);
  return n <= crit && n > highest;
}

/** آیا کاربر می‌تواند وارد این مرحله شود؟ */
export function isStageUnlocked(stage, state = {}) {
  const n = Number(stage);
  return Number.isInteger(n) && n >= 1 && n <= LAST_STAGE && n <= getHighestUnlockedStage(state);
}

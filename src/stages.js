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
 * بالاترین مرحله‌ای که کاربر به آن دسترسی دارد.
 * @param {object} state وضعیت اپلیکیشن
 * @returns {number} ۱ تا ۵
 */
export function getHighestUnlockedStage(state = {}) {
  const s = state || {};

  if (!allDone(s.s1Steps)) return 1;
  if ((Number(s.s2Streak) || 0) < 7) return 2;
  if (!allDone(s.s3Pass)) return 3;
  if (!allDone(s.s4Pass)) return 4;
  return LAST_STAGE;
}

/** آیا کاربر می‌تواند وارد این مرحله شود؟ */
export function isStageUnlocked(stage, state = {}) {
  const n = Number(stage);
  return Number.isInteger(n) && n >= 1 && n <= LAST_STAGE && n <= getHighestUnlockedStage(state);
}

/**
 * تست‌های لایه داده — تمرکز روی مسیرهای «از دست رفتن داده»
 *
 * این تست‌ها رگرسیون دو باگ واقعی هستند:
 *  ۱) تصمیم «کدام نسخه جدیدتر است» هنگام ورود باید محافظه‌کارانه باشد،
 *     وگرنه داده ابری هرگز بازیابی نمی‌شود.
 *  ۲) خطای حافظه (سهمیه/دسترسی) باید به‌صورت `false` برگردد، نه شکست خاموش.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldPreferRemote, mergeWithDefaults, saveToStorage, loadFromStorage, clearStorage
} from '../src/db.js';
import { DEFAULT_DATA } from '../src/defaults.js';

/** localStorage ساختگی با امکان شبیه‌سازی خطا */
function installStorage(impl) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  globalThis.localStorage = impl;
  return () => {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  };
}

function memoryStorage(map = new Map()) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map
  };
}

test('shouldPreferRemote: نسخه ابری جدیدتر جایگزین می‌شود', () => {
  assert.equal(shouldPreferRemote(2000, 1000), true);
});

test('shouldPreferRemote: نسخه محلی جدیدتر حفظ می‌شود', () => {
  assert.equal(shouldPreferRemote(1000, 2000), false);
});

test('shouldPreferRemote: زمان‌های مساوی باعث بازنویسی نمی‌شوند', () => {
  assert.equal(shouldPreferRemote(1500, 1500), false);
});

test('shouldPreferRemote: مقدار نامعتبر ابری هرگز داده محلی را نمی‌خورد', () => {
  for (const bad of [undefined, null, NaN, 'abc', -5, 0]) {
    assert.equal(shouldPreferRemote(bad, 1234), false, `remote=${String(bad)}`);
  }
});

test('shouldPreferRemote: محلی نامعتبر و ابری معتبر → ابری می‌برد', () => {
  for (const bad of [undefined, null, NaN, 'abc', -5, 0]) {
    assert.equal(shouldPreferRemote(1234, bad), true, `local=${String(bad)}`);
  }
});

test('shouldPreferRemote: هر دو نامعتبر → محلی حفظ می‌شود', () => {
  assert.equal(shouldPreferRemote(undefined, undefined), false);
  assert.equal(shouldPreferRemote(0, 0), false);
});

test('mergeWithDefaults: لیست کاربر با نوع خراب به آرایه خالی تبدیل می‌شود', () => {
  const merged = mergeWithDefaults({ crm: 'x', dupTeam: {}, meetings: 0, initialList30: 7 });
  assert.deepEqual(merged.crm, []);
  assert.deepEqual(merged.dupTeam, []);
  assert.deepEqual(merged.meetings, []);
  assert.deepEqual(merged.initialList30, []);
});

test('mergeWithDefaults: لیست سیدشده با نوع خراب از پیش‌فرض پر می‌شود', () => {
  const merged = mergeWithDefaults({ s1Steps: 'broken', s3Pass: 42 });
  assert.equal(merged.s1Steps.length, DEFAULT_DATA.s1Steps.length);
  assert.equal(merged.s3Pass.length, DEFAULT_DATA.s3Pass.length);
});

test('saveToStorage: ذخیره موفق true برمی‌گرداند', () => {
  const restore = installStorage(memoryStorage());
  try {
    assert.equal(saveToStorage({ a: 1 }), true);
    assert.deepEqual(loadFromStorage().a, 1);
  } finally {
    restore();
  }
});

test('saveToStorage: خطای سهمیه false برمی‌گرداند و پرتاب نمی‌کند', () => {
  const originalError = console.error;
  console.error = () => {};
  const restore = installStorage({
    getItem: () => null,
    setItem: () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    },
    removeItem: () => {}
  });
  try {
    assert.equal(saveToStorage({ a: 1 }), false);
  } finally {
    restore();
    console.error = originalError;
  }
});

test('saveToStorage: بدون localStorage false برمی‌گرداند', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(saveToStorage({ a: 1 }), false);
  } finally {
    if (had) globalThis.localStorage = prev;
  }
});

test('loadFromStorage: JSON خراب باعث پرتاب خطا نمی‌شود و پیش‌فرض می‌دهد', () => {
  const originalError = console.error;
  console.error = () => {};
  const map = new Map([['everest_5x5_full_v2', '{broken json']]);
  const restore = installStorage(memoryStorage(map));
  try {
    const loaded = loadFromStorage();
    assert.equal(loaded.s1Steps.length, DEFAULT_DATA.s1Steps.length);
    assert.deepEqual(loaded.crm, []);
  } finally {
    restore();
    console.error = originalError;
  }
});

test('clearStorage: داده محلی را پاک می‌کند', () => {
  const store = memoryStorage(new Map([['everest_5x5_full_v2', '{"a":1}']]));
  const restore = installStorage(store);
  try {
    clearStorage();
    assert.equal(store.getItem('everest_5x5_full_v2'), null);
  } finally {
    restore();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml, phoneDigits, localDateKey, resetDailyCounters } from '../src/utils.js';

test('escapeHtml: کاراکترهای خطرناک HTML خنثی می‌شوند', () => {
  assert.equal(
    escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
  );
});

test('escapeHtml: مقدار خالی و null امن است', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
});

test('escapeHtml: متن فارسی دست‌نخورده می‌ماند', () => {
  assert.equal(escapeHtml('سارا محمدی'), 'سارا محمدی');
});

test('phoneDigits: فقط رقم‌ها می‌مانند', () => {
  assert.equal(phoneDigits('+98 (912) 123-4567'), '989121234567');
  assert.equal(phoneDigits('09121112233'), '09121112233');
  assert.equal(phoneDigits('javascript:alert(1)'), '1');
  assert.equal(phoneDigits(null), '');
});

test('localDateKey: تاریخ محلی با صفر پیشرو', () => {
  assert.equal(localDateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(localDateKey(new Date(2026, 11, 31)), '2026-12-31');
});

test('resetDailyCounters: با تغییر روز شمارنده‌ها صفر می‌شوند', () => {
  const state = {
    counterDate: '2026-01-04',
    s2Counters: [{ count: 7 }, { count: 2 }],
    s3Counters: [{ count: 9 }]
  };
  assert.equal(resetDailyCounters(state, '2026-01-05'), true);
  assert.deepEqual(state.s2Counters.map(c => c.count), [0, 0]);
  assert.deepEqual(state.s3Counters.map(c => c.count), [0]);
  assert.equal(state.counterDate, '2026-01-05');
});

test('resetDailyCounters: در همان روز دست نمی‌زند', () => {
  const state = { counterDate: '2026-01-05', s2Counters: [{ count: 3 }] };
  assert.equal(resetDailyCounters(state, '2026-01-05'), false);
  assert.equal(state.s2Counters[0].count, 3);
});

test('resetDailyCounters: ورودی خالی/ناقص امن است', () => {
  assert.equal(resetDailyCounters(null, '2026-01-05'), false);
  const state = {};
  assert.equal(resetDailyCounters(state, '2026-01-05'), true);
  assert.equal(state.counterDate, '2026-01-05');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeHtml,
  phoneDigits,
  localDateKey,
  resetDailyCounters,
  calculateMemberHealth,
  isEveningReportTime,
  contactsToCsv,
  teamToCsv,
  initialList30ToCsv
} from '../src/utils.js';

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

test('calculateMemberHealth: عضو با استریک فعال 🟢 است', () => {
  const m = { s2_streak: 3, current_stage: 2, updated_at: new Date().toISOString() };
  const h = calculateMemberHealth(m);
  assert.equal(h.status, 'active');
  assert.ok(h.label.includes('فعال'));
});

test('calculateMemberHealth: عضو غیرفعال بیش از ۷ روز 🔴 در خطر توقف است', () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const m = { s2_streak: 0, current_stage: 2, updated_at: eightDaysAgo };
  const h = calculateMemberHealth(m);
  assert.equal(h.status, 'risk');
  assert.ok(h.label.includes('خطر'));
});

test('isEveningReportTime: ساعت‌های شبانه شناسایی می‌شوند', () => {
  const dEvening = new Date(2026, 0, 1, 21, 30);
  assert.equal(isEveningReportTime(dEvening), true);
  const dNoon = new Date(2026, 0, 1, 14, 0);
  assert.equal(isEveningReportTime(dNoon), false);
});

test('contactsToCsv: خروجی با BOM و هدر معتبر تولید می‌شود', () => {
  const contacts = [
    { name: 'علی رضایی', phone: '09121112233', source: 'مشتری', status: 'دعوت شده', followupDate: '1403-08-10', notes: 'علاقه‌مند به پک لاغری' }
  ];
  const csv = contactsToCsv(contacts);
  assert.ok(csv.startsWith('\uFEFF'), 'باید با UTF-8 BOM شروع شود');
  assert.ok(csv.includes('"علی رضایی"'));
  assert.ok(csv.includes('"علاقه‌مند به پک لاغری"'));
});

test('teamToCsv: خروجی اعضای تیم تولید می‌شود', () => {
  const team = [
    { full_name: 'مریم کمالی', email: 'maryam@example.com', current_stage: 3, s2_streak: 5, crm_count: 22 }
  ];
  const csv = teamToCsv(team);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"مریم کمالی"'));
  assert.ok(csv.includes('"مرحله 3"'));
});

test('initialList30ToCsv: خروجی CSV فرم رسمی اورست با BOM و ستون‌ها تولید می‌شود', () => {
  const list = [
    { name: 'رضا صبوری', relation: 'دوست', level: 'گرم', personality: 'قرمز', category: 'همکاری کاری', firstContactDate: 'شنبه ۱۸', phone: '09121112233' }
  ];
  const csv = initialList30ToCsv(list);
  assert.ok(csv.startsWith('\uFEFF'), 'باید با UTF-8 BOM شروع شود');
  assert.ok(csv.includes('"ردیف","نام و نام خانوادگی","نسبت شخص با ما"'));
  assert.ok(csv.includes('"رضا صبوری"'));
  assert.ok(csv.includes('"قرمز"'));
  assert.ok(csv.includes('"09121112233"'));
});

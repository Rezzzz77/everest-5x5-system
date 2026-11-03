import test from 'node:test';
import assert from 'node:assert/strict';

import { getHighestUnlockedStage, isStageUnlocked, getCriteriaStage, isWaitingForApproval } from '../src/stages.js';

function state(overrides = {}) {
  return {
    s1Steps: [{ done: true }, { done: true }, { done: true }, { done: true }, { done: true }],
    s2Streak: 7,
    s3Pass: [{ done: true }],
    s4Pass: [{ done: true }],
    ...overrides
  };
}

test('stages: وضعیت خالی فقط مرحله ۱ را باز می‌کند', () => {
  assert.equal(getHighestUnlockedStage({}), 1);
  assert.equal(getHighestUnlockedStage(null), 1);
});

test('stages: تا تکمیل ۵ قدم اول، مرحله ۲ باز نیست', () => {
  const s = state({ s1Steps: [{ done: true }, { done: false }] });
  assert.equal(getHighestUnlockedStage(s), 1);
  assert.equal(isStageUnlocked(2, s), false);
});

test('stages: با تکمیل قدم‌ها و زنجیره کمتر از ۷، مرحله ۲ باز است', () => {
  const s = state({ s2Streak: 6, s3Pass: [] });
  assert.equal(getHighestUnlockedStage(s), 2);
  assert.equal(isStageUnlocked(3, s), false);
});

test('stages: مرحله ۳ با معیار عبور ناقص باز نمی‌شود', () => {
  const s = state({ s3Pass: [{ done: true }, { done: false }] });
  assert.equal(getHighestUnlockedStage(s), 3);
  assert.equal(isStageUnlocked(4, s), false);
});

test('stages: مرحله ۵ فقط پس از هر دو معیار عبور باز می‌شود', () => {
  const s = state({ s4Pass: [{ done: true }, { done: false }] });
  assert.equal(getHighestUnlockedStage(s), 4);
  assert.equal(isStageUnlocked(5, s), false);
  assert.equal(getHighestUnlockedStage(state()), 5);
});

test('stages: پارامتر state واقعاً استفاده می‌شود (state سراسری در کار نیست)', () => {
  assert.equal(getHighestUnlockedStage(state()), 5);
  assert.equal(getHighestUnlockedStage({}), 1);
});

test('stages: ورودی ناقص/نامعتبر امن است', () => {
  assert.equal(getHighestUnlockedStage({ s1Steps: 'x', s2Streak: 'x' }), 1);
  assert.equal(isStageUnlocked(0, state()), false);
  assert.equal(isStageUnlocked(6, state()), false);
  assert.equal(isStageUnlocked('2', state()), true);
});

test('stages: نقش راهبر (leader) بدون معطلی و تایید باز می‌شود', () => {
  const s = state({ user: { role: 'leader' }, approvedStage: 1 });
  assert.equal(getHighestUnlockedStage(s), 5);
  assert.equal(isStageUnlocked(2, s), true);
  assert.equal(isWaitingForApproval(2, s), false);
});

test('stages: عضو تیم (member) بدون تأیید راهبر در مرحله ۱ می‌ماند و منتظر تایید است', () => {
  const s = state({ user: { role: 'member' }, approvedStage: 1 });
  assert.equal(getCriteriaStage(s), 5); // معیارها همه پاس است
  assert.equal(getHighestUnlockedStage(s), 1); // اما سطح مجاز ۱ است
  assert.equal(isStageUnlocked(2, s), false);
  assert.equal(isWaitingForApproval(2, s), true);
});

test('stages: با تأیید راهبر (approvedStage: 2)، مرحله ۲ برای عضو باز می‌شود', () => {
  const s = state({ user: { role: 'member' }, approvedStage: 2 });
  assert.equal(getHighestUnlockedStage(s), 2);
  assert.equal(isStageUnlocked(2, s), true);
  assert.equal(isStageUnlocked(3, s), false);
  assert.equal(isWaitingForApproval(3, s), true);
});


test('پیشرفت: ماتریس مرحله ۴ با آرایهٔ steps در محاسبه حساب می‌شود', async () => {
  const { getOverallProgress } = await import('../src/coach.js');
  const mk = (steps) => ({
    user: { role: 'member' },
    approvedStage: 5,
    s1Steps: [{ done: true }, { done: true }, { done: true }, { done: true }, { done: true }],
    s2Streak: 7,
    s2Counters: [{ count: 5, target: 5 }],
    s3Counters: [{ count: 5, target: 5 }],
    s3Pass: [{ done: true }, { done: true }, { done: true }, { done: true }, { done: true }],
    crm: Array.from({ length: 100 }, (_, i) => ({ id: i })),
    s4Pass: [],
    dupTeam: [{ name: 'a', steps }, { name: 'b', steps }],
    s5Standards: [{ done: true }, { done: true }, { done: true }, { done: true }, { done: true }],
    meetings: [{}, {}, {}, {}, {}],
    kpi: { sales: 1, entries: 1, active: 1, leaders: 1, depth: 1 }
  });
  const empty = getOverallProgress(mk([false, false, false, false, false]));
  const full = getOverallProgress(mk([true, true, true, true, true]));
  assert.ok(Number.isFinite(empty), 'خروجی نباید NaN باشد');
  assert.ok(Number.isFinite(full), 'خروجی نباید NaN باشد');
  assert.ok(full > empty, 'تکمیل ماتریس باید پیشرفت را بالا ببرد');
});

test('پیشرفت: دادهٔ قدیمی step با آرایهٔ steps هم‌ارز است', async () => {
  const { getOverallProgress } = await import('../src/coach.js');
  const base = {
    user: { role: 'member' }, approvedStage: 5,
    s1Steps: [{ done: true }], s2Streak: 7, s2Counters: [], s3Counters: [], s3Pass: [],
    crm: [], s4Pass: [], s5Standards: [], meetings: [], kpi: {}
  };
  const legacy = getOverallProgress({ ...base, dupTeam: [{ name: 'a', step: 3 }] });
  const fresh = getOverallProgress({ ...base, dupTeam: [{ name: 'a', steps: [true, true, true, false, false] }] });
  assert.equal(legacy, fresh);
});

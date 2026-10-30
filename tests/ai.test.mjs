import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDeepSeekConfig,
  isDeepSeekConfigured,
  getDeepSeekConfig
} from '../src/config.js';
import {
  buildInvitePrompt,
  buildObjectionPrompt,
  buildCoachReviewPrompt,
  callDeepSeekChat,
  EVEREST_SYSTEM_PROMPT
} from '../src/ai.js';

test('validateDeepSeekConfig: کلید خالی خطا دارد', () => {
  const errs = validateDeepSeekConfig({ apiKey: '' });
  assert.ok(errs.length > 0);
  assert.ok(errs[0].includes('کلید DeepSeek'));
});

test('validateDeepSeekConfig: کلید معتبر خطا ندارد', () => {
  const errs = validateDeepSeekConfig({ apiKey: 'sk-1234567890abcdef1234567890abcdef' });
  assert.equal(errs.length, 0);
});

test('isDeepSeekConfigured: وضعیت پیکربندی درست تشخیص داده می‌شود', () => {
  assert.equal(isDeepSeekConfigured({ apiKey: '' }), false);
  assert.equal(isDeepSeekConfigured({ apiKey: 'sk-abcdef1234567890abcdef' }), true);
});

test('buildInvitePrompt: متن سناریوی دعوت درست ساخته می‌شود', () => {
  const p = buildInvitePrompt({ contactName: 'رضا', relation: 'همکار سابق', interest: 'کاهش وزن' });
  assert.ok(p.includes('رضا'));
  assert.ok(p.includes('همکار سابق'));
  assert.ok(p.includes('کاهش وزن'));
});

test('buildObjectionPrompt: بهانه مشتری در پرامپت قرار می‌گیرد', () => {
  const p = buildObjectionPrompt('قیمت محصولات خیلی بالاست');
  assert.ok(p.includes('قیمت محصولات خیلی بالاست'));
  assert.ok(p.includes('مربی اورست'));
});

test('buildCoachReviewPrompt: متغیرهای مرحله و استریک ثبت می‌شوند', () => {
  const p = buildCoachReviewPrompt({ stage: 2, streak: 5, crmCount: 14, goal: 'درآمد ۳۰ میلیون' });
  assert.ok(p.includes('مرحله 2'));
  assert.ok(p.includes('5 روز'));
  assert.ok(p.includes('14 نفر'));
});

test('callDeepSeekChat: بدون کلید پیام راهنما می‌دهد', async () => {
  const res = await callDeepSeekChat({ rawConfig: { apiKey: '' } });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-key');
});

test('EVEREST_SYSTEM_PROMPT: شامل قوانین ۵ مرحله و نیوشانیک است', () => {
  assert.ok(EVEREST_SYSTEM_PROMPT.includes('اورست'));
  assert.ok(EVEREST_SYSTEM_PROMPT.includes('نیوشانیک'));
  assert.ok(EVEREST_SYSTEM_PROMPT.includes('مرحله'));
});

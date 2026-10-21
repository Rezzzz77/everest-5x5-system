import test from 'node:test';
import assert from 'node:assert/strict';

import { validateConfig, isConfigured, getSupabaseConfig } from '../src/config.js';
import { testConnection, mergeWithDefaults } from '../src/db.js';
import { DEFAULT_DATA } from '../src/defaults.js';

const URL_OK = 'https://abcdefghijkl.supabase.co';
const KEY_OK = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature_part_here';
const KEY_PUBLISHABLE = 'sb_publishable_veUWJ1FuR3qaBMQCJ0oh3w_HxtUGSeJ';

test('validateConfig: پیکربندی معتبر خطا ندارد', () => {
  assert.deepEqual(validateConfig({ url: URL_OK, key: KEY_OK }), []);
});

test('validateConfig: آدرس خالی را رد می‌کند', () => {
  const errors = validateConfig({ url: '', key: KEY_OK });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /آدرس/);
});

test('validateConfig: دامنه غیر Supabase را رد می‌کند', () => {
  const errors = validateConfig({ url: 'https://example.com', key: KEY_OK });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /supabase\.co/);
});

test('validateConfig: کلید کوتاه را رد می‌کند', () => {
  const errors = validateConfig({ url: URL_OK, key: 'short' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /کلید/);
});

test('isConfigured: بدون پیکربندی false است', () => {
  assert.equal(isConfigured({ url: '', key: '' }), false);
  assert.equal(isConfigured({ url: URL_OK, key: 'short' }), false);
});

test('isConfigured: با پیکربندی کامل true است', () => {
  assert.equal(isConfigured({ url: URL_OK, key: KEY_OK }), true);
});

test('isConfigured: اسلش انتهایی مهم نیست', () => {
  assert.equal(isConfigured({ url: URL_OK + '/', key: KEY_OK }), true);
});

test('getSupabaseConfig: در محیط بدون localStorage خالی برمی‌گردد', () => {
  assert.deepEqual(getSupabaseConfig(), { url: '', key: '' });
});

test('testConnection: پیکربندی ناقص → not-configured بدون درخواست شبکه', async () => {
  const r = await testConnection({ url: '', key: '' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not-configured');
});

test('mergeWithDefaults: آرایه‌های خالی با پیش‌فرض پر می‌شوند', () => {
  const merged = mergeWithDefaults({ s1Steps: [], s2Streak: 4 });
  assert.equal(merged.s1Steps.length, DEFAULT_DATA.s1Steps.length);
  assert.equal(merged.s2Streak, 4);
});

test('mergeWithDefaults: لیست‌های کاربر (crm) خالی می‌مانند', () => {
  const merged = mergeWithDefaults({ crm: [] });
  assert.deepEqual(merged.crm, []);
});

test('mergeWithDefaults: ورودی null امن است', () => {
  const merged = mergeWithDefaults(null);
  assert.equal(merged.s3Pass.length, DEFAULT_DATA.s3Pass.length);
  assert.deepEqual(merged.dupTeam, []);
});

test('validateConfig: کلید publishable پذیرفته می‌شود', () => {
  assert.deepEqual(validateConfig({ url: URL_OK, key: KEY_PUBLISHABLE }), []);
});

test('validateConfig: کلید secret پذیرفته نمی‌شود', () => {
  const errors = validateConfig({ url: URL_OK, key: 'sb_secret_abcdefghijklmnopqrstuvwxyz' });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /secret/);
});

test('isConfigured: کلید publishable کافی است', () => {
  assert.equal(isConfigured({ url: URL_OK, key: KEY_PUBLISHABLE }), true);
});

test('validateConfig: آدرس غیر سوپابیس رد می‌شود', () => {
  const errors = validateConfig({ url: 'https://example.co', key: KEY_PUBLISHABLE });
  assert.equal(errors.length, 1);
});

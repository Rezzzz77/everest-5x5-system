import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateConfig, isConfigured, getSupabaseConfig, SUPABASE_CONFIG,
  getN8nConfig, saveN8nConfig, clearN8nConfig, validateN8nConfig
} from '../src/config.js';
import {
  testConnection, mergeWithDefaults, stripNationalId,
  sendBackupToN8n, exportStateAsJson, importStateFromJson
} from '../src/db.js';
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

test('getSupabaseConfig: در محیط بدون localStorage از SUPABASE_CONFIG می‌آید', () => {
  assert.deepEqual(getSupabaseConfig(), {
    url: SUPABASE_CONFIG.url,
    key: SUPABASE_CONFIG.key
  });
});

test('config پیش‌فرض پروژه: معتبر است', () => {
  assert.deepEqual(validateConfig(SUPABASE_CONFIG), []);
  assert.equal(isConfigured(SUPABASE_CONFIG), true);
});

test('config پیش‌فرض: هرگز کلید secret در کلاینت نیست', () => {
  assert.doesNotMatch(SUPABASE_CONFIG.key, /^sb_secret_/i);
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

test('mergeWithDefaults: کلیدهای KPI با پیش‌فرض پر می‌شوند', () => {
  const merged = mergeWithDefaults({ kpi: { sales: 12 } });
  assert.equal(merged.kpi.sales, 12);
  assert.equal(merged.kpi.entries, 0);
  assert.equal(merged.kpi.active, 0);
});

test('mergeWithDefaults: KPI نامعتبر به صفر تبدیل می‌شود', () => {
  const merged = mergeWithDefaults({ kpi: { sales: 'abc', entries: -5, active: '7' } });
  assert.equal(merged.kpi.sales, 0);
  assert.equal(merged.kpi.entries, 0);
  assert.equal(merged.kpi.active, 7);
});

test('stripNationalId: کد ملی از وضعیت حذف می‌شود و ورودی تغییر نمی‌کند', () => {
  const original = { user: { name: 'سارا', nationalId: '0012345678' }, crm: [] };
  const clean = stripNationalId(original);
  assert.equal(clean.user.nationalId, undefined);
  assert.equal(clean.user.name, 'سارا');
  assert.equal(original.user.nationalId, '0012345678');
});

test('stripNationalId: وضعیت بدون کاربر یا بدون کد ملی امن است', () => {
  assert.deepEqual(stripNationalId({ crm: [] }), { crm: [] });
  assert.equal(stripNationalId(null), null);
  assert.deepEqual(stripNationalId({ user: { name: 'a' } }).user, { name: 'a' });
});

/* ---------------- تست‌های n8n و پشتیبان‌گیری ---------------- */

test('validateN8nConfig: آدرس معتبر وب‌هوک خطا ندارد', () => {
  assert.deepEqual(validateN8nConfig({ webhookUrl: 'https://n8n.example.com/webhook/everest-backup' }), []);
  assert.deepEqual(validateN8nConfig({ webhookUrl: 'http://localhost:5678/webhook/test' }), []);
});

test('validateN8nConfig: آدرس خالی یا نامعتبر خطا دارد', () => {
  const errEmpty = validateN8nConfig({ webhookUrl: '' });
  assert.equal(errEmpty.length, 1);
  assert.match(errEmpty[0], /وارد کن/);

  const errInvalid = validateN8nConfig({ webhookUrl: 'ftp://example.com' });
  assert.equal(errInvalid.length, 1);
  assert.match(errInvalid[0], /http/);
});

test('getN8nConfig: در غیاب مقدار محلی رشته خالی است', () => {
  assert.deepEqual(getN8nConfig(), { webhookUrl: '' });
});

test('sendBackupToN8n: بدون وب‌هوک تنظیم‌شده خطا می‌دهد', async () => {
  const res = await sendBackupToN8n({ crm: [] }, { webhookUrl: '' });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'not-configured');
});

test('exportStateAsJson: خروجی JSON معتبر با حذف کد ملی تولید می‌کند', () => {
  const state = {
    user: { name: 'علی', nationalId: '1234567890' },
    s2Streak: 5,
    crm: [{ name: 'رضا' }]
  };
  const jsonStr = exportStateAsJson(state);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.everest_backup_version, '0.6.0');
  assert.ok(parsed.exported_at);
  assert.equal(parsed.data.user.name, 'علی');
  assert.equal(parsed.data.user.nationalId, undefined);
  assert.equal(parsed.data.s2Streak, 5);
  assert.equal(parsed.data.crm.length, 1);
});

test('importStateFromJson: فایل پشتیبان معتبر را به‌درستی بازیابی می‌کند', () => {
  const backupJson = JSON.stringify({
    everest_backup_version: '0.6.0',
    data: {
      user: { name: 'نگار' },
      s2Streak: 7,
      crm: [{ name: 'مشتری ۱' }]
    }
  });

  const res = importStateFromJson(backupJson);
  assert.equal(res.ok, true);
  assert.equal(res.state.user.name, 'نگار');
  assert.equal(res.state.s2Streak, 7);
  assert.equal(res.state.crm.length, 1);
  // بررسی ادغام با پیش‌فرض‌ها
  assert.ok(Array.isArray(res.state.s1Steps));
});

test('importStateFromJson: ساختار یا JSON نامعتبر خطا می‌دهد', () => {
  assert.equal(importStateFromJson('').ok, false);
  assert.equal(importStateFromJson('invalid-json').ok, false);
  assert.equal(importStateFromJson('[]').ok, false);
});

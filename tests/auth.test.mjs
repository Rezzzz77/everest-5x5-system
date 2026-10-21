import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidEmail, loadSession, saveSession, clearSession, currentUser, authErrorText } from '../src/auth.js';

test('isValidEmail: ایمیل ساده معتبر است', () => {
  assert.equal(isValidEmail('sara@example.com'), true);
});

test('isValidEmail: فاصله اضافه و حروف بزرگ مشکلی ندارد', () => {
  assert.equal(isValidEmail('  Sara@Example.COM '), true);
});

test('isValidEmail: بدون @ رد می‌شود', () => {
  assert.equal(isValidEmail('sara.example.com'), false);
});

test('isValidEmail: دامنه ناقص رد می‌شود', () => {
  assert.equal(isValidEmail('sara@example'), false);
  assert.equal(isValidEmail('sara@.com'), false);
});

test('loadSession: بدون localStorage → null', () => {
  assert.equal(loadSession(), null);
});

test('saveSession: بدون access_token ذخیره نمی‌شود', () => {
  assert.equal(saveSession({}), false);
  assert.equal(loadSession(), null);
});

test('currentUser: نشست بدون user → null', () => {
  assert.equal(currentUser(null), null);
  assert.equal(currentUser({ access_token: 'x' }), null);
});

test('currentUser: فیلدهای کاربر نگاشت می‌شوند', () => {
  const u = currentUser({
    access_token: 'x',
    user: { id: 'uuid-1', email: 'a@b.co', user_metadata: { full_name: 'سارا', upline: 'رضا' } }
  });
  assert.deepEqual(u, { id: 'uuid-1', email: 'a@b.co', name: 'سارا', upline: 'رضا' });
});

test('authErrorText: پیام فارسی برای کد نامعتبر', () => {
  assert.match(authErrorText({ reason: 'invalid-token' }), /نامعتبر|منقضی/);
});

test('authErrorText: ناشناخته شامل کد HTTP', () => {
  assert.match(authErrorText({ reason: 'zzz', status: 500 }), /500/);
});

test('clearSession: فراخوانی بدون خطا در محیط بدون localStorage', () => {
  assert.doesNotThrow(() => clearSession());
});

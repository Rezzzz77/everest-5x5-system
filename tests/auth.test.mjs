import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidEmail, loadSession, saveSession, clearSession, currentUser, authErrorText,
  needsRefresh, isSessionExpired, getAccessToken, consumeAuthRedirect, sendOtp
} from '../src/auth.js';

/** JWT ساختگی با payload دلخواه (فقط برای تست محلی) */
function fakeJwt(payload) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
}

/** اجرای تست با localStorage ساختگی (Node مرورگر نیست) */
async function withMemoryStorage(fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const prev = globalThis.localStorage;
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  try {
    return await fn(map);
  } finally {
    if (had) globalThis.localStorage = prev;
    else delete globalThis.localStorage;
  }
}

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

test('needsRefresh: حاشیه ۶۰ ثانیه‌ای درست تشخیص داده می‌شود', () => {
  const now = 1_700_000_000_000;
  const at = (seconds) => ({ access_token: 'x', expires_at: now / 1000 + seconds });
  assert.equal(needsRefresh(at(30), now), true);
  assert.equal(needsRefresh(at(120), now), false);
  assert.equal(needsRefresh({ access_token: 'x' }, now), false);
  assert.equal(needsRefresh({ expires_at: now / 1000 + 30 }, now), false);
});

test('isSessionExpired: مرز انقضا درست است', () => {
  const now = 1_700_000_000_000;
  assert.equal(isSessionExpired({ expires_at: now / 1000 - 1 }, now), true);
  assert.equal(isSessionExpired({ expires_at: now / 1000 + 1 }, now), false);
  assert.equal(isSessionExpired({}, now), false);
});

test('loadSession: نشست منقضی با refresh_token دور ریخته نمی‌شود', async () => {
  await withMemoryStorage(() => {
    saveSession({
      access_token: 'expired-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) - 10
    });
    assert.equal(loadSession()?.access_token, 'expired-token');
  });
});

test('getAccessToken: نشست منقضی بدون refresh_token → null', async () => {
  await withMemoryStorage(async () => {
    saveSession({
      access_token: 'expired-token',
      expires_at: Math.floor(Date.now() / 1000) - 10
    });
    assert.equal(await getAccessToken(), null);
  });
});

test('consumeAuthRedirect: توکن‌های hash لینک ایمیل به نشست تبدیل می‌شوند', async () => {
  await withMemoryStorage(async () => {
    const jwt = fakeJwt({ sub: 'uuid-9', email: 'a@b.co', user_metadata: { full_name: 'سارا' } });
    const hash = `#access_token=${jwt}&refresh_token=r1&expires_in=3600&token_type=bearer&type=magiclink`;
    const r = await consumeAuthRedirect(hash);
    assert.equal(r.ok, true);
    const s = loadSession();
    assert.equal(s.refresh_token, 'r1');
    assert.ok(s.expires_at > Math.floor(Date.now() / 1000));
    assert.deepEqual(currentUser(s), { id: 'uuid-9', email: 'a@b.co', name: 'سارا', upline: '' });
  });
});

test('consumeAuthRedirect: hash نامرتبط نادیده گرفته می‌شود', async () => {
  await withMemoryStorage(async () => {
    assert.equal(await consumeAuthRedirect('#/stage/1'), null);
    assert.equal(loadSession(), null);
  });
});

test('consumeAuthRedirect: خطای لینک منقضی گزارش می‌شود', async () => {
  await withMemoryStorage(async () => {
    const r = await consumeAuthRedirect('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'link-expired');
  });
});

test('sendOtp: redirect_to به آدرس فعلی اپ فرستاده می‌شود', async () => {
  const hadLoc = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  const prevLoc = globalThis.location;
  const hadFetch = globalThis.fetch;
  let calledUrl = '';
  globalThis.location = { protocol: 'https:', origin: 'https://app.test', pathname: '/everest/' };
  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return { ok: true, status: 200, text: async () => '' };
  };
  try {
    const r = await sendOtp('sara@example.com');
    assert.equal(r.ok, true);
    assert.match(calledUrl, /\/auth\/v1\/otp\?redirect_to=https%3A%2F%2Fapp\.test%2Feverest%2F/);
  } finally {
    if (hadLoc) globalThis.location = prevLoc;
    else delete globalThis.location;
    globalThis.fetch = hadFetch;
  }
});

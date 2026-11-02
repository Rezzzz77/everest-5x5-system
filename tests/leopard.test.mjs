/**
 * تست‌های صحنهٔ کوهستان + ببر برفی
 * منطق تصمیم‌گیری حالت انیمیشن باید مستقل از DOM تست شود.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveAnimationMode, nextAnimationMode, shouldAnimateParticles,
  sceneClass, snowFlakes, stars, sceneMarkup,
  ANIM_FULL, ANIM_REDUCED, ANIM_OFF,
  LEOPARD_STAGES, leopardStageFor, leopardStageForProgress, avatarMarkup, faDigits
} from '../src/leopard.js';

test('leopard: پیش‌فرض روشن است', () => {
  assert.equal(resolveAnimationMode(null), ANIM_FULL);
  assert.equal(resolveAnimationMode(undefined), ANIM_FULL);
  assert.equal(resolveAnimationMode(''), ANIM_FULL);
});

test('leopard: انتخاب کاربر (off) حفظ می‌شود', () => {
  assert.equal(resolveAnimationMode('off'), ANIM_OFF);
  assert.equal(resolveAnimationMode('OFF'), ANIM_OFF);
});

test('leopard: کاهش حرکت سیستم، حالت را ساکن می‌کند', () => {
  assert.equal(resolveAnimationMode('on', true), ANIM_REDUCED);
  assert.equal(resolveAnimationMode(null, true), ANIM_REDUCED);
});

test('leopard: خاموشی کاربر بر ترجیح سیستم اولویت دارد', () => {
  assert.equal(resolveAnimationMode('off', true), ANIM_OFF);
});

test('leopard: کلیک کاربر فقط بین روشن و خاموش جابه‌جا می‌کند', () => {
  assert.equal(nextAnimationMode(ANIM_FULL), ANIM_OFF);
  assert.equal(nextAnimationMode(ANIM_REDUCED), ANIM_OFF);
  assert.equal(nextAnimationMode(ANIM_OFF), ANIM_FULL);
});

test('leopard: برف در حالت ساکن حرکت نمی‌کند', () => {
  assert.equal(shouldAnimateParticles(ANIM_FULL), true);
  assert.equal(shouldAnimateParticles(ANIM_REDUCED), false);
  assert.equal(shouldAnimateParticles(ANIM_OFF), false);
});

test('leopard: کلاس صحنه با حالت هم‌خوان است', () => {
  assert.equal(sceneClass(ANIM_FULL), 'leopard-scene');
  assert.match(sceneClass(ANIM_REDUCED), /is-still/);
  assert.match(sceneClass(ANIM_OFF), /is-off/);
});

test('leopard: دانه‌های برف قطعی و در محدودهٔ صحنه‌اند', () => {
  const a = snowFlakes(18);
  const b = snowFlakes(18);
  assert.deepEqual(a, b, 'خروجی باید پایدار (بدون تصادف) باشد');
  assert.equal(a.length, 18);
  for (const f of a) {
    assert.ok(f.x >= 0 && f.x <= 400, 'x در محدودهٔ viewBox');
    assert.ok(f.duration > 0);
    assert.ok(f.radius > 0);
  }
});

test('leopard: ستاره‌ها در آسمان (بالای افق) هستند', () => {
  for (const s of stars(22)) {
    assert.ok(s.y >= 0 && s.y <= 100);
    assert.ok(s.x >= 0 && s.x <= 400);
  }
});

test('leopard: مارک‌آپ SVG شامل اجزای کلیدی است', () => {
  const svg = sceneMarkup({ mode: ANIM_FULL });
  for (const part of ['<svg', 'lp-sky', 'ridge-far', 'ridge-mid', 'ridge-near', 'class="leopard"', 'lp-tail', 'snowfall', 'stars']) {
    assert.ok(svg.includes(part), `باید شامل ${part} باشد`);
  }
  assert.ok(!/https?:\/\//.test(svg), 'صحنه نباید هیچ منبع شبکه‌ای داشته باشد');
});

/* ---------- آواتار پیشرفت (۵ پله) ---------- */

test('avatar: پنج پله با کدهای تصویر مرجع تعریف شده است', () => {
  assert.equal(LEOPARD_STAGES.length, 5);
  assert.deepEqual(LEOPARD_STAGES.map((s) => s.code), ['CUBLING', 'POUKLE', 'TRAINEE', 'VANGUARD', 'GUARDIAN']);
  assert.deepEqual(LEOPARD_STAGES.map((s) => s.level), [1, 10, 25, 50, 100]);
});

test('avatar: درصد پیشرفت دقیقاً روی مرزهای ۰/۱۰/۲۵/۵۰/۱۰۰ می‌افتد', () => {
  assert.equal(leopardStageForProgress(0).code, 'CUBLING');
  assert.equal(leopardStageForProgress(9).code, 'CUBLING');
  assert.equal(leopardStageForProgress(10).code, 'POUKLE');
  assert.equal(leopardStageForProgress(24).code, 'POUKLE');
  assert.equal(leopardStageForProgress(25).code, 'TRAINEE');
  assert.equal(leopardStageForProgress(49).code, 'TRAINEE');
  assert.equal(leopardStageForProgress(50).code, 'VANGUARD');
  assert.equal(leopardStageForProgress(99).code, 'VANGUARD');
  assert.equal(leopardStageForProgress(100).code, 'GUARDIAN');
});

test('avatar: پیشرفت نامعتبر به تولهٔ نوزاد برمی‌گردد', () => {
  assert.equal(leopardStageForProgress(NaN).code, 'CUBLING');
  assert.equal(leopardStageForProgress(undefined).code, 'CUBLING');
  assert.equal(leopardStageForProgress(-20).code, 'CUBLING');
  assert.equal(leopardStageForProgress(999).code, 'GUARDIAN');
});

test('avatar: شمارهٔ مرحله به نزدیک‌ترین پله محدود می‌شود', () => {
  assert.equal(leopardStageFor(1).code, 'CUBLING');
  assert.equal(leopardStageFor(3).code, 'TRAINEE');
  assert.equal(leopardStageFor(5).code, 'GUARDIAN');
  assert.equal(leopardStageFor(0).code, 'CUBLING');
  assert.equal(leopardStageFor(99).code, 'GUARDIAN');
});

test('avatar: اندازه در هر پله بزرگ‌تر می‌شود (رشد واقعی)', () => {
  const scales = LEOPARD_STAGES.map((s) => s.scale);
  for (let i = 1; i < scales.length; i += 1) {
    assert.ok(scales[i] > scales[i - 1], 'مقیاس باید صعودی باشد');
  }
});

test('avatar: فقط پلنگ نگهبان قلاده و نگین دارد', () => {
  for (const item of LEOPARD_STAGES) {
    const svg = avatarMarkup(item);
    if (item.stage === 5) {
      assert.match(svg, /av-collar/);
      assert.match(svg, /av-gem/);
    } else {
      assert.doesNotMatch(svg, /av-collar/);
    }
  }
});

test('avatar: هر پله SVG مستقل و بدون منبع شبکه‌ای است', () => {
  const seen = new Set();
  for (const item of LEOPARD_STAGES) {
    const svg = avatarMarkup(item);
    assert.match(svg, /^<svg/);
    assert.ok(!/https?:\/\//.test(svg), 'آواتار نباید منبع بیرونی داشته باشد');
    seen.add(svg);
  }
  assert.equal(seen.size, 5, 'هر پنج پله باید ظاهر متفاوت داشته باشند');
});

test('avatar: ارقام سطح فارسی نمایش داده می‌شوند', () => {
  assert.equal(faDigits(100), '۱۰۰');
  assert.equal(faDigits(1), '۱');
  assert.equal(faDigits(null), '');
});

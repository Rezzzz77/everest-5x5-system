/**
 * تست‌های صحنهٔ کوهستان + ببر برفی
 * منطق تصمیم‌گیری حالت انیمیشن باید مستقل از DOM تست شود.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

import {
  resolveAnimationMode, nextAnimationMode, shouldAnimateParticles,
  sceneClass, snowFlakes, stars, sceneMarkup,
  ANIM_FULL, ANIM_REDUCED, ANIM_OFF,
  LEOPARD_STAGES, leopardStageFor, leopardStageForProgress, avatarMarkup, faDigits,
  shouldCelebrate, celebrationText, celebrationMarkup, buildShareCard, escapeXml, avatarImageFor,
  initLeopardAvatar
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

test('leopard: انتخاب صریح «روشن» بر ترجیح سیستم اولویت دارد', () => {
  assert.equal(resolveAnimationMode('full', true), ANIM_FULL);
});

test('leopard: ذخیرهٔ حالت کانونیک (full/reduced/off) قابل بازیابی است', () => {
  assert.equal(resolveAnimationMode('full'), ANIM_FULL);
  assert.equal(resolveAnimationMode('reduced'), ANIM_FULL);
  assert.equal(resolveAnimationMode('reduced', true), ANIM_REDUCED);
  assert.equal(resolveAnimationMode('off'), ANIM_OFF);
});

test('avatar: ورودی غیرصحیح بدون کرش به نزدیک‌ترین پله محدود می‌شود', () => {
  assert.equal(leopardStageFor(1.7).stage, 1, 'گرد کردن به بالا نباید مرحله را جلو ببرد');
  assert.equal(leopardStageFor('3').stage, 3);
  assert.equal(leopardStageFor(null).stage, 1);
  assert.equal(leopardStageFor(99).stage, 5, 'بیش از ۵ به پلهٔ آخر محدود شود');
  assert.equal(leopardStageFor(NaN).stage, 1);
});

test('avatar: درصد کسری (۰ تا ۱) به درصد تفسیر می‌شود', () => {
  assert.equal(leopardStageForProgress(0.5).code, 'VANGUARD');
  assert.equal(leopardStageForProgress(1).code, 'GUARDIAN');
});

/* ---------- جشن ارتقا، کارت اشتراک، تصویر واقعی ---------- */

test('celebrate: فقط افزایش مرحله جشن می‌گیرد', () => {
  assert.equal(shouldCelebrate(1, 2), true);
  assert.equal(shouldCelebrate(4, 5), true);
  assert.equal(shouldCelebrate(2, 2), false, 'بدون تغییر مرحله جشنی نیست');
  assert.equal(shouldCelebrate(3, 1), false, 'نزول مرحله جشن ندارد');
  assert.equal(shouldCelebrate(0, 1), false, 'شروع کار جشن ندارد');
  assert.equal(shouldCelebrate(undefined, undefined), false);
  assert.equal(shouldCelebrate(1, 9), false, 'مرحلهٔ خارج از بازه');
});

test('celebrate: متن جشن فارسی و نام مرحله را دارد', () => {
  const text = celebrationText(leopardStageFor(5));
  assert.match(text.title, /پلنگ نگهبان/);
  assert.match(text.body, /۱۰۰/, 'سطح با ارقام فارسی');
  assert.match(text.body, /GUARDIAN/);
});

test('celebrate: مارک‌آپ اورلی دکمهٔ بستن و نقش دیالوگ دارد', () => {
  const html = celebrationMarkup(3);
  assert.match(html, /role="dialog"/);
  assert.match(html, /data-celebrate-close="1"/);
  assert.match(html, /نوجوان/);
});

test('share: کارت SVG نام کاربر را فرار می‌دهد (بدون XSS)', () => {
  const card = buildShareCard({ name: '<script>alert(1)</script>', stage: 3, progress: 42 });
  assert.ok(!card.includes('<script>'), 'تگ خام نباید داخل کارت باشد');
  assert.ok(card.includes('&lt;script&gt;'));
});

test('share: عرض نوار پیشرفت با درصد متناسب است', () => {
  const card = buildShareCard({ stage: 2, progress: 50 });
  assert.match(card, /width="150"/, '۵۰٪ از ۳۰۰ باید ۱۵۰ باشد');
  assert.match(card, /۵۰٪ پیشرفت/);
});

test('share: درصد نامعتبر و خارج از بازه ایمن است', () => {
  for (const bad of [NaN, undefined, -20, 400, 'abc']) {
    const card = buildShareCard({ stage: 1, progress: bad });
    assert.match(card, /^<svg/);
    assert.ok(!/width="NaN"/.test(card));
    assert.ok(!/width="-/.test(card));
  }
});

test('share: کارت هیچ منبع شبکه‌ای ندارد', () => {
  const card = buildShareCard({ name: 'علی', stage: 4, progress: 70, date: '۱۴۰۵/۰۸/۱۲' });
  const withoutNs = card.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
  assert.ok(!/https?:\/\//.test(withoutNs), 'تصویر کارت باید کامل آفلاین باشد');
});

test('share: مرحله در کارت با عنوان فارسی و کد می‌آید', () => {
  const card = buildShareCard({ stage: 5, progress: 100 });
  assert.match(card, /پلنگ نگهبان/);
  assert.match(card, /GUARDIAN/);
  assert.match(card, /۱۰۰/);
});

test('avatar image: هر پنج مرحله تصویر واقعی دارند', () => {
  for (const stage of [1, 2, 3, 4, 5]) {
    assert.equal(avatarImageFor(stage), `./assets/leopards/stage-${stage}.png`);
  }
});

test('avatar image: فایل هر پنج تصویر موجود و PNG معتبر است', () => {
  for (const stage of [1, 2, 3, 4, 5]) {
    const rel = avatarImageFor(stage).replace('./', '');
    const abs = join(ROOT, rel);
    assert.ok(existsSync(abs), `فایل ${rel} پیدا نشد`);
    assert.ok(statSync(abs).size > 10_000, `فایل ${rel} خیلی کوچک است`);
    const head = readFileSync(abs).subarray(0, 8).toString('hex');
    assert.equal(head, '89504e470d0a1a0a', `فایل ${rel} امضای PNG ندارد`);
  }
});

test('avatar image: نام فایل نسبی به پوشهٔ آواتارها وصل می‌شود', () => {
  assert.equal(avatarImageFor(2, { 2: 'stage-2.png' }), './assets/leopards/stage-2.png');
  assert.equal(avatarImageFor(2, { 2: './x.png' }), './x.png');
  assert.equal(avatarImageFor(2, { 2: 'https://cdn.test/a.png' }), 'https://cdn.test/a.png');
  assert.equal(avatarImageFor(9, { 9: 'z.png' }), null, 'مرحلهٔ خارج از بازه → پلهٔ اول');
});

test('avatar DOM: مرحلهٔ فعلی تصویر خودش را در آواتار می‌گذارد', () => {
  const nodes = mkFakeDoc(['leopard-avatar', 'leopard-progress', 'leopard-level-label']);
  const avatar = initLeopardAvatar(nodes);
  assert.ok(avatar, 'initLeopardAvatar باید نمونه بسازد');
  assert.equal(nodes['leopard-avatar'].firstElementChild?.tagName, 'img');
  assert.equal(nodes['leopard-avatar'].firstElementChild?.getAttribute('src'), './assets/leopards/stage-1.png');

  avatar.render(4, 55);
  assert.equal(nodes['leopard-avatar'].firstElementChild?.getAttribute('src'), './assets/leopards/stage-4.png');
  assert.equal(nodes['leopard-progress'].attrs['aria-valuenow'], '55');
  assert.match(nodes['leopard-level-label'].textContent, /جوان بالغ/);
});

test('avatar DOM: خطای بارگذاری تصویر → بازگشت به سیلوئت SVG', () => {
  const nodes = mkFakeDoc(['leopard-avatar', 'leopard-progress', 'leopard-level-label']);
  const avatar = initLeopardAvatar(nodes);
  avatar.render(3, 0);
  const img = nodes['leopard-avatar'].firstElementChild;
  img.dispatch('error');
  assert.equal(nodes['leopard-avatar'].firstElementChild?.tagName, 'svg');
});

test('escapeXml: کاراکترهای خطرناک XML خنثی می‌شوند', () => {
  assert.equal(escapeXml('<&>"\''), '&lt;&amp;&gt;&quot;&apos;');
  assert.equal(escapeXml(null), '');
});

/* ---------------- ابزار تست: DOM قلابی کوچک ---------------- */

function mkFakeDoc(ids) {
  const nodes = {};
  for (const id of ids) nodes[id] = new FakeNode(id);
  return {
    ...nodes,
    getElementById: (id) => nodes[id] ?? null,
    addEventListener() {},
    removeEventListener() {}
  };
}

class FakeNode {
  constructor(id) {
    this.id = id;
    this._html = '';
    this.attrs = {};
    this.style = { setProperty() {} };
    this.textContent = '';
    this.tagName = null;
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      contains: (c) => set.has(c)
    };
  }

  // مثل DOM واقعی: نوشتن innerHTML فرزند قبلی را دور می‌ریزد
  set innerHTML(v) { this._html = String(v); this._child = null; }
  get innerHTML() { return this._html; }

  get firstElementChild() {
    if (this._child) return this._child;
    const tag = /^<(svg|img)/i.exec(this.innerHTML)?.[1]?.toLowerCase();
    if (!tag) return null;
    const m = new FakeNode(`${this.id}-child`);
    m.tagName = tag;
    m._src = /src="([^"]+)"/.exec(this.innerHTML)?.[1] ?? null;
    m.getAttribute = (name) => (name === 'src' ? m._src : this.attrs[name] ?? null);
    m.setAttribute = (name, v) => { this.attrs[name] = v; };
    m.addEventListener = (type, fn) => { m._on = m._on || {}; m._on[type] = fn; };
    m.dispatch = (type) => m._on?.[type]?.();
    this._child = m;
    return m;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  querySelector() { return null; }
}

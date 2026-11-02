/**
 * صحنهٔ کوهستان اورست + آواتار پیشرفت پلنگ برفی
 * -------------------------------------------------
 * دو چیز در این ماژول ساخته می‌شود:
 *   ۱) صحنهٔ تزئینی کوهستان (SVG + CSS) — ماه، ستاره، برف، پارالاکس کوه‌ها
 *   ۲) آواتار کاربر که با ۵ مرحلهٔ سیستم ۵×۵ رشد می‌کند
 *      (تولهٔ نوزاد → تولهٔ در حال رشد → نوجوان → جوان بالغ → پلنگ نگهبان)
 *
 * اصول:
 *  - همه‌چیز درون‌برنامه‌ای است؛ هیچ درخواست شبکه‌ای ندارد (آفلاین‌فرست).
 *  - حرکت‌ها CSS-only هستند تا حلقهٔ JS روی موبایل اجرا نشود.
 *  - `prefers-reduced-motion` و «تب پنهان» باعث توقف انیمیشن می‌شوند.
 *  - در محیط بدون DOM (تست‌های Node) بی‌خطر است.
 */

const LS_KEY = 'everest_leopard_anim';

export const ANIM_FULL = 'full';
export const ANIM_REDUCED = 'reduced';
export const ANIM_OFF = 'off';

/* ------------------------------ حالت انیمیشن ------------------------------ */

/**
 * تصمیم حالت انیمیشن.
 * ترتیب اولویت: انتخاب صریح کاربر (off/full) → ترجیح سیستم → روشن.
 * @param {string|null|undefined} stored مقدار localStorage
 * @param {boolean} prefersReduced آیا کاربر «کاهش حرکت» خواسته است
 * @returns {'full'|'reduced'|'off'}
 */
export function resolveAnimationMode(stored, prefersReduced = false) {
  const value = String(stored ?? '').trim().toLowerCase();
  if (value === ANIM_OFF) return ANIM_OFF;
  if (value === ANIM_FULL) return ANIM_FULL; // انتخاب صریح کاربر بر سیستم اولویت دارد
  if (value === ANIM_REDUCED) return prefersReduced ? ANIM_REDUCED : ANIM_FULL;
  if (prefersReduced) return ANIM_REDUCED;
  return ANIM_FULL;
}

/**
 * حالت بعدی با کلیک کاربر.
 * @param {'full'|'reduced'|'off'} mode
 * @returns {'full'|'off'}
 */
export function nextAnimationMode(mode) {
  return mode === ANIM_OFF ? ANIM_FULL : ANIM_OFF;
}

/** آیا ذرات برف باید حرکت کنند؟ */
export function shouldAnimateParticles(mode) {
  return mode === ANIM_FULL;
}

/** کلاس ظرف صحنه برای یک حالت. */
export function sceneClass(mode) {
  if (mode === ANIM_OFF) return 'leopard-scene is-off';
  if (mode === ANIM_REDUCED) return 'leopard-scene is-still';
  return 'leopard-scene';
}

/* --------------------------------- صحنه ---------------------------------- */

/** دانه‌های برف؛ قطعی (بدون Math.random) تا خروجی تست پایدار بماند. */
export function snowFlakes(count = 18) {
  const flakes = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i * 37 + 11) % 400;
    const delay = ((i * 13) % 90) / 10;
    const duration = 7 + ((i * 7) % 9);
    const radius = 1 + ((i % 3) * 0.6);
    const drift = (i % 2 === 0 ? 1 : -1) * (6 + (i % 5) * 3);
    flakes.push({ x, delay, duration, radius, drift });
  }
  return flakes;
}

/** ستاره‌های آسمان. */
export function stars(count = 22) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i * 53 + 7) % 400;
    const y = 8 + ((i * 29) % 70);
    const delay = ((i * 17) % 60) / 10;
    const r = i % 5 === 0 ? 1.1 : 0.7;
    list.push({ x, y, delay, r });
  }
  return list;
}

/** مارک‌آپ SVG صحنهٔ کوهستان. */
export function sceneMarkup({ mode = ANIM_FULL } = {}) {
  const flakes = snowFlakes()
    .map(
      (f) =>
        `<circle class="snow" cx="${f.x}" cy="-6" r="${f.radius}" style="--delay:${f.delay}s;--dur:${f.duration}s;--drift:${f.drift}px"></circle>`
    )
    .join('');
  const starDots = stars()
    .map((s) => `<circle class="star" cx="${s.x}" cy="${s.y}" r="${s.r}" style="--delay:${s.delay}s"></circle>`)
    .join('');

  return `
<svg class="leopard-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" role="presentation" focusable="false" data-mode="${mode}">
  <defs>
    <linearGradient id="lp-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#050a18"></stop>
      <stop offset="55%" stop-color="#0a1730"></stop>
      <stop offset="100%" stop-color="#122544"></stop>
    </linearGradient>
    <radialGradient id="lp-moon" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e8f1ff" stop-opacity="0.95"></stop>
      <stop offset="60%" stop-color="#bcd4ff" stop-opacity="0.35"></stop>
      <stop offset="100%" stop-color="#bcd4ff" stop-opacity="0"></stop>
    </radialGradient>
    <linearGradient id="lp-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9fb8d8" stop-opacity="0.55"></stop>
      <stop offset="100%" stop-color="#5c7ba6" stop-opacity="0.25"></stop>
    </linearGradient>
    <linearGradient id="lp-mid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7b97bd" stop-opacity="0.5"></stop>
      <stop offset="100%" stop-color="#2c4666" stop-opacity="0.35"></stop>
    </linearGradient>
    <linearGradient id="lp-near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16233a"></stop>
      <stop offset="100%" stop-color="#080e1a"></stop>
    </linearGradient>
  </defs>

  <rect width="400" height="200" fill="url(#lp-sky)"></rect>
  <g class="stars">${starDots}</g>

  <g class="moon">
    <circle cx="308" cy="46" r="46" fill="url(#lp-moon)"></circle>
    <circle cx="308" cy="46" r="13" fill="#eaf2ff" opacity="0.9"></circle>
  </g>

  <g class="ridge ridge-far">
    <path d="M-20 132 L34 96 L62 116 L96 74 L128 112 L160 88 L196 122 L232 92 L268 124 L304 98 L340 126 L380 104 L420 132 L420 200 L-20 200 Z" fill="url(#lp-far)"></path>
  </g>
  <g class="ridge ridge-mid">
    <path d="M-20 160 L26 130 L58 148 L92 118 L126 146 L164 126 L204 154 L242 128 L282 156 L320 132 L360 158 L420 138 L420 200 L-20 200 Z" fill="url(#lp-mid)"></path>
  </g>
  <g class="ridge ridge-near">
    <path d="M-20 186 L40 168 L84 178 L124 164 L168 180 L214 168 L258 182 L300 170 L344 184 L400 172 L420 200 L-20 200 Z" fill="url(#lp-near)"></path>
  </g>

  <g class="leopard">
    <g class="leopard-body">
      <path class="lp-tail" d="M118 168 C104 166 96 158 92 148 C89 141 92 136 97 137 C102 138 101 143 103 149 C106 157 112 163 121 164 Z" fill="#dfe9f7" opacity="0.92"></path>
      <path class="lp-leg" d="M126 168 L124 178 L128 178 L130 168 Z" fill="#e6eefb"></path>
      <path class="lp-leg" d="M140 168 L139 178 L143 178 L144 168 Z" fill="#e6eefb"></path>
      <path class="lp-leg" d="M152 168 L151 178 L155 178 L156 168 Z" fill="#dfe8f6"></path>
      <path class="lp-leg" d="M164 168 L163 178 L167 178 L168 168 Z" fill="#dfe8f6"></path>
      <path class="lp-torso" d="M122 166 C128 154 150 152 162 158 C170 162 170 168 164 169 L126 169 C121 169 120 168 122 166 Z" fill="#eef4ff"></path>
      <path class="lp-head" d="M166 158 C172 152 180 152 183 157 C185 161 182 165 176 166 L168 166 C164 164 164 160 166 158 Z" fill="#eef4ff"></path>
      <path class="lp-ear" d="M168 156 L169 151 L173 155 Z" fill="#eef4ff"></path>
      <circle class="lp-eye" cx="178" cy="158.4" r="1.05" fill="#7ce6c4"></circle>
      <circle class="lp-spot" cx="132" cy="161" r="1.05" fill="#93a9c8" opacity="0.7"></circle>
      <circle class="lp-spot" cx="141" cy="158" r="0.95" fill="#93a9c8" opacity="0.65"></circle>
      <circle class="lp-spot" cx="150" cy="161" r="0.9" fill="#93a9c8" opacity="0.6"></circle>
    </g>
  </g>

  <g class="snowfall">${flakes}</g>
</svg>`.trim();
}

/**
 * نصب صحنه در صفحه. بازگشت `{ toggle, getMode, setMode, dispose }`.
 * برای محیط بدون DOM بی‌خطر است (`null`).
 */
export function initLeopardScene(
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : null
) {
  if (!doc) return null;
  const host = doc.getElementById('leopard-bg');
  if (!host) return null;

  let prefersReduced = false;
  try {
    prefersReduced = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch (_) { /* بدون matchMedia */ }

  let stored = null;
  try {
    stored = win?.localStorage?.getItem(LS_KEY) ?? null;
  } catch (_) { /* دسترسی به حافظه ندارد */ }

  let mode = resolveAnimationMode(stored, prefersReduced);

  // SVG فقط یک‌بار ساخته می‌شود؛ تغییر حالت با کلاس انجام می‌شود (بدون بازسازی DOM).
  host.innerHTML = sceneMarkup({ mode });

  const btn = () => doc.getElementById('leopard-btn');

  const apply = (next) => {
    mode = next;
    // ⚠️ className مستقیم استفاده نمی‌شود تا کلاس‌هایی مثل is-paused از دست نروند.
    host.classList.toggle('is-off', mode === ANIM_OFF);
    host.classList.toggle('is-still', mode === ANIM_REDUCED);
    const b = btn();
    if (b) {
      b.textContent = mode === ANIM_OFF ? '🐾' : '🐆';
      b.title = mode === ANIM_OFF ? 'نمایش انیمیشن کوهستان' : 'توقف انیمیشن کوهستان';
      b.setAttribute('aria-pressed', String(mode !== ANIM_OFF));
    }
  };

  const persist = () => {
    try {
      win?.localStorage?.setItem(LS_KEY, mode);
    } catch (_) { /* بی‌اهمیت */ }
  };

  const setMode = (next) => {
    apply(next);
    persist();
  };

  const toggle = () => {
    apply(nextAnimationMode(mode));
    persist();
    return mode;
  };

  // توقف مصرف باتری وقتی تب دیده نمی‌شود. هندلر یکتا (در صورت init دوباره).
  const onVisibility = () => {
    const hidden = doc.hidden === true || doc.webkitHidden === true;
    if (hidden) host.classList.add('is-paused');
    else host.classList.remove('is-paused');
  };
  if (typeof host.__leopardVis === 'function') {
    doc.removeEventListener?.('visibilitychange', host.__leopardVis);
  }
  host.__leopardVis = onVisibility;
  doc.addEventListener?.('visibilitychange', onVisibility);

  apply(mode);

  return {
    toggle,
    getMode: () => mode,
    setMode,
    dispose() {
      doc.removeEventListener?.('visibilitychange', onVisibility);
      if (host.__leopardVis === onVisibility) delete host.__leopardVis;
    }
  };
}

/* ---------------------- آواتار پیشرفت پلنگ برفی (۵ پله) ---------------------- */

/** تبدیل ارقام لاتین به فارسی برای نمایش در UI. */
export function faDigits(value) {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value ?? '').replace(/[0-9]/g, (d) => digits[Number(d)]);
}

/**
 * پله‌های رشد؛ مطابق نقشهٔ «SNOW LEOPARD AVATAR PROGRESSION» تیم.
 * `scale` عمداً محدود است (۰.۸۸ → ۱) تا رشد مثل «آیکون بداندازه» دیده نشود؛
 * تفاوت اصلی از نسبت سر/بدن، دُم، خال‌ها، سِبیل و قلاده می‌آید.
 */
export const LEOPARD_STAGES = [
  { stage: 1, key: 'cub-infant',  level: 1,   code: 'CUBLING',  titleFa: 'تولهٔ نوزاد',      minProgress: 0,   scale: 0.88, tail: 'short', spots: 1, whiskers: false, collar: false },
  { stage: 2, key: 'cub-growing', level: 10,  code: 'POUKLE',   titleFa: 'تولهٔ در حال رشد', minProgress: 10,  scale: 0.92, tail: 'curl',  spots: 2, whiskers: false, collar: false },
  { stage: 3, key: 'adolescent',  level: 25,  code: 'TRAINEE',  titleFa: 'نوجوان',           minProgress: 25,  scale: 0.96, tail: 'long',  spots: 3, whiskers: true,  collar: false },
  { stage: 4, key: 'young-adult', level: 50,  code: 'VANGUARD', titleFa: 'جوان بالغ',        minProgress: 50,  scale: 0.98, tail: 'long',  spots: 4, whiskers: true,  collar: false },
  { stage: 5, key: 'guardian',    level: 100, code: 'GUARDIAN', titleFa: 'پلنگ نگهبان',      minProgress: 100, scale: 1,    tail: 'long',  spots: 4, whiskers: true,  collar: true }
];

/**
 * پلهٔ رشد بر اساس شمارهٔ مرحله (۱ تا ۵).
 * ورودی غیرصحیح یا خارج از بازه به پلهٔ اول برمی‌گردد (بدون کرش).
 * @param {number} stage
 */
export function leopardStageFor(stage) {
  const n = Math.trunc(Number(stage));
  if (!Number.isFinite(n)) return LEOPARD_STAGES[0];
  const clamped = Math.min(LEOPARD_STAGES.length, Math.max(1, n));
  return LEOPARD_STAGES[clamped - 1];
}

/**
 * پلهٔ رشد بر اساس درصد پیشرفت (۰ تا ۱۰۰).
 * مرزها مطابق تصویر مرجع: 0 / 10 / 25 / 50 / 100.
 * اگر مقدار ۰ تا ۱ داده شود، به‌عنوان کسر تفسیر می‌شود.
 * @param {number} progressPercent
 */
export function leopardStageForProgress(progressPercent) {
  const raw = Number(progressPercent);
  let p = Number.isFinite(raw) ? raw : 0;
  if (p > 0 && p <= 1) p *= 100;
  const safe = Math.min(100, Math.max(0, p));
  let chosen = LEOPARD_STAGES[0];
  for (const item of LEOPARD_STAGES) {
    if (safe >= item.minProgress) chosen = item;
  }
  return chosen;
}

/**
 * مارک‌آپ SVG آواتار برای یک پله.
 * @param {{stage?: number}|number} [input] شمارهٔ مرحله یا خود شیء پله
 */
export function avatarMarkup(input = 1) {
  const item = input && typeof input === 'object' && 'spots' in input ? input : leopardStageFor(input);

  // نسبت سر/بدن با رشد تغییر می‌کند: توله سرِ درشت‌تر و بدن کوچک‌تر دارد.
  const headR = 13.4 - (item.stage - 1) * 0.55;
  const bodyRx = 14 + (item.stage - 1) * 0.9;
  const eyeR = 2.4 - (item.stage - 1) * 0.1;

  const spots = Array.from({ length: item.spots }, (_, i) => {
    const cx = 30 + ((i * 8) % 15);
    const cy = 39 - ((i * 6) % 10);
    return `<circle class="av-spot" cx="${cx}" cy="${cy}" r="2.2" opacity="0.7"></circle>`;
  }).join('');

  const tailPath = item.tail === 'short'
    ? 'M22 48 C14 47 10 42 9 36 C8.4 33 10 31.5 12 32.2 C14 33 13.4 35.6 14.4 38.6 C15.4 41.6 18 44.8 22.6 45.4 Z'
    : item.tail === 'curl'
      ? 'M22 48 C12 48 5 42 4 34 C3.4 30 5.4 27.6 8 28.4 C10.6 29.2 9.6 32.4 11 36 C12.6 40 16.4 43.6 22 44.4 Z'
      : 'M22 48 C10 49 1 42 0.6 32 C0.2 26 3 22.6 6.2 23.8 C9.4 25 8 28.6 9.8 33 C11.8 37.8 16 41.6 22 42.6 Z';

  const collar = item.collar
    ? `<path class="av-collar" d="M27 33.5 C30.5 35.6 35 35.6 38.6 33.4" stroke="#7dd3fc" stroke-width="1.7" fill="none" stroke-linecap="round"></path>
       <circle class="av-gem" cx="32.8" cy="35.4" r="1.9" fill="#22d3ee"></circle>
       <circle class="av-gem-shine" cx="32.2" cy="34.8" r="0.6" fill="#ecfeff"></circle>`
    : '';

  const whiskers = item.whiskers
    ? `<path d="M45.5 31 L49.4 30.2 M45.5 33 L49.6 33.6" stroke="#cbd5e1" stroke-width="1" opacity="0.85" stroke-linecap="round"></path>`
    : '';

  return `<svg class="leopard-avatar-svg" viewBox="2 14 48 44" aria-hidden="true" focusable="false" data-stage="${item.stage}">
  <g transform="translate(8 6) scale(${item.scale})">
    <path class="av-tail" d="${tailPath}" fill="#e2ebf8"></path>
    <ellipse class="av-body" cx="32" cy="44" rx="${bodyRx}" ry="9" fill="#eef4ff"></ellipse>
    <path class="av-leg" d="M22 51 L21.4 56 L24.6 56 L25.4 51 Z" fill="#e6eefb"></path>
    <path class="av-leg" d="M29 52 L28.6 56 L31.6 56 L32 52 Z" fill="#dfe8f6"></path>
    <path class="av-leg" d="M38 52 L38 56 L41 56 L41.2 52 Z" fill="#e6eefb"></path>
    <path class="av-leg" d="M44 51 L44.6 56 L47.6 56 L47 51 Z" fill="#dfe8f6"></path>
    <circle class="av-head" cx="35" cy="32" r="${headR}" fill="#f3f8ff"></circle>
    <path class="av-ear" d="M27.4 23 L26 16.8 L32.4 21 Z" fill="#eef4ff"></path>
    <path class="av-ear" d="M42 23 L44 17 L37.6 21 Z" fill="#eef4ff"></path>
    <path class="av-ear-inner" d="M28.4 22.4 L27.8 19.4 L30.8 21.6 Z" fill="#bcd0e8"></path>
    <path class="av-ear-inner" d="M41.2 22.4 L43 18.8 L39.4 21.6 Z" fill="#bcd0e8"></path>
    <circle class="av-eye" cx="31.6" cy="31" r="${eyeR}" fill="#0f172a"></circle>
    <circle class="av-eye" cx="39.2" cy="31" r="${eyeR}" fill="#0f172a"></circle>
    <circle class="av-eye-shine" cx="32.2" cy="30.4" r="0.8" fill="#e0f2fe"></circle>
    <circle class="av-eye-shine" cx="39.8" cy="30.4" r="0.8" fill="#e0f2fe"></circle>
    <path class="av-nose" d="M34.6 35.4 L37.2 35.4 L35.9 37.2 Z" fill="#94a3b8"></path>
    ${whiskers}
    <g class="av-spots">${spots}</g>
    ${collar}
  </g>
</svg>`.trim();
}

/**
 * نصب آواتار در هدر.
 * `render(stage, progress)` — درصد پیشرفت اختیاری است.
 */
export function initLeopardAvatar(
  doc = typeof document !== 'undefined' ? document : null,
  { hostId = 'leopard-avatar', ringId = 'leopard-progress', labelId = 'leopard-level-label', interactive = true } = {}
) {
  if (!doc) return null;
  const host = doc.getElementById(hostId);
  if (!host) return null;

  let lastStage = -1;

  const paintRing = (progress) => {
    const ring = ringId ? doc.getElementById(ringId) : null;
    if (!ring) return 0;
    const raw = Number(progress);
    const pct = Number.isFinite(raw) ? Math.min(100, Math.max(0, Math.round(raw))) : 0;
    ring.setAttribute('data-progress', String(pct));
    ring.style.setProperty('--p', `${pct}%`);
    ring.setAttribute('role', 'progressbar');
    ring.setAttribute('aria-valuemin', '0');
    ring.setAttribute('aria-valuemax', '100');
    ring.setAttribute('aria-valuenow', String(pct));
    return pct;
  };

  const render = (stage, progress) => {
    const item = leopardStageFor(stage);
    paintRing(progress);

    // اگر مرحله عوض نشده، DOM بازسازی نمی‌شود تا انیمیشن‌ها ری‌استارت نشوند
    // و صفحه‌خوان دوباره کل گرافیک را نخواند.
    if (item.stage === lastStage) return item;
    lastStage = item.stage;

    // اگر تصویر واقعی برای این مرحله تنظیم شده باشد، جای سیلوئت نمایش داده
    // می‌شود؛ در صورت خطای بارگذاری، خودکار به سیلوئت برمی‌گردیم.
    const image = avatarImageFor(item.stage);
    if (image) {
      host.innerHTML = `<img class="leopard-avatar-img" src="${image}" alt="" loading="lazy" decoding="async">`;
      const img = host.firstElementChild;
      img?.addEventListener?.('error', () => {
        host.innerHTML = avatarMarkup(item);
      }, { once: true });
    } else {
      host.innerHTML = avatarMarkup(item);
    }
    host.classList.remove('level-1', 'level-2', 'level-3', 'level-4', 'level-5');
    host.classList.add('leopard-avatar', `level-${item.stage}`);
    host.setAttribute('data-level', String(item.level));
    host.setAttribute('title', `${item.titleFa} — سطح ${faDigits(item.level)} (${item.code})`);

    const label = labelId ? doc.getElementById(labelId) : null;
    if (label) {
      label.textContent = `LVL ${faDigits(item.level)} • ${item.titleFa}`;
      label.setAttribute('aria-label', `مرحلهٔ ${faDigits(item.stage)} از ۵ — ${item.titleFa}`);
      label.setAttribute('title', `${item.code} — سطح ${faDigits(item.level)}`);
    }
    return item;
  };

  render(1, 0);
  return { render, getStage: () => lastStage, interactive };
}


/* =====================================================================
 * تصویر واقعی آواتار (اختیاری)
 * ---------------------------------------------------------------------
 * اگر تصاویر پنج مرحله در `assets/leopards/stage-N.png` موجود باشند،
 * جای سیلوئت SVG نمایش داده می‌شوند. اگر فایل نبود یا خراب بود، خودکار
 * به سیلوئت برمی‌گردیم تا UI هرگز خالی نماند.
 * ===================================================================== */

export const LEOPARD_IMG_DIR = './assets/leopards/';

/** نقشهٔ مرحله → فایل تصویر. برای فعال‌سازی، مقدار را به نام فایل بدهید. */
export const LEOPARD_IMAGES = { 1: null, 2: null, 3: null, 4: null, 5: null };

/**
 * آدرس تصویر آواتار برای یک مرحله (یا null اگر تصویری تنظیم نشده است).
 * @param {number} stage
 * @param {Record<number,string|null>} [images]
 */
export function avatarImageFor(stage, images = LEOPARD_IMAGES) {
  const item = leopardStageFor(stage);
  const file = images?.[item.stage] ?? null;
  if (!file) return null;
  if (/^(https?:)?\/\//i.test(file)) return file;
  return file.startsWith('./') || file.startsWith('/') ? file : LEOPARD_IMG_DIR + file;
}

/* =====================================================================
 * جشن ارتقای مرحله
 * ===================================================================== */

export const SEEN_STAGE_KEY = 'everest_leopard_seen_stage';

/**
 * آیا باید جشن گرفت؟ فقط وقتی مرحله واقعاً بالا رفته باشد.
 * @param {number} previous آخرین مرحله‌ای که کاربر دیده است
 * @param {number} current مرحلهٔ فعلی
 */
export function shouldCelebrate(previous, current) {
  const prev = Math.trunc(Number(previous));
  const cur = Math.trunc(Number(current));
  if (!Number.isFinite(prev) || !Number.isFinite(cur)) return false;
  return cur > prev && cur >= 2 && cur <= LEOPARD_STAGES.length;
}

/** متن فارسی جشن برای یک پله. */
export function celebrationText(item) {
  const stage = item ?? LEOPARD_STAGES[0];
  return {
    title: `${stage.titleFa} شدی!`,
    body: `به سطح ${faDigits(stage.level)} رسیدی — ${stage.code}`,
    hint: 'ادامه بده؛ پلهٔ بعد نزدیک است.'
  };
}

/** مارک‌آپ اورلی جشن. */
export function celebrationMarkup(stage) {
  const item = leopardStageFor(stage);
  const text = celebrationText(item);
  return `<div class="celebrate-card" role="dialog" aria-modal="true" aria-labelledby="celebrate-title">
  <div class="celebrate-glow" aria-hidden="true"></div>
  <div class="celebrate-avatar" aria-hidden="true">${avatarMarkup(item)}</div>
  <h2 id="celebrate-title" class="celebrate-title">${text.title}</h2>
  <p class="celebrate-body">${text.body}</p>
  <p class="celebrate-hint">${text.hint}</p>
  <button type="button" class="celebrate-btn" data-celebrate-close="1">ادامه می‌دهم 🚀</button>
</div>`;
}

/**
 * نمایش جشن در صفحه. با کلیک روی دکمه یا بعد از `ttl` میلی‌ثانیه بسته می‌شود.
 * در محیط بدون DOM بی‌خطر است.
 */
export function showCelebration(stage, doc = typeof document !== 'undefined' ? document : null, ttl = 5200) {
  if (!doc) return false;
  const host = doc.getElementById('celebrate-root');
  if (!host) return false;
  host.innerHTML = celebrationMarkup(stage);
  host.classList.add('is-open');
  host.setAttribute('aria-hidden', 'false');

  let timer = null;
  const close = () => {
    if (timer) clearTimeout(timer);
    host.classList.remove('is-open');
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    doc.removeEventListener?.('click', onClick);
    doc.removeEventListener?.('keydown', onKey);
  };
  const onClick = (e) => {
    if (e?.target?.closest?.('[data-celebrate-close]') || e?.target === host) close();
  };
  const onKey = (e) => {
    if (e?.key === 'Escape' || e?.key === 'Enter') close();
  };
  doc.addEventListener?.('click', onClick);
  doc.addEventListener?.('keydown', onKey);
  timer = setTimeout(close, ttl);
  return true;
}

/* =====================================================================
 * کارت اشتراک‌گذاری پیشرفت
 * ===================================================================== */

/** فرار دادن متن برای قرار گرفتن داخل SVG/XML. */
export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * ساخت کارت پیشرفت به‌صورت SVG (بدون هیچ منبع خارجی).
 * @param {{name?:string, stage?:number, progress?:number, date?:string}} [opts]
 */
export function buildShareCard({ name = 'عضو تیم اورست', stage = 1, progress = 0, date = '' } = {}) {
  const item = leopardStageFor(stage);
  const rawPct = Number(progress);
  const pct = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, Math.round(rawPct))) : 0;
  const barW = Math.round((pct / 100) * 300);
  const safeName = escapeXml(name);
  const safeDate = escapeXml(date);

  // آواتار SVG را داخل کارت جاسازی می‌کنیم (بدون <svg> تودرتو معتبر نیست،
  // پس محتوای گروه را جدا می‌گیریم).
  const avatarInner = avatarMarkup(item)
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 460" width="360" height="460" dir="rtl" font-family="Vazirmatn, system-ui, sans-serif">
  <defs>
    <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1220"></stop>
      <stop offset="100%" stop-color="#122544"></stop>
    </linearGradient>
    <linearGradient id="card-bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"></stop>
      <stop offset="100%" stop-color="#38bdf8"></stop>
    </linearGradient>
  </defs>
  <rect width="360" height="460" fill="url(#card-bg)"></rect>
  <text x="180" y="46" text-anchor="middle" fill="#93c5fd" font-size="12" letter-spacing="2">EVEREST 5&#215;5</text>
  <text x="180" y="76" text-anchor="middle" fill="#e2e8f0" font-size="17" font-weight="700">${safeName}</text>

  <circle cx="180" cy="180" r="78" fill="#0f172a" stroke="#22d3ee" stroke-opacity="0.35" stroke-width="1.5"></circle>
  <g transform="translate(120 120) scale(2)">${avatarInner}</g>

  <text x="180" y="292" text-anchor="middle" fill="#a5f3fc" font-size="15" font-weight="700">${escapeXml(item.titleFa)}</text>
  <text x="180" y="314" text-anchor="middle" fill="#94a3b8" font-size="11">${escapeXml(item.code)} &#183; سطح ${escapeXml(faDigits(item.level))}</text>

  <rect x="30" y="342" width="300" height="12" rx="6" fill="#1e293b"></rect>
  <rect x="30" y="342" width="${barW}" height="12" rx="6" fill="url(#card-bar)"></rect>
  <text x="330" y="376" text-anchor="end" fill="#cbd5e1" font-size="11">${escapeXml(faDigits(pct))}٪ پیشرفت</text>
  ${safeDate ? `<text x="30" y="376" text-anchor="start" fill="#64748b" font-size="10">${safeDate}</text>` : ''}
  <text x="180" y="428" text-anchor="middle" fill="#475569" font-size="9">سیستم ۵&#215;۵ تیم اورست — نیوشانیک</text>
</svg>`.trim();
}

/**
 * آماده‌سازی کارت برای اشتراک‌گذاری/دانلود: SVG → PNG با canvas.
 * در مرورگر قدیمی یا خطای canvas، همان SVG را برمی‌گرداند.
 */
export async function shareCard({ name, stage, progress, date } = {}, win = typeof window !== 'undefined' ? window : null) {
  const svg = buildShareCard({ name, stage, progress, date });
  if (!win?.document) return { ok: false, reason: 'no-dom' };

  let file = null;
  try {
    const blob = new win.Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = win.URL.createObjectURL(blob);
    file = await new Promise((resolve) => {
      const img = new win.Image();
      img.onload = () => {
        try {
          const canvas = win.document.createElement('canvas');
          canvas.width = 720;
          canvas.height = 920;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => resolve(b), 'image/png');
        } catch (_) { resolve(null); }
        finally { win.URL.revokeObjectURL(url); }
      };
      img.onerror = () => { win.URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  } catch (_) {
    file = null;
  }

  if (file && typeof win.navigator?.share === 'function' && typeof win.File === 'function') {
    try {
      const f = new win.File([file], 'everest-progress.png', { type: 'image/png' });
      if (!win.navigator.canShare || win.navigator.canShare({ files: [f] })) {
        await win.navigator.share({ files: [f], title: 'پیشرفت من در سیستم ۵×۵', text: 'مسیر رشد من در تیم اورست' });
        return { ok: true, method: 'share' };
      }
    } catch (_) { /* کاربر لغو کرد یا پشتیبانی نیست */ }
  }

  if (file) {
    try {
      const a = win.document.createElement('a');
      a.href = win.URL.createObjectURL(file);
      a.download = 'everest-progress.png';
      win.document.body.appendChild(a);
      a.click();
      a.remove();
      return { ok: true, method: 'download' };
    } catch (_) { /* ادامه به SVG */ }
  }

  return { ok: true, method: 'svg', svg };
}

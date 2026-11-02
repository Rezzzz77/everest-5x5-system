/**
 * صحنهٔ کوهستان اورست + ببر برفی (پلنگ کوهستان)
 * ---------------------------------------------------
 * یک صحنهٔ تزئینی، کاملاً درون‌برنامه‌ای (SVG + CSS) و بدون هیچ درخواست شبکه،
 * چون اپ باید آفلاین‌فرست بماند و نباید به CDN وابسته شود.
 *
 * اصول پیاده‌سازی:
 *  - همهٔ حرکت‌ها با CSS transform انجام می‌شوند (بدون حلقهٔ JS؛ باتری موبایل).
 *  - با `prefers-reduced-motion` خودکار به حالت ساکن می‌رود.
 *  - با پنهان شدن تب، انیمیشن متوقف می‌شود (`visibilitychange`).
 *  - انتخاب کاربر در `localStorage` نگه داشته می‌شود.
 */

const LS_KEY = 'everest_leopard_anim';

export const ANIM_FULL = 'full';
export const ANIM_REDUCED = 'reduced';
export const ANIM_OFF = 'off';

/**
 * تصمیم حالت انیمیشن از روی تنظیم ذخیره‌شده و ترجیح سیستم.
 * مقدار نامعتبر/خالی → پیش‌فرض روشن.
 *
 * @param {string|null|undefined} stored مقدار localStorage
 * @param {boolean} prefersReduced آیا کاربر «کاهش حرکت» خواسته است
 * @returns {'full'|'reduced'|'off'}
 */
export function resolveAnimationMode(stored, prefersReduced = false) {
  const value = String(stored ?? '').trim().toLowerCase();
  if (value === ANIM_OFF) return ANIM_OFF;
  if (prefersReduced) return ANIM_REDUCED;
  return ANIM_FULL;
}

/**
 * حالت بعدی هنگام کلیک کاربر (فقط روشن/خاموش ساده).
 * @param {'full'|'reduced'|'off'} mode
 * @returns {'full'|'off'}
 */
export function nextAnimationMode(mode) {
  return mode === ANIM_OFF ? ANIM_FULL : ANIM_OFF;
}

/** آیا باید ذرات برف حرکت کنند؟ (در حالت reduced ساکن می‌مانند) */
export function shouldAnimateParticles(mode) {
  return mode === ANIM_FULL;
}

/** کلاسی که روی ریشهٔ صحنه گذاشته می‌شود. */
export function sceneClass(mode) {
  if (mode === ANIM_OFF) return 'leopard-scene is-off';
  if (mode === ANIM_REDUCED) return 'leopard-scene is-still';
  return 'leopard-scene';
}

/** ذرات برف با موقعیت/تأخیر قطعی (بدون Math.random تا خروجی پایدار بماند). */
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

/**
 * مارک‌آپ SVG صحنه.
 * @param {{mode?: 'full'|'reduced'|'off'}} [options]
 */
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
<svg class="leopard-svg" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" role="presentation" focusable="false">
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
      <path class="lp-leg lp-leg-a" d="M126 168 L124 178 L128 178 L130 168 Z" fill="#e6eefb"></path>
      <path class="lp-leg lp-leg-b" d="M140 168 L139 178 L143 178 L144 168 Z" fill="#e6eefb"></path>
      <path class="lp-leg lp-leg-c" d="M152 168 L151 178 L155 178 L156 168 Z" fill="#dfe8f6"></path>
      <path class="lp-leg lp-leg-d" d="M164 168 L163 178 L167 178 L168 168 Z" fill="#dfe8f6"></path>
      <path class="lp-torso" d="M122 166 C128 154 150 152 162 158 C170 162 170 168 164 169 L126 169 C121 169 120 168 122 166 Z" fill="#eef4ff"></path>
      <path class="lp-head" d="M166 158 C172 152 180 152 183 157 C185 161 182 165 176 166 L168 166 C164 164 164 160 166 158 Z" fill="#eef4ff"></path>
      <path class="lp-ear" d="M168 156 L169 151 L173 155 Z" fill="#eef4ff"></path>
      <circle class="lp-eye" cx="178" cy="158.4" r="1.05" fill="#7ce6c4"></circle>
      <circle class="lp-spot" cx="132" cy="161" r="1.05" fill="#93a9c8" opacity="0.7"></circle>
      <circle class="lp-spot" cx="141" cy="158" r="0.95" fill="#93a9c8" opacity="0.65"></circle>
      <circle class="lp-spot" cx="150" cy="161" r="0.9" fill="#93a9c8" opacity="0.6"></circle>
      <circle class="lp-spot" cx="157" cy="157" r="0.85" fill="#93a9c8" opacity="0.55"></circle>
    </g>
  </g>

  <g class="snowfall">${flakes}</g>
</svg>`.trim();
}

/**
 * نصب صحنه در صفحه. در محیط بدون DOM (تست) بی‌خطر است.
 */
export function initLeopardScene(doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' ? window : null) {
  if (!doc) return null;
  const host = doc.getElementById('leopard-bg');
  if (!host) return null;

  let prefersReduced = false;
  try {
    prefersReduced = Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch (_) { /* بدون matchMedia */ }

  let stored = null;
  try { stored = win?.localStorage?.getItem(LS_KEY) ?? null; } catch (_) { /* دسترسی ندارد */ }

  let mode = resolveAnimationMode(stored, prefersReduced);
  host.innerHTML = sceneMarkup({ mode });
  host.className = sceneClass(mode);

  const apply = (next) => {
    mode = next;
    host.className = sceneClass(mode);
    const btn = doc.getElementById('leopard-btn');
    if (btn) {
      btn.textContent = mode === ANIM_OFF ? '🐾' : '🐆';
      btn.title = mode === ANIM_OFF ? 'نمایش انیمیشن کوهستان' : 'توقف انیمیشن کوهستان';
      btn.setAttribute('aria-pressed', String(mode !== ANIM_OFF));
    }
  };

  const toggle = () => {
    apply(nextAnimationMode(mode));
    try { win?.localStorage?.setItem(LS_KEY, mode === ANIM_OFF ? 'off' : 'on'); } catch (_) { /* بی‌اهمیت */ }
  };

  // توقف انیمیشن وقتی تب دیده نمی‌شود (باتری)
  if (win?.addEventListener) {
    doc.addEventListener?.('visibilitychange', () => {
      host.classList.toggle('is-paused', doc.hidden === true);
    });
  }

  apply(mode);
  return { toggle, getMode: () => mode, setMode: apply };
}


/* =====================================================================
 * آواتار پیشرفت پلنگ برفی
 * ---------------------------------------------------------------------
 * کاربر با طی کردن ۵ مرحلهٔ سیستم ۵×۵ رشد می‌کند:
 *   ۱) تولهٔ نوزاد  → ۲) تولهٔ در حال رشد → ۳) نوجوان
 *   → ۴) جوان بالغ → ۵) پلنگ نگهبان (بالغ و آراسته)
 * این نگاشت همان «SNOW LEOPARD AVATAR PROGRESSION» است که تیم تعریف کرده.
 * ===================================================================== */

/** تبدیل ارقام لاتین به فارسی برای نمایش در UI. */
export function faDigits(value) {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value ?? '').replace(/[0-9]/g, (d) => digits[Number(d)]);
}

/** پله‌های رشد؛ آیکون‌ها در UI از همین جدول ساخته می‌شوند. */
export const LEOPARD_STAGES = [
  { stage: 1, key: 'cub-infant', level: 1,   code: 'CUBLING',  titleFa: 'تولهٔ نوزاد',      minProgress: 0,   scale: 0.62, tail: 'short', spots: 1, collar: false },
  { stage: 2, key: 'cub-growing', level: 10, code: 'POUKLE',   titleFa: 'تولهٔ در حال رشد', minProgress: 10,  scale: 0.74, tail: 'curl',  spots: 3, collar: false },
  { stage: 3, key: 'adolescent', level: 25,  code: 'TRAINEE',  titleFa: 'نوجوان',           minProgress: 25,  scale: 0.84, tail: 'long',  spots: 4, collar: false },
  { stage: 4, key: 'young-adult', level: 50, code: 'VANGUARD', titleFa: 'جوان بالغ',        minProgress: 50,  scale: 0.93, tail: 'long',  spots: 5, collar: false },
  { stage: 5, key: 'guardian',   level: 100, code: 'GUARDIAN', titleFa: 'پلنگ نگهبان',      minProgress: 100, scale: 1,    tail: 'long',  spots: 6, collar: true }
];

/**
 * پلهٔ رشد بر اساس شمارهٔ مرحله (۱ تا ۵). مقدار خارج از بازه به نزدیک‌ترین
 * پله محدود می‌شود تا ورودی خراب باعث crash نشود.
 * @param {number} stage
 */
export function leopardStageFor(stage) {
  const n = Number(stage);
  if (!Number.isFinite(n)) return LEOPARD_STAGES[0];
  const idx = Math.min(LEOPARD_STAGES.length - 1, Math.max(0, Math.round(n) - 1));
  return LEOPARD_STAGES[idx];
}

/**
 * پلهٔ رشد بر اساس درصد پیشرفت (۰ تا ۱۰۰).
 * مرزها دقیقاً مثل تصویر مرجع: 0 / 10 / 25 / 50 / 100.
 * @param {number} progressPercent
 */
export function leopardStageForProgress(progressPercent) {
  const p = Number(progressPercent);
  const safe = Number.isFinite(p) ? Math.min(100, Math.max(0, p)) : 0;
  let chosen = LEOPARD_STAGES[0];
  for (const item of LEOPARD_STAGES) {
    if (safe >= item.minProgress) chosen = item;
  }
  return chosen;
}

/**
 * مارک‌آپ آواتار برای یک پله.
 * @param {{stage?: number}|number} [input] شمارهٔ مرحله یا خود پله
 */
export function avatarMarkup(input = 1) {
  const item = typeof input === 'object' && input ? input : leopardStageFor(input);
  const spots = Array.from({ length: item.spots }, (_, i) => {
    const cx = 30 + ((i * 7) % 17);
    const cy = 40 - ((i * 5) % 11);
    return `<circle class="av-spot" cx="${cx}" cy="${cy}" r="1.5" opacity="0.75"></circle>`;
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

  const whiskers = item.stage >= 3
    ? `<path d="M44.5 31 L49 30 M44.5 33 L49.2 33.6" stroke="#cbd5e1" stroke-width="0.7" opacity="0.8" stroke-linecap="round"></path>`
    : '';

  return `<svg class="leopard-avatar-svg" viewBox="0 0 60 60" role="img" aria-label="${item.titleFa}">
  <g transform="translate(8 6) scale(${item.scale})">
    <path class="av-tail" d="${tailPath}" fill="#e2ebf8"></path>
    <ellipse class="av-body" cx="32" cy="44" rx="15" ry="9" fill="#eef4ff"></ellipse>
    <path class="av-leg" d="M22 51 L21.4 56 L24.6 56 L25.4 51 Z" fill="#e6eefb"></path>
    <path class="av-leg" d="M29 52 L28.6 56 L31.6 56 L32 52 Z" fill="#dfe8f6"></path>
    <path class="av-leg" d="M38 52 L38 56 L41 56 L41.2 52 Z" fill="#e6eefb"></path>
    <path class="av-leg" d="M44 51 L44.6 56 L47.6 56 L47 51 Z" fill="#dfe8f6"></path>
    <circle class="av-head" cx="35" cy="32" r="11.5" fill="#f3f8ff"></circle>
    <path class="av-ear" d="M27.4 23 L26 16.8 L32.4 21 Z" fill="#eef4ff"></path>
    <path class="av-ear" d="M42 23 L44 17 L37.6 21 Z" fill="#eef4ff"></path>
    <path class="av-ear-inner" d="M28.4 22.4 L27.8 19.4 L30.8 21.6 Z" fill="#bcd0e8"></path>
    <path class="av-ear-inner" d="M41.2 22.4 L43 18.8 L39.4 21.6 Z" fill="#bcd0e8"></path>
    <circle class="av-eye" cx="31.6" cy="31" r="1.9" fill="#0f172a"></circle>
    <circle class="av-eye" cx="39.2" cy="31" r="1.9" fill="#0f172a"></circle>
    <circle class="av-eye-shine" cx="32.2" cy="30.4" r="0.7" fill="#e0f2fe"></circle>
    <circle class="av-eye-shine" cx="39.8" cy="30.4" r="0.7" fill="#e0f2fe"></circle>
    <path class="av-nose" d="M34.6 35.4 L37.2 35.4 L35.9 37.2 Z" fill="#94a3b8"></path>
    ${whiskers}
    <g class="av-spots">${spots}</g>
    ${collar}
  </g>
</svg>`.trim();
}

/**
 * نصب آواتار در هدر و به‌روزرسانی آن با مرحله/پیشرفت.
 */
export function initLeopardAvatar(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null;
  const host = doc.getElementById('leopard-avatar');
  if (!host) return null;

  const render = (stage) => {
    const item = leopardStageFor(stage);
    host.innerHTML = avatarMarkup(item);
    host.className = `leopard-avatar level-${item.stage}`;
    host.setAttribute('data-level', String(item.level));
    host.setAttribute('title', `${item.titleFa} — سطح ${faDigits(item.level)} (${item.code})`);
    const label = doc.getElementById('leopard-level-label');
    if (label) label.textContent = item.code;
    const ring = doc.getElementById('leopard-progress');
    if (ring) {
      const pct = Number(ring.getAttribute('data-progress') || 0);
      ring.style.setProperty('--p', `${Math.min(100, Math.max(0, pct))}%`);
    }
    return item;
  };

  render(1);
  return { render };
}

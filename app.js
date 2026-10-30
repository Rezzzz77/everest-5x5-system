/**
 * منطق اصلی اپلیکیشن
 * از db.js برای ذخیره‌سازی استفاده می‌کند
 */

import {
  loadFromStorage, saveToStorage, syncState, loadFromCloud, isSupabaseConfigured, testConnection,
  clearStorage, getDefaultData, saveProfile, sendBackupToN8n, exportStateAsJson, importStateFromJson,
  loadTeamMembers, approveMemberStage, requestStageApproval
} from './src/db.js';
import {
  getSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig, validateConfig,
  getN8nConfig, saveN8nConfig, validateN8nConfig,
  getDeepSeekConfig, saveDeepSeekConfig, clearDeepSeekConfig, validateDeepSeekConfig, isDeepSeekConfigured
} from './src/config.js';
import {
  callDeepSeekChat, testDeepSeekConnection, buildInvitePrompt, buildObjectionPrompt, buildCoachReviewPrompt
} from './src/ai.js';
import {
  sendOtp, verifyOtp, signOut, loadSession, currentUser, isValidEmail, authErrorText, consumeAuthRedirect,
  signInWithPassword, signUpWithPassword
} from './src/auth.js';
import { generateCoachCard, getStageTheme } from './src/coach.js';
import { getHighestUnlockedStage, isStageUnlocked, getCriteriaStage, isWaitingForApproval } from './src/stages.js';
import { escapeHtml, phoneDigits, resetDailyCounters, calculateMemberHealth, isEveningReportTime, contactsToCsv, teamToCsv, initialList30ToCsv } from './src/utils.js';

export { getHighestUnlockedStage };

// وضعیت اپلیکیشن
let appState = loadFromStorage();
let currentProdIdx = 0;
let activeStageView = 1;
let timerId = null;

// کاتالوگ محصولات نیوشانیک
const newshaProducts = [
  {
    category: 'دمنوش‌های ترکیبی مثلثی',
    name: 'دمنوش حس خوب زندگی (بادرنجبویه، بهارنارنج، زعفران)',
    benefits: ['کاهش استرس و تنش عصبی روزانه', 'نشاط‌آور طبیعی به واسطه زعفران', 'بهبود کیفیت خواب و آرامش گوارش'],
    usage: '۱ تی‌بگ در آب ۹۰ درجه به مدت ۱۰ دقیقه؛ بهترین زمان: عصر یا ۱ ساعت قبل از خواب.',
    faqQ: 'آیا در طول روز خواب‌آلودگی می‌آورد؟',
    faqA: 'مصرف یک فنجان در عصر به دلیل زعفران نشاط‌آور است و در شب به خواب راحت کمک می‌کند.',
    pitch: '«اگر بعد از یک روز شلوغ دنبال یه نوشیدنی گیاهی هستی که هم خستگی ذهنت رو رفع کنه و هم شب راحت‌تر بخوابی، دمنوش حس خوب بهترین انتخابه.»'
  },
  {
    category: 'مخلوط چای سبز',
    name: 'چای سبز و نعناع فلفلی',
    benefits: ['کاهش سریع نفخ و ورم معده', 'کمک به کاهش سایز شکم و پهلو', 'کاهش اشتهای کاذب و خوشبوکننده دهان'],
    usage: 'نیم ساعت قبل یا ۱ ساعت بعد از وعده غذایی (۵ دقیقه دم بکشد).',
    faqQ: 'برای چه کسانی باید با احتیاط مصرف شود؟',
    faqA: 'افراد دارای رفلاکس اسید شدید معده بهتر است به جای نعناع فلفلی از دمنوش به و دارچین استفاده کنند.',
    pitch: '«برای کسانی که بعد از غذا حس سنگینی و نفخ دارن یا می‌خوان توی دوره کاهش وزن، سایزشون سریع‌تر کم بشه، چای سبز و نعناع فلفلی فوق‌العاده عمل می‌کنه.»'
  },
  {
    category: 'دمنوش‌های ترکیبی',
    name: 'دمنوش ریزمیوه‌های قرمز (میکس بری)',
    benefits: ['پاکسازی کبد و کمک به بهبود کبد چرب', 'سرشار از ویتامین C و آنتی‌اکسیدان', 'کمک به کاهش چربی و غلظت خون'],
    usage: 'به صورت گرم یا سردنوش (آیس‌تی) به عنوان میان‌وعده عصر.',
    faqQ: 'آیا رنگ قرمز آن طبیعی است؟',
    faqA: 'بله، ۱۰۰٪ طبیعی از چای ترش، زرشک، کرن‌بری و توت‌فرنگی بدون هیچ رنگ افزودنی.',
    pitch: '«یه دمنوش یاقوتی و ترش‌وملس از ۵ میوه قرمز که هم کبدت رو پاکسازی می‌کنه و هم جایگزین سالم نوشیدنی‌های قندی روزانه است.»'
  },
  {
    category: 'مخلوط چای سبز',
    name: 'چای سبز، گزنه و برگ زیتون',
    benefits: ['کمک به تنظیم قند خون', 'افزایش متابولیسم و سوخت‌وساز چربی‌ها', 'کمک به تعادل کلسترول خون'],
    usage: 'روزانه ۱ تا ۲ فنجان در آب ۸۰ درجه به مدت ۵ دقیقه.',
    faqQ: 'افراد دارای فشار خون پایین چطور مصرف کنند؟',
    faqA: 'چون برگ زیتون کمی کاهنده فشار است، بهتر است همراه با یک عدد خرما یا کمی عسل میل شود.',
    pitch: '«ترکیب چای سبز با برگ زیتون و گزنه علاوه بر بالا بردن سوخت‌وساز بدن، به تعادل قند خون هم کمک می‌کنه.»'
  }
];

// ذخیره‌سازی (محلی فوری + ابری با تأخیر کوتاه برای جلوگیری از هجوم درخواست)
let cloudTimer = null;
function saveAll() {
  appState.lastModified = Date.now();
  saveToStorage(appState);
  renderCoachCard();
  clearTimeout(cloudTimer);

  if (!isSupabaseConfigured()) return cloudLabel('off');
  if (!appState.user) return cloudLabel('idle');
  if (appState.user.local) return cloudLabel('off');
  if (!loadSession()) return cloudLabel('idle');

  cloudTimer = setTimeout(async () => {
    try {
      const r = await syncState(appState);
      if (r.cloud?.ok) {
        cloudLabel('ok');
        saveProfile({
          full_name: appState.user?.name,
          current_stage: getHighestUnlockedStage(appState),
          s2_streak: Number(appState.s2Streak) || 0,
          crm_count: (appState.crm || []).length
        }).catch(() => {});
      }
      else if (r.cloud?.reason === 'no-session' || r.cloud?.reason === 'not-configured') cloudLabel('idle');
      else cloudLabel('err');
    } catch (_) { cloudLabel('err'); }
  }, 400);
}

/* ---------------- وضعیت اتصال ابری ---------------- */
const CLOUD_STYLE = {
  off:  { text: 'آفلاین', cls: 'bg-slate-700/60 text-slate-300' },
  idle: { text: 'ابر',    cls: 'bg-slate-700/60 text-slate-300' },
  ok:   { text: 'ابر ✓',  cls: 'bg-emerald-600/30 text-emerald-300' },
  err:  { text: 'ابر ✖',  cls: 'bg-red-600/30 text-red-300' }
};

function cloudLabel(state) {
  const el = document.getElementById('cloud-badge');
  if (!el) return;
  const m = CLOUD_STYLE[state] || CLOUD_STYLE.off;
  el.innerText = m.text;
  el.className = `text-[10px] px-2 py-0.5 rounded-full font-bold ${m.cls}`;
}

function updateCloudBadge() {
  if (!isSupabaseConfigured()) return cloudLabel('off');
  if (appState.user?.local) return cloudLabel('off');
  if (!appState.user || !loadSession()) return cloudLabel('idle');
  // تا اولین همگام‌سازی موفق، وضعیت را «ابر» (بدون تیک) نشان می‌دهیم.
  cloudLabel('idle');
}

function cloudBox(kind, html) {
  const colors = {
    ok: 'bg-emerald-950/60 border-emerald-700/40 text-emerald-200',
    err: 'bg-red-950/60 border-red-700/40 text-red-200',
    info: 'bg-slate-900 border-slate-700 text-slate-300'
  };
  document.getElementById('cloud-result').innerHTML =
    `<div class="border rounded-xl p-2.5 ${colors[kind] || colors.info}">${html}</div>`;
}

function readCloudInputs() {
  return {
    url: document.getElementById('cloud-url').value.trim(),
    key: document.getElementById('cloud-key').value.trim()
  };
}

function openCloudModal() {
  const cfg = getSupabaseConfig();
  document.getElementById('cloud-url').value = cfg.url || '';
  document.getElementById('cloud-key').value = cfg.key || '';
  document.getElementById('cloud-result').innerHTML = '';
  const n8nCfg = getN8nConfig();
  const n8nInput = document.getElementById('n8n-url');
  if (n8nInput) n8nInput.value = n8nCfg.webhookUrl || '';
  const backupRes = document.getElementById('backup-result');
  if (backupRes) backupRes.innerHTML = '';
  document.getElementById('cloud-modal').classList.remove('hidden');
}

function closeCloudModal() {
  document.getElementById('cloud-modal').classList.add('hidden');
}

function cloudErrorText(r) {
  const map = {
    'not-configured': 'آدرس یا کلید کامل نیست.',
    'table-missing': 'اتصال برقرار شد، اما جدول <code dir="ltr">user_state</code> وجود ندارد. فایل <code dir="ltr">supabase/schema.sql</code> را در SQL Editor اجرا کن.',
    'auth': 'کلید anon معتبر نیست (۴۰۱/۴۰۳). مقدار را از Project Settings → API دوباره کپی کن.',
    'no-session': 'برای همگام‌سازی، ابتدا با ایمیل وارد شو.',
    'network': 'شبکه در دسترس نیست یا دامنه اشتباه است.',
    'security-blocked': 'درخواست توسط قوانین امنیتی شبکه مسدود شد (CSP/CORS).'
  };
  return map[r.reason] || `خطای HTTP ${escapeHtml(r.status || '')}${r.detail ? ': ' + escapeHtml(String(r.detail).slice(0, 120)) : ''}`;
}

async function testCloudConnection() {
  const cfg = readCloudInputs();
  const errors = validateConfig(cfg);
  if (errors.length) return cloudBox('err', errors.join('<br>'));

  cloudBox('info', 'در حال تست اتصال… ⏳');
  const r = await testConnection(cfg);

  if (r.ok) {
    if (r.scope === 'auth-only') {
      cloudLabel('idle');
      cloudBox('ok', 'اتصال پایه به Supabase برقرار است ✅ برای بررسی جدول و همگام‌سازی، ابتدا با ایمیل وارد شو.');
    } else {
      cloudLabel('ok');
      cloudBox('ok', 'اتصال برقرار است و جدول <code dir="ltr">user_state</code> در دسترس است ✅');
    }
  } else {
    cloudLabel('err');
    cloudBox('err', cloudErrorText(r));
  }
}

async function saveCloudConfigAndSync() {
  const cfg = readCloudInputs();
  const errors = validateConfig(cfg);
  if (errors.length) return cloudBox('err', errors.join('<br>'));

  saveSupabaseConfig(cfg);
  cloudBox('info', 'ذخیره شد. در حال بررسی اتصال… ⏳');

  const ping = await testConnection(cfg);
  if (!ping.ok) {
    cloudLabel('err');
    return cloudBox('err', cloudErrorText(ping));
  }

  if (!appState.user) {
    cloudLabel('idle');
    return cloudBox('ok', 'ذخیره شد ✅ — پس از ثبت‌نام، داده‌ها به‌صورت خودکار همگام می‌شوند.');
  }

  if (appState.user.local) {
    cloudLabel('idle');
    return cloudBox('ok', 'ذخیره شد ✅ — در حالت «بدون حساب» همگام‌سازی ابری انجام نمی‌شود.');
  }

  const r = await syncState(appState, cfg);
  if (r.cloud?.ok) {
    cloudLabel('ok');
    cloudBox('ok', 'اتصال و همگام‌سازی با موفقیت انجام شد ✅');
  } else if (r.cloud?.reason === 'no-session') {
    cloudLabel('idle');
    cloudBox('err', cloudErrorText(r.cloud));
  } else {
    cloudLabel('err');
    cloudBox('err', cloudErrorText(r.cloud || {}));
  }
}

function disconnectCloud() {
  clearSupabaseConfig();
  cloudLabel('off');
  cloudBox('info', 'اتصال قطع شد. اپ به‌صورت آفلاین با حافظه دستگاه کار می‌کند.');
}

/* ---------------- پشتیبان‌گیری n8n و محلی ---------------- */
async function triggerN8nBackup() {
  const url = document.getElementById('n8n-url')?.value.trim() || '';
  const errors = validateN8nConfig({ webhookUrl: url });
  const resEl = document.getElementById('backup-result');
  if (!resEl) return;
  if (errors.length) {
    resEl.innerHTML = `<div class="border border-red-700/40 bg-red-950/60 text-red-200 rounded-xl p-2 mt-1">${errors.join('<br>')}</div>`;
    return;
  }
  saveN8nConfig({ webhookUrl: url });
  resEl.innerHTML = '<div class="border border-slate-700 bg-slate-900 text-slate-300 rounded-xl p-2 mt-1">در حال ارسال نسخه پشتیبان به n8n… ⏳</div>';
  const r = await sendBackupToN8n(appState, { webhookUrl: url });
  if (r.ok) {
    resEl.innerHTML = '<div class="border border-emerald-700/40 bg-emerald-950/60 text-emerald-200 rounded-xl p-2 mt-1">نسخه پشتیبان با موفقیت به n8n ارسال شد ✅</div>';
  } else {
    resEl.innerHTML = `<div class="border border-red-700/40 bg-red-950/60 text-red-200 rounded-xl p-2 mt-1">خطا در ارسال: ${escapeHtml(r.detail || r.reason || 'نامشخص')}</div>`;
  }
}

function exportBackupFile() {
  const resEl = document.getElementById('backup-result');
  try {
    const jsonStr = exportStateAsJson(appState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `everest-5x5-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (resEl) resEl.innerHTML = '<div class="border border-emerald-700/40 bg-emerald-950/60 text-emerald-200 rounded-xl p-2 mt-1">فایل پشتیبان دانلود شد ✅</div>';
  } catch (e) {
    if (resEl) resEl.innerHTML = `<div class="border border-red-700/40 bg-red-950/60 text-red-200 rounded-xl p-2 mt-1">خطا در دانلود فایل: ${escapeHtml(e?.message || e)}</div>`;
  }
}

function triggerImportBackup() {
  document.getElementById('import-backup-file')?.click();
}

function handleBackupFileSelect(event) {
  const file = event.target?.files?.[0];
  const resEl = document.getElementById('backup-result');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result;
    const res = importStateFromJson(content);
    if (res.ok) {
      appState = res.state;
      saveAll();
      initApp();
      if (resEl) resEl.innerHTML = '<div class="border border-emerald-700/40 bg-emerald-950/60 text-emerald-200 rounded-xl p-2 mt-1">داده‌ها با موفقیت بازیابی شدند ✅</div>';
    } else {
      if (resEl) resEl.innerHTML = `<div class="border border-red-700/40 bg-red-950/60 text-red-200 rounded-xl p-2 mt-1">${escapeHtml(res.reason)}</div>`;
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ---------------- Agent Coach ---------------- */
function renderCoachCard() {
  const container = document.getElementById('coach-card');
  if (!container) return;
  
  if (!appState.user) {
    container.innerHTML = '';
    return;
  }

  const card = generateCoachCard(appState);
  const theme = getStageTheme(card.stage);

  container.innerHTML = `
    <div class="${theme.bg} ${theme.border} rounded-2xl p-3.5 space-y-2.5 shadow-lg">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] ${theme.badge} text-white px-2 py-0.5 rounded-full font-bold">Coach ۵×۵</span>
          <h3 class="text-sm font-extrabold mt-1 ${theme.text}">اقدام بعدی + انگیزه</h3>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-mono font-bold ${theme.text}">${card.progress}%</div>
          <div class="text-[9px] text-slate-500">پیشرفت کلی</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
        <div class="${theme.badge.replace('bg-', 'bg-')} h-full transition-all duration-500" style="width: ${card.progress}%"></div>
      </div>

      <!-- Next Action -->
      <div class="bg-slate-900/80 rounded-xl p-3 border ${theme.border}">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-[10px] font-bold ${theme.text}">🎯 اقدام بعدی:</span>
        </div>
        <p class="text-[11px] text-slate-200 leading-relaxed">${escapeHtml(card.nextAction)}</p>
      </div>

      <!-- Motivation -->
      <div class="bg-gradient-to-r ${theme.bg} border ${theme.border} rounded-xl p-3">
        <p class="text-[11px] ${theme.text} leading-relaxed font-medium">"${escapeHtml(card.motivation)}"</p>
      </div>
    </div>
  `;
}

/* ---------------- ورود (OTP) ---------------- */
let pendingEmail = '';

function authMsg(step, kind, html) {
  const colors = {
    ok: 'text-emerald-300',
    err: 'text-red-300',
    info: 'text-slate-300'
  };
  const el = document.getElementById(`auth-msg-${step}`);
  if (el) el.innerHTML = `<span class="${colors[kind] || colors.info}">${html}</span>`;
}

function showAuthStep(step) {
  const a = document.getElementById('auth-step-email');
  const b = document.getElementById('auth-step-code');
  if (!a || !b) return;
  a.classList.toggle('hidden', step !== 1);
  b.classList.toggle('hidden', step !== 2);
  if (step === 2) document.getElementById('reg-code')?.focus();
}

function backToEmailStep() {
  showAuthStep(1);
}

/** پاک‌کردن ورودی‌های حساس صفحه ورود هنگام خروج */
function clearAuthFields() {
  for (const id of ['reg-email', 'reg-code', 'reg-name', 'reg-id', 'reg-upline']) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  const emailShow = document.getElementById('auth-email-show');
  if (emailShow) emailShow.innerText = '';
}

async function requestOtp(ev) {
  const email = document.getElementById('reg-email').value.trim();
  if (!isValidEmail(email)) return authMsg(1, 'err', 'ایمیل معتبر نیست.');

  const btn = ev?.currentTarget || ev?.target;
  if (btn) { btn.disabled = true; btn.textContent = 'در حال ارسال…'; }
  authMsg(1, 'info', 'در حال ارسال کد… ⏳');

  const r = await sendOtp(email);
  if (btn) { btn.disabled = false; btn.textContent = 'یا ارسال لینک به ایمیل 📧'; }

  if (!r.ok) return authMsg(1, 'err', authErrorText(r));

  pendingEmail = email;
  document.getElementById('auth-email-show').innerText = email;
  authMsg(2, 'ok', 'ایمیل ورود ارسال شد ✅ اگر کد داشت همان را وارد کن؛ اگر فقط لینک داشت روی لینک بزن تا خودکار وارد شوی.');
  showAuthStep(2);
}

function toggleRoleUplineField() {
  const roleSelect = document.getElementById('reg-role-select');
  const uplineBox = document.getElementById('reg-upline-box');
  if (!roleSelect || !uplineBox) return;
  if (roleSelect.value === 'leader') {
    uplineBox.classList.add('hidden');
  } else {
    uplineBox.classList.remove('hidden');
  }
}

async function handlePasswordAuth() {
  const emailInput = document.getElementById('reg-email');
  const passwordInput = document.getElementById('reg-password');
  const nameInput = document.getElementById('reg-name-input');
  const roleSelect = document.getElementById('reg-role-select');
  const uplineInput = document.getElementById('reg-upline-input');
  const btn = document.getElementById('btn-password-auth');

  const email = (emailInput?.value || '').trim();
  const password = (passwordInput?.value || '').trim();
  const enteredName = (nameInput?.value || '').trim();
  const enteredRole = roleSelect?.value || 'member';
  const enteredUpline = (uplineInput?.value || '').trim();

  if (!isValidEmail(email)) return authMsg(1, 'err', 'ایمیل معتبر نیست.');
  if (!password || password.length < 6) return authMsg(1, 'err', 'رمز عبور باید حداقل ۶ کاراکتر باشد.');

  const originalBtnText = btn ? btn.innerHTML : 'ورود / ثبت‌نام آنی با رمز عبور 🚀';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'در حال بررسی و ورود… ⏳';
    btn.classList.add('opacity-75', 'cursor-wait');
  }
  authMsg(1, 'info', 'در حال ورود / ثبت‌نام آنی… ⏳');

  try {
    let r = await signInWithPassword(email, password);
    if (!r.ok) {
      const metadata = {
        full_name: enteredName || 'عضو تیم اورست',
        role: enteredRole,
        upline: enteredRole === 'leader' ? 'راهبر ارشد اورست' : (enteredUpline || 'راهبر تیم اورست')
      };
      const upRes = await signUpWithPassword(email, password, metadata);
      if (upRes.ok) {
        if (upRes.session?.access_token) {
          r = upRes;
        } else {
          r = await signInWithPassword(email, password);
        }
      } else {
        const msg = String(upRes.message || '').toLowerCase();
        if (upRes.status === 422 || msg.includes('already registered')) {
          r = { ok: false, message: 'این حساب قبلاً با رمز دیگری ثبت شده است. اگر رمز را فراموش کرده‌اید، از دکمه «ارسال لینک به ایمیل» استفاده کنید.' };
        } else {
          r = upRes;
        }
      }
    }

    if (!r.ok) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        btn.classList.remove('opacity-75', 'cursor-wait');
      }
      return authMsg(1, 'err', r.message || 'خطا در ورود. لطفاً رمز عبور را بررسی کنید.');
    }

    const u = currentUser(r.session);
    if (!u) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        btn.classList.remove('opacity-75', 'cursor-wait');
      }
      return authMsg(1, 'err', 'نشست ساخته نشد. دوباره تلاش کنید.');
    }

    const previousOwner = appState.user?.id || appState.ownerId || '';
    const sameUser = Boolean(previousOwner && previousOwner === u.id && !appState.user?.local);
    if (previousOwner && !sameUser) appState = getDefaultData();

    const resolvedRole = enteredRole || u.role || 'member';
    const resolvedName = enteredName || u.name || 'عضو تیم اورست';
    const resolvedUpline = resolvedRole === 'leader' ? 'راهبر ارشد اورست' : (enteredUpline || u.upline || 'راهبر تیم اورست');

    appState.ownerId = u.id;
    appState.user = {
      id: u.id,
      email: u.email,
      name: resolvedName,
      role: resolvedRole,
      upline: resolvedUpline
    };
    if (resolvedRole === 'leader') {
      appState.approvedStage = 5;
    } else {
      appState.approvedStage = appState.approvedStage || 1;
    }
    if (!appState.startTime) appState.startTime = Date.now();

    try {
      await saveProfile({
        full_name: appState.user.name,
        role: appState.user.role,
        upline: appState.user.upline,
        upline_email: appState.user.upline.includes('@') ? appState.user.upline : undefined,
        current_stage: getHighestUnlockedStage(appState),
        approved_stage: appState.approvedStage || 1,
        pending_stage: appState.pendingApprovalStage || null,
        s2_streak: Number(appState.s2Streak) || 0,
        crm_count: (appState.crm || []).length
      });
    } catch (_) {}

    try {
      const cloud = await loadFromCloud();
      if (cloud) {
        appState = mergeWithDefaults(cloud);
        appState.user = {
          id: u.id,
          email: u.email,
          name: appState.user?.name || resolvedName,
          role: appState.user?.role || resolvedRole,
          upline: appState.user?.upline || resolvedUpline
        };
        if (appState.user.role === 'leader') appState.approvedStage = 5;
      }
    } catch (_) {}
    saveToStorage(appState);

    document.getElementById('auth-screen')?.classList.add('hidden');
    initApp();
    authMsg(1, 'ok', 'ورود با موفقیت انجام شد! خوش آمدید. 🎉');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
      btn.classList.remove('opacity-75', 'cursor-wait');
    }
    authMsg(1, 'err', 'خطا در اتصال: ' + (err?.message || 'مشکل موقت شبکه'));
  }
}

async function verifyOtpAndStart() {
  const code = document.getElementById('reg-code').value.trim();
  const name = document.getElementById('reg-name').value.trim();
  const nationalId = document.getElementById('reg-id').value.trim();
  const upline = document.getElementById('reg-upline').value.trim();

  if (!/^\d{6,10}$/.test(code)) return authMsg(2, 'err', 'کد ورود (۶ تا ۱۰ رقم) را وارد کن.');
  if (!name) return authMsg(2, 'err', 'نام و نام خانوادگی را وارد کن.');

  authMsg(2, 'info', 'در حال بررسی کد… ⏳');
  const r = await verifyOtp(pendingEmail, code, { full_name: name, upline: upline || '' });
  if (!r.ok) return authMsg(2, 'err', authErrorText(r));

  const u = currentUser(r.session);
  if (!u) return authMsg(2, 'err', 'نشست ساخته نشد. دوباره تلاش کن.');
  const previousOwner = appState.user?.id || appState.ownerId || '';
  const sameUser = Boolean(previousOwner && previousOwner === u.id && !appState.user?.local);
  // کد ملی قدیمی فقط وقتی قابل انتقال است که همان کاربر باشد.
  const legacyNationalId = sameUser ? appState.user?.nationalId || '' : '';

  // اگر حساب عوض شده، داده حساب قبلی روی این دستگاه نباید بماند.
  if (previousOwner && !sameUser) appState = getDefaultData();
  appState.ownerId = u.id;

  appState.user = {
    id: u.id,
    email: u.email,
    name: (u.name || name).trim(),
    upline: upline || u.upline || 'راهبر تیم اورست'
  };
  delete appState.user.nationalId;
  if (!appState.startTime) appState.startTime = Date.now();

  // کد ملی فقط در جدول `profiles` ذخیره می‌شود (نه در state_data).
  const nationalIdToSave = nationalId || legacyNationalId;
  const profileResult = await saveProfile({
    full_name: appState.user.name,
    upline: appState.user.upline,
    upline_email: (upline && upline.includes('@')) ? upline.trim().toLowerCase() : '',
    current_stage: getHighestUnlockedStage(appState),
    s2_streak: Number(appState.s2Streak) || 0,
    crm_count: (appState.crm || []).length,
    national_id: nationalIdToSave
  });
  // اگر جدول/شبکه در دسترس نبود، کد ملی به‌صورت موقت فقط محلی می‌ماند؛
  // `stripNationalId` تضمین می‌کند این مقدار هیچ‌وقت به state_data ابری نرود.
  if (!profileResult.ok && nationalIdToSave) appState.user.nationalId = nationalIdToSave;

  saveAll();
  await pullCloudAfterLogin();
  clearAuthFields();
  initApp();
}

/** پس از ورود: اگر داده ابری جدیدتر بود، جایگزین کن */
async function pullCloudAfterLogin() {
  try {
    const remote = await loadFromCloud();
    if (!remote) return;
    const remoteTouched = remote.lastModified || 0;
    const localTouched = appState.lastModified || 0;
    if (remoteTouched > localTouched) {
      const keepUser = appState.user;
      const remoteNationalId = remote.user?.nationalId || '';
      appState = remote;
      appState.user = { ...(remote.user || {}), ...keepUser };
      delete appState.user.nationalId;
      appState.ownerId = appState.user.id || appState.ownerId;
      saveToStorage(appState);
      // انتقال داده قدیمی از state_data به profiles (اگر باقی مانده باشد)
      if (remoteNationalId) {
        const profile = await saveProfile({ national_id: remoteNationalId });
        if (!profile.ok) {
          appState.user.nationalId = remoteNationalId;
          saveToStorage(appState);
        }
      }
    }
  } catch (_) { /* آفلاین */ }
}

/** حالت بدون حساب: فقط روی همین دستگاه */
function toggleLocalMode() {
  const name = prompt('نام و نام خانوادگی را وارد کن:', 'عضو تیم اورست');
  if (!name || !name.trim()) return;
  // ورود به حالت محلی نباید داده حساب قبلی را با خود ببرد.
  if (appState.user || appState.ownerId) appState = getDefaultData();
  const localId = `local-${Date.now()}`;
  appState.ownerId = localId;
  appState.user = {
    id: localId,
    email: '',
    name: name.trim(),
    upline: 'راهبر تیم اورست',
    local: true
  };
  if (!appState.startTime) appState.startTime = Date.now();
  saveAll();
  clearAuthFields();
  initApp();
}

async function signOutUser() {
  if (!confirm('از حساب خارج می‌شوی؟ داده‌های محلی این دستگاه پاک می‌شود (داده ابری‌ات می‌ماند).')) return;
  await signOut();
  clearStorage();
  appState = getDefaultData();
  saveToStorage(appState);
  pendingEmail = '';
  clearAuthFields();
  closeCloudModal();
  cloudLabel(isSupabaseConfigured() ? 'idle' : 'off');
  showAuthStep(1);
  document.getElementById('auth-screen').classList.remove('hidden');
}

// ریست
async function resetDemo() {
  if (!confirm('آیا مایل به خروج و بازنشانی اطلاعات این دستگاه هستید؟')) return;
  try { await signOut(); } catch (_) { /* آفلاین */ }
  clearStorage();
  location.reload();
}


// رندر تب‌ها
function renderTabs() {
  const bar = document.getElementById('stage-tabs-bar');
  const unlocked = getHighestUnlockedStage(appState);
  const isLeader = appState.user?.role === 'leader';

  const stageBadge = document.getElementById('user-stage-badge');
  if (stageBadge) stageBadge.innerText = `سطح مجاز: مرحله ${unlocked}`;

  const roleBadge = document.getElementById('user-role-badge');
  if (roleBadge) {
    if (isLeader) {
      roleBadge.innerText = '👑 راهبر تیم';
      roleBadge.className = 'text-[10px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full border border-amber-300 shadow-sm';
    } else {
      roleBadge.innerText = '🎯 مشاور اورست';
      roleBadge.className = 'text-[10px] bg-blue-600/70 border border-blue-400/50 text-blue-200 font-bold px-2 py-0.5 rounded-full';
    }
  }

  const labels = [
    { n: 1, t: 'م۱: شروع', sub: '۷۲ ساعت' },
    { n: 2, t: 'م۲: حرکت', sub: '۷ روز' },
    { n: 3, t: 'م۳: ساخت', sub: '۳۰ روز' },
    { n: 4, t: 'م۴: تکثیر', sub: '۹۰ روز' },
    { n: 5, t: 'م۵: راهبری', sub: 'مستمر' }
  ];

  bar.innerHTML = labels.map(item => {
    const isActive = activeStageView === item.n;
    const isLocked = item.n > unlocked;
    const isWaiting = isWaitingForApproval(item.n, appState);
    let lockIcon = '';
    if (isWaiting) lockIcon = '⏳';
    else if (isLocked) lockIcon = '🔒';

    return `
      <button onclick="switchStage(${item.n})" class="py-1.5 rounded-xl text-center transition ${isActive ? 'bg-white text-slate-950 font-extrabold shadow' : 'text-white/80 hover:bg-white/10'} text-[11px]">
        <div>${item.t} ${lockIcon}</div>
        <div class="text-[9px] opacity-75">${item.sub}</div>
      </button>
    `;
  }).join('');

  renderApprovalBoxes();
}

function renderApprovalBoxes() {
  const isLeader = appState.user?.role === 'leader';
  const approved = Math.max(1, Number(appState.approvedStage) || (isLeader ? 5 : 1));

  // مرحله ۱ به ۲
  const s1Box = document.getElementById('s1-approval-box');
  if (s1Box) {
    const s1Done = Array.isArray(appState.s1Steps) && appState.s1Steps.length > 0 && appState.s1Steps.every(x => x && x.done);
    if (!s1Done) {
      s1Box.innerHTML = '';
    } else if (isLeader || approved >= 2) {
      s1Box.innerHTML = `
        <div class="bg-emerald-950/70 border border-emerald-600/50 p-2.5 rounded-xl text-emerald-200 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1.5">
          <span>✅</span>
          <span>ورود به مرحله ۲ تأیید شده است. می‌توانید به تب مرحله ۲ بروید.</span>
        </div>
      `;
    } else {
      s1Box.innerHTML = renderApprovalRequestBanner(2);
    }
  }

  // مرحله ۲ به ۳
  const s2Box = document.getElementById('s2-approval-box');
  if (s2Box) {
    const s2Done = (Number(appState.s2Streak) || 0) >= 7;
    if (!s2Done) {
      s2Box.innerHTML = '';
    } else if (isLeader || approved >= 3) {
      s2Box.innerHTML = `
        <div class="bg-emerald-950/70 border border-emerald-600/50 p-2.5 rounded-xl text-emerald-200 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1.5">
          <span>✅</span>
          <span>ورود به مرحله ۳ تأیید شده است. تب مرحله ۳ باز است.</span>
        </div>
      `;
    } else {
      s2Box.innerHTML = renderApprovalRequestBanner(3);
    }
  }

  // مرحله ۳ به ۴
  const s3Box = document.getElementById('s3-approval-box');
  if (s3Box) {
    const s3Done = Array.isArray(appState.s3Pass) && appState.s3Pass.length > 0 && appState.s3Pass.every(x => x && x.done);
    if (!s3Done) {
      s3Box.innerHTML = '';
    } else if (isLeader || approved >= 4) {
      s3Box.innerHTML = `
        <div class="bg-emerald-950/70 border border-emerald-600/50 p-2.5 rounded-xl text-emerald-200 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1.5">
          <span>✅</span>
          <span>ورود به مرحله ۴ تأیید شده است. تب مرحله ۴ باز است.</span>
        </div>
      `;
    } else {
      s3Box.innerHTML = renderApprovalRequestBanner(4);
    }
  }

  // مرحله ۴ به ۵
  const s4Box = document.getElementById('s4-approval-box');
  if (s4Box) {
    const s4Done = Array.isArray(appState.s4Pass) && appState.s4Pass.length > 0 && appState.s4Pass.every(x => x && x.done);
    if (!s4Done) {
      s4Box.innerHTML = '';
    } else if (isLeader || approved >= 5) {
      s4Box.innerHTML = `
        <div class="bg-emerald-950/70 border border-emerald-600/50 p-2.5 rounded-xl text-emerald-200 text-xs font-bold text-center mt-2 flex items-center justify-center gap-1.5">
          <span>✅</span>
          <span>ورود به مرحله ۵ (راهبری) تأیید شده است. تب مرحله ۵ باز است.</span>
        </div>
      `;
    } else {
      s4Box.innerHTML = renderApprovalRequestBanner(5);
    }
  }
}

function renderApprovalRequestBanner(targetStage) {
  const isPending = appState.pendingApprovalStage === targetStage;
  const uplineName = appState.user?.upline || 'راهبر تیم اورست';
  return `
    <div class="bg-amber-950/80 border border-amber-600/60 p-3 rounded-xl space-y-2.5 text-center mt-2 shadow-inner">
      <div class="text-xs text-amber-200 font-extrabold flex items-center justify-center gap-1.5">
        <span>⏳</span>
        <span>معیارهای این مرحله تکمیل شد! ورود به مرحله ${targetStage} منوط به تأیید راهبر است.</span>
      </div>
      <p class="text-[10px] text-slate-300">راهبر ناظر شما: <b class="text-amber-300 font-bold">${escapeHtml(uplineName)}</b></p>
      <div class="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <button onclick="requestLeaderApproval(${targetStage})" class="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition shadow flex items-center justify-center gap-1">
          <span>${isPending ? '✓ درخواست ارسال شده (ارسال مجدد)' : '📩 ارسال درخواست تأیید در سامانه'}</span>
        </button>
        <button onclick="sendLeaderWhatsAppApprovalRequest(${targetStage})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition shadow flex items-center justify-center gap-1">
          <span>💬 ارسال پیام مستقیم در واتساپ</span>
        </button>
      </div>
      ${isPending ? '<div class="text-[10px] text-emerald-300 font-bold">درخواست شما در سیستم ثبت شد؛ به محض تأیید توسط راهبر، مرحله باز خواهد شد.</div>' : ''}
    </div>
  `;
}

async function requestLeaderApproval(targetStage) {
  appState.pendingApprovalStage = Number(targetStage) || 2;
  saveAll();
  renderTabs();

  try {
    const res = await requestStageApproval(targetStage);
    if (res?.ok) {
      alert(`درخواست تأیید ورود به مرحله ${targetStage} با موفقیت برای راهبر شما ثبت شد. ⏳`);
    } else {
      alert(`درخواست تأیید ثبت شد. در اتصال بعدی به راهبر منتقل خواهد شد.`);
    }
  } catch (_) {
    alert(`درخواست تأیید ثبت شد.`);
  }
}

function sendLeaderWhatsAppApprovalRequest(targetStage) {
  const name = appState.user?.name || 'مشاور تیم';
  const email = appState.user?.email || '';
  const prevStage = targetStage - 1;
  const text = `سلام راهبر عزیز،\nمن تمام الزامات و معیارهای مرحله ${prevStage} سیستم ۵×۵ تیم اورست را کامل کردم و آماده شروع مرحله ${targetStage} هستم. لطفاً ورود من به مرحله ${targetStage} را در پنل سامانه تأیید فرمایید. 🏔️✨\nنام: ${name}\nایمیل: ${email}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

// تغییر مرحله
function switchStage(stageNum) {
  if (!isStageUnlocked(stageNum, appState)) {
    if (isWaitingForApproval(stageNum, appState)) {
      alert(`ورود به مرحله ${stageNum} نیازمند تأیید راهبر شماست. لطفاً از دکمه «ارسال درخواست تأیید» در انتهای مرحله قبل استفاده کنید.`);
    } else {
      alert('این مرحله هنوز باز نشده است. اول معیار عبور مرحله قبل را کامل کن.');
    }
    return;
  }
  activeStageView = stageNum;
  document.querySelectorAll('.stage-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`stage-${stageNum}`).classList.remove('hidden');

  const themes = {
    1: 'from-blue-700 to-blue-900',
    2: 'from-emerald-700 to-emerald-900',
    3: 'from-orange-600 to-amber-800',
    4: 'from-purple-700 to-indigo-950',
    5: 'from-amber-600 to-yellow-900'
  };
  document.getElementById('app-header').className = `p-4 bg-gradient-to-l ${themes[stageNum]} transition-all duration-300 shadow-lg`;
  renderTabs();
}

// تایمر ۷۲ ساعت
function update72HourTimer() {
  if (!appState.startTime) return;
  const elapsed = Date.now() - appState.startTime;
  const total72h = 72 * 3600 * 1000;
  const remaining = Math.max(0, total72h - elapsed);
  const hrs = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const mins = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  const el = document.getElementById('live-timer-72');
  if (el) el.innerText = `${hrs}:${mins}:${secs}`;
}

// رندر مرحله ۱
function renderStage1() {
  const c = document.getElementById('s1-steps-container');
  if (!appState.s1Steps || appState.s1Steps.length === 0) return;

  const l30Count = (appState.initialList30 || []).length;
  // اگر ۳۰ نفر تکمیل شده باشد و گام ۳ تیک نخورده باشد، خودکار علامت بزن
  if (l30Count >= 30 && appState.s1Steps[2] && !appState.s1Steps[2].done) {
    appState.s1Steps[2].done = true;
  }

  let doneCount = 0;
  c.innerHTML = appState.s1Steps.map((s, idx) => {
    if (s.done) doneCount++;
    const isStep3 = idx === 2;
    return `
      <div onclick="toggleS1Step(${idx})" class="cursor-pointer p-3 rounded-2xl border transition ${s.done ? 'bg-blue-950/50 border-blue-500/70' : 'bg-slate-800/90 border-slate-700'}">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-extrabold flex items-center gap-2 ${s.done ? 'text-blue-300' : 'text-white'}">
              <span>${escapeHtml(s.title)}</span>
              ${isStep3 ? `<span class="text-[10px] bg-blue-600/40 text-blue-200 border border-blue-500/40 px-2 py-0.5 rounded-full font-bold">${l30Count} / ۳۰ نفر</span>` : ''}
            </div>
            <p class="text-[11px] text-slate-300 mt-0.5">${escapeHtml(s.desc)}</p>
            <span class="inline-block mt-1.5 text-[10px] bg-slate-900 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-800/40">★ ${escapeHtml(s.tip)}</span>
          </div>
          <div class="w-6 h-6 rounded-lg flex items-center justify-center border font-bold text-xs ${s.done ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 text-transparent'}">✓</div>
        </div>
      </div>
    `;
  }).join('');

  const pct = Math.round((doneCount / 5) * 100);
  const progLabel = document.getElementById('s1-progress-label');
  const progBar = document.getElementById('s1-progress-bar');
  if (progLabel) progLabel.innerText = `${doneCount} از ۵ اقدام`;
  if (progBar) progBar.style.width = `${pct}%`;

  renderInitialList30();
}

function toggleS1Step(idx) {
  appState.s1Steps[idx].done = !appState.s1Steps[idx].done;
  saveAll();
  renderStage1();
  renderTabs();
}

/* ---------------- لیست اولیه ۳۰ نفره مرحله ۱ (فرم رسمی اورست) ---------------- */

function renderInitialList30() {
  const container = document.getElementById('initial-list-30-container');
  const badge = document.getElementById('s1-list30-badge');
  const bar = document.getElementById('s1-list30-progress-bar');
  const progText = document.getElementById('s1-list30-progress-text');
  const nextRowEl = document.getElementById('s1-list30-next-row');
  if (!container) return;

  if (!appState.initialList30) appState.initialList30 = [];
  const list = appState.initialList30;
  const count = list.length;
  const pct = Math.min(100, Math.round((count / 30) * 100));

  if (badge) badge.innerText = `${count} / ۳۰ نفر`;
  if (bar) bar.style.width = `${pct}%`;
  if (progText) progText.innerText = `${pct}٪ (${count} از ۳۰ نفر)`;
  if (nextRowEl) nextRowEl.innerText = String(count + 1);

  const search = (document.getElementById('l30-search')?.value || '').trim().toLowerCase();
  const filtered = list.filter(item => {
    if (!search) return true;
    return (
      (item.name || '').toLowerCase().includes(search) ||
      (item.relation || '').toLowerCase().includes(search) ||
      (item.category || '').toLowerCase().includes(search) ||
      (item.personality || '').toLowerCase().includes(search) ||
      (item.phone || '').includes(search)
    );
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center space-y-1">
        <div class="text-xs text-slate-400 font-bold">${list.length === 0 ? 'هنوز فردی به لیست ۳۰ نفره اضافه نشده است.' : 'موردی با این جستجو پیدا نشد.'}</div>
        <p class="text-[10px] text-slate-500">فرم بالا را پر کن و دکمه «+ افزودن به لیست ۳۰ نفره» را بزن تا دقیقاً مثل فرم چاپی اورست ردیف به ردیف ثبت شود.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((item) => {
    const origIdx = list.indexOf(item);
    const rowNum = origIdx + 1;

    let persBadge = 'bg-slate-800 text-slate-300 border-slate-700';
    if (item.personality?.includes('قرمز')) persBadge = 'bg-rose-950/80 text-rose-300 border-rose-700/60';
    else if (item.personality?.includes('زرد')) persBadge = 'bg-amber-950/80 text-amber-300 border-amber-700/60';
    else if (item.personality?.includes('سبز')) persBadge = 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
    else if (item.personality?.includes('آبی')) persBadge = 'bg-sky-950/80 text-sky-300 border-sky-700/60';

    let levelBadge = 'bg-slate-800 text-slate-300';
    if (item.level?.includes('گرم')) levelBadge = 'bg-orange-950/70 text-orange-300 border border-orange-700/50';
    else if (item.level?.includes('ولرم')) levelBadge = 'bg-amber-950/50 text-amber-200 border border-amber-700/40';
    else if (item.level?.includes('سرد')) levelBadge = 'bg-cyan-950/50 text-cyan-200 border border-cyan-700/40';

    const pDigits = phoneDigits(item.phone);

    return `
      <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-750 space-y-2 hover:border-blue-500/50 transition">
        <div class="flex justify-between items-start gap-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 text-[10px] font-black flex items-center justify-center">${rowNum}</span>
            <div>
              <div class="text-xs font-extrabold text-white">${escapeHtml(item.name)}</div>
              <div class="text-[10px] text-slate-400 mt-0.5">نسبت: <b class="text-slate-300">${escapeHtml(item.relation || 'نامشخص')}</b></div>
            </div>
          </div>
          <button onclick="deleteInitialList30Member(${origIdx})" title="حذف از لیست" class="text-slate-500 hover:text-rose-400 p-1 text-xs">✕</button>
        </div>

        <div class="flex flex-wrap gap-1 text-[9px]">
          <span class="px-2 py-0.5 rounded-md ${levelBadge}">${escapeHtml(item.level || '')}</span>
          <span class="px-2 py-0.5 rounded-md border ${persBadge}">${escapeHtml(item.personality || '')}</span>
          <span class="px-2 py-0.5 rounded-md bg-slate-800 text-blue-300 border border-slate-700">${escapeHtml(item.category || '')}</span>
        </div>

        ${item.firstContactDate ? `
          <div class="text-[10px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded-lg border border-slate-800/80 flex items-center justify-between">
            <span>زمان اولین ارتباط‌گیری:</span>
            <span class="font-bold text-blue-200">${escapeHtml(item.firstContactDate)}</span>
          </div>
        ` : ''}

        ${pDigits ? `
          <div class="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
            <span class="font-mono text-slate-300" dir="ltr">${escapeHtml(item.phone)}</span>
            <div class="flex gap-1.5">
              <a href="tel:${pDigits}" class="bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold">تماس 📞</a>
              <a href="https://wa.me/98${pDigits.replace(/^0/, '')}" target="_blank" rel="noopener" class="bg-emerald-600/80 hover:bg-emerald-600 text-white px-2 py-0.5 rounded-md font-bold">واتساپ 💬</a>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function addInitialList30Member() {
  const nameInput = document.getElementById('l30-name');
  const relInput = document.getElementById('l30-relation');
  const levelInput = document.getElementById('l30-level');
  const persInput = document.getElementById('l30-personality');
  const catInput = document.getElementById('l30-category');
  const timeInput = document.getElementById('l30-time');
  const phoneInput = document.getElementById('l30-phone');

  const name = (nameInput?.value || '').trim();
  if (!name) {
    nameInput?.focus();
    return;
  }

  const relation = relInput?.value || 'دوست';
  const level = levelInput?.value || 'گرم (صمیمی / ارتباط هفتگی)';
  const personality = persInput?.value || 'قرمز (قاطع، رهبر، نتیجه‌گرا)';
  const category = catInput?.value || 'همکاری کاری (بیزنس / فرصت)';
  const firstContactDate = (timeInput?.value || '').trim();
  const phone = (phoneInput?.value || '').trim();

  if (!appState.initialList30) appState.initialList30 = [];
  appState.initialList30.push({
    name,
    relation,
    level,
    personality,
    category,
    firstContactDate,
    phone
  });

  if (nameInput) nameInput.value = '';
  if (timeInput) timeInput.value = '';
  if (phoneInput) phoneInput.value = '';

  saveAll();
  renderInitialList30();
  renderStage1();
}

function deleteInitialList30Member(idx) {
  if (!appState.initialList30 || appState.initialList30[idx] === undefined) return;
  appState.initialList30.splice(idx, 1);
  saveAll();
  renderInitialList30();
  renderStage1();
}

function exportInitialList30Csv() {
  const csv = initialList30ToCsv(appState.initialList30 || []);
  downloadFile('everest_initial_list_30.csv', csv);
}

// رندر مرحله ۲
function renderStage2() {
  document.getElementById('s2-streak-badge').innerText = `${appState.s2Streak || 0} / 7`;
  const daysBar = document.getElementById('s2-days-bar');
  const streak = appState.s2Streak || 0;
  daysBar.innerHTML = [1,2,3,4,5,6,7].map(d => `
    <button onclick="setS2Streak(${d})" class="py-1.5 rounded-xl text-[10px] font-bold border transition ${d <= streak ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}">
      روز ${d} ${d <= streak ? '✓' : ''}
    </button>
  `).join('');

  const list = document.getElementById('s2-counters-list');
  list.innerHTML = (appState.s2Counters || []).map((item, idx) => {
    const ok = item.count >= item.target;
    return `
      <div class="bg-slate-800/90 border ${ok ? 'border-emerald-500/60' : 'border-slate-700'} rounded-2xl p-3 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold ${ok ? 'text-emerald-300' : 'text-white'}">${escapeHtml(item.title)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
          <button onclick="changeCounter('s2', ${idx}, -1)" class="w-6 h-6 rounded bg-slate-800 font-bold text-xs">-</button>
          <span class="font-mono font-bold text-xs min-w-[36px] text-center ${ok ? 'text-emerald-400' : 'text-white'}">${item.count}/${item.target}</span>
          <button onclick="changeCounter('s2', ${idx}, 1)" class="w-6 h-6 rounded bg-emerald-600 text-white font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function setS2Streak(day) {
  appState.s2Streak = day;
  saveAll();
  renderStage2();
  renderTabs();
}

function changeCounter(stageKey, idx, delta) {
  const arr = stageKey === 's2' ? appState.s2Counters : appState.s3Counters;
  if (arr && arr[idx]) {
    arr[idx].count = Math.max(0, arr[idx].count + delta);
    saveAll();
    stageKey === 's2' ? renderStage2() : renderStage3();
  }
}

// رندر مرحله ۳
function renderStage3() {
  const list = document.getElementById('s3-counters-list');
  list.innerHTML = (appState.s3Counters || []).map((item, idx) => {
    const ok = item.count >= item.target;
    return `
      <div class="bg-slate-800/90 border ${ok ? 'border-orange-500/60' : 'border-slate-700'} rounded-2xl p-3 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold ${ok ? 'text-orange-300' : 'text-white'}">${escapeHtml(item.title)}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${escapeHtml(item.sub)}</div>
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
          <button onclick="changeCounter('s3', ${idx}, -1)" class="w-6 h-6 rounded bg-slate-800 font-bold text-xs">-</button>
          <span class="font-mono font-bold text-xs min-w-[36px] text-center ${ok ? 'text-orange-400' : 'text-white'}">${item.count}/${item.target}</span>
          <button onclick="changeCounter('s3', ${idx}, 1)" class="w-6 h-6 rounded bg-orange-600 text-white font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');

  // CRM
  renderCRMList();

  // چک‌لیست عبور
  const criteriaContainer = document.getElementById('s3-pass-criteria');
  if (criteriaContainer && appState.s3Pass) {
    criteriaContainer.innerHTML = appState.s3Pass.map((item, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="togglePassCriterion('s3', ${idx})" class="accent-orange-500 rounded" />
        <span class="${item.done ? 'text-orange-200 font-bold' : 'text-slate-400'}">${escapeHtml(item.text)}</span>
      </label>
    `).join('');
  }
}

function renderCRMList() {
  const crmBox = document.getElementById('crm-contacts-container');
  if (!crmBox) return;
  const totalBadge = document.getElementById('crm-total-badge');
  if (totalBadge) totalBadge.innerText = `${(appState.crm || []).length} / ۱۰۰ نفر`;

  const search = (document.getElementById('crm-search-input')?.value || '').trim().toLowerCase();
  const filter = document.getElementById('crm-filter-status')?.value || 'all';

  const list = (appState.crm || []).filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (search) {
      const matchName = String(c.name || '').toLowerCase().includes(search);
      const matchPhone = String(c.phone || '').includes(search);
      const matchNotes = String(c.notes || '').toLowerCase().includes(search);
      if (!matchName && !matchPhone && !matchNotes) return false;
    }
    return true;
  });

  if (list.length === 0) {
    crmBox.innerHTML = '<div class="text-[11px] text-slate-500 text-center py-3">مخاطبی با این فیلتر یافت نشد.</div>';
    return;
  }

  crmBox.innerHTML = list.map((c) => {
    const origIdx = (appState.crm || []).indexOf(c);
    const phone = phoneDigits(c.phone);
    const waPhone = phone.replace(/^0/, '98');
    const followupHtml = c.followupDate ? `<div class="text-[9px] text-amber-300 font-mono">📅 پیگیری: ${escapeHtml(c.followupDate)}</div>` : '';
    const notesHtml = c.notes ? `<div class="text-[9px] text-slate-400 truncate">📝 ${escapeHtml(c.notes)}</div>` : '';
    return `
      <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1.5 shadow-sm">
        <div class="flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-white">${escapeHtml(c.name)}</span>
            <span class="text-[10px] text-slate-400 mr-1">(${escapeHtml(c.source)})</span>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="cycleCRMStatus(${origIdx})" class="text-[10px] bg-orange-950 text-orange-300 border border-orange-700/40 px-2 py-0.5 rounded-full hover:bg-orange-900 transition">
              ${escapeHtml(c.status || 'تازه اضافه‌شده')} ↻
            </button>
            <button onclick="deleteCRMContact(${origIdx})" title="حذف مخاطب" class="text-slate-500 hover:text-rose-400 text-xs px-1">✕</button>
          </div>
        </div>
        ${followupHtml}
        ${notesHtml}
        <div class="grid grid-cols-3 gap-1.5 text-[10px] pt-0.5">
          <a href="tel:${phone}" class="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-center py-1 rounded-lg border border-slate-700">📞 تماس</a>
          <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" class="bg-slate-800 hover:bg-slate-700 text-green-400 text-center py-1 rounded-lg border border-slate-700">💬 واتساپ</a>
          <a href="sms:${phone}" class="bg-slate-800 hover:bg-slate-700 text-blue-400 text-center py-1 rounded-lg border border-slate-700">✉️ پیامک</a>
        </div>
      </div>
    `;
  }).join('');
}

function filterCRMList() {
  renderCRMList();
}

function addCRMContact() {
  const name = document.getElementById('crm-name').value.trim();
  const phone = document.getElementById('crm-phone').value.trim();
  const source = document.getElementById('crm-source').value;
  const followupDate = document.getElementById('crm-followup')?.value || '';
  const notes = document.getElementById('crm-notes')?.value?.trim() || '';

  if (!name) return alert('نام مخاطب را وارد کنید.');
  if (!appState.crm) appState.crm = [];
  appState.crm.unshift({ name, phone, source, followupDate, notes, status: 'تازه اضافه‌شده' });
  document.getElementById('crm-name').value = '';
  document.getElementById('crm-phone').value = '';
  if (document.getElementById('crm-followup')) document.getElementById('crm-followup').value = '';
  if (document.getElementById('crm-notes')) document.getElementById('crm-notes').value = '';
  saveAll();
  renderStage3();
}

function deleteCRMContact(idx) {
  if (!confirm('آیا این مخاطب از لیست حذف شود؟')) return;
  if (appState.crm && appState.crm[idx] !== undefined) {
    appState.crm.splice(idx, 1);
    saveAll();
    renderStage3();
  }
}

function cycleCRMStatus(idx) {
  const statuses = ['تازه اضافه‌شده', 'دعوت شده', 'ارائه شده', 'در حال پیگیری', 'مشتری / عضو تیم'];
  const cur = statuses.indexOf(appState.crm[idx].status);
  appState.crm[idx].status = statuses[(cur + 1) % statuses.length];
  saveAll();
  renderStage3();
}

function exportCRMToExcel() {
  const csv = contactsToCsv(appState.crm || []);
  downloadFile('everest_crm_contacts.csv', csv);
}

function togglePassCriterion(stageKey, idx) {
  const arr = stageKey === 's3' ? appState.s3Pass : appState.s4Pass;
  if (arr && arr[idx]) {
    arr[idx].done = !arr[idx].done;
    saveAll();
    stageKey === 's3' ? renderStage3() : renderStage4();
    renderTabs();
  }
}

// رندر مرحله ۴
function renderStage4() {
  const stepNames = ['۱. یاد بگیر', '۲. انجام بده', '۳. نشان بده', '۴. همراهی کن', '۵. واگذار کن (مستقل)'];
  const box = document.getElementById('duplication-members-container');
  box.innerHTML = (appState.dupTeam || []).map((m, idx) => `
    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-2">
      <div class="flex justify-between items-center text-xs">
        <span class="font-bold text-white">${escapeHtml(m.name)}</span>
        <span class="text-[10px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded-full font-bold">${stepNames[m.step - 1]}</span>
      </div>
      <div class="grid grid-cols-5 gap-1">
        ${[1,2,3,4,5].map(s => `
          <button onclick="setMemberDup(${idx}, ${s})" class="py-1 rounded text-[10px] font-bold transition ${s <= m.step ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'}">گام ${s}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  const criteriaContainer = document.getElementById('s4-pass-criteria');
  if (criteriaContainer && appState.s4Pass) {
    criteriaContainer.innerHTML = appState.s4Pass.map((item, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="togglePassCriterion('s4', ${idx})" class="accent-purple-500 rounded" />
        <span class="${item.done ? 'text-purple-200 font-bold' : 'text-slate-400'}">${escapeHtml(item.text)}</span>
      </label>
    `).join('');
  }
  renderOnlineTeam();
}

/* ---------------- دیده‌بانی آنلاین اعضای تیم برای بالاسری ---------------- */
let onlineTeamCache = [];

async function renderOnlineTeam() {
  const container = document.getElementById('online-team-container');
  const preview = document.getElementById('my-invite-link-preview');
  if (!container) return;

  const user = appState.user;
  const userEmail = (user?.email || '').trim().toLowerCase();

  // تولید لینک دعوت
  if (preview) {
    const base = window.location.origin + window.location.pathname;
    const inviteUrl = userEmail ? `${base}?upline=${encodeURIComponent(userEmail)}` : `${base}?upline=${encodeURIComponent(user?.name || '')}`;
    preview.innerText = inviteUrl;
  }

  // در حالت بدون حساب یا آفلاین:
  if (!user || user.local || !loadSession() || !isSupabaseConfigured()) {
    container.innerHTML = `
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-center space-y-1.5">
        <div class="text-[11px] text-amber-300 font-bold">حالت آنلاین غیرفعال است</div>
        <p class="text-[10px] text-slate-400">برای پایش آنلاین و نظارت بر مراحل اعضای تیم، با حساب آنلاین خود وارد شوید.</p>
      </div>
    `;
    return;
  }

  if (onlineTeamCache.length === 0) {
    container.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-2">در حال بارگذاری اعضای تیم… ⏳</div>';
    try {
      onlineTeamCache = await loadTeamMembers();
    } catch (_) {
      onlineTeamCache = [];
    }
  }

  if (!onlineTeamCache || onlineTeamCache.length === 0) {
    container.innerHTML = `
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-700/60 text-center space-y-1.5">
        <div class="text-[11px] text-slate-300 font-bold">هنوز عضوی به تیم شما متصل نشده است.</div>
        <p class="text-[10px] text-slate-400">لینک اختصاصی بالا را برای اعضای تیم خود بفرستید تا با ثبت‌نام، پیشرفت مراحلشان به صورت زنده اینجا نمایش داده شود.</p>
      </div>
    `;
    return;
  }

  // بروزرسانی کارت‌های خلاصه وضعیت سلامت تیم
  const statTotal = document.getElementById('team-stat-total');
  const statActive = document.getElementById('team-stat-active');
  const statAttention = document.getElementById('team-stat-attention');
  const statRisk = document.getElementById('team-stat-risk');

  let countActive = 0;
  let countAttention = 0;
  let countRisk = 0;

  onlineTeamCache.forEach(m => {
    const h = calculateMemberHealth(m);
    if (h.status === 'active') countActive++;
    else if (h.status === 'attention') countAttention++;
    else if (h.status === 'risk') countRisk++;
  });

  if (statTotal) statTotal.innerText = String(onlineTeamCache.length);
  if (statActive) statActive.innerText = String(countActive);
  if (statAttention) statAttention.innerText = String(countAttention);
  if (statRisk) statRisk.innerText = String(countRisk);

  const stageLabels = {
    1: { title: 'مرحله ۱: شروع', badge: 'bg-blue-600/30 text-blue-300 border-blue-500/40' },
    2: { title: 'مرحله ۲: حرکت', badge: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40' },
    3: { title: 'مرحله ۳: ساخت', badge: 'bg-orange-600/30 text-orange-300 border-orange-500/40' },
    4: { title: 'مرحله ۴: تکثیر', badge: 'bg-purple-600/30 text-purple-300 border-purple-500/40' },
    5: { title: 'مرحله ۵: راهبری', badge: 'bg-amber-500/30 text-amber-300 border-amber-400/40' }
  };

  // اعمال فیلترها و جستجو
  const search = (document.getElementById('team-search-input')?.value || '').trim().toLowerCase();
  const stageFilter = document.getElementById('team-filter-stage')?.value || 'all';
  const healthFilter = document.getElementById('team-filter-health')?.value || 'all';

  const filtered = onlineTeamCache.filter(m => {
    const h = calculateMemberHealth(m);
    if (stageFilter !== 'all' && String(m.current_stage || 1) !== stageFilter) return false;
    if (healthFilter !== 'all' && h.status !== healthFilter) return false;
    if (search) {
      const matchName = String(m.full_name || '').toLowerCase().includes(search);
      const matchEmail = String(m.email || '').toLowerCase().includes(search);
      if (!matchName && !matchEmail) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-3">هیچ عضوی با فیلتر انتخابی یافت نشد.</div>';
    return;
  }

  container.innerHTML = filtered.map((m) => {
    const stg = stageLabels[m.current_stage] || stageLabels[1];
    const health = calculateMemberHealth(m);
    const updatedTime = m.updated_at ? new Date(m.updated_at).toLocaleDateString('fa-IR') : 'نامشخص';
    const targetStageToApprove = m.pending_stage || (Number(m.approved_stage || m.current_stage || 1) + 1);
    const hasPending = Boolean(m.pending_stage && Number(m.pending_stage) > (Number(m.approved_stage) || 1));

    return `
      <div class="bg-slate-900/90 p-3 rounded-xl border ${hasPending ? 'border-amber-500/80 shadow-amber-950/40 shadow-md' : 'border-slate-700'} space-y-2 shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <div class="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>${escapeHtml(m.full_name || 'عضو بدون نام')}</span>
              ${m.role === 'leader' ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded font-bold">👑 راهبر</span>' : '<span class="text-[9px] bg-blue-600/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded font-bold">🎯 مشاور</span>'}
            </div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">${escapeHtml(m.email || '')}</div>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold border ${stg.badge}">${stg.title}</span>
            <span class="text-[9px] px-2 py-0.5 rounded-full font-bold border ${health.badge}">${health.label}</span>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-center text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <div>
            <span class="text-slate-400 block text-[9px]">سطح تأییدشده</span>
            <span class="font-bold text-slate-200">مرحله ${m.approved_stage || m.current_stage || 1}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[9px]">زنجیره ۷ روزه</span>
            <span class="font-bold text-emerald-400">🔥 ${m.s2_streak || 0} روز</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[9px]">مخاطبان CRM</span>
            <span class="font-bold text-sky-400">👤 ${m.crm_count || 0} نفر</span>
          </div>
        </div>

        ${hasPending ? `
          <div class="bg-amber-950/70 border border-amber-600/60 p-2.5 rounded-xl flex justify-between items-center text-xs mt-1.5">
            <div class="text-amber-200 font-bold flex items-center gap-1.5">
              <span>🔔</span>
              <span>درخواست تأیید ورود به مرحله ${m.pending_stage}</span>
            </div>
            <button onclick="approveDownlineMember('${m.id}', ${m.pending_stage})" class="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-lg text-xs shadow-md transition">
              ✓ تأیید مرحله ${m.pending_stage}
            </button>
          </div>
        ` : (targetStageToApprove <= 5 ? `
          <div class="flex justify-end pt-1">
            <button onclick="approveDownlineMember('${m.id}', ${targetStageToApprove})" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 font-bold transition">
              + تأیید و ارتقا به مرحله ${targetStageToApprove}
            </button>
          </div>
        ` : '')}

        <div class="flex justify-between items-center text-[9px] text-slate-400 pt-0.5">
          <div>${escapeHtml(health.reason)}</div>
          <div dir="ltr" class="text-slate-500">آخرین فعالیت: ${escapeHtml(updatedTime)}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function approveDownlineMember(memberId, targetStage) {
  if (!memberId) return;
  const num = Number(targetStage) || 2;
  const res = await approveMemberStage(memberId, num);
  if (res?.ok) {
    const mem = (onlineTeamCache || []).find(x => x.id === memberId);
    if (mem) {
      mem.approved_stage = num;
      mem.current_stage = Math.max(Number(mem.current_stage || 1), num);
      mem.pending_stage = null;
    }
    renderOnlineTeam();
    alert(`ورود به مرحله ${num} با موفقیت برای عضو تیم تأیید شد. ✓`);
  } else {
    alert(res?.message || 'خطا در ثبت تأیید مرحله');
  }
}

function filterTeamList() {
  renderOnlineTeam();
}

function exportTeamToExcel() {
  const csv = teamToCsv(onlineTeamCache || []);
  downloadFile('everest_team_members.csv', csv);
}

function downloadFile(filename, content, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function refreshOnlineTeam() {
  const container = document.getElementById('online-team-container');
  if (container) container.innerHTML = '<div class="text-[11px] text-slate-400 text-center py-2">در حال به‌روزرسانی زنده… ⏳</div>';
  try {
    onlineTeamCache = await loadTeamMembers();
  } catch (_) {
    onlineTeamCache = [];
  }
  renderOnlineTeam();
}

function copyMyInviteLink() {
  const preview = document.getElementById('my-invite-link-preview');
  const btn = document.getElementById('copy-invite-btn');
  if (!preview) return;
  const link = preview.innerText;
  try {
    navigator.clipboard.writeText(link);
    if (btn) {
      btn.innerText = 'کپی شد! ✓';
      setTimeout(() => { if (btn) btn.innerText = 'کپی لینک'; }, 2000);
    }
  } catch (_) {
    alert(link);
  }
}

function addDuplicationMember() {
  const input = document.getElementById('dup-member-name');
  if (!input.value.trim()) return;
  if (!appState.dupTeam) appState.dupTeam = [];
  appState.dupTeam.unshift({ name: input.value.trim(), step: 1 });
  input.value = '';
  saveAll();
  renderStage4();
}

function setMemberDup(idx, step) {
  appState.dupTeam[idx].step = step;
  saveAll();
  renderStage4();
}

// رندر مرحله ۵
function renderStage5() {
  const mList = document.getElementById('meetings-list');
  if (appState.meetings) {
    mList.innerHTML = appState.meetings.map(m => `
      <div class="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
        <span class="font-bold text-white">${escapeHtml(m.title)}</span>
        <span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">هدف: ${escapeHtml(m.goal)}</span>
      </div>
    `).join('');
  }

  const s5Container = document.getElementById('s5-standards-list');
  if (s5Container && appState.s5Standards) {
    s5Container.innerHTML = appState.s5Standards.map((st, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleS5Standard(${idx})" class="accent-amber-500 rounded" />
        <span class="${st.done ? 'text-amber-200 font-bold' : 'text-slate-200'}">${escapeHtml(st.text)}</span>
      </label>
    `).join('');
  }
}

function toggleS5Standard(idx) {
  const item = appState.s5Standards?.[idx];
  if (!item) return;
  item.done = !item.done;
  saveAll();
  renderStage5();
}

/* ---------------- داشبورد عددی (KPI) ---------------- */

const KPI_FIELDS = [
  ['kpi-sales', 'sales'],
  ['kpi-entries', 'entries'],
  ['kpi-active', 'active'],
  ['kpi-leaders', 'leaders'],
  ['kpi-depth', 'depth']
];

function kpiNumber(inputId) {
  const value = Number(document.getElementById(inputId)?.value);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function renderKpi() {
  const kpi = appState.kpi || {};
  for (const [inputId, key] of KPI_FIELDS) {
    const el = document.getElementById(inputId);
    if (el) el.value = String(Number(kpi[key]) || 0);
  }
  const active = Number(kpi.active) || 0;
  const leaders = Number(kpi.leaders) || 0;
  const rate = active > 0 ? Math.round((leaders / active) * 100) : 0;
  const rateEl = document.getElementById('kpi-rate');
  if (rateEl) rateEl.innerText = `${rate}٪`;
}

function saveKpi() {
  appState.kpi = {
    sales: kpiNumber('kpi-sales'),
    entries: kpiNumber('kpi-entries'),
    active: kpiNumber('kpi-active'),
    leaders: kpiNumber('kpi-leaders'),
    depth: kpiNumber('kpi-depth')
  };
  saveAll();
  renderKpi();
}

function addLeaderMeeting() {
  const title = document.getElementById('meeting-title').value.trim();
  const goal = document.getElementById('meeting-goal').value;
  if (!title) return;
  if (!appState.meetings) appState.meetings = [];
  appState.meetings.unshift({ title, goal });
  document.getElementById('meeting-title').value = '';
  saveAll();
  renderStage5();
}

// ثبت گزارش روزانه
async function submitDailyReport(stageNum) {
  const note = document.getElementById('s2-note').value.trim();
  if (stageNum === 2 && (appState.s2Streak || 0) < 7) {
    appState.s2Streak++;
  }
  if (!appState.reports) appState.reports = [];
  if (note) {
    appState.reports.unshift({ at: new Date().toISOString(), note: note.slice(0, 2000) });
    if (appState.reports.length > 100) appState.reports.length = 100;
  }
  saveAll();
  renderStage2();
  renderTabs();

  alert('گزارش شبانه شما ثبت شد و ۱ روز به زنجیره اجرای مستمر شما اضافه گردید! ✅');
  document.getElementById('s2-note').value = '';
}

// تایپ صوتی
function startVoiceInput(targetInputId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('مرورگر شما از تایپ صوتی پشتیبانی نمی‌کند.');
  const rec = new SpeechRecognition();
  rec.lang = 'fa-IR';
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const el = document.getElementById(targetInputId);
    el.value = (el.value ? el.value + ' ' : '') + text;
  };
  rec.start();
}

function toggleGoalModal() {
  document.getElementById('my-why-input').value = appState.why || '';
  document.getElementById('my-story-input').value = appState.story || '';
  document.getElementById('goal-modal').classList.toggle('hidden');
}

function saveGoalAndStory() {
  appState.why = document.getElementById('my-why-input').value.trim();
  appState.story = document.getElementById('my-story-input').value.trim();
  saveAll();
  toggleGoalModal();
}

function openHelperModal(type) {
  const modal = document.getElementById('helper-modal');
  const title = document.getElementById('helper-modal-title');
  const body = document.getElementById('helper-modal-body');
  modal.classList.remove('hidden');

  if (type === 'invite') {
    title.innerText = '💬 اصول دعوت استاندارد در سیستم ۵×۵ اورست';
    body.innerHTML = `
      <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-1.5">
        <div class="font-bold text-emerald-400">۴ قانون طلایی دعوت (مرحله ۱ تا ۳):</div>
        <ul class="list-disc pr-4 text-[11px] space-y-1">
          <li>کوتاه و طبیعی باشد.</li>
          <li>واضح و شفاف باشد و کنجکاوی ایجاد کند.</li>
          <li>بدون توضیح اضافه باشد (قرار نیست هنگام دعوت پرزنت کنی).</li>
          <li>با اعتمادبه‌نفس و بدون فشار باشد.</li>
        </ul>
      </div>
      <div class="bg-blue-950/50 border border-blue-700/40 p-3 rounded-xl text-[11px]">
        <div class="font-bold text-blue-300 mb-1">نمونه اسکریپت دعوت:</div>
        «سلام [نام] جان، وقتت بخیر. اخیراً در کنار کارم، یک پروژه تجاری سلامت‌محور و آنلاین رو با یک تیم آموزشی حرفه‌ای شروع کردم. با توجه به روحیه پیگیر و پرانرژی تو، به نظرم رسید می‌تونه برات جذاب باشه. فردا عصر حدود ۱۰ دقیقه زمان داری تلفنی کلیاتش رو بهت بگم؟»
      </div>
    `;
  } else if (type === 'product') {
    title.innerText = '🍵 فلش‌کارت دانش کاربردی محصول (مرحله ۳)';
    renderProductCardInModal();
  } else if (type === 'packages') {
    title.innerText = '📦 راهنمای پک‌های مشاوره سلامت نیوشانیک';
    body.innerHTML = `
      <div class="space-y-2 max-h-80 overflow-y-auto">
        <div class="bg-slate-900 p-3 rounded-xl border border-orange-500/40">
          <div class="font-extrabold text-orange-400">۱. پک کاهش وزن و تناسب اندام</div>
          <p class="text-[11px] text-slate-300 mt-1">چای سبز و نعناع فلفلی + دمنوش ریزمیوه‌های قرمز + چای سبز گزنه و برگ زیتون + دانه چیا + چای سبز آلوئه‌ورا با عسل</p>
        </div>
        <div class="bg-slate-900 p-3 rounded-xl border border-blue-500/40">
          <div class="font-extrabold text-blue-400">۲. پک آرامش اعصاب و بهبود خواب</div>
          <p class="text-[11px] text-slate-300 mt-1">دمنوش حس خوب زندگی + دمنوش بهارنارنج + چای سیاه و بادرنجبویه + دمنوش گل گاوزبان</p>
        </div>
        <div class="bg-slate-900 p-3 rounded-xl border border-emerald-500/40">
          <div class="font-extrabold text-emerald-400">۳. پک پاکسازی و سلامت کبد</div>
          <p class="text-[11px] text-slate-300 mt-1">دمنوش ریزمیوه‌های قرمز (میکس‌بری) + چای سبز و زوفا + خاکشیر و تخم خرفه + چای ترش</p>
        </div>
      </div>
    `;
  }
}

function renderProductCardInModal() {
  const p = newshaProducts[currentProdIdx];
  const body = document.getElementById('helper-modal-body');
  body.innerHTML = `
    <div class="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-700">
      <button onclick="stepProd(-1)" class="px-2.5 py-1 bg-slate-800 rounded-lg text-orange-400 font-bold">قبلی</button>
      <span class="text-[11px] font-bold">محصول ${currentProdIdx + 1} از ${newshaProducts.length}</span>
      <button onclick="stepProd(1)" class="px-2.5 py-1 bg-slate-800 rounded-lg text-orange-400 font-bold">بعدی</button>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-orange-500/30 space-y-2 max-h-72 overflow-y-auto">
      <span class="text-[10px] bg-orange-600/30 text-orange-300 px-2 py-0.5 rounded-full">${p.category}</span>
      <div class="font-extrabold text-sm text-white">${p.name}</div>
      <div>
        <div class="font-bold text-[11px] text-orange-400">مزایا:</div>
        <ul class="list-disc pr-4 text-[11px] text-slate-300">${p.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
      <div class="text-[11px]"><span class="text-emerald-400 font-bold">نحوه مصرف:</span> ${p.usage}</div>
      <div class="bg-slate-800 p-2 rounded-lg text-[10px]">
        <div class="font-bold text-blue-300">❓ ${p.faqQ}</div>
        <div class="text-slate-300 mt-0.5">💡 ${p.faqA}</div>
      </div>
      <div class="bg-amber-950/40 border border-amber-700/40 p-2 rounded-lg text-[11px] text-amber-200">
        🗣️ <b>معرفی ساده به مشتری:</b> ${p.pitch}
      </div>
    </div>
  `;
}

function stepProd(dir) {
  currentProdIdx = (currentProdIdx + dir + newshaProducts.length) % newshaProducts.length;
  renderProductCardInModal();
}

function closeHelperModal() {
  document.getElementById('helper-modal').classList.add('hidden');
}

function initTheme() {
  try {
    const isLight = localStorage.getItem('everest_theme') === 'light';
    if (isLight) {
      document.body.classList.add('light-mode');
      const btn = document.getElementById('dark-mode-btn');
      if (btn) btn.innerText = '☀️';
    }
  } catch (_) {}
}

function toggleDarkMode() {
  const isLight = document.body.classList.toggle('light-mode');
  try {
    localStorage.setItem('everest_theme', isLight ? 'light' : 'dark');
  } catch (_) {}
  const btn = document.getElementById('dark-mode-btn');
  if (btn) btn.innerText = isLight ? '☀️' : '🌙';
}

function checkEveningReminder() {
  const banner = document.getElementById('evening-reminder-banner');
  if (!banner) return;
  try {
    const isDismissed = sessionStorage.getItem('dismissed_evening_reminder');
    const isStreakTodayDone = (appState.s2DailyActions || []).every(a => a.done);
    if (isEveningReportTime() && !isStreakTodayDone && !isDismissed) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (_) {}
}

function dismissEveningReminder() {
  const banner = document.getElementById('evening-reminder-banner');
  if (banner) banner.classList.add('hidden');
  try {
    sessionStorage.setItem('dismissed_evening_reminder', 'true');
  } catch (_) {}
}

function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    alert('مرورگر شما از اعلان‌ها پشتیبانی نمی‌کند.');
    return;
  }
  Notification.requestPermission().then(permission => {
    const btn = document.getElementById('notif-btn');
    if (permission === 'granted') {
      if (btn) btn.innerText = '🔔✓';
      try {
        new Notification('سیستم ۵×۵ تیم اورست', {
          body: 'یادآور شبانه فعال شد. هر شب استریک خود را ثبت کنید!',
          icon: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2714%27 fill=%27%231d4ed8%27/%3E%3Ctext x=%2732%27 y=%2743%27 font-size=%2724%27 font-family=%27sans-serif%27 font-weight=%27bold%27 fill=%27white%27 text-anchor=%27middle%27%3E5%C3%975%3C/text%3E%3C/svg%3E'
        });
      } catch (_) {}
    } else {
      if (btn) btn.innerText = '🔕';
      alert('دسترسی به اعلان‌ها رد شد.');
    }
  });
}

// ===== ماژول مربی هوشمند DeepSeek AI =====
let aiChatHistory = [];

function openAIChatModal() {
  const modal = document.getElementById('ai-chat-modal');
  if (modal) modal.classList.remove('hidden');
  const cfg = getDeepSeekConfig();
  const input = document.getElementById('ai-api-key');
  if (input && cfg.apiKey) input.value = cfg.apiKey;
  updateAIStatusIndicator();
}

function closeAIChatModal() {
  const modal = document.getElementById('ai-chat-modal');
  if (modal) modal.classList.add('hidden');
}

function toggleAIConfigSection() {
  const sec = document.getElementById('ai-config-section');
  if (sec) sec.classList.toggle('hidden');
}

function updateAIStatusIndicator() {
  const indicator = document.getElementById('ai-status-indicator');
  const configured = isDeepSeekConfigured();
  if (indicator) {
    if (configured) {
      indicator.innerText = '🟢 متصل به DeepSeek — آماده پاسخ‌گویی هوشمند';
      indicator.className = 'text-[9px] text-emerald-300 mt-0.5';
    } else {
      indicator.innerText = '🟡 برای فعال‌سازی، کلید DeepSeek API را در ⚙️ وارد کنید';
      indicator.className = 'text-[9px] text-amber-300 mt-0.5';
    }
  }
}

function saveDeepSeekKey(source = 'modal') {
  const inputId = source === 'cloud' ? 'cloud-deepseek-key' : 'ai-api-key';
  const statusId = source === 'cloud' ? 'cloud-deepseek-status' : 'ai-key-status';
  const input = document.getElementById(inputId);
  const statusEl = document.getElementById(statusId);
  const key = (input?.value || '').trim();

  const errs = validateDeepSeekConfig({ apiKey: key });
  if (errs.length > 0) {
    if (statusEl) {
      statusEl.innerText = errs.join(' ');
      statusEl.className = 'text-[10px] text-rose-400 leading-relaxed';
    }
    return;
  }

  saveDeepSeekConfig({ apiKey: key });
  if (statusEl) {
    statusEl.innerText = 'کلید DeepSeek با موفقیت ذخیره شد! ✓';
    statusEl.className = 'text-[10px] text-emerald-400 leading-relaxed font-bold';
  }
  updateAIStatusIndicator();

  // همگام‌سازی فیلد دیگر
  const otherId = source === 'cloud' ? 'ai-api-key' : 'cloud-deepseek-key';
  const otherInput = document.getElementById(otherId);
  if (otherInput) otherInput.value = key;
}

async function testDeepSeekKey(source = 'modal') {
  const inputId = source === 'cloud' ? 'cloud-deepseek-key' : 'ai-api-key';
  const statusId = source === 'cloud' ? 'cloud-deepseek-status' : 'ai-key-status';
  const input = document.getElementById(inputId);
  const statusEl = document.getElementById(statusId);
  const key = (input?.value || '').trim();

  if (!key) {
    if (statusEl) {
      statusEl.innerText = 'ابتدا کلید API را وارد کنید.';
      statusEl.className = 'text-[10px] text-amber-400';
    }
    return;
  }

  if (statusEl) {
    statusEl.innerText = 'در حال تست اتصال به سرور دیپ‌سیک… ⏳';
    statusEl.className = 'text-[10px] text-sky-400';
  }

  const res = await testDeepSeekConnection(key);
  if (res.ok) {
    if (statusEl) {
      statusEl.innerText = 'اتصال موفقیت‌آمیز بود! هوش مصنوعی آماده است. ✅';
      statusEl.className = 'text-[10px] text-emerald-400 font-bold';
    }
    saveDeepSeekConfig({ apiKey: key });
    updateAIStatusIndicator();
  } else {
    if (statusEl) {
      statusEl.innerText = `خطای اتصال: ${res.message || 'ناموفق'}`;
      statusEl.className = 'text-[10px] text-rose-400';
    }
  }
}

async function sendAIMessage(customText = null) {
  const input = document.getElementById('ai-chat-input');
  const text = (customText || input?.value || '').trim();
  if (!text) return;

  if (input) input.value = '';

  const messagesBox = document.getElementById('ai-chat-messages');
  if (!messagesBox) return;

  // ۱. نمایش پیام کاربر
  const userHtml = `
    <div class="flex items-start justify-end gap-2">
      <div class="bg-purple-600 text-white p-3 rounded-2xl rounded-tl-none max-w-[85%] shadow-sm leading-relaxed">
        ${escapeHtml(text)}
      </div>
      <div class="w-7 h-7 rounded-lg bg-purple-500/30 border border-purple-400/40 flex items-center justify-center text-xs shrink-0 font-bold">شما</div>
    </div>
  `;
  messagesBox.insertAdjacentHTML('beforeend', userHtml);

  // ۲. نمایش حالت فکر کردن
  const loadingId = 'ai-loading-' + Date.now();
  const loadingHtml = `
    <div id="${loadingId}" class="flex items-start gap-2">
      <div class="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-sm shrink-0">🤖</div>
      <div class="bg-slate-800/90 border border-slate-700 p-2.5 rounded-2xl rounded-tr-none text-purple-300 text-[11px] animate-pulse">
        مربی در حال اندیشیدن است… ⏳
      </div>
    </div>
  `;
  messagesBox.insertAdjacentHTML('beforeend', loadingHtml);
  messagesBox.scrollTop = messagesBox.scrollHeight;

  // ۳. ارسال درخواست
  aiChatHistory.push({ role: 'user', content: text });
  if (aiChatHistory.length > 10) aiChatHistory = aiChatHistory.slice(-10);

  const res = await callDeepSeekChat({ messages: aiChatHistory });
  const loadEl = document.getElementById(loadingId);

  if (res.ok) {
    aiChatHistory.push({ role: 'assistant', content: res.reply });
    const formattedReply = escapeHtml(res.reply).replace(/\n/g, '<br/>');
    const coachHtml = `
      <div class="flex items-start gap-2">
        <div class="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-sm shrink-0">🤖</div>
        <div class="bg-slate-800/90 border border-purple-500/30 p-3 rounded-2xl rounded-tr-none text-slate-100 max-w-[88%] shadow-sm space-y-1">
          <div class="text-[10px] text-purple-300 font-extrabold flex items-center gap-1">مربی اورست (DeepSeek):</div>
          <div class="text-[11px] leading-relaxed text-slate-200">${formattedReply}</div>
        </div>
      </div>
    `;
    if (loadEl) loadEl.outerHTML = coachHtml;
  } else {
    const errorHtml = `
      <div class="flex items-start gap-2">
        <div class="w-7 h-7 rounded-lg bg-rose-600/30 border border-rose-500/40 flex items-center justify-center text-sm shrink-0">⚠️</div>
        <div class="bg-rose-950/70 border border-rose-600/40 p-3 rounded-2xl rounded-tr-none text-rose-200 max-w-[88%] space-y-1">
          <div class="text-[10px] font-bold">خطا در دریافت پاسخ:</div>
          <div class="text-[11px] leading-relaxed">${escapeHtml(res.message)}</div>
          ${res.reason === 'no-key' ? '<button onclick="toggleAIConfigSection()" class="mt-1 bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">ورود کلید DeepSeek</button>' : ''}
        </div>
      </div>
    `;
    if (loadEl) loadEl.outerHTML = errorHtml;
  }
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

function handleAIChatKeyDown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendAIMessage();
  }
}

function triggerQuickAIPrompt(type) {
  if (type === 'invite') {
    const name = prompt('نام مخاطب یا نسبت او را بنویسید (مثال: همکار سابق / دوستم علی):');
    if (!name) return;
    const promptText = buildInvitePrompt({ contactName: name, relation: 'آشنا', interest: 'درآمد پاره‌وقت و محصولات سلامت' });
    sendAIMessage(promptText);
  } else if (type === 'objection') {
    const obj = prompt('بهانه یا اعتراض مشتری را وارد کنید (مثال: قیمت محصولات بالاست / وقت ندارم):');
    if (!obj) return;
    const promptText = buildObjectionPrompt(obj);
    sendAIMessage(promptText);
  } else if (type === 'review') {
    const promptText = buildCoachReviewPrompt({
      stage: activeStageView || 1,
      streak: appState.s2Streak || 0,
      crmCount: (appState.crm || []).length,
      goal: appState.myWhy || ''
    });
    sendAIMessage(promptText);
  }
}

function startAIVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('تایپ صوتی در این مرورگر پشتیبانی نمی‌شود. از گوگل کروم استفاده کنید.');
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = 'fa-IR';
  recognition.continuous = false;
  recognition.interimResults = false;

  const btn = document.getElementById('ai-voice-btn');
  if (btn) btn.classList.add('bg-red-600', 'animate-pulse');

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    const input = document.getElementById('ai-chat-input');
    if (input) input.value = text;
  };
  recognition.onerror = () => {
    if (btn) btn.classList.remove('bg-red-600', 'animate-pulse');
  };
  recognition.onend = () => {
    if (btn) btn.classList.remove('bg-red-600', 'animate-pulse');
  };
  recognition.start();
}

function initApp() {
  initTheme();
  checkEveningReminder();
  try {
    const params = new URLSearchParams(window.location.search);
    const dsParam = params.get('deepseek') || params.get('ai_key');
    if (dsParam && dsParam.trim().startsWith('sk-')) {
      saveDeepSeekConfig({ apiKey: dsParam.trim() });
    }
  } catch (_) {}
  const dsCfg = getDeepSeekConfig();
  const cloudDsInput = document.getElementById('cloud-deepseek-key');
  if (cloudDsInput && dsCfg.apiKey) cloudDsInput.value = dsCfg.apiKey;
  const session = loadSession();
  const sessionUser = currentUser(session);

  // نشست متعلق به حساب دیگری است → داده محلی قبلی نمایش داده نشود.
  if (sessionUser && !appState.user?.local) {
    if (appState.ownerId && appState.ownerId !== sessionUser.id) appState = getDefaultData();
    else if (appState.user && appState.user.id !== sessionUser.id) appState = getDefaultData();
  }
  if (!appState.user && sessionUser) {
    appState.ownerId = sessionUser.id;
    appState.user = {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name || 'عضو تیم اورست',
      upline: sessionUser.upline || 'راهبر تیم اورست'
    };
  }
  if (sessionUser && appState.user && !appState.user.local) {
    appState.user.id = sessionUser.id;
    appState.user.email = sessionUser.email || appState.user.email || '';
    appState.ownerId = sessionUser.id;
  }
  if (appState.user && !appState.user.local && isSupabaseConfigured() && !loadSession()) {
    // کاربر قبلاً با حساب وارد شده ولی نشستی وجود ندارد → دوباره ورود
    appState.user = null;
  }

  if (!appState.user) {
    clearAuthFields();
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('upline') || params.get('ref');
      const uplineInput = document.getElementById('reg-upline');
      if (ref && uplineInput) {
        uplineInput.value = decodeURIComponent(ref).trim();
      }
    } catch (_) {}
    document.getElementById('auth-screen').classList.remove('hidden');
    showAuthStep(1);
    return;
  }
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('user-display-name').innerText = appState.user.name || 'عضو تیم اورست';
  document.getElementById('upline-display').innerText =
    (appState.user.local ? 'حالت محلی: ' : '') + (appState.user.upline || 'راهبر تیم اورست');

  // شمارنده‌های «روزانه» با تغییر روز از صفر شروع می‌شوند.
  // فقط محلی ذخیره می‌شود تا با همگام‌سازی ابری هم‌زمان با loadFromCloud تداخل نکند.
  if (resetDailyCounters(appState)) saveToStorage(appState);

  renderTabs();
  renderStage1();
  renderStage2();
  renderStage3();
  renderStage4();
  renderStage5();
  renderKpi();
  renderCoachCard();
  renderOnlineTeam();
  updateCloudBadge();
  update72HourTimer();
  if (!timerId) timerId = setInterval(update72HourTimer, 1000);

  // همگام‌سازی با ابر (اگر Supabase تنظیم شده باشد)
  if (isSupabaseConfigured() && loadSession() && !appState.user.local) {
    loadFromCloud(appState.user.id).then(remote => {
      if (!remote) return;
      cloudLabel('ok');
      const remoteTouched = remote.lastModified || 0;
      const localTouched = appState.lastModified || 0;
      if (remoteTouched > localTouched) {
        const keepUser = appState.user;
        const remoteNationalId = remote.user?.nationalId || '';
        appState = remote;
        appState.user = { ...(remote.user || {}), ...keepUser };
        delete appState.user.nationalId;
        appState.ownerId = appState.user.id || appState.ownerId;
        // ممکن است نسخه ابری هنوز شمارنده‌های دیروز را داشته باشد.
        resetDailyCounters(appState);
        saveToStorage(appState);
        if (remoteNationalId) {
          saveProfile({ national_id: remoteNationalId }).then(r => {
            if (!r.ok && appState.user) {
              appState.user.nationalId = remoteNationalId;
              saveToStorage(appState);
            }
          });
        }
        document.getElementById('user-display-name').innerText = appState.user.name || 'عضو تیم اورست';
        document.getElementById('upline-display').innerText =
          (appState.user.local ? 'حالت محلی: ' : '') + (appState.user.upline || 'راهبر تیم اورست');
        renderTabs();
        renderStage1();
        renderStage2();
        renderStage3();
        renderStage4();
        renderStage5();
        renderKpi();
        renderCoachCard();
      }
    }).catch(() => cloudLabel('err'));
  }
}

// ثبت Service Worker برای PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update().catch(() => {});
    }).catch(() => {});
  });
}

// ===== دسترسی توابع از طریق onclick در HTML =====
// (چون app.js یک ES Module است، توابع به‌صورت پیش‌فرض global نیستند)
Object.assign(window, {
  handlePasswordAuth,
  requestOtp,
  verifyOtpAndStart,
  backToEmailStep,
  toggleLocalMode,
  signOutUser,
  resetDemo,
  switchStage,
  toggleS1Step,
  setS2Streak,
  changeCounter,
  addCRMContact,
  cycleCRMStatus,
  togglePassCriterion,
  addDuplicationMember,
  setMemberDup,
  toggleS5Standard,
  saveKpi,
  addLeaderMeeting,
  submitDailyReport,
  startVoiceInput,
  toggleGoalModal,
  saveGoalAndStory,
  openHelperModal,
  stepProd,
  closeHelperModal,
  openCloudModal,
  closeCloudModal,
  testCloudConnection,
  saveCloudConfigAndSync,
  disconnectCloud,
  triggerN8nBackup,
  exportBackupFile,
  triggerImportBackup,
  handleBackupFileSelect,
  refreshOnlineTeam,
  copyMyInviteLink,
  toggleDarkMode,
  requestNotificationPermission,
  dismissEveningReminder,
  deleteCRMContact,
  filterCRMList,
  exportCRMToExcel,
  filterTeamList,
  exportTeamToExcel,
  openAIChatModal,
  closeAIChatModal,
  toggleAIConfigSection,
  saveDeepSeekKey,
  testDeepSeekKey,
  sendAIMessage,
  handleAIChatKeyDown,
  triggerQuickAIPrompt,
  startAIVoiceInput,
  saveAll,
  renderCoachCard,
  renderInitialList30,
  addInitialList30Member,
  deleteInitialList30Member,
  exportInitialList30Csv,
  toggleRoleUplineField,
  requestLeaderApproval,
  sendLeaderWhatsAppApprovalRequest,
  approveDownlineMember
});

// راه‌اندازی — اگر کاربر از لینک ایمیل برگشته باشد، اول نشست را بساز.
(async () => {
  let redirect = null;
  try { redirect = await consumeAuthRedirect(); } catch (_) { /* بی‌اهمیت */ }
  initApp();
  if (redirect && redirect.ok === false) authMsg(1, 'err', authErrorText(redirect));
})();

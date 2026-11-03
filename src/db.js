/**
 * لایه داده: ذخیره‌سازی محلی (Offline-first) + همگام‌سازی با Supabase + پشتیبان‌گیری n8n
 */

import { getSupabaseConfig, isConfigured as cfgValid, normalizeConfig, getN8nConfig } from './config.js';
import { DEFAULT_DATA } from './defaults.js';
import { authHeaders, currentUser } from './auth.js';

const STORAGE_KEY = 'everest_5x5_full_v2';

/** لیست‌هایی که محتوایشان کاملاً از کاربر می‌آید و نباید با پیش‌فرض پر شوند. */
const USER_LIST_KEYS = new Set(['crm', 'dupTeam', 'meetings', 'initialList30']);

/** حذف کامل داده محلی (مثلاً هنگام خروج یا تغییر حساب) */
export function clearStorage() {
  try {
    const s = ls();
    if (s) s.removeItem(STORAGE_KEY);
  } catch (_) { /* بدون دسترسی */ }
}

/**
 * کد ملی نباید در JSON وضعیت (`state_data`) برود؛ حتی اگر در داده قدیمی باشد.
 * خروجی جدید است و ورودی را تغییر نمی‌دهد.
 */
export function stripNationalId(state) {
  if (!state || typeof state !== 'object') return state;
  const user = state.user;
  if (!user || typeof user !== 'object' || !Object.prototype.hasOwnProperty.call(user, 'nationalId')) {
    return state;
  }
  const clean = { ...state, user: { ...user } };
  delete clean.user.nationalId;
  return clean;
}

export function isSupabaseConfigured(cfg = getSupabaseConfig()) {
  return cfgValid(cfg);
}

/**
 * سربرگ‌های احراز هویت‌شده (JWT کاربر)
 * اگر کاربر وارد نشده باشد، null برمی‌گردد → داده‌ای خوانده/نوشته نمی‌شود
 */
async function headers() {
  return authHeaders();
}

/**
 * ادغام داده ذخیره‌شده با پیش‌فرض‌ها
 */
export function mergeWithDefaults(stored) {
  const out = { ...DEFAULT_DATA, ...(stored || {}) };
  for (const key of Object.keys(DEFAULT_DATA)) {
    const def = DEFAULT_DATA[key];
    const cur = out[key];
    if (Array.isArray(def) && (!Array.isArray(cur) || cur.length === 0) && def.length > 0 && key !== 'crm' && key !== 'dupTeam' && key !== 'meetings' && key !== 'initialList30') {
      out[key] = JSON.parse(JSON.stringify(def));
    }
    if (cur === undefined || cur === null) {
      out[key] = Array.isArray(def) ? JSON.parse(JSON.stringify(def)) : def;
    }
  }

  // نوع داده باید با پیش‌فرض بخواند: اگر مقدار ذخیره‌شده برای یک کلید آرایه‌ای
  // خراب باشد (مثلاً رشته یا شیء از یک نسخه قدیمی/رکورد ناقص)، همان‌جا اصلاح
  // می‌شود تا رندرها به `.map` روی غیرآرایه نخورند.
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!Array.isArray(DEFAULT_DATA[key]) || Array.isArray(out[key])) continue;
    out[key] = USER_LIST_KEYS.has(key) ? [] : JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
  }

  // KPI یک شیء تودرتوست؛ کلیدهای جاافتاده باید از پیش‌فرض پر شوند.
  const kpi = out.kpi && typeof out.kpi === 'object' && !Array.isArray(out.kpi) ? out.kpi : {};
  out.kpi = { ...DEFAULT_DATA.kpi };
  for (const key of Object.keys(DEFAULT_DATA.kpi)) {
    const n = Number(kpi[key]);
    out.kpi[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  }

  return out;
}

function ls() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

/**
 * تصمیم «کدام نسخه جدیدتر است» هنگام بازیابی داده ابری (پس از ورود).
 *
 * فقط وقتی نسخه ابری ترجیح دارد که واقعاً جدیدتر باشد. مقادیر نامعتبر
 * (`undefined` / `NaN` / منفی) صفر حساب می‌شوند تا یک رکورد خراب هیچ‌وقت
 * داده محلی کاربر را از بین نبرد.
 *
 * @param {number} remoteTouched lastModified نسخه ابری
 * @param {number} localTouched lastModified نسخه محلی
 * @returns {boolean} true یعنی داده ابری جایگزین شود
 */
export function shouldPreferRemote(remoteTouched, localTouched) {
  const remote = Number(remoteTouched);
  const local = Number(localTouched);
  const r = Number.isFinite(remote) && remote > 0 ? remote : 0;
  const l = Number.isFinite(local) && local > 0 ? local : 0;
  return r > l;
}

export function loadFromStorage() {
  try {
    const s = ls();
    if (!s) return mergeWithDefaults(null);
    const raw = s.getItem(STORAGE_KEY);
    return mergeWithDefaults(raw ? JSON.parse(raw) : null);
  } catch (e) {
    console.error('خطا در بارگذاری داده:', e);
    return mergeWithDefaults(null);
  }
}

export function saveToStorage(state) {
  try {
    const s = ls();
    if (!s) return false;
    s.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('خطا در ذخیره داده:', e);
    return false;
  }
}

/**
 * تست اتصال — بدون نوشتن داده
 * خروجی: { ok, reason?, status?, detail? }
 */
export async function testConnection(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();

  // بدون نشست: فقط سلامت Auth را می‌سنجیم (بدون نیاز به دسترسی جدول)
  if (!h) {
    try {
      const res = await fetch(`${cfg.url}/auth/v1/health`, { cache: 'no-store' });
      if (res.ok) return { ok: true, status: res.status, scope: 'auth-only' };
      return { ok: false, reason: 'http', status: res.status };
    } catch (e) {
      return { ok: false, reason: 'network', detail: String(e?.message || e) };
    }
  }

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?select=user_id&limit=1`,
      { headers: h, cache: 'no-store' }
    );

    if (res.ok) return { ok: true, status: res.status, scope: 'full' };

    const text = (await res.text()).slice(0, 400);
    if (res.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(text))
      return { ok: false, reason: 'table-missing', status: res.status, detail: text };
    if (res.status === 401 || res.status === 403)
      return { ok: false, reason: 'auth', status: res.status, detail: text };
    return { ok: false, reason: 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * ذخیره در Supabase (upsert روی user_id)
 */
export async function saveToCloud(state, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();
  if (!h) return { ok: false, reason: 'no-session' };

  const user = currentUser();
  const userId = user?.id;
  if (!userId) return { ok: false, reason: 'no-session' };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/user_state?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        state_data: stripNationalId(state),
        updated_at: new Date().toISOString()
      })
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'auth' : 'http', status: res.status, detail: text };
  } catch (e) {
    console.error('خطا در اتصال به Supabase:', e);
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * خواندن از Supabase
 */
export async function loadFromCloud(_ignoredUserId, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return null;

  const h = await headers();
  if (!h) return null;

  const userId = currentUser()?.id;
  if (!userId) return null;

  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/user_state?user_id=eq.${encodeURIComponent(userId)}&select=state_data`,
      { headers: h, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.state_data ? mergeWithDefaults(rows[0].state_data) : null;
  } catch (e) {
    console.error('خطا در خواندن از Supabase:', e);
    return null;
  }
}

/**
 * ذخیره پروفایل در جدول جدا (`profiles`).
 * کد ملی هرگز داخل `state_data` نمی‌رود و فقط با RLS خود کاربر ذخیره می‌شود.
 * کلید این جدول `id` است (همان شناسه کاربر در Auth)؛ با جدول موجود سازگاریم.
 */
export async function saveProfile(profile = {}, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, reason: 'not-configured' };

  const h = await headers();
  if (!h) return { ok: false, reason: 'no-session' };
  const user = currentUser();
  const userId = user?.id;
  if (!userId) return { ok: false, reason: 'no-session' };

  const row = { id: userId };
  if (user?.email) row.email = String(user.email).trim().toLowerCase();
  if (profile.full_name != null) row.full_name = String(profile.full_name).slice(0, 200);
  if (profile.upline != null) row.upline = String(profile.upline).slice(0, 200);
  if (profile.upline_email != null) {
    row.upline_email = String(profile.upline_email).trim().toLowerCase().slice(0, 200);
  } else if (profile.upline && profile.upline.includes('@')) {
    row.upline_email = String(profile.upline).trim().toLowerCase().slice(0, 200);
  }
  if (profile.current_stage != null) row.current_stage = Number(profile.current_stage) || 1;
  if (profile.s2_streak != null) row.s2_streak = Number(profile.s2_streak) || 0;
  if (profile.crm_count != null) row.crm_count = Number(profile.crm_count) || 0;
  if (profile.role != null) row.role = String(profile.role).slice(0, 50);
  if (profile.phone != null) row.phone = String(profile.phone).replace(/[^\d+]/g, '').slice(0, 20) || null;
  // referred_by هرگز از کلاینت فرستاده نمی‌شود؛ سرور آن را از روی کد تعیین می‌کند.
  if (profile.referrer_code != null) {
    row.referrer_code = String(profile.referrer_code).trim().toUpperCase().slice(0, 40) || null;
  }
  // approved_stage عمداً اینجا نوشته نمی‌شود: فقط تأیید راهبر (RPC) آن را بالا می‌برد.
  // اگر کلاینت آن را بنویسد، مقدار محلی کهنه (۱) تأیید راهبر را بازنویسی می‌کند.
  // pending_stage هم فقط از طریق RPC درخواست/تصمیم مدیریت می‌شود.
  // فقط اگر مقدار واقعی آمده باشد؛ در غیر این صورت مقدار قبلی پاک نمی‌شود.
  if (profile.national_id) row.national_id = String(profile.national_id).slice(0, 40);

  try {
    const res = await fetch(`${cfg.url}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row)
    });
    if (res.ok) return { ok: true };
    const text = (await res.text()).slice(0, 300);
    if (res.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(text))
      return { ok: false, reason: 'table-missing', status: res.status, detail: text };
    return { ok: false, reason: res.status === 401 || res.status === 403 ? 'auth' : 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * اعتبارسنجی کد معرف پیش از ثبت‌نام.
 * این RPC برای anon هم باز است، چون کاربر هنوز حساب ندارد.
 * @param {string} code کد معرف
 * @returns {Promise<{valid:boolean, ownerId:string|null}>}
 */
export async function resolveInviteCode(code, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const value = String(code || '').trim().toUpperCase();
  if (!cfgValid(cfg) || !value) return { valid: false, ownerId: null };

  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/resolve_invite_code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': cfg.key, 'Authorization': `Bearer ${cfg.key}` },
      body: JSON.stringify({ p_code: value })
    });
    if (!res.ok) return { valid: false, ownerId: null, reason: 'http', status: res.status };
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { valid: Boolean(row?.valid), ownerId: row?.owner_id || null };
  } catch (e) {
    return { valid: false, ownerId: null, reason: 'network', detail: String(e && e.message || e) };
  }
}

/**
 * کد معرف فعال خود کاربر (اگر هیچ کدی ندارد، null).
 */
export async function getMyInviteCode(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const h = await headers();
  const user = currentUser();
  if (!cfgValid(cfg) || !h || !user?.id) return null;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/invite_codes?select=code,used_count,max_uses,active&owner_id=eq.${user.id}&active=eq.true&order=created_at.desc&limit=1`,
      { headers: h }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

/**
 * ساخت کد معرف تازه برای کاربر جاری.
 * @returns {Promise<{ok:boolean, code?:string, message?:string}>}
 */
export async function createInviteCode(maxUses = 0, expiresDays = 0, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const h = await headers();
  if (!cfgValid(cfg) || !h) return { ok: false, message: 'عدم دسترسی به سرور' };
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/new_invite_code`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ p_max_uses: Number(maxUses) || 0, p_expires_days: Number(expiresDays) || 0 })
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, message: 'ساخت کد ناموفق بود' };
    let code = '';
    try { code = JSON.parse(text); } catch (_) { code = text; }
    code = String(code || '').replace(/^"|"$/g, '').trim();
    return code ? { ok: true, code } : { ok: false, message: 'کد خالی برگشت' };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
}

/**
 * درخواست‌های تأیید مرحله که به من ارجاع شده‌اند (زنجیرهٔ بالادست).
 * پروفایل درخواست‌دهنده جدا خوانده می‌شود چون FK مستقیمی بین
 * stage_approvals.user_id و profiles.id وجود ندارد.
 */
export async function loadPendingApprovals(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const h = await headers();
  const user = currentUser();
  if (!cfgValid(cfg) || !h || !user?.id) return [];
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/stage_approvals?select=id,user_id,target_stage,requested_at&approver_id=eq.${user.id}&status=eq.pending&order=requested_at.asc`,
      { headers: h }
    );
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return [];

    const ids = [...new Set(rows.map(r => r.user_id))].filter(Boolean);
    const pRes = await fetch(
      `${cfg.url}/rest/v1/profiles?select=id,full_name,email,current_stage,approved_stage&id=in.(${ids.join(',')})`,
      { headers: h }
    );
    const people = pRes.ok ? await pRes.json() : [];
    const byId = new Map((Array.isArray(people) ? people : []).map(p => [p.id, p]));

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      targetStage: r.target_stage,
      requestedAt: r.requested_at,
      name: byId.get(r.user_id)?.full_name || byId.get(r.user_id)?.email || 'عضو تیم',
      email: byId.get(r.user_id)?.email || '',
      stage: byId.get(r.user_id)?.approved_stage || byId.get(r.user_id)?.current_stage || 1
    }));
  } catch (_) {
    return [];
  }
}

/**
 * تصمیم روی یک درخواست تأیید (فقط تأییدکنندهٔ زنجیره مجاز است).
 */
export async function decideStageApproval(approvalId, approve, note = '', rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const h = await headers();
  if (!cfgValid(cfg) || !h) return { ok: false, message: 'عدم دسترسی به سرور' };
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/decide_stage_approval`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ approval_id: Number(approvalId), approve: Boolean(approve), note: note || null })
    });
    const text = await res.text();
    if (res.ok) return { ok: true };
    let msg = 'خطا در ثبت تصمیم';
    try { msg = JSON.parse(text)?.message || msg; } catch (_) { if (text) msg = text.slice(0, 200); }
    return { ok: false, message: msg };
  } catch (e) {
    return { ok: false, message: String(e && e.message || e) };
  }
}

/**
 * خواندن پروفایل خودم (مقادیر authoritative تأیید مرحله).
 * approved_stage و pending_stage در جدول profiles نگهداری می‌شوند و منبع
 * حقیقت برای باز شدن مرحله‌ها هستند؛ state_data فقط کپی کار است.
 */
export async function loadMyProfile(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  const h = await headers();
  const user = currentUser();
  if (!cfgValid(cfg) || !h || !user?.id) return null;
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/profiles?select=id,full_name,email,role,approved_stage,current_stage,pending_stage,referred_by,referrer_code&id=eq.${user.id}`,
      { headers: h, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (_) {
    return null;
  }
}

/**
 * بارگذاری آنلاین اعضای تیم زیرمجموعه برای بالاسری
 */
export async function loadTeamMembers(rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return [];

  const h = await headers();
  if (!h) return [];
  const user = currentUser();
  const userId = user?.id;
  const userEmail = (user?.email || '').trim().toLowerCase();
  if (!userId && !userEmail) return [];

  try {
    let filter = '';
    if (userId && userEmail) {
      filter = `or=(upline_id.eq.${userId},upline_email.ilike.${encodeURIComponent(userEmail)})`;
    } else if (userId) {
      filter = `upline_id=eq.${userId}`;
    } else {
      filter = `upline_email=ilike.${encodeURIComponent(userEmail)}`;
    }
    const url = `${cfg.url}/rest/v1/profiles?${filter}&select=id,full_name,email,current_stage,s2_streak,crm_count,role,approved_stage,pending_stage,updated_at&order=updated_at.desc`;
    const res = await fetch(url, { headers: h, cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('خطا در دریافت اعضای تیم:', e);
    return [];
  }
}

/**
 * تأیید ورود عضو تیم به مرحله هدف توسط راهبر
 */
export async function approveMemberStage(memberId, targetStage, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg) || !memberId) return { ok: false, message: 'تنظیمات یا شناسه نامعتبر' };
  const h = await headers();
  if (!h) return { ok: false, message: 'عدم احراز هویت' };

  try {
    // ابتدا از طریق RPC امن
    const resRpc = await fetch(`${cfg.url}/rest/v1/rpc/approve_member_stage`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ member_id: memberId, target_stage: Number(targetStage) || 2 })
    });
    if (resRpc.ok) {
      const data = await resRpc.json();
      return data?.ok ? { ok: true, data } : { ok: true };
    }

    // جایگزین با PATCH مستقیم روی ردیف عضو با دسترسی RLS راهبر
    const resPatch = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${memberId}`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({
        approved_stage: Number(targetStage) || 2,
        current_stage: Number(targetStage) || 2,
        pending_stage: null,
        updated_at: new Date().toISOString()
      })
    });
    if (resPatch.ok) return { ok: true };
    return { ok: false, message: 'خطا در ثبت تایید مرحله' };
  } catch (err) {
    return { ok: false, message: err?.message || 'خطای شبکه' };
  }
}

/**
 * ارسال درخواست تأیید ورود به مرحله برای راهبر توسط عضو
 */
export async function requestStageApproval(targetStage, rawCfg = getSupabaseConfig()) {
  const cfg = normalizeConfig(rawCfg);
  if (!cfgValid(cfg)) return { ok: false, message: 'تنظیمات نامعتبر' };
  const h = await headers();
  if (!h) return { ok: false, message: 'عدم احراز هویت' };
  const user = currentUser();
  if (!user?.id) return { ok: false, message: 'عدم احراز هویت' };

  try {
    const resRpc = await fetch(`${cfg.url}/rest/v1/rpc/request_stage_approval`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ target_stage: Number(targetStage) || 2 })
    });
    if (resRpc.ok) return { ok: true };

    const resPatch = await fetch(`${cfg.url}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({
        pending_stage: Number(targetStage) || 2,
        updated_at: new Date().toISOString()
      })
    });
    return { ok: resPatch.ok };
  } catch (err) {
    return { ok: false, message: err?.message || 'خطای شبکه' };
  }
}

export async function syncState(state, cfg = getSupabaseConfig()) {
  const local = saveToStorage(state);
  const cloud = await saveToCloud(state, cfg);
  return { local, cloud };
}

export function getDefaultData() {
  return mergeWithDefaults(null);
}

/**
 * ارسال نسخه پشتیبان به وب‌هوک n8n
 * کد ملی طبق اصل حفظ حریم خصوصی هرگز فرستاده نمی‌شود.
 */
export async function sendBackupToN8n(state, rawN8nCfg = getN8nConfig()) {
  const cfg = rawN8nCfg || getN8nConfig();
  const webhookUrl = String(cfg?.webhookUrl || '').trim();
  if (!webhookUrl) return { ok: false, reason: 'not-configured' };

  const cleanState = stripNationalId(state) || {};
  const user = currentUser() || cleanState.user || {};

  const payload = {
    source: 'everest-5x5-system',
    version: '0.6.0',
    timestamp: new Date().toISOString(),
    user: {
      id: user.id || 'local',
      name: user.name || '',
      email: user.email || '',
      upline: user.upline || '',
      isLocal: Boolean(user.local)
    },
    summary: {
      streak: Number(cleanState.s2Streak) || 0,
      crmCount: Array.isArray(cleanState.crm) ? cleanState.crm.length : 0,
      teamCount: Array.isArray(cleanState.dupTeam) ? cleanState.dupTeam.length : 0,
      meetingsCount: Array.isArray(cleanState.meetings) ? cleanState.meetings.length : 0,
      kpi: cleanState.kpi || {}
    },
    state: cleanState
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return { ok: true, status: res.status };
    const text = (await res.text()).slice(0, 300);
    return { ok: false, reason: 'http', status: res.status, detail: text };
  } catch (e) {
    return { ok: false, reason: 'network', detail: String(e?.message || e) };
  }
}

/**
 * تولید خروجی JSON تمیز برای دانلود فایل پشتیبان
 */
export function exportStateAsJson(state) {
  const clean = stripNationalId(state);
  return JSON.stringify({
    everest_backup_version: '0.6.0',
    exported_at: new Date().toISOString(),
    data: clean
  }, null, 2);
}

/**
 * بازیابی و اعتبارسنجی داده از فایل پشتیبان JSON
 */
export function importStateFromJson(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { ok: false, reason: 'ورودی نامعتبر یا خالی است.' };
  }
  try {
    const parsed = JSON.parse(jsonString);
    const data = parsed?.data || parsed;
    if (typeof data !== 'object' || !data || Array.isArray(data)) {
      return { ok: false, reason: 'ساختار فایل پشتیبان معتبر نیست.' };
    }
    const clean = stripNationalId(data);
    const merged = mergeWithDefaults(clean);
    return { ok: true, state: merged };
  } catch (e) {
    return { ok: false, reason: 'فایل JSON نامعتبر است: ' + String(e?.message || e) };
  }
}

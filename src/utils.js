/**
 * ابزارهای کوچک مشترک
 * -------------------
 * خروجی این ماژول باید بدون DOM هم قابل تست باشد.
 */

/** فرار دادن متن برای درج امن در HTML (متن و attribute) */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** فقط رقم‌ها را نگه می‌دارد؛ برای tel / sms / wa.me */
export function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** کلید تاریخ محلی به شکل YYYY-MM-DD (نه UTC) */
export function localDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * شمارنده‌های «روزانه» را با تغییر روز صفر می‌کند.
 * state را در جا تغییر می‌دهد و می‌گوید آیا تغییری داده شد.
 */
export function resetDailyCounters(state, today = localDateKey()) {
  if (!state || typeof state !== 'object') return false;
  if (state.counterDate === today) return false;

  for (const key of ['s2Counters', 's3Counters']) {
    if (!Array.isArray(state[key])) continue;
    for (const item of state[key]) {
      if (item && typeof item === 'object') item.count = 0;
    }
  }
  state.counterDate = today;
  return true;
}

/**
 * ارزیابی وضعیت سلامت و فعالیت عضو تیم بر اساس استریک، مرحله و آخرین فعالیت
 */
export function calculateMemberHealth(member, now = new Date()) {
  if (!member || typeof member !== 'object') {
    return { status: 'attention', label: '🟡 نیازمند توجه', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', reason: 'اطلاعات نامشخص' };
  }
  const streak = Number(member.s2_streak || 0);
  const stage = Number(member.current_stage || 1);
  const updated = member.updated_at ? new Date(member.updated_at) : null;
  const daysSinceUpdate = updated ? (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24) : 999;

  if (streak >= 1) {
    return { status: 'active', label: '🟢 فعال و پیگیر', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', reason: `${streak} روز زنجیره فعال` };
  }
  if (daysSinceUpdate > 7) {
    return { status: 'risk', label: '🔴 در خطر توقف', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', reason: 'بیش از ۷ روز بدون فعالیت' };
  }
  if (stage === 1 && daysSinceUpdate > 3) {
    return { status: 'attention', label: '🟡 کندی در ۷۲ ساعت اول', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', reason: 'بیش از ۳ روز در مرحله ۱' };
  }
  if (streak === 0 && daysSinceUpdate > 2) {
    return { status: 'attention', label: '🟡 استریک قطع‌شده', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', reason: 'استریک صفر و نیاز به تماس' };
  }
  return { status: 'active', label: '🟢 در حال پیگیری', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', reason: 'فعالیت اخیر ثبت شده' };
}

/**
 * بررسی اینکه آیا در بازه زمانی گزارش شبانه (۲۰:۰۰ تا ۰۲:۰۰ بامداد) هستیم
 */
export function isEveningReportTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= 20 || hour < 2;
}

/**
 * خروجی CSV با UTF-8 BOM برای باز شدن صحیح در مایکروسافت اکسل فارسی
 */
export function contactsToCsv(contacts = []) {
  const headers = ['نام', 'شماره تماس', 'منبع', 'وضعیت', 'تاریخ پیگیری', 'یادداشت'];
  const formatCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = (contacts || []).map(c => [
    c.name || '',
    c.phone || '',
    c.source || '',
    c.status || '',
    c.followupDate || '',
    c.notes || ''
  ]);
  const content = [headers.map(formatCell).join(','), ...rows.map(r => r.map(formatCell).join(','))].join('\r\n');
  return '\uFEFF' + content;
}

/**
 * خروجی CSV اعضای تیم برای استفاده لیدرها
 */
export function teamToCsv(team = []) {
  const headers = ['نام و نام خانوادگی', 'ایمیل', 'مرحله فعلی', 'استریک ۷ روزه', 'تعداد مخاطبان CRM', 'وضعیت سلامت', 'دلیل وضعیت', 'آخرین فعالیت'];
  const formatCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = (team || []).map(m => {
    const health = calculateMemberHealth(m);
    return [
      m.full_name || 'عضو بدون نام',
      m.email || '',
      `مرحله ${m.current_stage || 1}`,
      `${m.s2_streak || 0} روز`,
      `${m.crm_count || 0} نفر`,
      health.label,
      health.reason,
      m.updated_at ? new Date(m.updated_at).toLocaleString('fa-IR') : 'نامشخص'
    ];
  });
  const content = [headers.map(formatCell).join(','), ...rows.map(r => r.map(formatCell).join(','))].join('\r\n');
  return '\uFEFF' + content;
}

/**
 * خروجی CSV لیست ۳۰ نفره فرم رسمی اورست (مطابق فرم چاپی)
 */
export function initialList30ToCsv(list = []) {
  const headers = ['ردیف', 'نام و نام خانوادگی', 'نسبت شخص با ما', 'سطح ارتباط', 'نوع شخصیت شخص', 'همکاری در زمینه کار یا معرفی محصول', 'زمان اولین ارتباط‌گیری', 'تلفن تماس'];
  const formatCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = (list || []).map((item, idx) => [
    idx + 1,
    item.name || '',
    item.relation || '',
    item.level || '',
    item.personality || '',
    item.category || '',
    item.firstContactDate || '',
    item.phone || ''
  ]);
  const content = [headers.map(formatCell).join(','), ...rows.map(r => r.map(formatCell).join(','))].join('\r\n');
  return '\uFEFF' + content;
}


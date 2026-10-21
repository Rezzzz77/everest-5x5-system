/**
 * Agent Coach — دستیار هوشمند تیم اورست
 * ---------------------------------------
 * خواندن appState و پیشنهاد:
 *  1. اقدام بعدی مشخص (Next Best Action)
 *  2. پیام انگیزشی کوتاه (به سبک تیم اورست)
 *
 * بدون درخواست شبکه؛ کاملاً لوکال و فوری.
 */

import { getHighestUnlockedStage } from '../app.js';

/* ---------------- متن‌های انگیزشی مرحله‌ای ---------------- */

const MOTIVATION = {
  1: [
    'شروع سخت‌ترین بخش است — توش 벌써 آغاز کردی. 🚀',
    '۷۲ ساعت اول، بنای کل مسیر است. قدم‌بهقدم پیش برو.',
    'هر کدام از این ۵ قدم، یکisersه‌ی استقلال توست.',
    'راهبرانت منتظرند تا اولین نتیجه‌ات را ببینند. جلو برو!',
    'کامل بودن شرط نیست؛ شروع کردن شرطه.'
  ],
  2: [
    'تداوم > انگیزه. امروز هم حاضر شدی، همین برنده‌ست. 💪',
    'زنجیره ۷ روزه نمی‌شکند؛ تو می‌سازی. هر روز یک حلقه.',
    'نظم، استعداد را می‌بندد. ۵ کار ساده، هر روز.',
    'گزارش شبانه = آینه‌ی رشد. امروز چه یاد گرفتی؟',
    'حرکت مداوم، قدرت مُدرک به قدرت واقعی می‌نماید.'
  ],
  3: [
    'سازنده شدن یعنی هر روز بهتر از دیروز باشی، نه کامل. 🏗️',
    'لیست ۱۰۰ نفره = دارایی واقعی تو. هر نام، یک فرصت.',
    'دانش محصول + آدم‌یابی + دعوت + پیگیری = ماشین رشد.',
    'مرحله ۳، تفکیک فروشنده از سازنده است. تو سازنده‌ای.',
    'معیارهای عبور، نقشه‌ی موفقیت ۳۰ روزه‌اتند.'
  ],
  4: [
    'تکثیر یعنی دیگران بدون تو هم رشد کنند. 🌱',
    'یاد بگیر → انجام بده → نشان بده → همراهی کن → واگذار کن.',
    'راهبر واقعی، راهبر می‌سازد. کدام عضو امروز به گام ۵ رسید؟',
    'ماتریس تکثیر، تصویر’organisation توست. پرش کن.',
    '시ستم که بدون تو کار می‌کند، میراث جاویدان توست.'
  ],
  5: [
    'راهبری یعنی آدم بساز، سیستم بساز، میراث بساز. 👑',
    'داشبورد عددی، کلمات را به واقعیت می‌بدیل می‌کند.',
    'جلسات هدفمند، فرهنگ تیم را می‌سازند. امروز کدام هدف؟',
    '۵ استاندارد روزانه: فرهنگ، راهبر، جلسه، یادگیری، عدد.',
    'سازمانی که تو نسازی، هیچکس نخواهد ساخت. ادامه بده.'
  ]
};

/* ---------------- تشخیص اقدام بعدی ---------------- */

/**
 * بر اساس appState، اقدام مشخص بعدی را برمی‌گرداند
 * @returns { { title: string, detail: string, stage: number, actionId?: string } | null }
 */
export function getNextAction(appState) {
  if (!appState) return null;

  const stage = getHighestUnlockedStage(appState);

  // --- مرحله ۱: بررسی ۵ قدم ---
  if (stage === 1 && appState.s1Steps) {
    const pending = appState.s1Steps.find((s, idx) => !s.done);
    if (pending) {
      const idx = appState.s1Steps.indexOf(pending);
      const labels = [
        'هدف‌ت را بنویس و بلند بخوان',
        'داستان محصول و فرصت را حفظ کن',
        'لیست ۳۰ نفره را کامل کن',
        'حداقل ۲۰ دعوت کوتاه و طبیعی انجام بده',
        'اولین ارائه/فروش را با راهبر تجربه کن'
      ];
      return {
        title: `مرحله ۱ — قدم ${idx + 1}`,
        detail: labels[idx] || pending.title,
        stage: 1,
        actionId: `s1-${idx}`
      };
    }
  }

  // --- مرحله ۲: زنجیره و شمارنده‌ها ---
  if (stage === 2) {
    // اولویت: گزارش شبانه اگر هنوز ثبت نشده (بر اساس streak)
    if ((appState.s2Streak || 0) < 7) {
      return {
        title: 'مرحله ۲ — گزارش شبانه',
        detail: `روز ${(appState.s2Streak || 0) + 1} از ۷ — نتیجه امروز را ثبت کن`,
        stage: 2,
        actionId: 's2-report'
      };
    }
    // شمارنده‌های روزانه که کامل نشده‌اند
    if (appState.s2Counters) {
      const incomplete = appState.s2Counters.find(c => c.count < c.target);
      if (incomplete) {
        return {
          title: 'مرحله ۲ — شمارنده روزانه',
          detail: `${incomplete.title}: ${incomplete.count}/${incomplete.target}`,
          stage: 2,
          actionId: 's2-counter'
        };
      }
    }
  }

  // --- مرحله ۳: ۵ مهارت + CRM + معیار عبور ---
  if (stage === 3) {
    // مهارت‌های روزانه
    if (appState.s3Counters) {
      const incomplete = appState.s3Counters.find(c => c.count < c.target);
      if (incomplete) {
        return {
          title: 'مرحله ۳ — مهارت روزانه',
          detail: `${incomplete.title}: ${incomplete.count}/${incomplete.target}`,
          stage: 3,
          actionId: 's3-counter'
        };
      }
    }
    // CRM به ۱۰۰ نفر
    const crmCount = (appState.crm || []).length;
    if (crmCount < 100) {
      return {
        title: 'مرحله ۳ — لیست مخاطبین',
        detail: `${crmCount} / ۱۰۰ نفر — یک مخاطب جدید اضافه کن`,
        stage: 3,
        actionId: 's3-crm'
      };
    }
    // معیارهای عبور
    if (appState.s3Pass) {
      const pending = appState.s3Pass.find(p => !p.done);
      if (pending) {
        return {
          title: 'مرحله ۳ — معیار عبور',
          detail: pending.text,
          stage: 3,
          actionId: 's3-pass'
        };
      }
    }
  }

  // --- مرحله ۴: اعضای تیم و معیار عبور ---
  if (stage === 4) {
    // اگر عضوتیم داری که در گام ۱-۴ مانده
    if (appState.dupTeam && appState.dupTeam.length > 0) {
      const stuck = appState.dupTeam.find(m => m.step < 5);
      if (stuck) {
        const stepNames = ['یاد بگیر', 'انجام بده', 'نشان بده', 'همراهی کن', 'واگذار کن'];
        return {
          title: 'مرحله ۴ — همراهی عضو تیم',
          detail: `${stuck.name} در گام ${stuck.step} (${stepNames[stuck.step - 1]}) مانده — همراهیش کن`,
          stage: 4,
          actionId: 's4-member'
        };
      }
    } else {
      return {
        title: 'مرحله ۴ — عضو تیم جدید',
        detail: 'هنوز عضوی در ماتریس تکثیر نداری — اولین نفر را اضافه کن',
        stage: 4,
        actionId: 's4-add'
      };
    }
    // معیارهای عبور
    if (appState.s4Pass) {
      const pending = appState.s4Pass.find(p => !p.done);
      if (pending) {
        return {
          title: 'مرحله ۴ — معیار عبور',
          detail: pending.text,
          stage: 4,
          actionId: 's4-pass'
        };
      }
    }
  }

  // --- مرحله ۵: استانداردها، جلسات، KPI ---
  if (stage === 5) {
    // استانداردهای راهبر
    if (appState.s5Standards) {
      const pending = appState.s5Standards.find(s => !s.done);
      if (pending) {
        return {
          title: 'مرحله ۵ — استاندارد راهبر',
          detail: pending.text,
          stage: 5,
          actionId: 's5-standard'
        };
      }
    }
    // پیش فرض: مدیریت با عدد
    return {
      title: 'مرحله ۵ — داشبورد سازمان',
      detail: 'KPIها را به‌روز کن: فروش، ورودی، اعضای فعال، لیدرها، عمق',
      stage: 5,
      actionId: 's5-kpi'
    };
  }

  return null;
}

/**
 * پیام انگیزشی تصادفی متناسب با مرحله فعلی
 */
export function getMotivation(appState) {
  if (!appState) return MOTIVATION[1][0];
  const stage = getHighestUnlockedStage(appState);
  const list = MOTIVATION[stage] || MOTIVATION[1];
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * محاسبه پیشرفت کلی (۰-۱۰۰) برای نمایش در کارت Coach
 */
export function getOverallProgress(appState) {
  if (!appState) return 0;

  const stage = getHighestUnlockedStage(appState);
  let done = 0, total = 0;

  // مرحله ۱
  if (appState.s1Steps) {
    total += 5;
    done += appState.s1Steps.filter(s => s.done).length;
  }

  // مرحله ۲
  if (stage >= 2) {
    total += 7; // streak
    done += Math.min(appState.s2Streak || 0, 7);
    if (appState.s2Counters) {
      total += appState.s2Counters.length;
      done += appState.s2Counters.filter(c => c.count >= c.target).length;
    }
  }

  // مرحله ۳
  if (stage >= 3) {
    if (appState.s3Counters) {
      total += appState.s3Counters.length;
      done += appState.s3Counters.filter(c => c.count >= c.target).length;
    }
    total += 1; // CRM 100
    done += Math.min((appState.crm || []).length / 100, 1);
    if (appState.s3Pass) {
      total += appState.s3Pass.length;
      done += appState.s3Pass.filter(p => p.done).length;
    }
  }

  // مرحله ۴
  if (stage >= 4) {
    if (appState.dupTeam) {
      total += appState.dupTeam.length * 5;
      done += appState.dupTeam.reduce((sum, m) => sum + Math.min(m.step, 5), 0);
    }
    if (appState.s4Pass) {
      total += appState.s4Pass.length;
      done += appState.s4Pass.filter(p => p.done).length;
    }
  }

  // مرحله ۵
  if (stage >= 5) {
    if (appState.s5Standards) {
      total += appState.s5Standards.length;
      done += appState.s5Standards.filter(s => s.done).length;
    }
    total += 1; // meetings
    done += Math.min((appState.meetings || []).length / 5, 1); // approx
    total += 5; // KPIs
    done += 5; // simplified
  }

  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/**
 * उत्पन्न کارت کامل Coach
 */
export function generateCoachCard(appState) {
  const next = getNextAction(appState);
  const motivation = getMotivation(appState);
  const progress = getOverallProgress(appState);
  const stage = getHighestUnlockedStage(appState);

  return {
    stage,
    progress,
    nextAction: next ? `${next.title}: ${next.detail}` : 'همه مراحل کامل — بالاتر برو!',
    motivation,
    timestamp: Date.now()
  };
}

/* ---------------- رنگ‌بندی مرحله برای UI ---------------- */

export const STAGE_THEME = {
  1: { primary: 'blue', bg: 'bg-blue-950/60', border: 'border-blue-600/40', text: 'text-blue-300', badge: 'bg-blue-600' },
  2: { primary: 'emerald', bg: 'bg-emerald-950/60', border: 'border-emerald-600/40', text: 'text-emerald-300', badge: 'bg-emerald-600' },
  3: { primary: 'orange', bg: 'bg-orange-950/60', border: 'border-orange-600/40', text: 'text-orange-300', badge: 'bg-orange-600' },
  4: { primary: 'purple', bg: 'bg-purple-950/60', border: 'border-purple-600/40', text: 'text-purple-300', badge: 'bg-purple-600' },
  5: { primary: 'amber', bg: 'bg-amber-950/60', border: 'border-amber-500/40', text: 'text-amber-300', badge: 'bg-amber-500' }
};

export function getStageTheme(stage) {
  return STAGE_THEME[stage] || STAGE_THEME[1];
}
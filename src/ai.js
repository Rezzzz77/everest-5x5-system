/**
 * ماژول مربی هوش مصنوعی (DeepSeek AI Integration)
 * سیستم ۵×۵ تیم اورست | نیوشانیک
 */

import { getDeepSeekConfig, isDeepSeekConfigured } from './config.js';

export const EVEREST_SYSTEM_PROMPT = `تو «مربی ارشد سیستم ۵×۵ تیم اورست» و راهنمای تخصصی فروش و رشد تیم در بستر نیوشانیک هستی.
اصول اصلی راهنمایی تو:
۱. زبان و لحن: فارسی روان، گرم، انگیزاننده، عمل‌گرا و متناسب با فرهنگ کارآفرینی در ایران.
۲. متدولوژی: بر اساس ۵ مرحله سیستم رشد اورست:
   - مرحله ۱ (شروع - ۷۲ ساعت اول): کشف چرایی، داستان شخصی، نوشتن لیست اولیه، دعوت و استارت سریع.
   - مرحله ۲ (حرکت - ۷ روزه): انضباط فردی، ۵ عادت روزانه، زنجیره استریک و گزارش شبانه.
   - مرحله ۳ (ساخت - ۳۰ روزه): لیست ۱۰۰+ CRM، مهارت‌های معرفی محصول و پیگیری اصولی.
   - مرحله ۴ (تکثیر - ۹۰ روزه): آموزش چرخه ۵ گامی (یاد بگیر، انجام بده، نشان بده، همراهی کن، واگذار کن).
   - مرحله ۵ (راهبری مستمر): مدیریت عددی سازمان با KPI، استانداردهای راهبر و فرهنگ‌سازی.
۳. محصولات نیوشانیک: دمنوش‌های سلامت (کاهش وزن، آرامش، پاکسازی کبد، گوارش، چای‌های تخصصی).
۴. پاسخ‌هایت همیشه ساختاریافته، کوتاه، دارای ایموجی مناسب و شامل اقدامات عملیِ قابل انجام در ۲۴ ساعت آینده باشند.`;

/**
 * ارسال پیام به DeepSeek API
 */
export async function callDeepSeekChat({ messages = [], rawConfig = null } = {}) {
  const cfg = rawConfig || getDeepSeekConfig();
  const apiKey = String(cfg?.apiKey || '').trim();

  if (!apiKey) {
    return {
      ok: false,
      reason: 'no-key',
      message: 'کلید DeepSeek API تنظیم نشده است. لطفاً ابتدا در تنظیمات کلید خود را وارد کنید.'
    };
  }

  const endpoint = cfg.endpoint || 'https://api.deepseek.com/chat/completions';
  const model = cfg.model || 'deepseek-chat';

  const fullMessages = [
    { role: 'system', content: EVEREST_SYSTEM_PROMPT },
    ...messages
  ];

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (res.status === 401) {
      return { ok: false, reason: 'auth', message: 'کلید API دیپ‌سیک نامعتبر یا منقضی شده است (خطای ۴۰۱).' };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'quota', message: 'اعتبار حساب دیپ‌سیک تمام شده یا محدودیت سقف درخواست رخ داده است (خطای ۴۲۹).' };
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, reason: 'http', message: `خطا در ارتباط با دیپ‌سیک (${res.status}): ${errText.slice(0, 150)}` };
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return { ok: false, reason: 'empty', message: 'پاسخی از مدل دریافت نشد.' };
    }

    return { ok: true, reply };
  } catch (err) {
    return { ok: false, reason: 'network', message: `خطای اتصال به اینترنت یا سرور دیپ‌سیک: ${String(err?.message || err)}` };
  }
}

/**
 * تست سریع اتصال کلید DeepSeek
 */
export async function testDeepSeekConnection(apiKey) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) return { ok: false, message: 'لطفاً کلید API را وارد کنید.' };

  const testConfig = {
    apiKey: cleanKey,
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions'
  };

  const res = await callDeepSeekChat({
    messages: [{ role: 'user', content: 'سلام، لطفاً یک جمله انگیزاننده کوتاه برای تیم فروش بگو.' }],
    rawConfig: testConfig
  });

  return res;
}

/**
 * قالب آماده: سناریوی دعوت مخاطب
 */
export function buildInvitePrompt({ contactName = 'مخاطب', relation = 'دوست', interest = 'درآمد دوم' } = {}) {
  return `لطفاً برای دعوت از «${contactName}» که «${relation}» من است و فکر می‌کنم به موضوع «${interest}» علاقه‌مند است، یک متن دعوت کوتاه و حرفه‌ای بنویس:
۱. نسخه تماس تلفنی کوتاه (حداکثر ۲ دقیقه)
۲. نسخه پیام متنی / واتساپ
نکته: بدون پیش‌داوری، بدون اغراق و با احترام به رابطه دوستی نوشته شود.`;
}

/**
 * قالب آماده: پاسخ به ایراد و بهانه مشتری
 */
export function buildObjectionPrompt(objectionText) {
  return `مشتری یا کاندیدای عضویت در تیم این بهانه یا اعتراض را مطرح کرده است:
«${objectionText}»

لطفاً به عنوان مربی اورست، ۳ پاسخ و راهکار حرفه‌ای، مؤدبانه و نتیجه‌بخش برای پاسخ به این موضوع پیشنهاد بده.`;
}

/**
 * قالب آماده: تحلیل وضعیت مرحله فعلی کاربر
 */
export function buildCoachReviewPrompt({ stage = 1, streak = 0, crmCount = 0, goal = '' } = {}) {
  return `وضعیت فعلی من در سیستم ۵×۵ اورست:
- مرحله فعلی: مرحله ${stage}
- زنجیره مداومت ۷ روزه (استریک): ${streak} روز
- تعداد مخاطبان در CRM من: ${crmCount} نفر
- هدف اصلی من: ${goal || 'رشد کسب‌وکار مستقل و آزادی مالی'}

لطفاً وضعیت من را تحلیل کن و دقیقاً ۳ اقدام کلیدی و فوری برای ۲۴ ساعت آینده به من پیشنهاد بده.`;
}

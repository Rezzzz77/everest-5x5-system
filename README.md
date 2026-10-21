# سیستم ۵×۵ تیم اورست | نیوشانیک

اپلیکیشن PWA مدیریت رشد فروش و تیم بر پایه سیستم ۵ مرحله‌ای اورست.

`Offline-first` · `PWA` · `Supabase` · `فارسی / RTL`

---

## 📖 ساختار سیستم

| مرحله | عنوان | دوره | معیار عبور |
|-------|-------|------|-------------|
| ۱ | شروع | ۷۲ ساعت | ۵ اقدام اولیه تکمیل شود |
| ۲ | حرکت | ۷ روز | ۷ روز اجرای زنجیره‌ای |
| ۳ | ساخت | ۳۰ روز | ۱۰۰+ مخاطب + ۵ معیار |
| ۴ | تکثیر | ۹۰ روز | ساخت اعضای مستقل |
| ۵ | راهبری | مستمر | داشبورد عددی سازمان |

---

## 🚀 راه‌اندازی سریع (لوکال)

```bash
git clone https://github.com/Rezzzz77/everest-5x5-system.git
cd everest-5x5-system
python3 -m http.server 8080
# سپس http://localhost:8080
```

> نیاز به سرور محلی دارد (چون `app.js` از ES Modules استفاده می‌کند و `file://` کار نمی‌کند).

---

## ☁️ اتصال به Supabase

### ۱. ساخت جدول
در داشبورد Supabase → **SQL Editor** → محتوای [`supabase/schema.sql`](supabase/schema.sql) را اجرا کن.

### ۲. گرفتن کلیدها
**Project Settings → API**:
- `Project URL`
- `anon public key`

### ۳. قرار دادن در کد
فایل `src/config.js`:

```js
export const SUPABASE_CONFIG = {
  url: 'https://xxxxx.supabase.co',
  key: 'eyJhbGciOi...'
};
```

بدون این مقادیر، اپ کاملاً آفلاین با `localStorage` کار می‌کند.

---

## 📁 ساختار پروژه

```
everest-5x5-system/
├── index.html              # رابط کاربری (RTL)
├── app.js                  # منطق اپلیکیشن (ES Module)
├── sw.js                   # Service Worker (PWA + آفلاین)
├── manifest.json           # تنظیمات PWA
├── src/
│   ├── config.js           # کلیدهای Supabase / n8n
│   ├── db.js               # لایه داده (local + cloud)
│   └── defaults.js         # داده‌های پیش‌فرض
├── supabase/
│   └── schema.sql          # جدول user_state + RLS
└── docs/
    └── SECURITY.md         # نکات امنیتی و مسیر ارتقا
```

---

## 📱 ویژگی‌ها

- ✅ تایپ صوتی فارسی (Web Speech API)
- ✅ CRM داخلی با لینک تماس/واتساپ/پیامک
- ✅ ماتریس تکثیر اعضای تیم
- ✅ گزارش شبانه و زنجیره ۷ روزه
- ✅ داشبورد مدیریتی (KPI)
- ✅ لینک مستقیم تماس برای هر مخاطب در CRM
- ✅ حالت آفلاین کامل
- ✅ همگام‌سازی ابری اختیاری

---

## 🗺 نقشه راه

| # | مرحله | وضعیت |
|---|-------|-------|
| ۱ | ساختار پایه + UI | ✅ |
| ۲ | لایه داده و Supabase | ✅ |
| ۳ | PWA + Service Worker | ✅ |
| ۴ | ایجنت Coach (پیشنهاددهنده) | ⏳ |
| ۵ | امنیت: Supabase Auth + RLS سخت‌گیرانه | ⏳ |
| ۶ | بکاپ خودکار (n8n) | ⏳ |

---

## 📄 لایسنس

MIT — استفاده داخلی تیم اورست

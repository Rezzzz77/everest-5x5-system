# سیستم ۵×۵ تیم اورست | نیوشانیک

اپلیکیشن PWA مدیریت رشد فروش و تیم بر پایه سیستم ۵ مرحله‌ای اورست.

`Offline-first` · `PWA` · `Supabase` · `فارسی / RTL`

**دمو زنده:** https://rezzzz77.github.io/everest-5x5-system/  
**گراف دانش پروژه:** https://rezzzz77.github.io/everest-5x5-system/docs/graph.html

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
├── tools/
│   ├── build_graph.py      # تولید گراف دانش از سورس
│   ├── make_icons.py       # تولید آیکون‌های PWA
│   └── check_contracts.py  # تست قرارداد HTML ↔ JS
├── .github/workflows/
│   └── check.yml           # CI: سینتکس، قرارداد، همگامی گراف
└── docs/
    ├── MEMORY.md           # 🧠 حافظه پروژه — از اینجا ادامه بده
    ├── graph.html          # نمایش تعاملی گراف
    ├── graph.json          # داده گراف (تولیدشده)
    └── SECURITY.md         # ریسک‌ها و مسیر ارتقا
```

### 🧠 حافظه پروژه

هر نشست جدید (انسان یا ایجنت) باید ابتدا [`docs/MEMORY.md`](docs/MEMORY.md) را بخواند:
تصمیم‌های ثبت‌شده، باگ‌های حل‌شده، وضعیت فعلی و قدم بعدی آنجاست.

### ✅ بررسی سلامت قبل از هر کامیت

```bash
python3 tools/check_contracts.py   # هر onclick باید به window متصل باشد
python3 tools/build_graph.py       # گراف باید با سورس همگام باشد
```

هر دو در GitHub Actions (`.github/workflows/check.yml`) هم خودکار اجرا می‌شوند.

### 🕸 گراف دانش

```bash
python3 tools/build_graph.py   # بازتولید docs/graph.json
```

سپس `docs/graph.html` را باز کن (یا نسخه آنلاین). گراف فایل‌ها، ماژول‌ها،
مراحل، ویژگی‌ها و جدول‌ها را با قابلیت جستجو، فیلتر و کشیدن گره نشان می‌دهد.

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
| ۴ | گراف دانش + حافظه پروژه | ✅ |
| ۴.۱ | CI + تست قرارداد HTML ↔ JS | ✅ |
| ۵ | اتصال واقعی Supabase (کلیدها) | ⏳ |
| ۶ | ایجنت Coach (پیشنهاددهنده) | ⏳ |
| ۷ | امنیت: Supabase Auth + RLS سخت‌گیرانه | ⏳ |
| ۸ | بکاپ خودکار (n8n) | ⏳ |

---

## 📄 لایسنس

MIT — استفاده داخلی تیم اورست

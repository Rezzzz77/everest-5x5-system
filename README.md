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

> پروژه فعلی: `https://cupcijeqqiyhqaifjzbl.supabase.co` (کلید در `src/config.js` ثبت شده).
> تنها قدم باقی‌مانده: اجرای `supabase/schema.sql` در SQL Editor.

### ۰. ورود امن (Supabase Auth — OTP ایمیل)
اپ با **کد یک‌بارمصرف ایمیل** وارد می‌شود؛ رمزی ذخیره نمی‌شود.
اولین کار پس از اجرای SQL: در Supabase → **Authentication → Providers → Email**
گزینه *Enable email OTP / Magic Link* فعال باشد. برای تیم واقعی یک SMTP اختصاصی وصل کن
(SMTP پیش‌فرض رایگان محدودیت ارسال دارد).

### ۱. ساخت جدول‌ها
در داشبورد Supabase → **SQL Editor** → محتوای [`supabase/schema.sql`](supabase/schema.sql) را اجرا کن.
اسکریپت idempotent است (دوبار اجرا بی‌خطر).

سپس با [`supabase/verify.sql`](supabase/verify.sql) تأیید کن:
`rowsecurity=true` و هیچ دسترسی برای `anon`.

### ۲. گرفتن کلیدها
**Project Settings → API**:
- `Project URL`
- `anon public key`

### ۳. وارد کردن در اپ (بدون دست‌زدن به کد)
در اپ دکمه **☁️** بالای صفحه را بزن و دو مقدار را وارد کن:

1. **تست اتصال** — اگر جدول نبود، پیام دقیق می‌دهد.
2. **ذخیره و همگام‌سازی** — کلیدها در `localStorage` همان دستگاه می‌مانند.

> جایگزین: می‌توانی مقادیر را در `src/config.js` هم بگذاری (برای انتشار ثابت).
> بدون این مقادیر، اپ کاملاً آفلاین با `localStorage` کار می‌کند و هیچ خطایی نمی‌دهد.

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
│   ├── auth.js             # ورود OTP ایمیل (Supabase Auth)
│   ├── db.js               # لایه داده (local + cloud)
│   └── defaults.js         # داده‌های پیش‌فرض
├── supabase/
│   ├── schema.sql          # user_state + profiles + RLS سخت‌گیرانه
│   └── verify.sql          # بررسی RLS / grants / triggers
├── tools/
│   ├── build_graph.py      # تولید گراف دانش از سورس
│   ├── make_icons.py       # تولید آیکون‌های PWA
│   └── check_contracts.py  # تست قرارداد HTML ↔ JS
├── tests/
│   └── core.test.mjs       # تست واحد (node --test)
├── package.json            # اسکریپت‌های test / check / graph / serve
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
npm test                          # تست‌های واحد (config / db / defaults)
python3 tools/check_contracts.py  # هر onclick باید به window متصل باشد
python3 tools/build_graph.py      # گراف باید با سورس همگام باشد
```

همه در GitHub Actions (`.github/workflows/check.yml`) خودکار اجرا می‌شوند.

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
- ✅ ورود بدون رمز با کد ایمیل + حالت «بدون حساب» برای تست
- ✅ حالت آفلاین کامل
- ✅ همگام‌سازی ابری اختیاری + تنظیم کلید از داخل اپ (با تست اتصال)
- ✅ تست واحد و CI

---

## 🗺 نقشه راه

| # | مرحله | وضعیت |
|---|-------|-------|
| ۱ | ساختار پایه + UI | ✅ |
| ۲ | لایه داده و Supabase | ✅ |
| ۳ | PWA + Service Worker | ✅ |
| ۴ | گراف دانش + حافظه پروژه | ✅ |
| ۴.۱ | CI + تست قرارداد HTML ↔ JS | ✅ |
| ۵ | ابزار اتصال Supabase درون‌برنامه | ✅ |
| ۵.۱ | امنیت: Auth + RLS سخت‌گیرانه | ✅ کد آماده — نیاز به اجرای SQL |
| ۵.۲ | اجرای `schema.sql` در داشبورد | ⏳ کار صاحب پروژه |
| ۶ | ایجنت Coach (پیشنهاددهنده) | ⏳ |
| ۸ | بکاپ خودکار (n8n) | ⏳ |

---

## 📄 لایسنس

MIT — استفاده داخلی تیم اورست

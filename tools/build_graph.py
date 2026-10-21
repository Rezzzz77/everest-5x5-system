#!/usr/bin/env python3
"""
سازنده گراف دانش پروژه (Graphify)
----------------------------------
پروژه را اسکن می‌کند و یک گراف JSON از فایل‌ها، ماژول‌ها،
مراحل سیستم، جدول‌های داده و ویژگی‌ها می‌سازد.

اجرا:
    python3 tools/build_graph.py
خروجی:
    docs/graph.json
"""

import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "graph.json")

NODES = {}


def node(nid, label, ntype, **meta):
    NODES[nid] = {"id": nid, "label": label, "type": ntype, **meta}
    return nid


def rel(*parts):
    return os.path.relpath(os.path.join(ROOT, *parts), ROOT)


# ---------------------------------------------------------------- فایل‌ها
FILES = [
    ("index.html", "entry", "رابط کاربری اصلی (RTL + Tailwind)"),
    ("app.js", "module", "منطق اپلیکیشن (ES Module)"),
    ("sw.js", "module", "Service Worker — کش آفلاین"),
    ("manifest.json", "config", "تنظیمات PWA"),
    ("src/db.js", "module", "لایه داده: محلی + ابری"),
    ("src/config.js", "config", "کلیدهای Supabase / n8n"),
    ("src/defaults.js", "module", "داده‌های پیش‌فرض و دمو"),
    ("supabase/schema.sql", "sql", "جدول user_state + RLS + تریگر"),
    ("docs/SECURITY.md", "doc", "ریسک‌ها و مسیر ارتقای امنیت"),
    ("README.md", "doc", "مستندات پروژه"),
    ("docs/MEMORY.md", "doc", "حافظه پایدار پروژه — تصمیم‌ها، باگ‌ها، وضعیت"),
    ("docs/graph.html", "entry", "نمایش تعاملی گراف دانش"),
    ("tools/build_graph.py", "module", "تولیدکننده گراف از منبع"),
]

for path, ntype, desc in FILES:
    node(f"file:{path}", path, ntype, desc=desc)

# ---------------------------------------------------------------- مراحل
STAGES = [
    ("s1", "مرحله ۱ — شروع", "۷۲ ساعت"),
    ("s2", "مرحله ۲ — حرکت", "۷ روز"),
    ("s3", "مرحله ۳ — ساخت", "۳۰ روز"),
    ("s4", "مرحله ۴ — تکثیر", "۹۰ روز"),
    ("s5", "مرحله ۵ — راهبری", "مستمر"),
]

for sid, label, period in STAGES:
    node(f"stage:{sid}", label, "stage", period=period)
    node(f"file:index.html#stage-{sid[1]}", f"#stage-{sid[1]}", "dom")

# نگاشت رندر: app.js بخش‌ها را پر می‌کند
RENDER_TARGETS = {
    "s1": ["s1-steps-container", "s1-progress-label", "s1-progress-bar"],
    "s2": ["s2-streak-badge", "s2-days-bar", "s2-counters-list", "s2-note"],
    "s3": ["s3-counters-list", "crm-contacts-container", "crm-total-badge", "s3-pass-criteria"],
    "s4": ["duplication-members-container", "s4-pass-criteria"],
    "s5": ["meetings-list", "s5-standards-list"],
}

# ---------------------------------------------------------------- ویژگی‌ها
FEATURES = [
    ("f:auth", "ثبت‌نام / ورود", "نام، کد ملی، حامی"),
    ("f:timer", "تایمر ۷۲ ساعت", "شمارش معکوس واقعی"),
    ("f:crm", "CRM مخاطبین", "تماس / واتساپ / پیامک"),
    ("f:streak", "زنجیره ۷ روزه", "گزارش شبانه"),
    ("f:dup", "ماتریس تکثیر", "۵ گام استقلال عضو"),
    ("f:kpi", "داشبورد KPI", "مدیریت با عدد"),
    ("f:voice", "تایپ صوتی فارسی", "Web Speech API"),
    ("f:catalog", "کاتالوگ محصول", "فلش‌کارت نیوشانیک"),
    ("f:offline", "حالت آفلاین", "Service Worker"),
    ("f:sync", "همگام‌سازی ابری", "Supabase (اختیاری)"),
]
for fid, label, desc in FEATURES:
    node(fid, label, "feature", desc=desc)

# ---------------------------------------------------------------- جدول‌ها
node("table:user_state", "user_state", "table", desc="user_id / state_data / updated_at")
node("table:rls", "RLS policy", "table", desc="فعلاً anon — needs hardening")

EDGES = []
seen = set()


def edge(src, dst, etype="uses"):
    key = (src, dst, etype)
    if key in seen or src not in NODES or dst not in NODES:
        return
    seen.add(key)
    EDGES.append({"source": src, "target": dst, "type": etype})


# وابستگی‌های ماژول‌ها
edge("file:index.html", "file:app.js", "loads")
edge("file:index.html", "file:manifest.json", "declares")
edge("file:index.html", "file:sw.js", "registers")
edge("file:app.js", "file:src/db.js", "imports")
edge("file:app.js", "file:src/db.js", "imports")
edge("file:src/db.js", "file:src/config.js", "imports")
edge("file:src/db.js", "file:src/defaults.js", "imports")
edge("file:src/db.js", "table:user_state", "writes")
edge("file:supabase/schema.sql", "table:user_state", "defines")
edge("file:supabase/schema.sql", "table:rls", "defines")
edge("file:docs/SECURITY.md", "table:rls", "documents")
edge("file:README.md", "file:index.html", "documents")
edge("file:README.md", "file:docs/MEMORY.md", "references")
edge("file:docs/graph.html", "file:docs/MEMORY.md", "documents")
edge("file:tools/build_graph.py", "file:docs/graph.html", "produces")

# هر مرحله: یک بخش HTML + یک رندرکننده در app.js
for sid, _, _ in STAGES:
    edge("file:index.html", f"file:index.html#stage-{sid[1]}", "contains")
    edge(f"file:index.html#stage-{sid[1]}", f"stage:{sid}", "represents", )
    edge(f"stage:{sid}", f"file:app.js", "rendered_by")
    for target in RENDER_TARGETS.get(sid, []):
        node(f"dom:{target}", f"#{target}", "dom")
        edge("file:app.js", f"dom:{target}", "writes")
        edge(f"stage:{sid}", f"dom:{target}", "contains")

# ویژگی‌ها به کد
for fid, _, _ in FEATURES:
    edge(fid, "file:app.js", "implemented_in")

edge("f:auth", "stage:s1")
edge("f:streak", "stage:s2")
edge("f:crm", "stage:s3")
edge("f:dup", "stage:s4")
edge("f:kpi", "stage:s5")
edge("f:offline", "file:sw.js")
edge("f:sync", "file:src/db.js")
edge("f:sync", "table:user_state")
edge("f:catalog", "stage:s3")
edge("f:timer", "stage:s1")
edge("f:voice", "stage:s2")
edge("f:voice", "stage:s5")

# ---------------------------------------------------------------- خروجی
graph = {
    "meta": {
        "project": "everest-5x5-system",
        "title": "سیستم ۵×۵ تیم اورست",
        "schema": 1,
        "generator": "tools/build_graph.py",
        "counts": {
            "nodes": len(NODES),
            "edges": len(EDGES),
        },
    },
    "nodes": sorted(NODES.values(), key=lambda n: (n["type"], n["id"])),
    "edges": EDGES,
}

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    json.dump(graph, fh, ensure_ascii=False, indent=2)

print(f"✔ {os.path.relpath(OUT, ROOT)}")
print(f"  گره: {len(NODES)}  |  یال: {len(EDGES)}")

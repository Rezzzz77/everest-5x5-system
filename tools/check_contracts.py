#!/usr/bin/env python3
"""
تست قرارداد بین HTML و JS
--------------------------
چون app.js یک ES Module است و توابعش به‌صورت دستی روی window قرار می‌گیرند،
هر تابعی که در HTML با onclick/onchange صدا زده می‌شود باید در app.js
به window متصل شده باشد. همچنین هر id که app.js می‌خواند باید در HTML باشد.

اجرا:  python3 tools/check_contracts.py
"""

import re
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
APP = os.path.join(ROOT, "app.js")

errors = []
warnings = []

html = open(HTML, encoding="utf-8").read()
app = open(APP, encoding="utf-8").read()

# ۱) توابع فراخوانی‌شده از HTML — هم فایل index.html و هم HTML تولیدشده در JS
handlers = set(re.findall(r'on(?:click|change|input)="([A-Za-z_$][\w$]*)\s*\(', html))
handlers |= set(re.findall(r'on(?:click|change|input)="([A-Za-z_$][\w$]*)\s*\(', app))

# ۲) توابع متصل‌شده به window در app.js
block = re.search(r"Object\.assign\(window,\s*\{(.*?)\}\s*\)", app, re.S)
exposed = set()
if block:
    exposed = set(re.findall(r"[A-Za-z_$][\w$]*", block.group(1)))
else:
    errors.append("بلوک Object.assign(window, {...}) در app.js پیدا نشد")

missing_handlers = sorted(handlers - exposed)
for fn in missing_handlers:
    errors.append(f"تابع «{fn}» در HTML صدا زده می‌شود ولی به window متصل نیست")

# ۳) توابع تعریف‌شده در app.js (برای تشخیص نام اشتباه)
defined = set(re.findall(r"^function\s+([A-Za-z_$][\w$]*)", app, re.M))
for fn in missing_handlers:
    if fn not in defined:
        errors.append(f"تابع «{fn}» در app.js تعریف هم نشده است")

# ۴) شناسه‌هایی که app.js از DOM می‌خواند
used_ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", app))
html_ids = set(re.findall(r'id="([^"]+)"', html))
missing_ids = sorted(used_ids - html_ids)
for i in missing_ids:
    errors.append(f"id «{i}» در app.js استفاده شده ولی در index.html نیست")

# ۵) توابع متصل‌شده به window که هیچ‌جا استفاده نمی‌شوند (فقط هشدار)
unused = sorted(exposed - handlers - {"saveAll", "saveAll"})
for fn in unused:
    warnings.append(f"تابع «{fn}» به window متصل است ولی در HTML استفاده نشده")

# ۶) ماژول‌های import شده واقعاً وجود دارند
for mod in set(re.findall(r"from\s+'(\./[^']+)'", app)):
    p = os.path.normpath(os.path.join(ROOT, mod))
    if not os.path.exists(p):
        errors.append(f"ماژول «{mod}» import شده ولی فایلش نیست")

print(f"توابع HTML: {len(handlers)}  |  متصل به window: {len(exposed)}  |  idها: {len(used_ids)}")
for w in warnings:
    print("⚠ ", w)
for e in errors:
    print("✖ ", e)

if errors:
    print(f"\n❌ {len(errors)} خطا")
    sys.exit(1)
print("\n✅ قرارداد HTML ↔ JS سالم است")

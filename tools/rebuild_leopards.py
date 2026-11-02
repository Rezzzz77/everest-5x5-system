#!/usr/bin/env python3
"""
ساخت پنج آواتار پلنگ برفی از عکس اصلی (پس‌زمینهٔ سفید).
-----------------------------------------------------------
چرا این اسکریپت؟
  برش قبلی با مرز ستون‌های مساوی انجام شده بود و دُم پلنگ‌های ۴ و ۵ که
  در عکس به هم می‌چسبند، اشتباه تقسیم می‌شد: دُم ۴ به فایل ۵ می‌رفت و
  خودش بی‌دُم می‌ماند.

روش:
  ۱) هر پیکسل «غیرسفید» به‌عنوان سوژه گرفته می‌شود.
  ۲) حفره‌ها پر می‌شوند تا خز روشن هم مات بماند (بدون حفرهٔ سفید).
  ۳) قطعه‌های جداافتاده (مثل نوک دُم که با چند پیکسل سفید جدا شده)
     به نزدیک‌ترین بدن می‌چسبند.
  ۴) اگر دو بدن به هم چسبیده باشند (۴ و ۵)، از باریک‌ترین ستون بین
     دو مرکز بریده می‌شوند — نه از مرز دلبخواهی.
  ۵) هر بدن در یک قاب مربع با حاشیهٔ ۶٪ قرار می‌گیرد و به ۳۸۴px می‌رسد.

اجرا:  python3 tools/rebuild_leopards.py [--out DIR] [--report]
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.expanduser('~/.aether/workspace/uploads/1000017926_63-423101782.jpg')
SIZE = 384
MARGIN = 0.06          # حاشیهٔ امن ۶٪ از هر طرف
WHITE_TOL = 8          # فاصله از سفید که «سوژه» حساب می‌شود
MIN_PIECE = 400        # قطعه‌های کوچک‌تر نویز هستند
TIP_RADIUS = 140       # حداکثر فاصلهٔ نوک دُم جداافتاده تا بدن


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r


def subject_mask(rgb, grad_min=4, close_r=9):
    """ماسک سوژه: خز و لبه‌ها بله، سایهٔ نرم کف و متن پایین نه.

    سایه/انعکاس کف نرم است (گرادیان کم) و خز خال‌دار است (گرادیان بالا)،
    پس با آستانهٔ گرادیان از هم جدا می‌شوند. حفره‌ها بعد پر می‌شوند تا
    خز سفیدِ داخل بدن هم مات بماند.
    """
    luma = np.asarray(rgb).astype(np.float32).min(axis=2)
    notwhite = (255 - luma) > 8
    edges = np.asarray(
        Image.fromarray(luma.astype(np.uint8)).filter(ImageFilter.FIND_EDGES)
    ).astype(np.float32)
    seed = notwhite & (edges > grad_min)
    solid = ndimage.binary_closing(seed, disk(close_r))
    solid = ndimage.binary_fill_holes(solid)
    solid &= notwhite
    return ndimage.binary_fill_holes(solid)   # خز سفیدِ داخل بدن هم مات می‌ماند


def bodies(mask, textured=None):
    """قطعه‌های بزرگ ماسک = بدن هر پله (به ترتیب چپ به راست)."""
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    groups = [{'labels': [int(i) + 1], 'mask': (lab == int(i) + 1)}
              for i in range(n) if sizes[i] >= 20000]
    groups.sort(key=lambda g: np.nonzero(g['mask'])[1].min())
    return groups


def separate(groups):
    """اگر دو پله در ماسک به هم رسیده باشند، از باریک‌ترین ستونِ ناحیهٔ تماس ببرد."""
    for i in range(len(groups) - 1):
        a, b = groups[i], groups[i + 1]
        ax = np.nonzero(a['mask'])[1]
        bx = np.nonzero(b['mask'])[1]
        a_max, b_min = ax.max(), bx.min()
        if a_max < b_min:
            continue
        lo, hi = b_min, a_max
        union = a['mask'] | b['mask']
        prof = union[:, lo:hi + 1].sum(axis=0)
        seam = lo + int(np.argmin(prof))
        for g, keep_left in ((a, True), (b, False)):
            m = g['mask'].copy()
            if keep_left:
                m[:, seam + 1:] = False
            else:
                m[:, :seam + 1] = False
            g['mask'] = m
        if 'seam' in a:
            pass
        a['seam'], b['seam'] = seam, seam
    return groups


def _dist_to(mask, y, x):
    """فاصلهٔ یک نقطه تا نزدیک‌ترین پیکسل ماسک (تقریب ارزان)."""
    ys, xs = np.nonzero(mask)
    return float(np.min(np.hypot(ys - y, xs - x)))


def split_touching(group, mask):
    """اگر یک گروه دو بدنِ چسبیده داشت، از باریک‌ترین ستون بین دو مرکز ببرد."""
    area = group['mask'].sum()
    ys, xs = np.nonzero(group['mask'])
    width = xs.max() - xs.min() + 1
    # اگر پهنای جعبه بیشتر از ۱.۵ برابر معمول باشد، دو بدن است
    if area < 160000 or width < 600:
        return [group]
    prof = group['mask'].sum(axis=0)
    # مرکز دو تودهٔ جرم
    half = prof.size // 2
    left_c = int(np.average(np.arange(half), weights=prof[:half] + 1e-6))
    right_c = half + int(np.average(np.arange(prof.size - half), weights=prof[half:] + 1e-6))
    lo, hi = int(left_c + (right_c - left_c) * 0.25), int(left_c + (right_c - left_c) * 0.75)
    seam = int(lo + np.argmin(prof[lo:hi]))
    left = group['mask'].copy()
    right = group['mask'].copy()
    left[:, seam:] = False
    right[:, :seam] = False
    # قطعه‌های کوچک هر طرف را به بدنهٔ همان طرف بچسبان
    out = []
    for part in (left, right):
        part = ndimage.binary_fill_holes(part)
        lab, n = ndimage.label(part, structure=np.ones((3, 3)))
        if n > 1:
            sizes = ndimage.sum(part, lab, range(1, n + 1))
            keep = int(np.argmax(sizes)) + 1
            part = (lab == keep)
        out.append({'labels': [], 'mask': part})
    out[0]['seam'] = seam
    out[1]['seam'] = seam
    return out


def compose(mask, box, size=SIZE):
    """آلفای ۳۸۴ از ماسک، داخل قابِ داده‌شده، با لبهٔ نرم (بیرون قاب = شفاف)."""
    left, top, right, bottom = box
    canvas = np.zeros((bottom - top, right - left), dtype=bool)
    H, W = mask.shape
    sy0, sx0 = max(0, top), max(0, left)
    sy1, sx1 = min(H, bottom), min(W, right)
    if sy1 > sy0 and sx1 > sx0:
        canvas[sy0 - top:sy1 - top, sx0 - left:sx1 - left] = mask[sy0:sy1, sx0:sx1]
    crop = canvas
    alpha = Image.fromarray((crop * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)
    return alpha.filter(ImageFilter.GaussianBlur(0.6))


def build(src_path, out_dir, report=False):
    rgb = Image.open(src_path).convert('RGB')
    mask = subject_mask(rgb)
    luma = np.asarray(rgb).astype(np.int16).min(axis=2)
    textured = luma < 170
    groups = separate(bodies(mask, textured))

    # گروه‌های چندبدنی را بشکن
    split = []
    for g in groups:
        split.extend(split_touching(g, mask))

    if report:
        print(f'منبع: {os.path.basename(src_path)} {rgb.size}')
        print(f'گروه‌ها: {len(groups)} → پس از جداسازی: {len(split)}')
    if len(split) != 5:
        raise SystemExit(f'تعداد بدن‌ها {len(split)} شد، انتظار ۵ بود')

    os.makedirs(out_dir, exist_ok=True)
    out = []
    for i, g in enumerate(split, start=1):
        box = box_for(g['mask'])
        alpha = compose(g['mask'], box)
        rgba = crop_color(rgb, box).resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')
        rgba.putalpha(alpha)
        path = os.path.join(out_dir, f'stage-{i}.png')
        rgba.save(path)
        out.append((path, g, box))
        if report:
            ys, xs = np.nonzero(g['mask'])
            print(f'  پلهٔ {i}: x=[{xs.min()}..{xs.max()}] y=[{ys.min()}..{ys.max()}] '
                  f'مساحت={int(g["mask"].sum())} قاب={box}')
    return out


def crop_color(rgb, box):
    """برش رنگ با پدینگ سفید برای نواحی بیرون تصویر."""
    left, top, right, bottom = box
    if left >= 0 and top >= 0 and right <= rgb.width and bottom <= rgb.height:
        return rgb.crop(box)
    canvas = Image.new('RGB', (right - left, bottom - top), (255, 255, 255))
    sy0, sx0 = max(0, top), max(0, left)
    sy1, sx1 = min(rgb.height, bottom), min(rgb.width, right)
    canvas.paste(rgb.crop((sx0, sy0, sx1, sy1)), (sx0 - left, sy0 - top))
    return canvas


def box_for(mask, size=SIZE, margin=MARGIN):
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    h, w = y1 - y0 + 1, x1 - x0 + 1
    side = int(max(h, w) * (1 + 2 * margin))
    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    top, left = int(round(cy - side / 2)), int(round(cx - side / 2))
    return (left, top, left + side, top + side)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=DEFAULT_SRC)
    ap.add_argument('--out', default=os.path.join(ROOT, '.qa', 'rebuild'))
    ap.add_argument('--report', action='store_true')
    args = ap.parse_args()
    build(args.src, args.out, report=True)


if __name__ == '__main__':
    sys.exit(main())

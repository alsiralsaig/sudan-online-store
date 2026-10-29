"""
توليد أيقونات تطبيقات سند برسم متجهي نظيف (بدون إطار أبيض).
- رمز أبيض كبير على خلفية متدرّجة بهوية سند (أزرق سماوي).
- مخرجات أندرويد: أيقونة تقليدية (كل الكثافات) + طبقة أمامية للتكيّف (شفافة) + نسخة دائرية.
التشغيل: python3 make_icons.py [merchant|client|admin]
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

OUT_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app-icons')
PREVIEW_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app-icons', 'preview')

# (لون أعلى, لون أسفل) لكل تطبيق
BRANDS = {
    'merchant': ('#0b3d91', '#1e88e5'),   # كاشير: أزرق غامق → أزرق
    'client':   ('#0284c7', '#38bdf8'),   # متجر: أزرق → سماوي
    'admin':    ('#0f172a', '#0369a1'),   # إدارة: كحلي → أزرق
}
ACCENT = {
    'merchant': '#0ea5e9',
    'client':   '#0ea5e9',
    'admin':    '#0369a1',
}

S = 4096  # نرسم بحجم كبير ثم نصغّر (تنعيم الحواف)


def gradient(size, top, bottom):
    """تدرّج رأسي ناعم."""
    img = Image.new('RGB', (1, size))
    d = ImageDraw.Draw(img)
    t = tuple(int(top[i:i + 2], 16) for i in (1, 3, 5))
    b = tuple(int(bottom[i:i + 2], 16) for i in (1, 3, 5))
    for y in range(size):
        f = y / max(1, size - 1)
        d.point((0, y), tuple(int(t[c] + (b[c] - t[c]) * f) for c in range(3)))
    return img.resize((size, size), Image.BICUBIC)


def rounded_mask(size, radius_ratio=0.22):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def circle_mask(size):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, size - 1, size - 1], fill=255)
    return mask


# --------------------------------------------------------------------------
# الرموز (تُرسم بيضاء على طبقة شفافة، الإحداثيات نسبية 0..1)
# --------------------------------------------------------------------------

def glyph_merchant(draw, size, color):
    """ماكينة كاشير: جسم + شاشة + لوحة أرقام + درج نقود + إيصال."""
    def box(x0, y0, x1, y1, r=0.03, fill=color):
        draw.rounded_rectangle([x0 * size, y0 * size, x1 * size, y1 * size],
                               radius=r * size, fill=fill)

    # جسم الماكينة
    box(0.20, 0.40, 0.80, 0.62, 0.05)
    # الشاشة (فراغ)
    box(0.27, 0.45, 0.50, 0.55, 0.02, ACCENT['merchant'])
    # لوحة الأرقام: 3×2
    for row in range(2):
        for col in range(3):
            cx = 0.585 + col * 0.072
            cy = 0.472 + row * 0.055
            box(cx - 0.018, cy - 0.018, cx + 0.018, cy + 0.018, 0.012, ACCENT['merchant'])
    # درج النقود
    box(0.16, 0.64, 0.84, 0.78, 0.045)
    # مقبض الدرج
    box(0.44, 0.695, 0.56, 0.725, 0.012, ACCENT['merchant'])
    # إيصال خارج من الأعلى
    box(0.56, 0.30, 0.72, 0.42, 0.02)


def glyph_client(draw, size, color, hole):
    """حقيبة تسوّق + قلب (القلب فراغ)."""
    def box(x0, y0, x1, y1, r=0.03, fill=color):
        draw.rounded_rectangle([x0 * size, y0 * size, x1 * size, y1 * size],
                               radius=r * size, fill=fill)

    # المقبض
    w = int(0.055 * size)
    draw.arc([0.34 * size, 0.20 * size, 0.66 * size, 0.52 * size],
             start=180, end=360, fill=color, width=w)
    # جسم الحقيبة
    box(0.22, 0.38, 0.78, 0.84, 0.075)
    # القلب (فراغ)
    cx, cy, s = 0.50, 0.585, 0.105
    draw.ellipse([(cx - s * 0.62) * size, (cy - s * 0.55) * size,
                  (cx + s * 0.02) * size, (cy + s * 0.10) * size], fill=hole)
    draw.ellipse([(cx - s * 0.02) * size, (cy - s * 0.55) * size,
                  (cx + s * 0.62) * size, (cy + s * 0.10) * size], fill=hole)
    draw.polygon([( (cx - s * 0.60) * size, (cy - s * 0.18) * size),
                  ((cx + s * 0.60) * size, (cy - s * 0.18) * size),
                  (cx * size, (cy + s * 0.72) * size)], fill=hole)


def glyph_admin(draw, size, color, hole):
    """درع + ترس."""
    # شكل الدرع
    pts = [
        (0.50, 0.13), (0.83, 0.27), (0.80, 0.58),
        (0.66, 0.79), (0.50, 0.89), (0.34, 0.79), (0.20, 0.58), (0.17, 0.27),
    ]
    draw.polygon([(x * size, y * size) for x, y in pts], fill=color)

    # قلب الدرع بفراغ الدائرة
    cx, cy, r = 0.50, 0.47, 0.155
    draw.ellipse([(cx - r) * size, (cy - r) * size, (cx + r) * size, (cy + r) * size], fill=hole)
    # الترس: حلقة + 6 أسنان
    hole_color = hole
    ring = 0.085
    draw.ellipse([(cx - ring) * size, (cy - ring) * size, (cx + ring) * size, (cy + ring) * size], fill=color)
    draw.ellipse([(cx - 0.045) * size, (cy - 0.045) * size, (cx + 0.045) * size, (cy + 0.045) * size], fill=hole_color)
    for i in range(6):
        a = math.radians(i * 60)
        tx, ty = cx + math.cos(a) * 0.125, cy + math.sin(a) * 0.125
        draw.ellipse([(tx - 0.032) * size, (ty - 0.032) * size, (tx + 0.032) * size, (ty + 0.032) * size], fill=color)


GLYPHS = {'merchant': glyph_merchant, 'client': glyph_client, 'admin': glyph_admin}


def render(app, size, mode):
    """mode: 'full' (خلفية كاملة + رمز) أو 'foreground' (رمز فقط شفاف)."""
    top, bottom = BRANDS[app]
    if mode == 'foreground':
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        hole = (0, 0, 0, 0)
        scale = 0.62          # داخل المنطقة الآمنة للأيقونة التكيّفية
    else:
        img = gradient(size, top, bottom).convert('RGBA')
        draw = ImageDraw.Draw(img)
        hole = gradient(size, top, bottom).convert('RGBA').getpixel((size // 2, size // 2))
        scale = 0.78

    # طبقة الرمز بحجم أصغر ثم تُركّب في المنتصف
    gsize = int(size * scale)
    layer = Image.new('RGBA', (gsize, gsize), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    if app == 'merchant':
        GLYPHS[app](ldraw, gsize, (255, 255, 255, 255))
        # الثقوب داخل جسم الماكينة بلون الخلفية
        pass
    else:
        GLYPHS[app](ldraw, gsize, (255, 255, 255, 255), hole)

    off = ((size - gsize) // 2, (size - gsize) // 2)
    img.alpha_composite(layer, off)
    return img


def save_for_android(app, big_full, big_fg):
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'android', 'app', 'src', 'main', 'res')
    base = os.path.abspath(base)
    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    adaptive = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    mask_round = rounded_mask(big_full.size[0], 0.22)
    round_square = Image.new('RGBA', big_full.size, (0, 0, 0, 0))
    round_square.paste(big_full, (0, 0), mask_round)

    for d, s in legacy.items():
        p = os.path.join(base, f'mipmap-{d}')
        os.makedirs(p, exist_ok=True)
        round_square.resize((s, s), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
        circle = Image.new('RGBA', big_full.size, (0, 0, 0, 0))
        circle.paste(big_full, (0, 0), circle_mask(big_full.size[0]))
        circle.resize((s, s), Image.LANCZOS).save(os.path.join(p, 'ic_launcher_round.png'))
    for d, s in adaptive.items():
        p = os.path.join(base, f'mipmap-{d}')
        os.makedirs(p, exist_ok=True)
        big_fg.resize((s, s), Image.LANCZOS).save(os.path.join(p, 'ic_launcher_foreground.png'))
    print('android icons written for', app)


def main():
    apps = sys.argv[1:] or list(BRANDS)
    os.makedirs(OUT_ROOT, exist_ok=True)
    os.makedirs(PREVIEW_ROOT, exist_ok=True)
    for app in apps:
        full = render(app, S, 'full')
        fg = render(app, S, 'foreground')
        full.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT_ROOT, f'{app}.png'))
        fg.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT_ROOT, f'{app}-fg.png'))
        # معاينة: أيقونة مقنّعة بشكل دائري (كما تظهر على أندرويد)
        prev = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
        flat = gradient(512, *BRANDS[app]).convert('RGBA')
        flat.alpha_composite(fg.resize((512, 512), Image.LANCZOS))
        masked = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        masked.paste(flat, (0, 0), circle_mask(512))
        masked.save(os.path.join(PREVIEW_ROOT, f'{app}-adaptive.png'))
        try:
            save_for_android(app, full, fg)
        except FileNotFoundError:
            print('(android res not found, skipped)')
    print('done')


if __name__ == '__main__':
    main()

"""SPEC-005 QI2 첫 화면 일러스트 다듬기 (designer, 2026-10-20) — 로컬 PIL/numpy/scipy만 쓴다. 외부 서비스·업로드 없음.
실행(저장소 뿌리에서): python docs/design/source/cut-home-illustration.py docs/design/source/home-illustration-source-2026-10-20.webp <점검 그림 폴더> src/assets/home
출력: src/assets/home/home-map-pc.webp(545×640, q66) · home-map-mobile.webp(341×400, q74) — 알파 WebP, 합계 ≤ 100KB. 점검 폴더에는 overlay/preview-light/preview-dark/cut-full.png
원본: docs/design/source/home-illustration-source-2026-10-20.webp (1536×1024)
단계: ① 손으로 적은 넉넉한 다각형 + 제외 상자(배·돛단배·스카이라인) — 지도 바깥의 글·통계 패널·인물·팻말을 배제
      ② 색 분류: 하늘(파랑) / 흰색 / 색 있는 내용. 지도 윤곽의 흰 테두리(halo)는 '얇은 흰색'(5px 안에 다른 색이 있는 흰색)으로 살린다
      ③ core = 색 있는 내용 ∪ 얇은 흰색 → 둘러싸인 구멍(타일 안 하늘·바다) 채움 → 작은 조각 제거
      ④ 바깥 10px 띠에서 파랑 하늘 픽셀을 투명하게, 안쪽에서 12px 넘게 떨어진 흰 조각(구름 자락) 제거 → 가우시안 페더 + 은은한 바깥 광
      ⑤ 색조 보정(채도 0.92, 살짝 따뜻하게) → 알파 WebP(PC·모바일)
"""
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
ASSET_DIR = sys.argv[3] if len(sys.argv) > 3 else None

im = Image.open(SRC).convert("RGB")
W, H = im.size
rgb = np.asarray(im).astype(np.float32) / 255.0
hsv = np.asarray(im.convert("HSV")).astype(np.float32) / 255.0
Hh, S, V = hsv[..., 0] * 360.0, hsv[..., 1], hsv[..., 2]
R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]

# ① 넉넉한 다각형(원본 좌표, 시계 방향). 제주·서해 섬·동해 섬·남해 섬을 품고 배·글은 뺀다.
POLY = [
    (560, 10), (700, 8), (860, 10), (960, 12), (1000, 40), (1040, 120), (1060, 220), (1120, 300), (1125, 420),
    (1120, 480), (1130, 560), (1120, 640), (1100, 700), (1075, 790), (1040, 850), (990, 890), (930, 895),
    (880, 870), (800, 870), (740, 840), (700, 870), (660, 895), (560, 900), (460, 895), (400, 860),
    (385, 800), (400, 735), (440, 700), (470, 660), (430, 640), (420, 600), (440, 540), (420, 470),
    (380, 420), (370, 300), (365, 220), (390, 180), (440, 170), (470, 120), (520, 40),
]
EXCLUDE = [(692, 806, 738, 852), (1022, 704, 1098, 758), (985, 775, 1140, 924)]  # 돛단배 · 여객선 · 오른쪽 아래 스카이라인/바다
# 믿는 구역(타일 안 하늘이 흰 테두리까지 이어지는 곳 — 북쪽 끝 두 타일 꼭대기·제주 꼭대기): 테두리 안쪽을 손으로 따라 그렸고 이 안은 하늘 제거 없이 그대로 둔다
TRUST = [
    [(525, 135), (545, 118), (565, 103), (600, 92), (640, 80), (665, 68), (700, 62), (740, 62), (778, 70), (780, 160), (520, 160)],
    [(778, 72), (800, 78), (840, 78), (865, 70), (885, 58), (900, 40), (915, 28), (935, 28), (950, 40), (968, 60), (985, 82), (1000, 105), (1012, 135), (1018, 160), (780, 160)],
    [(425, 782), (445, 762), (470, 748), (500, 740), (540, 730), (580, 724), (620, 728), (655, 742), (680, 758), (692, 778), (692, 800), (425, 800)],
]
poly_im = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(poly_im)
d.polygon(POLY, fill=255)
for b in EXCLUDE:
    d.rectangle(b, fill=0)
poly = np.asarray(poly_im) > 0
trust_im = Image.new("L", (W, H), 0)
for t in TRUST:
    ImageDraw.Draw(trust_im).polygon(t, fill=255)
trust = np.asarray(trust_im) > 0

# ② 분류
sky = (Hh > 185) & (Hh < 245) & (S > 0.05) & (S < 0.85) & (V > 0.40)
white = (S < 0.14) & (V > 0.86)
colored = ~(sky | white)
thin_white = white & ~ndi.binary_erosion(white, iterations=5)
core = (colored | thin_white) & poly
core = ndi.binary_opening(core, structure=np.ones((3, 3)))
core |= trust

# ③ 구멍 채움 + 조각 정리
filled = ndi.binary_fill_holes(core)
lab, n = ndi.label(filled)
sizes = ndi.sum(filled, lab, range(1, n + 1))
kept_mask = np.zeros_like(filled)
kept = []
for i, sz in enumerate(sizes, start=1):
    if sz >= 350:
        comp = lab == i
        kept_mask |= comp
        ys, xs = np.where(comp)
        kept.append((int(sz), int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
kept.sort(reverse=True)
filled = kept_mask

# ④ 가장자리 정리 — 믿는 구역은 바깥 6px만 손본다
dist_in = ndi.distance_transform_edt(filled)  # 안쪽 픽셀의 경계까지 거리
sky_strength = np.clip(((B - R) - 0.06) / 0.20, 0, 1) * ((Hh > 185) & (Hh < 245))
alpha = filled.astype(np.float32)
band = filled & (((dist_in <= 10) & ~trust) | ((dist_in <= 6) & trust))
alpha[band] *= (1 - sky_strength[band])
# 작은 조각(섬, < 6000px)은 전체에서 하늘 픽셀을 빼고 색 있는 부분에서 5px 넘게 떨어진 흰색(물결 자락)도 뺀다
lab2, n2 = ndi.label(filled)
sizes2 = ndi.sum(filled, lab2, range(1, n2 + 1))
small_ids = [i for i, sz in enumerate(sizes2, start=1) if sz < 6000]
small = np.isin(lab2, small_ids)
dist_to_colored = ndi.distance_transform_edt(~(colored & poly))
alpha[small] *= (1 - sky_strength[small])
alpha[small & white & (dist_to_colored > 5)] = 0
# 구름 자락: 경계 14px 안의 띠에서, 색 있는 내용에서 10px 넘게 떨어진 흰색(흰 테두리는 타일에 붙어 있어 10px 안). 타일 안 구름은 건드리지 않는다
alpha[white & (dist_to_colored > 10) & (dist_in <= 14) & ~trust] = 0
alpha = ndi.gaussian_filter(alpha, sigma=1.4)
alpha = np.clip((alpha - 0.08) / 0.84, 0, 1)

# 바깥 색이 가장자리로 번지지 않게: 알파 낮은 곳의 RGB를 안쪽 색으로 끌어온다(알파 가중 블러)
a3 = alpha[..., None]
blur_rgb = ndi.gaussian_filter(rgb * a3, sigma=(3, 3, 0))
blur_a = ndi.gaussian_filter(alpha, sigma=3)[..., None]
rgb_fixed = np.clip(np.where(a3 > 0.92, rgb, blur_rgb / np.clip(blur_a, 1e-3, None)), 0, 1)

# ⑤ 색조: 채도 0.92, 살짝 따뜻하게 — 한지색 바탕(#f6f3ec)과 맞춘다
out = Image.fromarray((rgb_fixed * 255).astype(np.uint8), "RGB")
out = ImageEnhance.Color(out).enhance(0.92)
arr = np.asarray(out).astype(np.float32)
arr[..., 0] = np.clip(arr[..., 0] * 1.012, 0, 255)
arr[..., 2] = np.clip(arr[..., 2] * 0.982, 0, 255)

# 은은한 바깥 광(한지 크림색, 최대 28%) — 지도가 바탕에 녹아 보이게. 라이트에서는 거의 안 보이고 다크에서 옅은 테두리 빛이 된다
glow_a = np.clip(ndi.gaussian_filter((alpha > 0.5).astype(np.float32), sigma=9) * 0.22, 0, 0.22)
glow_rgb = np.array([0xFB, 0xF6, 0xEA], dtype=np.float32)
A = alpha + glow_a * (1 - alpha)
premul = arr * alpha[..., None] + glow_rgb * (glow_a * (1 - alpha))[..., None]
final_rgb = np.where(A[..., None] > 1e-4, premul / np.clip(A[..., None], 1e-4, None), glow_rgb)
rgba = Image.fromarray(np.dstack([np.clip(final_rgb, 0, 255).astype(np.uint8), (A * 255).astype(np.uint8)]), "RGBA")

ys, xs = np.where(A > 0.02)
x0, x1, y0, y1 = int(max(xs.min() - 6, 0)), int(min(xs.max() + 6, W)), int(max(ys.min() - 6, 0)), int(min(ys.max() + 6, H))
crop = rgba.crop((x0, y0, x1, y1))
crop.save(f"{OUT}/cut-full.png")
print(json.dumps({"bbox": [x0, y0, x1, y1], "size": crop.size, "components": kept[:14]}, ensure_ascii=False))

# 점검용
ov = im.copy().convert("RGBA")
edge = ndi.binary_dilation(alpha > 0.5) & ~(alpha > 0.5)
edge_im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
edge_im.paste((255, 0, 0, 255), None, Image.fromarray((edge * 255).astype(np.uint8), "L"))
ov.alpha_composite(edge_im)
ov = ov.convert("RGB")
ov.save(f"{OUT}/overlay.png")
for k, b in {"tl": (380, 0, 700, 320), "west": (330, 380, 650, 700), "south": (380, 640, 800, 960), "east": (880, 200, 1160, 620), "se": (760, 600, 1140, 920), "top": (700, 0, 1140, 240)}.items():
    ov.crop(b).save(f"{OUT}/ov-{k}.png")
for name, bg in (("light", (0xF6, 0xF3, 0xEC)), ("dark", (0x14, 0x17, 0x1F))):
    base = Image.new("RGBA", crop.size, bg + (255,))
    base.alpha_composite(crop)
    base.convert("RGB").save(f"{OUT}/preview-{name}.png")

if ASSET_DIR:
    os.makedirs(ASSET_DIR, exist_ok=True)
    report = {}
    for fname, hgt, q in (("home-map-pc.webp", 640, 66), ("home-map-mobile.webp", 400, 74)):
        sc = hgt / crop.size[1]
        w = round(crop.size[0] * sc)
        r = crop.resize((w, hgt), Image.LANCZOS)
        path = os.path.join(ASSET_DIR, fname)
        r.save(path, "WEBP", quality=q, alpha_quality=70, method=6)
        report[fname] = {"w": w, "h": hgt, "bytes": os.path.getsize(path), "q": q}
    print(json.dumps(report))

"""SPEC-005 QI2 첫 화면 일러스트 다듬기 (designer, 2026-10-20) — 로컬 PIL/numpy/scipy만 쓴다. 외부 서비스·업로드 없음.
실행(저장소 뿌리에서): python docs/design/source/cut-home-illustration.py docs/design/source/home-illustration-source-2026-10-20.webp <점검 그림 폴더> src/assets/home
출력: src/assets/home/home-map-pc.webp(613×720, q58) · home-map-mobile.webp(375×440, q66) — 알파 WebP, 합계 ≤ 100KB. 점검 폴더에는 overlay/preview-light/preview-dark/cut-full.png
      (r3 2026-10-20: 첫 화면 그림을 1.4배로 키우면서 해상도도 올렸다 — r2는 545×640 q66 · 341×400 q74 = 88.3KB. 화면에서 opacity .8·채도·대비 낮춤·0.5px 블러를 거치므로 품질 단계를 낮춰도 티가 안 난다)
      (r4 2026-10-20 형진 님 결정 A 「동해 섬 복원」: 원본의 동해 쪽 작은 섬 둘을 살린다 — 아래 ③-a·④-a·⑥. 치수·품질 단계는 r3 그대로)
원본: docs/design/source/home-illustration-source-2026-10-20.webp (1536×1024)
단계: ① 손으로 적은 넉넉한 다각형 + 제외 상자(배·돛단배·스카이라인) — 지도 바깥의 글·통계 패널·인물·팻말을 배제
      ② 색 분류: 하늘(파랑) / 흰색 / 색 있는 내용. 지도 윤곽의 흰 테두리(halo)는 '얇은 흰색'(5px 안에 다른 색이 있는 흰색)으로 살린다
      ③ core = 색 있는 내용 ∪ 얇은 흰색 → 둘러싸인 구멍(타일 안 하늘·바다) 채움 → 작은 조각 제거
         ③-a (r4) 동해 섬 상자(EAST_ISLANDS) 안은 100px 이상이면 남긴다 — 원본의 동해 섬 둘(284·261px)은 350px 문턱에 걸려 r3에서 빠졌었다. 다각형도 상자를 품게 넓혔다(r3 다각형의 변이 위쪽 섬을 가로질러 위쪽 섬이 178px로 깎여 있었다)
      ④ 바깥 10px 띠에서 파랑 하늘 픽셀을 투명하게, 안쪽에서 12px 넘게 떨어진 흰 조각(구름 자락) 제거 → 가우시안 페더 + 은은한 바깥 광
         ④-a (r4) 잔 조각 정리: 페더까지 끝난 알파에서 불투명(> 0.5) 연결 조각이 50px 미만이면 둘레 페더까지 지운다(r3 자산의 제주 왼쪽 2×4px 조각 — 제주 타일 가장자리의 반투명 물결 꼬리)
      ⑤ 색조 보정(채도 0.92, 살짝 따뜻하게) → 알파 WebP(PC·모바일)
      ⑥ (r4, 기본 꺼짐) 동해 섬 두 조각의 자리 맞바꿈(SWAP_EAST_ISLANDS): 처음 분석(r3 다각형이 위쪽 섬을 깎은 상태)에서는 작은 조각이 북서·큰 조각이 남동으로 보여 맞바꿈을 준비했으나,
         다각형을 고치니 두 몸체가 284·261px로 비슷해 옮길 근거가 없어 **원본 자리 그대로** 둔다. 켜면 서로의 자리(경계 상자 중심)로 평행 이동하고 불투명 부분 사이 세로 틈 5px를 보장한다
         (새 픽셀을 만들지 않는다 — 마스터 허용 범위 「원본 섬 조각을 동해 쪽 알맞은 자리로 옮기는 정도」).
      ⑦ (r4) 자르기 상자를 r3의 값(365,12 ~ 1125,904 = 760×892)으로 고정한다 — 섬이 늘어 경계 상자가 변해도 자산 치수(613×720·375×440)는 그대로. 불투명 내용(알파 > 0.5)이 상자 밖이면 잘림 경고를 낸다
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
#    r4: (1060,220)→(1120,300) 변이 동해 위쪽 섬(1098~1108, 263~275)을 가로질렀다 — (1084,246)·(1126,252)·(1127,330)을 넣어 동해 섬 상자를 품는다. 1150부터인 통계 패널에는 닿지 않는다
POLY = [
    (560, 10), (700, 8), (860, 10), (960, 12), (1000, 40), (1040, 120), (1060, 220), (1084, 246), (1126, 252), (1127, 330), (1125, 420),
    (1120, 480), (1130, 560), (1120, 640), (1100, 700), (1075, 790), (1040, 850), (990, 890), (930, 895),
    (880, 870), (800, 870), (740, 840), (700, 870), (660, 895), (560, 900), (460, 895), (400, 860),
    (385, 800), (400, 735), (440, 700), (470, 660), (430, 640), (420, 600), (440, 540), (420, 470),
    (380, 420), (370, 300), (365, 220), (390, 180), (440, 170), (470, 120), (520, 40),
]
EXCLUDE = [(692, 806, 738, 852), (1022, 704, 1098, 758), (985, 775, 1140, 924)]  # 돛단배 · 여객선 · 오른쪽 아래 스카이라인/바다
# r4 동해 섬 상자(원본 좌표, x0 y0 x1 y1): 원본의 동해 쪽 작은 섬 둘 — 위 조각 1093~1108 × 263~280, 아래 조각(붙은 작은 바위 둘 포함) 1096~1119 × 285~312. 본토 동해안(x≈1077)에서 15~40px 바다 쪽
EAST_ISLANDS = (1085, 255, 1126, 322)
EAST_MIN_PX = 100          # 상자 안에서 남기는 최소 조각(원본 px) — 섬 몸체 둘(284·261px)은 남고, 아래 섬에 붙은 바위 둘(36·46px)과 9px짜리 물결 점은 버린다
#                            (바위 둘은 안쪽 바다가 하늘색으로 분류돼 빠지면 흰 테두리 고리만 남아 화면 크기(3px)에서 먼지로 보였다 — 50px 미만 잔 조각 기준과 같이 뺀다)
SWAP_EAST_ISLANDS = False  # ⑥ 두 조각 자리 맞바꿈 — r4 최종은 **원본 자리 그대로**(두 조각은 크기가 비슷해 옮길 근거가 없었다). True면 서로의 자리로 평행 이동(기록용으로 남긴 코드)
CROP = (365, 12, 1125, 904)  # ⑦ r3과 같은 자르기 상자(760×892) — 자산 치수 고정
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
east_im = Image.new("L", (W, H), 0)
ImageDraw.Draw(east_im).rectangle(EAST_ISLANDS, fill=255)
east_box = np.asarray(east_im) > 0

# ② 분류
sky = (Hh > 185) & (Hh < 245) & (S > 0.05) & (S < 0.85) & (V > 0.40)
white = (S < 0.14) & (V > 0.86)
colored = ~(sky | white)
thin_white = white & ~ndi.binary_erosion(white, iterations=5)
core = (colored | thin_white) & poly
core = ndi.binary_opening(core, structure=np.ones((3, 3)))
core |= trust

# ③ 구멍 채움 + 조각 정리 (③-a 동해 섬 상자 안은 EAST_MIN_PX 이상이면 남긴다)
filled = ndi.binary_fill_holes(core)
lab, n = ndi.label(filled)
sizes = ndi.sum(filled, lab, range(1, n + 1))
kept_mask = np.zeros_like(filled)
kept = []
east_kept = []
for i, sz in enumerate(sizes, start=1):
    comp = lab == i
    in_east = bool((comp & east_box).any())
    if sz >= 350 or (in_east and sz >= EAST_MIN_PX):
        kept_mask |= comp
        ys, xs = np.where(comp)
        box = (int(sz), int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        kept.append(box)
        if in_east and sz < 350:
            east_kept.append(box)
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

# ④-a 잔 조각 정리: 불투명(알파 > 0.5) 연결 조각이 50px 미만이면 그 조각과 둘레 4px의 페더까지 지운다(다른 불투명 조각의 2px 안은 건드리지 않는다).
#     r3 자산의 2×4px 조각은 제주 타일 왼쪽 아래 가장자리의 물결 자락 — 원본 크기에서는 알파 0.4~0.6의 가는 꼬리(약 3×14px)로 제주 타일에 알파 0.3~0.5로
#     이어져 있다가 줄이면서 떨어져 나온 것이라 문턱을 0.5로 잡아야 잡힌다. 동해 섬 몸체 둘은 불투명 면적이 200px 넘어 이 규칙에 걸리지 않는다
solid = alpha > 0.5
grp_lab, grp_n = ndi.label(solid)
grp_sizes = ndi.sum(solid, grp_lab, range(1, grp_n + 1))
removed = []
for i, sz in enumerate(grp_sizes, start=1):
    if sz < 50:
        comp = grp_lab == i
        ys, xs = np.where(comp)
        removed.append((int(sz), int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())))
        ring = ndi.binary_dilation(comp, iterations=4)
        dist_other = ndi.distance_transform_edt(~(solid & ~comp))
        alpha[ring & (dist_other > 2)] = 0

# ⑥ 동해 섬 두 조각 자리 맞바꿈 — 알파·RGB를 같은 정수 벡터로 평행 이동(새 픽셀을 만들지 않는다)
swap_report = None
if SWAP_EAST_ISLANDS:
    ex0, ey0, ex1, ey1 = EAST_ISLANDS
    sub = np.zeros_like(solid)
    sub[ey0:ey1 + 1, ex0:ex1 + 1] = True
    isl_lab, isl_n = ndi.label((alpha > 0.3) & sub)
    cents = ndi.center_of_mass(alpha > 0.3, isl_lab, range(1, isl_n + 1))
    # 묶음: 질량 중심 y가 두 조각 사이(원본 위 조각 아래끝 280 · 아래 조각 위끝 285)보다 위면 U, 아래면 L
    split_y = 283
    groups = {"U": [i + 1 for i, c in enumerate(cents) if c[0] < split_y], "L": [i + 1 for i, c in enumerate(cents) if c[0] >= split_y]}
    if groups["U"] and groups["L"]:
        # 페더(0.02 < 알파 ≤ 0.3)는 가장 가까운 불투명 조각의 묶음을 따른다
        soft = (alpha > 0.02) & sub
        _, (iy, ix) = ndi.distance_transform_edt(isl_lab == 0, return_indices=True)
        owner = np.where(soft, isl_lab[iy, ix], 0)
        masks, boxes = {}, {}
        for k, ids in groups.items():
            m = np.isin(owner, ids)
            ys, xs = np.where(np.isin(isl_lab, ids))
            boxes[k] = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
            masks[k] = m
        center = {k: ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) for k, b in boxes.items()}
        shift = {
            "U": [int(round(center["L"][0] - center["U"][0])), int(round(center["L"][1] - center["U"][1]))],
            "L": [int(round(center["U"][0] - center["L"][0])), int(round(center["U"][1] - center["L"][1]))],
        }
        # 맞바꾼 뒤 두 조각의 불투명 부분 사이에 세로 틈 ≥ GAP(원본에서 두 조각은 흰 테두리가 맞닿아 있었다 — 자리가 바뀌어 아래 조각의 바위가 위 조각 바로 위에 오면 한 덩어리로 보인다)
        GAP = 5
        gap = (boxes["U"][1] + shift["U"][1]) - (boxes["L"][3] + shift["L"][1]) - 1
        if gap < GAP:
            need = GAP - gap
            shift["L"][1] -= need // 2 + need % 2
            shift["U"][1] += need // 2
        new_alpha = alpha.copy()
        new_rgb = rgb.copy()
        for k in ("U", "L"):
            new_alpha[masks[k]] = 0
        for k in ("U", "L"):
            dx, dy = shift[k]
            mv = np.roll(np.roll(masks[k], dy, axis=0), dx, axis=1)
            a_mv = np.roll(np.roll(alpha * masks[k], dy, axis=0), dx, axis=1)
            rgb_mv = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)
            new_alpha = np.maximum(new_alpha, a_mv)
            new_rgb[mv] = rgb_mv[mv]
        alpha, rgb = new_alpha, new_rgb
        after = {}
        for k in ("U", "L"):
            b = boxes[k]
            dx, dy = shift[k]
            after[k] = (b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy)
        swap_report = {"before": boxes, "shift": shift, "after": after}
    else:
        print("WARN: 동해 섬 상자에서 두 묶음을 찾지 못해 맞바꾸지 않았다", groups, file=sys.stderr)

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

# ⑦ 자르기 — 상자는 고정. 경계 상자(참고)와 잘림 검사(불투명 내용이 상자 안에 ≥ 2px 여유로 들어가는지)
ys, xs = np.where(A > 0.02)
bbox_auto = [int(max(xs.min() - 6, 0)), int(max(ys.min() - 6, 0)), int(min(xs.max() + 6, W)), int(min(ys.max() + 6, H))]
sy, sx = np.where(alpha > 0.5)
x0, y0, x1, y1 = CROP
clip_ok = bool(sx.min() >= x0 + 2 and sy.min() >= y0 + 2 and sx.max() <= x1 - 3 and sy.max() <= y1 - 3)
if not clip_ok:
    print("WARN: 불투명 내용이 자르기 상자 가장자리에 닿는다", {"solid": [int(sx.min()), int(sy.min()), int(sx.max()), int(sy.max())], "crop": CROP}, file=sys.stderr)
crop = rgba.crop(CROP)
crop.save(f"{OUT}/cut-full.png")
# 동해 섬의 최종 위치(원본 좌표 → 자르기 좌표 → PC·모바일 자산 좌표)
isl_final = []
fl, fn = ndi.label(ndi.binary_dilation((alpha > 0.3) & east_box, iterations=1))
for i in range(1, fn + 1):
    m = (fl == i) & (alpha > 0.3)
    ys_, xs_ = np.where(m)
    if len(xs_):
        isl_final.append({"px": int(m.sum()), "orig": [int(xs_.min()), int(ys_.min()), int(xs_.max()), int(ys_.max())]})
for it in isl_final:
    bx = it["orig"]
    it["crop"] = [bx[0] - x0, bx[1] - y0, bx[2] - x0, bx[3] - y0]
    for name, hgt in (("pc", 720), ("mobile", 440)):
        s = hgt / (y1 - y0)
        it[name] = [round(v * s, 1) for v in it["crop"]]
print(json.dumps({"bbox_auto": bbox_auto, "crop": CROP, "size": crop.size, "clip_ok": clip_ok, "components": kept[:16], "east_kept": east_kept, "removed_fragments": removed, "swap": swap_report, "east_islands_final": isl_final}, ensure_ascii=False))

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
    for fname, hgt, q in (("home-map-pc.webp", 720, 58), ("home-map-mobile.webp", 440, 66)):
        sc = hgt / crop.size[1]
        w = round(crop.size[0] * sc)
        r = crop.resize((w, hgt), Image.LANCZOS)
        path = os.path.join(ASSET_DIR, fname)
        r.save(path, "WEBP", quality=q, alpha_quality=70, method=6)
        report[fname] = {"w": w, "h": hgt, "bytes": os.path.getsize(path), "q": q}
    report["total_bytes"] = sum(v["bytes"] for v in report.values() if isinstance(v, dict))
    print(json.dumps(report))

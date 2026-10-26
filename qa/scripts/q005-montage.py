# SPEC-005 구현 캡처 합치기: q005-capture.mjs가 낸 조각을 45장 이내로 묶어 qa/screenshots/005/CAP-NN.png(장당 300KB 이하)로 낸다.
# 사용: python qa/scripts/q005-montage.py <조각 폴더>
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'qa', 'screenshots', '005')
os.makedirs(OUT, exist_ok=True)
FONT = ImageFont.truetype(r'C:\Windows\Fonts\malgun.ttf', 15)
LIMIT = 300 * 1024

# (번호, 제목, [(조각 id, 캡션)], 배치: 'row' 가로 / 'grid2' 2열)
GROUPS = [
    (1, '첫 화면 1280×800 라이트(스크롤 0)', [('a01-d1280-light', '1280×800 라이트')], 'row'),
    (2, '첫 화면 360×740 · 이어서 살기 띠 1280', [('a04-m360-light', '360 첫 화면(그림은 로고 아래 배너)'), ('a11-resume-d1280', '1280 이어서 살기 띠')], 'row'),
    (3, '슬라이드 #5 격차 · #16 · #17 띠 그래프 (1280)', [('b-d1280-light-s5', '#5'), ('b-d1280-light-s16', '#16'), ('b-d1280-light-s17', '#17')], 'row'),
    (4, '슬라이드 #18·#19·#20 (1280)', [('b-d1280-light-s18', '#18'), ('b-d1280-light-s19', '#19 빗금'), ('b-d1280-light-s20', '#20 점무늬')], 'row'),
    (5, '슬라이드 강제 색상 #16·#17·#19·#20 (1280)', [('b-d1280-forced-s16', '#16'), ('b-d1280-forced-s17', '#17'), ('b-d1280-forced-s19', '#19'), ('b-d1280-forced-s20', '#20')], 'grid2'),
    (6, '자살률 슬라이드 가림·펼침 + 스위치 켜짐 (1280)', [('c14-slide-d1280-veiled', '가림'), ('c14-slide-d1280-open', '펼침'), ('c18-switch-on', '스위치 켜짐')], 'row'),
    (7, '가린 인생 기록(접힘·펼침) + 엔딩 맨 위 한 줄·가린 연표 (1280)', [('c01-rows-d1280', '가린 줄'), ('c01b-row-open', '펼친 줄'), ('c12-ending-top', '엔딩 위'), ('c13-ending-timeline', '가린 연표')], 'grid2'),
    (8, '가린 결정 카드 시트 · 인라인(자동 모드) · 접힌 띠 (1280)', [('c06-sheet-d1280', '시트'), ('c08-inline-d1280', '인라인'), ('c09-fold-d1280', '접힌 띠')], 'row'),
    (9, '가린 부모·흘러감 카드 (360 · 강제 색상)', [('c10-veiled-parent-m360', '부모 360'), ('c11-veiled-child-forced', '흘러감 강제 색상')], 'row'),
    (11, '정보 패널 1280 새 소식·소개 + 360 패널·푸터 링크(「새」 표시)', [('d01-news-d1280', '새 소식 1280'), ('d02-intro-d1280', '소개 1280'), ('d03-news-m360', '패널 360'), ('d07-foot-m360', '푸터 360')], 'grid2'),
    (13, '첫 부모 카드 1280 · 360 (라이트)', [('e03-first-d1280-light', '1280'), ('e01-first-m360-light', '360')], 'row'),
    (14, '흘러간 카드 셋', [('e06-flow1-d1280', '새 동생'), ('e06-flow2-d1280', '교실의 한 아이'), ('e06-flow3-d1280', '먼저 가야 할 사람(지난 세상)')], 'row'),
    (15, '인생 기록 줄 세 표지 + 엔딩 둘째 줄(1280)', [('e10-rows3-d1280', '기록 줄 세 표지'), ('e11-ending-top', '엔딩 위')], 'row'),
    (16, '재력 1 대 5 같은 카드 (학원·열·장학)', [('e13-school-after-hours-t1', '1단계 학원'), ('e13-school-after-hours-t5', '5단계 학원'), ('e13-infant-fever-t1', '1단계 열'), ('e13-infant-fever-t5', '5단계 열'), ('e13-school-scholarship-t1', '1단계 장학')], 'grid2'),
    (17, 'R-451 재현(기록 카드 켬, 다음 결정으로)', [('r451-a-parent', '0세 시작(4세가 부모 결정 해)'), ('r451-b-parent', '5세 기록 시트 — 부모 카드 없음'), ('r451-b-child', '5세 기록 시트 — 흘러감 카드 없음')], 'row'),
    (18, '자동 모드 13세 이후 부모 카드 · 일시정지 중 카드 · 8배속 뒤 기록', [('e14-auto-parent-d1280', '자동 모드'), ('p45-paused', '일시정지 중'), ('p45-fast', '8배속 뒤')], 'row'),
    (19, 'WebKit 첫 화면 · 부모 카드', [('w01-first-d1280', 'WebKit 첫 화면'), ('w02-parent-d1280', 'WebKit 부모 카드')], 'row'),
]


def load(i):
    p = os.path.join(SRC, i + '.png')
    return Image.open(p).convert('RGB') if os.path.exists(p) else None


def fit(img, max_w, max_h):
    r = min(max_w / img.width, max_h / img.height, 1.0)
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS) if r < 1 else img


def build(num, title, tiles, layout):
    imgs = [(load(i), cap) for i, cap in tiles]
    imgs = [(im, cap) for im, cap in imgs if im is not None]
    if not imgs:
        return None, 0
    n = len(imgs)
    cols = n if layout == 'row' else 2
    rows = 1 if layout == 'row' else (n + 1) // 2
    max_total_w = 1500
    pad = 10
    cap_h = 24
    tile_w = (max_total_w - pad * (cols + 1)) // cols
    tile_h = 900 if rows == 1 else 520
    tiles_fit = [(fit(im, tile_w, tile_h), cap) for im, cap in imgs]
    col_w = [0] * cols
    row_h = [0] * rows
    for k, (im, _) in enumerate(tiles_fit):
        r, c = divmod(k, cols)
        col_w[c] = max(col_w[c], im.width)
        row_h[r] = max(row_h[r], im.height + cap_h)
    W = sum(col_w) + pad * (cols + 1)
    H = sum(row_h) + pad * (rows + 1) + 26
    canvas = Image.new('RGB', (W, H), (236, 236, 236))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 4), f'CAP-{num:02d}  {title}', font=FONT, fill=(20, 20, 20))
    y0 = 26 + pad
    ys = []
    y = y0
    for r in range(rows):
        ys.append(y)
        y += row_h[r] + pad
    for k, (im, cap) in enumerate(tiles_fit):
        r, c = divmod(k, cols)
        x = pad + sum(col_w[:c]) + pad * c
        d.text((x, ys[r]), cap, font=FONT, fill=(60, 60, 60))
        canvas.paste(im, (x, ys[r] + cap_h))
    return canvas, n


def save(canvas, path):
    canvas.save(path, optimize=True)
    if os.path.getsize(path) <= LIMIT:
        return 'png'
    for colors in (256, 128, 64, 32):
        q = canvas.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        q.save(path, optimize=True)
        if os.path.getsize(path) <= LIMIT:
            return f'q{colors}'
    # 줄여서
    w, h = canvas.size
    for s in (0.85, 0.7, 0.55):
        c2 = canvas.resize((int(w * s), int(h * s)), Image.LANCZOS).quantize(colors=128, dither=Image.Dither.NONE)
        c2.save(path, optimize=True)
        if os.path.getsize(path) <= LIMIT:
            return f'q128x{s}'
    return 'over'


made = []
for num, (_n, title, tiles, layout) in enumerate(GROUPS, 1):
    canvas, n = build(num, title, tiles, layout)
    if canvas is None:
        print(f'CAP-{num:02d} 조각 없음 — {title}')
        continue
    path = os.path.join(OUT, f'CAP-{num:02d}.png')
    how = save(canvas, path)
    made.append((num, title, n, len(tiles), os.path.getsize(path) // 1024, how, canvas.size))
    print(f'CAP-{num:02d} {title}: 조각 {n}/{len(tiles)} {os.path.getsize(path) // 1024}KB {how} {canvas.size}')
json.dump(made, open(os.path.join(SRC, '_montage.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('총', len(made), '장, 300KB 초과', sum(1 for m in made if m[4] > 300))

/**
 * SPEC-009 집과 가족 그림 — FM5 조각 보강 33 (designer 2026-10-28).
 *
 * developer가 FM5를 구현해 보니 안 그린 조각 33이 `stand`(가장 가까운 그려진 조각)로 대신 그려져 「2000년대 단독이 옛 셋방 집으로」처럼 시대가 어긋났다(`ai-log/2026-10-28_SPEC-009_dev-FM5.md` 4절).
 * 여기서 `src/data/sceneTables.ts`의 `drawn: false` 조각 전부를 그린다 — 배경 7(해안 3 포함) · 집 18(요양 시설 1 포함) · 소품 5 · 반려동물 3.
 * 규칙은 `docs/design/family-scene.md` 1·2절(좌표계 640×256 · 지면선 y 200 · 집 원점 (0, 200) · 상자 `box` · 슬롯 `window`/`porch`)과 FM2d 그림체 s1 「종이 오림」(선 없음 · 평면 조각 + (3,3) 밀린 그림자 · 얼굴 없음 · 색은 `--c-scene-*` 토큰만 · 글자·상호·브랜드 0).
 * 상자와 연도는 sceneTables의 값과 같다(집은 그 표의 `HOUSE_DRAWN`에 새 상자·슬롯을 적어야 한다 — 아래 `box`·`slots`를 그대로). 점유 형태(자가·임차)는 그리지 않는다(FH2 ③). 가난·부유를 색으로 표시하지 않는다(DF14) — 주택 이외의 거처(`shack`)도 빨래·화분·신발이 있는 사는 집으로.
 * 사용: `buildFamilyMockups.mjs`가 `PIECES`에 붙여 `pieces/s1/<id>.svg`·`pieces.html`·`budget.json`을 만들고, `buildFm5Pieces.mjs`가 시대 밴드별 시트 `fm5-pieces.html`을 만든다. developer는 `npm run gen:art`로 `pieces.json`에 옮긴다(이 파일은 `src/`를 읽지 않는다).
 */
import { T, r1 } from './familyPieceLib.mjs';

// ---------------------------------------------------------------- 공용 조각 도우미(집)
/** 창: 유리 + 십자 창살(가로 1·세로 1). bars 0이면 창살 없음 */
const win = (h, x, y, w, hh, bars = 2, frame = 'roof2') => h.rect(x, y, w, hh, T('glass')) + (bars ? h.stroke(`M ${r1(x + w / 2)},${y} V ${r1(y + hh)} M ${x},${r1(y + hh / 2)} H ${r1(x + w)}`, bars, frame) : '');
/** 문(한 짝) + 손잡이 자리 */
const door = (h, x, y, w, hh, tok = 'wood') => h.rect(x, y, w, hh, T(tok));
/** 패턴 한 장(조각 안 <defs>) — svgNodes가 id에 인스턴스 접두어를 붙인다. 참조는 `<g transform=translate>` 안의 rect(0,0)이라 패턴 원점이 그 자리에 맞는다(family-scene.md 4절 반복 도형 줄이기) */
const pat = (id, w, hh, inner) => `<defs><pattern id="${id}" width="${w}" height="${hh}" patternUnits="userSpaceOnUse">${inner}</pattern></defs>`;
const fillAt = (id, x, y, w, hh) => `<g transform="translate(${x} ${y})"><rect width="${r1(w)}" height="${r1(hh)}" fill="url(#${id})"/></g>`;
/** 난간(패턴): 윗봉 + 세로살. 조각마다 패턴 하나(`${s}-rl`) — 첫 호출(first)이 defs를 낸다 */
const railP = (h, s, x, y, w, hh, step = 10, first = false) => (first ? pat(`${s}-rl`, step, 40, `<rect x="${step / 2 - 0.8}" width="1.6" height="40" fill="${T('roof2')}"/>`) : '') + h.rect(x, y, w, 1.6, T('roof2'), { flat: true }) + fillAt(`${s}-rl`, x, y, w, hh);
/** 셔터: 면 + 가로줄 */
const shutter = (h, x, y, w, hh, tok = 'wall2') => { let d = ''; for (let yy = y + 6; yy < y + hh; yy += 7) d += `M ${x},${r1(yy)} H ${r1(x + w)} `; return h.rect(x, y, w, hh, T(tok)) + h.stroke(d.trim(), 1.5, 'far'); };
/** 차양(줄무늬 — 글자 없음) */
const awning = (h, x, y, w, d = 16, a = 'cloth4', b = 'cloth3') => { const n = Math.max(3, Math.round(w / 24)); const sw = w / n; let s = ''; for (let i = 0; i < n; i++) s += h.path(`M ${r1(x + i * sw)},${y} L ${r1(x + (i + 1) * sw)},${y} L ${r1(x + (i + 1) * sw + 2)},${r1(y + d)} L ${r1(x + i * sw + 2)},${r1(y + d)} Z`, T(i % 2 ? b : a), { flat: true }); return s; };
/** 기와 물결(패턴) — 조각마다 패턴 하나(`${s}-tl`, 한 장 16 단위). 첫 호출(first)이 defs를 낸다 */
const tilesP = (s, x0, x1, y, first = false) => (first ? pat(`${s}-tl`, 16, 8, `<path d="M0,0a8,8 0 0 0 16,0Z" fill="${T('roof2')}"/>`) : '') + fillAt(`${s}-tl`, x0, y, x1 - x0, 8);
/** 기와 지붕(사다리꼴 + 용마루 + 처마 물결) — 밀린 그림자는 본채 지붕에만(shade) */
const tileRoof = (h, s, x0, x1, yEave, yRidge, inset = 32, first = false, shade = false) => h.path(`M ${x0},${yEave} L ${x0 + inset},${yRidge} L ${x1 - inset},${yRidge} L ${x1},${yEave} Z`, T('roof'), { shade }) + h.rect(x0 + inset, yRidge - 3, x1 - x0 - inset * 2, 5, T('roof2'), { rx: 1 }) + h.rect(x0, yEave - 3, x1 - x0, 6, T('roof2'), { rx: 1 }) + tilesP(s, x0 + 2, x1 - 2, yEave + 3, first);
/** 창 줄(패턴): 같은 창이 step마다 — 아파트·요양 시설. first가 defs를 낸다 */
const winRowP = (s, key, w, hh, step) => pat(`${s}-${key}`, step, hh + 40, `<rect width="${w}" height="${hh}" fill="${T('glass')}"/><path d="M${w / 2},0V${hh}M0,${hh / 2}H${w}" fill="none" stroke="${T('roof2')}" stroke-width="1.5"/>`);
const winRowAt = (s, key, x, y, w, hh) => fillAt(`${s}-${key}`, x, y, w, hh);
/** 창호(문살) */
const lattice = (h, x, y, w, hh) => h.rect(x, y, w, hh, T('cloth3')) + h.stroke(`M ${r1(x + w / 2)},${y} V ${r1(y + hh)} M ${x},${r1(y + hh / 3)} H ${r1(x + w)} M ${x},${r1(y + (2 * hh) / 3)} H ${r1(x + w)}`, 1.5, 'wood');
/** 화분(작은) */
const pot = (h, x, y, s = 1) => h.path(`M${r1(x - 6 * s)},${y}L${r1(x - 4.5 * s)},${r1(y - 8 * s)}H${r1(x + 4.5 * s)}L${r1(x + 6 * s)},${y}Z`, T('clay'), { flat: true }) + h.ellipse(x, y - 11.5 * s, 7 * s, 4.6 * s, T('green'), { flat: true });
/** 신발 한 켤레(문 앞) */
const shoes = (h, x, y, tok = 'roof2') => h.rect(x, y - 3, 7, 3, T(tok), { flat: true, rx: 1.5 }) + h.rect(x + 8, y - 3, 7, 3, T(tok), { flat: true, rx: 1.5 });
/** 빨랫줄 + 빨래 셋(소품 prop-laundry보다 작은 집 붙박이) */
const washLine = (h, x0, y0, x1, y1, toks = ['cloth3', 'cloth4', 'cloth3']) => h.stroke(`M ${x0},${y0} Q ${r1((x0 + x1) / 2)},${r1(Math.max(y0, y1) + 4)} ${x1},${y1}`, 1.5) + toks.map((t, i) => { const k = (i + 1) / (toks.length + 1); const x = x0 + (x1 - x0) * k; const y = y0 + (y1 - y0) * k + 3; return h.rect(r1(x - 5), r1(y), 10, 12 + (i % 2) * 4, T(t), { flat: true, rx: 1 }); }).join('');
/** 나무(마당 — prop-tree보다 작게) */
const tree = (h, x, y, s = 1) => h.rect(x - 2.5 * s, y - 30 * s, 5 * s, 30 * s, T('wood'), { rx: 1 }) + h.circle(x, y - 42 * s, 15 * s, T('green'), { shade: true }) + h.circle(x - 10 * s, y - 34 * s, 9 * s, T('green')) + h.circle(x + 10 * s, y - 35 * s, 9 * s, T('green'));
/** 먼 지붕선(배경) — step 간격, 높이 배열, 상대 좌표. 640에서 정확히 끝난다(상자 안) */
const roofline = (h, y, step, hs, tok = 'far') => { let d = `M0,${y}`; const n = Math.floor(640 / step); const hw = step / 2; for (let i = 0; i < n; i++) d += `l${hw},-${hs[i % hs.length]}l${hw},${hs[i % hs.length]}`; const rest = 640 - n * step; if (rest > 0) d += `h${rest}`; d += `V200H0Z`; return h.path(d, T(tok), { flat: true }); };
const GROUND = (h, bands = [[238, 18]]) => h.rect(0, 200, 640, 56, T('ground'), { flat: true }) + bands.map(([y, hh]) => h.rect(0, y, 640, hh, T('ground2'), { flat: true })).join('');
/** 바다(수평선 y부터 지면선까지) + 물결 띠 둘 */
const sea = (h, y) => h.rect(0, y, 640, 200 - y, T('far'), { flat: true }) + h.rect(0, y + 14, 640, 3, T('far2'), { flat: true }) + h.rect(0, y + 34, 640, 2, T('far2'), { flat: true }) + h.rect(0, y + 58, 640, 2, T('far2'), { flat: true });
/** 작은 배(옆, 먼) */
const boat = (h, x, y, w = 28, tok = 'roof2') => h.path(`M ${x},${y} L ${x + w},${y} L ${x + w - 5},${y + 6} L ${x + 5},${y + 6} Z`, T(tok), { flat: true }) + h.rect(x + w * 0.4, y - 6, 4, 6, T(tok), { flat: true });
/** 항만 크레인(실루엣) */
const crane = (h, x, y, s = 1, tok = 'far') => h.rect(x, y - 70 * s, 10 * s, 70 * s, T(tok), { flat: true }) + h.rect(x + 30 * s, y - 70 * s, 10 * s, 70 * s, T(tok), { flat: true }) + h.rect(x - 30 * s, y - 78 * s, 110 * s, 8 * s, T(tok), { flat: true }) + h.rect(x + 2 * s, y - 92 * s, 8 * s, 14 * s, T(tok), { flat: true }) + h.rect(x - 6 * s, y - 26 * s, 52 * s, 6 * s, T(tok), { flat: true });

const B = (n) => (n === 1 ? [1940, 1969] : n === 2 ? [1970, 1999] : [2000, null]);

export const PIECES_FM5 = [
  // ════════════════════════════════════════════════════════════════ 배경 7 (상자 [0,0,640,256] 고정 — 하늘 0~200 · 땅 200~256)
  { id: 'bg-metro-b1', layer: '배경', band: 1, years: B(1), box: [0, 0, 640, 256], note: '~1969 대도시 — 먼 능선 앞에 2~3층 건물 몇과 촘촘한 낮은 지붕선, 굴뚝 하나', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,120 Q 100,70 190,106 Q 280,74 380,100 Q 470,66 560,98 Q 600,90 640,104 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    h.rect(96, 126, 64, 74, T('far'), { flat: true }), h.rect(262, 118, 56, 82, T('far'), { flat: true }), h.rect(438, 130, 84, 70, T('far'), { flat: true }), h.rect(292, 102, 6, 18, T('far'), { flat: true }),
    roofline(h, 166, 32, [10, 6, 12, 8, 14, 7]),
    GROUND(h),
  ].join('') },
  { id: 'bg-town-b2', layer: '배경', band: 2, years: B(2), box: [0, 0, 640, 256], note: '1970~1999 중소도시 — 능선 + 3~4층 저층 건물 띠(창 패턴) + 지붕선', draw: (h, s) => {
    const pid = `${s}-tw2`;
    const blocks = [[20, 128, 70], [150, 118, 56], [300, 134, 80], [450, 122, 62], [560, 130, 70]];
    return [
      h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
      h.path('M 0,118 Q 110,66 200,104 Q 280,72 380,98 Q 470,60 560,94 Q 600,86 640,98 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
      `<defs><pattern id="${pid}" width="14" height="14" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="8" height="6" fill="${T('far2')}"/></pattern></defs>`,
      ...blocks.map(([x, y, w]) => h.rect(x, y, w, 200 - y, T('far'), { flat: true }) + `<rect x="${x + 3}" y="${y + 4}" width="${w - 6}" height="${196 - y}" fill="url(#${pid})"/>`),
      roofline(h, 172, 32, [8, 12, 6, 10]),
      GROUND(h),
    ].join('');
  } },
  { id: 'bg-rural-b2', layer: '배경', band: 2, years: B(2), box: [0, 0, 640, 256], note: '1970~1999 농촌 — 산 2겹 + 논둑 띠 + 먼 마을(슬래브 지붕)과 전신주 줄(비닐하우스는 소품 prop-plastic-greenhouse 1980~가 맡는다)', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,124 Q 80,78 160,110 Q 240,72 330,104 Q 420,68 520,102 Q 580,84 640,106 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    h.path('M 0,152 Q 70,130 150,148 Q 240,122 340,144 Q 440,126 530,148 Q 590,136 640,150 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    h.rect(470, 158, 40, 14, T('far2'), { flat: true }), h.rect(516, 156, 30, 16, T('far2'), { flat: true }), h.rect(552, 160, 44, 12, T('far2'), { flat: true }),
    h.rect(60, 150, 3, 50, T('far'), { flat: true }), h.rect(200, 154, 3, 46, T('far'), { flat: true }), h.rect(340, 150, 3, 50, T('far'), { flat: true }), h.stroke('M 61,154 Q 130,162 201,158 Q 270,162 341,154', 1, 'far'),
    GROUND(h, [[212, 3], [224, 3], [238, 18]]),
  ].join('') },
  { id: 'bg-rural-b3', layer: '배경', band: 3, years: B(3), box: [0, 0, 640, 256], note: '2000~ 농촌 — 산 + 논둑 + 먼 축사·창고(긴 박공 지붕)', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,122 Q 90,74 170,108 Q 250,70 340,102 Q 430,66 520,100 Q 580,84 640,104 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    h.path('M 0,154 Q 80,132 160,150 Q 250,126 350,146 Q 450,128 540,150 Q 600,138 640,152 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    h.path('M 380,176 L 380,158 L 470,152 L 560,158 L 560,176 Z', T('far2'), { flat: true }), h.path('M 372,160 L 470,148 L 568,160 Z', T('far'), { flat: true }),
    h.path('M 70,180 L 70,164 L 130,160 L 190,164 L 190,180 Z', T('far2'), { flat: true }), h.path('M 64,166 L 130,156 L 196,166 Z', T('far'), { flat: true }),
    GROUND(h, [[214, 3], [226, 3], [238, 18]]),
  ].join('') },
  { id: 'bg-coast-b1', layer: '배경', band: 1, years: B(1), box: [0, 0, 640, 256], note: '~1969 바닷가 — 수평선 + 먼 섬 + 돛 없는 작은 배 둘', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 410,120 Q 450,96 500,106 Q 540,112 560,120 Z', T('far2'), { flat: true }), h.path('M 90,120 Q 120,108 150,120 Z', T('far2'), { flat: true }),
    sea(h, 120), boat(h, 220, 142, 26), boat(h, 420, 158, 34),
    GROUND(h, [[204, 3], [238, 18]]),
  ].join('') },
  { id: 'bg-coast-b2', layer: '배경', band: 2, years: B(2), box: [0, 0, 640, 256], note: '1970~1999 바닷가 — 수평선 + 방파제와 작은 등대 + 배 하나', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 40,118 Q 80,100 130,110 Q 160,114 180,118 Z', T('far2'), { flat: true }),
    sea(h, 118), boat(h, 150, 150, 30),
    h.rect(360, 156, 280, 12, T('wall2'), { flat: true }), h.rect(360, 166, 280, 6, T('far2'), { flat: true }), h.rect(596, 132, 12, 26, T('wall'), { flat: true }), h.rect(594, 128, 16, 6, T('clay'), { flat: true }),
    GROUND(h, [[204, 3], [238, 18]]),
  ].join('') },
  { id: 'bg-coast-b3', layer: '배경', band: 3, years: B(3), box: [0, 0, 640, 256], note: '2000~ 바닷가 — 수평선 + 항만 크레인 실루엣 둘 + 컨테이너 더미 + 먼 배', draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    sea(h, 116),
    h.rect(300, 136, 120, 12, T('far2'), { flat: true }), h.rect(330, 128, 60, 8, T('far2'), { flat: true }),
    h.rect(380, 150, 260, 22, T('far2'), { flat: true }), h.rect(400, 140, 50, 10, T('far'), { flat: true }), h.rect(470, 138, 60, 12, T('far'), { flat: true }), h.rect(560, 142, 44, 8, T('far'), { flat: true }),
    crane(h, 440, 172, 1), crane(h, 560, 172, 0.8),
    GROUND(h, [[204, 3], [238, 18]]),
  ].join('') },

  // ════════════════════════════════════════════════════════════════ 집 18 (원점 (0, 200) — 상자 y는 위로 음수 · 폭 ≤ 404)
  { id: 'house-detached-h2', layer: '집', band: 2, years: B(2), box: [-4, -130, 372, 130], slots: { window: [111, -52], porch: null }, note: '1970~1999 단독주택 — 슬래브 양옥, 담과 철제 대문, 보일러 굴뚝, 화단', draw: (h) => [
    h.rect(0, -54, 52, 54, T('wall2')), h.rect(-2, -60, 56, 7, T('roof'), { rx: 1 }),
    h.rect(12, -50, 32, 50, T('roof2')), h.stroke('M 19,-46 V -4 M 28,-46 V -4 M 37,-46 V -4', 1.5, 'far'),
    h.rect(60, -104, 250, 104, T('wall'), { shade: true }),
    h.rect(52, -114, 266, 11, T('roof'), { shade: true }), h.rect(52, -118, 266, 5, T('roof2'), { rx: 1 }),
    h.rect(290, -130, 8, 20, T('roof2'), { rx: 1 }),
    win(h, 84, -88, 54, 36), win(h, 232, -88, 54, 36),
    h.rect(166, -90, 58, 6, T('roof2'), { rx: 1 }), door(h, 176, -82, 38, 82, 'wood'), h.rect(182, -74, 26, 16, T('glass'), { flat: true }),
    h.rect(60, -8, 110, 8, T('ground2')), h.rect(230, -8, 80, 8, T('ground2')), pot(h, 250, -8, 0.8), pot(h, 280, -8, 0.7),
  ].join('') },
  { id: 'house-detached-h3', layer: '집', band: 3, years: B(3), box: [-4, -170, 372, 170], slots: { window: [119, -22], porch: null }, note: '2000~ 단독주택 — 2층, 경사 지붕, 주차 공간(차양), 현관 계단', draw: (h, s) => [
    h.rect(0, -100, 70, 8, T('roof2')), h.rect(4, -92, 6, 92, T('wall2')), h.rect(60, -92, 6, 92, T('wall2')), h.rect(0, -6, 70, 6, T('ground2')),
    h.rect(78, -140, 232, 140, T('wall'), { shade: true }),
    h.path('M 66,-140 L 194,-168 L 322,-140 Z', T('roof'), { shade: true }), h.rect(66, -143, 256, 6, T('roof2'), { rx: 1 }),
    win(h, 94, -126, 50, 34), win(h, 240, -126, 50, 34), h.rect(176, -128, 36, 36, T('glass')), h.stroke('M 194,-128 V -92', 1.5), h.rect(168, -92, 52, 4, T('wall2')), railP(h, s, 168, -112, 52, 20, 8, true),
    win(h, 94, -60, 56, 38), win(h, 236, -60, 56, 38),
    h.rect(164, -74, 60, 6, T('roof2'), { rx: 1 }), door(h, 176, -66, 36, 66, 'roof'), h.rect(182, -58, 24, 22, T('glass'), { flat: true }),
    h.rect(166, -8, 56, 8, T('wall2')), pot(h, 300, -6, 0.8),
  ].join('') },
  { id: 'house-detached-rent-h1', layer: '집', band: 1, years: B(1), box: [-4, -130, 372, 130], slots: { window: [118, -34], porch: [260, -14] }, note: '~1969 셋방이 있는 단독(문간방) — 기와 본채와 마루, 대문 옆 문간방(따로 난 쪽문·작은 창·굴뚝), 담', draw: (h, s) => [
    h.rect(0, -40, 60, 40, T('wall2')), h.rect(-2, -46, 64, 6, T('roof'), { rx: 1 }), tilesP(s, 0, 60, -43, true),
    h.rect(14, -38, 32, 38, T('wood')), h.stroke('M 30,-38 V 0 M 14,-20 H 46', 1.5, 'clay'),
    h.rect(60, -70, 92, 70, T('wall2'), { shade: true }), tileRoof(h, s, 54, 158, -70, -92, 18), h.rect(140, -102, 6, 20, T('clay'), { rx: 1 }),
    door(h, 68, -56, 22, 56, 'wood'), lattice(h, 100, -60, 36, 26), shoes(h, 70, 0, 'cloth3'),
    h.rect(160, -96, 200, 96, T('wall'), { shade: true }), h.rect(160, -12, 200, 12, T('ground2')),
    h.rect(214, -82, 92, 70, T('wood')), h.stroke('M 214,-64 H 306 M 214,-46 H 306 M 214,-28 H 306', 1.5, 'clay'), h.rect(210, -88, 6, 76, T('clay')), h.rect(304, -88, 6, 76, T('clay')),
    lattice(h, 170, -84, 36, 40), lattice(h, 316, -84, 36, 40), lattice(h, 226, -84, 30, 30), lattice(h, 266, -84, 30, 30),
    tileRoof(h, s, 150, 370, -96, -124, 34, false, true),
  ].join('') },
  { id: 'house-detached-rent-h3', layer: '집', band: 3, years: B(3), box: [0, -180, 340, 180], slots: { window: [60, -64], porch: null }, note: '2000~ 다가구 단독 — 3층 벽돌, 바깥 계단, 층마다 현관, 가스관', draw: (h, s) => [
    h.rect(10, -168, 270, 168, T('clay'), { shade: true }), h.rect(4, -176, 282, 9, T('wall2'), { rx: 1 }),
    ...[-150, -98, -46].map((y) => win(h, 30, y, 60, 34) + win(h, 170, y, 60, 34) + h.rect(10, y + 44, 270, 5, T('wall2'), { flat: true })),
    door(h, 244, -150, 28, 44, 'roof2'), door(h, 244, -98, 28, 44, 'roof2'), door(h, 244, -46, 28, 42, 'roof2'),
    h.rect(282, -168, 52, 168, T('wall2')), h.stroke('M 286,-20 L 330,-60 M 330,-60 H 286 M 286,-72 L 330,-112 M 330,-112 H 286 M 286,-124 L 330,-164', 2, 'wall'),
    railP(h, s, 284, -40, 48, 20, 12, true), railP(h, s, 284, -92, 48, 20, 12), railP(h, s, 284, -144, 48, 20, 12),
    h.stroke('M 20,-168 V -6', 1.5, 'wall2'), h.rect(282, -8, 52, 8, T('ground2')),
  ].join('') },
  { id: 'house-multi-h1', layer: '집', band: 1, years: B(1), box: [0, -124, 320, 124], slots: { window: [130, -62], porch: null }, note: '~1969 연립(2층 — 설계값) — 기와 지붕, 현관 둘, 2층 창 넷', draw: (h, s) => [
    h.rect(10, -100, 300, 100, T('wall2'), { shade: true }), h.rect(10, -52, 300, 4, T('wall'), { flat: true }),
    tileRoof(h, s, 0, 320, -100, -120, 26, true, true),
    win(h, 40, -90, 40, 28), win(h, 110, -90, 40, 28), win(h, 170, -90, 40, 28), win(h, 240, -90, 40, 28),
    door(h, 60, -46, 30, 46, 'wood'), door(h, 230, -46, 30, 46, 'wood'), win(h, 110, -40, 40, 26), win(h, 170, -40, 40, 26),
    h.rect(52, -6, 46, 6, T('ground2')), h.rect(222, -6, 46, 6, T('ground2')), shoes(h, 94, 0, 'cloth3'),
  ].join('') },
  { id: 'house-multi-h2', layer: '집', band: 2, years: B(2), box: [0, -150, 330, 150], slots: { window: [53, -54], porch: null }, note: '1970~1999 연립 — 3층, 가운데 발코니와 난간, 계단실 현관', draw: (h, s) => [
    h.rect(10, -140, 300, 140, T('wall'), { shade: true }), h.rect(4, -146, 312, 8, T('roof2'), { rx: 1 }),
    ...[-140, -94, -48].map((y, i) => win(h, 26, y + 10, 54, 30) + win(h, 230, y + 10, 54, 30) + win(h, 130, y + 6, 50, 36, 2) + h.rect(96, y + 40, 118, 6, T('wall2'), { flat: true }) + railP(h, s, 98, y + 16, 114, 24, 10, i === 0)),
    door(h, 140, -48, 36, 48, 'roof2'), h.rect(134, -6, 48, 6, T('ground2')),
  ].join('') },
  { id: 'house-apt-h1', layer: '집', band: 1, years: B(1), box: [0, -130, 400, 130], slots: { window: [30, -8], porch: null }, note: '~1969 초기 저층 아파트(설계값) — 3층 민무늬 블록, 작은 창 줄, 현관 둘과 계단실 창', draw: (h, s) => {
    const row = (y) => winRowAt(s, 'w', 16, y, 48, 24) + winRowAt(s, 'w', 112, y, 192, 24) + winRowAt(s, 'w', 352, y, 48, 24);
    return [
      h.rect(0, -124, 400, 124, T('wall'), { shade: true }), h.rect(0, -130, 400, 8, T('wall2'), { rx: 1 }),
      winRowP(s, 'w', 28, 24, 48), row(-112), row(-72), row(-32),
      h.rect(70, -118, 16, 78, T('glass')), h.rect(302, -118, 16, 78, T('glass')), door(h, 64, -40, 28, 40, 'roof2'), door(h, 296, -40, 28, 40, 'roof2'),
      h.rect(58, -6, 40, 6, T('ground2')), h.rect(290, -6, 40, 6, T('ground2')),
    ].join('');
  } },
  { id: 'house-apt-h2', layer: '집', band: 2, years: B(2), box: [0, -196, 400, 196], slots: { window: [35, -14], porch: null }, note: '1970~1999 복도식 아파트 — 5층 판상, 층마다 복도 난간(패턴), 계단탑', draw: (h, s) => {
    const pid = `${s}-rail`;
    const floor = (y) => fillAt(`${s}-u`, 20, y + 2, 152, 32) + fillAt(`${s}-u`, 236, y + 2, 152, 32) + h.rect(0, y + 16, 400, 2, T('roof2'), { flat: true }) + `<rect x="0" y="${y + 16}" width="400" height="20" fill="url(#${pid})"/>` + h.rect(0, y + 36, 400, 3, T('wall2'), { flat: true });
    return [
      `<defs><pattern id="${pid}" width="12" height="20" patternUnits="userSpaceOnUse"><rect x="5" y="0" width="1.6" height="20" fill="${T('roof2')}"/></pattern><pattern id="${s}-u" width="76" height="40" patternUnits="userSpaceOnUse"><rect y="2" width="30" height="20" fill="${T('glass')}"/><path d="M15,2V22M0,12H30" fill="none" stroke="${T('roof2')}" stroke-width="1.5"/><rect x="34" width="16" height="30" fill="${T('roof2')}"/></pattern></defs>`,
      h.rect(0, -190, 400, 190, T('wall'), { shade: true }), h.rect(0, -196, 400, 8, T('wall2'), { rx: 1 }),
      ...[-190, -152, -114, -76, -38].map(floor),
      h.rect(180, -194, 40, 194, T('wall2'), { flat: true }), ...[-176, -138, -100, -62, -24].map((y) => h.rect(192, y, 16, 16, T('glass'), { flat: true })),
      door(h, 186, -34, 28, 34, 'roof2'),
    ].join('');
  } },
  { id: 'house-shack-h1', layer: '집', band: 1, years: B(1), box: [0, -100, 260, 100], slots: { window: [55, -34], porch: null }, note: '~1969 주택 이외의 거처 — 널빤지 벽과 루핑 지붕, 깡통 굴뚝. 낙인 없이 사는 집으로: 빨래·화분·문 앞 신발', draw: (h) => [
    h.rect(20, -70, 200, 70, T('wood'), { shade: true }), h.stroke('M 20,-60 H 220 M 20,-48 H 220 M 20,-36 H 220 M 20,-24 H 220 M 20,-12 H 220', 1.5, 'clay'),
    h.path('M 10,-70 L 20,-88 L 232,-82 L 228,-70 Z', T('roof2'), { shade: true }), h.rect(190, -100, 8, 22, T('wall2'), { rx: 1 }),
    door(h, 100, -60, 34, 60, 'clay'), win(h, 40, -56, 30, 22, 1.5, 'wood'), h.rect(96, -6, 42, 6, T('wall2')), shoes(h, 104, 0, 'cloth3'),
    washLine(h, 224, -62, 258, -58, ['cloth3', 'cloth4']), pot(h, 30, 0, 0.8), pot(h, 232, 0, 0.7),
  ].join('') },
  { id: 'house-shack-h2', layer: '집', band: 2, years: B(2), box: [0, -104, 270, 104], slots: { window: [53, -32], porch: null }, note: '1970~1999 주택 이외의 거처 — 블록 벽과 슬레이트 지붕, 연탄 굴뚝. 빨래·화분·대야·신발', draw: (h) => [
    h.rect(20, -72, 212, 72, T('wall2'), { shade: true }), h.stroke('M 20,-54 H 232 M 20,-36 H 232 M 20,-18 H 232 M 70,-72 V -54 M 130,-54 V -36 M 90,-36 V -18 M 180,-72 V -54', 1.2, 'wall'),
    h.path('M 8,-72 L 16,-92 L 242,-86 L 238,-72 Z', T('roof'), { shade: true }), h.stroke('M 20,-82 Q 60,-78 100,-82 Q 140,-86 180,-81 Q 210,-78 236,-80', 1.5, 'roof2'), h.rect(200, -106, 7, 30, T('roof2'), { rx: 1 }),
    door(h, 96, -62, 36, 62, 'roof2'), h.rect(102, -54, 24, 14, T('glass'), { flat: true }), win(h, 36, -58, 34, 26, 1.5, 'wood'),
    h.rect(92, -6, 44, 6, T('wall2')), shoes(h, 100, 0), h.ellipse(160, -4, 12, 4, T('hairw')), washLine(h, 236, -64, 268, -60, ['cloth4', 'cloth3']), pot(h, 30, 0, 0.8), pot(h, 180, 0, 0.7),
  ].join('') },
  { id: 'house-shack-h3', layer: '집', band: 3, years: B(3), box: [0, -104, 280, 104], slots: { window: [155, -36], porch: null }, note: '2000~ 주택 이외의 거처(컨테이너 — FD14 범위 안에서만) — 골 벽(패턴), 차양 단 문, 계단, 화분 줄', draw: (h, s) => {
    const pid = `${s}-rib`;
    return [
      `<defs><pattern id="${pid}" width="14" height="10" patternUnits="userSpaceOnUse"><rect x="4" y="0" width="3" height="10" fill="${T('roof')}" opacity=".35"/></pattern></defs>`,
      h.rect(20, -82, 222, 82, T('cloth4'), { shade: true }), `<rect x="20" y="-82" width="222" height="82" fill="url(#${pid})"/>`, h.rect(14, -88, 234, 7, T('roof2'), { rx: 1 }),
      h.rect(38, -78, 46, 6, T('roof2'), { rx: 1 }), door(h, 44, -72, 34, 72, 'roof2'), h.rect(50, -64, 22, 18, T('glass'), { flat: true }),
      win(h, 130, -66, 50, 30, 2, 'wall2'), h.rect(40, -10, 42, 10, T('wall2')), h.rect(40, -5, 42, 5, T('wall2'), { flat: true }), shoes(h, 86, 0),
      pot(h, 200, 0, 0.9), pot(h, 222, 0, 0.7), pot(h, 262, 0, 0.8),
    ].join('');
  } },
  { id: 'house-other-h1', layer: '집', band: 1, years: B(1), box: [-4, -130, 372, 130], slots: { window: [252, -40], porch: null }, note: '~1969 가게 딸린 집 — 기와 지붕 아래 미닫이 유리문 가게(빈 간판 판·줄무늬 차양)와 뒤쪽 방의 창호', draw: (h, s) => [
    h.rect(20, -96, 330, 96, T('wall'), { shade: true }), tileRoof(h, s, 8, 362, -96, -124, 34, true, true),
    h.rect(40, -92, 140, 14, T('wall2')), awning(h, 24, -78, 172, 14),
    h.rect(40, -64, 140, 64, T('glass')), h.stroke('M 86,-64 V 0 M 132,-64 V 0 M 40,-34 H 180', 2, 'wood'), h.rect(36, -66, 148, 4, T('wood'), { flat: true }),
    h.rect(48, -22, 30, 10, T('clay'), { flat: true }), h.rect(94, -26, 30, 14, T('cloth4'), { flat: true }), h.rect(140, -20, 30, 8, T('wall2'), { flat: true }),
    lattice(h, 230, -80, 44, 40), door(h, 292, -70, 40, 70, 'wood'), h.rect(286, -6, 52, 6, T('ground2')), shoes(h, 298, 0, 'cloth3'),
  ].join('') },
  { id: 'house-other-h2', layer: '집', band: 2, years: B(2), box: [0, -150, 340, 150], slots: { window: [66, -92], porch: null }, note: '1970~1999 가게 딸린 집 — 2층 슬래브, 1층 가게는 셔터와 차양(글자 0), 집 출입문은 옆에', draw: (h) => [
    h.rect(10, -144, 320, 144, T('wall'), { shade: true }), h.rect(4, -150, 332, 8, T('roof'), { rx: 1 }),
    win(h, 36, -128, 60, 36), win(h, 136, -128, 60, 36), win(h, 236, -128, 60, 36), h.rect(10, -88, 320, 4, T('wall2'), { flat: true }),
    shutter(h, 30, -78, 170, 78), awning(h, 24, -84, 182, 12, 'clay', 'cloth3'), h.rect(30, -82, 170, 4, T('roof2'), { flat: true }),
    door(h, 240, -80, 40, 80, 'wood'), win(h, 292, -78, 30, 30), h.rect(234, -6, 52, 6, T('ground2')),
  ].join('') },
  { id: 'house-other-h3', layer: '집', band: 3, years: B(3), box: [0, -180, 340, 180], slots: { window: [75, -76], porch: null }, note: '2000~ 상가주택 — 1층 유리 가게(빈 간판 판·차양), 2~3층 집 창과 발코니, 옆 계단 출입문', draw: (h, s) => [
    h.rect(10, -170, 320, 170, T('wall'), { shade: true }), h.rect(4, -176, 332, 8, T('wall2'), { rx: 1 }),
    win(h, 40, -156, 70, 36), win(h, 150, -156, 70, 36), win(h, 250, -156, 60, 36),
    win(h, 40, -112, 70, 36), win(h, 150, -112, 70, 36), win(h, 250, -112, 60, 36), h.rect(36, -78, 190, 5, T('wall2'), { flat: true }), railP(h, s, 38, -96, 186, 18, 12, true),
    h.rect(26, -66, 210, 16, T('wall2')), h.rect(20, -50, 222, 5, T('roof2'), { rx: 1 }),
    h.rect(26, -46, 210, 46, T('glass')), h.stroke('M 96,-46 V 0 M 166,-46 V 0 M 26,-46 H 236', 2), h.rect(180, -42, 2, 42, T('roof2'), { flat: true }), h.rect(210, -26, 2, 10, T('roof2'), { flat: true }),
    door(h, 256, -60, 36, 60, 'roof2'), h.rect(300, -40, 14, 18, T('wall2'), { flat: true }), h.rect(250, -6, 48, 6, T('ground2')),
  ].join('') },
  { id: 'house-estate-h1', layer: '집', band: 1, years: B(1), box: [-4, -150, 404, 150], slots: { window: [70, -66], porch: [160, -50] }, note: '~1969 큰 집(수저 최상 + 자가) — 솟을대문과 긴 담, 기와 본채(대청·창호)와 별채', draw: (h, s) => [
    h.rect(30, -118, 262, 68, T('wall'), { shade: true }), h.rect(120, -112, 80, 62, T('wood')), h.stroke('M 120,-96 H 200 M 120,-80 H 200 M 120,-64 H 200', 1.5, 'clay'), h.rect(116, -116, 6, 66, T('clay')), h.rect(198, -116, 6, 66, T('clay')),
    lattice(h, 50, -110, 40, 44), lattice(h, 230, -110, 40, 44), tileRoof(h, s, 16, 304, -118, -148, 40, true, true),
    h.rect(300, -98, 90, 48, T('wall')), lattice(h, 326, -92, 36, 36), tileRoof(h, s, 288, 400, -98, -122, 22),
    h.rect(0, -50, 400, 50, T('wall2')), h.rect(-2, -56, 404, 8, T('roof'), { rx: 1 }), tilesP(s, 0, 400, -53),
    h.rect(150, -90, 60, 90, T('wall')), h.rect(158, -70, 22, 70, T('wood')), h.rect(180, -70, 22, 70, T('wood')), h.stroke('M 180,-70 V 0', 1.5, 'clay'),
    tileRoof(h, s, 140, 220, -90, -112, 16),
    h.rect(0, -6, 400, 6, T('ground2')), tree(h, 370, -50, 0.8),
  ].join('') },
  { id: 'house-estate-h2', layer: '집', band: 2, years: B(2), box: [-4, -170, 404, 170], slots: { window: [145, -26], porch: null }, note: '1970~1999 큰 집 — 2층 양옥, 베란다 난간, 차고, 정원 나무와 담·철제 대문', draw: (h, s) => [
    h.rect(0, -60, 70, 60, T('wall2')), h.rect(-2, -66, 74, 7, T('roof'), { rx: 1 }), h.rect(14, -56, 42, 56, T('roof2')), h.stroke('M 24,-52 V -4 M 35,-52 V -4 M 46,-52 V -4', 1.5, 'far'),
    h.rect(90, -146, 210, 146, T('wall'), { shade: true }), h.path('M 76,-146 L 120,-172 L 270,-172 L 314,-146 Z', T('roof'), { shade: true }), h.rect(76, -149, 238, 6, T('roof2'), { rx: 1 }),
    win(h, 110, -134, 60, 36), win(h, 220, -134, 60, 36), h.rect(100, -96, 190, 6, T('wall2')), railP(h, s, 102, -116, 186, 20, 10, true),
    win(h, 110, -72, 70, 46), h.rect(222, -80, 58, 6, T('roof2'), { rx: 1 }), door(h, 232, -72, 40, 72, 'wood'), h.rect(238, -64, 28, 18, T('glass'), { flat: true }),
    h.rect(300, -82, 94, 82, T('wall')), h.rect(294, -88, 106, 7, T('roof'), { rx: 1 }), h.rect(310, -66, 72, 66, T('wall2')), h.stroke('M 310,-52 H 382 M 310,-38 H 382 M 310,-24 H 382 M 310,-10 H 382', 1.5, 'far'),
    h.rect(90, -8, 210, 8, T('ground2')), tree(h, 78, 0, 0.9), pot(h, 290, -8, 0.8),
  ].join('') },
  { id: 'house-estate-h3', layer: '집', band: 3, years: B(3), box: [-4, -170, 404, 170], slots: { window: [175, -14], porch: null }, note: '2000~ 큰 집 — 평지붕 2층, 큰 유리창, 별동(차고), 데크와 정원, 낮은 울타리', draw: (h, s) => [
    h.rect(40, -84, 70, 84, T('wall2')), h.rect(34, -90, 82, 7, T('roof2'), { rx: 1 }), h.rect(50, -66, 50, 66, T('wall')), h.stroke('M 50,-50 H 100 M 50,-34 H 100 M 50,-18 H 100', 1.5, 'wall2'),
    h.rect(100, -150, 220, 150, T('wall'), { shade: true }), h.rect(94, -156, 232, 7, T('roof2'), { rx: 1 }),
    win(h, 120, -136, 60, 40), win(h, 226, -136, 76, 40), h.rect(226, -92, 76, 4, T('wall2'), { flat: true }),
    win(h, 120, -70, 110, 56), door(h, 250, -62, 40, 62, 'roof2'), h.rect(256, -54, 28, 30, T('glass'), { flat: true }),
    h.rect(110, -8, 140, 8, T('wood')), h.stroke('M 110,-4 H 250', 1, 'clay'),
    h.rect(0, -26, 40, 26, T('wall2')), h.rect(330, -26, 70, 26, T('wall2')), railP(h, s, 0, -26, 40, 26, 10, true), railP(h, s, 330, -26, 70, 26, 10),
    tree(h, 350, -26, 1), h.circle(306, -8, 8, T('green')), h.circle(318, -6, 6, T('green')), pot(h, 236, -8, 0.8),
  ].join('') },
  { id: 'house-care-h3', layer: '집', band: 3, years: B(3), box: [0, -170, 400, 170], slots: { window: [42, -16], porch: null }, note: '2000~ 요양 시설(마스터 결정 — 건물 외관만) — 3층 밝은 건물, 차양 단 유리 출입문, 경사로와 난간, 화단. 간판·표장 0', draw: (h, s) => [
    h.rect(0, -160, 400, 160, T('wall'), { shade: true }), h.rect(0, -166, 400, 8, T('wall2'), { rx: 1 }),
    winRowP(s, 'w', 40, 32, 64), ...[-144, -96].map((y) => winRowAt(s, 'w', 22, y, 360, 32) + h.rect(0, y + 40, 400, 3, T('wall2'), { flat: true })),
    winRowAt(s, 'w', 22, -48, 128, 32), winRowAt(s, 'w', 278, -48, 104, 32),
    h.rect(156, -72, 88, 8, T('roof2'), { rx: 1 }), h.rect(160, -64, 5, 56, T('wall2')), h.rect(235, -64, 5, 56, T('wall2')), h.rect(176, -62, 48, 54, T('glass')), h.stroke('M 200,-62 V -8', 2),
    h.rect(156, -8, 88, 8, T('wall2')), h.path('M 244,-8 L 244,0 L 350,0 Z', T('wall2'), { flat: true }), h.stroke('M 156,-26 V -8 M 244,-26 L 350,-18 M 350,-18 V 0 M 300,-22 V -4', 2, 'roof2'),
    h.rect(14, -10, 130, 10, T('ground2')), h.circle(40, -12, 9, T('green')), h.circle(70, -11, 8, T('green')), h.circle(100, -12, 9, T('green')), h.circle(128, -11, 7, T('green')),
    h.rect(360, -10, 30, 10, T('ground2')), pot(h, 376, -10, 0.9),
  ].join('') },

  // ════════════════════════════════════════════════════════════════ 소품 5 (원점 = 바닥 가운데)
  { id: 'prop-car', layer: '소품', years: [1985, null], box: [-34, -30, 68, 30], note: '승용차(옆) — 「가진 것」 승용차일 때, 집 옆. 상표·번호판 0', draw: (h) => [
    h.path('M -32,-6 L -32,-15 L -20,-17 L -12,-27 L 12,-27 L 24,-17 L 32,-15 L 32,-6 Z', T('cloth4'), { shade: true }),
    h.path('M -11,-17 L -6,-25 L 9,-25 L 17,-17 Z', T('glass'), { flat: true }), h.rect(-1, -25, 1.6, 8, T('cloth4'), { flat: true }),
    h.circle(-18, -6, 6, T('ink')), h.circle(-18, -6, 2.6, T('wall2'), { flat: true }), h.circle(18, -6, 6, T('ink')), h.circle(18, -6, 2.6, T('wall2'), { flat: true }),
    h.rect(27, -14, 5, 3, T('glass'), { flat: true }), h.rect(-32, -14, 5, 3, T('clay'), { flat: true }), h.rect(-4, -14, 6, 1.6, T('roof2'), { flat: true }),
  ].join('') },
  { id: 'prop-plastic-greenhouse', layer: '소품', years: [1980, null], box: [-60, -30, 120, 30], note: '비닐하우스(옆, 긴 반원 터널) — 농촌 배경 앞. 골조 줄 + 반투명 비닐', draw: (h) => [
    h.path('M -58,0 V -16 Q -58,-28 -46,-28 H 46 Q 58,-28 58,-16 V 0 Z', T('cloth3'), { shade: true }),
    h.stroke('M -47,-27 V 0 M -36,-28 V 0 M -25,-28 V 0 M -14,-28 V 0 M -3,-28 V 0 M 8,-28 V 0 M 19,-28 V 0 M 30,-28 V 0 M 41,-28 V 0 M -58,-16 H 58', 1.5, 'far2'),
    h.rect(46, -20, 8, 20, T('wall2'), { flat: true }), h.rect(-58, -4, 116, 4, T('green'), { flat: true, extra: 'opacity=".55"' }),
  ].join('') },
  { id: 'prop-scooter', layer: '소품', years: [2000, null], box: [-22, -30, 44, 30], note: '배달 오토바이(옆) — 도시 마당. 상자에 글자 0', draw: (h) => [
    h.rect(-22, -30, 13, 12, T('cloth1'), { shade: true, rx: 1 }),
    h.path('M -14,-14 L -2,-14 L 4,-22 L 15,-22 L 17,-12 L 12,-8 L -8,-8 Z', T('roof2'), { shade: true }), h.rect(-13, -18, 13, 4, T('ink'), { rx: 1.5 }),
    h.stroke('M 13,-22 L 17,-28 M 12,-28 H 21', 2, 'ink'), h.circle(-13, -6, 6, T('ink')), h.circle(-13, -6, 2.4, T('wall2'), { flat: true }), h.circle(13, -6, 6, T('ink')), h.circle(13, -6, 2.4, T('wall2'), { flat: true }),
  ].join('') },
  { id: 'prop-ev-charger', layer: '소품', years: [2020, null], box: [-8, -34, 16, 34], note: '전기차 충전기(기둥형) — 승용차와 함께. 화면은 빈 면', draw: (h) => [
    h.rect(-8, -3, 16, 3, T('roof2')), h.rect(-6, -32, 12, 30, T('wall2'), { shade: true, rx: 2 }), h.rect(-4, -29, 8, 7, T('glass'), { flat: true }),
    h.stroke('M 5,-18 q 8,4 2,14', 2, 'roof2'), h.rect(-3, -19, 6, 3, T('roof2'), { flat: true }), h.rect(-4, -14, 2, 5, T('green'), { flat: true }),
  ].join('') },
  { id: 'prop-hanging-fish', layer: '소품', years: null, box: [-40, -44, 80, 44], note: '덕장 — 바닷가 배경 + 마당이 있는 집. 장대 둘과 가로대에 널어 말리는 생선 다섯', draw: (h) => [
    h.rect(-37, -40, 3, 40, T('wood'), { shade: true }), h.rect(34, -40, 3, 40, T('wood'), { shade: true }), h.rect(-39, -41, 78, 3, T('wood')),
    ...[-26, -13, 0, 13, 26].map((x, i) => h.stroke(`M ${x},-38 V -34`, 1, 'roof2') + h.ellipse(x, -24, 3.2, 9, T(i % 2 ? 'far' : 'hairw'), { flat: true }) + h.path(`M ${x - 3},-15 L ${x + 3},-15 L ${x},-10 Z`, T('roof2'), { flat: true })),
    h.ellipse(-20, -2, 9, 3, T('wood'), { flat: true }), h.ellipse(-20, -3, 7, 2, T('hairw'), { flat: true }),
  ].join('') },

  // ════════════════════════════════════════════════════════════════ 반려동물 3 (원점 = 발바닥 가운데 · 상자 [-16,-30,32,30])
  { id: 'pet-cat-yard', layer: '반려동물', years: null, box: [-16, -30, 32, 30], note: '마당에 드나드는 고양이 — 옆으로 선 모습, 꼬리 세움, 줄무늬 둘', draw: (h) => [
    h.stroke('M -10,-11 q -8,-5 -4,-15', 2.6, 'pet'), h.rect(-7, -7, 4, 7, T('pet'), { rx: 1.5 }), h.rect(3, -7, 4, 7, T('pet'), { rx: 1.5 }),
    h.ellipse(0, -11, 11, 6, T('pet'), { shade: true }), h.rect(-3, -16, 3, 7, T('pet2'), { flat: true, rx: 1 }), h.rect(2, -16, 3, 7, T('pet2'), { flat: true, rx: 1 }),
    h.circle(10, -17, 5.5, T('pet')), h.path('M 6,-20 l 1,-6 l 4,4 Z', T('pet2')), h.path('M 14,-20 l -1,-6 l -4,4 Z', T('pet2')),
  ].join('') },
  { id: 'pet-other-indoor', layer: '반려동물', years: null, box: [-16, -30, 32, 30], note: '그 밖(실내) — 새장의 작은 새(창가). 상표 0', draw: (h) => [
    h.rect(-12, -3, 24, 3, T('roof2')), h.stroke('M 0,-28 V -30 M -11,-3 V -16 a 11 11 0 0 1 22 0 V -3 M -7,-3 V -22 M -3,-3 V -26 M 3,-3 V -26 M 7,-3 V -22 M -11,-10 H 11', 1.2, 'roof2'),
    h.stroke('M -8,-9 H 8', 1.5, 'wood'), h.ellipse(0, -12, 3.6, 2.6, T('cloth2'), { flat: true }), h.circle(3, -14.5, 2, T('cloth2'), { flat: true }), h.path('M 5,-14.5 l 2.5,0.8 l -2.5,0.8 Z', T('clay'), { flat: true }),
  ].join('') },
  { id: 'pet-other-yard', layer: '반려동물', years: null, box: [-16, -30, 32, 30], note: '그 밖(마당) — 앉은 토끼(귀 둘, 꼬리). 종류는 FK1 「그 밖」 자료 뒤 바꿀 수 있다', draw: (h) => [
    h.rect(6, -29, 3.8, 15, T('hairw'), { rx: 2 }), h.rect(10.6, -28, 3.8, 14, T('hairw'), { rx: 2 }), h.rect(7.2, -27, 1.4, 10, T('skin'), { flat: true, rx: 0.7 }), h.rect(11.8, -26, 1.4, 9, T('skin'), { flat: true, rx: 0.7 }),
    h.ellipse(0, -7, 10, 6.5, T('hairw'), { shade: true }), h.circle(9, -13, 5, T('hairw')), h.circle(-10, -9, 2.6, T('cloth3')), h.rect(-4, -3, 6, 3, T('hairw'), { flat: true, rx: 1.5 }), h.rect(4, -3, 6, 3, T('hairw'), { flat: true, rx: 1.5 }),
  ].join('') },
];
export const FM5_IDS = PIECES_FM5.map((p) => p.id);
if (PIECES_FM5.length !== 33) throw new Error(`FM5 보강 조각 ${PIECES_FM5.length}(33 기대)`);

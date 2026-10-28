/**
 * SPEC-009 FM5 조각 보강 시트 (designer 2026-10-28) — 새 조각 33을 시대 밴드별로 보이고, 그 조각이 들어간 장면 열여덟을 실제 칸 크기(PC 351×140 · 휴대폰 326×130)로 합쳐 본다.
 * 조각 자체는 `familyPiecesFm5.mjs`(→ `buildFamilyMockups.mjs`가 `pieces/s1/<id>.svg`로 씀). 이 스크립트는 그 svg와 식구 코드(`familyPieceLib.mjs`)만 읽어 시트를 만든다.
 *
 * 실행: node scripts/design/buildFamilyMockups.mjs && node scripts/design/buildFm5Pieces.mjs
 * 산출: docs/design/mockups/family/fm5-pieces.html · fm5-budget.json(새 조각별 gzip · pieces.json 추정 — 지금 src/data/familyArt/pieces.json을 **읽기만** 해서 새 조각을 더한 덩어리 gzip)
 * 의존성 없음(Node 내장만). `src/`는 pieces.json 한 파일을 읽기만 한다(고치지 않는다).
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LIGHT, DARK, T, mk, figSpec, person, capPath } from './familyPieceLib.mjs';
import { PIECES_FM5 } from './familyPiecesFm5.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const h = mk('s1');

// ---------------------------------------------------------------- 조각 마크업 — 새 조각은 draw, 기존 조각은 pieces/s1/<id>.svg에서(genFamilyArt.ts와 같은 규칙)
const fm5ById = Object.fromEntries(PIECES_FM5.map((p) => [p.id, p]));
const innerOfFile = (id) => { const m = /<g>([\s\S]*)<\/g><\/svg>\s*$/.exec(readFileSync(`${OUT}pieces/s1/${id}.svg`, 'utf8')); if (!m) throw new Error(`${id}: 조각 마크업 없음`); return m[1]; };
/** 기존 조각의 연도(family-scene.md 2절 — 장면 연도 단언용) */
const BASE_YEARS = { 'bg-metro-b2': [1970, 1999], 'bg-metro-b3': [2000, null], 'bg-town-b1': [1940, 1969], 'bg-town-b3': [2000, null], 'bg-rural-b1': [1940, 1969], 'prop-jangdok': [1940, 1999], 'prop-well': [1940, 1980], 'prop-haystack': [1940, 1990], 'prop-briquettes': [1955, 1989], 'prop-pole': [1960, null], 'prop-antenna': [1961, 2005], 'prop-laundry': null, 'prop-tree': null, 'prop-lamp': [1970, null], 'prop-water-tank': [1980, null], 'prop-ac-unit': [1995, null], 'prop-parcel': [2000, null], 'prop-bicycle': null, 'prop-planter': null, 'pet-dog-yard': null, 'pet-dog-indoor': null, 'pet-cat-indoor': null };
const FIG = /^fig-(toddler|child|teen|young|middle|senior|elder)-(f|m)-(e1|e2|e3)$/;
function markup(id, inst, opt) {
  if (fm5ById[id]) return fm5ById[id].draw(h, inst, opt);
  const fg = FIG.exec(id);
  if (fg) return person(h, figSpec(fg[1], fg[2], fg[3], opt || {}));
  if (id === 'fig-infant-carried') { const H = (opt && opt.H) || 94, r = 10.5, shY = -(H - 2 * r - 3), hipY = -H * 0.5; return h.rect(-18, shY + 1, 36, hipY - shY + 14, T((opt && opt.tok) || 'cloth2'), { rx: 7, shade: true }) + h.circle(10.5, shY - 5, 6.5, T('skin'), { shade: true }) + h.path(capPath(6.5, shY - 5, 1.05, 0.5, 0.0), T('hair')); }
  return innerOfFile(id);
}
const yearsOf = (id) => (fm5ById[id] ? fm5ById[id].years : id.startsWith('fig-') ? null : BASE_YEARS[id] === undefined ? (() => { throw new Error(`연도 모름: ${id}`); })() : BASE_YEARS[id]);
const eraOf = (y) => (y <= 1965 ? 'e1' : y < 2000 ? 'e2' : 'e3');

// ---------------------------------------------------------------- 장면 열여덟 — 새 집 18 전부 + 새 배경 7 + 새 소품 5 + 새 반려 3이 한 번 이상 들어간다
/** [id, x, y, scale?, opt?] — 좌표계 640×256, 집 원점 (0, 200), 식구 발 y 246~252, 안전 영역 x 20~620 */
const fam = (year, list) => list.map(([age, sex, x, y = 246, opt]) => [`fig-${age}-${sex}-${eraOf(year)}`, x, y, 1, opt]);
const SCENES = [
  { year: 2004, title: '2004년 경기 중소도시 · 단독주택(2층)', note: 'FM5에서 「2000년대 단독이 옛 셋방 집으로」 나오던 바로 그 경우 — house-detached-h3 + 승용차(가진 것)', bg: 'bg-town-b3', back: [['prop-lamp', 600, 200]], house: ['house-detached-h3', 0, 200], front: [['prop-car', 344, 246], ['prop-parcel', 250, 240]], pets: [['pet-cat-indoor', 119, 178]], family: (y) => fam(y, [['young', 'm', 470], ['young', 'f', 516, 248], ['child', 'm', 556, 250]]) },
  { year: 1985, title: '1985년 서울 · 복도식 아파트', note: 'house-apt-h2 — 5층 판상, 복도 난간', bg: 'bg-metro-b2', back: [['prop-lamp', 600, 200]], house: ['house-apt-h2', 0, 200], front: [['prop-bicycle', 110, 246]], pets: [['pet-dog-indoor', 35, 186]], family: (y) => fam(y, [['senior', 'f', 440, 250], ['young', 'm', 480], ['young', 'f', 524, 248], ['child', 'f', 564, 250]]) },
  { year: 1962, title: '1962년 경남 바닷가 · 문간방 셋방', note: 'bg-coast-b1 + house-detached-rent-h1 + 덕장 + 마당 고양이', bg: 'bg-coast-b1', back: [], house: ['house-detached-rent-h1', 0, 200], front: [['prop-jangdok', 84, 246], ['prop-hanging-fish', 402, 238]], pets: [['pet-cat-yard', 330, 246]], family: (y) => fam(y, [['young', 'm', 446], ['young', 'f', 490, 248], ['child', 'f', 530, 250], ['toddler', 'm', 560, 250]]).concat([['fig-infant-carried', 490, 248, 1, { tok: 'cloth4' }]]).sort((a) => (a[0] === 'fig-infant-carried' ? -1 : 0)) },
  { year: 2016, title: '2016년 전남 바닷가 · 상가주택', note: 'bg-coast-b3(항만) + house-other-h3 + 실내 새장', bg: 'bg-coast-b3', back: [['prop-lamp', 610, 200]], house: ['house-other-h3', 0, 200], front: [['prop-ac-unit', 300, 100], ['prop-parcel', 280, 240], ['prop-planter', 24, 246]], pets: [['pet-other-indoor', 75, 124]], family: (y) => fam(y, [['young', 'm', 470], ['young', 'f', 516, 248], ['child', 'f', 556, 250]]) },
  { year: 1958, title: '1958년 경북 농촌 · 큰 기와집', note: 'house-estate-h1 — 솟을대문·담·대청', bg: 'bg-rural-b1', back: [], house: ['house-estate-h1', 0, 200], front: [['prop-jangdok', 70, 246], ['prop-well', 390, 238]], pets: [['pet-dog-yard', 320, 246]], family: (y) => [['fig-infant-carried', 544, 248]].concat(fam(y, [['senior', 'm', 436, 250, { shoeTok: 'cloth3' }], ['senior', 'f', 470, 250], ['young', 'm', 508], ['young', 'f', 544, 248], ['child', 'm', 584, 250], ['toddler', 'm', 612, 250]])) },
  { year: 1974, title: '1974년 부산 · 작은 집(슬레이트)', note: 'house-shack-h2 — 낙인 없이 빨래·화분·대야가 있는 집', bg: 'bg-metro-b2', back: [['prop-pole', 30, 200]], house: ['house-shack-h2', 20, 200], front: [['prop-laundry', 330, 236], ['prop-briquettes', 286, 240]], pets: [['pet-dog-yard', 404, 246]], family: (y) => fam(y, [['young', 'm', 456], ['young', 'f', 500, 248], ['child', 'm', 540, 250], ['child', 'f', 574, 250]]) },
  { year: 1995, title: '1995년 충남 농촌 · 슬래브 단독', note: 'bg-rural-b2 + house-detached-h2 + 비닐하우스(배경 앞) + 물탱크', bg: 'bg-rural-b2', back: [['prop-plastic-greenhouse', 540, 200], ['prop-pole', 24, 200]], house: ['house-detached-h2', 0, 200], front: [['prop-jangdok', 90, 246], ['prop-water-tank', 270, 86]], pets: [['pet-dog-yard', 400, 246]], family: (y) => fam(y, [['senior', 'm', 456, 250], ['senior', 'f', 492, 250], ['young', 'm', 536]]) },
  { year: 2021, title: '2021년 서울 · 넓은 단독주택', note: 'house-estate-h3 + 승용차·충전기(마당) + 마당 토끼', bg: 'bg-metro-b3', back: [], house: ['house-estate-h3', 0, 200], front: [['prop-car', 72, 246], ['prop-ev-charger', 122, 246], ['prop-parcel', 262, 240]], pets: [['pet-other-yard', 330, 246]], family: (y) => fam(y, [['young', 'f', 470, 248], ['young', 'm', 516]]) },
  { year: 2019, title: '2019년 경기 · 요양 시설', note: 'house-care-h3 — 건물 외관만, 간판 0', bg: 'bg-town-b3', back: [['prop-lamp', 600, 200]], house: ['house-care-h3', 0, 200], front: [['prop-planter', 410, 246]], pets: [], family: (y) => fam(y, [['elder', 'f', 480, 250]]) },
  { year: 1965, title: '1965년 경기 중소도시 · 초기 아파트', note: 'house-apt-h1(설계값 3층) + bg-town-b1', bg: 'bg-town-b1', back: [['prop-pole', 616, 200]], house: ['house-apt-h1', 0, 200], front: [['prop-bicycle', 110, 246]], pets: [], family: (y) => fam(y, [['young', 'm', 470], ['young', 'f', 512, 248], ['child', 'f', 550, 250]]) },
  { year: 1978, title: '1978년 강원 중소도시 · 연립주택', note: 'bg-town-b2 + house-multi-h2(발코니)', bg: 'bg-town-b2', back: [['prop-lamp', 600, 200]], house: ['house-multi-h2', 0, 200], front: [['prop-briquettes', 356, 240], ['prop-bicycle', 120, 246]], pets: [['pet-cat-indoor', 53, 146]], family: (y) => fam(y, [['young', 'm', 440], ['young', 'f', 484, 248], ['child', 'm', 524, 250], ['toddler', 'm', 554, 250]]) },
  { year: 2008, title: '2008년 서울 · 다가구 단독', note: 'house-detached-rent-h3 + 배달 오토바이 + 실내 개', bg: 'bg-metro-b3', back: [['prop-lamp', 600, 200]], house: ['house-detached-rent-h3', 0, 200], front: [['prop-scooter', 100, 246], ['prop-parcel', 260, 240]], pets: [['pet-dog-indoor', 60, 136]], family: (y) => fam(y, [['young', 'f', 440, 248], ['child', 'f', 480, 250], ['child', 'm', 514, 250]]) },
  { year: 1950, title: '1950년 대구 · 가게 딸린 집', note: 'house-other-h1 — 미닫이 가게, 빈 간판 판', bg: 'bg-town-b1', back: [], house: ['house-other-h1', 0, 200], front: [['prop-laundry', 410, 236]], pets: [['pet-cat-indoor', 252, 160]], family: (y) => [['fig-infant-carried', 514, 248]].concat(fam(y, [['young', 'm', 470], ['young', 'f', 514, 248], ['child', 'm', 554, 250]])) },
  { year: 1988, title: '1988년 서울 · 2층 양옥', note: 'house-estate-h2 — 베란다·차고, 차고 앞 승용차', bg: 'bg-metro-b2', back: [['prop-lamp', 610, 200]], house: ['house-estate-h2', 0, 200], front: [['prop-car', 344, 250]], pets: [], family: (y) => fam(y, [['young', 'm', 440], ['young', 'f', 484, 248], ['teen', 'f', 524, 250, { toks: { a: 'cloth3', b: 'cloth1' } }], ['child', 'm', 560, 250]]) },
  { year: 2003, title: '2003년 전북 농촌 · 작은 집(컨테이너)', note: 'bg-rural-b3 + house-shack-h3 + 비닐하우스', bg: 'bg-rural-b3', back: [['prop-plastic-greenhouse', 540, 200]], house: ['house-shack-h3', 10, 200], front: [['prop-planter', 60, 246]], pets: [['pet-dog-yard', 360, 246]], family: (y) => fam(y, [['senior', 'm', 470, 250], ['senior', 'f', 510, 250]]) },
  { year: 1969, title: '1969년 인천 · 2층 연립', note: 'bg-metro-b1 + house-multi-h1', bg: 'bg-metro-b1', back: [['prop-pole', 620, 200]], house: ['house-multi-h1', 10, 200], front: [['prop-briquettes', 356, 240], ['prop-laundry', 110, 236]], pets: [['pet-cat-indoor', 140, 138]], family: (y) => fam(y, [['young', 'm', 440], ['young', 'f', 484, 248], ['child', 'f', 524, 250]]) },
  { year: 1983, title: '1983년 경남 바닷가 · 가게 딸린 집(2층)', note: 'bg-coast-b2(방파제) + house-other-h2(셔터)', bg: 'bg-coast-b2', back: [], house: ['house-other-h2', 0, 200], front: [['prop-briquettes', 366, 240], ['prop-bicycle', 110, 246]], pets: [['pet-dog-indoor', 66, 108]], family: (y) => fam(y, [['young', 'm', 440], ['young', 'f', 484, 248], ['child', 'f', 524, 250], ['child', 'm', 558, 250]]) },
  { year: 1952, title: '1952년 부산 · 작은 집(판자)', note: 'house-shack-h1 — 널빤지 벽, 빨래·화분·신발', bg: 'bg-metro-b1', back: [], house: ['house-shack-h1', 20, 200], front: [['prop-laundry', 330, 236]], pets: [], family: (y) => fam(y, [['young', 'm', 440], ['young', 'f', 484, 248], ['child', 'm', 524, 250]]) },
];
function assertScene(sc) {
  const items = [[sc.bg, 0, 0], ...sc.back, sc.house, ...sc.front, ...sc.pets, ...sc.family(sc.year)];
  for (const [id, x] of items) { const ys = yearsOf(id); if (ys && (sc.year < ys[0] || (ys[1] !== null && sc.year > ys[1]))) throw new Error(`연도 위반: ${sc.title} ${sc.year} ← ${id} [${ys}]`); if (id.startsWith('fig-') && (x < 20 || x > 620)) throw new Error(`안전 영역 밖: ${sc.title} ${id} x=${x}`); }
  const hx = sc.house[1] + fm5ById[sc.house[0]].box[0] + fm5ById[sc.house[0]].box[2];
  const firstFig = Math.min(...sc.family(sc.year).map((f) => f[1]));
  if (firstFig < hx + 10) throw new Error(`식구 줄이 집에 겹침: ${sc.title} (집 오른끝 ${hx}, 첫 식구 ${firstFig})`);
  return items;
}
const place = (inst, [id, x, y, scale = 1, opt]) => `<g data-piece="${id}" transform="translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}">${markup(id, inst, opt)}</g>`;
const sceneSvg = (sc, i) => { const inst = `fm5s${i}`; const L = (name, items) => `<g data-layer="${name}">${items.map((it) => place(inst, it)).join('')}</g>`; return `<svg class="scene__svg" viewBox="0 0 640 256" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${sc.title}" focusable="false">${L('배경', [[sc.bg, 0, 0]])}${L('소품-뒤', sc.back)}${L('집', [sc.house])}${L('소품-앞', sc.front)}${L('반려동물', sc.pets)}${L('식구', sc.family(sc.year))}</svg>`; };
SCENES.forEach(assertScene);
const used = new Set(SCENES.flatMap((sc) => assertScene(sc).map((it) => it[0])));
const unused = PIECES_FM5.filter((p) => !used.has(p.id)).map((p) => p.id);
if (unused.length) throw new Error(`장면에 안 쓰인 새 조각: ${unused.join(', ')}`);

// ---------------------------------------------------------------- 실측 — 새 조각별 gzip · pieces.json 추정
const rows = PIECES_FM5.map((p) => { const inner = p.draw(h, 's1'); return { id: p.id, layer: p.layer, band: p.band || null, years: p.years, box: p.box, slots: p.slots || null, raw: Buffer.byteLength(inner, 'utf8'), gz: gz(inner), note: p.note }; });
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const PJ = ROOT + 'src/data/familyArt/pieces.json';
let est = null;
if (existsSync(PJ)) {
  const now = JSON.parse(readFileSync(PJ, 'utf8')); // 읽기만
  const nowText = JSON.stringify(now, null, 1) + '\n';
  const next = { ...now }; for (const p of PIECES_FM5) next[p.id] = p.draw(h, 's1');
  const nextText = JSON.stringify(next, null, 1) + '\n';
  est = { nowPieces: Object.keys(now).length, nowGz: gz(nowText), nextPieces: Object.keys(next).length, nextGz: gz(nextText), deltaGz: gz(nextText) - gz(nowText), familyArtChunkNowGz: 7180, familyArtChunkEstGz: 7180 + (gz(nextText) - gz(nowText)), limitChunk: 16000, limitTotal: 110000, limitPieces: 45000 };
}
const byLayer = {};
for (const r of rows) (byLayer[r.layer] ||= { n: 0, gz: 0 }), byLayer[r.layer].n++, byLayer[r.layer].gz += r.gz;
const budget = { measuredAt: '2026-10-28', round: 'FM5 조각 보강', note: 'raw·gz는 조각 안쪽 마크업(<g> 내용) 바이트. est는 지금 src/data/familyArt/pieces.json(읽기만)에 새 조각 33을 더해 JSON.stringify(…, null, 1)로 만든 글의 gzip — developer가 npm run gen:art로 다시 만들 pieces.json의 크기 추정. familyArt 덩어리는 FM5 실측 7.18KB gzip(dev 로그) + delta. 상한(FH8·마스터): 덩어리 16KB · 합 110KB · 조각 덩어리 45KB.', pieces: rows.length, gzEachTotal: sum('gz'), gzEachAvg: Math.round(sum('gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), byLayer: Object.fromEntries(Object.entries(byLayer).map(([k, v]) => [k, { n: v.n, gzAvg: Math.round(v.gz / v.n) }])), est, rows, scenes: SCENES.map((s) => ({ year: s.year, title: s.title, house: s.house[0], bg: s.bg })) };
write('fm5-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 시트
const BAND = { 1: '~1969 (b1 · h1)', 2: '1970~1999 (b2 · h2)', 3: '2000~ (b3 · h3)', 0: '공통 · 소품과 반려동물(연도는 조각마다)' };
const bandOf = (p) => (p.layer === '배경' || p.layer === '집' ? p.band : 0);
const cell = (p) => { const [x, y, w, hh] = p.box; const r = rows.find((k) => k.id === p.id); const years = p.years ? `${p.years[0]}~${p.years[1] ?? ''}` : '공통'; const slot = p.slots ? ` · 창 [${p.slots.window}]${p.slots.porch ? ` · 마루 [${p.slots.porch}]` : ''}` : ''; return `<figure class="pc__cell" data-piece="${p.id}"><svg viewBox="${x} ${y} ${w} ${hh}" style="aspect-ratio:${w}/${hh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${p.draw(h, 'fm5p', {})}</svg><figcaption><b>${p.id}</b>${years} · 상자 [${p.box.join(',')}]${slot} · gzip ${r.gz}B<span class="pc__note">${p.note}</span></figcaption></figure>`; };
const tokenBlock = (o, indent = '  ') => Object.entries(o).map(([k, v]) => `${indent}--c-scene-${k}: ${v};`).join('\n');
const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 집 그림 조각 보강 서른세 장(SPEC-009 FM5)</title>
<!-- 시안(정적 HTML, 가짜 데이터) — SPEC-009 FM5 조각 보강. 생성 scripts/design/buildFm5Pieces.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 상호·브랜드·얼굴 0). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);})();</script>
<style>
.pc { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.pc h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.pc h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.pc h3 { font-size: var(--fs-md); margin: var(--sp-5) 0 var(--sp-2); color: var(--c-text-2); }
.pc__lead { margin: 0 0 var(--sp-4); font-size: var(--fs-md); max-width: 72ch; }
.pc__note, .pc p.pc__sub { color: var(--c-text-2); }
.pc p.pc__sub { margin: 0 0 var(--sp-4); max-width: 72ch; }
.pc a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.pc__links { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--fs-sm); margin: 0 0 var(--sp-6); }
.pc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 208px), 1fr)); gap: var(--sp-3); }
/* 칸은 테두리 없이 한 단 밝은 면(--c-surface)으로만 구분한다(design-taste app 규칙 — 1px 경계선 대비 1.49:1은 과함). 그림은 조각 상자 비율 그대로(배경 2.5:1은 낮게) — 칸 안 빈 띠 0 */
.pc__cell { margin: 0; background: var(--c-surface); border-radius: var(--r-md); overflow: hidden; }
.pc__cell svg { display: block; width: 100%; height: auto; max-height: 150px; background: var(--c-scene-sky); }
.pc__cell figcaption { padding: var(--sp-2); font-size: var(--fs-sm); line-height: 1.5; color: var(--c-text-2); word-break: keep-all; overflow-wrap: anywhere; }
.pc__cell b { color: var(--c-text); display: block; }
.pc__cell .pc__note { display: block; margin-top: 2px; }
/* 장면 — 실제 PC 칸 폭 351(2:1 배치의 집 그림). 휴대폰에서는 전폭(326) */
.sc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 351px), 1fr)); gap: var(--sp-4); }
.sc__fig { margin: 0; background: var(--c-surface); border-radius: var(--r-md); overflow: hidden; width: 351px; max-width: 100%; }
.sc__fig .scene__svg { max-height: none; }
.sc__fig figcaption { padding: var(--sp-2) var(--sp-3) var(--sp-3); font-size: var(--fs-sm); line-height: 1.5; color: var(--c-text-2); word-break: keep-all; }
.sc__fig b { color: var(--c-text); display: block; font-variant-numeric: tabular-nums; }
.pc table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.pc th, .pc td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.pc td.num, .pc th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.pc__tablewrap { overflow-x: auto; }
@media (forced-colors: active) { .pc__cell svg, .sc__fig .scene__svg { border: 1px solid CanvasText; } }
</style>
</head>
<body>
<main class="pc">
<h1>집 그림 조각 보강 — 서른세 장</h1>
<p class="pc__lead">FM5를 구현해 보니 아직 안 그린 조각 서른세 개가 가장 가까운 조각으로 대신 그려져 「2000년대 단독이 옛 셋방 집으로」처럼 시대가 어긋났습니다. 그 서른세 개(배경 7 · 집 18 · 소품 5 · 반려동물 3)를 같은 그림체(종이 오림)로 그렸습니다. 조각마다 상자·연도·슬롯은 <code>sceneTables.ts</code>의 값이고, 아래 장면은 그 조각이 실제 칸(PC 351×140)에서 어떻게 보이는지 확인용으로 합친 것입니다(이름·가족은 가짜 값). 점유 형태는 그리지 않고, 수저는 크기와 마당·담으로만 말합니다.</p>
<nav class="pc__links" aria-label="보기"><a href="fm5-pieces.html">라이트</a><a href="fm5-pieces.html?theme=dark">다크</a><a href="pieces.html">조각 표 전체(78)</a><a href="scenes.html">FM2b 장면 다섯</a></nav>

<h2>장면 열여덟 — 새 조각이 들어간 칸</h2>
<p class="pc__sub">새 집 열여덟 채가 한 번씩, 새 배경 일곱과 소품 다섯·반려동물 셋이 한 번 이상 들어갑니다. 식구 줄은 집 오른끝 + 30 이후, 안전 영역 x 20~620 안(빌드가 단언).</p>
<div class="sc__grid">${SCENES.map((sc, i) => `<figure class="sc__fig" data-year="${sc.year}" data-house="${sc.house[0]}"><div class="cmp__pic">${sceneSvg(sc, i)}</div><figcaption><b>${sc.title}</b>${sc.note}</figcaption></figure>`).join('')}</div>

${[1, 2, 3, 0].map((b) => { const list = PIECES_FM5.filter((p) => bandOf(p) === b); return `<h2>${BAND[b]} — ${list.length}장</h2><div class="pc__grid">${list.map(cell).join('')}</div>`; }).join('\n')}

<h2>실측</h2>
<div class="pc__tablewrap"><table><thead><tr><th scope="col">층</th><th scope="col" class="num">조각</th><th scope="col" class="num">평균 gzip</th></tr></thead><tbody>${Object.entries(budget.byLayer).map(([k, v]) => `<tr><td>${k}</td><td class="num">${v.n}</td><td class="num">${v.gzAvg}B</td></tr>`).join('')}<tr><td>합</td><td class="num">${rows.length}</td><td class="num">${budget.gzEachAvg}B(합 ${sum('gz').toLocaleString('ko-KR')}B · 최대 ${budget.gzEachMax}B)</td></tr></tbody></table></div>
${est ? `<p class="pc__sub">지금 <code>pieces.json</code>(${est.nowPieces}조각) gzip ${est.nowGz.toLocaleString('ko-KR')}B → 새 조각을 더하면(${est.nextPieces}조각) <strong>${est.nextGz.toLocaleString('ko-KR')}B</strong>(+${est.deltaGz.toLocaleString('ko-KR')}B). familyArt 덩어리 추정 7,180 + ${est.deltaGz.toLocaleString('ko-KR')} = <strong>${est.familyArtChunkEstGz.toLocaleString('ko-KR')}B</strong> — 상한 덩어리 16,000B${est.familyArtChunkEstGz > est.limitChunk ? ' <strong>초과</strong>' : ' 안'} · 합 110,000B 안. 정본 수치는 fm5-budget.json.</p>` : ''}
</main>
</body>
</html>
`;
write('fm5-pieces.html', html);
console.log(`FM5 조각 보강: ${rows.length}장 · 개별 gzip 합 ${sum('gz')}B(평균 ${budget.gzEachAvg}, 최대 ${budget.gzEachMax}) · 장면 ${SCENES.length}`);
for (const [k, v] of Object.entries(budget.byLayer)) console.log(`  ${k}: ${v.n}개 · 평균 ${v.gzAvg}B`);
for (const r of rows.filter((r) => r.gz > 700)) console.log(`  큰 조각: ${r.id} ${r.gz}B`);
if (est) console.log(`pieces.json 추정: ${est.nowGz}B(${est.nowPieces}) → ${est.nextGz}B(${est.nextPieces}) · familyArt 덩어리 ≈ ${est.familyArtChunkEstGz}B${est.familyArtChunkEstGz > est.limitChunk ? ' !!16KB 초과' : ' (16KB 안)'}`);

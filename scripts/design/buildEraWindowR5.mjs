/**
 * SPEC-009 「시대의 창」 5차 시안 생성기 (designer 2026-10-28, r5 — 마스터 의뢰 「1990~2020년대 묶음 + 디자인 후속」).
 *
 * 정본: `docs/design/era-window.md` 「형진 님 승인 · 마스터 결정」·「승인 표기」, SPEC-009 FT3 r4. 수위 = 「현장까지 그리고, 순간(구타·총격·구조되는 사람)은 그리지 않는다」.
 * 장면: `eraR5Scenes.mjs` — 1990년대 12(○1) · 2000년대 13(○3) · 2010년대 13(○4) · 2020년대 11(○1) = 49장(사건 29 · 일상 12 · 계층 변주 8). 승인된 r3 1995·1998은 참고로 함께 둔다.
 * 예산(마스터 결정): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 사람은 `<symbol>`+`<use>`, 색은 `class`(허용 목록 6접두 × 25토큰 안).
 * 후속(R-553): 360 띠 빈 바탕 두 안과 1960년대 톤 밝기 전·후를 같은 시트에 나란히 둔다(`family.css` 값은 developer 몫 — 문서로 넘긴다).
 *
 * 실행: node scripts/design/buildEraWindowR5.mjs
 * 산출: docs/design/mockups/family/era-window-r5.html · pieces/era-r5/<id>.svg(49) · era-window-r5-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. r1~r4 산출물은 그대로 둔다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, tokenCss, toClass, decadeOf, toneLayer, toneCssA, TONE } from './eraR5Lib.mjs';
import { SCENES, SET90, SET00, SET10, SET20, VARIANTS, HEAVY, DAILY } from './eraR5Scenes.mjs';
import { HEAVY as R3HEAVY } from './eraR3ScenesHeavy.mjs';
import { S60 } from './eraR4Scenes60.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r5', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const BAND_LABEL = { low: '아래 둘(흙수저 쪽)', high: '위 둘(금수저 쪽)' };
const approvedR3 = (id) => { const q = R3HEAVY.find((x) => x.id === id); if (!q) throw new Error(`r3 장면 없음: ${id}`); return { ...q, approved: true, r3: true }; };
const R3_1995 = approvedR3('era-1995-sampoong-rescue');
const R3_1998 = approvedR3('era-1998-gold-drive-queue');
for (const q of SCENES) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws) throw new Error(`유지선 판단(ft3)·그리는 것(draws) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
}
if (SCENES.length !== 49) throw new Error(`장면 ${SCENES.length}장(49 기대)`);
if (HEAVY.length !== 9) throw new Error(`무거운 장면 ${HEAVY.length}(9 기대 — 1994·2003·2008·2009·2010·2014·2016·2017·2022)`);
if (VARIANTS.length !== 8 || VARIANTS.filter((q) => q.band === 'low').length !== 4) throw new Error('계층 변주 8장(아래 4 · 위 4) 기대');
// 해마다 1장: 1990~2025 모든 해가 사건 또는 그 10년의 일상에 닿는다(승인된 1995·1998 포함)
const ALL = [...SCENES, R3_1995, R3_1998];
for (let y = 1990; y <= 2025; y++) {
  const ev = ALL.filter((q) => q.kind === 'event' && !q.band && (q.years ? q.years[0] <= y && y <= q.years[1] : q.year === y));
  const dl = DAILY.filter((q) => q.years[0] <= y && y <= q.years[1]);
  if (!ev.length && !dl.length) throw new Error(`${y}년에 닿는 그림 없음`);
}
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000 };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), defsR5Gz = gz(ERA_DEFS_R5), cssGz = gz(tokenCss());
const pieceSvg = (q, note) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r5 · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.hCode || '일상'} · ${q.topic}${q.band ? ` · 계층 변주 ${BAND_LABEL[q.band]}` : ''}${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''}${q.alt ? ' · 같은 해 둘째 그림' : ''} · ${note} · 새로 구성(사진 모사 없음, 얼굴 식별 없음) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 톤 A는 CSS 필터 + 한 겹 --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = SCENES.map((q) => {
  const raw = q.draw() + toneLayer(TONE_ID, q.year);
  const cls = toClass(raw);
  write(`pieces/era-r5/${q.id}.svg`, pieceSvg(q, '승인 전(approved: false)'));
  const g = gz(cls);
  const limit = q.heavy ? BUDGET.perPictureCrowdHeavy : BUDGET.perPicture;
  return { id: q.id, year: q.year, years: q.years || [q.year, q.year], decade: decadeOf(q.year), hCode: q.hCode || null, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, band: q.band || null, ageBand: q.ageBand || null, alt: !!q.alt, line: q.line, lineChars: q.line.length, draws: q.draws, ft3: q.ft3, shapes: countShapes(cls), uses: countUses(cls), raw: Buffer.byteLength(cls, 'utf8'), gz: g, over25: g > BUDGET.perPicture, overLimit: g > limit, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + r[k], 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const decadeMeasured = (list, label, note = '') => { const rs = rows.filter((r) => list.some((q) => q.id === r.id)); const c = chunk(list); return { label, note, pieces: list.length, gzEachSum: rs.length ? sum(rs, 'gz') : null, chunkGz: c, withLines: c + lines(list), withDefs: c + lines(list) + defsGz + cssGz, overMax: c + lines(list) + defsGz + cssGz > BUDGET.perDecadeChunk }; };
const gzAvg = Math.round(sum(rows, 'gz') / rows.length);
const set90Full = [...SET90, R3_1995, R3_1998].sort((a, b) => a.year - b.year);
const decades = [
  decadeMeasured(set90Full, '1990년대 12장 + 승인된 1995·1998(r3)', 'r3 두 장은 class 변환만(사람은 rect)'),
  decadeMeasured(SET00, '2000년대 13장'),
  decadeMeasured(SET10, '2010년대 13장'),
  decadeMeasured(SET20, '2020년대 11장'),
  decadeMeasured(VARIANTS, '계층 변주 8장만'),
];
const ratio = Math.round((decades[1].chunkGz / decades[1].gzEachSum) * 100) / 100;
const measuredAll = { pieces: rows.length + 43, note: '승인 43장(r3 15 + 둘째 1 + r4 27) + r5 49장 = 92장. r5 개별 gzip 합(톤 겹 포함)', r5Sum: sum(rows, 'gz'), r4Sum: 35733 + 1683, r3Sum: 32095 };
const totalEst = { pieces: 92, note: 'r3·r4 실측 합 + r5 실측 합 × 덩어리 비율 + defs·css 1회', lazyEst: Math.round((32095 * 0.83 + 37416 * 0.81 + sum(rows, 'gz') * ratio)) + defsGz + cssGz };
const budget = {
  measuredAt: '2026-10-28', round: 'r5', tone: TONE_ID,
  note: 'r5 49장(1990년대 12 · 2000년대 13 · 2010년대 13 · 2020년대 11, 그중 계층 변주 8 · 무거운 장면 9). gz는 그림 안쪽 마크업(톤 겹 포함)을 class 색·use 사람으로 바꾼 뒤 gzip. chunk는 {id: 마크업} JSON으로 묶어 gzip + 공유 패턴(r3 12 + r5 3)·사람 심볼 defs + 토큰 CSS 1회. 예산(마스터 결정 2026-10-28): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB(변주 포함) · 한 번에 ≤ 75KB.',
  budget: BUDGET, pieces: rows.length, heavy: HEAVY.length, variants: VARIANTS.length, daily: DAILY.length,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), shapesMin: Math.min(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: gzAvg, gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`),
  defsGz, defsR5Gz, cssGz, chunkRatio: ratio, decades, measuredAll, totalEst,
  rows,
};
write('era-window-r5-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 시트
const KIND = { event: '그해의 큰 사건', daily: '그때의 일상' };
const yearLabel = (q) => (q.years && q.years[0] !== q.years[1] ? `${q.years[0]}~${String(q.years[1]).slice(2)}년` : `${q.year}년`);
const stripCap = (q) => `<figcaption class="ew__cap"><span class="ew__year">${q.band ? `${q.years[0]}년대` : yearLabel(q)}${q.heavy ? ' <span class="ew__heavy">○</span>' : ''}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}${q.approved ? ' <span class="ew__ok">승인</span>' : ''}</span></figcaption>`;
const figure = (q, { size = 'pc', cap = true, zoom = false } = {}) => size === 'mobile' ? `<figure class="ew__fig" data-era="${q.id}" data-heavy="${!!q.heavy}" data-band="${q.band || ''}" data-approved="${!!q.approved}" data-size="mobile" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>${stripCap(q)}</figure>` : `<figure class="ew__fig" data-era="${q.id}" data-heavy="${!!q.heavy}" data-band="${q.band || ''}" data-approved="${!!q.approved}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>${cap ? `<figcaption class="ew__cap"><span class="ew__year">${q.band ? `${q.years[0]}년대` : yearLabel(q)} <span class="ew__kindtag">${KIND[q.kind]}${q.alt ? ' · 같은 해 둘째' : ''}</span></span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode ? `${q.hCode} · ` : ''}${q.topic}${q.ageBand ? ` · ${q.ageBand}` : ''}</span>${q.band ? `<span class="ew__band">수저 구간 · ${BAND_LABEL[q.band]}</span>` : ''}${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : ''}${q.approved ? '<span class="ew__ok">승인됨(r3 · 2026-10-28) — 참고로 함께 둠</span>' : ''}${size === 'pc' || zoom ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>` : ''}</figure>`;
const grid = (list) => `<div class="ew__grid" data-tone="${TONE_ID}">${list.filter((q) => !q.band).map((q) => figure(q)).join('')}</div>`;
const pair = (dec) => VARIANTS.filter((q) => q.years[0] === dec).sort((a) => (a.band === 'low' ? -1 : 1));

// R-553 — 360 띠 비교(현재 · A 바탕을 카드와 같게 · B 띠 104px에 그림 130×104) + 1960년대 톤 밝기 전·후
const sample360 = SET90.find((q) => q.id === 'era-1990s-phone-booth-queue');
const s60 = S60.find((q) => q.id === 'era-1965-neighbors-tv') || S60[0];
const s60b = S60.find((q) => q.id === 'era-1961-dawn-tank') || S60[1];
// R-553 모형의 집 그림 자리 — 실제 배경 조각(bg-metro-b2, 640×256)을 인라인으로(검사기의 임시 서버·320px 폭 모두 문제 없게)
const BG = readFileSync(OUT + 'pieces/s1/bg-metro-b2.svg', 'utf8').replace(/^[\s\S]*?<svg/, '<svg').replace(/\swidth="\d+"\sheight="\d+"/, ' class="r553__bg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"').replace(/<!--[\s\S]*?-->/g, '').trim();
const band360 = (variant) => `<div class="r553 r553--${variant}"><div class="r553__house">${BG}<span class="r553__year">1992년</span></div><a class="era r553__era" href="#" aria-label="시대의 창(시안)" data-dec="1990"><span class="era__pic">${svgOf(sample360)}</span></a><p class="r553__line">서울특별시 · 집 · 부모님과 함께</p></div>`;
const toneSixty = (q, bright) => `<figure class="ew__fig" data-size="pc"><div class="ew__pic" data-dec="60" data-bright="${bright ? '1' : '0'}">${svgOf(q)}</div><figcaption class="ew__cap"><span class="ew__year">${q.year}년 · ${bright ? '후 brightness(1.05)' : '전(지금)'}</span></figcaption></figure>`;

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 5차 — 1990~2020년대 마흔아홉 장(SPEC-009, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 5차(1990~2020년대 사건·일상 41장 + 계층 변주 8장). 생성 scripts/design/buildEraWindowR5.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음), 승인 전(approved: false). 사람 조각은 symbol+use, 색은 class(허용 목록 안). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew h3 { font-size: var(--fs-md); margin: var(--sp-4) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
.ew__grid .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__grid .ew__pic { width: 175px; height: 140px; }
.ew__grid .ew__cap { margin-top: 0; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__grid .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__grid .ew__cap { margin-top: var(--sp-2); } }
.ew__fig { margin: 0; min-width: 0; }
.ew__pic { aspect-ratio: 5 / 4; overflow: hidden; background: var(--c-scene-sky); }
.ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin-top: var(--sp-2); font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); word-break: keep-all; }
.ew__year { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__kindtag { font-weight: var(--fw-regular); color: var(--c-text-2); }
.ew__kind, .ew__ok { color: var(--c-text-2); }
.ew__heavy { color: var(--c-era); font-weight: var(--fw-bold); }
.ew__band { color: var(--c-brand); font-weight: var(--fw-bold); }
.ew__draws { color: var(--c-text); font-size: var(--fs-sm); line-height: 1.5; margin-top: var(--sp-1); }
.ew__ft3 { color: var(--c-text-2); font-size: var(--fs-sm); line-height: 1.5; }
.ew__ft3::before { content: '유지선 · '; color: var(--c-text); font-weight: var(--fw-bold); }
.ew__pairs { display: grid; gap: var(--sp-6); }
.ew__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
.ew__pair .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__pair .ew__pic { width: 175px; height: 140px; }
.ew__pair .ew__cap { margin-top: 0; }
.ew__pairhead { font-size: var(--fs-md); font-weight: var(--fw-bold); margin: 0 0 var(--sp-2); }
@media (max-width: 1023px) { .ew__pair { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__pair .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__pair .ew__cap { margin-top: var(--sp-2); } }
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__zoom .ew__cap { font-size: var(--fs-sm); }
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
.ew__strip .ew__cap { font-size: var(--fs-sm); }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
.ew__ask { max-width: 72ch; padding-left: 1.2em; }
.ew__ask li { margin: 0 0 var(--sp-2); }
/* R-553 — 360 카드 모형(폭 326 = 360 − 여백 2×17) 셋을 나란히 */
.r553s { display: flex; flex-wrap: wrap; gap: var(--sp-6); align-items: flex-start; }
.r553 { width: 326px; max-width: 100%; padding: 0 0 var(--sp-3); background: var(--c-surface); border-radius: var(--r-md, 12px); overflow: hidden; }
.r553s > div { max-width: 100%; }
.r553__house { position: relative; height: 130px; background: var(--c-scene-sky); overflow: hidden; }
.r553__bg { display: block; width: 100%; height: 130px; }
.r553__year { position: absolute; top: 8px; right: 8px; padding: 2px 8px; font-size: var(--fs-sm); font-weight: var(--fw-bold); background: var(--c-surface); border-radius: var(--r-sm); }
.r553__era { display: block; margin-top: 8px; height: 80px; background: var(--c-surface-2); text-decoration: none; }
.r553__era .era__pic { display: block; width: 100px; height: 80px; min-height: 0; overflow: hidden; background: var(--c-scene-sky); }
.r553__era .era__pic svg { display: block; width: 100%; height: 100%; }
.r553--a .r553__era { background: var(--c-surface); }
.r553--b .r553__era { height: 104px; } .r553--b .r553__era .era__pic { width: 130px; height: 104px; }
.r553__line { margin: var(--sp-3) var(--sp-4) 0; font-size: var(--fs-sm); font-weight: var(--fw-bold); }
.r553__cap { width: 326px; max-width: 100%; font-size: var(--fs-sm); color: var(--c-text-2); margin: var(--sp-2) 0 0; }
.ew__sixty { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__sixty .ew__pic { width: 175px; height: 140px; }
.ew [data-dec="60"][data-bright="1"] svg { filter: ${TONE.a.filter[60]} brightness(1.05); }
:root[data-theme="dark"] .ew [data-dec="60"][data-bright="1"] svg { filter: ${TONE.a.dark[60]} brightness(1.04); }
@media (forced-colors: active) { .ew__pic, .r553__era .era__pic { border: 1px solid CanvasText; } }
${toneCssA('.ew')}
${toneCssA('.r553s')}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
<main class="ew">
<h1>시대의 창 5차 — 1990~2020년대와 계층 변주</h1>
<p class="ew__lead">승인된 43장 다음 묶음입니다. 1990~2025년 해마다 한 장이 닿도록 사건 있는 해는 사건(1990 신도시 공사 · 1991 노래방 · 1993 시험장 교문 · 1994 끊긴 다리 · 1997 새벽 인력시장 · 1998 역 광장 급식 줄 · 1999 새천년의 밤 · 2000 피시방 · 2001 폴더 휴대전화 · 2002 거리 응원 · 2003 지하철역 입구의 연기 · 2004 고속열차 · 2005~06 부동산 유리창 · 2008 여름밤 촛불 · 2009 광장의 조문 줄 · 2010 서해의 수색 · 2012 공연장 · 2014 기울어진 배와 노란 리본 · 2015 마스크 줄 · 2016 겨울 광장의 촛불 · 2017 지진 뒤의 골목 · 2018 휴대전화 속 그래프 · 2019 세로 화면 · 2020 선별진료소 · 2021 빈 교실 · 2022 좁은 골목의 통제선과 꽃 · 2023 마트 저울 · 2024 화면 속 말풍선 · 2025 시간표), 없는 해는 그때의 일상(공중전화 줄 · 야간 자율학습 · 아파트 놀이터 · 미니홈피 · 분식집 · 편의점 밤 근무 · 지하철의 휴대전화 · 혼자 먹는 자리 · 학원 버스 · 식탁 재택 · 배달 골목 · 키오스크 줄)을 그렸습니다. 계층 변주는 10년마다 아래·위 한 장씩(옥탑방 / 신도시 거실 · 고시원 / 학원가 · 원룸 / 출국장 · 물류센터 셔틀 / 고층 거실)입니다. 무거운 장면 아홉은 「현장까지 그리고, 순간은 그리지 않는다」 기준이고 사람은 모두 뒷모습·옆모습·먼 인물입니다. 톤은 1990년대 선명한 컬러, 2000년대부터 망점 없는 디지털입니다. 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r5.html">라이트</a><a href="era-window-r5.html?theme=dark">다크</a><a href="era-window-r4.html">4차 시트(승인된 27장)</a><a href="era-window-r3.html">3차 시트(승인된 15장)</a></nav>

<h2>1990년대 — 열 장(+ 승인된 1995 삼풍 · 1997~98 금 모으기)</h2>
<p class="ew__note">선명한 컬러(세피아 .05, 망점 .04). 1992·1996년은 일상(공중전화 줄·야간 자율학습·놀이터)이 메웁니다. 1997년 새벽 인력시장이 들어가면 금 모으기의 해는 1998년만 남습니다(developer TRIM). 1998년은 금 모으기(승인)와 역 광장 급식 줄 둘 — 무겁지 않아 hash로 하나입니다.</p>
${grid(set90Full)}

<h2>2000년대 — 열한 장</h2>
<p class="ew__note">망점과 종이 겹이 사라진 디지털 톤입니다. 2007년은 일상(미니홈피·분식집·편의점)이 메웁니다. 2009년은 5월 광장의 조문 줄로 그렸습니다(영정·이름·장례 행렬 0 — 1979 선례). 1월의 참사로 바꿀지는 아래 물음.</p>
${grid(SET00)}

<h2>2010년대 — 열한 장</h2>
<p class="ew__note">필터 없음. 2011·2013년은 일상(지하철·혼자 먹는 자리·학원 버스)이 메웁니다. 2014년은 마스터 결정(기울어진 배·바다·구조 현장·노란 리본), 2017년은 11월 지진으로 그렸습니다(2016 광장은 2016년만).</p>
${grid(SET10)}

<h2>2020년대 — 아홉 장</h2>
<p class="ew__note">코로나19는 가리기 대상 밖(형진 님 결정). 2022년은 이튿날의 좁은 골목·통제선·추모 꽃까지입니다(인파·압사 순간 0). 2026년 이후는 2025 세트를 유지합니다.</p>
${grid(SET20)}

<h2>1990~2020년대 — 계층 변주 여덟 장</h2>
<p class="ew__note">사건 없는 해의 일상을 플레이어의 수저 구간에 따라 다르게 보여 줍니다(형진 님 결정). 아래 둘(흙수저 쪽)과 위 둘(금수저 쪽)에서만 보이고 가운데는 기본 일상을 봅니다. 조롱이나 낙인 없이 「그 집의 현실」 — 둘 다 정돈된 살림·단정한 사람이고 공간과 물건, 가는 곳이 다릅니다.</p>
<div class="ew__pairs">${[1990, 2000, 2010, 2020].map((d) => `<div><p class="ew__pairhead">${d}년대 · 아래 / 위</p><div class="ew__pair" data-tone="${TONE_ID}">${pair(d).map((q) => figure(q)).join('')}</div></div>`).join('')}</div>

<h2>크게 보기 350×280 — 무거운 장면 아홉</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다. 1994 끊긴 다리 · 2003 지하철역 입구 · 2008 여름밤 촛불 · 2009 조문 줄 · 2010 서해의 수색 · 2014 기울어진 배 · 2016 겨울 광장 · 2017 지진 뒤 골목 · 2022 좁은 골목. 대구 지하철·세월호·이태원은 피해자와 유족이 생존해 있는 사건이라 장면마다 판단을 유지선 줄에 적었습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${HEAVY.map((q) => figure(q, { zoom: true })).join('')}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 쉰한 장(승인된 1995·1998 포함)이 이 크기에서 읽히는지 보는 줄입니다. 캡션은 해와 표시(○ 무거움 · 아래/위 수저 구간)만.</p>
<div class="ew__strip" data-tone="${TONE_ID}">${[...set90Full, ...SET00, ...SET10, ...SET20].map((q) => figure(q, { size: 'mobile' })).join('')}</div>

<h2>후속 R-553 — 360 띠의 빈 바탕 · 1960년대 톤 밝기</h2>
<p class="ew__note">검수(REV-009-FM5-2 R-553): 360 띠는 그림이 100×80이고 오른쪽이 빈 바탕이라 로딩 실패처럼 읽힐 수 있다. 아래는 360 카드 모형(폭 326) 셋 — 지금 · <b>A 띠 바탕을 카드 바탕(--c-surface)과 같게</b> · B 띠를 104px로 키워 그림 130×104. 추천 <b>A</b>: 「그림만」 결정(FM2d)과 띠 높이 80(5-1절 실측 ≈ 25vh 안)을 지키면서 빈 바탕이 「카드 위에 놓인 그림 한 장」으로 읽힌다. B는 띠 합계 130 + 8 + 104 = 242px로 360×740에서 33vh — 25vh 기준을 넘는다. <code>family.css</code> 값은 developer 몫 — era-window.md 9-4절에 적었다.</p>
<div class="r553s" data-tone="${TONE_ID}">
<div>${band360('now')}<p class="r553__cap">지금 — 띠 바탕 --c-surface-2, 그림 100×80</p></div>
<div>${band360('a')}<p class="r553__cap">A(추천) — 띠 바탕을 카드 바탕 --c-surface로. 바뀌는 값 1개</p></div>
<div>${band360('b')}<p class="r553__cap">B — 띠 104px, 그림 130×104. 띠 합계 242px(33vh)</p></div>
</div>
<h3>1960년대 톤 — 저녁 장면의 뭉침</h3>
<p class="ew__note">지금 필터 <code>${TONE.a.filter[60]}</code> → 후 <code>${TONE.a.filter[60]} brightness(1.05)</code>(다크 <code>${TONE.a.dark[60]} brightness(1.04)</code>). 1965 이웃집 TV(저녁)와 1961 새벽 거리에서 전·후를 나란히 둔다 — 세피아 단계(1950년대 .55 → 1960년대 .42 → 1970년대 .3)는 그대로이고 밝기만 한 단 올린다.</p>
<div class="ew__sixty">${toneSixty(s60, false)}${toneSixty(s60, true)}${toneSixty(s60b, false)}${toneSixty(s60b, true)}</div>

<h2>인생 기록 줄 문장 · 유지선 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">해</th><th scope="col">종류</th><th scope="col">수저 구간</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col">유지선 판단</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.band ? `${r.years[0]}년대` : r.years[0] !== r.years[1] ? `${r.years[0]}~${String(r.years[1]).slice(2)}` : r.year}</td><td>${KIND[r.kind]}${r.heavy ? ' <span class="ew__heavy">· 무거움</span>' : ''}${r.alt ? ' · 둘째' : ''}</td><td>${r.band ? BAND_LABEL[r.band] : '모든 구간'}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="ok">${r.ft3}</td><td class="num">${r.shapes}(${r.uses})</td><td class="num">${r.gz}B${r.overLimit ? ' · 상한 초과' : r.over25 ? ' · 2.5KB 초과(무거운 장면 3.5KB 안)' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">마흔아홉 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${gzAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}). 조각 평균 ${budget.shapesAvg}개(use ${budget.usesAvg}). 10년 덩어리(한 줄·공유 패턴·사람 심볼·토큰 CSS 포함): 1990년대(승인된 두 장 포함) ${decades[0].withDefs.toLocaleString('ko-KR')}B · 2000년대 ${decades[1].withDefs.toLocaleString('ko-KR')}B · 2010년대 ${decades[2].withDefs.toLocaleString('ko-KR')}B · 2020년대 ${decades[3].withDefs.toLocaleString('ko-KR')}B. 공유 defs ${defsGz}B(r5 패턴 셋 ${defsR5Gz}B) + 토큰 CSS ${cssGz}B는 덩어리마다가 아니라 한 번입니다. 92장(승인 43 + 이번 49) 누적 추정 ≈ ${(totalEst.lazyEst / 1024).toFixed(1)}KB(누적 ≤ 230KB 안). 예산: 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 정본 수치는 era-window-r5-budget.json.</p>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>2009년</b>을 5월 광장의 조문 줄(조기·국화·노란 리본, 영정·이름 0)로 그렸습니다. 1월의 철거 현장 참사로 바꾸거나, 2009년을 무겁지 않은 해(첫 스마트폰)로 둘지 정해 주세요. 2017년은 11월 지진으로 그렸습니다(광장은 2016년만).</li>
<li><b>세 사건의 수위</b> — 2003 지하철역 입구(검은 연기·호스를 끌고 들어가는 소방관·통제선), 2014 바다(기울어진 배·보트·헬기·난간의 리본), 2022 골목(이튿날의 통제선·국화·빈 쪽지)이 「현장까지, 순간은 아님」에 맞는지. 더 멀리 둘지(예: 2003은 연기만, 2022는 꽃만) 여기서 멈출지.</li>
<li><b>1998년 둘째 그림</b>(역 광장의 급식 줄)과 1997년 새벽 인력시장처럼 외환위기의 생활 장면을 더 두어도 되는지 — 낙인 없이 그렸지만 그해 플레이어가 흙수저면 더 무겁게 읽힐 수 있습니다.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r5.html', html);

console.log(`시대의 창 r5: ${rows.length}장 · 무거운 장면 ${HEAVY.length} · 변주 ${VARIANTS.length} · 일상 ${DAILY.length} · 장당 gzip 평균 ${gzAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B(r5 ${defsR5Gz}) + css ${cssGz}B`);
for (const r of rows) console.log(`${r.years[0]}${r.years[0] !== r.years[1] ? `~${r.years[1]}` : ''} ${r.id}: ${KIND[r.kind]} ${r.topic}${r.heavy ? '(무거움)' : ''}${r.band ? `(${r.band})` : ''} · 조각 ${r.shapes}(use ${r.uses}) · gz ${r.gz}${r.overLimit ? ' !!상한' : r.over25 ? ' !2.5KB' : ''} · 「${r.line}」(${r.lineChars})`);
for (const d of decades) console.log(`${d.label}: 덩어리 ${d.chunkGz}B · 한 줄·defs·css 포함 ${d.withDefs}B${d.overMax ? ' !!24KB 초과' : ''}`);
console.log(`92장 누적 추정 ${totalEst.lazyEst}B`);

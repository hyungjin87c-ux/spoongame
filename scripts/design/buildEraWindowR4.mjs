/**
 * SPEC-009 「시대의 창」 4차 시안 생성기 (designer 2026-10-28, r4 — 형진 님 승인 r3 15장 뒤 「다음 묶음」: 1940~60년대 + 1970~80년대 계층 변주).
 *
 * 정본: `docs/design/era-window.md` r3 끝 「형진 님 승인 · 마스터 결정(2026-10-28, r3)」, SPEC-009 FT3 r4. 수위 = 「현장까지 그리고, 순간(구타·총격·구조되는 사람)은 그리지 않는다」.
 * 장면: `eraR4Scenes.mjs` — 1940년대 6(○2) · 1950년대 7(○1, 1950 피란은 r3 승인분) · 1960년대 10(○2) · 계층 변주 4(1970·80년대 아래/위) = 27장.
 * 예산(마스터 결정): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB(변주 포함) · 한 번에 ≤ 75KB. 사람은 `<symbol>`+`<use>`, 색은 `class`(`eraR4Lib.mjs`).
 *
 * 실행: node scripts/design/buildEraWindowR4.mjs
 * 산출: docs/design/mockups/family/era-window-r4.html · pieces/era-r4/<id>.svg(27) · era-window-r4-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. r1~r3 산출물은 그대로 둔다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, FIG_DEFS, tokenCss, toClass, decadeOf, toneLayer, toneCssA } from './eraR4Lib.mjs';
import { SCENES, SET40, SET50, SET60, VARIANTS, HEAVY } from './eraR4Scenes.mjs';
import { HEAVY as R3HEAVY } from './eraR3ScenesHeavy.mjs';
import { SET_7080 } from './eraR3Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r4', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const BAND_LABEL = { low: '아래 둘(흙수저 쪽)', high: '위 둘(금수저 쪽)' };
const R3_1950 = R3HEAVY.find((q) => q.id === 'era-1950-refugee-column');
if (!R3_1950) throw new Error('r3 1950 피란 장면을 찾지 못함');
const APPROVED_1950 = { ...R3_1950, approved: true, r3: true };
for (const q of SCENES) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws) throw new Error(`유지선 판단(ft3)·그리는 것(draws) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
}
if (SCENES.length !== 27) throw new Error(`장면 ${SCENES.length}장(27 기대)`);
if (HEAVY.length !== 5) throw new Error(`무거운 장면 ${HEAVY.length}(5 기대 — 1945·1948·1952·1960·1961)`);
if (VARIANTS.length !== 4 || VARIANTS.filter((q) => q.band === 'low').length !== 2) throw new Error('계층 변주 4장(아래 2 · 위 2) 기대');
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000 };
const DEFS = ERA_DEFS_R3 + FIG_DEFS;
const defsGz = gz(DEFS), figDefsGz = gz(FIG_DEFS), cssGz = gz(tokenCss());
const pieceSvg = (q, note) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r4 · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.hCode || '일상'} · ${q.topic}${q.band ? ` · 계층 변주 ${BAND_LABEL[q.band]}` : ''}${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''} · ${note} · 새로 구성(사진 모사 없음, 얼굴 식별 없음) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 톤 A는 CSS 필터 + 한 겹 --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = SCENES.map((q) => {
  const raw = q.draw() + toneLayer(TONE_ID, q.year);
  const cls = toClass(raw);
  write(`pieces/era-r4/${q.id}.svg`, pieceSvg(q, '승인 전(approved: false)'));
  const g = gz(cls);
  const limit = q.heavy ? BUDGET.perPictureCrowdHeavy : BUDGET.perPicture;
  return { id: q.id, year: q.year, years: q.years || [q.year, q.year], decade: decadeOf(q.year), hCode: q.hCode || null, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, band: q.band || null, ageBand: q.ageBand || null, line: q.line, lineChars: q.line.length, draws: q.draws, ft3: q.ft3, shapes: countShapes(cls), uses: countUses(cls), raw: Buffer.byteLength(cls, 'utf8'), gzVarFill: gz(raw), gz: g, over25: g > BUDGET.perPicture, overLimit: g > limit, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + r[k], 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const decadeMeasured = (list, label, note = '') => { const rs = rows.filter((r) => list.some((q) => q.id === r.id)); const c = chunk(list); return { label, note, pieces: list.length, gzEachSum: rs.length ? sum(rs, 'gz') : null, chunkGz: c, withLines: c + lines(list), withDefs: c + lines(list) + defsGz + cssGz, overMax: c + lines(list) + defsGz + cssGz > BUDGET.perDecadeChunk }; };
const gzAvg = Math.round(sum(rows, 'gz') / rows.length);
const gzAvgVar = Math.round(sum(rows, 'gzVarFill') / rows.length);
const set50Full = [APPROVED_1950, ...SET50];
const set70Full = [...SET_7080.filter((q) => q.year < 1980), ...VARIANTS.filter((q) => q.years[0] === 1970)];
const set80Full = [...SET_7080.filter((q) => q.year >= 1980), ...VARIANTS.filter((q) => q.years[0] === 1980)];
const decades = [
  decadeMeasured(SET40, '1940년대 6장'),
  decadeMeasured(set50Full, '1950년대 7장 + 승인된 1950 피란(r3)', '1950 피란은 r3 조각 그대로(class 변환만)'),
  decadeMeasured(SET60, '1960년대 10장'),
  decadeMeasured(set70Full, '1970년대 r3 5장 + 변주 2장', 'r3 조각은 사람이 rect(아직 use로 안 바꿈) — 변주 2장만 use'),
  decadeMeasured(set80Full, '1980년대 r3 7장 + 변주 2장', 'r3 조각은 사람이 rect(아직 use로 안 바꿈) — 변주 2장만 use'),
  decadeMeasured(VARIANTS, '계층 변주 4장만'),
];
const chunk7080r3 = chunk(SET_7080);
const measuredAll = { pieces: rows.length + 16, note: 'r3 15장 + 둘째 1 + r4 27장 = 43장 실측(개별 gzip 합, 톤 겹 포함)', r4Sum: sum(rows, 'gz') };
/** 전체 추정 — 목록 104장 + 변주 18 = 122장. r4 평균(class·use)으로 늘리고 덩어리 비율은 이번 실측(덩어리/개별합)을 쓴다 */
const ratio = Math.round((decades[2].chunkGz / decades[2].gzEachSum) * 100) / 100;
const PLAN = { event: 68, daily: 36, variantDaily: 18, decades: 9 };
const est = (n) => { const c = Math.round(gzAvg * n * ratio); return { pieces: n, chunkEst: c, withLines: c + Math.round(lines(SCENES) / SCENES.length) * n, withDefsOnce: c + Math.round(lines(SCENES) / SCENES.length) * n + defsGz + cssGz }; };
const budget = {
  measuredAt: '2026-10-28', round: 'r4', tone: TONE_ID,
  note: 'r4 27장(1940년대 6 · 1950년대 7 · 1960년대 10 · 1970~80년대 계층 변주 4). gz는 그림 안쪽 마크업(톤 겹 포함)을 class 색·use 사람으로 바꾼 뒤 gzip, gzVarFill은 같은 그림을 r3 방식(fill="var(…)")으로 잰 값. chunk는 {id: 마크업} JSON으로 묶어 gzip + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회. 예산(마스터 결정 2026-10-28): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB(변주 포함) · 한 번에 ≤ 75KB.',
  budget: BUDGET, pieces: rows.length, heavy: HEAVY.length, variants: VARIANTS.length,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), shapesMin: Math.min(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: gzAvg, gzEachAvgVarFill: gzAvgVar, savingVsVarFill: Math.round((1 - gzAvg / gzAvgVar) * 100), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`),
  defsGz, figDefsGz, cssGz, chunkRatio: ratio, chunk7080r3, decades, measuredAll,
  plan: { ...PLAN, total: est(PLAN.event + PLAN.daily), totalWithVariants: est(PLAN.event + PLAN.daily + PLAN.variantDaily), perDecadeWithVariants: est(Math.ceil((PLAN.event + PLAN.daily + PLAN.variantDaily) / PLAN.decades)) },
  rows,
};
write('era-window-r4-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 시트
const KIND = { event: '그해의 큰 사건', daily: '그때의 일상' };
const yearLabel = (q) => (q.years && q.years[0] !== q.years[1] ? `${q.years[0]}~${String(q.years[1]).slice(2)}년` : `${q.year}년`);
const figure = (q, { size = 'pc', cap = true, zoom = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-heavy="${!!q.heavy}" data-band="${q.band || ''}" data-approved="${!!q.approved}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>${cap ? `<figcaption class="ew__cap"><span class="ew__year">${q.band ? `${q.years[0]}년대` : yearLabel(q)} <span class="ew__kindtag">${KIND[q.kind]}</span></span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode ? `${q.hCode} · ` : ''}${q.topic}${q.ageBand ? ` · ${q.ageBand}` : ''}</span>${q.band ? `<span class="ew__band">수저 구간 · ${BAND_LABEL[q.band]}</span>` : ''}${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : ''}${q.approved ? '<span class="ew__ok">승인됨(r3 · 2026-10-28) — 참고로 함께 둠</span>' : ''}${size === 'pc' || zoom ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>` : ''}</figure>`;
const pair = (dec) => VARIANTS.filter((q) => q.years[0] === dec).sort((a) => (a.band === 'low' ? -1 : 1));
const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 4차 — 1940~60년대 스물세 장과 계층 변주 네 장(SPEC-009, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 4차(1940~60년대 + 1970~80년대 계층 변주). 생성 scripts/design/buildEraWindowR4.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음), 승인 전(approved: false). 사람 조각은 symbol+use, 색은 class(마스터 예산 결정). -->
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
/* PC 칸 175×140 그대로, 캡션(그리는 것 · 유지선)은 그림 오른쪽. 두 장씩 한 줄 */
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
/* 계층 변주 — 10년마다 아래·위 한 쌍 */
.ew__pairs { display: grid; gap: var(--sp-6); }
.ew__pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
.ew__pair .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__pair .ew__pic { width: 175px; height: 140px; }
.ew__pair .ew__cap { margin-top: 0; }
.ew__pairhead { font-size: var(--fs-md); font-weight: var(--fw-bold); margin: 0 0 var(--sp-2); }
@media (max-width: 1023px) { .ew__pair { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__pair .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__pair .ew__cap { margin-top: var(--sp-2); } }
/* 확대 보기 — 350×280(2배) */
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__zoom .ew__cap { font-size: var(--fs-sm); }
/* 휴대폰 띠 크기(100×80) — 그림만 */
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
.ew__strip .ew__cap { font-size: var(--fs-sm); }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
/* 톤 A — 10년대별 CSS 필터(그림 바이트 0). 다크는 필터를 약하게 */
${toneCssA('.ew')}
/* 토큰 → 클래스(r4 — 색은 class, 사람 심볼 변수) */
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
<main class="ew">
<h1>시대의 창 4차 — 1940~60년대와 계층 변주</h1>
<p class="ew__lead">3차 열다섯 장이 승인된 뒤의 다음 묶음, 1940~60년대 스물세 장과 1970~80년대 계층 변주 네 장입니다. 1940~60년대는 해마다 한 장이 닿도록 사건 있는 해는 사건(1945 광복의 거리 · 1948 투표소 앞 줄 · 1952 폐허의 서울 · 1953 천막 교실 · 1954~56 배급 줄 · 1957~59 새 기와 · 1960 4월 거리 · 1961 새벽의 탱크 · 1962 2부제 교문 · 1963 방직 공장 · 1964 공항 · 1966 완행열차 · 1968 도로 공사 · 1969 추첨 강당), 없는 해는 그때의 일상(초가 마당 · 노천 수업 · 우물가 · 장날 · 라디오 · 구슬치기 · 보릿고개 · 이웃집 텔레비전 · 아궁이 부엌)을 그렸습니다. 1970~80년대는 형진 님 결정대로 수저 구간별 일상(셋방 석유곤로 / 양옥 피아노 · 반지하 / 아파트 전축)을 더했습니다. 무거운 장면 다섯은 「현장까지 그리고, 순간은 그리지 않는다」 기준이고, 사람은 모두 뒷모습·옆모습·먼 인물입니다. 이번부터 사람 조각은 심볼 참조, 색은 클래스입니다(예산 결정). 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r4.html">라이트</a><a href="era-window-r4.html?theme=dark">다크</a><a href="era-window-r3.html">3차 시트(승인된 15장)</a><a href="dashboard-family.html?scene=a&amp;era=stadium&amp;decision=fold">대시보드 자리(FM2d)</a></nav>

<h2>1940년대 — 여섯 장</h2>
<p class="ew__note">세피아가 가장 짙은 10년대입니다. 1940~44년은 일상(마당·노천 수업), 1945년은 거리로 나온 사람들, 1946~47년은 우물가, 1948년은 첫 선거의 투표소 줄, 1949년은 장날입니다. 캡션은 해 · 이름 · 분류 · 그리는 것 · 유지선 판단 순입니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${SET40.map((q) => figure(q)).join('')}</div>

<h2>1950년대 — 일곱 장(+ 승인된 1950~51 피란)</h2>
<p class="ew__note">1950~51년은 3차에서 승인된 피란 행렬을 그대로 쓰고, 1952년은 폐허 속 판잣집(무거움), 1953년은 천막 교실, 1954~56년은 구호물자 배급 줄, 1957~59년은 새 기와 올리기입니다. 일상은 라디오 앞 식구·골목 구슬치기·보릿고개의 봄 들판입니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${set50Full.map((q) => figure(q)).join('')}</div>

<h2>1960년대 — 열 장</h2>
<p class="ew__note">사건만으로 열 해가 모두 닿습니다(1962·65 교문, 1966·67 승강장은 두 해 공유). 일상 두 장(이웃집 텔레비전·아궁이 부엌)은 나이대 맞춤과 가리기 켬 때의 대체용입니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${SET60.map((q) => figure(q)).join('')}</div>

<h2>1970~80년대 — 계층 변주 네 장</h2>
<p class="ew__note">사건 없는 해의 일상을 플레이어의 수저 구간에 따라 다르게 보여 줍니다(형진 님 결정). 아래 둘(흙수저 쪽)과 위 둘(금수저 쪽)에서만 보이고 가운데는 기본 일상을 봅니다. 조롱이나 낙인 없이 「그 집의 현실」 — 둘 다 단정한 살림이고 물건과 공간의 크기만 다릅니다.</p>
<div class="ew__pairs">${[1970, 1980].map((d) => `<div><p class="ew__pairhead">${d}년대 · 아래 / 위</p><div class="ew__pair" data-tone="${TONE_ID}">${pair(d).map((q) => figure(q)).join('')}</div></div>`).join('')}</div>

<h2>크게 보기 350×280 — 무거운 장면 다섯</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다. 1945 거리 · 1948 투표소 · 1952 폐허 · 1960 4월 거리 · 1961 새벽의 탱크.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${HEAVY.map((q) => figure(q, { zoom: true })).join('')}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 스물여덟 장(승인된 1950 포함)이 이 크기에서 읽히는지 보는 줄입니다.</p>
<div class="ew__strip" data-tone="${TONE_ID}">${[...SET40, ...set50Full, ...SET60, ...VARIANTS].map((q) => figure(q, { size: 'mobile' })).join('')}</div>

<h2>인생 기록 줄 문장 · 유지선 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">해</th><th scope="col">종류</th><th scope="col">수저 구간</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col">유지선 판단</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.band ? `${r.years[0]}년대` : r.years[0] !== r.years[1] ? `${r.years[0]}~${String(r.years[1]).slice(2)}` : r.year}</td><td>${KIND[r.kind]}${r.heavy ? ' <span class="ew__heavy">· 무거움</span>' : ''}</td><td>${r.band ? BAND_LABEL[r.band] : '모든 구간'}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="ok">${r.ft3}</td><td class="num">${r.shapes}(${r.uses})</td><td class="num">${r.gz}B${r.overLimit ? ' · 상한 초과' : r.over25 ? ' · 2.5KB 초과(무거운 장면 3.5KB 안)' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">스물일곱 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${gzAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}) — 같은 그림을 r3 방식(fill 변수)으로 재면 ${gzAvgVar}B라 class·use로 ${budget.savingVsVarFill}% 줄었습니다. 조각 평균 ${budget.shapesAvg}개(use ${budget.usesAvg}). 10년 덩어리(한 줄·공유 패턴·사람 심볼·토큰 CSS 포함): 1940년대 ${decades[0].withDefs.toLocaleString('ko-KR')}B · 1950년대(승인된 피란 포함) ${decades[1].withDefs.toLocaleString('ko-KR')}B · 1960년대 ${decades[2].withDefs.toLocaleString('ko-KR')}B · 1970년대(r3 5장 + 변주 2장) ${decades[3].withDefs.toLocaleString('ko-KR')}B · 1980년대(r3 7장 + 변주 2장) ${decades[4].withDefs.toLocaleString('ko-KR')}B. 공유 defs ${defsGz}B(사람 심볼 ${figDefsGz}B) + 토큰 CSS ${cssGz}B는 덩어리마다가 아니라 한 번입니다. 122장 전체 추정 ≈ ${(budget.plan.totalWithVariants.withDefsOnce / 1024).toFixed(1)}KB(누적 ≤ 230KB 안), 10년 덩어리 ≈ ${(budget.plan.perDecadeWithVariants.withDefsOnce / 1024).toFixed(1)}KB. 예산: 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 정본 수치는 era-window-r4-budget.json.</p>
</main>
</body>
</html>
`;
write('era-window-r4.html', html);

console.log(`시대의 창 r4: ${rows.length}장 · 무거운 장면 ${HEAVY.length} · 변주 ${VARIANTS.length} · 장당 gzip 평균 ${gzAvg}B(var 방식 ${gzAvgVar}B, −${budget.savingVsVarFill}%; 최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B(심볼 ${figDefsGz}) + css ${cssGz}B`);
for (const r of rows) console.log(`${r.years[0]}${r.years[0] !== r.years[1] ? `~${r.years[1]}` : ''} ${r.id}: ${KIND[r.kind]} ${r.topic}${r.heavy ? '(무거움)' : ''}${r.band ? `(${r.band})` : ''} · 조각 ${r.shapes}(use ${r.uses}) · gz ${r.gz}${r.overLimit ? ' !!상한' : r.over25 ? ' !2.5KB' : ''} · 「${r.line}」(${r.lineChars})`);
for (const d of decades) console.log(`${d.label}: 덩어리 ${d.chunkGz}B · 한 줄·defs·css 포함 ${d.withDefs}B${d.overMax ? ' !!24KB 초과' : ''}`);
console.log(`r3 1970~80년대 12장 덩어리(참고) ${chunk7080r3}B · 122장 추정 전체 ${budget.plan.totalWithVariants.withDefsOnce}B · 10년 덩어리 ${budget.plan.perDecadeWithVariants.withDefsOnce}B`);

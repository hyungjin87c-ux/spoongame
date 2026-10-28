/**
 * SPEC-009 「시대의 창」 3차 시안 생성기 (designer 2026-10-28, r3 — 형진 님 결정: 톤 A · 일상에 사람 · FT3 r4 「가감 없이, 현실적으로」).
 *
 * 정본: SPEC-009 FT2·FT3(r4)·FT5, `docs/design/family-scene.md` 5절, `docs/design/era-window.md` r3. 그림 규칙·도우미는 `eraR3Lib.mjs`(r2 lib 위에 사람·군중·연기·차량).
 * 장면: `eraR3Scenes.mjs` — 1970~80년대 12장(일상 6 + 사건 3 + 무거운 3) + 다른 시대 무거운 장면 샘플 3(1950 피란 · 1995 삼풍 · 1998 금 모으기) + 1987 둘째 그림(12월 투표소).
 * 톤: A 「바랜 인쇄물」만(형진 님 결정) — CSS 필터(10년대별) + 그림 안 망점·종이 겹. 모두 새로 구성(사진 모사 0), 승인 전(approved: false).
 *
 * 실행: node scripts/design/buildEraWindowR3.mjs
 * 산출: docs/design/mockups/family/era-window-r3.html · pieces/era-r3/<id>.svg(16) · era-window-r3-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. r1·r2 산출물은 그대로 둔다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3 as ERA_DEFS, decadeOf, toneLayer, toneCssA } from './eraR3Lib.mjs';
import { SCENES, MAIN, ALT, SET_7080, SAMPLES } from './eraR3Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r3', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
for (const q of SCENES) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws) throw new Error(`유지선 판단(ft3)·그리는 것(draws) 빠짐: ${q.id}`);
}
if (MAIN.length !== 15) throw new Error(`본 그림 ${MAIN.length}장(15 기대)`);
const heavy = MAIN.filter((q) => q.heavy);
if (heavy.length < 5) throw new Error('무거운 장면 5장 이상(1979·1980·1987·1950·1995)');
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${q.draw()}${toneLayer(TONE_ID, q.year)}</svg>`;

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse)\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 1500, perPictureMax: 2500, perDecadeChunk: 16000, perDecadeChunkMax: 24000, totalLazy: 110000, perLoad: 75000 };
const rows = SCENES.map((q) => {
  const inner = q.draw();
  const layer = toneLayer(TONE_ID, q.year);
  write(`pieces/era-r3/${q.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r3 · ${q.id} · ${q.year} · ${q.hCode || '일상'} · ${q.topic}${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''} · 승인 전(approved: false) · 새로 구성(사진 모사 없음, 얼굴 식별 없음) · 색은 --c-scene-* 토큰, 톤 A는 CSS 필터 + 한 겹 --><defs>${ERA_DEFS}</defs><g>${inner}${layer}</g></svg>\n`);
  const g = gz(inner + layer);
  const asClass = (inner + layer).replace(/fill="var\(--c-scene-([a-z0-9]+),#[0-9a-f]{6}\)"/g, 'class="$1"').replace(/fill="var\(--c-scene-([a-z0-9]+),rgba\([^)]*\)\)"/g, 'class="$1"').replace(/stroke="var\(--c-scene-([a-z0-9]+),[^"]*\)"/g, 'class="s-$1"');
  const gzClass = gz(asClass);
  return { id: q.id, year: q.year, years: q.years || [q.year, q.year], decade: decadeOf(q.year), hCode: q.hCode || null, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, alt: !!q.alt, ageBand: q.ageBand || null, line: q.line, lineChars: q.line.length, draws: q.draws, ft3: q.ft3, shapes: countShapes(inner), raw: Buffer.byteLength(inner, 'utf8'), gz: gz(inner), gzWithTone: g, gzClassFill: gzClass, overBudget: g > BUDGET.perPicture, overMax: g > BUDGET.perPictureMax, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + r[k], 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.draw() + toneLayer(TONE_ID, q.year)]))));
const defsGz = gz(ERA_DEFS);
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const main = rows.filter((r) => !r.alt);
const r7080 = rows.filter((r) => !r.alt && r.year >= 1970 && r.year < 1990);
const set70 = SET_7080.filter((q) => q.year < 1980), set80 = SET_7080.filter((q) => q.year >= 1980);
const gzAvg = Math.round(sum(main, 'gzWithTone') / main.length);
const chunk7080 = chunk(SET_7080);
const ratio = Math.round((chunk7080 / sum(r7080, 'gzWithTone')) * 100) / 100;
const perLine = Math.round(lines(MAIN) / MAIN.length);
/** r3 목록(era-window.md 4절): 사건 61 + 대안 7 + 일상 36 = 104장, 10년 하위 덩어리 9(≈ 12장) · 계층 변주를 넣으면 +18 */
const PLAN = { event: 68, daily: 36, decades: 9, variantDaily: 18 };
const est = (n) => { const c = Math.round(gzAvg * n * ratio); return { pieces: n, gzEachSum: gzAvg * n, chunkEst: c, withLines: c + perLine * n, withDefs: c + perLine * n + defsGz }; };
const decadeMeasured = (list, label) => { const rs = rows.filter((r) => list.some((q) => q.id === r.id)); const c = chunk(list); return { label, pieces: list.length, gzEachSum: sum(rs, 'gzWithTone'), chunkGz: c, withLines: c + lines(list), withDefs: c + lines(list) + defsGz, shapesAvg: Math.round(sum(rs, 'shapes') / rs.length) }; };
const budget = {
  measuredAt: '2026-10-28', round: 'r3', tone: TONE_ID,
  note: 'r3 15장(1970~80년대 12 + 다른 시대 무거운 장면 샘플 3) + 1987 둘째 그림 1(alt, 집계 밖). gz는 그림 안쪽 마크업, gzWithTone은 톤 한 겹까지. chunk는 {id: 마크업} JSON으로 묶어 gzip + 공유 패턴 defs 1회. plan은 목록 104장(+계층 변주 18)을 본 그림 15장의 장당 평균으로 늘린 추정. 예산(마스터 승인 2026-10-28): 장당 ≤ 1.5KB(현실적 묘사로 늘면 ≤ 2.5KB) · 10년 덩어리 ≤ 16KB(≤ 24KB) · 누적 지연 ≤ 110KB · 판 하나가 한 번에 받는 양 ≤ 75KB.',
  budget: BUDGET,
  pieces: main.length, alt: rows.length - main.length, heavy: heavy.length, shapesAvg: Math.round(sum(main, 'shapes') / main.length), shapesMax: Math.max(...main.map((r) => r.shapes)), shapesMin: Math.min(...main.map((r) => r.shapes)),
  rawTotal: sum(main, 'raw'), gzEachTotal: sum(main, 'gz'), gzWithToneTotal: sum(main, 'gzWithTone'), gzEachAvg: gzAvg, gzClassFillAvg: Math.round(sum(main, 'gzClassFill') / main.length), gzEachMax: Math.max(...main.map((r) => r.gzWithTone)), overBudget: main.filter((r) => r.overBudget).map((r) => r.id), overMax: main.filter((r) => r.overMax).map((r) => r.id),
  chunk7080: chunk7080, chunk7080Ratio: ratio, defsGz, linePerPiece: perLine,
  decades: [decadeMeasured(set70, '1970년대(이 시트 5장)'), decadeMeasured(set80, '1980년대(이 시트 7장)'), decadeMeasured(SET_7080, '1970~80년대 12장')],
  plan: { ...PLAN, total: est(PLAN.event + PLAN.daily), totalWithVariants: est(PLAN.event + PLAN.daily + PLAN.variantDaily), perDecade: est(Math.ceil((PLAN.event + PLAN.daily) / PLAN.decades)), perDecadeWithVariants: est(Math.ceil((PLAN.event + PLAN.daily + PLAN.variantDaily) / PLAN.decades)) },
  rows,
};
write('era-window-r3-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 집 그림(2:1 예시) — dashboard-family.html에서 읽는다
const dash = readFileSync(OUT + 'dashboard-family.html', 'utf8');
const hi = dash.indexOf('<div class="scene__house">');
const hj = dash.indexOf('</p></div>', hi) + '</p></div>'.length;
if (hi < 0 || hj < hi) throw new Error('dashboard-family.html에서 집 그림을 찾지 못함 — 먼저 buildFamilyMockups.mjs');
const houseA = dash.slice(hi, hj);
const ERA_ICON = '<symbol id="i-era" viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M12 4.5v15M4 12h16"/></symbol>';
const sceneLine = '서울 성북구 · 단독주택 셋방 · 부모님·누나 둘·할머니와 함께';
const petLine = '마당에서 기르는 개 한 마리가 있습니다.';
function exampleCard(q, { age, key = `${q.year}`, note = '' } = {}) {
  const k = key;
  const house = houseA.replace(/id="scene-year"/, `id="scene-year-${k}"`).replace(/aria-labelledby="scene-year scene-line scene-pets"/, `aria-labelledby="scene-year-${k} scene-line-${k} scene-pets-${k}"`).replace(/<time datetime="\d+">\d+년<\/time>/, `<time datetime="${q.year}">${q.year}년</time>`);
  const era = `<a class="era" href="#era-line-${k}" data-era="${q.id}" data-kind="${q.topic}" data-hidden="false" data-tone="${TONE_ID}" title="시대의 창 · ${q.line}"><span class="era__pic" data-dec="${decadeOf(q.year)}" aria-hidden="true">${svgOf(q)}</span><span class="sr-only">시대의 창 · ${q.line} 그해 기록으로</span></a>`;
  const row = `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" id="era-line-${k}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tl"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-era"/></svg><span>시대의 창</span></span><span class="log__sent">${q.line}</span></span></li>`;
  return `<div class="ew__example">${note ? `<p class="ew__exnote">${note}</p>` : ''}<section class="card scene-card" aria-labelledby="scene-title-${k}" data-fold="false" data-scene="a" data-year="${q.year}">
<h3 id="scene-title-${k}" class="sr-only">집과 가족 · ${q.year}년</h3>
<div class="scene" id="scene-pic-${k}">${house}${era}</div>
<p class="scene__line" id="scene-line-${k}">${sceneLine}</p>
<p class="sr-only" id="scene-pets-${k}">${petLine}</p>
<div class="scene__row"><details class="scene__more"><summary>함께 사는 사람</summary><ul class="scene__people"><li>어머니 · 박영숙 · ${34 + q.year - 1972}세 · 아주 가까움</li><li>아버지 · 김재호 · ${36 + q.year - 1972}세 · 가까움</li><li>${petLine.replace(/가 있습니다\.$/, '')}</li></ul></details><button class="btn btn--ghost btn--sm scene__fold" type="button" aria-expanded="true" aria-controls="scene-pic-${k}">그림 접기</button></div>
</section>
<section class="card log ew__log" aria-label="인생 기록(발췌)"><h3 class="ew__log-title">인생 기록 — 시대의 창 줄</h3><ul class="log__list ew__log-list" role="list">${row}</ul></section></div>`;
}

// ---------------------------------------------------------------- 시트
const KIND = { event: '그해의 큰 사건', daily: '그때의 일상' };
const yearLabel = (q) => (q.years ? `${q.years[0]}~${String(q.years[1]).slice(2)}년` : `${q.year}년`);
const figure = (q, { size = 'pc', cap = true, zoom = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-heavy="${!!q.heavy}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>${cap ? `<figcaption class="ew__cap"><span class="ew__year">${yearLabel(q)} <span class="ew__kindtag">${KIND[q.kind]}</span></span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode ? `${q.hCode} · ` : ''}${q.topic}${q.ageBand ? ` · ${q.ageBand}` : ''}</span>${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : ''}${size === 'pc' || zoom ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>` : ''}</figure>`;
const byId = (part) => MAIN.find((q) => q.id.includes(part));
const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 3차 — 현장을 그린 열다섯 장(SPEC-009, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 3차(FT3 r4 「가감 없이, 현실적으로」). 생성 scripts/design/buildEraWindowR3.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음), 승인 전(approved: false). -->
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
/* 열다섯 장 — PC 칸 175×140 그대로, 캡션(그리는 것 · 유지선)은 그림 오른쪽에. 두 장씩 한 줄 */
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
.ew__kind { color: var(--c-text-2); }
.ew__heavy { color: var(--c-era); font-weight: var(--fw-bold); }
.ew__draws { color: var(--c-text); font-size: var(--fs-sm); line-height: 1.5; margin-top: var(--sp-1); }
.ew__ft3 { color: var(--c-text-2); font-size: var(--fs-sm); line-height: 1.5; }
.ew__ft3::before { content: '유지선 · '; color: var(--c-text); font-weight: var(--fw-bold); }
/* 확대 보기 — 350×280(2배) */
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__zoom .ew__cap { font-size: var(--fs-sm); }
.ew__strip .ew__cap { font-size: var(--fs-sm); }
/* 휴대폰 띠 크기(100×80) — 그림만 */
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
/* 2:1 예시 — 대시보드 가운데 열 폭(534px) 그대로 */
.ew__examples { display: flex; flex-wrap: wrap; gap: var(--sp-5); align-items: flex-start; }
.ew__example { width: min(534px, 100%); display: grid; gap: var(--sp-3); }
.ew__exnote { margin: 0; font-size: var(--fs-sm); color: var(--c-text-2); }
.ew__log { padding-top: var(--sp-3); }
.ew__log-title { font-size: var(--fs-sm); color: var(--c-text-2); margin: 0; font-weight: var(--fw-regular); }
.ew__log-list { max-height: none; overflow: visible; }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
/* 톤 A — 10년대별 CSS 필터(그림 바이트 0). 다크는 필터를 약하게 */
${toneCssA('.ew')}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${ERA_DEFS}</defs>${ERA_ICON}</svg>
<main class="ew">
<h1>시대의 창 3차 — 현장을 그린 열다섯 장</h1>
<p class="ew__lead">형진 님 결정(2026-10-28)대로 톤은 A 「바랜 인쇄물」이고, 무거운 장면은 상징이 아니라 사건 그 자체의 현장을 그렸습니다(1979 계엄 거리 · 1980 금남로 · 1987 6월 · 1950 피란 · 1995 삼풍). 일상도 「그때 거기 있는 느낌」으로 사람을 넣었습니다(연탄 새벽 · 콩나물 교실 · 공단 출근 · 달동네 · 만화방 · 만원 버스). 사람은 모두 뒷모습·옆모습·먼 인물이라 얼굴이 식별되지 않고, 시신·피·실존 인물·정당 상징·구호 글자는 없습니다. 캡션 마지막 줄이 장면마다의 유지선 판단입니다. 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r3.html">라이트</a><a href="era-window-r3.html?theme=dark">다크</a><a href="era-window-r2.html">2차 시트(상징 표현 · 톤 비교)</a><a href="dashboard-family.html?scene=a&amp;era=stadium&amp;decision=fold">대시보드 자리(FM2d)</a></nav>

<h2>1970~80년대 열두 장</h2>
<p class="ew__note">PC 칸 크기 175×140 그대로입니다. 사건이 있는 해는 사건, 없는 해는 플레이어 나이대에 맞는 일상입니다. 무거운 장면 셋은 기본으로 보이고, 「무거운 장면 가리기」를 켜면 그해의 일상 그림으로 바뀝니다(아래 2:1 예시 오른쪽). 캡션은 해 · 이름 · 분류 · 그리는 것 · 유지선 판단 순입니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${SET_7080.map((q) => figure(q)).join('')}</div>

<h2>다른 시대의 무거운 장면 — 샘플 셋</h2>
<p class="ew__note">같은 기준으로 그린 1950~51년 피란 행렬, 1995년 삼풍 붕괴 현장, 1997~98년 외환위기(금 모으기 줄)입니다. 외환위기는 경제 체험이라 가리기 대상(○)이 아닙니다 — 대상에 넣을지는 물음으로 남겼습니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${SAMPLES.map((q) => figure(q)).join('')}</div>

<h2>같은 해 둘째 그림 — 1987년 12월 투표소</h2>
<p class="ew__note">1987년은 6월(무거움)과 12월 투표소(무겁지 않음) 둘입니다. 고르기 규칙은 무거운 쪽을 먼저 고르고, 가리기를 켜면 투표소가 아니라 그해 일상으로 바꿉니다. 둘째 그림은 15장 집계 밖입니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${ALT.map((q) => figure(q)).join('')}</div>

<h2>확대 보기 350×280</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${[byId('1980-may'), byId('1987-june'), byId('1995-sampoong'), byId('1975-classroom'), byId('1950-refugee'), byId('1977-factory')].map((q) => figure(q, { zoom: true })).join('')}</div>

<h2>실제 자리 — 집 그림 옆 2:1</h2>
<p class="ew__note">왼쪽은 1980년(무거운 장면 — 기본값은 보임), 오른쪽은 같은 해에 「무거운 장면 가리기」를 켰을 때 — 1980년대 일상 가운데 나이대(8세 · 어린이)에 맞는 달동네 그림으로 바뀌고 시대 줄 문장도 그 그림의 문장이 됩니다. 집 그림은 종이 오림 그대로(필터 없음)이고 창만 톤이 걸립니다. 가족 이름·나이는 시안의 가짜 값입니다.</p>
<div class="ew__examples">${exampleCard(byId('1980-may'), { age: 8, note: '기본값 — 무거운 장면 보임' })}${exampleCard({ ...byId('1981-hillside'), year: 1980 }, { age: 8, key: '1980-gentle', note: '「무거운 장면 가리기」 켬 — 그해 일상(1980년대 · 모두)으로' })}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 군중과 연기가 이 크기에서도 읽히는지 보는 줄입니다.</p>
<div class="ew__strip" data-tone="${TONE_ID}">${MAIN.map((q) => figure(q, { size: 'mobile' })).join('')}</div>

<h2>인생 기록 줄 문장 · 유지선 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">해</th><th scope="col">종류</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col">유지선 판단</th><th scope="col" class="num">조각</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.years[0] !== r.years[1] ? `${r.years[0]}~${String(r.years[1]).slice(2)}` : r.year}${r.alt ? ' (둘째)' : ''}</td><td>${KIND[r.kind]}${r.heavy ? ' <span class="ew__heavy">· 무거움</span>' : ''}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="ok">${r.ft3}</td><td class="num">${r.shapes}</td><td class="num">${r.gzWithTone}B${r.overMax ? ' · 상한 초과' : r.overBudget ? ' · 1.5KB 초과(2.5KB 안)' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">본 그림 열다섯 장 합계 gzip ${sum(main, 'gzWithTone').toLocaleString('ko-KR')}B(개별, 톤 겹 포함) · 장당 평균 ${gzAvg}B(최대 ${budget.gzEachMax}B) · 조각 평균 ${budget.shapesAvg}개(최소 ${budget.shapesMin} · 최대 ${budget.shapesMax}). 1970~80년대 12장 덩어리 ${chunk7080.toLocaleString('ko-KR')}B(비율 ${ratio}) + 공유 패턴 ${defsGz}B. 1970년대 5장 덩어리 ${budget.decades[0].withDefs.toLocaleString('ko-KR')}B · 1980년대 7장 ${budget.decades[1].withDefs.toLocaleString('ko-KR')}B(한 줄·패턴 포함). 목록 104장 추정 전체 ≈ ${(budget.plan.total.withDefs / 1024).toFixed(1)}KB, 10년 하위 덩어리 하나 ≈ ${(budget.plan.perDecade.withDefs / 1024).toFixed(1)}KB(계층 변주 18장을 더하면 ≈ ${(budget.plan.perDecadeWithVariants.withDefs / 1024).toFixed(1)}KB). 예산: 장당 ≤ 1.5KB(≤ 2.5KB 허용) · 10년 덩어리 ≤ 16KB(≤ 24KB) · 누적 ≤ 110KB · 한 번에 ≤ 75KB. 정본 수치는 era-window-r3-budget.json.</p>
</main>
</body>
</html>
`;
write('era-window-r3.html', html);

console.log(`시대의 창 r3: 본 ${main.length}장(+둘째 ${rows.length - main.length}) · 무거운 장면 ${heavy.length} · 장당 gzip 평균 ${gzAvg}B(최대 ${budget.gzEachMax}, 합 ${sum(main, 'gzWithTone')}) · 1970~80년대 덩어리 ${chunk7080}B(+defs ${defsGz}, 비율 ${ratio}) · 조각 평균 ${budget.shapesAvg}(최소 ${budget.shapesMin} 최대 ${budget.shapesMax})`);
for (const r of rows) console.log(`${r.year} ${r.id}: ${KIND[r.kind]} ${r.topic}${r.heavy ? '(무거움)' : ''}${r.alt ? '(둘째)' : ''} · 조각 ${r.shapes} · gz ${r.gz}/${r.gzWithTone}${r.overMax ? ' !!상한' : r.overBudget ? ' !1.5KB' : ''} · 「${r.line}」(${r.lineChars})`);
for (const d of budget.decades) console.log(`${d.label}: 덩어리 ${d.chunkGz}B · 한 줄·패턴 포함 ${d.withDefs}B · 조각 평균 ${d.shapesAvg}`);
console.log(`104장 추정: 전체 ${budget.plan.total.withDefs}B · 10년 덩어리 ${budget.plan.perDecade.withDefs}B · 계층 변주 포함 10년 덩어리 ${budget.plan.perDecadeWithVariants.withDefs}B`);

/**
 * SPEC-009 「시대의 창」 정교화 2차 시안 생성기 (designer 2026-10-28, r2 — 형진 님 피드백 4가지).
 *
 * 정본: SPEC-009 FT2·FT3·FT5, `docs/design/family-scene.md` 5절(칸 = 그림만, 2:1·쌓기), `docs/design/era-window.md` r2(톤·목록·고르기 규칙·예산).
 * 그림: 종이 오림(s1)을 바탕으로 **조각 수·깊이(뒤·가운데·앞)·빛과 그림자·시대 디테일**을 더했다. 좌표계 40×32 전체. 색은 `--c-scene-*` 토큰만.
 * 톤: 그림 바깥 CSS 필터(10년대별) + 그림 안 한 겹(톤 A 망점+종이 · 톤 B 바램) — `eraR2Lib.mjs#TONE`. 두 톤을 같은 세 장면으로 비교하고 추천 톤으로 12장을 보인다.
 * 무거운 장면(1979·1980·1987)은 상징과 장소로만(FT3). 모두 새로 구성(사진 모사 0), 승인 전(approved: false).
 *
 * 실행: node scripts/design/buildEraWindowR2.mjs
 * 산출: docs/design/mockups/family/era-window-r2.html · pieces/era-r2/<id>.svg(12) · era-window-r2-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. r1 산출물(era-window-1980s.html 등)은 그대로 둔다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS, TONE, decadeOf, toneLayer, toneCss } from './eraR2Lib.mjs';
import { DAILY } from './eraR2ScenesDaily.mjs';
import { EVENTS } from './eraR2ScenesEvents.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r2', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

/** 추천 톤 — 시트를 보고 정한다(era-window.md r2 2절). */
const REC = process.env.ERA_TONE || 'a';
const R2 = [...EVENTS, ...DAILY].sort((a, b) => a.year - b.year).map((q) => ({ ...q, approved: false }));
const ERA_LINE_MAX = 22;
for (const q of R2) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[A-Za-z가-힣]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
}
const heavy = R2.filter((q) => q.heavy);
if (heavy.length < 2) throw new Error('무거운 장면 2장 이상(마스터 지시)');
const svgOf = (q, tone = REC, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${q.draw()}${toneLayer(tone, q.year)}</svg>`;

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse)\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const rows = R2.map((q) => {
  const inner = q.draw();
  const layer = toneLayer(REC, q.year);
  write(`pieces/era-r2/${q.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r2 · ${q.id} · ${q.year} · ${q.hCode || '일상'} · ${q.topic}${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''} · 승인 전(approved: false) · 새로 구성(사진 모사 없음) · 색은 --c-scene-* 토큰, 톤 ${REC.toUpperCase()}는 CSS 필터 + 한 겹 --><defs>${ERA_DEFS}</defs><g>${inner}${layer}</g></svg>\n`);
  return { id: q.id, year: q.year, decade: decadeOf(q.year), hCode: q.hCode, name: q.name, kind: q.kind, topic: q.topic, heavy: q.heavy, ageBand: q.ageBand || null, line: q.line, lineChars: q.line.length, ft3: q.ft3, shapes: countShapes(inner), raw: Buffer.byteLength(inner, 'utf8'), gz: gz(inner), gzWithTone: gz(inner + layer), approved: false };
});
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const chunkGz = gz(JSON.stringify(Object.fromEntries(R2.map((q) => [q.id, q.draw() + toneLayer(REC, q.year)]))));
const defsGz = gz(ERA_DEFS);
const linesGz = gz(JSON.stringify(Object.fromEntries(R2.map((q) => [q.id, q.line]))));
const gzAvg = Math.round(sum('gzWithTone') / rows.length);
const ratio = Math.round((chunkGz / sum('gzWithTone')) * 100) / 100;
const perLine = Math.round(linesGz / rows.length);
/** r2 목록(era-window.md 4절): 사건 그림 68 + 일상 그림 36(10년마다 4) = 104장 — 10년 하위 덩어리 9개 */
const PLAN = { event: 68, daily: 36, decades: 9 };
const est = (n) => ({ pieces: n, gzEachSum: gzAvg * n, chunkEst: Math.round(gzAvg * n * ratio), withLines: Math.round(gzAvg * n * ratio + perLine * n) });
const total = est(PLAN.event + PLAN.daily);
const perDecade = est(Math.ceil((PLAN.event + PLAN.daily) / PLAN.decades));
const budget = {
  measuredAt: '2026-10-28', tone: REC, note: 'r2 12장(1970~80년대, 승인 전). gz는 그림 안쪽 마크업, gzWithTone은 톤 한 겹까지. chunk는 12장을 {id: 마크업} JSON으로 묶어 gzip + 공유 패턴 defs 1회. plan은 r2 목록 104장을 이 묶음의 장당 평균으로 늘린 추정(10년 하위 덩어리 9개 — 판 하나가 한 번에 받는 양은 perDecade).',
  pieces: rows.length, heavy: heavy.length, shapesAvg: Math.round(sum('shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), shapesMin: Math.min(...rows.map((r) => r.shapes)),
  rawTotal: sum('raw'), gzEachTotal: sum('gz'), gzWithToneTotal: sum('gzWithTone'), gzEachAvg: gzAvg, chunkGz, defsGz, chunkPlusDefs: chunkGz + defsGz, chunkPerPiece: Math.round(chunkGz / rows.length), chunkRatio: ratio, linesGz, linePerPiece: perLine,
  plan: { ...PLAN, total: { ...total, withDefs: total.withLines + defsGz }, perDecade: { ...perDecade, withDefs: perDecade.withLines + defsGz }, budgetProposal: { perPicture: 1500, perDecadeChunk: 16000, totalLazy: 110000 } }, rows,
};
write('era-window-r2-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 집 그림(2:1 예시) — dashboard-family.html에서 읽는다
const dash = readFileSync(OUT + 'dashboard-family.html', 'utf8');
const hi = dash.indexOf('<div class="scene__house">');
const hj = dash.indexOf('</p></div>', hi) + '</p></div>'.length;
if (hi < 0 || hj < hi) throw new Error('dashboard-family.html에서 집 그림을 찾지 못함 — 먼저 buildFamilyMockups.mjs');
const houseA = dash.slice(hi, hj);
const ERA_ICON = '<symbol id="i-era" viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M12 4.5v15M4 12h16"/></symbol>';
const sceneLine = '서울 성북구 · 단독주택 셋방 · 부모님·누나 둘·할머니와 함께';
const petLine = '마당에서 기르는 개 한 마리가 있습니다.';
function exampleCard(q, { age, tone = REC } = {}) {
  const k = `${q.year}`;
  const house = houseA.replace(/id="scene-year"/, `id="scene-year-${k}"`).replace(/aria-labelledby="scene-year scene-line scene-pets"/, `aria-labelledby="scene-year-${k} scene-line-${k} scene-pets-${k}"`).replace(/<time datetime="\d+">\d+년<\/time>/, `<time datetime="${q.year}">${q.year}년</time>`);
  const era = `<a class="era" href="#era-line-${k}" data-era="${q.id}" data-kind="${q.topic}" data-hidden="false" data-tone="${tone}" title="시대의 창 · ${q.line}"><span class="era__pic" data-dec="${decadeOf(q.year)}" aria-hidden="true">${svgOf(q, tone)}</span><span class="sr-only">시대의 창 · ${q.line} 그해 기록으로</span></a>`;
  const row = `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" id="era-line-${k}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tl"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-era"/></svg><span>시대의 창</span></span><span class="log__sent">${q.line}</span></span></li>`;
  return `<div class="ew__example"><section class="card scene-card" aria-labelledby="scene-title-${k}" data-fold="false" data-scene="a" data-year="${q.year}">
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
const figure = (q, { tone = REC, size = 'pc', cap = true } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-heavy="${q.heavy}" data-size="${size}" data-tone="${tone}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q, tone)}</div>${cap ? `<figcaption class="ew__cap"><span class="ew__year">${q.year}년 <span class="ew__kindtag">${KIND[q.kind]}</span></span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode ? `${q.hCode} · ` : ''}${q.topic}${q.ageBand ? ` · ${q.ageBand}` : ''}</span>${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : ''}${size === 'pc' ? `<span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>` : ''}</figure>`;
const COMPARE = ['era-1988-stadium-flame', 'era-1980-may-street', 'era-1972-briquette-alley'].map((id) => R2.find((q) => q.id === id));
const by = (y) => R2.find((q) => q.year === y);
const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 2차 — 톤 비교와 1970~80년대 열두 장(SPEC-009, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 정교화 2차. 생성 scripts/design/buildEraWindowR2.mjs · ?theme=dark 다크 · ?tone=b 전체를 톤 B로. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음), 승인 전(approved: false). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');var tn=q.get('tone');if(tn==='a'||tn==='b')document.documentElement.setAttribute('data-force-tone',tn);})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew h3 { font-size: var(--fs-md); margin: var(--sp-4) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
/* 톤 비교 — 두 열(A·B), 같은 세 장면을 실제 PC 칸 크기로 */
.ew__tones { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
.ew__tone { padding: var(--sp-4); background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-md); }
.ew__tone h3 { margin-top: 0; }
.ew__tone { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--sp-2) var(--sp-5); align-items: start; }
.ew__tone h3 { grid-column: 1 / -1; }
.ew__tone .ew__row { display: grid; grid-template-columns: repeat(3, 175px); gap: var(--sp-3); }
.ew__tone p { margin: 0; font-size: var(--fs-sm); color: var(--c-text-2); max-width: 52ch; }
.ew__tone[data-rec="true"] { border-color: var(--c-brand); }
.ew__rec { display: inline-block; margin-left: var(--sp-2); font-size: var(--fs-sm); color: var(--c-brand); font-weight: var(--fw-bold); }
@media (max-width: 1023px) { .ew__tone { grid-template-columns: minmax(0, 1fr); } .ew__tone .ew__row { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); } }
/* 열두 장 — PC 칸 175×140 그대로 넉 장씩 */
.ew__grid { display: grid; grid-template-columns: repeat(4, 175px); gap: var(--sp-6) var(--sp-5); justify-content: start; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
.ew__fig { margin: 0; min-width: 0; }
.ew__pic { aspect-ratio: 5 / 4; overflow: hidden; background: var(--c-scene-sky); }
.ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin-top: var(--sp-2); font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); word-break: keep-all; }
.ew__year { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__kindtag { font-weight: var(--fw-regular); color: var(--c-text-2); }
.ew__kind { color: var(--c-text-2); }
.ew__heavy { color: var(--c-era); font-weight: var(--fw-bold); }
.ew__ft3 { color: var(--c-text-2); font-size: var(--fs-xs); line-height: 1.45; }
/* 확대 보기 — 350×280(2배) */
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
/* 휴대폰 띠 크기(100×80) — 그림만 */
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
.ew__strip .ew__cap { font-size: var(--fs-xs); }
/* 2:1 예시 — 대시보드 가운데 열 폭(534px) 그대로 */
.ew__examples { display: flex; flex-wrap: wrap; gap: var(--sp-5); align-items: flex-start; }
.ew__example { width: min(534px, 100%); display: grid; gap: var(--sp-3); }
.ew__log { padding-top: var(--sp-3); }
.ew__log-title { font-size: var(--fs-sm); color: var(--c-text-2); margin: 0; font-weight: var(--fw-regular); }
.ew__log-list { max-height: none; overflow: visible; }
.ew table { border-collapse: collapse; width: 100%; max-width: 80ch; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
/* 톤 — 10년대별 CSS 필터(그림 바이트 0). 다크는 필터를 약하게 */
${toneCss('.ew')}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${ERA_DEFS}</defs>${ERA_ICON}</svg>
<main class="ew">
<h1>시대의 창 2차 — 톤 비교와 1970~80년대 열두 장</h1>
<p class="ew__lead">1차보다 조각을 서너 배 늘리고(장당 평균 ${budget.shapesAvg}개), 뒤·가운데·앞 세 층과 빛·그림자를 두어 「그때 그 장면」으로 읽히게 했습니다. 무거운 장면은 빼지 않고 상징과 장소로 그렸습니다(1979 가을 거실 · 1980년 5월 금남로 · 1987 투표소). 큰 사건이 없는 해는 그때의 일상을 띄웁니다. 글자·로고·상호·휘장·실존 인물·정당 상징·참상은 없고 사진을 따라 그리지 않았습니다. 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r2.html">라이트</a><a href="era-window-r2.html?theme=dark">다크</a><a href="era-window-1980s.html">1차 시트(1980년대 열 장)</a><a href="dashboard-family.html?scene=a&amp;era=stadium&amp;decision=fold">대시보드 자리(FM2d)</a></nav>

<h2>톤 비교 — 같은 세 장면을 두 톤으로</h2>
<p class="ew__note">톤은 그림 바깥의 CSS 필터(10년대마다 다르게)와 그림 안 한 겹으로만 냅니다. 둘 다 1950~60년대 세피아 → 1970~80년대 바랜 컬러 → 1990년대 선명한 컬러 → 2000년대 디지털로 바뀌고, 다크 모드에서는 필터를 약하게 겁니다.</p>
<div class="ew__tones">
<section class="ew__tone" data-rec="${REC === 'a'}"><h3>톤 A · 바랜 인쇄물${REC === 'a' ? '<span class="ew__rec">추천</span>' : ''}</h3><div class="ew__row" data-tone="a">${COMPARE.map((q) => figure(q, { tone: 'a', cap: false })).join('')}</div><p>세피아에 망점(30° 기울인 점)과 종이 한 겹을 얹어 그때의 신문·잡지 인쇄물처럼 보입니다. 망점은 1990년대에 옅어지고 2000년대부터 사라져 「인쇄에서 디지털로」가 톤에서도 읽힙니다. 100×80 띠에서는 망점이 고운 결로만 남습니다.</p></section>
<section class="ew__tone" data-rec="${REC === 'b'}"><h3>톤 B · 색 빠진 사진${REC === 'b' ? '<span class="ew__rec">추천</span>' : ''}</h3><div class="ew__row" data-tone="b">${COMPARE.map((q) => figure(q, { tone: 'b', cap: false })).join('')}</div><p>매끈한 면에 시대 색조만 얹은 바랜 컬러 사진 느낌입니다. 결이 없어 작은 칸에서 더 또렷하지만, 집 그림(같은 종이 오림, 필터 없음)과 나란히 놓이면 「같은 그림체의 다른 색」으로만 보여 창이 따로 놀지 않는 대신 시대감도 약합니다.</p></section>
</div>

<h2>1970~80년대 열두 장</h2>
<p class="ew__note">큰 사건 여섯과 일상 여섯을 추천 톤 ${REC.toUpperCase()}로, PC 칸 크기 175×140 그대로 둡니다. 사건이 있는 해는 사건, 없는 해는 그때의 일상입니다. 일상 그림은 플레이어 나이대에 맞춰 고릅니다(어린이는 교실·골목, 청소년은 만화방, 어른은 안방 전화). 무거운 장면 셋은 기본으로 보이고, 「무거운 장면 가리기」를 켜면 그해의 일상 그림으로 바뀝니다. 캡션의 마지막 줄은 FT3 판단입니다.</p>
<div class="ew__grid" data-tone="${REC}">${R2.map((q) => figure(q)).join('')}</div>

<h2>확대 보기 350×280</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${REC}">${[by(1980), by(1972), by(1975)].map((q) => figure(q, { cap: true })).join('')}</div>

<h2>실제 자리 — 집 그림 옆 2:1, 집 아래 띠</h2>
<p class="ew__note">왼쪽은 1980년(무거운 장면 — 기본값은 보임), 오른쪽은 1975년(일상)입니다. 집 그림은 종이 오림 그대로(필터 없음)이고 창만 톤이 걸립니다. 집 그림은 장면 A(FM2d)를 그대로 읽어 왔고, 가족 이름·나이는 시안의 가짜 값입니다.</p>
<div class="ew__examples">${exampleCard(by(1980), { age: 8 })}${exampleCard(by(1975), { age: 3 })}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 이 크기에서도 장면이 읽히는지 보는 줄입니다.</p>
<div class="ew__strip" data-tone="${REC}">${R2.map((q) => figure(q, { size: 'mobile' })).join('')}</div>

<h2>인생 기록 줄 문장과 실측</h2>
<table><thead><tr><th scope="col">해</th><th scope="col">종류</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col" class="num">조각</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.year}</td><td>${KIND[r.kind]}${r.heavy ? ' <span class="ew__heavy">· 무거움</span>' : ''}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="num">${r.shapes}</td><td class="num">${r.gzWithTone}B</td></tr>`).join('')}</tbody></table>
<p class="ew__note">열두 장 합계 gzip ${sum('gzWithTone').toLocaleString('ko-KR')}B(개별, 톤 겹 포함) · 덩어리 ${chunkGz.toLocaleString('ko-KR')}B + 공유 패턴 ${defsGz}B · 장당 평균 ${gzAvg}B · 조각 평균 ${budget.shapesAvg}개(최소 ${budget.shapesMin} · 최대 ${budget.shapesMax}). r2 목록 104장(사건 68 + 일상 36) 추정: 전체 ≈ ${(total.withLines / 1024).toFixed(1)}KB, 10년 하위 덩어리 하나 ≈ ${(perDecade.withLines / 1024).toFixed(1)}KB. 정본 수치는 era-window-r2-budget.json.</p>
</main>
</body>
</html>
`;
write('era-window-r2.html', html);

console.log(`시대의 창 r2: ${rows.length}장 · 무거운 장면 ${heavy.length} · 장당 gzip 평균 ${gzAvg}B(합 ${sum('gzWithTone')}) · 덩어리 ${chunkGz}B(+defs ${defsGz}, 비율 ${ratio}) · 한 줄 평균 ${perLine}B · 조각 평균 ${budget.shapesAvg}(최소 ${budget.shapesMin} 최대 ${budget.shapesMax})`);
for (const r of rows) console.log(`${r.year} ${r.id}: ${KIND[r.kind]} ${r.topic}${r.heavy ? '(무거움)' : ''} · 조각 ${r.shapes} · raw ${r.raw} · gz ${r.gz}/${r.gzWithTone} · 「${r.line}」(${r.lineChars})`);
console.log(`104장 추정: 전체 ${total.withLines}B(+defs ${total.withLines + defsGz}) · 10년 덩어리 ${perDecade.withLines}B(+defs ${perDecade.withLines + defsGz})`);

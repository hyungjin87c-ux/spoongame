/**
 * SPEC-009 「시대의 창」 5차 b 시안 생성기 (designer 2026-11-02 — 형진 님 답 「2009 구간 분기 · 현장까지 생생하게 · 외환위기 장면 넣는다」).
 *
 * 정본: `docs/design/era-window.md` 9절(r5)·10절(r5b), SPEC-009 FT3 r4. 수위 유지선은 r5와 같다(순간·고어·실존 인물·정당 상징·평가 문장 0).
 * 장면: `eraR5bScenes.mjs` — 다시 그린 무거운 장면 9(1994·2003·2008·2009 5월·2010·2014·2016·2017·2022) + 2009 수저 구간 분기 2(아래 = 철거 현장 ○ · 위 = 첫 스마트폰) = 11장.
 *   바뀌지 않은 r5 40장은 r5 시트·조각 그대로(형진 님 승인 — 마스터 표기). 이 시트는 바뀐 장면의 전(r5)·후(r5b)만 나란히 둔다.
 * 예산(마스터 결정): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. class는 `ALLOWED_CLASSES`(6접두 × 25토큰) 안.
 *
 * 실행: node scripts/design/buildEraWindowR5b.mjs
 * 산출: docs/design/mockups/family/era-window-r5b.html · pieces/era-r5b/<id>.svg(11) · era-window-r5b-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. r5 산출물은 그대로 둔다(전 기록).
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA } from './eraR5bLib.mjs';
import { S5B, HEAVY5B, REDRAWN, NEW2009 } from './eraR5bScenes.mjs';
import { SCENES as R5, SET90, SET00, SET10, SET20, DAILY } from './eraR5Scenes.mjs';
import { HEAVY as R3HEAVY } from './eraR3ScenesHeavy.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r5b', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const BAND_LABEL = { low: '아래 둘(흙수저 쪽)', high: '위 둘(금수저 쪽)' };
const BAND3 = { low: '아래 둘(흙·동수저)', mid: '가운데(은수저)', high: '위 둘(금수저 쪽)' };
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
const r3 = (id) => { const q = R3HEAVY.find((x) => x.id === id); if (!q) throw new Error(`r3 장면 없음: ${id}`); return { ...q, approved: true, r3: true }; };
const R3_1995 = r3('era-1995-sampoong-rescue'), R3_1998 = r3('era-1998-gold-drive-queue');
const EARLIER = ['era-1950-refugee-column', 'era-1980-may-geumnam-ro', 'era-1987-june-street', 'era-1995-sampoong-rescue'].map(r3);

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
for (const q of S5B) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws) throw new Error(`유지선 판단(ft3)·그리는 것(draws) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
  for (const m of inner(q).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (!ALLOWED.has(c)) throw new Error(`허용 목록 밖 class ${c}: ${q.id}`);
  if (/<(?!\/?(rect|path|circle|ellipse|use|g)\b)/.test(inner(q))) throw new Error(`허용 밖 태그: ${q.id}`);
}
if (S5B.length !== 11) throw new Error(`장면 ${S5B.length}장(11 기대)`);
if (HEAVY5B.length !== 10) throw new Error(`무거운 장면 ${HEAVY5B.length}(10 기대 — 다시 그린 9 + 철거 현장)`);
if (REDRAWN.length !== 9 || NEW2009.length !== 2) throw new Error('다시 그린 9 · 새 2009 2 기대');
for (const q of REDRAWN) if (!R5.find((x) => x.id === q.id && x.heavy)) throw new Error(`r5에 없는 무거운 장면 id: ${q.id}`);
const y2009 = S5B.filter((q) => q.year === 2009);
if (y2009.length !== 3 || !y2009.find((q) => q.band === 'low' && q.heavy) || !y2009.find((q) => q.band === 'high' && !q.heavy) || !y2009.find((q) => !q.band && q.heavy)) throw new Error('2009 세 갈래(아래 ○ · 가운데 ○ · 위) 기대');
// 병합: r5 49장 중 다시 그린 9장을 r5b로 바꾸고 2009 둘을 더한다 → 51장
const MERGED = [...R5.map((q) => REDRAWN.find((x) => x.id === q.id) || q), ...NEW2009].sort((a, b) => a.year - b.year || (a.band === 'low' ? -1 : a.band === 'high' ? 1 : 0) - (b.band === 'low' ? -1 : b.band === 'high' ? 1 : 0));
if (MERGED.length !== 51) throw new Error(`병합 ${MERGED.length}장(51 기대)`);
// 해마다 × 구간 셋 단언 — 사건에도 band가 있다(r5b 규칙): 그해 플레이어 구간과 같은 band 사건 → band 없는 사건 → 일상
const ALL = [...MERGED, R3_1995, R3_1998];
const pickEvent = (y, band) => { const evs = ALL.filter((q) => q.kind === 'event' && (q.years ? q.years[0] <= y && y <= q.years[1] : q.year === y)); return evs.filter((q) => q.band === band)[0] || evs.filter((q) => !q.band)[0] || null; };
for (let y = 1990; y <= 2025; y++) for (const band of ['low', 'mid', 'high']) {
  const ev = pickEvent(y, band); const dl = DAILY.filter((q) => q.years[0] <= y && y <= q.years[1]);
  if (!ev && !dl.length) throw new Error(`${y}년 ${band}에 닿는 그림 없음`);
}
if (pickEvent(2009, 'low').id !== 'era-2009-demolition-fire' || pickEvent(2009, 'mid').id !== 'era-2009-square-mourning-queue' || pickEvent(2009, 'high').id !== 'era-2009-first-smartphone') throw new Error('2009 고르기 규칙 확인 실패');

// ---------------------------------------------------------------- 조각 + 예산
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000 };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r5b · ${q.id} · ${q.year} · ${q.hCode} · ${q.topic}${q.band ? ` · 수저 구간 ${BAND_LABEL[q.band]}에서만` : ''}${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''}${q.redrawn ? ' · r5를 다시 그림(현장까지 생생하게)' : ' · 새 장면'} · 승인 전(approved: false — r5b 확인 뒤) · 새로 구성(사진 모사 없음, 얼굴 식별 없음) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 톤 A는 CSS 필터 + 한 겹 --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = S5B.map((q) => {
  const cls = inner(q); write(`pieces/era-r5b/${q.id}.svg`, pieceSvg(q));
  const g = gz(cls); const limit = q.heavy ? BUDGET.perPictureCrowdHeavy : BUDGET.perPicture;
  const before = R5.find((x) => x.id === q.id); const gzBefore = before ? gz(inner(before)) : null;
  return { id: q.id, year: q.year, decade: decadeOf(q.year), hCode: q.hCode, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, band: q.band || null, redrawn: !!q.redrawn, isNew: !!q.isNew, line: q.line, lineChars: q.line.length, draws: q.draws, ft3: q.ft3, shapes: countShapes(cls), uses: countUses(cls), raw: Buffer.byteLength(cls, 'utf8'), gz: g, gzBefore, over25: g > BUDGET.perPicture, overLimit: g > limit, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const dec = (list, label, note = '') => { const c = chunk(list); return { label, note, pieces: list.length, chunkGz: c, withLines: c + lines(list), withDefs: c + lines(list) + defsGz + cssGz, overMax: c + lines(list) + defsGz + cssGz > BUDGET.perDecadeChunk }; };
const M90 = [...MERGED.filter((q) => q.year < 2000), R3_1995, R3_1998].sort((a, b) => a.year - b.year), M00 = MERGED.filter((q) => q.year >= 2000 && q.year < 2010), M10 = MERGED.filter((q) => q.year >= 2010 && q.year < 2020), M20 = MERGED.filter((q) => q.year >= 2020);
const decades = [dec(M90, '1990년대 12장(1994 r5b) + 승인된 1995·1998(r3)'), dec(M00, '2000년대 15장(2003·2008·2009 r5b + 2009 아래·위)'), dec(M10, '2010년대 13장(2010·2014·2016·2017 r5b)'), dec(M20, '2020년대 11장(2022 r5b)')];
const r5Chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const before90 = r5Chunk([...SET90, R3_1995, R3_1998]), before00 = r5Chunk(SET00), before10 = r5Chunk(SET10), before20 = r5Chunk(SET20);
const mergedSum = MERGED.reduce((a, q) => a + gz(inner(q)), 0);
const ratio = Math.round((decades[1].chunkGz / M00.reduce((a, q) => a + gz(inner(q)), 0)) * 100) / 100;
const totalEst = { pieces: 94, note: '승인 43 + r5 40(승인) + r5b 11 = 94장. r3·r4 실측 합 × 덩어리 비율 + 병합 51장 실측 덩어리 + defs·css 1회', lazyEst: Math.round(32095 * 0.83 + 37416 * 0.81) + decades.reduce((a, d) => a + d.withLines, 0) + defsGz + cssGz };
const budget = {
  measuredAt: '2026-11-02', round: 'r5b', tone: TONE_ID,
  note: 'r5b 11장(다시 그린 무거운 장면 9 + 2009 아래 철거 현장 ○ + 2009 위 첫 스마트폰). gz는 그림 안쪽 마크업(톤 겹 포함)을 class·use로 바꾼 뒤 gzip, gzBefore는 같은 id의 r5. chunk는 병합(r5 40 + r5b 11 = 51장 + 승인 1995·1998)을 10년마다 {id: 마크업} JSON으로 묶어 gzip + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회. 예산(마스터 결정 2026-10-28): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB.',
  budget: BUDGET, pieces: rows.length, heavy: HEAVY5B.length, redrawn: REDRAWN.length, new2009: NEW2009.length,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: Math.round(sum(rows, 'gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'), gzBeforeTotal: sum(rows.filter((r) => r.gzBefore), 'gzBefore'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`),
  defsGz, cssGz, chunkRatio: ratio, decades, decadesBeforeChunkGz: { 90: before90, 2000: before00, 2010: before10, 2020: before20 }, mergedPieces: MERGED.length, mergedGzSum: mergedSum, totalEst,
  rows,
};
write('era-window-r5b-budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- 시트
const KIND = { event: '그해의 큰 사건', daily: '그때의 일상' };
const cap = (q, { full = true } = {}) => `<figcaption class="ew__cap"><span class="ew__year">${q.year}년 <span class="ew__kindtag">${KIND[q.kind]}${q.r3 ? ' · r3 승인' : q.redrawn ? ' · 다시 그림' : q.isNew ? ' · 새 장면' : ''}</span></span><span class="ew__name">${q.name}</span><span class="ew__kind">${q.hCode} · ${q.topic}</span>${q.band ? `<span class="ew__band">수저 구간 · ${BAND_LABEL[q.band]}에서만</span>` : q.year === 2009 ? '<span class="ew__band">수저 구간 · 가운데(은수저)에서</span>' : ''}${q.heavy ? '<span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : '<span class="ew__kind">무겁지 않음 · 가리기 대상 밖</span>'}${full ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>`;
const fig = (q, { size = 'pc', full = true, tag = '' } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-heavy="${!!q.heavy}" data-band="${q.band || ''}" data-size="${size}" data-tone="${TONE_ID}"${tag ? ` data-ba="${tag}"` : ''}><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>${size === 'mobile' ? `<figcaption class="ew__cap"><span class="ew__year">${q.year}년${q.heavy ? ' <span class="ew__heavy">○</span>' : ''}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}</span></figcaption>` : cap(q, { full })}</figure>`;
const beforeFig = (q) => { const b = R5.find((x) => x.id === q.id); const rb = rows.find((r) => r.id === q.id); return `<figure class="ew__fig ew__fig--before" data-era="${b.id}" data-size="pc" data-ba="before"><div class="ew__pic" data-dec="${decadeOf(b.year)}">${svgOf(b)}</div><figcaption class="ew__cap"><span class="ew__year">전 · 5차 <span class="ew__kindtag">${rb.gzBefore}B</span></span><span class="ew__kind">${b.name}</span></figcaption></figure>`; };
const baRow = (q) => `<div class="ew__ba">${beforeFig(q)}${fig(q, { tag: 'after' })}</div>`;
const three = y2009.sort((a, b) => (a.band === 'low' ? 0 : a.band ? 2 : 1) - (b.band === 'low' ? 0 : b.band ? 2 : 1));
const earlierNote = {
  'era-1950-refugee-column': '행렬이 멀고 작다(앞줄 키 6 안팎). r5b 기준이면 고갯길 안 — 바로 앞의 지게와 보따리, 소달구지 바퀴가 화면 아래를 채워야 한다. 후보.',
  'era-1980-may-geumnam-ro': '군중·트럭·장갑차가 한 화면에 들어 있어 r5b 기준에 가장 가깝다. 앞줄 키 7~9 — 군중 속 시점(키 12~15)으로 당기면 더 생생해진다. 후보(낮음).',
  'era-1987-june-street': '연기와 행렬이 가깝고 종이가 날린다. 방패 열이 멀다. 후보(낮음).',
  'era-1995-sampoong-rescue': '잔해와 구조대가 가운데에 멀리 있고 크레인이 가늘다. r5b 기준이면 잔해 더미가 앞을 채우고 구조대원이 앞줄 키로 와야 한다. 후보.',
};

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 5차b — 무거운 장면 열한 장(SPEC-009, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 5차b(다시 그린 무거운 장면 9 + 2009 수저 구간 분기 2). 생성 scripts/design/buildEraWindowR5b.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음), 승인 전(approved: false). 사람 조각은 symbol+use, 색은 class(허용 목록 안). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew h3 { font-size: var(--fs-md); margin: var(--sp-5) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew code { font-family: inherit; background: var(--c-surface-2); padding: 0 .3em; border-radius: var(--r-sm); }
.ew__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
.ew__grid .ew__fig, .ew__ba .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__grid .ew__pic, .ew__ba .ew__pic { width: 175px; height: 140px; }
.ew__grid .ew__cap, .ew__ba .ew__cap { margin-top: 0; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__grid .ew__fig, .ew__ba .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__grid .ew__cap, .ew__ba .ew__cap { margin-top: var(--sp-2); } }
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
.ew__bas { display: grid; gap: var(--sp-8); }
.ew__ba { display: grid; grid-template-columns: 1fr 2fr; gap: var(--sp-5) var(--sp-8); align-items: start; padding-top: var(--sp-5); background: var(--c-surface); }
.ew__ba .ew__fig--before { grid-template-columns: 175px; }
.ew__ba .ew__fig--before .ew__cap { margin-top: var(--sp-2); color: var(--c-text-2); width: 175px; }
@media (max-width: 1023px) { .ew__ba { grid-template-columns: minmax(0, 1fr); } }
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
.ew__ask { max-width: 72ch; padding-left: 1.2em; }
.ew__ask li { margin: 0 0 var(--sp-2); }
.ew__rule { max-width: 72ch; padding-left: 1.2em; }
.ew__rule li { margin: 0 0 var(--sp-1); }
.ew pre { font-size: var(--fs-sm); line-height: 1.5; background: var(--c-surface); padding: var(--sp-3) var(--sp-4); overflow-x: auto; max-width: 72ch; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
${toneCssA('.ew')}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
<main class="ew">
<h1>시대의 창 5차b — 무거운 장면 열한 장</h1>
<p class="ew__lead">형진 님 답(2026-11-02)을 반영한 묶음입니다. 2009년은 수저 구간에 따라 세 갈래로 나뉘고, 5차의 무거운 장면 아홉은 「그 자리에 서 있는 느낌」으로 다시 그렸습니다. 5차의 바뀌지 않은 마흔 장(외환위기 생활 장면 둘 포함)은 형진 님 승인이고, 여기 열한 장은 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r5b.html">라이트</a><a href="era-window-r5b.html?theme=dark">다크</a><a href="era-window-r5.html">5차 시트(승인된 40장 + 전 그림)</a><a href="era-window-r4.html">4차 시트</a><a href="era-window-r3.html">3차 시트</a></nav>

<h2>2009년 — 수저 구간 세 갈래</h2>
<p class="ew__note">형진 님: 「2009년은 인생이 어려우면 재난 사건을 두고, 잘 살면 스마트폰 출시로 넣어 달라.」 두 경우만 말씀하셨으므로 가운데 구간은 마스터가 5차의 조문 줄로 정했습니다. 철거 현장은 무거운 장면(가리기 대상)이고 스마트폰은 아닙니다. 가리기를 켠 흙수저 플레이어는 철거 현장 대신 2000년대 아래 변주(고시원)를 봅니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${three.map((q) => fig(q)).join('')}</div>
<h3>고르기 규칙에 더하는 한 줄 — 사건에도 수저 구간 분기가 있다</h3>
<ol class="ew__rule">
<li>그해 승인된 사건 가운데 <b>플레이어 구간과 <code>band</code>가 같은 것</b>이 있으면 그것(2009 아래 = 철거 현장, 위 = 첫 스마트폰).</li>
<li>없으면 <code>band</code>가 없는 사건(무거운 쪽 우선, 둘 다 아니면 hash — 5차 규칙 그대로). <code>'mid'</code>는 <code>band</code> 있는 사건을 보지 않는다(2009 가운데 = 조문 줄).</li>
<li>사건이 없으면 일상(구간 변주 우선 — 4차 8-2절 그대로). 가리기가 켜지고 고른 사건이 ○이면 일상으로(구간 변주 우선은 여기서도 같다).</li>
<li>빌드 단언에 더한다: 1990~2025 모든 해 × 나이대 셋 × 구간 셋에 그림이 닿고, 2009는 구간마다 다른 세 장이 고른다. 이 시트의 생성기가 같은 단언을 둔다.</li>
</ol>
<pre>type EraPicture = { …, kind: 'event' | 'daily', band?: 'low' | 'high' /* r5b: event에도 쓴다 — 「이 구간에서만 보인다」 */ };
// 2009: { id: 'era-2009-demolition-fire', kind: 'event', band: 'low', heavy: true } · { id: 'era-2009-square-mourning-queue', kind: 'event', heavy: true } · { id: 'era-2009-first-smartphone', kind: 'event', band: 'high', heavy: false }
// eraOf: ① band === player → ② !band(heavy 우선 · hash) → ③ daily(변주 우선) → gentle && heavy → ③</pre>

<h2>다시 그린 무거운 장면 아홉 — 전·후</h2>
<p class="ew__note">왼쪽이 5차(전), 오른쪽이 이번(후)입니다. 카메라를 현장 안으로 당겨 앞줄 사람은 어깨 너머로 크게, 중심 사물은 화면의 절반 이상, 연기·잔해·장비·군중의 밀도를 올렸습니다. 유지선은 그대로입니다 — 순간(구타·총격·압박·불길 속 사람·구조되는 사람) 0, 시신·피·상처 0, 실존 인물 얼굴·이름 0, 정당 상징·구호 0, 평가 문장·사망자 수 0. 같은 id이므로 developer는 이 아홉의 조각을 <code>pieces/era-r5b/</code>에서 가져가고, 나머지 마흔 장은 <code>pieces/era-r5/</code> 그대로입니다. 대구 지하철·세월호·이태원·철거 현장은 피해자와 유족이 생존해 있는 사건이라 장면마다 판단을 유지선 줄에 적었습니다. 2022년은 형진 님 지시대로 「이튿날 낮의 꽃」에서 「그날 밤의 골목」으로 바꿨습니다 — 서 있는 인파와 경광등 빛까지, 넘어짐·압박의 순간은 그리지 않았습니다.</p>
<div class="ew__bas" data-tone="${TONE_ID}">${REDRAWN.map((q) => baRow(q)).join('')}</div>

<h2>크게 보기 350×280 — 열한 장</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다. 유지선 판단은 위 캡션과 같습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${S5B.map((q) => fig(q, { full: false })).join('')}</div>

<h2>휴대폰 띠 크기 100×80</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠(80px)의 왼쪽에 이 크기로 놓입니다. 당긴 거리가 이 크기에서도 읽히는지 보는 줄입니다.</p>
<div class="ew__strip" data-tone="${TONE_ID}">${S5B.map((q) => fig(q, { size: 'mobile' })).join('')}</div>

<h2>앞서 승인된 네 장 — 같은 생생함에 못 미치는지(후보만, 고치지 않음)</h2>
<p class="ew__note">마스터 지시: 1950·1980·1987·1995가 r5b의 생생함에 못 미치면 후보로 적되 고치지 않는다. 판단은 각 캡션에.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${EARLIER.map((q) => `<figure class="ew__fig" data-era="${q.id}" data-size="pc" data-ba="earlier"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div><figcaption class="ew__cap"><span class="ew__year">${q.year}년 <span class="ew__kindtag">r3 승인(2026-10-28)</span></span><span class="ew__name">${q.name}</span><span class="ew__draws">${earlierNote[q.id]}</span></figcaption></figure>`).join('')}</div>

<h2>인생 기록 줄 문장 · 유지선 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">해</th><th scope="col">종류</th><th scope="col">수저 구간</th><th scope="col">문장</th><th scope="col" class="num">자</th><th scope="col">유지선 판단</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip 전 → 후</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.year}</td><td>${KIND[r.kind]}${r.heavy ? ' <span class="ew__heavy">· 무거움</span>' : ''}${r.redrawn ? ' · 다시 그림' : ' · 새'}</td><td>${r.band ? BAND_LABEL[r.band] : r.year === 2009 ? '가운데' : '모든 구간'}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="ok">${r.ft3}</td><td class="num">${r.shapes}(${r.uses})</td><td class="num">${r.gzBefore ? `${r.gzBefore} → ` : ''}${r.gz}B${r.overLimit ? ' · 상한 초과' : r.over25 ? ' · 2.5KB 초과(군중 무거운 장면 3.5KB 안)' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">열한 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${budget.gzEachAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}). 다시 그린 아홉은 ${budget.gzBeforeTotal.toLocaleString('ko-KR')}B → ${sum(rows.filter((r) => r.redrawn), 'gz').toLocaleString('ko-KR')}B. 10년 덩어리(병합 51장 + 승인 1995·1998, 한 줄·공유 패턴·사람 심볼·토큰 CSS 포함): 1990년대 ${decades[0].withDefs.toLocaleString('ko-KR')}B · 2000년대 ${decades[1].withDefs.toLocaleString('ko-KR')}B · 2010년대 ${decades[2].withDefs.toLocaleString('ko-KR')}B · 2020년대 ${decades[3].withDefs.toLocaleString('ko-KR')}B — 모두 24KB 안. 94장(승인 43 + 5차 40 + 이번 11) 누적 추정 ≈ ${(totalEst.lazyEst / 1024).toFixed(1)}KB(누적 ≤ 230KB 안). 예산: 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 정본 수치는 era-window-r5b-budget.json.</p>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>2009 가운데 구간</b>(은수저)은 마스터가 5월 조문 줄로 정했습니다. 그대로 둘지, 가운데도 스마트폰(무겁지 않은 해)으로 할지 정해 주세요.</li>
<li><b>2022년</b>을 「그날 밤의 골목」으로 바꿨습니다 — 서 있는 인파와 경광등 빛까지이고 사람 사이 간격을 두었습니다. 이 수위가 맞는지, 5차의 「이튿날 낮의 꽃」을 둘째 그림으로 함께 둘지(둘째 그림은 가리기가 꺼진 채로도 hash로 번갈아 보입니다) 정해 주세요.</li>
<li><b>앞서 승인된 1950 피란·1995 삼풍</b>은 이번 기준에 못 미칩니다(위 후보 캡션). 다음 묶음에서 같은 방식으로 당길지, 승인대로 둘지 정해 주세요.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r5b.html', html);

console.log(`시대의 창 r5b: ${rows.length}장(다시 그림 ${REDRAWN.length} · 새 ${NEW2009.length}) · 무거운 장면 ${HEAVY5B.length} · 장당 gzip 평균 ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B + css ${cssGz}B`);
for (const r of rows) console.log(`${r.year} ${r.id}: ${r.heavy ? '○ ' : ''}${r.band ? `(${r.band}) ` : ''}조각 ${r.shapes}(use ${r.uses}) · gz ${r.gzBefore ? `${r.gzBefore} → ` : ''}${r.gz}${r.overLimit ? ' !!상한' : r.over25 ? ' !2.5KB' : ''} · 「${r.line}」(${r.lineChars})`);
for (const d of decades) console.log(`${d.label}: 덩어리 ${d.chunkGz}B · 한 줄·defs·css 포함 ${d.withDefs}B${d.overMax ? ' !!24KB 초과' : ''}`);
console.log(`전 덩어리(r5): 90 ${before90} · 2000 ${before00} · 2010 ${before10} · 2020 ${before20} · 94장 누적 추정 ${totalEst.lazyEst}B`);

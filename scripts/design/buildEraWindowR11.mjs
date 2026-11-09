/**
 * SPEC-013 T5 「시대의 창」 11차 시안 생성기 — 형진 님 피드백(2026-11-08) 반영: 수정 7(1988 포함) + 새 8 + 두 안 1 (designer 2026-11-09, 사건별 승인 전). r10 생성기와 같은 꼴.
 *
 * 정본: `docs/spec/SPEC-013-시대의창개편.md` r3(그림 구도 원칙 · 상징물 규칙 Q4 · 부록 A·C · 완료 기준 9·9-1·13), 승인 문장 `docs/design/era-text-r1.md`(2026-11-08), 사실 `docs/data/era-events-facts.md` 5절.
 * 장면: `eraR10Scenes.mjs` — REVISED 6(1950·1953·1961·1963·1969·2020) · NEW8(1959·1970·1973·1983·1998·2002·2008·2018) · VARIANTS 2(1953 열차 없는 안 B · 2002 응원 글자 있는 안).
 * 예산(마스터 결정 2026-10-28, SPEC-013 그대로): 장당 gzip ≤ 2,500B(군중 무거운 장면 ≤ 3,500B) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 14장 평균 목표 ≤ 2,140B▲.
 *
 * 실행: node scripts/design/buildEraWindowR11.mjs
 * 산출: docs/design/mockups/family/era-window-r11.html · pieces/era-r11/<id>.svg(16) · era-window-r11-budget.json
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다. 앞 회차 산출물은 그대로 둔다(전 기록). 10년 덩어리 추정은 앞 회차 실측 JSON(r3~r9)의 유지 장 gz를 읽어 더한다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA, NEW_TOKENS, NEW_TOKENS_DARK } from './eraR11Lib.mjs';
import { REVISED, NEW8, VARIANTS, ALL16, MAIN15 as MAIN14, COMP_LABEL, CHANGED_FROM_R10 } from './eraR11Scenes.mjs';
import { ALL16 as R10ALL } from './eraR10Scenes.mjs';
import { EVENTS as R3E } from './eraR3ScenesEvents.mjs';
import { HEAVY as R3H } from './eraR3ScenesHeavy.mjs';
import { S50 } from './eraR4Scenes50.mjs';
import { S60 } from './eraR4Scenes60.mjs';
import { S20 } from './eraR5Scenes20.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r11', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TONE_ID = 'a';
const LIMITS = { first: 32, second: 28, caption: 14 };
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000, avgTarget: 2140 };
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
const BEFORE = [...R3H, ...S50, ...S60, ...S20, ...R3E];
/** 전·후의 「전」 — r10에 있던 조각은 r10, 1988은 r3 승인 그림 */
const beforeOf = (q) => (q.id === 'era-1988-stadium-flame-r3' ? R3E.find((x) => x.id === q.id) : R10ALL.find((x) => x.id === q.id)) || null;
const EXPECT_REVISED = ['era-1950-refugee-column', 'era-1953-tent-school', 'era-1961-dawn-tank', 'era-1964-airport-farewell', 'era-1965-neighbors-tv', 'era-1988-stadium-flame-r3', 'era-2020-screening-tent-queue'];
const EXPECT_NEW_YEARS = [1959, 1970, 1973, 1983, 1998, 2002, 2008, 2018];
/** SPEC-013 부록 A 「확인 못 한 물건」 표지 13개 중 이 14장에 걸리는 것(id → 물건) — 재사용 장의 표지는 era-art-r1.md 표에 따로 적는다 */
const UNVERIFIED_SPEC = { 'era-1950-refugee-column': ['탱크(형진 님 결정으로 넣음)'], 'era-1961-dawn-tank': ['탱크(형진 님 결정으로 넣음)'], 'era-1964-airport-farewell': ['가방(트렁크)'], 'era-1973-gas-station-queue': ['주유소 줄'], 'era-1988-stadium-flame-r3': ['호돌이의 상모·목걸이(공개 자료 글로 확인 — 그림)'], 'era-2002-worldcup-semifinal': ['공식 마스코트(그리지 않음)'], 'era-2008-trading-board-blue': ['전광판'] };

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
const textOf = (s) => s.replace(/<text[^>]*>[^<]*<\/text>/g, '').replace(/<[^>]+>/g, '');
for (const q of ALL16) {
  if (!q.caption || !q.line) throw new Error(`승인 캡션·첫 문장 빠짐: ${q.id}`);
  if ([...q.line].length > LIMITS.first) throw new Error(`첫 문장 ${[...q.line].length}자 > ${LIMITS.first}: ${q.id}`);
  if ([...q.caption].length > LIMITS.caption) throw new Error(`캡션 ${[...q.caption].length}자 > ${LIMITS.caption}: ${q.id}`);
  if (q.second) for (const k of ['low', 'mid', 'high']) { if (!q.second[k]) throw new Error(`둘째 문장 ${k} 빠짐: ${q.id}`); if ([...q.second[k]].length > LIMITS.second) throw new Error(`둘째 문장 ${k} ${[...q.second[k]].length}자 > ${LIMITS.second}: ${q.id}`); if (/아버지|어머니|부모|엄마|아빠/.test(q.second[k])) throw new Error(`둘째 문장 부모 낱말: ${q.id}`); }
  if (/[A-Za-z가-힣0-9]/.test(textOf(q.draw()))) throw new Error(`그림 안 글자: ${q.id}`);
  if (/<text\b/.test(q.draw()) !== !!q.hasText) throw new Error(`글자 안 표기(hasText)와 <text> 불일치: ${q.id}`);
  if (q.hasText && !new RegExp(`<text[^>]*>${q.hasText}</text>`).test(q.draw())) throw new Error(`허용 글자와 다름: ${q.id}`);
  if (!q.ft3 || !q.draws || !q.comp || !q.object) throw new Error(`유지선(ft3)·그리는 것(draws)·구도(comp)·물건(object) 빠짐: ${q.id}`);
  if (!COMP_LABEL[q.comp]) throw new Error(`구도 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 형진 님·마스터 몫: ${q.id}`);
  if (q.band || q.ages) throw new Error(`사건 band·ages는 SPEC-013에서 없앴다: ${q.id}`);
  if (q.years && (q.years[0] !== q.years[1])) throw new Error(`사건 years는 한 해: ${q.id}`);
  for (const m of inner(q).matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (!ALLOWED.has(c)) throw new Error(`허용 목록 밖 class ${c}: ${q.id}`);
  if (/<(?!\/?(rect|path|circle|ellipse|use|g|text)\b)/.test(inner(q))) throw new Error(`허용 밖 태그: ${q.id}`);
  if (!q.hasText && /<text\b/.test(inner(q))) throw new Error(`글자 없는 장면에 <text>: ${q.id}`);
  if (q.heavy && q.second) throw new Error(`○ 사건에 둘째 문장: ${q.id}`);
  const spec = UNVERIFIED_SPEC[q.variantOf || q.id] || []; if (!q.variantOf && JSON.stringify(spec) !== JSON.stringify(q.unverified || [])) throw new Error(`「확인 못 한 물건」 표지가 SPEC 표와 다름: ${q.id} (${q.unverified} ≠ ${spec})`);
}
if (REVISED.length !== 7 || NEW8.length !== 8 || VARIANTS.length !== 1 || ALL16.length !== 16 || MAIN14.length !== 15) throw new Error('수정 7 · 새 8 · 두 안 1 기대');
if (ALL16.some((q) => q.hasText)) throw new Error('2002 글자 있는 안은 폐기(형진 님 2026-11-08)');
if (!('red' in LIGHT) || !('gold' in LIGHT)) throw new Error('새 토큰 red·gold 없음');
for (const id of CHANGED_FROM_R10) if (!ALL16.find((q) => q.id === id)) throw new Error(`달라진 조각 목록에 없는 id: ${id}`);
if (JSON.stringify(REVISED.map((q) => q.id).sort()) !== JSON.stringify([...EXPECT_REVISED].sort())) throw new Error('수정 6의 id가 SPEC 부록 C와 다르다');
if (JSON.stringify(NEW8.map((q) => q.year).sort()) !== JSON.stringify([...EXPECT_NEW_YEARS].sort())) throw new Error('새 8의 해가 SPEC 부록 C와 다르다');
for (const q of REVISED) if (!BEFORE.find((x) => x.id === q.revise)) throw new Error(`전 장면 없음: ${q.revise}`);
for (const q of VARIANTS) if (!MAIN14.find((x) => x.id === q.variantOf)) throw new Error(`두 안의 본 장면 없음: ${q.variantOf}`);
const objectCount = MAIN14.filter((q) => q.comp === 'object').length, mixedCount = MAIN14.filter((q) => q.comp === 'mixed').length;
if (objectCount + mixedCount < 7) throw new Error(`물건 초점·섞음 ${objectCount + mixedCount} < 7(SPEC 구도 원칙)`);
for (const q of MAIN14) if (q.heavy && q.comp !== 'place') throw new Error(`○ 사건은 현장 구도 유지: ${q.id}`);
const heavyIds = MAIN14.filter((q) => q.heavy).map((q) => q.id);
if (JSON.stringify(heavyIds) !== JSON.stringify(['era-1950-refugee-column', 'era-1959-typhoon-flood-village', 'era-1961-dawn-tank'])) throw new Error(`○ 3장(1950·1959·1961) 기대: ${heavyIds}`);

// ---------------------------------------------------------------- 조각 + 예산
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use|text)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r11(SPEC-013 T5, 형진 님 피드백 반영) · ${q.id} · ${q.year} · ${q.hCode} · ${q.topic} · 캡션 「${q.caption}」${q.heavy ? ' · 무거운 장면(가리기 설정 대상, 기본 꺼짐)' : ''} · ${q.revise ? `수정(전 ${q.revise})` : q.variantOf ? `두 안(본 ${q.variantOf})` : '새 장면'} · 구도 ${COMP_LABEL[q.comp]}${q.unverified && q.unverified.length ? ` · 확인 못 한 물건: ${q.unverified.join('·')}` : ''}${q.hasText ? ` · 그림 안 글자 「${q.hasText}」(형진 님이 고르면 T2 허용 목록)` : ''} · 승인 전(approved: false — 형진 님 사건별 승인 뒤) · 새로 구성(사진 모사 없음, 얼굴 식별 없음, 공식 엠블럼 없음) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 톤 A는 CSS 필터 + 한 겹 --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = ALL16.map((q) => {
  const cls = inner(q); write(`pieces/era-r11/${q.id}.svg`, pieceSvg(q));
  const g = gz(cls); const limit = q.heavy ? BUDGET.perPictureCrowdHeavy : BUDGET.perPicture;
  const before = q.revise ? BEFORE.find((x) => x.id === q.revise) : null; const gzBefore = before ? gz(toClass(before.draw() + toneLayer(TONE_ID, before.year))) : null; const b10 = beforeOf(q); const gzR10 = b10 ? gz(toClass(b10.draw() + toneLayer(TONE_ID, b10.year))) : null; const changed = CHANGED_FROM_R10.includes(q.id) || q.id === 'era-1988-stadium-flame-r3';
  return { id: q.id, year: q.year, years: [q.year, q.year], decade: decadeOf(q.year), hCode: q.hCode, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, revise: q.revise || null, variantOf: q.variantOf || null, hasText: q.hasText || null, caption: q.caption, captionChars: [...q.caption].length, line: q.line, lineChars: [...q.line].length, second: q.second || null, comp: q.comp, compLabel: COMP_LABEL[q.comp], object: q.object, unverified: q.unverified || [], draws: q.draws, ft3: q.ft3, shapes: countShapes(cls), uses: countUses(cls), raw: Buffer.byteLength(cls, 'utf8'), gz: g, gzBefore, gzR10, changedFromR10: changed, over25: g > BUDGET.perPicture, overLimit: g > limit, approved: false };
});
const main = rows.filter((r) => !r.variantOf);
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);

// 10년 덩어리 추정 — SPEC-013 부록 C 유지 37 + 이 14장(두 안 제외). 유지 장 gz는 앞 회차 실측 JSON에서 가장 뒤 회차 값을 읽는다.
const prevGz = {};
for (const r of ['r3', 'r4', 'r5', 'r5b', 'r6', 'r7', 'r9']) { try { for (const row of JSON.parse(readFileSync(`${OUT}era-window-${r}-budget.json`, 'utf8')).rows || []) if (row.gz) prevGz[row.id] = { gz: row.gz, round: r }; } catch { /* 없으면 건너뜀 */ } }
const RETAINED = { // 사건 해 → id (부록 A·C, r3 기준. 2009 스마트폰은 2010으로 옮긴다)
  1945: 'era-1945-liberation-street', 1948: 'era-1948-polling-queue', 1960: 'era-1960-april-street', 1974: 'era-1974-subway-platform-r3', 1979: 'era-1979-autumn-martial-street', 1980: 'era-1980-may-geumnam-ro', 1987: 'era-1987-june-street', '1987b': 'era-1987-polling-station-r3',
  1995: 'era-1995-sampoong-rescue', 1997: 'era-1997-dawn-labor-market', 1999: 'era-1999-millennium-night', 2003: 'era-2003-subway-entrance-smoke', 2009: 'era-2009-square-mourning-queue', 2010: 'era-2009-first-smartphone', 2014: 'era-2014-tilted-ferry-ribbons', 2016: 'era-2016-candle-winter', 2022: 'era-2022-alley-tape-flowers', 2023: 'era-2023-grocery-scale', 2026: 'era-2026-job-board-waiting',
  2030: 'era-2030-basic-income-queue-rain', 2035: 'era-2030s-care-intake-empty-chairs', 2040: 'era-2040-empty-lecture-hall', 2044: 'era-2044-bci-rehab-waiting', 2050: 'era-2050-clinic-glass-outside', 2055: 'era-2050s-noon-empty-street-speaker', 2062: 'era-2060s-empty-village-vines', 2065: 'era-2065-mind-market-hall', 2072: 'era-2070s-school-turned-elder-home', 2075: 'era-2075-river-two-sides-barrier', 2082: 'era-2080s-port-split-two-blocs', 2085: 'era-2085-plaza-long-queue-ai-towers', 2088: 'era-2080s-wind-sun-coast-city', 2095: 'era-2095-flooded-town-leaving-line', 2100: 'era-2100-half-city-demolition-towers', 2105: 'era-2100s-night-sky-stations-hill', 2110: 'era-end-horizon',
};
const retainedRows = Object.entries(RETAINED).map(([y, id]) => { const year = parseInt(y, 10); const p = prevGz[id]; return { id, year, decade: year >= 2110 ? 2100 : decadeOf(year), gz: p ? p.gz : null, round: p ? p.round : null }; });
const missing = retainedRows.filter((r) => r.gz === null).map((r) => r.id);
if (retainedRows.length !== 36) throw new Error(`유지 ${retainedRows.length}장(36 기대 — 1988은 수정으로)`);
const decadesAll = [...new Set([...retainedRows, ...main].map((r) => r.decade))].sort((a, b) => a - b);
const decades = decadesAll.map((d) => { const keep = retainedRows.filter((r) => r.decade === d), mine = main.filter((r) => r.decade === d); const pics = sum(keep, 'gz') + sum(mine, 'gz'); const est = pics + defsGz + cssGz + 220 * (keep.length + mine.length); return { decade: d, retained: keep.map((r) => r.id), r10: mine.map((r) => r.id), pieces: keep.length + mine.length, picsGz: pics, estWithDefsLines: est, overMax: est > BUDGET.perDecadeChunk }; });
const lazyEst = decades.reduce((a, d) => a + d.estWithDefsLines, 0);
const budget = {
  measuredAt: '2026-11-09', round: 'r11', spec: 'SPEC-013 T5', tone: TONE_ID, newTokens: { light: NEW_TOKENS, darkProposed: NEW_TOKENS_DARK },
  note: 'r11 16조각 = 15장(수정 7 — 1988 재사용→수정 포함 + 새 8) + 두 안 1(1953 안 B). gzR10은 r10 같은 id(1988은 r3 승인 그림). gz는 그림 안쪽 마크업(톤 겹 포함)을 class·use로 바꾼 뒤 gzip, gzBefore는 수정 전 장면(r3·r4·r5)의 같은 셈. decades는 SPEC-013 부록 C 유지 37장(앞 회차 실측 gz) + 이 14장을 10년마다 더하고 defs·CSS·한 줄(장당 220B 어림)을 보탠 보수적 추정 — 정본 수치는 developer의 T6 실측. 예산(마스터 2026-10-28·SPEC-013): 장당 ≤ 2.5KB(군중 무거운 장면 ≤ 3.5KB) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB · 14장 평균 ≤ 2,140B▲.',
  budget: BUDGET, pieces: rows.length, main: main.length, revised: REVISED.length, new: NEW8.length, variants: VARIANTS.length, heavy: main.filter((r) => r.heavy).length,
  comp: { object: objectCount, mixed: mixedCount, place: MAIN14.length - objectCount - mixedCount },
  shapesAvg: Math.round(sum(main, 'shapes') / main.length), shapesMax: Math.max(...main.map((r) => r.shapes)), usesAvg: Math.round(sum(main, 'uses') / main.length),
  gzEachAvg: Math.round(sum(main, 'gz') / main.length), gzEachMax: Math.max(...main.map((r) => r.gz)), gzEachMin: Math.min(...main.map((r) => r.gz)), gzEachTotal: sum(main, 'gz'), gzBeforeTotal: sum(main.filter((r) => r.gzBefore), 'gzBefore'), gzRevisedAfter: sum(main.filter((r) => r.revise), 'gz'),
  over25: main.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`), avgOverTarget: Math.round(sum(main, 'gz') / main.length) > BUDGET.avgTarget,
  defsGz, cssGz, decades, lazyEst, lazyOver: lazyEst > BUDGET.totalLazy, maxDecadeEst: Math.max(...decades.map((d) => d.estWithDefsLines)), retainedMissingGz: missing,
  rows,
};
write('era-window-r11-budget.json', JSON.stringify(budget, null, 2) + '\n');
if (budget.overLimit.length) throw new Error(`장당 상한 초과: ${budget.overLimit.join(', ')}`);

// ---------------------------------------------------------------- 시트
const fmt = (n) => n.toLocaleString('ko-KR');
const capSpan = (q) => `<span class="ew__capline" data-testid="era-cap">${esc(q.caption)}</span>`;
/** 카드 안 창 칸 — PC(175×140: 그림 175×118 + 캡션 줄) */
const pcCell = (q) => `<div class="ew__era" data-era="${q.id}" data-size="pc"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}<span class="ew__year">${q.year}년</span></div>${capSpan(q)}</div>`;
/** 휴대폰 띠(326×80: 그림 100×80 + 옆 캡션) */
const phoneCell = (q) => `<div class="ew__era ew__era--phone" data-era="${q.id}" data-size="phone"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}<span class="ew__year">${q.year}년</span></div>${capSpan(q)}</div>`;
const secondHtml = (q) => q.second ? `<dl class="ew__second"><dt>아래</dt><dd>${esc(q.second.low)}</dd><dt>가운데</dt><dd>${esc(q.second.mid)}</dd><dt>위</dt><dd>${esc(q.second.high)}</dd></dl>` : '';
const tagList = (q) => [q.revise ? `수정(전 ${q.revise})` : q.variantOf ? `두 안(본 ${q.variantOf})` : '새 장면', COMP_LABEL[q.comp], q.heavy ? '○ 무거운 장면(가리기 대상)' : '가리기 대상 밖', ...(q.unverified || []).map((u) => `확인 못 한 물건: ${u}`), ...(q.hasText ? [`그림 안 글자 「${q.hasText}」`] : [])].map((t) => `<span class="ew__tag${/확인 못 한/.test(t) ? ' ew__tag--warn' : ''}${/글자/.test(t) ? ' ew__tag--text' : ''}">${esc(t)}</span>`).join('');
const eventBlock = (q) => { const r = rows.find((x) => x.id === q.id); const vars = VARIANTS.filter((v) => v.variantOf === q.id); return `<section class="ew__event" id="ev-${q.id}" data-event="${q.id}">
<h3 class="ew__evh"><span class="ew__evyear">${q.year}</span> ${esc(q.caption)} <span class="ew__evname">${esc(q.name)}</span></h3>
<div class="ew__evgrid">
<div class="ew__cells">${pcCell(q)}${phoneCell(q)}</div>
<div class="ew__evtext"><p class="ew__line"><span class="ew__linelabel">인생 기록 줄</span>${esc(q.line)} <span class="ew__chars">(${r.lineChars})</span></p>${secondHtml(q)}<p class="ew__tags">${tagList(q)}</p><p class="ew__draws">${esc(q.draws)}</p><p class="ew__ft3">${esc(q.ft3)}</p><p class="ew__meta">초점 물건: ${esc(q.object)} · gzip <b>${fmt(r.gz)}B</b>${r.gzBefore ? ` (전 ${fmt(r.gzBefore)}B)` : ''} · 조각 ${r.shapes}(use ${r.uses}) · 상한 ${q.heavy ? '3,500' : '2,500'}B</p><p class="ew__approve"><span>승인(형진 님)</span><span class="ew__approvebox" aria-hidden="true"></span>읽힌다 / 고침: </p></div>
</div>
${vars.length ? `<div class="ew__variants"><p class="ew__note">두 안 — 형진 님이 고른다(안 A 철조망·표지판·돌아서는 군인 / 안 B 내려놓은 소총).</p>${vars.map((v) => { const vr = rows.find((x) => x.id === v.id); return `<div class="ew__variant" data-variant="${v.id}"><div class="ew__cells">${pcCell(v)}${phoneCell(v)}</div><div class="ew__evtext"><p class="ew__draws"><b>${esc(v.name)}</b> — ${esc(v.draws)}</p><p class="ew__tags">${tagList(v)}</p><p class="ew__meta">gzip <b>${fmt(vr.gz)}B</b> · 조각 ${vr.shapes}(use ${vr.uses})</p><p class="ew__approve"><span>선택</span><span class="ew__approvebox" aria-hidden="true"></span>이 안 / 본 안: </p></div></div>`; }).join('')}</div>` : ''}
</section>`; };
const CHANGE_NOTE = { 'era-1950-refugee-column': '고개 위 탱크 둘과 포연을 더함(형진 님: 참상이 전해지게)', 'era-1953-tent-school': '열차 → 군사분계선 철조망·빈 표지판·돌아서는 군인(철모·소총 크게)', 'era-1953-tent-school-b': '돌아가는 길 → 내려놓은 소총 더미와 벗어 둔 철모', 'era-1961-dawn-tank': '탱크를 되살리고 앞 군인 열을 키움(철모·소총)', 'era-1964-airport-farewell': '광부(안전모·헤드램프·작업복) 둘을 앞에, 독일 국기·태극기 나란히', 'era-1970-expressway-tollgate': '차단기·부스를 키움, 빨간 띠', 'era-1988-stadium-flame-r3': '재사용 → 수정: 오륜 깃발 + 호돌이 크게(r3 승인 그림이 전)', 'era-1998-gold-rings-tray': '금반지를 새 금 토큰으로', 'era-2002-worldcup-semifinal': '붉은 티셔츠·뿔을 새 빨강 토큰으로, 축구공을 더 크게(글자 없는 안 확정)', 'era-2018-pyeongchang-torch': '오륜 깃발 + 수호랑(앞, 점 눈·미소)' };
const beforeAfter = (q) => { const b = beforeOf(q); const r = rows.find((x) => x.id === q.id); return `<div class="ew__ba" data-ba="${q.id}"><figure class="ew__fig ew__fig--before"><div class="ew__pic" data-dec="${decadeOf(b.year)}">${svgOf(b)}</div><figcaption class="ew__cap"><span class="ew__year2">전 · ${q.id === 'era-1988-stadium-flame-r3' ? 'r3 승인' : '10차'} <span class="ew__kindtag">${fmt(r.gzR10)}B</span></span><span class="ew__kind">${esc(b.name)}</span></figcaption></figure><figure class="ew__fig"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div><figcaption class="ew__cap"><span class="ew__year2">후 · 11차 <span class="ew__kindtag">${fmt(r.gz)}B</span></span><span class="ew__kind">${esc(q.name)}</span><span class="ew__kind">${esc(CHANGE_NOTE[q.id] || '')}</span></figcaption></figure></div>`; };
const CHANGED = ALL16.filter((q) => CHANGED_FROM_R10.includes(q.id) || q.id === 'era-1988-stadium-flame-r3');

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 11차 — SPEC-013 그림 열다섯 장(형진 님 피드백 반영)</title>
<!-- 시안(정적 HTML) — SPEC-013 T5 r11(형진 님 피드백 2026-11-08 반영). 생성 scripts/design/buildEraWindowR11.mjs · ?theme=dark 다크 · ?only=cards 카드 절만(360 한 장 캡처용). 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음, 공식 엠블럼 없음), 승인 전(approved: false). 사람 조각은 symbol+use, 색은 class(허용 목록 안). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('only'))document.documentElement.setAttribute('data-only',q.get('only'));})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew h3 { font-size: var(--fs-md); margin: var(--sp-5) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew code { font-family: inherit; background: var(--c-surface-2); padding: 0 .3em; border-radius: var(--r-sm); }
.ew__links { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--fs-sm); margin: 0 0 var(--sp-6); }
/* 카드 안 창 칸 — 구현의 .era(175×140 · 326×80)와 같은 크기, 캡션 12px --c-text-2(era-empty-frame.md 1절) */
.ew__era { display: grid; grid-template-rows: minmax(0, 1fr) auto; width: 175px; height: 140px; background: var(--c-surface-2); border: 1px solid var(--c-border); box-sizing: border-box; overflow: hidden; }
.ew__era .ew__pic { position: relative; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: var(--c-scene-sky); }
.ew__era .ew__pic svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; forced-color-adjust: none; }
.ew__year { position: absolute; left: 0; top: 0; padding: 1px 6px; font-size: var(--fs-xs); font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; color: var(--c-text); background: var(--c-surface); border-bottom-right-radius: var(--r-sm); }
.ew__capline { display: block; padding: 3px var(--sp-2) 4px; font-size: var(--fs-xs); line-height: 1.3; color: var(--c-text-2); word-break: keep-all; overflow-wrap: anywhere; }
.ew__era--phone { width: 326px; height: 80px; grid-template-columns: 100px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); column-gap: var(--sp-2); }
.ew__era--phone .ew__pic { width: 100px; height: 78px; }
.ew__era--phone .ew__capline { align-self: start; padding: var(--sp-2) var(--sp-2) 0 0; }
.ew__cells { display: grid; gap: var(--sp-3); align-content: start; }
.ew__event { padding: var(--sp-5) 0; border-top: 1px solid var(--c-border); }
.ew__evh { margin: 0 0 var(--sp-3); font-size: var(--fs-lg); }
.ew__evyear { font-variant-numeric: tabular-nums; }
.ew__evname { font-weight: var(--fw-regular); color: var(--c-text-2); font-size: var(--fs-sm); }
.ew__evgrid { display: grid; grid-template-columns: 326px minmax(0, 1fr); gap: var(--sp-4) var(--sp-6); align-items: start; }
.ew__evtext { font-size: var(--fs-sm); line-height: 1.5; color: var(--c-text); min-width: 0; }
.ew__evtext p { margin: 0 0 var(--sp-2); }
.ew__line { font-size: var(--fs-md); }
.ew__linelabel { display: inline-block; margin-right: var(--sp-2); padding: 0 var(--sp-2); font-size: var(--fs-xs); color: var(--c-text-2); background: var(--c-surface-2); border-radius: var(--r-sm); }
.ew__chars { color: var(--c-text-2); font-size: var(--fs-xs); }
.ew__second { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px var(--sp-3); margin: 0 0 var(--sp-2); }
.ew__second dt { color: var(--c-text-2); }
.ew__second dd { margin: 0; }
.ew__tags { display: flex; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); }
.ew__tag { display: inline-block; padding: 1px var(--sp-2); font-size: var(--fs-xs); background: var(--c-surface-2); border-radius: var(--r-sm); color: var(--c-text-2); }
.ew__tag--warn { color: var(--c-text); background: var(--c-surface); border: 1px solid var(--c-border-strong); }
.ew__tag--text { color: var(--c-text); border: 1px solid var(--c-border-strong); background: var(--c-surface); }
.ew__draws { color: var(--c-text); }
.ew__ft3 { color: var(--c-text-2); }
.ew__meta { color: var(--c-text-2); font-variant-numeric: tabular-nums; }
.ew__approve { display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); padding: var(--sp-2) var(--sp-3); background: var(--c-surface-2); border-radius: var(--r-sm); }
.ew__approvebox { display: inline-block; width: 14px; height: 14px; border: 1px solid var(--c-border-strong); border-radius: 2px; flex: none; }
.ew__variants { margin-top: var(--sp-4); padding: var(--sp-3) var(--sp-4); background: var(--c-surface-2); }
.ew__variant { display: grid; grid-template-columns: 326px minmax(0, 1fr); gap: var(--sp-4) var(--sp-6); align-items: start; margin-top: var(--sp-3); }
.ew__variant .ew__era { background: var(--c-surface); }
.ew__bas { display: grid; gap: var(--sp-5); }
.ew__ba { display: grid; grid-template-columns: 175px 175px; gap: var(--sp-5); align-items: start; }
.ew__fig { margin: 0; min-width: 0; width: 175px; }
.ew__fig .ew__pic { width: 175px; height: 140px; overflow: hidden; background: var(--c-scene-sky); }
.ew__fig .ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin-top: var(--sp-2); font-size: var(--fs-sm); line-height: 1.5; color: var(--c-text); word-break: keep-all; }
.ew__year2 { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__kindtag { font-weight: var(--fw-regular); color: var(--c-text-2); }
.ew__kind { color: var(--c-text-2); }
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__zoom .ew__fig .ew__pic { width: 350px; max-width: 100%; height: auto; aspect-ratio: 5 / 4; }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew__tablewrap { overflow-x: auto; }
.ew__ask { max-width: 72ch; padding-left: 1.2em; }
.ew__ask li { margin: 0 0 var(--sp-2); }
@media (max-width: 1023px) { .ew__evgrid, .ew__variant { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__era:not(.ew__era--phone) { display: none; } .ew__era--phone { width: 100%; max-width: 326px; } .ew__ba { grid-template-columns: minmax(0, 1fr); } .ew__links { gap: var(--sp-2); } }
html[data-only='cards'] .ew > :not(.ew__cards):not(h1):not(.ew__lead) { display: none; }
html[data-only='cards'] .ew__event .ew__draws, html[data-only='cards'] .ew__event .ew__ft3, html[data-only='cards'] .ew__event .ew__meta { display: none; }
@media (forced-colors: active) { .ew__era, .ew__fig .ew__pic { border: 1px solid CanvasText; } .ew__approvebox { border-color: CanvasText; } }
${toneCssA('.ew')}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
<main class="ew">
<h1>시대의 창 11차 — 그림 열다섯 장</h1>
<p class="ew__lead">10차에 주신 말씀을 반영했습니다. 군인은 철모·군복·소총이, 광부는 안전모·헤드램프·작업복이 띠 크기에서도 보이게 앞줄을 키웠고, 1963에는 독일 국기와 태극기를 나란히 걸었습니다. 1953 휴전은 군사분계선의 철조망·표지판·돌아서는 군인(안 A)과 내려놓은 소총 더미(안 B)로 다시 그렸고, 1961에는 탱크를 되살렸으며 1950 고개 위에도 탱크를 두었습니다. 1988과 2018에는 오륜과 마스코트(호돌이·수호랑)를 크게 넣었고, 2002는 글자 없는 안으로, 붉은 티셔츠와 금반지는 새 빨강·금 토큰으로 선명하게 했습니다. 캡션과 문장은 승인된 글 그대로이고, 그림은 사건별 승인 전입니다.</p>
<nav class="ew__links" aria-label="보기"><a href="era-window-r11.html">라이트</a><a href="era-window-r11.html?theme=dark">다크</a><a href="era-window-r11.html?only=cards">카드 절만</a><a href="era-window-r10.html">10차 시트(전)</a><a href="../era-empty-frame.html?v=b">빈 해 종이틀 시안</a><a href="era-window-r9.html">9차 시트</a><a href="era-window-r5b.html">5차b 시트</a></nav>

<div class="ew__cards">
<h2>카드 안 모습</h2>
<p class="ew__note">사건마다 창 칸과 인생 기록 줄입니다. 왼쪽 위가 PC 카드의 창 칸(175×140, 그림 아래 캡션 한 줄), 그 아래가 휴대폰 띠(326×80, 그림 옆 캡션)입니다. 오른쪽은 그해 인생 기록에 적히는 첫 문장과, 둘째 문장이 있는 사건이면 수저 구간별 둘째 문장입니다. 「확인 못 한 물건」 표지가 붙은 장은 그 물건이 출처로 확인되지 않은 것입니다(사실표 5절) — 형진 님이 판단하십니다.</p>
${MAIN14.map(eventBlock).join('\n')}
</div>

<h2>10차에서 달라진 열 조각 — 전·후</h2>
<p class="ew__note">왼쪽이 10차(1988은 r3 승인 그림), 오른쪽이 이번 11차입니다. 1959·1969·1973·1983·2008·2020은 10차 그대로입니다. developer는 조각을 <code>pieces/era-r11/</code>에서 가져갑니다(1963은 <code>years</code>를 1963으로, 1969는 1969로).</p>
<div class="ew__bas" data-tone="${TONE_ID}">${CHANGED.map(beforeAfter).join('')}</div>

<h2>크게 보기 350×280 — 열여섯 조각</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${ALL16.map((q) => `<figure class="ew__fig" data-era="${q.id}"><div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div><figcaption class="ew__cap"><span class="ew__year2">${q.year}년 <span class="ew__kindtag">${esc(q.caption)}</span></span><span class="ew__kind">${esc(q.name)}</span></figcaption></figure>`).join('')}</div>

<h2>구도 · 물건 · 표지 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col" class="num">해</th><th scope="col">캡션</th><th scope="col">구분</th><th scope="col">구도</th><th scope="col">초점 물건</th><th scope="col">표지</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="num">${r.year}</td><td>${esc(r.caption)}</td><td>${r.revise ? '수정' : r.variantOf ? '두 안' : '새'}${r.heavy ? ' · ○' : ''}</td><td>${r.compLabel}</td><td>${esc(r.object)}</td><td>${[...r.unverified.map((u) => `확인 못 한 물건: ${u}`), ...(r.hasText ? [`글자 「${r.hasText}」`] : [])].map(esc).join(' · ') || '–'}</td><td class="num">${r.shapes}(${r.uses})</td><td class="num">${r.gzBefore ? `${fmt(r.gzBefore)} → ` : ''}${fmt(r.gz)}B${r.overLimit ? ' · 상한 초과' : r.over25 ? ' · 2.5KB 초과(군중 무거운 장면 3.5KB 안)' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">열네 장 합계 gzip ${fmt(budget.gzEachTotal)}B · 장당 평균 <strong>${fmt(budget.gzEachAvg)}B</strong>(최소 ${fmt(budget.gzEachMin)} · 최대 ${fmt(budget.gzEachMax)}, 목표 ≤ 2,140B${budget.avgOverTarget ? ' — 넘음' : ' — 안'}). 수정 여섯은 ${fmt(budget.gzBeforeTotal)}B → ${fmt(budget.gzRevisedAfter)}B. 구도: 물건 초점 ${objectCount} · 섞음 ${mixedCount} · 장소·사람 ${MAIN14.length - objectCount - mixedCount}(물건 초점 + 섞음 = ${objectCount + mixedCount} ≥ 7). 10년 덩어리 추정(유지 37 + 이 14, defs·CSS·한 줄 포함): ${decades.map((d) => `${d.decade >= 2000 ? d.decade : 19 + String(d.decade).padStart(2, '0')}년대 ${fmt(d.estWithDefsLines)}B`).join(' · ')} — 가장 큰 덩어리 ${fmt(budget.maxDecadeEst)}B(≤ 24,000) · 누적 ${fmt(lazyEst)}B(≤ 230,000). 정본 수치는 era-window-r10-budget.json, 실측은 developer T6.</p>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>사건별 승인 15</b> — 캡션 없이도 그 사건으로 읽히는지(1953 휴전 · 1961 탱크 · 1963 광부와 국기 · 1988 호돌이·오륜 · 2018 수호랑·오륜 · 2002 붉은 거리). 「읽힌다」가 승인입니다.</li>
<li><b>1953 두 안</b> — 안 A(군사분계선 철조망·빈 표지판·돌아서는 군인) / 안 B(내려놓은 소총 더미와 벗어 둔 철모).</li>
<li><b>오륜·마스코트</b> — 오륜은 IOC 상표이고 호돌이·수호랑의 권리도 IOC에 있다는 점(공개 자료 글)을 알고 넣는 것인지 한 번 더 확인합니다. 문제 제기가 오면 그 그림만 오륜 없는 형태로 바꿉니다(Two-way). 마스코트는 공개 자료의 글 설명을 보고 새로 구성했고(이미지 내려받기·붙여넣기 0), 캐릭터라 점 눈·미소를 그렸습니다.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r11.html', html);

console.log(`시대의 창 r11: 조각 ${rows.length}(수정 ${REVISED.length} · 새 ${NEW8.length} · 두 안 ${VARIANTS.length}) · ○ ${budget.heavy} · 구도 물건 ${objectCount}/섞음 ${mixedCount}/장소 ${MAIN14.length - objectCount - mixedCount} · 14장 평균 gzip ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B + css ${cssGz}B`);
for (const r of rows) console.log(`${r.year} ${r.id}: ${r.heavy ? '○ ' : ''}${r.compLabel} · 조각 ${r.shapes}(use ${r.uses}) · gz ${r.gzBefore ? `${r.gzBefore} → ` : ''}${r.gz}${r.overLimit ? ' !!상한' : r.over25 ? ' !2.5KB' : ''} · 「${r.caption}」 ${r.line}`);
for (const d of decades) console.log(`${d.decade}년대: 유지 ${d.retained.length} + r10 ${d.r10.length} → 추정 ${d.estWithDefsLines}B${d.overMax ? ' !!24KB 초과' : ''}`);
console.log(`누적 추정 ${lazyEst}B · 유지 장 gz 못 찾음: ${missing.length ? missing.join(', ') : '없음'}`);

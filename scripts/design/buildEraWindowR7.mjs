/**
 * SPEC-010 「시대의 창」 7차(r7) 시안 생성기 — 미래 연표 묶음 B (designer 2026-11-03).
 *
 * 정본: `docs/spec/SPEC-010-미래연표.md`(2026-11-03 확정) 「할 것」 FU4 · 「연표 표」 2040년대(8장)·2050년대(6장) · 「그림 수위」 · 「예산」 · 「순서」 4, 스타일 정본 `docs/design/era-window.md`(톤 A · 3-1 · r3~r6 · 허용 class · 11절 r6).
 * 만드는 것: 그림 14장(U13~U26). 칩·톤은 다시 제안하지 않는다 — 형진 님이 묶음 A에서 정한 **안 B(칩은 기록 줄과 창 양쪽)·안 1(밑그림 톤)**이 적용된 모습만 시트에 보인다.
 * 조각 위치·형식은 r6과 같다(`pieces/era-r7/<id>.svg`, `era-window-r7-budget.json` — genEraWindows.ts가 읽는 행 모양 + `basis`·`u`·`forecast`·`years`).
 * 예산(SPEC-010): 장당 평균 ≤ 1.6KB gzip · 상한 2.5KB(○ 없음) · 2040년대 덩어리 어림 13.5KB · 2050년대 10.5KB(10년 덩어리 ≤ 24KB) · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB).
 * 지킨 것: `src/`·`tests/` 손대지 않음(읽기만: tokens.css 토큰 값) · 승인 표기 0(approved: false) · 외부 URL 0 · 사진 모사 0 · 인터넷 조사 0.
 *
 * 실행: node scripts/design/buildEraWindowR7.mjs
 * 산출: docs/design/mockups/family/era-window-r7.html · pieces/era-r7/<id>.svg(14) · era-window-r7-budget.json
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA, futureToneCss, chipCss, FUTURE_TONE, ICON_AHEAD, ICON_PROJ, ICON_ERA, ICON_YEAR } from './eraR7Lib.mjs';
import { S7, BASIS_LABEL } from './eraR7Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r7', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const ACTUAL_LAST = 2026;
const BAND_YEARS = [2044, 2050]; // 이 묶음에서 수저 구간이 갈리는 해(부유한 쪽만 다른 그림)
const BAND_LABEL = { low: '아래 둘(흙·동수저)', high: '위 둘(금수저 쪽)' };
const WHO = (q) => (q.band === 'low' ? '어려운 쪽' : q.band === 'high' ? '부유한 쪽' : q.kind === 'event' && BAND_YEARS.includes(q.year) ? '어려운 쪽·가운데' : '모두');
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
// SPEC-010 구현 규칙 6·「그림 수위」 6 — 줄 문장 금지 낱말(developer 시험 목록은 따로 만든다; 여기서는 시안 단언)
const FEAR = /종말|붕괴|멸망|재앙|파국|참사|위기/;
const ACTOR = /(갔|탔|샀|받았|일했|출근|퇴근|배웠|먹었|마셨)/;
const COUNTRY_OK = /인도/; // 이 묶음에서 줄에 허용된 나라 이름(경제 사실 문장 U24)
// SPEC 표의 문장 그대로인데 낱말 목록에 걸리는 줄 — 줄은 designer가 바꾸지 않는다(형진 님 승인 뒤에만). 생성기는 막지 않고 경고로 남기며 시트 「안 맞는 곳」에 문장 대안을 적는다.
//   U23 「사과 재배지가 북쪽으로 올라갔습니다.」 — 주어가 재배지(사물)라 뜻은 세상 소식이지만 「올라갔」의 「갔」이 구현 규칙 6 목록(갔|탔|…)에 걸린다. developer 시험(FU7)이 낱말로 잡으면 이 줄은 막힌다 → 마스터 보고.
const ACTOR_EXCEPTIONS = { 'era-2053-apple-orchard-hillside': '「올라갔」의 「갔」 — 주어는 재배지(사물)' };
const warnings = [];

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
if (S7.length !== 14) throw new Error(`장면 ${S7.length}장(14 기대)`);
for (const q of S7) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (!/습니다\.$/.test(q.line)) throw new Error(`합쇼체 사실 문장이 아니다: ${q.id}`);
  if (/\d/.test(q.line)) throw new Error(`줄에 숫자: ${q.id}`);
  if (/[A-Za-z]/.test(q.line.replace(/AGI|AI/g, ''))) throw new Error(`줄에 AI·AGI 밖 알파벳: ${q.id}`);
  if (FEAR.test(q.line)) throw new Error(`줄에 공포·평가 낱말: ${q.id}`);
  if (ACTOR.test(q.line)) { if (!(q.id in ACTOR_EXCEPTIONS)) throw new Error(`2027년 이후 줄에 주인공 행동 낱말: ${q.id}`); warnings.push(`${q.u} 줄 「${q.line}」이 주인공 행동 낱말 목록에 걸린다(${ACTOR_EXCEPTIONS[q.id]}) — SPEC 표 문장 그대로, 대안은 시트 「안 맞는 곳」`); }
  if (/일본|독일|미국|중국|러시아/.test(q.line) || (/인도/.test(q.line) && !COUNTRY_OK.test(q.line))) throw new Error(`줄의 나라 이름(허용 밖): ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws || !q.u) throw new Error(`유지선 판단(ft3)·그리는 것(draws)·번호(u) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
  if (q.heavy) throw new Error(`이 묶음에 ○는 없다: ${q.id}`);
  if (q.year <= ACTUAL_LAST || !(q.basis in BASIS_LABEL)) throw new Error(`basis 규칙(2027~ 필수): ${q.id}`);
  if (q.kind === 'daily' && (!q.years || q.ageBand !== '모두')) throw new Error(`일상은 years + ages 없음(모두): ${q.id}`);
  if (q.kind === 'event' && q.years) throw new Error(`사건은 한 해짜리: ${q.id}`);
  if (q.decade !== decadeOf(q.year) || ![2040, 2050].includes(q.decade)) throw new Error(`10년대 값: ${q.id}`);
  const m = inner(q);
  for (const c of m.matchAll(/class="([^"]+)"/g)) for (const k of c[1].split(/\s+/)) if (!ALLOWED.has(k)) throw new Error(`허용 목록 밖 class ${k}: ${q.id}`);
  if (/<(?!\/?(rect|path|circle|ellipse|use|g)\b)/.test(m)) throw new Error(`허용 밖 태그: ${q.id}`);
  if (/<text|<image|href="http|url\(http/.test(m)) throw new Error(`글자·외부 자원: ${q.id}`);
}
const U = Object.fromEntries(S7.map((q) => [q.u, q]));
if (S7.map((q) => q.u).join() !== 'U13,U14,U15,U16,U17,U18,U19,U20,U21,U22,U23,U24,U25,U26') throw new Error('번호 U13~U26 순서');
if (!(U.U14.band === undefined && U.U15.band === 'high' && U.U14.year === 2044 && U.U15.year === 2044)) throw new Error('2044: U14 band 없음 · U15 high');
if (!(U.U21.band === undefined && U.U22.band === 'high' && U.U21.year === 2050 && U.U22.year === 2050)) throw new Error('2050: U21 band 없음 · U22 high');
if (!([U.U13, U.U16, U.U23, U.U24].every((q) => q.kind === 'event' && !q.band) && [U.U13, U.U16, U.U23, U.U24].map((q) => q.year).join() === '2040,2046,2053,2055')) throw new Error('2040·2046·2053·2055 모두가 보는 사건');
const daily40 = S7.filter((q) => q.kind === 'daily' && q.decade === 2040), daily50 = S7.filter((q) => q.kind === 'daily' && q.decade === 2050);
if (!(daily40.length === 4 && daily40.filter((q) => !q.band).length === 2 && daily40.find((q) => q.band === 'low') && daily40.find((q) => q.band === 'high'))) throw new Error('2040년대 일상: 모두 2 + 아래 1 + 위 1');
if (!(daily50.length === 2 && daily50.every((q) => !q.band))) throw new Error('2050년대 일상: 모두 2');
// 고르기 흉내(10-1·8-2절 규칙): 2040~2059 × 구간 셋에 그림이 닿고, 같은 그림이 3해 연속 나오지 않는다
const pickOf = (y, band, prev) => {
  const evs = S7.filter((q) => q.kind === 'event' && q.year === y);
  const ev = evs.find((q) => q.band === band) || evs.find((q) => !q.band);
  if (ev) return ev.id;
  const dl = S7.filter((q) => q.kind === 'daily' && q.years[0] <= y && y <= q.years[1]);
  const mine = band !== 'mid' ? dl.filter((q) => q.band === band) : [];
  const base = dl.filter((q) => !q.band);
  const cands = [...mine, ...base].filter((q) => !(prev[0] === q.id && prev[1] === q.id));
  const first = cands.find((q) => q.id !== prev[0]) || cands[0];
  return first.id;
};
const BASIS_COUNT = { official: 0, expert: 0, scenario: 0 };
for (const q of S7) BASIS_COUNT[q.basis]++;
const PICKS = {};
for (const band of ['low', 'mid', 'high']) {
  const prev = [null, null]; PICKS[band] = [];
  for (let y = 2040; y <= 2059; y++) { const id = pickOf(y, band, prev); if (!id) throw new Error(`${y} ${band} 닿는 그림 없음`); if (prev[0] === id && prev[1] === id) throw new Error(`${y} ${band} 같은 그림 3해 연속 ${id}`); PICKS[band].push(S7.find((q) => q.id === id).u); prev.unshift(id); prev.length = 2; }
}
if (pickOf(2044, 'low', [null, null]) !== U.U14.id || pickOf(2044, 'mid', [null, null]) !== U.U14.id || pickOf(2044, 'high', [null, null]) !== U.U15.id || pickOf(2050, 'mid', [null, null]) !== U.U21.id || pickOf(2050, 'high', [null, null]) !== U.U22.id) throw new Error('2044·2050 구간 고르기');

// ---------------------------------------------------------------- 토큰 값 읽기(대비 실측) — src/styles/tokens.css는 읽기만
const tokensCss = readFileSync(ROOT + 'src/styles/tokens.css', 'utf8');
const tokenVals = (name) => [...tokensCss.matchAll(new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1].toLowerCase());
const TOK = {};
for (const n of ['--c-era', '--c-era-soft', '--c-surface', '--c-text-2']) { const v = tokenVals(n); if (v.length < 2) throw new Error(`tokens.css에서 ${n} 라이트·다크 값을 못 읽었다`); TOK[n] = { light: v[0], dark: v[1] }; }
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100; };
const PAIRS = [
  ['「예측」 칩 글자 / 칩 면', '--c-era', '--c-era-soft', 4.5],
  ['「예측」 칩 테두리 / 카드 면', '--c-era', '--c-surface', 3],
  ['근거 종류 글자 / 카드 면', '--c-text-2', '--c-surface', 4.5],
  ['창 표 글자 / 표 면(카드 면)', '--c-era', '--c-surface', 4.5],
].map(([name, a, b, min]) => ({ name, a, b, min, light: contrast(TOK[a].light, TOK[b].light), dark: contrast(TOK[a].dark, TOK[b].dark) }));
for (const p of PAIRS) if (p.light < p.min || p.dark < p.min) throw new Error(`대비 부족 ${p.name}: ${p.light}/${p.dark} < ${p.min}`);

// ---------------------------------------------------------------- 조각 + 예산
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perPictureAvgTarget: 1600, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000, futureAdded: 98700, futureAddedTarget: 80000, specEstimate: { d2040: 13500, d2050: 10500 } };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r7(SPEC-010 미래 연표 묶음 B) · ${q.u} · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.kind} · ${q.topic}${q.band ? ` · 수저 구간 ${BAND_LABEL[q.band]}에서만` : ''} · 예측(${BASIS_LABEL[q.basis]}) · 승인 전(approved: false — 형진 님 사건별 승인 뒤 developer가 넣는다) · 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 미래 톤은 CSS(그림 안 겹 0) --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = S7.map((q) => {
  const m = inner(q); write(`pieces/era-r7/${q.id}.svg`, pieceSvg(q));
  const g = gz(m);
  return { id: q.id, u: q.u, year: q.year, years: q.years || [q.year, q.year], decade: q.decade, hCode: null, name: q.name, kind: q.kind, topic: q.topic, heavy: false, band: q.band || null, ageBand: q.kind === 'daily' ? '모두' : null, who: WHO(q), line: q.line, lineChars: q.line.length, forecast: true, basis: q.basis, basisLabel: BASIS_LABEL[q.basis], basisNote: q.basisNote, draws: q.draws, ft3: q.ft3, shapes: countShapes(m), uses: countUses(m), raw: Buffer.byteLength(m, 'utf8'), gz: g, over25: g > BUDGET.perPicture, overLimit: g > BUDGET.perPicture, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const dec = (list, label, est) => { const c = chunk(list); const withDefs = c + lines(list) + defsGz + cssGz; return { label, pieces: list.length, chunkGz: c, withLines: c + lines(list), withDefs, specEstimate: est, underEstimate: withDefs <= est, overMax: withDefs > BUDGET.perDecadeChunk }; };
const SET40 = S7.filter((q) => q.decade === 2040), SET50 = S7.filter((q) => q.decade === 2050);
const decades = [dec(SET40, '2040년대 8장(U13~U20)', BUDGET.specEstimate.d2040), dec(SET50, '2050년대 6장(U21~U26)', BUDGET.specEstimate.d2050)];
const futureAdded = { d2040: decades[0].withDefs, d2050: decades[1].withDefs, total: decades[0].withDefs + decades[1].withDefs, bundleA: 14647 };
const lazyBefore = 137707; // r6 실측 뒤 누적 추정(123,060 + 14,647)
const budget = {
  measuredAt: '2026-11-03', round: 'r7', spec: 'SPEC-010 미래 연표 묶음 B(2040~2059)', tone: TONE_ID, futureTone: { chosen: 'draft', name: FUTURE_TONE.draft.name, filter: FUTURE_TONE.draft.filter, dark: FUTURE_TONE.draft.dark }, chip: { chosen: 'B', where: '인생 기록의 시대 줄 + 시대의 창 칸(형진 님 2026-11-03)' },
  note: 'r7 14장(U13~U26, 전부 2027년 이후 → forecast true · basis 필수). gz는 그림 안쪽 마크업(톤 겹 0)을 class·use로 바꾼 뒤 gzip. chunk는 10년마다 {id: 마크업} JSON으로 묶어 gzip + 한 줄 + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회(보수적 — 실제 덩어리는 참조하는 defs만 싣는다). 예산(SPEC-010): 장당 평균 ≤ 1.6KB · 상한 2.5KB(○ 없음) · 10년 덩어리 ≤ 24KB(어림 2040년대 13.5KB · 2050년대 10.5KB) · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB) · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 승인 표기 0(approved: false). 칩·톤은 묶음 A에서 확정된 값(안 B · 안 1)을 그대로 쓴다.',
  budget: BUDGET, pieces: rows.length, events: rows.filter((r) => r.kind === 'event').length, daily: rows.filter((r) => r.kind === 'daily').length, heavy: 0, forecast: rows.length, basisCount: BASIS_COUNT, lineWarnings: warnings,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: Math.round(sum(rows, 'gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`), avgOverTarget: Math.round(sum(rows, 'gz') / rows.length) > BUDGET.perPictureAvgTarget,
  defsGz, cssGz, decades, futureAdded, lazyEst: { before: lazyBefore, after: lazyBefore + futureAdded.total, limit: BUDGET.totalLazy }, picks: PICKS,
  contrast: { tokens: TOK, pairs: PAIRS },
  rows,
};
write('era-window-r7-budget.json', JSON.stringify(budget, null, 2) + '\n');
if (budget.gzEachAvg > BUDGET.perPictureAvgTarget) console.warn(`!! 장당 평균 ${budget.gzEachAvg}B > 목표 ${BUDGET.perPictureAvgTarget}`);
if (budget.overLimit.length) throw new Error(`상한 초과: ${budget.overLimit.join(', ')}`);
if (decades.some((d) => d.overMax)) throw new Error('10년 덩어리 24KB 초과');

// ---------------------------------------------------------------- 시트 — 확정된 칩(안 B)·톤(안 1)이 적용된 모형(인생 기록 줄 · 시대의 창 칸)
const BG = readFileSync(OUT + 'pieces/s1/bg-metro-b2.svg', 'utf8').replace(/^[\s\S]*?<svg/, '<svg').replace(/\swidth="\d+"\sheight="\d+"/, ' class="scene__svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"').replace(/<!--[\s\S]*?-->/g, '').trim();
const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const fcChip = () => `<span class="chip--fc" data-testid="chip-fc">${icon('i-ahead')}예측</span>`;
const basisOf = (q) => `<span class="log__basis">${BASIS_LABEL[q.basis]}</span>`;
/** 시대 줄 — 이 묶음은 전부 2027년 이후라 칩 + 근거 종류가 늘 붙는다(SPEC-010 구현 규칙 7). 읽기 이름 「예측, <근거 종류>. <줄>」 */
const eraRow = (q, age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="true" id="log-y${q.year}-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span>${fcChip()}${basisOf(q)}<span class="sr-only">예측, ${BASIS_LABEL[q.basis]}.</span></span><span class="log__sent">${q.line}</span></span></li>`;
const dailyRow = (q, age, year) => eraRow({ ...q, year }, age);
const plainRow = (age, text, cls = '') => `<li class="log__row${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}</span></li>`;
const projRow = (age, year, text) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="proj"><span class="log__age">${age}세<small class="log__year">${year}</small></span><span class="log__text"><span class="log__tl">${icon('i-proj')}<span>전망</span></span><span class="log__sent">${text}</span></span></li>`;
// 가짜 데이터 — 2016년생(알파) 가운데 구간의 2040~2055 인생 기록. 일반 문장은 시안 예시(확정 전), 「전망」 줄 문장은 gm3 시안 예시 그대로
const logMock = () => `<section class="card log ew__log" aria-label="인생 기록(시안)"><div class="card__head" style="margin-bottom:var(--sp-2)"><h4 class="card__title">인생 기록</h4><span class="t-xs t-faint">시안 · 가짜 데이터 · 2016년생 가운데 구간</span></div><div class="log__list" style="max-height:none" role="region" aria-label="인생 기록"><ol class="log__rows">${plainRow(39, '회사의 정년 이야기가 식탁에 올랐습니다.', ' log__row--latest')}${eraRow(U.U24, 39)}${eraRow(U.U23, 37)}${projRow(36, 2052, '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.')}${plainRow(35, '전세 계약을 한 번 더 늘렸습니다.')}${eraRow(U.U21, 34)}${plainRow(32, '둘째가 초등학교에 들어갔습니다.')}${eraRow(U.U16, 30)}${eraRow(U.U14, 28)}${plainRow(27, '첫 아이가 태어났습니다.')}${dailyRow(U.U17, 25, 2041)}${eraRow(U.U13, 24)}</ol></div></section>`;
const sceneMock = (q, { ftone = 'draft' } = {}) => `<section class="card scene-card ew__scene" aria-label="집과 가족(시안)" data-ftone="${ftone}"><div class="scene"><div class="scene__house">${BG}<p class="scene__year"><time datetime="${q.year}">${q.year}년</time></p></div><a class="era" href="#log-y${q.year}-34" data-era="${q.id}" data-dec="${q.decade}" data-future="true" title="시대의 창 · ${q.line}"><span class="era__pic" data-future="true" aria-hidden="true">${svgOf(q)}</span><span class="era__fc" aria-hidden="true">${icon('i-ahead')}예측</span><span class="sr-only">예측: ${q.line} 그해 기록으로</span></a></div><p class="scene__line">서울특별시 관악구 · 전셋집 · 배우자와 아이 둘</p></section>`;

// ---------------------------------------------------------------- 시트 — 그림 칸
const KIND = { event: '그해의 사건', daily: '그 10년의 일상' };
const cap = (q, { full = true } = {}) => `<figcaption class="ew__cap"><span class="ew__year">${q.u} · ${q.years ? `${q.years[0]}~${q.years[1]}년` : `${q.year}년`} <span class="ew__kindtag">${KIND[q.kind]} · 예측</span></span><span class="ew__name">${q.name}</span><span class="ew__band">누가 보나 · ${WHO(q)}${q.band ? `(${BAND_LABEL[q.band]}에서만)` : ''}</span><span class="ew__line">「${q.line}」(${q.line.length})</span><span class="ew__kind">예측 · <b>${BASIS_LABEL[q.basis]}</b> — ${q.basisNote}</span>${full ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>`;
const fig = (q, { size = 'pc', full = true, mark = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-band="${q.band || ''}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}" data-future="true">${svgOf(q)}${mark ? `<span class="era__fc">${icon('i-ahead')}예측</span>` : ''}</div>${size === 'mobile' ? `<figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}</span></figcaption>` : cap(q, { full })}</figure>`;
const figBand = (q) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-size="band"><div class="ew__bandcell"><div class="ew__pic" data-dec="${decadeOf(q.year)}" data-future="true">${svgOf(q)}</div><span class="era__fc">${icon('i-ahead')}예측</span></div><figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}</span></figcaption></figure>`;
const pickCell = (u) => `<td class="ew__pk" data-u="${u}">${u}</td>`;

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 7차 — 미래 연표 묶음 B(SPEC-010, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-010 시대의 창 7차(2040~2059 14장, 확정된 「예측」 칩 안 B·미래 톤 안 1 적용). 생성 scripts/design/buildEraWindowR7.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0), 승인 전(approved: false). -->
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
.ew h4 { margin: 0; }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew code { font-family: inherit; background: var(--c-surface-2); padding: 0 .3em; border-radius: var(--r-sm); }
.ew__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
.ew__grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-5); }
.ew__grid .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__grid .ew__pic, .ew__grid3 .ew__pic { width: 175px; height: 140px; }
.ew__grid3 .ew__fig { width: 100%; }
.ew__grid .ew__cap { margin-top: 0; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 767px) { .ew__grid3 { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__grid .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__grid .ew__cap { margin-top: var(--sp-2); } }
.ew__fig { margin: 0; min-width: 0; }
.ew__pic { position: relative; aspect-ratio: 5 / 4; overflow: hidden; background: var(--c-scene-sky); }
.ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin-top: var(--sp-2); font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); word-break: keep-all; }
.ew__year { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__kindtag { font-weight: var(--fw-regular); color: var(--c-text-2); }
.ew__kind, .ew__ok { color: var(--c-text-2); }
.ew__line { color: var(--c-text); }
.ew__band { color: var(--c-brand); font-weight: var(--fw-bold); }
.ew__draws { color: var(--c-text); font-size: var(--fs-sm); line-height: 1.5; margin-top: var(--sp-1); }
.ew__ft3 { color: var(--c-text-2); font-size: var(--fs-sm); line-height: 1.5; }
.ew__ft3::before { content: '유지선 · '; color: var(--c-text); font-weight: var(--fw-bold); }
.ew__zoom { display: flex; flex-wrap: wrap; gap: var(--sp-5); }
.ew__zoom .ew__fig { width: 350px; max-width: 100%; }
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew__strip .ew__fig { width: 100px; }
.ew__strip .ew__pic { width: 100px; height: 80px; }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
.ew__pk { font-variant-numeric: tabular-nums; white-space: nowrap; }
.ew__ask, .ew__rule, .ew__list { max-width: 72ch; padding-left: 1.2em; }
.ew__ask li, .ew__list li { margin: 0 0 var(--sp-2); }
.ew__rule li { margin: 0 0 var(--sp-1); }
/* 확정 칩·톤이 적용된 두 카드(집과 가족 · 인생 기록) */
.ew__applied { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--sp-6) var(--sp-8); align-items: start; }
@media (max-width: 1023px) { .ew__applied { grid-template-columns: minmax(0, 1fr); } }
.ew__appliedcol { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-3); min-width: 0; }
.ew__note--tight { margin: 0; font-size: var(--fs-sm); }
/* 휴대폰 폭 모형 — 360보다 좁은 화면에서는 그 폭을 따른다(min()) · 그리드 칸이 360 최소 폭으로 자라 넘치지 않게 */
.ew__phone { width: min(360px, 100%); box-sizing: border-box; padding: var(--sp-3); background: var(--c-surface-2); }
.ew__scene .scene__house { height: auto; }
.ew__scene .scene__svg { width: 100%; height: auto; aspect-ratio: 640 / 256; max-height: none; }
.ew__scene .era__pic { aspect-ratio: 5 / 4; }
/* 시안 family.css의 .era__pic·.era는 position이 없다(구현 src/styles/family.css의 .era__pic은 relative) — 창 표(.era__fc)가 칸 안에 붙도록 여기서 맞춘다 */
.ew .era__pic { position: relative; }
@container scene (max-width: 480px) { .ew__scene .era__pic { aspect-ratio: auto; } }
/* 휴대폰 띠 모형: 카드 폭 326 × 80 — 그림 100×80 왼쪽, 표는 그림 옆 띠 바탕 위(안 B의 휴대폰 자리) */
.ew__bandcell { position: relative; display: flex; align-items: flex-start; gap: var(--sp-2); width: 326px; max-width: 100%; height: 80px; background: var(--c-surface); }
.ew__bandcell .ew__pic { width: 100px; height: 80px; flex: none; }
.ew__bandcell .era__fc { position: static; margin-top: var(--sp-2); }
.ew__strip--band .ew__fig { width: 326px; max-width: 100%; }
@media (forced-colors: active) { .ew__bandcell { border: 1px solid CanvasText; } .ew__pic { border: 1px solid CanvasText; } }
.ew__log .log__list { padding: 0; }
${toneCssA('.ew')}
${futureToneCss('.ew')}
${chipCss()}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}${ICON_ERA}${ICON_PROJ}${ICON_YEAR}${ICON_AHEAD}</defs></svg>
<main class="ew">
<h1>시대의 창 7차 — 미래 연표 묶음 B</h1>
<p class="ew__lead">2040년부터 2059년까지 열네 장(U13~U26)입니다. 줄 문장은 SPEC-010 연표 표 그대로이고 그림은 전부 새로 구성했습니다. 「예측」 칩과 미래 톤은 묶음 A에서 정해진 대로(기록 줄과 창 양쪽, 밑그림) 적용된 모습만 보이고 다시 묻지 않습니다. 열네 장 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r7.html">라이트</a><a href="era-window-r7.html?theme=dark">다크</a><a href="era-window-r6.html">6차 시트(묶음 A)</a><a href="era-window-r5b.html">5차b 시트</a></nav>

<h2 id="applied">확정된 칩·톤이 적용된 모습</h2>
<p class="ew__note">왼쪽은 2050년 가운데 구간의 집과 가족 카드 — PC 폭과 휴대폰 폭(360) 둘 다, 시대의 창 칸에 밑그림 톤과 「예측」 표(PC는 그림 왼쪽 위, 휴대폰 띠는 그림 옆). 오른쪽은 2016년생 가운데 구간의 2040~2055 인생 기록(가짜 데이터)입니다. 2040년대부터는 모든 시대 줄에 칩과 근거 종류가 붙고, 2052년의 「전망」 줄은 경제 칸의 기존 칩이라 색·아이콘·모양이 다릅니다.</p>
<div class="ew__applied" data-applied><div class="ew__appliedcol"><p class="ew__note ew__note--tight">PC 폭</p>${sceneMock(U.U21)}<p class="ew__note ew__note--tight">휴대폰 폭 360 — 띠 모양, 표는 그림 옆</p><div class="ew__phone">${sceneMock(U.U21)}</div></div>${logMock()}</div>

<h2 id="bands">2044 · 2050 — 부유한 쪽만 다른 그림</h2>
<p class="ew__note">2044년은 어려운 쪽·가운데가 U14(재활실의 화면과 대기 의자), 부유한 쪽이 U15(큰 창의 1인 병실)를 봅니다. 2050년은 U21(유리 밖에서 본 클리닉의 밝은 안 — 밖의 줄과 바라보는 등)과 U22(조용한 복도 — 혼자 들어가는 문)입니다. 얼굴 대비 없이 「줄 ↔ 문, 밖 ↔ 안, 여럿 ↔ 혼자」로 수저 격차가 읽히는지 봐 주세요.</p>
<h3>2044년 — 뇌-기기 치료</h3>
<div class="ew__grid3" data-pair="2044">${fig(U.U14, { full: false })}${fig(U.U15, { full: false })}</div>
<h3>2050년 — 노화가 멈춘 사람들</h3>
<div class="ew__grid3" data-pair="2050">${fig(U.U21, { full: false })}${fig(U.U22, { full: false })}</div>

<h2 id="daily">그 10년의 일상 — 2040년대 넷 · 2050년대 둘</h2>
<p class="ew__note">2040년대는 가운데가 U17·U18을 번갈아 보고, 어려운 쪽은 U19(블라인드를 내린 방)를, 부유한 쪽은 U20(출국장)을 먼저 봅니다. 2050년대는 세 구간 모두 U25·U26을 번갈아 봅니다. 2040·2050년대의 소품(지붕 태양광 판·배달 로봇·그늘막·냉각 안개 기둥·벽 화면·블라인드 뒤의 흰 빛)이 그 시대를 사는 느낌을 주는지 봐 주세요.</p>
<h3>2040년대</h3>
<div class="ew__grid3" data-pair="2040s">${fig(U.U17, { full: false })}${fig(U.U18, { full: false })}${fig(U.U19, { full: false })}${fig(U.U20, { full: false })}</div>
<h3>2050년대</h3>
<div class="ew__grid3" data-pair="2050s">${fig(U.U25, { full: false })}${fig(U.U26, { full: false })}</div>

<h2 id="pieces">열네 장 — U13~U26</h2>
<p class="ew__note">그림은 톤 없이(있는 그대로) 보입니다. 밑그림 톤이 입혀진 모습은 위 「적용된 모습」과 아래 「휴대폰 띠」에서 봐 주세요. 캡션의 「그리는 것」은 SPEC-010 표의 문장을 바탕으로 실제로 그린 것을, 「유지선」은 수위 판단을 적었습니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${S7.map((q) => fig(q)).join('')}</div>

<h2>크게 보기 350×280 — 열네 장</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${S7.map((q) => fig(q, { full: false })).join('')}</div>

<h2 id="strips">휴대폰 띠 크기 100×80</h2>
<p class="ew__note"><b>톤 없음(그림 그대로)</b></p><div class="ew__strip" data-tone="${TONE_ID}" data-strip="plain">${S7.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤(확정 안 1)</b></p><div class="ew__strip" data-ftone="draft" data-strip="draft">${S7.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤 + 창 표(확정 안 B) — 휴대폰 띠 326×80에서의 자리</b>: 그림 옆 띠 바탕 위라 그림을 가리지 않습니다(PC에서는 그림 왼쪽 위 — 위 「적용된 모습」).</p><div class="ew__strip ew__strip--band" data-ftone="draft" data-strip="draft-mark">${S7.map((q) => figBand(q)).join('')}</div>

<h2>번호 · 해 · 누가 보나 · 줄 · 근거 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">번호</th><th scope="col">해</th><th scope="col">누가 보나</th><th scope="col">줄(자)</th><th scope="col">칩 · 근거 칸</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.u}</td><td>${x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`}</td><td>${x.who}${x.band ? ` <span class="ew__band">${x.band}</span>` : ''}${x.kind === 'daily' ? ' · 일상' : ''}</td><td>${x.line} (${x.lineChars})</td><td>예측 · ${x.basisLabel}</td><td class="num">${x.shapes}(${x.uses})</td><td class="num">${x.gz}B${x.overLimit ? ' · 상한 초과' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">열네 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${budget.gzEachAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}) — 목표 평균 ≤ 1,600B · 상한 2,500B 안(초과 0). 2040년대 새 덩어리 ${decades[0].withDefs.toLocaleString('ko-KR')}B(SPEC 어림 13,500B ${decades[0].underEstimate ? '안' : '초과'}) · 2050년대 ${decades[1].withDefs.toLocaleString('ko-KR')}B(어림 10,500B ${decades[1].underEstimate ? '안' : '초과'}) — 둘 다 한 줄·공유 defs·토큰 CSS 포함(보수적), 10년 덩어리 한도 24,000B 안. 2027년 이후가 늘린 양: 묶음 A 14,647B + 묶음 B ${futureAdded.total.toLocaleString('ko-KR')}B = ${(futureAdded.total + futureAdded.bundleA).toLocaleString('ko-KR')}B(상한 98,700B · 목표 80,000B). 누적 추정 ${lazyBefore.toLocaleString('ko-KR')}B → ${budget.lazyEst.after.toLocaleString('ko-KR')}B(≤ 230,000B). 근거 칸: 공식 전망 바탕 ${BASIS_COUNT.official} · 전문가 전망 바탕 ${BASIS_COUNT.expert} · 가상 시나리오 ${BASIS_COUNT.scenario}. 정본 수치는 <code>era-window-r7-budget.json</code>.</p>

<h3>고르기 흉내 — 2040~2059 해마다 구간별로 보는 그림(10-1·8-2절 규칙)</h3>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">구간</th>${Array.from({ length: 20 }, (_, i) => `<th scope="col" class="ew__pk">${2040 + i}</th>`).join('')}</tr></thead><tbody>${[['어려운 쪽', 'low'], ['가운데', 'mid'], ['부유한 쪽', 'high']].map(([name, b]) => `<tr><th scope="row">${name}</th>${PICKS[b].map(pickCell).join('')}</tr>`).join('')}</tbody></table></div>
<p class="ew__note">세 구간 × 스무 해에 그림이 닿고 같은 그림이 3해 연속 나오지 않습니다(생성기가 단언). 2044·2050은 부유한 쪽만 U15·U22, 2040·2046·2053·2055는 모두 같은 그림입니다.</p>

<h2 id="mismatch">그림과 줄이 안 맞는 곳 — 줄은 바꾸지 않고 장면을 맞추거나 대안만 적는다</h2>
<ol class="ew__list">
<li><b>U21 「노화가 멈춘 사람들이 생겼습니다.」</b> — 표의 「그리는 것」은 「병원 로비 접수대 앞의 줄, 빈 입간판」인데, 로비 안의 줄만으로는 「생긴 사람들」이 읽히지 않고 U03·U06·U10·U14의 창구·대기 그림과 겹칩니다. 그래서 같은 줄과 입간판을 <b>유리 밖</b>으로 옮겼습니다: 안은 환하고(생긴 사람들이 있는 곳), 어려운 쪽·가운데는 유리 밖에서 줄을 서거나 바라봅니다. 부유한 쪽 U22(조용한 복도, 혼자 들어가는 문)와 안/밖·줄/문·여럿/혼자로 짝이 됩니다. 얼굴 대비·시술은 없습니다. 줄 문장은 그대로입니다.</li>
<li><b>U23 「사과 재배지가 북쪽으로 올라갔습니다.」</b> — 근거 조사(D4)는 「면적이 줄고 강원 일부로 좁아진다」는 쪽이라, 그림은 비탈 <b>맨 위 좁은 띠에만</b> 남은 사과나무와 아래 비탈의 다른 작물·비닐하우스, 상자 속 몇 알로 「좁아지고 북쪽 산자락에 남은」 쪽으로 읽히게 했습니다. 줄은 바꾸지 않았습니다. <b>다만 이 줄은 SPEC-010 구현 규칙 6의 주인공 행동 낱말 목록(「갔」)에 걸립니다</b> — 주어가 재배지(사물)라 뜻은 세상 소식이지만 developer 시험(FU7)이 낱말로 잡으면 막히므로 마스터 판단이 필요합니다. 문장 대안(둘 다 목록에 안 걸림): 「사과 밭이 북쪽 산자락에만 남았습니다.」(19) · 「사과 재배지가 북쪽으로 좁아졌습니다.」(20). 지역 이름(강원)은 줄에 쓰지 않았습니다(나라 이름 규칙에 준함).</li>
<li><b>U26 「한 학년이 한 반뿐인 학교가 늘었습니다.」</b> — 표의 「한 칸만 불 켜진 학교 복도」는 U04(2028 복도)·U17(불 켜진 창 몇 개)과 같은 말이 되어, 표의 뒷부분 「작은 교실의 책상 몇 개」를 교실 안에서 그렸습니다(구석에 쌓아 둔 책상이 줄어듦을 말합니다). 줄은 그대로입니다.</li>
<li><b>U16 「무역 규칙이 바뀌어 물가가 흔들렸습니다.」</b> — 표의 「마트 가격표 + 항구의 컨테이너」를 한 틀에 넣기 위해 마트의 윗 유리벽 너머로 항구를 두었습니다(항구 도시의 마트). 나라 이름·국기·지도는 없습니다. 어색하면 윗 띠를 흐린 하늘로 바꿀 수 있습니다(경량).</li>
<li><b>U24 「인도가 세계 경제의 큰 축이 됐습니다.」</b> — 「인도」는 그릴 수 없어(국기·지도 0) 그림은 큰 항구와 컨테이너선을, 줄이 나라 이름을 맡습니다. 2026 U02(항구의 밤 — 사무실 창가)와는 시점(높은 곳·배 전체·저녁)으로 갈랐습니다. 근거가 낡은 점(2017년 전망)은 마스터 확인 M6대로 유지입니다.</li>
</ol>

<h2>developer 인계(승인 뒤 — 이번에도 src를 건드리지 않았다)</h2>
<ol class="ew__rule">
<li>조각 <code>pieces/era-r7/</code> 14 + <code>era-window-r7-budget.json</code>(행에 <code>basis</code>·<code>u</code>·<code>forecast</code>·<code>years</code>·<code>band</code>) → <code>genEraWindows.ts</code> <code>META</code>에 r7 추가, 승인 장수 가드 106 → 120(승인된 장만). 새 <code>d2040.ts</code>(8장)·<code>d2050.ts</code>(6장), <code>ERA_DECADE_LOADERS</code>·<code>ERA_DECADES_WITH_DATA</code>에 2040·2050.</li>
<li>사건 <code>band</code>: 2044 U15 · 2050 U22는 <code>band: 'high'</code>, 같은 해의 U14·U21은 band 없음(10-1절 규칙 — 가운데·어려운 쪽이 본다). 2040년대 일상의 <code>band</code> U19 low · U20 high.</li>
<li>칩·톤·아이콘·글자는 묶음 A 인계(11-7절) 그대로 — 새 토큰·심볼·패턴·아이콘 0. 새 줄 14개의 글자는 FU6 글꼴 조각(s2·s3)을 다시 만든다.</li>
<li>FU11 예측 근거 칸: U13~U26의 근거 글은 <code>docs/data/future-foresight-quotes.md</code>를 따른다(이 시트는 근거 종류 한 단어만 보인다).</li>
</ol>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>2050 두 장(U21 유리 밖 / U22 조용한 복도)</b> — 「노화가 멈춘 사람들이 생겼습니다」와 「…집이 먼저 생겼습니다」가 얼굴 대비 없이 수저 격차로 읽히는지. 표의 「로비 접수대 앞의 줄」로 되돌리기를 원하시면 그렇게 그립니다.</li>
<li><b>2044 두 장(U14 재활실 / U15 1인 병실)</b> — 머리 뒤 기기 띠의 수위(일반형 윤곽, 시술 없음)와 1인 병실의 「먼저」가 과시 없이 읽히는지.</li>
<li><b>열네 장 사건별 승인</b> — 특히 U23(사과밭 — 문장 대안 둘)·U16(마트 윗 유리벽 너머의 항구)·U24(큰 항구)·U25(한낮의 빈 거리와 확성기)가 줄과 맞게 읽히는지, 2040·2050년대 소품이 지나치거나 모자라지 않은지.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r7.html', html);

console.log(`시대의 창 r7: ${rows.length}장(사건 ${budget.events} · 일상 ${budget.daily}) · 예측 ${budget.forecast}장(공식 ${BASIS_COUNT.official} · 전문가 ${BASIS_COUNT.expert} · 시나리오 ${BASIS_COUNT.scenario}) · 장당 gzip 평균 ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B + css ${cssGz}B`);
for (const x of rows) console.log(`${x.u} ${x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`} ${x.id}: ${x.band ? `(${x.band}) ` : ''}조각 ${x.shapes}(use ${x.uses}) · gz ${x.gz}${x.overLimit ? ' !!상한' : ''} · 「${x.line}」(${x.lineChars}) · ${x.basisLabel}`);
console.log(`2040년대 ${decades[0].withDefs}B(덩어리 ${decades[0].chunkGz}, 어림 13,500 ${decades[0].underEstimate ? '안' : '초과'})${decades[0].overMax ? ' !!24KB' : ''} · 2050년대 ${decades[1].withDefs}B(덩어리 ${decades[1].chunkGz}, 어림 10,500 ${decades[1].underEstimate ? '안' : '초과'})${decades[1].overMax ? ' !!24KB' : ''} · 묶음 B가 늘린 양 ${futureAdded.total}B · 누적 추정 ${budget.lazyEst.after}B`);
for (const b of ['low', 'mid', 'high']) console.log(`고르기 ${b}: ${PICKS[b].join(' ')}`);
for (const p of PAIRS) console.log(`대비 ${p.name}: 라이트 ${p.light} · 다크 ${p.dark} (≥ ${p.min})`);
for (const w of warnings) console.warn(`!! ${w}`);

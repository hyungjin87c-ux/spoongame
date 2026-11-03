/**
 * SPEC-010 「시대의 창」 6차(r6) 시안 생성기 — 미래 연표 묶음 A (designer 2026-11-03).
 *
 * 정본: `docs/spec/SPEC-010-미래연표.md`(2026-11-03 확정) 「할 것」 FU3·FU4 · 「연표 표」 U01~U12 · 「그림 수위」 · 「예산」 · 「순서」 1, 스타일 정본 `docs/design/era-window.md`(톤 A · 3-1 · r3~r5b · 허용 class).
 * 만드는 것: ① 「예측」 칩 시안 두 안(안 A 시대 줄에만 / 안 B 시대 줄과 창) ② 미래 그림 톤 두 안(안 1 밑그림 / 안 2 점선 틀 — U06으로 비교) ③ 그림 12장(U01~U12).
 * 조각 위치·형식은 r5b와 같다(`pieces/era-r6/<id>.svg`, `era-window-r6-budget.json` — genEraWindows.ts가 읽는 행 모양 + `basis`·`u`·`forecast`).
 * 예산(SPEC-010): 장당 평균 ≤ 1.6KB gzip · 상한 2.5KB(군중 ○ 3.5KB — 이 묶음에 ○ 없음) · 2020년대 보충 뒤 덩어리 ≤ 24KB(기존 12,333B) · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB).
 * 지킨 것: `src/`·`tests/` 손대지 않음(읽기만: tokens.css 토큰 값) · 승인 표기 0(approved: false) · 외부 URL 0 · 사진 모사 0 · 인터넷 조사 0.
 *
 * 실행: node scripts/design/buildEraWindowR6.mjs
 * 산출: docs/design/mockups/family/era-window-r6.html · pieces/era-r6/<id>.svg(12) · era-window-r6-budget.json
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA, futureToneCss, chipCss, FUTURE_TONE, ICON_AHEAD, ICON_PROJ, ICON_ERA, ICON_YEAR } from './eraR6Lib.mjs';
import { S6, BASIS_LABEL } from './eraR6Scenes.mjs';
import { SET20 as R5_SET20 } from './eraR5Scenes.mjs';
import { S5B } from './eraR5bScenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r6', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const ACTUAL_LAST = 2026;
const BAND_LABEL = { low: '아래 둘(흙·동수저)', high: '위 둘(금수저 쪽)' };
const WHO = (q) => (q.band === 'low' ? '어려운 쪽' : q.band === 'high' ? '부유한 쪽' : q.year === 2026 ? '어려운 쪽·가운데' : '모두');
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
// SPEC-010 구현 규칙 6·「그림 수위」 6 — 줄 문장 금지 낱말(developer 시험 목록은 따로 만든다; 여기서는 시안 단언)
const FEAR = /종말|붕괴|멸망|재앙|파국|참사|위기/;
const ACTOR = /(갔|탔|샀|받았|일했|출근|퇴근|배웠|먹었|마셨)/;

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
if (S6.length !== 12) throw new Error(`장면 ${S6.length}장(12 기대)`);
for (const q of S6) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (!/습니다\.$/.test(q.line)) throw new Error(`합쇼체 사실 문장이 아니다: ${q.id}`);
  if (/\d/.test(q.line)) throw new Error(`줄에 숫자: ${q.id}`);
  if (/[A-Za-z]/.test(q.line.replace(/AGI|AI/g, ''))) throw new Error(`줄에 AI·AGI 밖 알파벳: ${q.id}`);
  if (FEAR.test(q.line)) throw new Error(`줄에 공포·평가 낱말: ${q.id}`);
  if (q.year > ACTUAL_LAST && ACTOR.test(q.line)) throw new Error(`2027년 이후 줄에 주인공 행동 낱말: ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws || !q.u) throw new Error(`유지선 판단(ft3)·그리는 것(draws)·번호(u) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
  if (q.heavy) throw new Error(`이 묶음에 ○는 없다: ${q.id}`);
  if (q.year <= ACTUAL_LAST ? q.basis !== null : !(q.basis in BASIS_LABEL)) throw new Error(`basis 규칙(2026 없음 · 2027~ 필수): ${q.id}`);
  if (q.kind === 'daily' && (!q.years || q.ageBand !== '모두')) throw new Error(`일상은 years + ages 없음(모두): ${q.id}`);
  if (q.kind === 'event' && q.years) throw new Error(`사건은 한 해짜리: ${q.id}`);
  const m = inner(q);
  for (const c of m.matchAll(/class="([^"]+)"/g)) for (const k of c[1].split(/\s+/)) if (!ALLOWED.has(k)) throw new Error(`허용 목록 밖 class ${k}: ${q.id}`);
  if (/<(?!\/?(rect|path|circle|ellipse|use|g)\b)/.test(m)) throw new Error(`허용 밖 태그: ${q.id}`);
  if (/<text|<image|href="http|url\(http/.test(m)) throw new Error(`글자·외부 자원: ${q.id}`);
}
const U = Object.fromEntries(S6.map((q) => [q.u, q]));
if (S6.map((q) => q.u).join() !== 'U01,U02,U03,U04,U05,U06,U07,U08,U09,U10,U11,U12') throw new Error('번호 U01~U12 순서');
if (!(U.U01.band === undefined && U.U02.band === 'high' && U.U01.year === 2026 && U.U02.year === 2026)) throw new Error('2026: U01 band 없음 · U02 high');
if (!(U.U06.band === 'low' && U.U07.band === undefined && U.U08.band === 'high' && [U.U06, U.U07, U.U08].every((q) => q.year === 2030 && q.kind === 'event'))) throw new Error('2030 세 갈래: U06 low · U07 없음 · U08 high');
if (!([U.U03, U.U04, U.U05].map((q) => q.year).join() === '2027,2028,2029')) throw new Error('2027~2029 한 장씩');
const daily30 = S6.filter((q) => q.kind === 'daily');
if (!(daily30.length === 4 && daily30.filter((q) => !q.band).length === 2 && daily30.find((q) => q.band === 'low') && daily30.find((q) => q.band === 'high'))) throw new Error('2030년대 일상: 모두 2 + 아래 1 + 위 1');
// 고르기 흉내(10-1·8-2절 규칙): 2026~2039 × 구간 셋에 그림이 닿고, 같은 그림이 3해 연속 나오지 않는다(가운데는 일상 둘을 번갈아)
const pickOf = (y, band, prev) => {
  const evs = S6.filter((q) => q.kind === 'event' && q.year === y);
  const ev = evs.find((q) => q.band === band) || evs.find((q) => !q.band);
  if (ev) return ev.id;
  const dl = S6.filter((q) => q.kind === 'daily' && q.years[0] <= y && y <= q.years[1]);
  const mine = band !== 'mid' ? dl.filter((q) => q.band === band) : [];
  const base = dl.filter((q) => !q.band);
  const cands = [...mine, ...base].filter((q) => !(prev[0] === q.id && prev[1] === q.id));
  const first = cands.find((q) => q.id !== prev[0]) || cands[0];
  return first.id;
};
const BASIS_COUNT = { official: 0, expert: 0, scenario: 0 };
for (const q of S6) if (q.basis) BASIS_COUNT[q.basis]++;
for (const band of ['low', 'mid', 'high']) {
  const prev = [null, null];
  for (let y = 2026; y <= 2039; y++) { const id = pickOf(y, band, prev); if (!id) throw new Error(`${y} ${band} 닿는 그림 없음`); if (prev[0] === id && prev[1] === id) throw new Error(`${y} ${band} 같은 그림 3해 연속 ${id}`); prev.unshift(id); prev.length = 2; }
}
if (pickOf(2026, 'low', [null, null]) !== 'era-2026-job-board-waiting' || pickOf(2026, 'high', [null, null]) !== 'era-2026-port-night-surplus' || pickOf(2030, 'low', [null, null]) !== 'era-2030-basic-income-queue-rain' || pickOf(2030, 'mid', [null, null]) !== 'era-2030-reskill-evening-class' || pickOf(2030, 'high', [null, null]) !== 'era-2030-ai-capital-night-office') throw new Error('2026·2030 구간 고르기');

// ---------------------------------------------------------------- 토큰 값 읽기(대비 실측) — src/styles/tokens.css는 읽기만
const tokensCss = readFileSync(ROOT + 'src/styles/tokens.css', 'utf8');
const tokenVals = (name) => [...tokensCss.matchAll(new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1].toLowerCase());
const TOK = {};
for (const n of ['--c-era', '--c-era-soft', '--c-surface', '--c-surface-2', '--c-bg', '--c-text', '--c-text-2', '--c-accent', '--c-accent-soft', '--c-on-accent-soft', '--c-brand']) { const v = tokenVals(n); if (v.length < 2) throw new Error(`tokens.css에서 ${n} 라이트·다크 값을 못 읽었다`); TOK[n] = { light: v[0], dark: v[1] }; }
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100; };
const PAIRS = [
  ['「예측」 칩 글자 / 칩 면', '--c-era', '--c-era-soft', 4.5],
  ['「예측」 칩 테두리 / 카드 면', '--c-era', '--c-surface', 3],
  ['「예측」 칩 면 / 카드 면(장식)', '--c-era-soft', '--c-surface', 0],
  ['근거 종류 글자 / 카드 면', '--c-text-2', '--c-surface', 4.5],
  ['창 표 글자 / 표 면(카드 면)', '--c-era', '--c-surface', 4.5],
  ['시대 줄 겹선·표지 / 카드 면(기존)', '--c-era', '--c-surface', 3],
  ['(비교) 「전망」 칩 글자 / 칩 면', '--c-on-accent-soft', '--c-accent-soft', 4.5],
  ['(비교) 「전망」 테두리 / 카드 면', '--c-accent', '--c-surface', 3],
].map(([name, a, b, min]) => ({ name, a, b, min, light: contrast(TOK[a].light, TOK[b].light), dark: contrast(TOK[a].dark, TOK[b].dark) }));
for (const p of PAIRS) if (p.min && (p.light < p.min || p.dark < p.min)) throw new Error(`대비 부족 ${p.name}: ${p.light}/${p.dark} < ${p.min}`);

// ---------------------------------------------------------------- 조각 + 예산
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perPictureAvgTarget: 1600, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000, futureAdded: 98700, futureAddedTarget: 80000 };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r6(SPEC-010 미래 연표 묶음 A) · ${q.u} · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.kind} · ${q.topic}${q.band ? ` · 수저 구간 ${BAND_LABEL[q.band]}에서만` : ''}${q.basis ? ` · 예측(${BASIS_LABEL[q.basis]})` : ' · 사실(칩 없음)'} · 승인 전(approved: false — 형진 님 사건별 승인 뒤 developer가 넣는다) · 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 미래 톤은 CSS(그림 안 겹 0) --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = S6.map((q) => {
  const m = inner(q); write(`pieces/era-r6/${q.id}.svg`, pieceSvg(q));
  const g = gz(m);
  return { id: q.id, u: q.u, year: q.year, years: q.years || [q.year, q.year], decade: q.decade, hCode: null, name: q.name, kind: q.kind, topic: q.topic, heavy: false, band: q.band || null, ageBand: q.kind === 'daily' ? '모두' : null, who: WHO(q), line: q.line, lineChars: q.line.length, forecast: q.year > ACTUAL_LAST, basis: q.basis, basisLabel: q.basis ? BASIS_LABEL[q.basis] : null, basisNote: q.basisNote, draws: q.draws, ft3: q.ft3, shapes: countShapes(m), uses: countUses(m), raw: Buffer.byteLength(m, 'utf8'), gz: g, over25: g > BUDGET.perPicture, overLimit: g > BUDGET.perPicture, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const dec = (list, label, note = '') => { const c = chunk(list); return { label, note, pieces: list.length, chunkGz: c, withLines: c + lines(list), withDefs: c + lines(list) + defsGz + cssGz, overMax: c + lines(list) + defsGz + cssGz > BUDGET.perDecadeChunk }; };
// 2020년대 덩어리 = r5 2020년대(2022는 r5b가 덮음) 11장 + r6 U01~U05 · 2030년대 = r6 U06~U12
const r5b2022 = S5B.find((q) => q.id === 'era-2022-alley-tape-flowers');
const OLD20 = R5_SET20.map((q) => (q.id === r5b2022.id ? r5b2022 : q));
if (OLD20.length !== 11) throw new Error(`2020년대 기존 ${OLD20.length}장(11 기대)`);
const NEW20 = [...OLD20, ...S6.filter((q) => q.decade === 2020)];
const NEW30 = S6.filter((q) => q.decade === 2030);
const before20 = dec(OLD20, '2020년대 기존 11장(r5 10 + r5b 2022)');
const decades = [dec(NEW20, '2020년대 16장(기존 11 + U01~U05)'), dec(NEW30, '2030년대 7장(U06~U12)')];
const futureAdded = { d2020: decades[0].withLines - before20.withLines, d2030: decades[1].withDefs, total: decades[0].withLines - before20.withLines + decades[1].withDefs };
const lazyBefore = 123060; // r5b 실측 94장 누적 추정
const budget = {
  measuredAt: '2026-11-03', round: 'r6', spec: 'SPEC-010 미래 연표 묶음 A(2026~2039)', tone: TONE_ID, futureTone: Object.fromEntries(Object.entries(FUTURE_TONE).map(([k, v]) => [k, { name: v.name, filter: v.filter, dark: v.dark }])),
  note: 'r6 12장(U01~U12). gz는 그림 안쪽 마크업(2010년대~와 같이 톤 겹 0)을 class·use로 바꾼 뒤 gzip. chunk는 10년마다 {id: 마크업} JSON으로 묶어 gzip + 한 줄 + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회(보수적 — 실제 덩어리는 참조하는 defs만 싣는다). 2020년대는 기존 11장(r5 10 + r5b 2022)에 U01~U05를 보충한 덩어리. 예산(SPEC-010): 장당 평균 ≤ 1.6KB · 상한 2.5KB(○ 없음) · 10년 덩어리 ≤ 24KB · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB) · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 승인 표기 0(approved: false).',
  budget: BUDGET, pieces: rows.length, events: rows.filter((r) => r.kind === 'event').length, daily: rows.filter((r) => r.kind === 'daily').length, heavy: 0, forecast: rows.filter((r) => r.forecast).length, basisCount: BASIS_COUNT,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: Math.round(sum(rows, 'gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`), avgOverTarget: Math.round(sum(rows, 'gz') / rows.length) > BUDGET.perPictureAvgTarget,
  defsGz, cssGz, decadeBefore2020: before20, decades, futureAdded, lazyEst: { before: lazyBefore, after: lazyBefore + futureAdded.total, limit: BUDGET.totalLazy },
  contrast: { tokens: TOK, pairs: PAIRS },
  rows,
};
write('era-window-r6-budget.json', JSON.stringify(budget, null, 2) + '\n');
if (budget.gzEachAvg > BUDGET.perPictureAvgTarget) console.warn(`!! 장당 평균 ${budget.gzEachAvg}B > 목표 ${BUDGET.perPictureAvgTarget}`);
if (budget.overLimit.length) throw new Error(`상한 초과: ${budget.overLimit.join(', ')}`);
if (decades.some((d) => d.overMax)) throw new Error('10년 덩어리 24KB 초과');

// ---------------------------------------------------------------- 시트 — 칩 모형(인생 기록 줄 · 시대의 창 칸)
const BG = readFileSync(OUT + 'pieces/s1/bg-metro-b2.svg', 'utf8').replace(/^[\s\S]*?<svg/, '<svg').replace(/\swidth="\d+"\sheight="\d+"/, ' class="scene__svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"').replace(/<!--[\s\S]*?-->/g, '').trim();
const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const fcChip = () => `<span class="chip--fc" data-testid="chip-fc">${icon('i-ahead')}예측</span>`;
const basisOf = (q) => (q.basis ? `<span class="log__basis">${BASIS_LABEL[q.basis]}</span>` : '');
/** 시대 줄 — 2026은 칩 없음, 2027~은 칩 + 근거 종류(SPEC-010 구현 규칙 7). 읽기 이름 「예측, <근거 종류>. <줄>」 */
const eraRow = (q, age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="${q.year > ACTUAL_LAST}" id="log-y${q.year}-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span>${q.year > ACTUAL_LAST ? `${fcChip()}${basisOf(q)}<span class="sr-only">예측, ${BASIS_LABEL[q.basis]}.</span>` : ''}</span><span class="log__sent">${q.line}</span></span></li>`;
const plainRow = (age, text, cls = '') => `<li class="log__row${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}</span></li>`;
const projRow = (age, year, text) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="proj"><span class="log__age">${age}세<small class="log__year">${year}</small></span><span class="log__text"><span class="log__tl">${icon('i-proj')}<span>전망</span></span><span class="log__sent">${text}</span></span></li>`;
const yearRow = (age, year, text) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="year"><span class="log__age">${age}세<small class="log__year">${year}</small></span><span class="log__text"><span class="log__tl">${icon('i-year')}<span>그해</span></span><span class="log__sent">${text}</span></span></li>`;
// 가짜 데이터 — 2016년생(알파) 가운데 구간의 2026~2030 인생 기록. 문장은 시안 예시(확정 전), 「전망」 줄 문장은 gm3 시안 예시 그대로
const logMock = (opt) => `<section class="card log ew__log" aria-label="인생 기록(시안 ${opt})"><div class="card__head" style="margin-bottom:var(--sp-2)"><h4 class="card__title">인생 기록</h4><span class="t-xs t-faint">시안 · 가짜 데이터</span></div><div class="log__list" style="max-height:none" role="region" aria-label="인생 기록"><ol class="log__rows">${plainRow(14, '학교 끝나고 혼자 저녁을 차려 먹는 날이 늘었습니다.', ' log__row--latest')}${eraRow(U.U07, 14)}${plainRow(13, '여름방학 내내 집에서 보냈습니다.')}${eraRow(U.U05, 13)}${projRow(13, 2029, '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.')}${eraRow(U.U04, 12)}${eraRow(U.U03, 11)}${plainRow(10, '동생이 태어났습니다.')}${eraRow(U.U01, 10)}${yearRow(9, 2025, '책상 위 시간표가 빽빽했습니다.')}</ol></div></section>`;
const sceneMock = (opt, q, { ftone = 'draft' } = {}) => `<section class="card scene-card ew__scene" aria-label="집과 가족(시안 ${opt})" data-ftone="${ftone}"><div class="scene"><div class="scene__house">${BG}<p class="scene__year"><time datetime="${q.year}">${q.year}년</time></p></div><a class="era" href="#log-y${q.year}-14" data-era="${q.id}" data-dec="${q.decade}" data-future="${q.year > ACTUAL_LAST}" title="시대의 창 · ${q.line}"><span class="era__pic" data-future="${q.year > ACTUAL_LAST}" aria-hidden="true">${svgOf(q)}</span>${opt === 'B' && q.year > ACTUAL_LAST ? `<span class="era__fc" aria-hidden="true">${icon('i-ahead')}예측</span>` : ''}<span class="sr-only">${opt === 'B' && q.year > ACTUAL_LAST ? '예측: ' : '시대의 창 · '}${q.line} 그해 기록으로</span></a></div><p class="scene__line">서울특별시 관악구 · 전셋집 · 부모님과 함께</p></section>`;

// ---------------------------------------------------------------- 시트 — 그림 칸
const KIND = { event: '그해의 사건', daily: '그 10년의 일상' };
const cap = (q, { full = true } = {}) => `<figcaption class="ew__cap"><span class="ew__year">${q.u} · ${q.years ? `${q.years[0]}~${q.years[1]}년` : `${q.year}년`} <span class="ew__kindtag">${KIND[q.kind]}${q.year <= ACTUAL_LAST ? ' · 사실' : ' · 예측'}</span></span><span class="ew__name">${q.name}</span><span class="ew__band">누가 보나 · ${WHO(q)}${q.band ? `(${BAND_LABEL[q.band]}에서만)` : ''}</span><span class="ew__line">「${q.line}」(${q.line.length})</span><span class="ew__kind">${q.basis ? `예측 · <b>${BASIS_LABEL[q.basis]}</b> — ${q.basisNote}` : `칩 없음 — ${q.basisNote}`}</span>${full ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>`;
const fig = (q, { size = 'pc', full = true, tag = '', mark = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-band="${q.band || ''}" data-size="${size}" data-tone="${TONE_ID}"${tag ? ` data-ba="${tag}"` : ''}><div class="ew__pic" data-dec="${decadeOf(q.year)}" data-future="${q.year > ACTUAL_LAST}">${svgOf(q)}${mark && q.year > ACTUAL_LAST ? `<span class="era__fc">${icon('i-ahead')}예측</span>` : ''}</div>${size === 'mobile' ? `<figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}</span></figcaption>` : cap(q, { full })}</figure>`;
const r = (id) => rows.find((x) => x.id === id);
const toneCells = (ftone, label, note) => `<section class="ew__tone" data-ftone="${ftone}"><h3>${label}</h3><p class="ew__note">${note}</p><div class="ew__tonerow"><figure class="ew__fig" data-size="pc" data-tcell="${ftone}"><div class="ew__pic" data-dec="2030" data-future="true">${svgOf(U.U06)}</div><figcaption class="ew__cap"><span class="ew__year">175×140</span></figcaption></figure><figure class="ew__fig" data-size="pc" data-tcell="${ftone}"><div class="ew__pic" data-dec="2030" data-future="true">${svgOf(U.U06)}<span class="era__fc">${icon('i-ahead')}예측</span></div><figcaption class="ew__cap"><span class="ew__year">175×140 + 창 표(안 B)</span></figcaption></figure><figure class="ew__fig" data-size="mobile" data-tcell="${ftone}"><div class="ew__pic" data-dec="2030" data-future="true">${svgOf(U.U06)}</div><figcaption class="ew__cap"><span class="ew__year">100×80</span></figcaption></figure><figure class="ew__fig" data-size="band" data-tcell="${ftone}"><div class="ew__bandcell"><div class="ew__pic" data-dec="2030" data-future="true">${svgOf(U.U06)}</div><span class="era__fc">${icon('i-ahead')}예측</span></div><figcaption class="ew__cap"><span class="ew__year">휴대폰 띠 326×80 + 표(안 B — 그림 옆 띠 바탕 위)</span></figcaption></figure></div></section>`;
const figBand = (q) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-size="band"><div class="ew__bandcell"><div class="ew__pic" data-dec="${decadeOf(q.year)}" data-future="${q.year > ACTUAL_LAST}">${svgOf(q)}</div>${q.year > ACTUAL_LAST ? `<span class="era__fc">${icon('i-ahead')}예측</span>` : ''}</div><figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}</span></figcaption></figure>`;

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 6차 — 미래 연표 묶음 A(SPEC-010, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-010 시대의 창 6차(「예측」 칩 두 안 · 미래 그림 톤 두 안 · 2026~2039 12장). 생성 scripts/design/buildEraWindowR6.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0), 승인 전(approved: false). -->
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
.ew__grid .ew__pic, .ew__grid3 .ew__pic, .ew__tonerow .ew__fig[data-size="pc"] .ew__pic { width: 175px; height: 140px; }
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
.ew__strip .ew__fig, .ew__tonerow .ew__fig[data-size="mobile"] { width: 100px; }
.ew__strip .ew__pic, .ew__tonerow .ew__fig[data-size="mobile"] .ew__pic { width: 100px; height: 80px; }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew td.ok { color: var(--c-text-2); }
.ew__tablewrap { overflow-x: auto; }
.ew__ask, .ew__rule, .ew__list { max-width: 72ch; padding-left: 1.2em; }
.ew__ask li, .ew__list li { margin: 0 0 var(--sp-2); }
.ew__rule li { margin: 0 0 var(--sp-1); }
.ew pre { font-size: var(--fs-sm); line-height: 1.5; background: var(--c-surface); padding: var(--sp-3) var(--sp-4); overflow-x: auto; max-width: 100%; white-space: pre-wrap; }
/* 칩 두 안 — 각 안은 실제 카드 두 장(집과 가족 · 인생 기록)으로 */
.ew__opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); align-items: start; }
@media (max-width: 1023px) { .ew__opts { grid-template-columns: minmax(0, 1fr); } }
.ew__opt { display: grid; gap: var(--sp-4); min-width: 0; }
.ew__opt > h3 { margin: 0; }
.ew__scene .scene__house { height: auto; }
.ew__scene .scene__svg { width: 100%; height: auto; aspect-ratio: 640 / 256; max-height: none; }
.ew__scene .era__pic { aspect-ratio: 5 / 4; }
/* 시안 family.css의 .era__pic·.era는 position이 없다(구현 src/styles/family.css의 .era__pic은 relative) — 창 표(.era__fc)가 칸 안에 붙도록 여기서 맞춘다 */
.ew .era__pic { position: relative; }
@container scene (max-width: 480px) { .ew__scene .era__pic { aspect-ratio: auto; } }
/* 휴대폰 띠 모형(톤 절·띠 셋째 줄): 카드 폭 326 × 80 — 그림 100×80 왼쪽, 표는 그림 옆 띠 바탕 위(안 B의 휴대폰 자리) */
.ew__bandcell { position: relative; display: flex; align-items: flex-start; gap: var(--sp-2); width: 326px; max-width: 100%; height: 80px; background: var(--c-surface); }
.ew__bandcell .ew__pic { width: 100px; height: 80px; flex: none; }
.ew__bandcell .era__fc { position: static; margin-top: var(--sp-2); }
.ew__strip--band .ew__fig { width: 326px; max-width: 100%; }
@media (forced-colors: active) { .ew__bandcell { border: 1px solid CanvasText; } }
.ew__log .log__list { padding: 0; }
.ew__cmp { display: flex; flex-wrap: wrap; gap: var(--sp-4) var(--sp-8); align-items: center; padding: var(--sp-3) 0; }
.ew__cmp > div { display: flex; flex-direction: column; gap: var(--sp-2); align-items: flex-start; }
.ew__cmp .log__rows { width: min(100%, 420px); }
.ew__cmp .log__row { border-bottom: 0; }
/* 비교용 「전망」 칩 — src/styles/title.css .chip 그대로(놋쇠 알약) */
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 0 var(--sp-2); border-radius: var(--r-pill); border: 1px solid var(--c-accent); background: var(--c-accent-soft); color: var(--c-on-accent-soft); font-size: var(--fs-xs); font-weight: var(--fw-bold); line-height: 1.7; }
.chip .icon { width: 14px; height: 14px; stroke-width: 2.4; }
.ew__tonerow { display: flex; flex-wrap: wrap; gap: var(--sp-4); align-items: flex-end; }
.ew__tones { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-6) var(--sp-8); }
@media (max-width: 1023px) { .ew__tones { grid-template-columns: minmax(0, 1fr); } }
.ew__swatch { display: inline-block; width: 1em; height: 1em; vertical-align: -0.15em; border: 1px solid var(--c-border-strong); margin-right: 4px; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } .chip { background: Canvas; color: CanvasText; border-color: CanvasText; } }
${toneCssA('.ew')}
${futureToneCss('.ew')}
${chipCss()}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}${ICON_ERA}${ICON_PROJ}${ICON_YEAR}${ICON_AHEAD}</defs></svg>
<main class="ew">
<h1>시대의 창 6차 — 미래 연표 묶음 A</h1>
<p class="ew__lead">2026년부터 2039년까지 열두 장(U01~U12)과, 2027년 이후의 줄에 붙는 「예측」 칩 두 안, 미래 그림을 「기록 사진」과 가르는 톤 두 안입니다. 줄 문장은 SPEC-010 연표 표 그대로이고 그림은 전부 새로 구성했습니다. 열두 장 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r6.html">라이트</a><a href="era-window-r6.html?theme=dark">다크</a><a href="era-window-r5b.html">5차b 시트</a><a href="era-window-r5.html">5차 시트</a><a href="era-window-r4.html">4차 시트</a></nav>

<h2 id="chips">「예측」 칩 — 두 안</h2>
<p class="ew__note">두 안의 차이는 자리뿐입니다. 안 A는 인생 기록의 시대 줄에만 칩을 두고, 안 B는 시대의 창 그림 왼쪽 위에도 작은 표를 둡니다(그림만 보는 사람이 가상의 미래를 지나간 사실로 읽지 않게 — FM2d 「창에는 그림만」의 작은 예외). 칩은 오디색 꼬리표 + 글자 「예측」 + 아이콘 세 겹이고 옆에 근거 종류 한 단어가 붙습니다. 2026년 줄(사실)에는 칩이 없습니다. 아래는 2016년생 가운데 구간의 2026~2030 기록(가짜 데이터)입니다.</p>
<div class="ew__opts">
<section class="ew__opt" data-opt="A" aria-labelledby="opt-a"><h3 id="opt-a">안 A · 인생 기록 시대 줄에만</h3>${sceneMock('A', U.U07)}${logMock('A')}</section>
<section class="ew__opt" data-opt="B" aria-labelledby="opt-b"><h3 id="opt-b">안 B · 시대 줄과 시대의 창 양쪽 (기본 제안)</h3>${sceneMock('B', U.U07)}${logMock('B')}</section>
</div>
<h3>경제 칸의 「전망」과 나란히 — 색·아이콘·모양이 다르다</h3>
<p class="ew__note">「전망」은 공식 추계(놋쇠 알약, 꺾은선과 점선, 연표 줄은 긴 점선 테두리)이고 「예측」은 시대의 창의 미래 장면(오디색 꼬리표, 점과 빈 점, 시대 줄의 겹선 테두리)입니다. 한 기록 안에 둘이 같이 서도 색·아이콘·모양·줄 테두리 네 가지로 갈립니다. 강제 색상에서는 색이 사라져도 글자·아이콘·모양·테두리 모양이 남습니다.</p>
<div class="ew__cmp" data-testid="cmp">
<div><span class="chip chip--proj">${icon('i-proj')}전망</span><span class="t-xs t-faint">경제 칸 · 통계 슬라이드의 칩(기존)</span></div>
<div>${fcChip()}<span class="t-xs t-faint">시대의 창 · 「예측」 칩(새)</span></div>
<div><ol class="log__rows">${projRow(13, 2029, '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.')}${eraRow(U.U05, 13)}</ol></div>
</div>
<div class="ew__tablewrap"><table><caption class="sr-only">전망 칩과 예측 칩의 차이</caption><thead><tr><th scope="col">겹</th><th scope="col">「전망」(기존, 경제)</th><th scope="col">「예측」(새, 시대의 창)</th></tr></thead><tbody>
<tr><td>색</td><td><i class="ew__swatch" style="background:var(--c-accent)"></i>놋쇠 <code>--c-accent</code> / 면 <code>--c-accent-soft</code></td><td><i class="ew__swatch" style="background:var(--c-era)"></i>오디색 <code>--c-era</code> / 면 <code>--c-era-soft</code>(시대 줄의 토큰 — 새 토큰 0)</td></tr>
<tr><td>아이콘</td><td><code>#i-proj</code> 꺾은선 + 점선 꼬리</td><td><code>#i-ahead</code> 찬 점 · 짧은 선 · 빈 점</td></tr>
<tr><td>모양</td><td>알약 <code>--r-pill</code></td><td>꼬리표 <code>--r-sm</code>(6px)</td></tr>
<tr><td>줄의 왼쪽 선</td><td>긴 점선(dashed) 놋쇠</td><td>겹선(double) 오디색(기존 시대 줄 그대로)</td></tr>
<tr><td>글자</td><td>「전망」</td><td>「예측」 + 근거 종류 한 단어</td></tr>
<tr><td>읽기 이름</td><td>「n/N 전망, …」</td><td>줄 「예측, 공식 전망 바탕. 줄 문장」 · 창 「예측: 줄 문장」</td></tr>
</tbody></table></div>
<h3>대비 실측(토큰 값 2026-11-03, <code>src/styles/tokens.css</code> 읽기)</h3>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">쌍</th><th scope="col" class="num">라이트</th><th scope="col" class="num">다크</th><th scope="col" class="num">기준</th></tr></thead><tbody>${PAIRS.map((p) => `<tr><td>${p.name} <span class="t-xs t-faint"><code>${p.a}</code> / <code>${p.b}</code></span></td><td class="num">${p.light}</td><td class="num">${p.dark}</td><td class="num">${p.min ? `≥ ${p.min}` : '—'}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">강제 색상은 칩 면 Canvas · 글자·테두리 CanvasText(글자 「예측」과 아이콘이 남는다), 창의 표는 Canvas 면 + 1px CanvasText 테두리. 360·320·글자 200%에서는 표지 「시대의 창」 · 칩 · 근거 글자가 한 줄에 안 들면 다음 줄로 내려가고(<code>flex-wrap</code>) 가로 넘침은 0입니다(캡처 <code>era-r6-chips-360.jpg</code>).</p>

<h2 id="tones">미래 그림 톤 — 두 안(U06으로 비교)</h2>
<p class="ew__note">2010년대부터 그림에는 필터·망점·종이 겹이 없어, 미래 장면도 그대로 두면 2020년대 「기록 사진」과 같아 보입니다. 두 안 모두 그림 바이트 0(CSS만)이고 2026년 이하에는 닿지 않습니다. 왼쪽 기준은 승인된 2022년(r5b) 그림입니다.</p>
<div class="ew__tones">
<section class="ew__tone" data-ftone="none"><h3>기준 · 과거 그림(2022, r5b 승인)</h3><p class="ew__note">2010년대~ 톤: 필터 없음. 미래 그림이 이것과 같아 보이면 안 된다.</p><div class="ew__tonerow"><figure class="ew__fig" data-size="pc" data-tcell="past"><div class="ew__pic" data-dec="2020">${svgOf(r5b2022)}</div><figcaption class="ew__cap"><span class="ew__year">175×140</span></figcaption></figure><figure class="ew__fig" data-size="mobile" data-tcell="past"><div class="ew__pic" data-dec="2020">${svgOf(r5b2022)}</div><figcaption class="ew__cap"><span class="ew__year">100×80</span></figcaption></figure><figure class="ew__fig" data-size="pc" data-tcell="plain"><div class="ew__pic" data-dec="2030">${svgOf(U.U06)}</div><figcaption class="ew__cap"><span class="ew__year">U06 그대로(톤 없음 — 이렇게 두면 기록 사진처럼 읽힌다)</span></figcaption></figure></div></section>
${toneCells('draft', '안 1 · 밑그림(추천)', `채도 절반·조금 밝게 — 「아직 색이 다 칠해지지 않은 그림」. 과거가 세피아로 바래듯 미래는 색이 덜 든 쪽으로 — 톤 A의 시간 축을 그대로 잇는다. 라이트 <code>${FUTURE_TONE.draft.filter}</code> · 다크 <code>${FUTURE_TONE.draft.dark}</code>. 칩을 줄에만 두는 안 A를 고르셔도 창 안에서 미래가 구분된다.`)}
${toneCells('frame', '안 2 · 점선 틀', '그림은 2010년대와 같은 색 그대로, 칸 안쪽 2px 점선(오디색) 틀 — 「전망」 그래프의 점선 언어와 같은 뜻. 100×80에서 점선이 그림 가장자리를 먹고, 창 표(안 B)와 겹치면 틀이 둘이 된다.')}
</div>
<h3>열두 장을 각 안으로(100×80 — 휴대폰 띠 크기)</h3>
<p class="ew__note">2026년 두 장(U01·U02)은 사실이라 어느 안에서도 그대로입니다.</p>
<p class="ew__note"><b>안 1 밑그림</b></p><div class="ew__strip" data-ftone="draft" data-strip="draft">${S6.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>안 2 점선 틀</b></p><div class="ew__strip" data-ftone="frame" data-strip="frame">${S6.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>안 1 + 창 표(안 B) — 휴대폰 띠(326×80)에서의 자리</b>: 그림 옆 띠 바탕 위라 그림을 가리지 않는다(PC에서는 그림 왼쪽 위 — 위 「칩 두 안」 안 B 카드).</p><div class="ew__strip ew__strip--band" data-ftone="draft" data-strip="draft-mark">${S6.map((q) => figBand(q)).join('')}</div>

<h2 id="bands">2026 · 2030 — 수저별로 다른 장면이 한눈에 읽히는가</h2>
<p class="ew__note">2026년은 어려운 쪽·가운데가 U01(대기실), 부유한 쪽이 U02(항구가 보이는 밤 사무실)를 봅니다. 2030년은 어려운 쪽 U06(빗속 신청 줄) · 가운데 U07(저녁 재교육 강의실) · 부유한 쪽 U08(밤 사무실의 그래프와 서버실)입니다. 사람 수·빛·장소가 세 쪽에서 다르게 읽히는지 봐 주세요.</p>
<div class="ew__grid3" data-pair="2026">${fig(U.U01, { full: false })}${fig(U.U02, { full: false })}</div>
<h3>2030년 — 세 구간</h3>
<div class="ew__grid3" data-pair="2030">${fig(U.U06, { full: false })}${fig(U.U07, { full: false })}${fig(U.U08, { full: false })}</div>

<h2 id="pieces">열두 장 — U01~U12</h2>
<p class="ew__note">그림은 톤 없이(있는 그대로) 보입니다. 톤은 위 「미래 그림 톤」에서, 창 표는 「칩 두 안」에서 봐 주세요. 캡션의 「그리는 것」은 SPEC-010 표의 문장을 바탕으로 실제로 그린 것을, 「유지선」은 수위 판단을 적었습니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${S6.map((q) => fig(q)).join('')}</div>

<h2>크게 보기 350×280 — 열두 장</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${S6.map((q) => fig(q, { full: false })).join('')}</div>

<h2>휴대폰 띠 크기 100×80(톤 없음)</h2>
<div class="ew__strip" data-tone="${TONE_ID}" data-strip="plain">${S6.map((q) => fig(q, { size: 'mobile' })).join('')}</div>

<h2>번호 · 해 · 누가 보나 · 줄 · 근거 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">번호</th><th scope="col">해</th><th scope="col">누가 보나</th><th scope="col">줄(자)</th><th scope="col">칩 · 근거 칸</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.u}</td><td>${x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`}</td><td>${x.who}${x.band ? ` <span class="ew__band">${x.band}</span>` : ''}${x.kind === 'daily' ? ' · 일상' : ''}</td><td>${x.line} (${x.lineChars})</td><td>${x.forecast ? `예측 · ${x.basisLabel}` : '없음(사실)'}</td><td class="num">${x.shapes}(${x.uses})</td><td class="num">${x.gz}B${x.overLimit ? ' · 상한 초과' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">열두 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${budget.gzEachAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}) — 목표 평균 ≤ 1,600B · 상한 2,500B 안(초과 0). 2020년대 덩어리: 기존 11장 ${before20.withDefs.toLocaleString('ko-KR')}B → U01~U05를 보충해 ${decades[0].withDefs.toLocaleString('ko-KR')}B(≤ 24,000B). 2030년대 새 덩어리 ${decades[1].withDefs.toLocaleString('ko-KR')}B(한 줄·공유 defs·토큰 CSS 포함 — 보수적). 2027년 이후가 늘린 양 ${futureAdded.total.toLocaleString('ko-KR')}B(묶음 A 몫 — 상한 98,700B, 44장 어림 78,700B의 2020·2030년대 몫 19,500B 대비). 94장 누적 추정 ${lazyBefore.toLocaleString('ko-KR')}B → ${budget.lazyEst.after.toLocaleString('ko-KR')}B(≤ 230,000B). 근거 칸: 공식 전망 바탕 ${BASIS_COUNT.official} · 전문가 전망 바탕 ${BASIS_COUNT.expert} · 가상 시나리오 ${BASIS_COUNT.scenario}(2027~ ${budget.forecast}장). 정본 수치는 <code>era-window-r6-budget.json</code>.</p>

<h2 id="mismatch">그림과 줄이 안 맞는 곳 — 줄은 바꾸지 않고 대안만 적는다</h2>
<ol class="ew__list">
<li><b>U02 「경상흑자가 일본·독일 합을 넘었습니다.」</b> — 그림(항구의 밤과 오르는 막대)은 「흑자」와 「호황」을 말하지만 「일본·독일」 비교는 그릴 수 없다(국기·지도 0). 줄이 비교를, 그림이 호황을 맡는 분담으로 두었다. 대안: 줄을 「메모리 호황에 경상흑자가 크게 났습니다.」(질문 1 (나))로 바꾸면 그림과 줄이 한 뜻이 된다 — 형진 님이 (가)를 고르셨으므로 그대로 둔다.</li>
<li><b>U01 「AI가 퍼지고 신입 공고는 줄었습니다.」</b> — 「AI가 퍼지고」는 그릴 수 없어(로고·기기 모사 0) 대기실의 「짧아진 목록 + 많은 대기자」로 「신입 공고는 줄었다」만 그렸다. 그림에 AI의 흔적을 넣으려면 화면 한쪽에 「대화형 화면(빈 말풍선)」을 둘 수 있으나 2024 그림(화면 속 말풍선)과 겹친다. 그대로 둔다.</li>
<li><b>U10 「돌봄 일손이 모자란 집이 늘었습니다.」</b> — 표의 「그리는 것」(방문 요양 접수 복도의 빈 의자와 신청서)은 「집」이 아니라 「접수처」다. 줄의 주어(집)와 그림의 장소(접수처)가 다르지만, 「일손 모자람」을 집 안에서 그리면 U11과 겹쳐 표대로 접수처로 그렸다(빈 사무용 의자 · 서류 더미 · 빈 쪽지). 대안: 줄을 「돌봄 일손을 못 구한 집이 늘었습니다.」(20)로 바꾸면 접수처 그림과 더 맞는다 — 줄은 그대로 두고 보고만 한다.</li>
<li><b>U09 「자율주행 셔틀이 시범 운행에 나섰습니다.」</b>(22자, 상한) — 그림은 맞다. 다만 2030~2039 열 해의 일상으로 쓰기에 「시범 운행에 나섰다」는 한 해의 소식처럼 읽힐 수 있다(가운데 구간은 U09·U10을 번갈아 최대 5번 본다). 대안: 「자율주행 셔틀이 동네를 돌았습니다.」(19) — 줄은 그대로 둔다.</li>
</ol>

<h2>developer 인계(승인 뒤 — 이번에는 src를 건드리지 않았다)</h2>
<ol class="ew__rule">
<li>조각 <code>pieces/era-r6/</code> 12 + <code>era-window-r6-budget.json</code>(행에 <code>basis</code>·<code>u</code>·<code>forecast</code>·<code>years</code> 포함) → <code>genEraWindows.ts</code> <code>META</code>에 r6 추가, 승인 장수 가드 94 → 106(승인된 장만). 2020년대 <code>d2020.ts</code>에 U01~U05 보충, 새 <code>d2030.ts</code>.</li>
<li>칩 CSS(아래 원문)는 <code>family.css</code>의 시대 줄 블록 옆에, 아이콘 <code>#i-ahead</code>는 <code>scene-icons.svg</code>(또는 <code>ui-icons.svg</code>)에 — <code>buildIcons.mjs</code> 규칙대로 fill·색 속성 없음(점 하나만 <code>fill="currentColor"</code>). 글자 「예측」 · 「공식 전망 바탕」 · 「전문가 전망 바탕」 · 「가상 시나리오」는 <code>sceneText.ts</code>(FU6 글꼴 조각 s2·s3).</li>
<li>톤: 형진 님이 고른 안의 CSS 한 블록을 <code>.era[data-future='true'] svg</code>(안 1) 또는 <code>.era[data-future='true'] .era__pic</code>(안 2)에. <code>data-future</code>는 <code>year &gt; ERA_ACTUAL_LAST_YEAR</code>(2026)로 — 그림이 아니라 해로 정한다(구현 규칙 4).</li>
<li>창의 표(안 B를 고르면): <code>a.era</code> 안, <code>.era__pic</code>의 <b>형제</b>로 <code>&lt;span class="era__fc" aria-hidden="true"&gt;</code>(<code>.era</code>에 <code>position: relative</code>). PC는 칸 왼쪽 위(= 그림 위), 휴대폰 띠(<code>@container scene (max-width: 480px)</code>)는 <code>left: calc(100px + var(--sp-2))</code>로 그림 옆 띠 바탕 위. 접근 이름은 「예측: &lt;줄&gt;」(<code>eraAccessibleName</code>에 분기). 칩은 설정으로 끌 수 없다. 가려진 줄에서도 표지·칩은 가리지 않는다.</li>
<li>SPEC-004 PJ7 「2026년 첫 진입 안내 카드」(<code>.log__row--proj-intro</code> 「여기서부터는 실제가 아니라 공식 전망을 바탕으로 한 이야기입니다」)가 구현돼 있으면 같은 해에 「전망」 안내와 2027년 「예측」 칩이 나란히 선다 — 문구 통일은 마스터 확인 M5.</li>
</ol>
<pre>${chipCss().replace(/</g, '&lt;')}
/* 톤 안 1(밑그림) */ .era[data-future='true'] svg { filter: ${FUTURE_TONE.draft.filter}; }  :root[data-theme='dark'] .era[data-future='true'] svg { filter: ${FUTURE_TONE.draft.dark}; }
/* 톤 안 2(점선 틀) */ .era[data-future='true'] .era__pic { outline: 2px dashed var(--c-era); outline-offset: -4px; }
${ICON_AHEAD.replace(/</g, '&lt;')}</pre>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>칩 자리</b> — 안 A(시대 줄에만) / 안 B(시대 줄과 창 양쪽, 기본 제안). 안 B의 표는 PC에서 그림 왼쪽 위(175×140의 4~5%), 휴대폰 띠에서는 그림 옆 띠 바탕 위에 섭니다(위 「안 1 + 창 표」 줄).</li>
<li><b>미래 그림 톤</b> — 안 1 밑그림(추천) / 안 2 점선 틀. 안 1은 칩을 줄에만 두어도 창 안에서 미래가 구분됩니다.</li>
<li><b>열두 장 사건별 승인</b> — 특히 2026 두 장(U01 대기실 / U02 항구가 보이는 밤 사무실)과 2030 세 장(U06 빗속 신청 줄 / U07 재교육 강의실 / U08 밤 사무실)이 「수저별로 다른 삶」으로 읽히는지, 2030년대 돌봄 두 장(U11 좁은 거실 / U12 넓은 거실)의 수위가 맞는지.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r6.html', html);

console.log(`시대의 창 r6: ${rows.length}장(사건 ${budget.events} · 일상 ${budget.daily}) · 예측 ${budget.forecast}장(공식 ${BASIS_COUNT.official} · 전문가 ${BASIS_COUNT.expert} · 시나리오 ${BASIS_COUNT.scenario}) · 장당 gzip 평균 ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B + css ${cssGz}B`);
for (const x of rows) console.log(`${x.u} ${x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`} ${x.id}: ${x.band ? `(${x.band}) ` : ''}조각 ${x.shapes}(use ${x.uses}) · gz ${x.gz}${x.overLimit ? ' !!상한' : ''} · 「${x.line}」(${x.lineChars}) · ${x.forecast ? x.basisLabel : '사실'}`);
console.log(`2020년대 기존 ${before20.withDefs}B(덩어리 ${before20.chunkGz}) → ${decades[0].withDefs}B(덩어리 ${decades[0].chunkGz})${decades[0].overMax ? ' !!24KB' : ''} · 2030년대 ${decades[1].withDefs}B(덩어리 ${decades[1].chunkGz})${decades[1].overMax ? ' !!24KB' : ''} · 2027년 이후 늘린 양 ${futureAdded.total}B · 누적 추정 ${budget.lazyEst.after}B`);
for (const p of PAIRS) console.log(`대비 ${p.name}: 라이트 ${p.light} · 다크 ${p.dark}${p.min ? ` (≥ ${p.min})` : ''}`);

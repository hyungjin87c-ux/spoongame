/**
 * SPEC-010 「시대의 창」 8차(r8) 시안 생성기 — 미래 연표 묶음 C (designer 2026-11-03).
 *
 * 정본: `docs/spec/SPEC-010-미래연표.md`(2026-11-03 확정) 「할 것」 FU4 · 「연표 표」 2060년대(4)·2070년대(3)·2080년대(3)·2090년대(4, ○ 1)·2100년대(4, 끝 장면 포함) · 「그림 수위」 · 「예산」 · 구현 규칙 3(표 끝 2110 끝 줄 한 번, 2111부터 끝 장면),
 *   스타일 정본 `docs/design/era-window.md`(톤 A · 3-1 · r3~r7 · 허용 class · 11·12절).
 * 만드는 것: 그림 18장(U27~U44). 칩·톤은 다시 제안하지 않는다 — 형진 님이 묶음 A에서 정한 **안 B(칩은 기록 줄과 창 양쪽)·안 1(밑그림 톤)**이 적용된 모습만 시트에 보인다. 끝 장면(U44)은 칩·표·톤 없이(해로 정한다 — `isForecastYear` 거짓).
 * 조각 위치·형식은 r7과 같다(`pieces/era-r8/<id>.svg`, `era-window-r8-budget.json` — genEraWindows.ts가 읽는 행 모양 + `basis`·`u`·`forecast`·`years`·`band`·`heavy`). 끝 장면 행은 `kind: 'base'` · `years [2110, 2130]` · `decade 2100`(R-602) · `basis null` · `forecast false`.
 * 예산(SPEC-010): 장당 평균 ≤ 1.6KB gzip · 상한 2.5KB(○ 군중 3.5KB) · 10년 덩어리 ≤ 24KB(어림 2060년대 7.5 · 2070년대 6 · 2080년대 6 · 2090년대 8.2 · 2100년대 7.5KB) · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB — 묶음 A+B 35,170B, 묶음 C 몫 ≈ 45KB).
 * 지킨 것: `src/`·`tests/` 손대지 않음(읽기만: tokens.css 토큰 값) · 승인 표기 0(approved: false) · 외부 URL 0 · 사진 모사 0 · 인터넷 조사 0.
 *
 * 실행: node scripts/design/buildEraWindowR8.mjs
 * 산출: docs/design/mockups/family/era-window-r8.html · pieces/era-r8/<id>.svg(18) · era-window-r8-budget.json
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA, futureToneCss, chipCss, FUTURE_TONE, ICON_AHEAD, ICON_PROJ, ICON_ERA, ICON_YEAR } from './eraR8Lib.mjs';
import { S8, BASIS_LABEL } from './eraR8Scenes.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r8', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const ACTUAL_LAST = 2026;
const LAST_YEAR = 2109; // 표가 있는 마지막 해(ERA_LAST_YEAR) — 2110은 끝 줄 한 번, 2111부터 끝 장면
const BAND_YEARS = [2065, 2095]; // 이 묶음에서 수저 구간이 갈리는 해(부유한 쪽만 다른 그림)
const BAND_LABEL = { low: '아래 둘(흙·동수저)', high: '위 둘(금수저 쪽)' };
const WHO = (q) => (q.kind === 'base' ? '모두 · 2110년부터' : q.band === 'low' ? '어려운 쪽' : q.band === 'high' ? '부유한 쪽' : q.kind === 'event' && BAND_YEARS.includes(q.year) ? '어려운 쪽·가운데' : '모두');
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
// SPEC-010 구현 규칙 6·「그림 수위」 6 — 줄 문장 금지 낱말(developer 시험 목록은 따로 만든다; 여기서는 시안 단언). 주인공 행동 낱말은 막지 않고 경고로 남겨 보고한다(줄은 designer가 바꾸지 않는다).
const FEAR = /종말|붕괴|멸망|재앙|파국|참사|위기/;
const ACTOR = /(갔|탔|샀|받았|일했|출근|퇴근|배웠|먹었|마셨)/;
const warnings = [];

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
if (S8.length !== 18) throw new Error(`장면 ${S8.length}장(18 기대)`);
for (const q of S8) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (!/습니다\.$/.test(q.line)) throw new Error(`합쇼체 사실 문장이 아니다: ${q.id}`);
  if (/\d/.test(q.line)) throw new Error(`줄에 숫자: ${q.id}`);
  if (/[A-Za-z]/.test(q.line.replace(/AGI|AI/g, ''))) throw new Error(`줄에 AI·AGI 밖 알파벳: ${q.id}`);
  if (FEAR.test(q.line)) throw new Error(`줄에 공포·평가 낱말: ${q.id}`);
  if (q.kind !== 'base' && ACTOR.test(q.line)) warnings.push(`${q.u} 줄 「${q.line}」이 주인공 행동 낱말 목록에 걸린다(${q.line.match(ACTOR)[0]}) — SPEC 표 문장 그대로, 마스터 보고`);
  if (/일본|독일|미국|중국|러시아|인도/.test(q.line)) throw new Error(`줄의 나라 이름(이 묶음은 0): ${q.id}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws || !q.u) throw new Error(`유지선 판단(ft3)·그리는 것(draws)·번호(u) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
  if (q.heavy && q.u !== 'U37') throw new Error(`이 묶음의 ○는 U37 하나: ${q.id}`);
  if (q.kind === 'base') { if (q.basis !== undefined || q.id !== 'era-end-horizon' || q.years?.join() !== '2110,2130' || q.decade !== 2100 || q.band || q.heavy) throw new Error(`끝 장면 규칙(basis 없음 · id era-end-horizon · years 2110~2130 · decade 2100 · band·○ 없음): ${q.id}`); }
  else {
    if (q.year <= ACTUAL_LAST || q.year > LAST_YEAR || !(q.basis in BASIS_LABEL)) throw new Error(`basis 규칙(2027~2109 필수): ${q.id}`);
    if (q.kind === 'daily' && (!q.years || q.ageBand !== '모두' || q.band)) throw new Error(`이 묶음의 일상은 years + ages 없음(모두) + band 없음: ${q.id}`);
    if (q.kind === 'event' && q.years) throw new Error(`사건은 한 해짜리: ${q.id}`);
    if (q.decade !== decadeOf(q.year) || ![2060, 2070, 2080, 2090, 2100].includes(q.decade)) throw new Error(`10년대 값: ${q.id}`);
  }
  const m = inner(q);
  for (const c of m.matchAll(/class="([^"]+)"/g)) for (const k of c[1].split(/\s+/)) if (!ALLOWED.has(k)) throw new Error(`허용 목록 밖 class ${k}: ${q.id}`);
  if (/<(?!\/?(rect|path|circle|ellipse|use|g)\b)/.test(m)) throw new Error(`허용 밖 태그: ${q.id}`);
  if (/<text|<image|href="http|url\(http/.test(m)) throw new Error(`글자·외부 자원: ${q.id}`);
}
const U = Object.fromEntries(S8.map((q) => [q.u, q]));
if (S8.map((q) => q.u).join() !== Array.from({ length: 18 }, (_, i) => `U${27 + i}`).join()) throw new Error('번호 U27~U44 순서');
if (!(U.U27.band === undefined && U.U28.band === 'high' && U.U27.year === 2065 && U.U28.year === 2065)) throw new Error('2065: U27 band 없음 · U28 high');
if (!(U.U37.band === undefined && U.U37.heavy && U.U38.band === 'high' && !U.U38.heavy && U.U37.year === 2095 && U.U38.year === 2095)) throw new Error('2095: U37 band 없음 ○ · U38 high');
if (!([U.U31, U.U34, U.U41].every((q) => q.kind === 'event' && !q.band && !q.heavy) && [U.U31, U.U34, U.U41].map((q) => q.year).join() === '2078,2085,2100')) throw new Error('2078·2085·2100 모두가 보는 사건');
for (const d of [2060, 2070, 2080, 2090, 2100]) { const dl = S8.filter((q) => q.kind === 'daily' && q.decade === d); if (dl.length !== 2 || dl.some((q) => q.years[0] !== d || q.years[1] !== d + 9)) throw new Error(`${d}년대 일상: 모두 2 + years [${d}, ${d + 9}]`); }
if (U.U44.kind !== 'base') throw new Error('U44는 끝 장면');
// 고르기 흉내(10-1·8-2절 + SPEC-010 구현 규칙 1~3·5): 2060~2112 × 구간 셋 × 가리기 둘에 그림이 닿고, 2060~2109에서 같은 그림이 3해 연속 나오지 않는다. 2110부터는 끝 장면(일부러 같은 그림).
const pickOf = (y, band, gentle, prev) => {
  if (y > LAST_YEAR) return U.U44.id;
  const evs = S8.filter((q) => q.kind === 'event' && q.year === y && !(gentle && q.heavy));
  const ev = evs.find((q) => q.band === band) || evs.find((q) => !q.band);
  if (ev) return ev.id;
  const dl = S8.filter((q) => q.kind === 'daily' && q.years[0] <= y && y <= q.years[1]);
  const mine = band !== 'mid' ? dl.filter((q) => q.band === band) : [];
  const base = dl.filter((q) => !q.band);
  const cands = [...mine, ...base].filter((q) => !(prev[0] === q.id && prev[1] === q.id));
  const first = cands.find((q) => q.id !== prev[0]) || cands[0];
  return first.id;
};
const BASIS_COUNT = { official: 0, expert: 0, scenario: 0, none: 0 };
for (const q of S8) BASIS_COUNT[q.basis || 'none']++;
const PICKS = {};
for (const gentle of [false, true]) for (const band of ['low', 'mid', 'high']) {
  const key = `${band}${gentle ? '-gentle' : ''}`; const prev = [null, null]; PICKS[key] = [];
  for (let y = 2060; y <= 2112; y++) { const id = pickOf(y, band, gentle, prev); if (!id) throw new Error(`${y} ${key} 닿는 그림 없음`); if (y <= LAST_YEAR && prev[0] === id && prev[1] === id) throw new Error(`${y} ${key} 같은 그림 3해 연속 ${id}`); PICKS[key].push(S8.find((q) => q.id === id).u); prev.unshift(id); prev.length = 2; }
}
if (pickOf(2065, 'low', false, [null, null]) !== U.U27.id || pickOf(2065, 'mid', false, [null, null]) !== U.U27.id || pickOf(2065, 'high', false, [null, null]) !== U.U28.id) throw new Error('2065 구간 고르기');
if (pickOf(2095, 'mid', false, [null, null]) !== U.U37.id || pickOf(2095, 'high', false, [null, null]) !== U.U38.id || pickOf(2095, 'high', true, [null, null]) !== U.U38.id || ![U.U39.id, U.U40.id].includes(pickOf(2095, 'low', true, [null, null]))) throw new Error('2095 구간·가리기 고르기');
if (pickOf(2110, 'mid', false, [null, null]) !== U.U44.id || pickOf(2130, 'high', true, [null, null]) !== U.U44.id) throw new Error('2110 뒤 끝 장면');

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
const BUDGET = { perPicture: 2500, perPictureCrowdHeavy: 3500, perPictureAvgTarget: 1600, perDecadeChunk: 24000, totalLazy: 230000, perLoad: 75000, futureAdded: 98700, futureAddedTarget: 80000, bundleAB: 35170, specEstimate: { d2060: 7500, d2070: 6000, d2080: 6000, d2090: 8200, d2100: 7500 } };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const chipNote = (q) => (q.kind === 'base' ? '끝 장면(칩·표·톤 없음 — 2110년 끝 줄 한 번, 2111부터 그림만)' : `예측(${BASIS_LABEL[q.basis]})${q.heavy ? ' · ○ 무거운 장면' : ''}`);
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r8(SPEC-010 미래 연표 묶음 C) · ${q.u} · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.kind} · ${q.topic}${q.band ? ` · 수저 구간 ${BAND_LABEL[q.band]}에서만` : ''} · ${chipNote(q)} · 승인 전(approved: false — 형진 님 사건별 승인 뒤 developer가 넣는다) · 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 미래 톤은 CSS(그림 안 겹 0) --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const rows = S8.map((q) => {
  const m = inner(q); write(`pieces/era-r8/${q.id}.svg`, pieceSvg(q));
  const g = gz(m); const limit = q.heavy ? BUDGET.perPictureCrowdHeavy : BUDGET.perPicture;
  return { id: q.id, u: q.u, year: q.year, years: q.years || [q.year, q.year], decade: q.decade, hCode: null, name: q.name, kind: q.kind, topic: q.topic, heavy: !!q.heavy, band: q.band || null, ageBand: q.kind === 'event' ? null : '모두', who: WHO(q), line: q.line, lineChars: q.line.length, forecast: q.kind !== 'base', basis: q.basis || null, basisLabel: q.basis ? BASIS_LABEL[q.basis] : null, basisNote: q.basisNote, draws: q.draws, ft3: q.ft3, shapes: countShapes(m), uses: countUses(m), raw: Buffer.byteLength(m, 'utf8'), gz: g, over25: g > BUDGET.perPicture, overLimit: g > limit, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const dec = (list, label, est) => { const c = chunk(list); const withDefs = c + lines(list) + defsGz + cssGz; return { label, pieces: list.length, chunkGz: c, withLines: c + lines(list), withDefs, specEstimate: est, underEstimate: withDefs <= est, overMax: withDefs > BUDGET.perDecadeChunk }; };
const SETS = [2060, 2070, 2080, 2090, 2100].map((d) => [d, S8.filter((q) => q.decade === d)]);
const decades = SETS.map(([d, list]) => dec(list, `${d}년대 ${list.length}장(${list[0].u}~${list[list.length - 1].u}${d === 2100 ? ' · 끝 장면 포함' : ''})`, BUDGET.specEstimate[`d${d}`]));
const futureAdded = Object.fromEntries(decades.map((x, i) => [`d${SETS[i][0]}`, x.withDefs]));
futureAdded.total = decades.reduce((a, x) => a + x.withDefs, 0);
futureAdded.bundleAB = BUDGET.bundleAB;
futureAdded.allBundles = futureAdded.total + BUDGET.bundleAB;
const lazyBefore = 158230; // r7 실측 뒤 누적 추정(137,707 + 20,523)
const budget = {
  measuredAt: '2026-11-03', round: 'r8', spec: 'SPEC-010 미래 연표 묶음 C(2060~2109 + 끝 장면)', tone: TONE_ID, futureTone: { chosen: 'draft', name: FUTURE_TONE.draft.name, filter: FUTURE_TONE.draft.filter, dark: FUTURE_TONE.draft.dark }, chip: { chosen: 'B', where: '인생 기록의 시대 줄 + 시대의 창 칸(형진 님 2026-11-03) — 끝 줄·끝 장면에는 없음' },
  note: 'r8 18장(U27~U44). U27~U43은 2027년 이후 → forecast true · basis 필수. U44 끝 장면은 kind base · years [2110, 2130] · decade 2100 고정(R-602) · basis null · forecast false(칩·표·톤 없음). gz는 그림 안쪽 마크업(톤 겹 0)을 class·use로 바꾼 뒤 gzip. chunk는 10년마다 {id: 마크업} JSON으로 묶어 gzip + 한 줄 + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회(보수적 — 실제 덩어리는 참조하는 defs만 싣는다). 예산(SPEC-010): 장당 평균 ≤ 1.6KB · 상한 2.5KB(○ 군중 3.5KB) · 10년 덩어리 ≤ 24KB(어림 2060년대 7.5 · 2070년대 6 · 2080년대 6 · 2090년대 8.2 · 2100년대 7.5KB) · 2027년 이후가 늘린 양 ≤ 98.7KB(목표 80KB · 묶음 A+B 35,170B) · 누적 ≤ 230KB · 한 번에 ≤ 75KB. 승인 표기 0(approved: false). 칩·톤은 묶음 A에서 확정된 값(안 B · 안 1)을 그대로 쓴다.',
  budget: BUDGET, pieces: rows.length, events: rows.filter((r) => r.kind === 'event').length, daily: rows.filter((r) => r.kind === 'daily').length, base: rows.filter((r) => r.kind === 'base').length, heavy: rows.filter((r) => r.heavy).length, forecast: rows.filter((r) => r.forecast).length, basisCount: BASIS_COUNT, lineWarnings: warnings,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: Math.round(sum(rows, 'gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'),
  over25: rows.filter((r) => r.over25).map((r) => `${r.id} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`), avgOverTarget: Math.round(sum(rows, 'gz') / rows.length) > BUDGET.perPictureAvgTarget,
  defsGz, cssGz, decades, futureAdded, lazyEst: { before: lazyBefore, after: lazyBefore + futureAdded.total, limit: BUDGET.totalLazy }, picks: PICKS,
  contrast: { tokens: TOK, pairs: PAIRS },
  rows,
};
write('era-window-r8-budget.json', JSON.stringify(budget, null, 2) + '\n');
if (budget.gzEachAvg > BUDGET.perPictureAvgTarget) console.warn(`!! 장당 평균 ${budget.gzEachAvg}B > 목표 ${BUDGET.perPictureAvgTarget}`);
if (budget.overLimit.length) throw new Error(`상한 초과: ${budget.overLimit.join(', ')}`);
if (decades.some((d) => d.overMax)) throw new Error('10년 덩어리 24KB 초과');
if (futureAdded.allBundles > BUDGET.futureAdded) throw new Error(`2027년 이후 늘린 양 ${futureAdded.allBundles} > ${BUDGET.futureAdded}`);

// ---------------------------------------------------------------- 시트 — 확정된 칩(안 B)·톤(안 1)이 적용된 모형(인생 기록 줄 · 시대의 창 칸 · 끝 장면)
const BG = readFileSync(OUT + 'pieces/s1/bg-metro-b2.svg', 'utf8').replace(/^[\s\S]*?<svg/, '<svg').replace(/\swidth="\d+"\sheight="\d+"/, ' class="scene__svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"').replace(/<!--[\s\S]*?-->/g, '').trim();
const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const fcChip = () => `<span class="chip--fc" data-testid="chip-fc">${icon('i-ahead')}예측</span>`;
const basisOf = (q) => `<span class="log__basis">${BASIS_LABEL[q.basis]}</span>`;
/** 시대 줄 — 2027~2109는 칩 + 근거 종류(SPEC-010 구현 규칙 7, 읽기 이름 「예측, <근거 종류>. <줄>」), 2110년 끝 줄은 칩·근거 없이 표지만 */
const eraRow = (q, age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="true" id="log-y${q.year}-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span>${fcChip()}${basisOf(q)}<span class="sr-only">예측, ${BASIS_LABEL[q.basis]}.</span></span><span class="log__sent">${q.line}</span></span></li>`;
const endRow = (age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="false" id="log-y2110-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">2110</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span></span><span class="log__sent">${U.U44.line}</span></span></li>`;
const dailyRow = (q, age, year) => eraRow({ ...q, year }, age);
const plainRow = (age, text, cls = '') => `<li class="log__row${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}</span></li>`;
const projRow = (age, year, text) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="proj"><span class="log__age">${age}세<small class="log__year">${year}</small></span><span class="log__text"><span class="log__tl">${icon('i-proj')}<span>전망</span></span><span class="log__sent">${text}</span></span></li>`;
// 가짜 데이터 — 2016년생(알파) 가운데 구간의 2065~2110 인생 기록 발췌. 일반 문장은 시안 예시(확정 전), 「전망」 줄 문장은 gm3 시안 예시 그대로. 2110년(94세)의 끝 줄에는 칩이 없고 2111년부터는 시대 줄이 없다
const logMock = () => `<section class="card log ew__log" aria-label="인생 기록(시안)"><div class="card__head" style="margin-bottom:var(--sp-2)"><h4 class="card__title">인생 기록</h4><span class="t-xs t-faint">시안 · 가짜 데이터 · 2016년생 가운데 구간 · 2065~2110 발췌</span></div><div class="log__list" style="max-height:none" role="region" aria-label="인생 기록"><ol class="log__rows">${plainRow(95, '손주가 오래된 사진을 함께 넘겨 보았습니다.', ' log__row--latest')}${endRow(94)}${dailyRow(U.U43, 93, 2109)}${plainRow(90, '같은 층 이웃이 요양 시설로 옮겼습니다.')}${dailyRow(U.U42, 88, 2104)}${eraRow(U.U41, 84)}${plainRow(81, '여름마다 짐을 꾸려 자식 집으로 갔습니다.')}${eraRow(U.U37, 79)}${projRow(74, 2090, '연금을 받는 나이가 다시 조정될 수도 있습니다.')}${eraRow(U.U34, 69)}${eraRow(U.U31, 62)}${plainRow(54, '둘째가 집을 떠나 혼자 살기 시작했습니다.')}${eraRow(U.U27, 49)}</ol></div></section>`;
const sceneMock = (q, year, { ftone = 'draft', end = false, age = 49 } = {}) => `<section class="card scene-card ew__scene" aria-label="집과 가족(시안)" data-ftone="${ftone}"${end ? ' data-end="true"' : ''}><div class="scene"><div class="scene__house">${BG}<p class="scene__year"><time datetime="${year}">${year}년</time></p></div><a class="era" href="#log-y${end ? 2110 : year}-${age}" data-era="${q.id}" data-dec="${q.decade}"${end ? '' : ' data-future="true"'} title="시대의 창 · ${q.line}"><span class="era__pic"${end ? '' : ' data-future="true"'} aria-hidden="true">${svgOf(q)}</span>${end ? '' : `<span class="era__fc" aria-hidden="true">${icon('i-ahead')}예측</span>`}<span class="sr-only">${end ? '' : '예측: '}${q.line} 그해 기록으로</span></a></div><p class="scene__line">${end ? '서울특별시 관악구 · 자식 집 · 아들 식구와 함께' : '서울특별시 관악구 · 전셋집 · 배우자와 아이 둘'}</p></section>`;

// ---------------------------------------------------------------- 시트 — 그림 칸
const KIND = { event: '그해의 사건', daily: '그 10년의 일상', base: '끝 장면' };
const tag = (q) => (q.kind === 'base' ? '끝 장면 · 칩 없음' : `${KIND[q.kind]} · 예측${q.heavy ? ' · ○' : ''}`);
const cap = (q, { full = true } = {}) => `<figcaption class="ew__cap"><span class="ew__year">${q.u} · ${q.kind === 'base' ? '2110년부터' : q.years ? `${q.years[0]}~${q.years[1]}년` : `${q.year}년`} <span class="ew__kindtag">${tag(q)}</span></span><span class="ew__name">${q.name}</span><span class="ew__band">누가 보나 · ${WHO(q)}${q.band ? `(${BAND_LABEL[q.band]}에서만)` : ''}</span><span class="ew__line">「${q.line}」(${q.line.length})</span><span class="ew__kind">${q.kind === 'base' ? '칩 없음' : `예측 · <b>${BASIS_LABEL[q.basis]}</b>`} — ${q.basisNote}</span>${full ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>`;
const fig = (q, { size = 'pc', full = true, mark = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-band="${q.band || ''}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}"${q.kind === 'base' ? '' : ' data-future="true"'}>${svgOf(q)}${mark && q.kind !== 'base' ? `<span class="era__fc">${icon('i-ahead')}예측</span>` : ''}</div>${size === 'mobile' ? `<figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}${q.heavy ? ' ○' : ''}</span></figcaption>` : cap(q, { full })}</figure>`;
const figBand = (q) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-size="band"><div class="ew__bandcell"><div class="ew__pic" data-dec="${decadeOf(q.year)}"${q.kind === 'base' ? '' : ' data-future="true"'}>${svgOf(q)}</div>${q.kind === 'base' ? '' : `<span class="era__fc">${icon('i-ahead')}예측</span>`}</div><figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}${q.kind === 'base' ? ' 표 없음' : ''}</span></figcaption></figure>`;
const pickCell = (u) => `<td class="ew__pk" data-u="${u}">${u}</td>`;
const YEARS = Array.from({ length: 53 }, (_, i) => 2060 + i);
const pickTable = (keys) => `<div class="ew__tablewrap"><table><thead><tr><th scope="col">구간</th>${YEARS.map((y) => `<th scope="col" class="ew__pk">${y}</th>`).join('')}</tr></thead><tbody>${keys.map(([name, k]) => `<tr><th scope="row">${name}</th>${PICKS[k].map(pickCell).join('')}</tr>`).join('')}</tbody></table></div>`;

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 8차 — 미래 연표 묶음 C(SPEC-010, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-010 시대의 창 8차(2060~2109 17장 + 끝 장면 1장, 확정된 「예측」 칩 안 B·미래 톤 안 1 적용). 생성 scripts/design/buildEraWindowR8.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고 0), 승인 전(approved: false). -->
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
/* 확정 칩·톤이 적용된 카드(집과 가족 PC·휴대폰 · 끝 장면 · 인생 기록) */
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
<h1>시대의 창 8차 — 미래 연표 묶음 C</h1>
<p class="ew__lead">2060년부터 2109년까지 열일곱 장(U27~U43)과 2110년부터 계속 보이는 끝 장면 한 장(U44)입니다. 줄 문장은 SPEC-010 연표 표 그대로이고 그림은 전부 새로 구성했습니다. 「예측」 칩과 미래 톤은 묶음 A에서 정해진 대로(기록 줄과 창 양쪽, 밑그림) 적용된 모습만 보이고, 끝 장면에는 칩·표·톤이 없습니다. 열여덟 장 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r8.html">라이트</a><a href="era-window-r8.html?theme=dark">다크</a><a href="era-window-r7.html">7차 시트(묶음 B)</a><a href="era-window-r6.html">6차 시트(묶음 A)</a></nav>

<h2 id="applied">확정된 칩·톤이 적용된 모습</h2>
<p class="ew__note">왼쪽 위는 2065년 가운데 구간의 집과 가족 카드 — PC 폭과 휴대폰 폭(360) 둘 다, 시대의 창 칸에 밑그림 톤과 「예측」 표(PC는 그림 왼쪽 위, 휴대폰 띠는 그림 옆). 왼쪽 아래는 표 끝 뒤인 2111년의 카드 — 끝 장면에는 표도 톤도 없습니다. 오른쪽은 2016년생 가운데 구간의 2065~2110 인생 기록 발췌(가짜 데이터)입니다. 2109년까지의 시대 줄에는 모두 칩과 근거 종류가 붙고, 2110년의 끝 줄은 표지만 있으며, 2111년부터는 시대 줄이 없습니다. 2090년의 「전망」 줄은 경제 칸의 기존 칩이라 색·아이콘·모양이 다릅니다.</p>
<div class="ew__applied" data-applied><div class="ew__appliedcol"><p class="ew__note ew__note--tight">PC 폭 — 2065년</p>${sceneMock(U.U27, 2065)}<p class="ew__note ew__note--tight">휴대폰 폭 360 — 띠 모양, 표는 그림 옆</p><div class="ew__phone">${sceneMock(U.U27, 2065)}</div><p class="ew__note ew__note--tight">표 끝 뒤 — 2111년(끝 장면, 표·톤 없음)</p>${sceneMock(U.U44, 2111, { end: true, age: 95 })}</div>${logMock()}</div>

<h2 id="bands">2065 · 2095 — 부유한 쪽만 다른 그림</h2>
<p class="ew__note">2065년은 어려운 쪽·가운데가 U27(윤곽 둘이 뜬 상담실 화면과 꽉 찬 대기 의자), 부유한 쪽이 U28(서재의 화면 하나와 열쇠 표지)을 봅니다. 2095년은 U37(체육관 대피소 ○)과 U38(제방 위 언덕의 새 단지)입니다. 얼굴 없이 「여럿 ↔ 혼자, 공공 ↔ 사적, 바닥 ↔ 언덕 위」로 수저 격차가 읽히는지 봐 주세요.</p>
<h3>2065년 — 의식을 옮긴 디지털 인간</h3>
<div class="ew__grid3" data-pair="2065">${fig(U.U27, { full: false })}${fig(U.U28, { full: false })}</div>
<h3>2095년 — 큰비</h3>
<div class="ew__grid3" data-pair="2095">${fig(U.U37, { full: false })}${fig(U.U38, { full: false })}</div>

<h2 id="daily">그 10년의 일상 — 10년마다 둘</h2>
<p class="ew__note">2060년대부터는 수저 변주 없이 세 구간이 같은 두 장을 번갈아 봅니다(같은 그림 연속은 최대 2해, 같은 줄은 4해 주기로 돌아옵니다). 그래서 일상 그림은 사물을 적게 두고 차분하게 그렸습니다 — 여러 해 반복해 봐도 거슬리지 않는지 봐 주세요.</p>
<h3>2060년대</h3><div class="ew__grid3" data-pair="2060s">${fig(U.U29, { full: false })}${fig(U.U30, { full: false })}</div>
<h3>2070년대</h3><div class="ew__grid3" data-pair="2070s">${fig(U.U32, { full: false })}${fig(U.U33, { full: false })}</div>
<h3>2080년대</h3><div class="ew__grid3" data-pair="2080s">${fig(U.U35, { full: false })}${fig(U.U36, { full: false })}</div>
<h3>2090년대</h3><div class="ew__grid3" data-pair="2090s">${fig(U.U39, { full: false })}${fig(U.U40, { full: false })}</div>
<h3>2100년대</h3><div class="ew__grid3" data-pair="2100s">${fig(U.U42, { full: false })}${fig(U.U43, { full: false })}</div>

<h2 id="end">끝 장면 — 2110년부터</h2>
<p class="ew__note">표는 2109년에서 끝납니다. 2110년에 「${U.U44.line}」 줄이 한 번 나오고, 2111년부터는 줄 없이 이 그림만 판이 끝날 때까지 보입니다. 칩·표·톤이 없고 사람·사건도 없습니다. 수평선 하나만 두어 고요하게 — 오래 봐도 거슬리지 않는지 봐 주세요.</p>
<div class="ew__grid3" data-pair="end">${fig(U.U44, { full: false })}</div>

<h2 id="pieces">열여덟 장 — U27~U44</h2>
<p class="ew__note">그림은 톤 없이(있는 그대로) 보입니다. 밑그림 톤이 입혀진 모습은 위 「적용된 모습」과 아래 「휴대폰 띠」에서 봐 주세요. 캡션의 「그리는 것」은 SPEC-010 표의 문장을 바탕으로 실제로 그린 것을, 「유지선」은 수위 판단을 적었습니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${S8.map((q) => fig(q)).join('')}</div>

<h2>크게 보기 350×280 — 열여덟 장</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${S8.map((q) => fig(q, { full: false })).join('')}</div>

<h2 id="strips">휴대폰 띠 크기 100×80</h2>
<p class="ew__note"><b>톤 없음(그림 그대로)</b></p><div class="ew__strip" data-tone="${TONE_ID}" data-strip="plain">${S8.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤(확정 안 1)</b> — 끝 장면(U44)은 해로 정하는 규칙 때문에 톤이 걸리지 않습니다.</p><div class="ew__strip" data-ftone="draft" data-strip="draft">${S8.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤 + 창 표(확정 안 B) — 휴대폰 띠 326×80에서의 자리</b>: 그림 옆 띠 바탕 위라 그림을 가리지 않습니다(PC에서는 그림 왼쪽 위 — 위 「적용된 모습」). 끝 장면에는 표가 없습니다.</p><div class="ew__strip ew__strip--band" data-ftone="draft" data-strip="draft-mark">${S8.map((q) => figBand(q)).join('')}</div>

<h2>번호 · 해 · 누가 보나 · 줄 · 근거 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">번호</th><th scope="col">해</th><th scope="col">누가 보나</th><th scope="col">줄(자)</th><th scope="col">칩 · 근거 칸</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.u}${x.heavy ? ' ○' : ''}</td><td>${x.kind === 'base' ? '2110~' : x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`}</td><td>${x.who}${x.band ? ` <span class="ew__band">${x.band}</span>` : ''}${x.kind === 'daily' ? ' · 일상' : x.kind === 'base' ? ' · 끝 장면' : ''}</td><td>${x.line} (${x.lineChars})</td><td>${x.forecast ? `예측 · ${x.basisLabel}` : '없음'}</td><td class="num">${x.shapes}(${x.uses})</td><td class="num">${x.gz}B${x.overLimit ? ' · 상한 초과' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">열여덟 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${budget.gzEachAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}) — 목표 평균 ≤ 1,600B · 상한 2,500B(○ 3,500B) 안(초과 0). 새 10년 덩어리(한 줄·공유 defs·토큰 CSS 포함, 보수적): ${decades.map((d) => `${d.label.replace(/\(.*$/, '')} ${d.withDefs.toLocaleString('ko-KR')}B(어림 ${d.specEstimate.toLocaleString('ko-KR')} ${d.underEstimate ? '안' : '초과'})`).join(' · ')} — 모두 10년 덩어리 한도 24,000B 안. 2027년 이후가 늘린 양: 묶음 A+B 35,170B + 묶음 C ${futureAdded.total.toLocaleString('ko-KR')}B = <strong>${futureAdded.allBundles.toLocaleString('ko-KR')}B</strong>(상한 98,700B · 목표 80,000B). 누적 추정 ${lazyBefore.toLocaleString('ko-KR')}B → ${budget.lazyEst.after.toLocaleString('ko-KR')}B(≤ 230,000B). 근거 칸: 공식 전망 바탕 ${BASIS_COUNT.official} · 전문가 전망 바탕 ${BASIS_COUNT.expert} · 가상 시나리오 ${BASIS_COUNT.scenario} · 없음(끝 장면) ${BASIS_COUNT.none}. 정본 수치는 <code>era-window-r8-budget.json</code>.</p>

<h3>고르기 흉내 — 2060~2112 해마다 구간별로 보는 그림(10-1·8-2절 + 구현 규칙 1~3·5)</h3>
${pickTable([['어려운 쪽', 'low'], ['가운데', 'mid'], ['부유한 쪽', 'high']])}
<p class="ew__note">세 구간 × 2060~2109에 그림이 닿고 같은 그림이 3해 연속 나오지 않습니다(생성기가 단언). 2065·2095는 부유한 쪽만 U28·U38, 2078·2085·2100은 모두 같은 그림, 2110년부터는 세 구간 모두 끝 장면 U44(일부러 같은 그림)입니다.</p>
<h3>가리기를 켰을 때(○ U37만 바뀐다)</h3>
${pickTable([['어려운 쪽', 'low-gentle'], ['가운데', 'mid-gentle'], ['부유한 쪽', 'high-gentle']])}
<p class="ew__note">가리기를 켜면 2095년의 어려운 쪽·가운데가 U37 대신 그 10년의 일상(U39·U40 가운데 앞 두 해와 겹치지 않는 것)을 보고 줄은 가려집니다. 부유한 쪽의 U38은 ○가 아니라 그대로입니다.</p>

<h2 id="mismatch">그림과 줄이 안 맞는 곳 — 줄은 바꾸지 않고 장면을 맞추거나 대안만 적는다</h2>
<ol class="ew__list">
<li><b>U27 「의식을 옮긴 디지털 인간이 생겼습니다.」</b> — 표의 「상담실 화면 속 눈코입 없는 윤곽 둘, 의료진 뒷모습」대로 그렸고, 수저 격차가 한눈에 읽히도록 오른쪽에 <b>꽉 찬 대기 의자와 선 사람 둘</b>(공공 상담실의 줄)을 더했습니다. 윤곽 둘은 찬 면 하나와 점선 윤곽 하나로, 원본과 닮은 얼굴을 비교하는 그림이 되지 않게 했습니다. 줄 문장은 그대로입니다.</li>
<li><b>U28 「의식을 옮겨 둔 집이 먼저 생겼습니다.」</b> — 표의 「서재 같은 방, 화면 속 윤곽과 열쇠 모양 표지」대로. 「집」은 서재 한 칸으로, 「먼저」는 혼자만의 방·책장·정원으로 말합니다(U27과 짝). 열쇠 표지는 글자 없는 도형입니다.</li>
<li><b>U35 「교실에 학생이 몇 안 남았습니다.」</b> — 표의 「책상 몇 개만 찬 교실, 창밖의 운동장」은 U26(2050년대 — 가운데 모여 앉은 다섯과 구석에 쌓아 둔 책상)과 같은 장면이 되어, 여기서는 <b>열두 책상 중 셋만 찬 격자</b>와 앞 벽의 화면(화이트보드 대신)으로 구도를 바꿨습니다. 2080년대라 학급이 더 줄었음을 빈 책상의 수로 보입니다.</li>
<li><b>U36 「폭염에 바깥출입을 막은 날이 늘었습니다.」</b> — 표의 「통제 표지(빈 판)가 선 낮의 거리, 닫힌 가게」를 U25(2050년대 확성기 거리)와 다르게 <b>정면 원근의 골목 어귀 + 차단 막대 + 머리 위 그늘 천</b>으로 그렸습니다. 사람은 0입니다(막은 날이므로).</li>
<li><b>U42 「한여름 낮의 거리가 텅 비었습니다.」</b> — 폭염 거리가 셋(U25·U36·U42)이라 이 장은 <b>아케이드 그늘과 빛만</b>으로 사물을 최소로 두었습니다(10년 일상으로 반복되기 때문). 표의 「햇빛 가득한 빈 거리와 그늘」 그대로입니다.</li>
<li><b>U41 「예전 지도와 해안선이 달라졌습니다.」</b> — 「지도」는 국제 질서 규칙(나라 지도 0)과 부딪치지 않게 <b>특정 나라·한반도 모양이 아닌 일반형 해안 윤곽 한 줄</b>(땅·바다 두 색, 글자·지명·국경 0)로 그렸습니다. 달라짐은 종이의 선과 눈앞까지 올라온 물의 차이로 읽힙니다.</li>
<li><b>U44 「여기서부터는 그려진 연표가 없습니다.」</b> — 표의 「조용한 수평선과 빈 하늘(사람·사건 없음)」 그대로. 구현(<code>isForecastYear</code>)대로 2110년 뒤는 예측이 아니라 <b>톤도 표도 걸리지 않으므로</b> 그림 자체를 옅은 색으로 그렸습니다. 끝 줄은 2110년에 한 번만 나옵니다(구현 규칙 3).</li>
<li><b>주인공 행동 낱말</b> — 이 묶음의 18줄은 구현 규칙 6의 목록(갔·탔·샀·받았·일했·출근·퇴근·배웠·먹었·마셨)에 걸리는 줄이 ${warnings.length}개입니다${warnings.length ? ` — ${warnings.join(' / ')}` : '(「일하는」 U33·U40은 규칙이 허용하는 꾸밈말, 「찾아왔」 U29는 목록 밖)'}.</li>
</ol>

<h2>developer 인계(승인 뒤 — 이번에도 src를 건드리지 않았다)</h2>
<ol class="ew__rule">
<li>조각 <code>pieces/era-r8/</code> 18 + <code>era-window-r8-budget.json</code>(행에 <code>basis</code>·<code>u</code>·<code>forecast</code>·<code>years</code>·<code>band</code>·<code>heavy</code>) → <code>genEraWindows.ts</code> <code>META</code>에 r8 추가, 승인 장수 가드 120 → 138(승인된 장만). 새 <code>d2060.ts</code>(4)·<code>d2070.ts</code>(3)·<code>d2080.ts</code>(3)·<code>d2090.ts</code>(4)·<code>d2100.ts</code>(4 — 끝 장면 포함), <code>ERA_DECADE_LOADERS</code>·<code>ERA_DECADES_WITH_DATA</code>에 2060~2100.</li>
<li>끝 장면 U44: <code>kind: 'base'</code> · id <code>era-end-horizon</code> · <code>years [2110, 2130]</code> · <b><code>decade = 2100</code> 고정</b>(R-602 — <code>Math.min(decadeOfYear(years[0]), 2100)</code>, 가드·시험은 <code>kind: 'base'</code>만 예외) · <code>basis</code> 없음 · 칩·표·톤 없음(해로 정한다). 2110년에 끝 줄 한 번, 2111년부터 줄 없음(<code>eraRowsOf</code>).</li>
<li>사건 <code>band</code>: 2065 U28 · 2095 U38은 <code>band: 'high'</code>, 같은 해의 U27·U37은 band 없음(10-1절 규칙). ○는 <b>U37 하나</b>(<code>heavy: true</code>) — 가리기 켜면 2090년대 일상(U39·U40)으로. 2060년대 이후 일상은 모두 band 없음 2장씩.</li>
<li>칩·톤·아이콘·글자는 묶음 A 인계(11-7절) 그대로 — 새 토큰·심볼·패턴·아이콘 0. 새 줄 18개의 글자는 FU6 글꼴 조각(s2·s3)을 다시 만든다. FU11 예측 근거 칸: U27~U43의 근거 글은 <code>docs/data/future-foresight-quotes.md</code>를 따른다(U28에는 「수저별 차이는 게임의 설정입니다.」 + 반대 근거 한 건).</li>
</ol>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>2065 두 장(U27 상담실 대기 / U28 서재)</b> — 「의식을 옮긴 디지털 인간이 생겼습니다」와 「…집이 먼저 생겼습니다」가 얼굴 없이(화면 속 윤곽 둘 ↔ 하나) 수저 격차로 읽히는지. 윤곽의 수위(찬 면 + 점선)가 지나치거나 모자라지 않은지.</li>
<li><b>2095 두 장(U37 체육관 대피소 ○ / U38 언덕 위 새 단지)</b> — 대피소가 「현장까지, 순간은 아님」의 수위에 맞는지(매트·담요·배급 줄·창밖의 잠긴 길), 언덕 위 단지와 아래 동네의 물길 대비가 과시로 읽히지 않는지.</li>
<li><b>열여덟 장 사건별 승인</b> — 특히 끝 장면 U44(수평선 하나 — 2110년부터 판이 끝날 때까지 계속 보인다)가 고요한지, 10년마다 둘씩인 일상(U29·U30 / U32·U33 / U35·U36 / U39·U40 / U42·U43)이 반복돼도 거슬리지 않는지, U41의 지도 종이(일반형 해안 윤곽)가 괜찮은지.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r8.html', html);

console.log(`시대의 창 r8: ${rows.length}장(사건 ${budget.events} · 일상 ${budget.daily} · 끝 ${budget.base} · ○ ${budget.heavy}) · 예측 ${budget.forecast}장(공식 ${BASIS_COUNT.official} · 전문가 ${BASIS_COUNT.expert} · 시나리오 ${BASIS_COUNT.scenario}) · 장당 gzip 평균 ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}) · defs ${defsGz}B + css ${cssGz}B`);
for (const x of rows) console.log(`${x.u} ${x.kind === 'base' ? '2110~' : x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`} ${x.id}: ${x.band ? `(${x.band}) ` : ''}${x.heavy ? '○ ' : ''}조각 ${x.shapes}(use ${x.uses}) · gz ${x.gz}${x.overLimit ? ' !!상한' : ''} · 「${x.line}」(${x.lineChars}) · ${x.basisLabel || '칩 없음'}`);
for (const d of decades) console.log(`${d.label}: ${d.withDefs}B(덩어리 ${d.chunkGz}, 어림 ${d.specEstimate} ${d.underEstimate ? '안' : '초과'})${d.overMax ? ' !!24KB' : ''}`);
console.log(`묶음 C가 늘린 양 ${futureAdded.total}B · A+B+C ${futureAdded.allBundles}B(≤ 98,700 · 목표 80,000) · 누적 추정 ${budget.lazyEst.after}B`);
for (const k of Object.keys(PICKS)) console.log(`고르기 ${k}: ${PICKS[k].join(' ')}`);
for (const p of PAIRS) console.log(`대비 ${p.name}: 라이트 ${p.light} · 다크 ${p.dark} (≥ ${p.min})`);
for (const w of warnings) console.warn(`!! ${w}`);

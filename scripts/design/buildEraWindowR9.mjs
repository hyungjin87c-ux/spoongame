/**
 * SPEC-010 「시대의 창」 9차(r9) 시안 생성기 — 미래 연표 묶음 C 다시 그리기 (designer 2026-11-04). r8(18장)은 형진 님 피드백으로 폐기하고 이 20장으로 바꾼다.
 *
 * 정본: `docs/spec/SPEC-010-미래연표.md` 「r2 개정안」 절(N27~N46 → 본표 반영 뒤 U27~U46) · 「그림 수위」 + r2 메모 ①~③ · 「예산 계산 (r2)」(묶음 C 몫 약 60KB · 큰 사건 2.3~3.5KB · 10년 덩어리 ≤ 24KB) · 구현 규칙 3(끝 장면 `decade` 2100 고정, R-602)·5(사건 band 해 넷 · ○ N39 하나),
 *   마스터 전달(2026-11-04): N38 줄 「미·중 두 진영으로 세계가 갈렸습니다.」(그림은 둘로 가른 항만·공급망, 국기·지도·군사 장비 0) · N27 줄 원안 그대로. 스타일 정본 `docs/design/era-window.md`(톤 A · 3-1 · r3~r8 · 허용 class · 11~13절).
 * 만드는 것: 그림 20장(U27~U46). 칩·톤은 묶음 A 확정값(안 B · 안 1)이 적용된 모습만. 끝 장면(U46)은 칩·표·톤 없이(해로 정한다 — `isForecastYear` 거짓).
 * 조각 위치·형식은 r8과 같다(`pieces/era-r9/<id>.svg`, `era-window-r9-budget.json` — genEraWindows.ts가 읽는 행 모양 + `basis`·`u`·`forecast`·`years`·`band`·`heavy`). 끝 장면 행은 `kind: 'base'` · `years [2110, 2130]` · `decade 2100` · `basis null` · `forecast false`.
 * 지킨 것: `src/`·`tests/`·`docs/spec/` 손대지 않음(읽기만: tokens.css 토큰 값) · 승인 표기 0(approved: false) · 외부 URL 0 · 사진 모사 0 · 인터넷 조사 0 · 줄 문장은 표 그대로.
 *
 * 실행: node scripts/design/buildEraWindowR9.mjs
 * 산출: docs/design/mockups/family/era-window-r9.html · pieces/era-r9/<id>.svg(20) · era-window-r9-budget.json
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, ERA_DEFS_R5, FIG_DEFS, LIGHT, tokenCss, toClass, decadeOf, toneLayer, toneCssA, futureToneCss, chipCss, FUTURE_TONE, ICON_AHEAD, ICON_PROJ, ICON_ERA, ICON_YEAR } from './eraR9Lib.mjs';
import { S9, BASIS_LABEL } from './eraR9Scenes.mjs';
import { S8 } from './eraR8Scenes.mjs'; // 폐기한 r8 장면 — 「8차 → 9차 견주기」 절에서 인라인 SVG로만 보인다(조각 파일 참조 0)

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/era-r9', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

const TONE_ID = 'a';
const ERA_LINE_MAX = 22;
const ACTUAL_LAST = 2026;
const LAST_YEAR = 2109; // 표가 있는 마지막 해(ERA_LAST_YEAR) — 2110은 끝 줄 한 번, 2111부터 끝 장면
const BAND_YEARS = [2065, 2075, 2085, 2095]; // 수저 구간이 갈리는 사건 해(부유한 쪽만 다른 그림 — r2 개정안 원칙 2)
const BAND_LABEL = { low: '아래 둘(흙·동수저)', high: '위 둘(금수저 쪽)' };
const WHO = (q) => (q.kind === 'base' ? '모두 · 2110년부터' : q.band === 'low' ? '어려운 쪽' : q.band === 'high' ? '부유한 쪽' : q.kind === 'event' && BAND_YEARS.includes(q.year) ? '어려운 쪽·가운데' : '모두');
const MOOD = { U27: '비관', U28: '낙관', U29: '비관', U30: '중립', U31: '비관', U32: '낙관', U33: '중립', U34: '비관', U35: '비관', U36: '낙관', U37: '낙관', U38: '비관', U39: '비관', U40: '낙관', U41: '중립', U42: '비관', U43: '비관', U44: '낙관', U45: '중립', U46: '끝 장면' };
const ALLOWED = new Set(['e', 'es', 'et', 'eb', 'eh', 'ek'].flatMap((p) => Object.keys(LIGHT).map((t) => `${p}-${t}`)));
// SPEC-010 구현 규칙 6·「그림 수위」 6 — 줄 문장 금지 낱말(developer 시험 목록은 따로). 주인공 행동 낱말은 막지 않고 경고로 보고한다(줄은 designer가 바꾸지 않는다).
const FEAR = /종말|붕괴|멸망|재앙|파국|참사|위기/;
const ACTOR = /(갔|탔|샀|받았|일했|출근|퇴근|배웠|먹었|마셨)/;
// 나라 이름은 경제·인구 사실 줄에만(장 배치 규칙) — 이 묶음은 U38 「미·중」(마스터 전달)과 U43 「한국」(r2 개정안 반영 때 허용 줄에 더한다) 둘뿐
const COUNTRY = /일본|독일|미국|중국|러시아|인도|한국|미·중/;
const COUNTRY_OK = { U38: '미·중', U43: '한국' };
const warnings = [];

// ---------------------------------------------------------------- 단언
const inner = (q) => toClass(q.draw() + toneLayer(TONE_ID, q.year));
if (S9.length !== 20) throw new Error(`장면 ${S9.length}장(20 기대)`);
for (const q of S9) {
  if (q.line.length > ERA_LINE_MAX) throw new Error(`한 줄 ${q.line.length}자 > ${ERA_LINE_MAX}: ${q.id}`);
  if (!/습니다\.$/.test(q.line)) throw new Error(`합쇼체 사실 문장이 아니다: ${q.id}`);
  if (/\d/.test(q.line)) throw new Error(`줄에 숫자: ${q.id}`);
  if (/[A-Za-z]/.test(q.line.replace(/AGI|AI/g, ''))) throw new Error(`줄에 AI·AGI 밖 알파벳: ${q.id}`);
  if (FEAR.test(q.line)) throw new Error(`줄에 공포·평가 낱말: ${q.id}`);
  if (q.kind !== 'base' && ACTOR.test(q.line)) warnings.push(`${q.u} 줄 「${q.line}」이 주인공 행동 낱말 목록에 걸린다(${q.line.match(ACTOR)[0]}) — SPEC 표 문장 그대로, 마스터 보고`);
  const cm = q.line.match(COUNTRY); if (cm && COUNTRY_OK[q.u] !== cm[0]) throw new Error(`줄의 나라 이름(허용은 U38 미·중 · U43 한국): ${q.id} ${cm[0]}`);
  if (/[A-Za-z가-힣0-9]/.test(q.draw().replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${q.id}`);
  if (!q.ft3 || !q.draws || !q.u || !MOOD[q.u]) throw new Error(`유지선 판단(ft3)·그리는 것(draws)·번호(u)·읽힘(MOOD) 빠짐: ${q.id}`);
  if (q.band && !BAND_LABEL[q.band]) throw new Error(`수저 구간 값: ${q.id}`);
  if (q.approved) throw new Error(`승인 표기는 마스터 몫: ${q.id}`);
  if (q.heavy && q.u !== 'U39') throw new Error(`이 묶음의 ○는 U39 하나: ${q.id}`);
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
const U = Object.fromEntries(S9.map((q) => [q.u, q]));
if (S9.map((q) => q.u).join() !== Array.from({ length: 20 }, (_, i) => `U${27 + i}`).join()) throw new Error('번호 U27~U46 순서');
for (const [y, lo, hi] of [[2065, 'U27', 'U28'], [2075, 'U31', 'U32'], [2085, 'U35', 'U36'], [2095, 'U39', 'U40']]) if (!(U[lo].band === undefined && U[hi].band === 'high' && U[lo].year === y && U[hi].year === y && U[lo].kind === 'event' && U[hi].kind === 'event')) throw new Error(`${y}: ${lo} band 없음 · ${hi} high`);
if (!(U.U39.heavy && !U.U40.heavy)) throw new Error('2095: U39 ○ · U40 ○ 아님');
if (!(U.U43.kind === 'event' && !U.U43.band && !U.U43.heavy && U.U43.year === 2100)) throw new Error('2100 U43은 모두가 보는 사건');
if (!(U.U38.line === '미·중 두 진영으로 세계가 갈렸습니다.' && U.U27.line === '의식을 옮긴 디지털 인간이 거래됐습니다.')) throw new Error('마스터 전달 줄(U38 미·중 · U27 원안)');
for (const d of [2060, 2070, 2080, 2090, 2100]) { const dl = S9.filter((q) => q.kind === 'daily' && q.decade === d); if (dl.length !== 2 || dl.some((q) => q.years[0] !== d || q.years[1] !== d + 9)) throw new Error(`${d}년대 일상: 모두 2 + years [${d}, ${d + 9}]`); }
if (U.U46.kind !== 'base') throw new Error('U46은 끝 장면');
// 고르기 흉내(10-1·8-2절 + SPEC-010 구현 규칙 1~3·5): 2060~2112 × 구간 셋 × 가리기 둘에 그림이 닿고, 2060~2109에서 같은 그림이 3해 연속 나오지 않는다. 2110부터는 끝 장면(일부러 같은 그림).
const pickOf = (y, band, gentle, prev) => {
  if (y > LAST_YEAR) return U.U46.id;
  const evs = S9.filter((q) => q.kind === 'event' && q.year === y && !(gentle && q.heavy));
  const ev = evs.find((q) => q.band === band) || evs.find((q) => !q.band);
  if (ev) return ev.id;
  const dl = S9.filter((q) => q.kind === 'daily' && q.years[0] <= y && y <= q.years[1]);
  const mine = band !== 'mid' ? dl.filter((q) => q.band === band) : [];
  const base = dl.filter((q) => !q.band);
  const cands = [...mine, ...base].filter((q) => !(prev[0] === q.id && prev[1] === q.id));
  const first = cands.find((q) => q.id !== prev[0]) || cands[0];
  return first.id;
};
const BASIS_COUNT = { official: 0, expert: 0, scenario: 0, none: 0 };
for (const q of S9) BASIS_COUNT[q.basis || 'none']++;
const MOOD_COUNT = { 비관: 0, 낙관: 0, 중립: 0, '끝 장면': 0 };
for (const q of S9) MOOD_COUNT[MOOD[q.u]]++;
const PICKS = {};
for (const gentle of [false, true]) for (const band of ['low', 'mid', 'high']) {
  const key = `${band}${gentle ? '-gentle' : ''}`; const prev = [null, null]; PICKS[key] = [];
  for (let y = 2060; y <= 2112; y++) { const id = pickOf(y, band, gentle, prev); if (!id) throw new Error(`${y} ${key} 닿는 그림 없음`); if (y <= LAST_YEAR && prev[0] === id && prev[1] === id) throw new Error(`${y} ${key} 같은 그림 3해 연속 ${id}`); PICKS[key].push(S9.find((q) => q.id === id).u); prev.unshift(id); prev.length = 2; }
}
for (const [y, lo, hi] of [[2065, 'U27', 'U28'], [2075, 'U31', 'U32'], [2085, 'U35', 'U36'], [2095, 'U39', 'U40']]) if (pickOf(y, 'low', false, [null, null]) !== U[lo].id || pickOf(y, 'mid', false, [null, null]) !== U[lo].id || pickOf(y, 'high', false, [null, null]) !== U[hi].id) throw new Error(`${y} 구간 고르기`);
if (pickOf(2095, 'high', true, [null, null]) !== U.U40.id || ![U.U41.id, U.U42.id].includes(pickOf(2095, 'low', true, [null, null])) || ![U.U41.id, U.U42.id].includes(pickOf(2095, 'mid', true, [null, null]))) throw new Error('2095 가리기 고르기');
if (pickOf(2100, 'high', false, [null, null]) !== U.U43.id || pickOf(2110, 'mid', false, [null, null]) !== U.U46.id || pickOf(2130, 'high', true, [null, null]) !== U.U46.id) throw new Error('2100 모두 · 2110 뒤 끝 장면');

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

// ---------------------------------------------------------------- 조각 + 예산 (SPEC-010 「예산 계산 (r2)」 — 묶음 C 몫 약 60KB)
const countShapes = (s) => (s.match(/<(rect|path|circle|ellipse|use)\b/g) || []).length;
const countUses = (s) => (s.match(/<use\b/g) || []).length;
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const BUDGET = { perPictureDaily: 2500, perPictureEvent: 3500, perPictureCrowdHeavy: 3500, perPictureAvgTarget: 2100, perDecadeChunk: 24000, bundleC: 60000, totalLazy: 230000, perLoad: 75000, futureAdded: 98700, futureAddedTarget: 80000, bundleAB: 35170, specEstimate: { d2060: 11660, d2070: 11660, d2080: 11660, d2090: 12060, d2100: 10210 } };
const DEFS = ERA_DEFS_R3 + FIG_DEFS + ERA_DEFS_R5;
const defsGz = gz(DEFS), cssGz = gz(tokenCss());
const svgOf = (q, attrs = 'aria-hidden="true" focusable="false"') => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" ${attrs}>${inner(q)}</svg>`;
const chipNote = (q) => (q.kind === 'base' ? '끝 장면(칩·표·톤 없음 — 2110년 끝 줄 한 번, 2111부터 그림만)' : `예측(${BASIS_LABEL[q.basis]})${q.heavy ? ' · ○ 무거운 장면' : ''}`);
const pieceSvg = (q) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 32" width="350" height="280"><!-- 수저 게임 · 시대의 창 r9(SPEC-010 미래 연표 묶음 C 다시 그리기 — r8 폐기) · ${q.u} · ${q.id} · ${q.years ? `${q.years[0]}~${q.years[1]}` : q.year} · ${q.kind} · ${q.topic} · 읽힘 ${MOOD[q.u]}${q.band ? ` · 수저 구간 ${BAND_LABEL[q.band]}에서만` : ''} · ${chipNote(q)} · 승인 전(approved: false — 형진 님 사건별 승인 뒤 developer가 넣는다) · 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고·국기·지도 0) · 색은 class(--c-scene-* 토큰), 사람은 symbol+use, 미래 톤은 CSS(그림 안 겹 0) --><style>${tokenCss()}</style><defs>${DEFS}</defs><g>${inner(q)}</g></svg>\n`;
const limitOf = (q) => (q.heavy ? BUDGET.perPictureCrowdHeavy : q.kind === 'event' ? BUDGET.perPictureEvent : BUDGET.perPictureDaily);
const rows = S9.map((q) => {
  const m = inner(q); write(`pieces/era-r9/${q.id}.svg`, pieceSvg(q));
  const g = gz(m); const limit = limitOf(q);
  return { id: q.id, u: q.u, year: q.year, years: q.years || [q.year, q.year], decade: q.decade, hCode: null, name: q.name, kind: q.kind, topic: q.topic, mood: MOOD[q.u], heavy: !!q.heavy, band: q.band || null, ageBand: q.kind === 'event' ? null : '모두', who: WHO(q), line: q.line, lineChars: q.line.length, forecast: q.kind !== 'base', basis: q.basis || null, basisLabel: q.basis ? BASIS_LABEL[q.basis] : null, basisNote: q.basisNote, draws: q.draws, ft3: q.ft3, shapes: countShapes(m), uses: countUses(m), raw: Buffer.byteLength(m, 'utf8'), gz: g, limit, over25: g > 2500, overLimit: g > limit, approved: false };
});
const sum = (list, k) => list.reduce((a, r) => a + (r[k] || 0), 0);
const chunk = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, inner(q)]))));
const lines = (list) => gz(JSON.stringify(Object.fromEntries(list.map((q) => [q.id, q.line]))));
const dec = (list, label, est) => { const c = chunk(list); const withDefs = c + lines(list) + defsGz + cssGz; return { label, pieces: list.length, chunkGz: c, withLines: c + lines(list), withDefs, specEstimate: est, underEstimate: withDefs <= est, overMax: withDefs > BUDGET.perDecadeChunk }; };
const SETS = [2060, 2070, 2080, 2090, 2100].map((d) => [d, S9.filter((q) => q.decade === d)]);
const decades = SETS.map(([d, list]) => dec(list, `${d}년대 ${list.length}장(${list[0].u}~${list[list.length - 1].u}${d === 2100 ? ' · 끝 장면 포함' : ''})`, BUDGET.specEstimate[`d${d}`]));
const futureAdded = Object.fromEntries(decades.map((x, i) => [`d${SETS[i][0]}`, x.withDefs]));
futureAdded.total = decades.reduce((a, x) => a + x.withDefs, 0);
futureAdded.bundleAB = BUDGET.bundleAB;
futureAdded.allBundles = futureAdded.total + BUDGET.bundleAB;
const lazyBefore = 158230; // r7 실측 뒤 누적 추정(137,707 + 20,523) — r8의 32,153B는 폐기되므로 더하지 않는다
const events = rows.filter((r) => r.kind === 'event'), dailies = rows.filter((r) => r.kind === 'daily');
const budget = {
  measuredAt: '2026-11-04', round: 'r9', replaces: 'r8(18장, 2026-11-03) — 형진 님 피드백으로 폐기', spec: 'SPEC-010 미래 연표 묶음 C 다시 그리기(r2 개정안 N27~N46 → U27~U46, 2060~2109 + 끝 장면)', tone: TONE_ID, futureTone: { chosen: 'draft', name: FUTURE_TONE.draft.name, filter: FUTURE_TONE.draft.filter, dark: FUTURE_TONE.draft.dark }, chip: { chosen: 'B', where: '인생 기록의 시대 줄 + 시대의 창 칸(형진 님 2026-11-03) — 끝 줄·끝 장면에는 없음' },
  note: 'r9 20장(U27~U46). U27~U45는 2027년 이후 → forecast true · basis 필수. U46 끝 장면은 kind base · years [2110, 2130] · decade 2100 고정(R-602) · basis null · forecast false(칩·표·톤 없음). gz는 그림 안쪽 마크업(톤 겹 0)을 class·use로 바꾼 뒤 gzip. chunk는 10년마다 {id: 마크업} JSON으로 묶어 gzip + 한 줄 + 공유 패턴·사람 심볼 defs + 토큰 CSS 1회(보수적 — 실제 덩어리는 참조하는 defs만 싣는다). 예산(SPEC-010 「예산 계산 (r2)」 + 마스터 2026-11-04): 묶음 C 몫 ≤ 60,000B · 큰 사건 장 ≤ 3,500B(○ 포함) · 일상 ≤ 2,500B · 10년 덩어리 ≤ 24,000B · 2027년 이후 늘린 양 ≤ 98,700B(묶음 A+B 35,170B) · 누적 ≤ 230,000B · 한 번에 ≤ 75,000B. 승인 표기 0(approved: false). 칩·톤은 묶음 A 확정값(안 B · 안 1). U38 줄은 마스터 전달(「미·중 두 진영으로 세계가 갈렸습니다.」).',
  budget: BUDGET, pieces: rows.length, events: events.length, daily: dailies.length, base: rows.filter((r) => r.kind === 'base').length, heavy: rows.filter((r) => r.heavy).length, forecast: rows.filter((r) => r.forecast).length, basisCount: BASIS_COUNT, moodCount: MOOD_COUNT, lineWarnings: warnings,
  shapesAvg: Math.round(sum(rows, 'shapes') / rows.length), shapesMax: Math.max(...rows.map((r) => r.shapes)), usesAvg: Math.round(sum(rows, 'uses') / rows.length),
  gzEachAvg: Math.round(sum(rows, 'gz') / rows.length), gzEachMax: Math.max(...rows.map((r) => r.gz)), gzEachMin: Math.min(...rows.map((r) => r.gz)), gzEachTotal: sum(rows, 'gz'), gzEventsAvg: Math.round(sum(events, 'gz') / events.length), gzDailyAvg: Math.round(sum(dailies, 'gz') / dailies.length),
  over25: rows.filter((r) => r.over25).map((r) => `${r.u} ${r.gz}B`), overLimit: rows.filter((r) => r.overLimit).map((r) => `${r.id} ${r.gz}B`), avgOverTarget: Math.round(sum(rows, 'gz') / rows.length) > BUDGET.perPictureAvgTarget,
  defsGz, cssGz, decades, futureAdded, bundleC: { measured: futureAdded.total, limit: BUDGET.bundleC, under: futureAdded.total <= BUDGET.bundleC, r8was: 32153, specEstimate: 57250 }, lazyEst: { before: lazyBefore, after: lazyBefore + futureAdded.total, limit: BUDGET.totalLazy }, picks: PICKS,
  contrast: { tokens: TOK, pairs: PAIRS },
  rows,
};
write('era-window-r9-budget.json', JSON.stringify(budget, null, 2) + '\n');
if (budget.gzEachAvg > BUDGET.perPictureAvgTarget) console.warn(`!! 장당 평균 ${budget.gzEachAvg}B > 목표 ${BUDGET.perPictureAvgTarget}`);
if (budget.overLimit.length) throw new Error(`상한 초과: ${budget.overLimit.join(', ')}`);
if (decades.some((d) => d.overMax)) throw new Error('10년 덩어리 24KB 초과');
if (futureAdded.total > BUDGET.bundleC) throw new Error(`묶음 C 몫 ${futureAdded.total} > ${BUDGET.bundleC}`);
if (futureAdded.allBundles > BUDGET.futureAdded) throw new Error(`2027년 이후 늘린 양 ${futureAdded.allBundles} > ${BUDGET.futureAdded}`);

// ---------------------------------------------------------------- 시트 — 확정된 칩(안 B)·톤(안 1)이 적용된 모형(인생 기록 줄 · 시대의 창 칸 · 끝 장면)
const BG = readFileSync(OUT + 'pieces/s1/bg-metro-b2.svg', 'utf8').replace(/^[\s\S]*?<svg/, '<svg').replace(/\swidth="\d+"\sheight="\d+"/, ' class="scene__svg" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice"').replace(/<!--[\s\S]*?-->/g, '').trim();
const icon = (id) => `<svg class="icon" aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
const fcChip = () => `<span class="chip--fc" data-testid="chip-fc">${icon('i-ahead')}예측</span>`;
const basisOf = (q) => `<span class="log__basis">${BASIS_LABEL[q.basis]}</span>`;
/** 시대 줄 — 2027~2109는 칩 + 근거 종류(SPEC-010 구현 규칙 7, 읽기 이름 「예측, <근거 종류>. <줄>」), 2110년 끝 줄은 칩·근거 없이 표지만 */
const eraRow = (q, age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="true" id="log-y${q.year}-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">${q.year}</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span>${fcChip()}${basisOf(q)}<span class="sr-only">예측, ${BASIS_LABEL[q.basis]}.</span></span><span class="log__sent">${q.line}</span></span></li>`;
const endRow = (age) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="era" data-forecast="false" id="log-y2110-${age}" tabindex="-1"><span class="log__age">${age}세<small class="log__year">2110</small></span><span class="log__text"><span class="log__tlrow"><span class="log__tl">${icon('i-era')}<span>시대의 창</span></span></span><span class="log__sent">${U.U46.line}</span></span></li>`;
const dailyRow = (q, age, year) => eraRow({ ...q, year }, age);
const plainRow = (age, text, cls = '') => `<li class="log__row${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}</span></li>`;
const projRow = (age, year, text) => `<li class="log__row log__row--tl" data-kind="timeline" data-tl="proj"><span class="log__age">${age}세<small class="log__year">${year}</small></span><span class="log__text"><span class="log__tl">${icon('i-proj')}<span>전망</span></span><span class="log__sent">${text}</span></span></li>`;
// 가짜 데이터 — 2016년생(알파) 가운데 구간의 2065~2110 인생 기록 발췌. 가운데 구간은 band 있는 그림을 보지 않으므로 사건 해마다 어려운 쪽과 같은 줄(비관)을 본다(확인 R2-M4). 2110년(94세)의 끝 줄에는 칩이 없고 2111년부터는 시대 줄이 없다
const logMock = () => `<section class="card log ew__log" aria-label="인생 기록(시안)"><div class="card__head" style="margin-bottom:var(--sp-2)"><h4 class="card__title">인생 기록</h4><span class="t-xs t-faint">시안 · 가짜 데이터 · 2016년생 가운데 구간 · 2065~2110 발췌</span></div><div class="log__list" style="max-height:none" role="region" aria-label="인생 기록"><ol class="log__rows">${plainRow(95, '손주가 오래된 사진을 함께 넘겨 보았습니다.', ' log__row--latest')}${endRow(94)}${dailyRow(U.U45, 93, 2109)}${plainRow(90, '같은 층 이웃이 요양 시설로 옮겼습니다.')}${dailyRow(U.U44, 88, 2104)}${eraRow(U.U43, 84)}${plainRow(81, '여름마다 짐을 꾸려 자식 집으로 갔습니다.')}${eraRow(U.U39, 79)}${projRow(74, 2090, '연금을 받는 나이가 다시 조정될 수도 있습니다.')}${eraRow(U.U35, 69)}${eraRow(U.U31, 59)}${plainRow(54, '둘째가 집을 떠나 혼자 살기 시작했습니다.')}${eraRow(U.U27, 49)}</ol></div></section>`;
const sceneMock = (q, year, { ftone = 'draft', end = false, age = 49 } = {}) => `<section class="card scene-card ew__scene" aria-label="집과 가족(시안)" data-ftone="${ftone}"${end ? ' data-end="true"' : ''}><div class="scene"><div class="scene__house">${BG}<p class="scene__year"><time datetime="${year}">${year}년</time></p></div><a class="era" href="#log-y${end ? 2110 : year}-${age}" data-era="${q.id}" data-dec="${q.decade}"${end ? '' : ' data-future="true"'} title="시대의 창 · ${q.line}"><span class="era__pic"${end ? '' : ' data-future="true"'} aria-hidden="true">${svgOf(q)}</span>${end ? '' : `<span class="era__fc" aria-hidden="true">${icon('i-ahead')}예측</span>`}<span class="sr-only">${end ? '' : '예측: '}${q.line} 그해 기록으로</span></a></div><p class="scene__line">${end ? '서울특별시 관악구 · 자식 집 · 아들 식구와 함께' : '서울특별시 관악구 · 전셋집 · 배우자와 아이 둘'}</p></section>`;

// ---------------------------------------------------------------- 시트 — 그림 칸
const KIND = { event: '그해의 사건', daily: '그 10년의 일상', base: '끝 장면' };
const tag = (q) => (q.kind === 'base' ? '끝 장면 · 칩 없음' : `${KIND[q.kind]} · 예측${q.heavy ? ' · ○' : ''} · <b>${MOOD[q.u]}</b>`);
const cap = (q, { full = true } = {}) => `<figcaption class="ew__cap"><span class="ew__year">${q.u} · ${q.kind === 'base' ? '2110년부터' : q.years ? `${q.years[0]}~${q.years[1]}년` : `${q.year}년`} <span class="ew__kindtag">${tag(q)}</span></span><span class="ew__name">${q.name}</span><span class="ew__band">누가 보나 · ${WHO(q)}${q.band ? `(${BAND_LABEL[q.band]}에서만)` : ''}</span><span class="ew__line">「${q.line}」(${q.line.length})</span><span class="ew__kind">${q.kind === 'base' ? '칩 없음' : `예측 · <b>${BASIS_LABEL[q.basis]}</b>`} — ${q.basisNote}</span>${full ? `<span class="ew__draws">${q.draws}</span><span class="ew__ft3">${q.ft3}</span>` : ''}</figcaption>`;
const fig = (q, { size = 'pc', full = true, mark = false } = {}) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-band="${q.band || ''}" data-size="${size}" data-tone="${TONE_ID}"><div class="ew__pic" data-dec="${decadeOf(q.year)}"${q.kind === 'base' ? '' : ' data-future="true"'}>${svgOf(q)}${mark && q.kind !== 'base' ? `<span class="era__fc">${icon('i-ahead')}예측</span>` : ''}</div>${size === 'mobile' ? `<figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}${q.heavy ? ' ○' : ''}</span></figcaption>` : cap(q, { full })}</figure>`;
const figBand = (q) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-size="band"><div class="ew__bandcell"><div class="ew__pic" data-dec="${decadeOf(q.year)}"${q.kind === 'base' ? '' : ' data-future="true"'}>${svgOf(q)}</div>${q.kind === 'base' ? '' : `<span class="era__fc">${icon('i-ahead')}예측</span>`}</div><figcaption class="ew__cap"><span class="ew__year">${q.u}${q.band ? ` <span class="ew__band">${q.band === 'low' ? '아래' : '위'}</span>` : ''}${q.kind === 'base' ? ' 표 없음' : ''}</span></figcaption></figure>`;
/** 짝 비교 칸 — 밑그림 톤을 입힌 175 칸(톤이 덮여도 대비가 남는지 보는 자리) */
const figToned = (q) => `<figure class="ew__fig" data-era="${q.id}" data-u="${q.u}" data-size="toned" data-ftone="draft"><div class="ew__pic" data-dec="${decadeOf(q.year)}" data-future="true">${svgOf(q)}</div><figcaption class="ew__cap"><span class="ew__year">${q.u} · 밑그림 톤 · <b>${MOOD[q.u]}</b></span></figcaption></figure>`;
const pickCell = (u) => `<td class="ew__pk" data-u="${u}">${u}</td>`;
const YEARS = Array.from({ length: 53 }, (_, i) => 2060 + i);
const pickTable = (keys) => `<div class="ew__tablewrap"><table><thead><tr><th scope="col">구간</th>${YEARS.map((y) => `<th scope="col" class="ew__pk">${y}</th>`).join('')}</tr></thead><tbody>${keys.map(([name, k]) => `<tr><th scope="row">${name}</th>${PICKS[k].map(pickCell).join('')}</tr>`).join('')}</tbody></table></div>`;
// r8 → r9 견주기(같은 주제의 옛 장은 r8 조각 파일을 그대로 보인다 — 저장소 안 상대 경로, 외부 요청 0)
const R8MAP = [['U27', 'era-2065-mind-transfer-counsel-hall', 'r8 U27 상담실 대기'], ['U28', 'era-2065-high-study-screen-key', 'r8 U28 서재'], ['U29', 'era-2060s-mobile-clinic-van', 'r8 U29 이동 진료 차량'], ['U30', 'era-2060s-half-dark-shop-street', 'r8 U30 반쯤 불 꺼진 상가'], ['U31', null, '새 사건(2075 노화) — r8에는 없음'], ['U32', null, '새 사건 — r8에는 없음'], ['U33', 'era-2070s-care-home-lounge', 'r8 U32 요양 시설 휴게실'], ['U34', 'era-2070s-office-grey-hair', 'r8 U33 흰머리 사무실(주제 바뀜: 노인이 사는 학교)'], ['U35', 'era-2085-big-crossing-crowd', 'r8 U34 2085 교차로(주제 바뀜: AI 이후)'], ['U36', null, '새 사건 — r8에는 없음'], ['U37', 'era-2080s-heat-closed-street', 'r8 U36 폭염 골목(주제 바뀜: 에너지 전환)'], ['U38', 'era-2080s-classroom-sparse-desks', 'r8 U35 교실(주제 바뀜: 두 진영 항만)'], ['U39', 'era-2095-gym-shelter-rain', 'r8 U37 체육관 대피소 ○'], ['U40', 'era-2095-high-hill-housing-floodwall', 'r8 U38 언덕 위 단지'], ['U41', 'era-2090s-night-work-street', 'r8 U40 밤의 작업장'], ['U42', 'era-2090s-coast-road-sandbags', 'r8 U39 모래주머니 해안 도로'], ['U43', 'era-2100-old-map-shoreline', 'r8 U41 2100 지도 종이(주제 바뀜: 인구 절반)'], ['U44', 'era-2100s-noon-empty-street-shade', 'r8 U42 빈 거리(주제 바뀜: 우주 정거장)'], ['U45', 'era-2100s-rotating-crops-plots', 'r8 U43 밭(주제 바뀜: 화면 속 사람)'], ['U46', 'era-end-horizon', 'r8 U44 수평선']];
const R8 = Object.fromEntries(S8.map((q) => [q.id, q]));
const r8cell = (id, cap) => { const q = id && R8[id]; return `<figure class="ew__fig ew__r8" data-r8="${id || ''}">${q ? `<div class="ew__pic" data-dec="${decadeOf(q.year)}">${svgOf(q)}</div>` : ''}<figcaption class="ew__cap"><span class="ew__kindtag">${cap}</span></figcaption></figure>`; };
const compareRow = ([u, id, cap]) => `<div class="ew__cmp" data-u="${u}">${r8cell(id, cap)}<span class="ew__arrow" aria-hidden="true">→</span>${fig(U[u], { full: false })}</div>`;

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 9차 — 미래 연표 묶음 C 다시 그리기(SPEC-010 r2 개정안, 승인 전)</title>
<!-- 시안(정적 HTML) — SPEC-010 시대의 창 9차(2060~2109 19장 + 끝 장면 1장, r8 18장 폐기 · 확정된 「예측」 칩 안 B·미래 톤 안 1 적용). 생성 scripts/design/buildEraWindowR9.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음, 글자·로고·국기·지도 0), 승인 전(approved: false). -->
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
.ew__grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-4); }
.ew__grid .ew__fig { display: grid; grid-template-columns: 175px minmax(0, 1fr); gap: 0 var(--sp-4); align-items: start; }
.ew__grid .ew__pic, .ew__grid3 .ew__pic, .ew__grid4 .ew__pic, .ew__cmp .ew__pic { width: 175px; height: 140px; }
.ew__grid3 .ew__fig, .ew__grid4 .ew__fig { width: 100%; }
.ew__grid .ew__cap { margin-top: 0; }
@media (max-width: 1023px) { .ew__grid { grid-template-columns: minmax(0, 1fr); } .ew__grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 767px) { .ew__grid3 { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 479px) { .ew__grid .ew__fig { grid-template-columns: minmax(0, 1fr); } .ew__grid .ew__cap { margin-top: var(--sp-2); } .ew__grid4 { grid-template-columns: minmax(0, 1fr); } }
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
/* r8 → r9 견주기 */
.ew__cmpgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-5) var(--sp-8); }
@media (max-width: 1023px) { .ew__cmpgrid { grid-template-columns: minmax(0, 1fr); } }
.ew__cmp { display: grid; grid-template-columns: 175px auto minmax(0, 1fr); gap: var(--sp-3); align-items: start; min-width: 0; }
@media (max-width: 479px) { .ew__cmp { grid-template-columns: minmax(0, 1fr); } .ew__arrow { display: none; } }
.ew__r8 .ew__pic { width: 175px; height: 140px; }
.ew__arrow { align-self: center; color: var(--c-text-2); font-size: var(--fs-lg); }
${toneCssA('.ew')}
${futureToneCss('.ew')}
${chipCss()}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}${ICON_ERA}${ICON_PROJ}${ICON_YEAR}${ICON_AHEAD}</defs></svg>
<main class="ew">
<h1>시대의 창 9차 — 미래 연표 묶음 C 다시 그리기</h1>
<p class="ew__lead">2060년부터 2109년까지 열아홉 장(U27~U45)과 2110년부터 계속 보이는 끝 장면 한 장(U46)입니다. 8차 열여덟 장은 형진 님 피드백(「미래에 엄청난 일이 일어나는구나라고 느낄 수 있게, 비관이든 낙관이든 그 상황이 제대로 보이게」)으로 폐기하고, SPEC-010 r2 개정안의 새 줄 스무 개에 맞춰 전부 다시 그렸습니다. 한 장면만 봐도 세상이 크게 바뀐 것이 읽히도록 작은 소품 대신 규모(도시 전경·거대한 구조물·비어 버린 마을 전체·줄지어 떠나는 사람들·화면으로 가득 찬 홀)로 그렸고, 같은 해의 수저별 짝 넷(2065·2075·2085·2095)은 같은 구도 뼈대로 나란히 두어 「같은 시점, 다른 운명」이 한눈에 읽히게 했습니다. 「예측」 칩과 밑그림 톤은 묶음 A에서 정해진 대로 적용된 모습만 보이고, 끝 장면에는 칩·표·톤이 없습니다. 스무 장 모두 승인 전입니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r9.html">라이트</a><a href="era-window-r9.html?theme=dark">다크</a><a href="era-window-r8.html">8차 시트(폐기)</a><a href="era-window-r7.html">7차 시트(묶음 B)</a><a href="era-window-r6.html">6차 시트(묶음 A)</a></nav>

<h2 id="applied">확정된 칩·톤이 적용된 모습</h2>
<p class="ew__note">왼쪽 위는 2065년 가운데 구간의 집과 가족 카드 — PC 폭과 휴대폰 폭(360) 둘 다, 시대의 창 칸에 밑그림 톤과 「예측」 표(PC는 그림 왼쪽 위, 휴대폰 띠는 그림 옆). 왼쪽 아래는 표 끝 뒤인 2111년의 카드 — 끝 장면에는 표도 톤도 없습니다. 오른쪽은 2016년생 가운데 구간의 2065~2110 인생 기록 발췌(가짜 데이터)입니다. 가운데 구간은 부유한 쪽 그림을 보지 않으므로 사건 해마다 어려운 쪽과 같은 줄(비관)이 나옵니다. 2109년까지의 시대 줄에는 모두 칩과 근거 종류가 붙고, 2110년의 끝 줄은 표지만 있으며, 2111년부터는 시대 줄이 없습니다. 2090년의 「전망」 줄은 경제 칸의 기존 칩이라 색·아이콘·모양이 다릅니다.</p>
<div class="ew__applied" data-applied><div class="ew__appliedcol"><p class="ew__note ew__note--tight">PC 폭 — 2065년</p>${sceneMock(U.U27, 2065)}<p class="ew__note ew__note--tight">휴대폰 폭 360 — 띠 모양, 표는 그림 옆</p><div class="ew__phone">${sceneMock(U.U27, 2065)}</div><p class="ew__note ew__note--tight">표 끝 뒤 — 2111년(끝 장면, 표·톤 없음)</p>${sceneMock(U.U46, 2111, { end: true, age: 95 })}</div>${logMock()}</div>

<h2 id="bands">같은 해, 다른 운명 — 2065 · 2075 · 2085 · 2095</h2>
<p class="ew__note">사건 해마다 어려운 쪽·가운데가 보는 장(비관, 왼쪽)과 부유한 쪽만 보는 장(낙관, 오른쪽)을 같은 구도 뼈대로 나란히 두었습니다. 왼쪽 둘은 그림 그대로, 오른쪽 둘은 게임에서 보이는 밑그림 톤(채도를 낮춘 필터)을 입힌 모습입니다 — 톤이 덮여도 어두운 덩어리 ↔ 밝은 면의 명암 대비가 남는지 봐 주세요.</p>
<h3>2065년 — 의식을 옮긴 디지털 인간: 진열된 윤곽 스물넷 ↔ 식탁의 한 자리</h3>
<div class="ew__grid4" data-pair="2065">${fig(U.U27, { full: false })}${fig(U.U28, { full: false })}${figToned(U.U27)}${figToned(U.U28)}</div>
<h3>2075년 — 노화의 끝: 차단된 다리 이쪽의 노인들 ↔ 노인이 앉지 않는 공원</h3>
<div class="ew__grid4" data-pair="2075">${fig(U.U31, { full: false })}${fig(U.U32, { full: false })}${figToned(U.U31)}${figToned(U.U32)}</div>
<h3>2085년 — AI 이후: 일자리 없는 광장의 줄 ↔ 일하지 않는 테라스</h3>
<div class="ew__grid4" data-pair="2085">${fig(U.U35, { full: false })}${fig(U.U36, { full: false })}${figToned(U.U35)}${figToned(U.U36)}</div>
<h3>2095년 — 바다가 들어오는 땅: 잠긴 동네를 떠나는 줄 ○ ↔ 방벽 안의 도시</h3>
<div class="ew__grid4" data-pair="2095">${fig(U.U39, { full: false })}${fig(U.U40, { full: false })}${figToned(U.U39)}${figToned(U.U40)}</div>

<h2 id="daily">그 10년의 일상 — 10년마다 둘, 그 시대만의 새 풍경</h2>
<p class="ew__note">2060년대부터는 수저 변주 없이 세 구간이 같은 두 장을 번갈아 봅니다(같은 그림 연속은 최대 2해). r8의 일상은 생활 속 작은 변화였고, 이번에는 10년마다 세상이 바뀐 풍경 둘입니다 — 빈 마을 · 무인 공장 · 로봇 돌봄 · 노인이 사는 학교 · 바람과 햇빛 · 두 진영의 항만 · 밤의 도시 · 바닷물이 드는 길 · 우주 정거장 · 화면 속 사람.</p>
<h3>2060년대</h3><div class="ew__grid3" data-pair="2060s">${fig(U.U29, { full: false })}${fig(U.U30, { full: false })}</div>
<h3>2070년대</h3><div class="ew__grid3" data-pair="2070s">${fig(U.U33, { full: false })}${fig(U.U34, { full: false })}</div>
<h3>2080년대</h3><div class="ew__grid3" data-pair="2080s">${fig(U.U37, { full: false })}${fig(U.U38, { full: false })}</div>
<h3>2090년대</h3><div class="ew__grid3" data-pair="2090s">${fig(U.U41, { full: false })}${fig(U.U42, { full: false })}</div>
<h3>2100년대</h3><div class="ew__grid3" data-pair="2100s">${fig(U.U44, { full: false })}${fig(U.U45, { full: false })}</div>

<h2 id="y2100">2100년 — 모두 같은 한 장</h2>
<p class="ew__note">2100년은 수저 구간 분기가 없습니다. 「${U.U43.line}」 — 가림막과 크레인에 둘러싸인 빈 타워 넷과 아직 불 켜진 건너편 단지(철거는 가림막과 크레인까지, 무너지는 순간·먼지 0).</p>
<div class="ew__grid3" data-pair="2100">${fig(U.U43, { full: false })}</div>

<h2 id="end">끝 장면 — 2110년부터</h2>
<p class="ew__note">표는 2109년에서 끝납니다. 2110년에 「${U.U46.line}」 줄이 한 번 나오고, 2111년부터는 줄 없이 이 그림만 판이 끝날 때까지 보입니다. 칩·표·톤이 없고 사람·건물·사건도 없습니다. r8의 수평선 하나 대신 새벽빛 속에서 가로등이 줄지어 작아지다 수평선에서 사라지는 긴 해안 길 — 「한 세기가 지나갔다」는 무게가 느껴지는지 봐 주세요.</p>
<div class="ew__grid3" data-pair="end">${fig(U.U46, { full: false })}</div>

<h2 id="compare">8차 → 9차 견주기</h2>
<p class="ew__note">왼쪽이 폐기한 8차 장(같은 주제나 같은 자리의 장 — 주제가 바뀐 곳은 적어 두었습니다), 오른쪽이 9차 장입니다. 8차 열여덟 장 가운데 2078·2085(세계 인구)·교실·폭염 골목·지도 종이·빈 거리·밭 일곱 장은 r2 개정안에서 빠졌고, 2075 노화 둘·2085 AI 둘·2100 인구·우주·화면 속 사람 일곱 장이 새로 들어왔습니다.</p>
<div class="ew__cmpgrid" data-compare>${R8MAP.map(compareRow).join('')}</div>

<h2 id="pieces">스무 장 — U27~U46</h2>
<p class="ew__note">그림은 톤 없이(있는 그대로) 보입니다. 밑그림 톤이 입혀진 모습은 위 「적용된 모습」·「같은 해, 다른 운명」의 오른쪽 둘·아래 「휴대폰 띠」에서 봐 주세요. 캡션의 「그리는 것」은 r2 개정안 표의 문장을 바탕으로 실제로 그린 것을, 「유지선」은 수위 판단을, 굵은 글씨는 읽히는 방향(비관·낙관·중립)을 적었습니다.</p>
<div class="ew__grid" data-tone="${TONE_ID}">${S9.map((q) => fig(q)).join('')}</div>

<h2>크게 보기 350×280 — 스무 장</h2>
<p class="ew__note">디테일 확인용입니다. 게임에는 이 크기가 없습니다.</p>
<div class="ew__zoom" data-tone="${TONE_ID}">${S9.map((q) => fig(q, { full: false })).join('')}</div>

<h2 id="strips">휴대폰 띠 크기 100×80</h2>
<p class="ew__note"><b>톤 없음(그림 그대로)</b></p><div class="ew__strip" data-tone="${TONE_ID}" data-strip="plain">${S9.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤(확정 안 1)</b> — 끝 장면(U46)은 해로 정하는 규칙 때문에 톤이 걸리지 않습니다. 규모로 그린 장면이 100×80에서도 읽히는지(화면 벽 · 강과 다리 · 광장의 줄 · 잠긴 지붕들 · 방벽) 봐 주세요.</p><div class="ew__strip" data-ftone="draft" data-strip="draft">${S9.map((q) => fig(q, { size: 'mobile' })).join('')}</div>
<p class="ew__note"><b>밑그림 톤 + 창 표(확정 안 B) — 휴대폰 띠 326×80에서의 자리</b>: 그림 옆 띠 바탕 위라 그림을 가리지 않습니다(PC에서는 그림 왼쪽 위 — 위 「적용된 모습」). 끝 장면에는 표가 없습니다.</p><div class="ew__strip ew__strip--band" data-ftone="draft" data-strip="draft-mark">${S9.map((q) => figBand(q)).join('')}</div>

<h2>번호 · 해 · 누가 보나 · 줄 · 읽힘 · 근거 · 실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">번호</th><th scope="col">해</th><th scope="col">누가 보나</th><th scope="col">줄(자)</th><th scope="col">읽힘</th><th scope="col">칩 · 근거 칸</th><th scope="col" class="num">조각(use)</th><th scope="col" class="num">gzip</th><th scope="col" class="num">상한</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${x.u}${x.heavy ? ' ○' : ''}</td><td>${x.kind === 'base' ? '2110~' : x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`}</td><td>${x.who}${x.band ? ` <span class="ew__band">${x.band}</span>` : ''}${x.kind === 'daily' ? ' · 일상' : x.kind === 'base' ? ' · 끝 장면' : ''}</td><td>${x.line} (${x.lineChars})</td><td>${x.mood}</td><td>${x.forecast ? `예측 · ${x.basisLabel}` : '없음'}</td><td class="num">${x.shapes}(${x.uses})</td><td class="num">${x.gz}B${x.overLimit ? ' · 상한 초과' : ''}</td><td class="num">${x.limit}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">스무 장 합계 gzip ${sum(rows, 'gz').toLocaleString('ko-KR')}B · 장당 평균 <strong>${budget.gzEachAvg}B</strong>(최소 ${budget.gzEachMin} · 최대 ${budget.gzEachMax}; 사건 ${events.length}장 평균 ${budget.gzEventsAvg} · 일상 ${dailies.length}장 평균 ${budget.gzDailyAvg}) — 상한 사건 3,500B(○ 포함)·일상 2,500B 안(초과 ${budget.overLimit.length}). 새 10년 덩어리(한 줄·공유 defs·토큰 CSS 포함, 보수적): ${decades.map((d) => `${d.label.replace(/\(.*$/, '')} ${d.withDefs.toLocaleString('ko-KR')}B(r2 어림 ${d.specEstimate.toLocaleString('ko-KR')} ${d.underEstimate ? '안' : '초과'})`).join(' · ')} — 모두 10년 덩어리 한도 24,000B 안. <strong>묶음 C 몫 ${futureAdded.total.toLocaleString('ko-KR')}B</strong>(마스터 한도 60,000B의 ${Math.round((futureAdded.total / BUDGET.bundleC) * 100)}% · r2 어림 57,250B · r8은 32,153B). 2027년 이후가 늘린 양: 묶음 A+B 35,170B + C = <strong>${futureAdded.allBundles.toLocaleString('ko-KR')}B</strong>(상한 98,700B · 목표 80,000B). 누적 추정 ${lazyBefore.toLocaleString('ko-KR')}B → ${budget.lazyEst.after.toLocaleString('ko-KR')}B(≤ 230,000B). 근거 칸: 공식 전망 바탕 ${BASIS_COUNT.official} · 전문가 전망 바탕 ${BASIS_COUNT.expert} · 가상 시나리오 ${BASIS_COUNT.scenario} · 없음(끝 장면) ${BASIS_COUNT.none}. 읽힘: 비관 ${MOOD_COUNT.비관} · 낙관 ${MOOD_COUNT.낙관} · 중립 ${MOOD_COUNT.중립} · 끝 장면 1. 정본 수치는 <code>era-window-r9-budget.json</code>.</p>

<h3>고르기 흉내 — 2060~2112 해마다 구간별로 보는 그림(10-1·8-2절 + 구현 규칙 1~3·5)</h3>
${pickTable([['어려운 쪽', 'low'], ['가운데', 'mid'], ['부유한 쪽', 'high']])}
<p class="ew__note">세 구간 × 2060~2109에 그림이 닿고 같은 그림이 3해 연속 나오지 않습니다(생성기가 단언). 2065·2075·2085·2095는 부유한 쪽만 U28·U32·U36·U40, 2100은 모두 U43, 2110년부터는 세 구간 모두 끝 장면 U46(일부러 같은 그림)입니다.</p>
<h3>가리기를 켰을 때(○ U39만 바뀐다)</h3>
${pickTable([['어려운 쪽', 'low-gentle'], ['가운데', 'mid-gentle'], ['부유한 쪽', 'high-gentle']])}
<p class="ew__note">가리기를 켜면 2095년의 어려운 쪽·가운데가 U39 대신 그 10년의 일상(U41·U42 가운데 앞 두 해와 겹치지 않는 것)을 보고 줄은 가려집니다. 부유한 쪽의 U40은 ○가 아니라 그대로입니다.</p>

<h2 id="mismatch">그림과 줄이 안 맞는 곳 — 줄은 바꾸지 않고 장면을 맞추거나 대안만 적는다</h2>
<ol class="ew__list">
<li><b>U38 「미·중 두 진영으로 세계가 갈렸습니다.」</b> — r2 개정안 표의 줄(「세계가 서로 닫힌 시장으로 갈렸습니다.」) 대신 마스터가 전한 형진 님 답의 줄을 썼습니다. 「미·중」은 그림에 국기·지도·군사 장비·나라 상징으로 옮기지 않고(마스터 지시) <b>한가운데의 높은 울타리와 섞이지 않는 두 색 묶음</b>으로만 보입니다. 이 줄은 나라 이름 허용 줄(장 배치 규칙)에 더해야 하고(개정안 반영 때 「한국」과 함께), 시험 목록 <code>COUNTRY_NAMES</code>에 「미국」·「중국」이 있다면 「미·중」 표기가 걸리는지 developer가 확인해야 합니다.</li>
<li><b>U27 「…거래됐습니다.」</b> — 원안 그대로(형진 님 답). 표의 「칸 밑에 빈 가격판」은 그렸지만 175×140에서는 칸 밑의 가는 띠로만 보입니다. 윤곽은 스물넷 모두 같은 꼴이고 시술·기기는 없습니다.</li>
<li><b>U31 「늙는 쪽과 늙지 않는 쪽으로 갈렸습니다.」</b> — 표의 「강 건너 환한 신도시 · 열쇠 표지 · 차단 막대」대로. 나이는 흰머리·지팡이·휠체어(왼쪽)와 곧은 걸음(오른쪽)으로만 가르고 얼굴 비교는 없습니다. 「갈렸다」가 한 장에서 읽히도록 강을 가운데 세로로 두고 다리의 막대를 <b>양쪽 끝</b>에 내렸습니다(표는 「차단 막대」 하나).</li>
<li><b>U35 「AI가 일자리 대부분을 맡았습니다.」</b> — 표의 「수백 명」은 먼 인물 백 명 남짓 + 앞줄 뒷모습 열다섯으로(패턴 띠는 줄무늬로 읽혀 쓰지 않았다). 건물 창의 로봇 팔은 일반형 L자 윤곽입니다. 경제 장면이라 가리기 대상이 아닙니다(r2 메모 ②).</li>
<li><b>U39 ○ 「물에 잠긴 동네를 사람들이 떠났습니다.」</b> — 현장까지: 물은 평평하고 줄은 질서 있게 버스로 이어집니다. 표의 「아이 손」은 줄 속의 작은 인물로만(손을 잡은 모양은 심볼이 없어 나란히 선 것으로).</li>
<li><b>U43 「한국 인구가 지금의 절반으로 줄었습니다.」</b> — 「한국」은 그림에 지도·국기·한글로 옮기지 않았습니다(나라 지도 0). 「절반」은 빈 타워 넷 ↔ 켜진 단지의 대비로만. 이 줄도 나라 이름 허용 줄에 더해야 합니다.</li>
<li><b>U46 끝 장면</b> — 표의 「가로등 줄의 긴 해안 길」대로. 끝 줄 「한 세기」(84해)의 어림 표현은 확인 R2-M6에 걸려 있고, 그림은 그 답과 무관하게 쓸 수 있습니다.</li>
<li><b>주인공 행동 낱말(구현 규칙 6)</b> — 이 묶음의 20줄 중 목록(갔·탔·샀·받았·일했·출근·퇴근·배웠·먹었·마셨)에 걸리는 줄 ${warnings.length}개${warnings.length ? ` — ${warnings.join(' / ')}` : '(「떠났」·「갈렸」·「바뀌었」은 「갔」을 품지 않는다)'}.</li>
</ol>

<h2>developer 인계(승인 뒤 — 이번에도 src를 건드리지 않았다)</h2>
<ol class="ew__rule">
<li>r8 조각·실측은 쓰지 않는다(폐기 — <code>genEraWindows.ts</code> <code>META</code>에 r8을 넣지 않았다면 그대로, 넣었다면 뺀다). 조각 <code>pieces/era-r9/</code> 20 + <code>era-window-r9-budget.json</code>(행에 <code>basis</code>·<code>u</code>·<code>forecast</code>·<code>years</code>·<code>band</code>·<code>heavy</code>·<code>mood</code>) → <code>META</code>에 r9 추가, 승인 장수 가드 120 → <b>140</b>(승인된 장만). 새 <code>d2060.ts</code>(4)·<code>d2070.ts</code>(4)·<code>d2080.ts</code>(4)·<code>d2090.ts</code>(4)·<code>d2100.ts</code>(4 — 끝 장면 포함), <code>ERA_DECADE_LOADERS</code>·<code>ERA_DECADES_WITH_DATA</code>에 2060~2100.</li>
<li>끝 장면 U46: <code>kind: 'base'</code> · id <code>era-end-horizon</code> · <code>years [2110, 2130]</code> · <b><code>decade = 2100</code> 고정</b>(R-602) · <code>basis</code> 없음 · 칩·표·톤 없음(해로 정한다). 2110년에 끝 줄 한 번, 2111년부터 줄 없음(<code>eraRowsOf</code>).</li>
<li>사건 <code>band</code>: 2065 U28 · 2075 U32 · 2085 U36 · 2095 U40은 <code>band: 'high'</code>, 같은 해의 U27·U31·U35·U39는 band 없음(구현 규칙 5 — 개정안 반영 항목 3). ○는 <b>U39 하나</b>(<code>heavy: true</code>) — 가리기 켜면 2090년대 일상(U41·U42)으로. 2100 U43은 모두 같은 그림. 일상은 10년마다 band 없음 2장.</li>
<li>줄 규칙: 나라 이름 허용 줄에 U38 「미·중」·U43 「한국」을 더한다(개정안 반영 항목 6). 칩·톤·아이콘·글자는 11-7절 그대로 — 새 토큰·심볼·패턴·아이콘 0. 새 줄 20개의 글자는 FU6 글꼴 조각(s2·s3)을 다시 만든다. FU11 근거 글은 <code>docs/data/future-foresight-quotes.md</code>의 옛 번호 행 재사용 + 부유한 쪽 장(U28·U32·U36·U40)에 「수저별 차이는 게임의 설정입니다.」 + 의식 이전(U27·U28)·노화(U31·U32)에 반대 근거 한 건. 새 조사 표시(U33·U37·U40·U43·U44)는 마스터 결정(R2-M8)에 따른다.</li>
</ol>

<h2>형진 님께 묻는 것</h2>
<ol class="ew__ask">
<li><b>수저별 짝 넷(2065 · 2075 · 2085 · 2095)</b> — 왼쪽(어려운 쪽·가운데, 비관)과 오른쪽(부유한 쪽, 낙관)이 밑그림 톤을 입힌 175×140·휴대폰 100×80에서도 「같은 시점, 다른 운명」으로 읽히는지. 특히 U27 거래 홀의 윤곽 스물넷(얼굴 0·가격 숫자 0)이 지나치지 않은지.</li>
<li><b>규모로 그린 사건 다섯(U27 · U31 · U35 · U39 ○ · U43)</b> — 「세상이 크게 바뀌었다」가 한 장에서 읽히는지, 공포 연출(붉은 하늘·무너지는 순간·충돌) 없이 비관이 충분한지. 반대로 낙관 다섯(U28 · U32 · U36 · U40 · U44)이 과시로 읽히지는 않는지.</li>
<li><b>스무 장 사건별 승인</b> — 끝 장면 U46(가로등 줄의 해안 길 — 2110년부터 판이 끝날 때까지 계속 보인다)이 「한 세기가 지나갔다」로 읽히는지, 일상 열 장(10년마다 둘)이 반복돼도 거슬리지 않는지, U38 두 진영 항만(국기·지도 없이 울타리와 두 색 묶음)이 「미·중」으로 충분한지.</li>
</ol>
</main>
</body>
</html>
`;
write('era-window-r9.html', html);

console.log(`시대의 창 r9: ${rows.length}장(사건 ${budget.events} · 일상 ${budget.daily} · 끝 ${budget.base} · ○ ${budget.heavy}) · 예측 ${budget.forecast}장(공식 ${BASIS_COUNT.official} · 전문가 ${BASIS_COUNT.expert} · 시나리오 ${BASIS_COUNT.scenario}) · 읽힘 비관 ${MOOD_COUNT.비관} 낙관 ${MOOD_COUNT.낙관} 중립 ${MOOD_COUNT.중립} · 장당 gzip 평균 ${budget.gzEachAvg}B(최소 ${budget.gzEachMin} 최대 ${budget.gzEachMax}; 사건 평균 ${budget.gzEventsAvg} · 일상 평균 ${budget.gzDailyAvg}) · defs ${defsGz}B + css ${cssGz}B`);
for (const x of rows) console.log(`${x.u} ${x.kind === 'base' ? '2110~' : x.years[0] === x.years[1] ? x.year : `${x.years[0]}~${x.years[1]}`} ${x.id}: ${x.band ? `(${x.band}) ` : ''}${x.heavy ? '○ ' : ''}${x.mood} · 조각 ${x.shapes}(use ${x.uses}) · gz ${x.gz}/${x.limit}${x.overLimit ? ' !!상한' : ''} · 「${x.line}」(${x.lineChars}) · ${x.basisLabel || '칩 없음'}`);
for (const d of decades) console.log(`${d.label}: ${d.withDefs}B(덩어리 ${d.chunkGz}, r2 어림 ${d.specEstimate} ${d.underEstimate ? '안' : '초과'})${d.overMax ? ' !!24KB' : ''}`);
console.log(`묶음 C 몫 ${futureAdded.total}B(≤ 60,000 · r2 어림 57,250 · r8 32,153) · A+B+C ${futureAdded.allBundles}B(≤ 98,700 · 목표 80,000) · 누적 추정 ${budget.lazyEst.after}B`);
for (const k of Object.keys(PICKS)) console.log(`고르기 ${k}: ${PICKS[k].join(' ')}`);
for (const p of PAIRS) console.log(`대비 ${p.name}: 라이트 ${p.light} · 다크 ${p.dark} (≥ ${p.min})`);
for (const w of warnings) console.warn(`!! ${w}`);

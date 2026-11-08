// QF2·QF3 실제 화면: 1995~2010년생이 한 판을 끝까지 산다(자동 8배속, ?__timescale) — 해마다 창 장면 id·인생 기록 시대 줄을 기록하고 규칙을 점검한다.
// 사용: QA_BASE=... node qa/scripts/012/life-run.mjs <세대 millennial|genz> <재력 1~5> <gentle 0|1> [시작 나이=0] [timescale=30] [engine]
import { chromium, webkit, newPage, evalCore, inject, BASE } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const [gen = 'genz', W = '3', gentle = '0', startAge = '0', ts = '30', eng = 'chromium'] = process.argv.slice(2);
const wealth = Number(W);
const A = { 'era-1946-well-side': 7, 'era-1948-polling-queue': 21, 'era-1953-tent-school': 7, 'era-1954-relief-queue': 7, 'era-1970s-low-kerosene-room': 13, 'era-1972-briquette-dawn': 13, 'era-1981-hillside-village': 13, 'era-1990s-high-newtown-living': 7, 'era-1993-exam-gate-dawn': 13, 'era-2000-pc-bang': 13, 'era-2001-folder-phones-stop': 13, 'era-2009-first-smartphone': 13, 'era-2019-vertical-video': 13, 'era-2020s-wfh-table': 7, 'era-2021-empty-classroom-online': 7, 'era-2024-chat-bubbles': 13, 'era-2025-timetable-desk': 7, 'era-2000s-tteokbokki-stand': 7 };
const { browser, page, errors } = await newPage(eng === 'webkit' ? webkit : chromium, { width: 1280, height: 800 });
await page.goto(BASE + '/');
const found = await evalCore(page, `
  let best = null;
  for (let seed = 1; seed < 4000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.gen)));
    if (s.character.parentWealth !== arg.W) continue;
    const by = s.character.birthYear; if (by < 1995 || by > 2010) continue;
    const start = s; const snaps = {};
    let maxAge = 0;
    while (s.phase === 'life') {
      if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
      if (snaps[s.age] === undefined) snaps[s.age] = { ...s, paused: false };
      maxAge = Math.max(maxAge, s.age);
      s = core.stepYear(s).state;
    }
    if (best === null || maxAge > best.maxAge) best = { seed, maxAge, birthYear: by, snap: snaps[arg.startAge] ?? snaps[0], regionKey: start.birthReport.region };
    if (maxAge >= 90) break;
  }
  return best;`, { gen, W: wealth, startAge: Number(startAge) });
if (!found) { console.log('no seed'); process.exit(1); }
const st = found.snap; delete st.play;
console.log(`seed ${found.seed} 출생 ${found.birthYear} 최대 ${found.maxAge}세 지역 ${found.regionKey} 재력 ${wealth} gentle ${gentle} 시작 나이 ${startAge}`);
const REC = `(() => {
  const rec = {}; window.__rec = rec; window.__rows = [];
  const snap = () => {
    const yrTxt = document.querySelector('.scene__year time')?.textContent ?? ''; const yr = Number(yrTxt.replace(/[^0-9]/g, '')); if (!yr) return;
    const era = document.querySelector('#scene-era');
    const age = (document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^0-9]/g, '');
    rec[yr] = { era: era?.getAttribute('data-era') ?? null, empty: era?.getAttribute('data-empty') ?? null, hidden: era?.getAttribute('data-hidden') ?? null, kind: era?.getAttribute('data-kind') ?? null, age };
    const rows = [...document.querySelectorAll('[data-tl="era"]')].map((r) => ({ id: r.id, line: r.querySelector('.log__sent')?.textContent ?? r.textContent.slice(0, 60), veiled: r.getAttribute('data-veiled') }));
    if (rows.length >= window.__rows.length) window.__rows = rows;
  };
  const start = () => { new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); snap(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;
await page.addInitScript(REC);
await inject(page, st, { speed: 8, autoMode: true, noteCards: false, gentle: gentle === '1' }, `/?__timescale=${ts}`);
const t0 = Date.now(); let ended = false;
while (Date.now() - t0 < 560000) {
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
  await page.waitForTimeout(500);
}
const rec = await page.evaluate(() => window.__rec).catch(() => ({}));
const rows = await page.evaluate(() => window.__rows).catch(() => []);
const years = Object.keys(rec).map(Number).sort((a, b) => a - b);
const by = found.birthYear;
const issues = [];
// 1) 미래 한 장면 한 번 (창)
const seenEra = new Map();
for (const y of years) { const r = rec[y]; if (y >= 2027 && y <= 2109 && r.era && r.empty !== 'true') { if (seenEra.has(r.era)) issues.push(`창 되풀이 ${r.era} ${seenEra.get(r.era)}→${y}`); seenEra.set(r.era, y); } }
// 2) 미래 줄 되풀이(문장)
const seenLine = new Map(); let futureRows = 0;
for (const r of rows) { const y = Number(r.id.replace(/\D/g, '')); if (y >= 2027 && y <= 2109) { futureRows++; if (seenLine.has(r.line)) issues.push(`줄 되풀이 "${r.line}" ${seenLine.get(r.line)}→${y}`); seenLine.set(r.line, y); } }
// 3) 나이 규칙: 부록 A
for (const y of years) { const r = rec[y]; const age = y - by; if (r.era && A[r.era] !== undefined && age < A[r.era]) issues.push(`나이 ${age}세(${y}) 창에 ${r.era}(최소 ${A[r.era]})`); }
// 4) 어린이 창·줄 목록
const kid = years.filter((y) => y - by <= 12).map((y) => `${y - by}세(${y}):${rec[y].era ?? (rec[y].empty === 'true' ? '빈틀' : '-')}${rec[y].hidden === 'true' ? '[가림]' : ''}`);
const kidRows = rows.filter((r) => Number(r.id.replace(/\D/g, '')) - by <= 12).map((r) => `${Number(r.id.replace(/\D/g, '')) - by}세:${r.line}`);
// 5) 창과 줄의 일치(가리지 않을 때): 창이 있는 해(빈 틀 아님)에 줄, 창 빈 해에 줄 없음
const rowYears = new Set(rows.map((r) => Number(r.id.replace(/\D/g, ''))));
let mismatch = 0; const mmYears = [];
if (gentle !== '1') for (const y of years) { if (y > 2109) continue; const r = rec[y]; const has = r.empty !== 'true' && r.era; if (!!has !== rowYears.has(y) && y - by >= 0) { mismatch++; mmYears.push(y + ":" + JSON.stringify(rec[y])); } }
const emptyFuture = years.filter((y) => y >= 2027 && y <= 2109 && rec[y].empty === 'true').length;
const sceneFuture = years.filter((y) => y >= 2027 && y <= 2109 && rec[y].era && rec[y].empty !== 'true').length;
const key = `${gen}-W${W}-g${gentle}-${eng}`;
console.log(`${key}: 끝남 ${ended}, 기록한 해 ${years[0]}~${years.at(-1)}(${years.length}/${(years.at(-1) - years[0] + 1)}), 미래 창 ${sceneFuture} 빈 틀 ${emptyFuture}, 미래 시대 줄 ${futureRows}, 창↔줄 불일치 ${mismatch} ${mmYears.join(";")}, errors ${errors.length} ${errors.slice(0, 2)}`);
console.log('문제:', issues.length ? issues.join(' | ') : '없음');
console.log('어린이 창:', kid.join(' '));
console.log('어린이 줄:', kidRows.join(' | '));
mkdirSync('qa/scripts/012/out', { recursive: true });
writeFileSync(`qa/scripts/012/out/run-${key}.json`, JSON.stringify({ found: { seed: found.seed, birthYear: by, maxAge: found.maxAge }, rec, rows, issues }, null, 0));
await browser.close();

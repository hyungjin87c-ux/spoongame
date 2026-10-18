// QA-003 M7a 회귀(M5 영향 줄 「표기 = 실제」 표본): 새 영유아 선택지 카드에서 같은 저장·같은 난수로 선택지를 하나씩 눌러 스탯 변화(화면 상태 바가 읽는 저장값)를 모으고,
// 쌍마다 차이가 화면에 보인 영향 줄(칸 수) 범위 안인지 본다. 같은 카드의 해마다 규칙은 선택지와 상관없이 같아 차이에서 지워진다.
// 칸 → 크기(M5 7절): 1칸 1~2, 2칸 3~6, 3칸 7~. 항목 없음 = 0. 자연 변화 차이를 위해 ±1 여유. 집안 살림은 순서(칸 수·방향)가 같은 방향인지만 본다.
// 사용: node qa/scripts/m7a-impact.mjs [filterRegex] [workers=2]   결과: qa/results/m7a/impact.jsonl, 케이스 M7a-R05
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7A, runCase, shot } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const filter = new RegExp(process.argv[2] || '^w-.*-(present)-t(1|5)$');
const workers = Number(process.argv[3] || 2);
const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const names = Object.keys(craft).filter((n) => filter.test(n));
const outFile = path.join(OUT, RP + 'impact.jsonl');
fs.writeFileSync(outFile, '');
const browser = await launch();
const gameOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);

async function runChoice(name, idx) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: craft[name].raw, [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(250);
  const card = await page.evaluate(() => ({
    key: document.querySelector('[data-testid="choice-panel"]').getAttribute('data-key'),
    choices: [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => ({
      id: b.getAttribute('data-testid').replace('choice-', ''),
      items: [...b.querySelectorAll('.impact__item')].map((i) => ({ key: i.getAttribute('data-key'), direction: i.getAttribute('data-direction'), steps: Number(i.getAttribute('data-steps')) })),
    })),
  }));
  if (idx >= card.choices.length) {
    await ctx.close();
    return { card };
  }
  const before = await gameOf(page);
  await page.locator(`[data-testid="choice-${card.choices[idx].id}"]`).click();
  const t0 = Date.now();
  let after = null;
  while (Date.now() - t0 < 8000) {
    after = await gameOf(page);
    if (after.pending === null && (after.age > before.age || after.phase === 'ending')) break;
    await sleep(60);
  }
  await ctx.close();
  return { card, before: { stats: before.stats, familyFund: before.familyFund, age: before.age }, after: { stats: after.stats, familyFund: after.familyFund, age: after.age, phase: after.phase } };
}

let idx = 0;
const results = [];
async function worker() {
  while (idx < names.length) {
    const name = names[idx++];
    const rec = { name, runs: [] };
    try {
      const first = await runChoice(name, 0);
      const n = first.card.choices.length;
      rec.card = first.card;
      rec.runs.push(first);
      for (let k = 1; k < n; k++) rec.runs.push(await runChoice(name, k));
    } catch (e) {
      rec.err = String(e.message).slice(0, 150);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    results.push(rec);
    console.log(name, rec.err ?? `${rec.runs.length}개`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));

// ---- 판정 ----
const RANGE = { 1: [1, 2], 2: [3, 6], 3: [7, 1e9] };
const STATS = ['education', 'health', 'happiness', 'relationships'];
const KEYMAP = { education: 'education', health: 'health', happiness: 'happiness', relationships: 'relationships' };
const bad = [];
let pairs = 0;
let famPairs = 0;
let skipped = 0;
for (const rec of results) {
  if (rec.err) { bad.push(`${rec.name}: 오류 ${rec.err}`); continue; }
  const rs = rec.runs.filter((r) => r.after);
  if (rs.length !== rec.card.choices.length) { skipped++; continue; }
  const dStat = rs.map((r) => Object.fromEntries(STATS.map((s) => [s, r.after.stats[s] - r.before.stats[s]])));
  const dFam = rs.map((r) => r.after.familyFund - r.before.familyFund);
  const rng = rec.card.choices.map((c) => Object.fromEntries(STATS.map((s) => {
    const it = c.items.find((i) => i.key === s);
    if (!it) return [s, [0, 0]];
    const [lo, hi] = RANGE[it.steps];
    return [s, it.direction === 'up' ? [lo, hi] : [-hi, -lo]];
  })));
  const rank = rec.card.choices.map((c) => { const it = c.items.find((i) => i.key === 'family'); return it ? (it.direction === 'up' ? it.steps : -it.steps) : 0; });
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    for (const s of STATS) {
      // 0·100 자르기는 건너뜀
      const bi = rs[i].before.stats[s];
      if (bi <= 2 || bi >= 98) continue;
      pairs++;
      const d = dStat[i][s] - dStat[j][s];
      const lo = rng[i][s][0] - rng[j][s][1] - 1;
      const hi = rng[i][s][1] - rng[j][s][0] + 1;
      if (d < lo || d > hi) bad.push(`${rec.name} ${rec.card.choices[i].id} vs ${rec.card.choices[j].id} ${s}: 차이 ${d} 범위 [${lo}, ${hi}]`);
    }
    if (rank[i] !== rank[j]) {
      famPairs++;
      const dd = dFam[i] - dFam[j];
      if ((rank[i] > rank[j] && dd <= 0) || (rank[i] < rank[j] && dd >= 0)) bad.push(`${rec.name} ${rec.card.choices[i].id} vs ${rec.card.choices[j].id} 집안 살림: 순서 ${rank[i]} vs ${rank[j]}인데 차이 ${dd}`);
    }
  }
}
const rec = {
  id: 'M7a-R05',
  cat: '회귀',
  title: 'M5 영향 줄 「표기 = 실제」 표본: 새 영유아 선택지 카드의 선택지 쌍 — 스탯 차이가 영향 줄 칸 범위 안, 집안 살림 순서가 같은 방향',
  steps: '재력 1·5단계 카드 저장(같은 난수)에서 선택지를 하나씩 눌러 선택 전후 스탯·집안 살림을 읽고 쌍마다 칸 범위와 견줌(1칸 1~2·2칸 3~6·3칸 7~, ±1 여유, 0·100 근처 제외)',
  expected: '표기에 없는 스탯 변화 0, 범위 밖 0, 집안 살림 순서 어긋남 0',
  verdict: bad.length ? 'FAIL' : 'PASS',
  actual: bad.length ? bad.slice(0, 6).join(' / ') + ` (총 ${bad.length})` : `카드 ${results.length}개·선택 ${results.reduce((n, r) => n + r.runs.length, 0)}번, 스탯 쌍 ${pairs}개·집안 살림 쌍 ${famPairs}개 위반 0 (보류 ${skipped}카드)`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(path.join(OUT, RP + 'cases.jsonl'), JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual}`);
await browser.close();

// QA-003 M5 EC6(연애 시나리오): 같은 바탕·같은 난수에서 순자산만 다른 쌍(비부채 +8,000 / 부채 −3,000)을 실제 화면의 자동 모드로 한 해 돌려 「약속 장소에 나간다(meet)」를 고르는 비율을 견준다.
// 사용: node qa/scripts/m5-ec6.mjs [workers]  (먼저 vite-node qa/scripts/m5-craft-ec6.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, SETTINGS_KEY, addCase } from './m5-lib.mjs';

const workers = Number(process.argv[2] || 5);
const pairs = fs.readFileSync(path.join(OUT, 'samples-ec6-in.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const settings = JSON.stringify({ version: 3, data: { speed: 8, autoMode: true, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'light' } });
const jobs = [];
for (const p of pairs) for (const armName of ['A', 'B']) jobs.push({ p, armName });
const results = [];
const browser = await launch();
let idx = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    let ctx;
    const rec = { era: j.p.era, tier: j.p.tier, parenting: j.p.parenting, rng: j.p.rng, arm: j.armName };
    try {
      ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
      await seedStorage(ctx, { [GAME_KEY]: j.p[j.armName], [SETTINGS_KEY]: settings });
      const page = await ctx.newPage();
      await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
      await page.waitForFunction(
        (k) => {
          try {
            const d = JSON.parse(localStorage.getItem(k)).data;
            return d.history.some((h) => h.eventId === 'youth-meeting');
          } catch {
            return false;
          }
        },
        GAME_KEY,
        { timeout: 15000, polling: 40 },
      );
      const d = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
      const h = d.history.find((x) => x.eventId === 'youth-meeting');
      rec.picked = h.choice === '약속 장소에 나간다' ? 'meet' : 'later';
    } catch (e) {
      rec.err = String(e.message).slice(0, 100);
    }
    if (ctx) await ctx.close();
    results.push(rec);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
fs.writeFileSync(path.join(OUT, 'samples-ec6-out.jsonl'), results.map((r) => JSON.stringify(r)).join('\n') + '\n');
const ok = results.filter((r) => !r.err);
const rate = (arm, f = () => true) => {
  const a = ok.filter((r) => r.arm === arm && f(r));
  return { n: a.length, meet: a.filter((r) => r.picked === 'meet').length, pct: a.length ? (100 * a.filter((r) => r.picked === 'meet').length) / a.length : null };
};
const A = rate('A');
const B = rate('B');
const diff = A.pct - B.pct;
const by = {};
for (const par of ['strict', 'free', 'helicopter', 'neglect']) by[par] = [rate('A', (r) => r.parenting === par).pct, rate('B', (r) => r.parenting === par).pct].map((x) => (x === null ? null : Math.round(x * 10) / 10));
// 쌍별 차이의 표준오차
const byPair = new Map();
for (const r of ok) {
  const k = `${r.rng}-${r.era}-${r.tier}-${r.parenting}`;
  if (!byPair.has(k)) byPair.set(k, {});
  byPair.get(k)[r.arm] = r.picked === 'meet' ? 1 : 0;
}
const ds = [...byPair.values()].filter((x) => x.A !== undefined && x.B !== undefined).map((x) => x.A - x.B);
const mean = ds.reduce((s, x) => s + x, 0) / ds.length;
const se = Math.sqrt(ds.reduce((s, x) => s + (x - mean) ** 2, 0) / (ds.length - 1) / ds.length);
console.log(JSON.stringify({ A, B, diff, by, pairs: ds.length, mean, se, err: results.length - ok.length }));
addCase({ id: 'M5-E06', cat: '표기=실제', title: 'EC6: 자동 모드가 부채 판(순자산 −3,000·부채 3,000)에서 「연애를 시작한다」를 비부채 판(순자산 +8,000)보다 덜 고른다(차이 ≥ 10%p) — 같은 바탕·같은 난수 쌍, 실제 화면', steps: `${ds.length}쌍(시대 3·교육방식 4·재력 섞음, 바탕 26개 × 난수 상태)을 자동 모드 8배속·시간 배율 60으로 한 해씩 돌려 youth-meeting의 선택을 기록`, expected: '비부채 판의 meet 비율 − 부채 판의 meet 비율 ≥ 10%p, 모든 교육방식에서 같은 방향', verdict: diff >= 10 && Object.values(by).every(([a, b]) => a === null || a >= b) ? 'PASS' : 'FAIL', actual: `비부채 ${A.meet}/${A.n} = ${A.pct.toFixed(1)}% · 부채 ${B.meet}/${B.n} = ${B.pct.toFixed(1)}% → 차이 ${diff.toFixed(1)}%p (쌍별 표준오차 ${(se * 100).toFixed(1)}%p), 교육방식별 [비부채, 부채] ${JSON.stringify(by)}, 측정 오류 ${results.length - ok.length}`, shots: [] });

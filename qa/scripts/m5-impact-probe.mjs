// QA-003 M5: m5-probe-craft.mjs가 만든 「사건 없는 해」 저장을 화면에서 한 해 돌려, 선택 직후 상태의 연 현금흐름(CF' = 순자산 변화)을 잰다.
// 결과: qa/results/m5/samples-probe-out.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY } from './m5-lib.mjs';

const workers = Number(process.argv[2] || 5);
const SUF = process.env.VARIANT === 'rich' ? '-rich' : '';
const jobs = fs.readFileSync(path.join(OUT, `samples-probe-in${SUF}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const outFile = path.join(OUT, `samples-probe-out${SUF}.jsonl`);
fs.writeFileSync(outFile, '');
const browser = await launch();
let idx = 0;
let done = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const rec = { fixtureKey: j.fixtureKey, choiceId: j.choiceId };
    let ctx;
    try {
      const before = JSON.parse(j.probeRaw).data;
      ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
      await seedStorage(ctx, { [GAME_KEY]: j.probeRaw });
      const p = await ctx.newPage();
      await p.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
      await p.waitForFunction(([k, age]) => {
        const raw = localStorage.getItem(k);
        if (!raw) return false;
        try {
          const d = JSON.parse(raw).data;
          return d.age > age || d.phase !== 'life';
        } catch {
          return false;
        }
      }, [GAME_KEY, before.age], { timeout: 12000 });
      const after = JSON.parse(await p.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
      rec.age = [before.age, after.age];
      rec.net = [before.assets.net, after.assets?.net ?? null];
      rec.debt = [before.assets.debt, after.assets?.debt ?? null];
      rec.income = [before.assets.income, after.assets?.income ?? null];
      rec.histDelta = after.history.length - before.history.length;
      rec.flagsSame = JSON.stringify(before.flags) === JSON.stringify(after.flags);
      rec.cf = after.assets ? after.assets.net - before.assets.net : null;
    } catch (e) {
      rec.err = String(e.message).slice(0, 150);
    }
    if (ctx) await ctx.close();
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    done++;
    if (done % 50 === 0) console.log(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
console.log('DONE', done);

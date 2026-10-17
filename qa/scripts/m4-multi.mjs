// QA-003 M4: 여러 판의 매 해 대시보드(또래 요즘 모습·식구 ⇔ 저장 플래그)를 빠르게 모은다. 개발 서버 시간 배율(?__timescale)과 자동 모드로 한 판을 수십 초에 돌린다(코드 경로는 같다).
// 사용: node qa/scripts/m4-multi.mjs <판 수/세상> [시작 시드] [동시 수]   결과: qa/results/m4/samples-multi-<era>-<seed>.jsonl (+ multi-summary.json)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, sleep, DEV, OUT, GAME_KEY, con } from './m4-lib.mjs';

const perEra = Number(process.argv[2] || 12);
const seed0 = Number(process.argv[3] || 1000);
const conc = Number(process.argv[4] || 4);
const SCALE = Number(process.env.QA_SCALE || 20);
const tasks = [];
for (let i = 0; i < perEra; i++) for (const era of ['past', 'present', 'future']) tasks.push({ era, seed: seed0 + i * 7 + (era === 'past' ? 1 : era === 'present' ? 2 : 3) });

const browser = await launch();
const results = [];
let idx = 0;

async function play({ era, seed }) {
  const file = path.join(OUT, `samples-multi-${era}-${seed}.jsonl`);
  fs.writeFileSync(file, '');
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 900 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await newGameToLife(p, { era, base: DEV, query: `?__timescale=${SCALE}` });
  await p.getByTestId('auto').click();
  await sleep(100);
  let lastAge = -1;
  const t0 = Date.now();
  let n = 0;
  let err = null;
  for (;;) {
    const s = await p.evaluate((key) => {
      const q = (x) => document.querySelector(x);
      const tx = (x) => (q(x) ? q(x).textContent.replace(/\s+/g, ' ').trim() : null);
      if (q('[data-testid="ending-screen"]')) return { end: true };
      if (!q('[data-testid="life-screen"]')) return { other: true };
      const age = parseInt(q('[data-testid="life-age"] b').textContent, 10);
      let flags = null;
      let paused = null;
      try {
        const g = JSON.parse(localStorage.getItem(key)).data;
        flags = g.flags;
        paused = g.paused;
      } catch {}
      return {
        age,
        flags,
        mother: tx('[data-testid="family-mother"]'),
        father: tx('[data-testid="family-father"]'),
        siblings: [...document.querySelectorAll('[data-testid="family-sibling"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
        spouse: tx('[data-testid="family-spouse"]'),
        child: tx('[data-testid="family-child"]'),
        edu: tx('[data-testid="profile-edu"]'),
        peers: [...document.querySelectorAll('[data-testid="peer-now"]')].map((li) => ({
          name: li.querySelector('[data-testid="peer-now-name"]')?.textContent.trim(),
          grade: (/(흙|동|은|금|다이아몬드)수저/.exec(li.textContent) || [])[0] ?? null,
          label: li.querySelector('[data-testid="peer-now-label"]')?.textContent.trim(),
        })),
        hasChoice: !!q('[data-testid="choice-panel"]'),
        logRows: document.querySelectorAll('[data-testid="log-row"]').length,
      };
    }, GAME_KEY);
    if (s.end) break;
    if (s.other) {
      err = 'life/ending 밖 화면';
      break;
    }
    if (s.age !== lastAge) {
      lastAge = s.age;
      n++;
      fs.appendFileSync(file, JSON.stringify(s) + '\n');
    }
    if (Date.now() - t0 > 240000) {
      err = '시간 초과';
      break;
    }
    await sleep(30);
  }
  await ctx.close();
  return { era, seed, samples: n, lastAge, err, sec: Math.round((Date.now() - t0) / 1000) };
}

async function worker() {
  while (idx < tasks.length) {
    const t = tasks[idx++];
    try {
      const r = await play(t);
      results.push(r);
      console.log(JSON.stringify(r));
    } catch (e) {
      results.push({ ...t, err: String(e.message).slice(0, 200) });
      console.log('ERR', JSON.stringify(t), String(e.message).slice(0, 200));
    }
  }
}
await Promise.all(Array.from({ length: conc }, worker));
fs.writeFileSync(path.join(OUT, `multi-summary-${seed0}.json`), JSON.stringify({ results, console: con.take().length }));
await browser.close();
console.log('DONE', results.length);

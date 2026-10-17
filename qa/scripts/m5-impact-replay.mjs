// QA-003 M5 「표기 = 실제」 재생: 수확한 선택지 픽스처(저장 원문)를 선택지마다 다시 불러, 같은 상태에서 선택지만 달리 눌렀을 때 저장·화면이 어떻게 달라지는지 기록한다.
// 선택지를 고르면 같은 걸음에서 한 해가 마무리되므로(소득·생활비·이자·자연 변화), 「선택의 효과」만 따로 볼 수 없다. 대신 같은 상태에서 모든 선택지를 눌러 선택지끼리의 차이를 잰다
// (해마다 규칙은 선택지와 상관없이 같으므로 차이에서 지워진다). 대조는 m5-impact-analyze.mjs.
// 사용: node qa/scripts/m5-impact-replay.mjs [perEvent=6] [workers=4] [limit]
// 결과: qa/results/m5/samples-match.jsonl (재생 한 번이 한 줄)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, sleep, READ_DASH_M5, editSave, con } from './m5-lib.mjs';

const perEvent = Number(process.argv[2] || 6);
const workers = Number(process.argv[3] || 4);
const limit = Number(process.argv[4] || 1e9);
const SUF = process.env.VARIANT === 'rich' ? '-rich' : '';
const outFile = path.join(OUT, `samples-match${SUF}.jsonl`);

// ---- 픽스처 선택 ----
const files = fs.readdirSync(OUT).filter((f) => /^samples-fix-.*\.jsonl$/.test(f));
const all = [];
for (const f of files) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) {
    if (!line) continue;
    const run = JSON.parse(line);
    if (!run.fixtures) continue;
    run.fixtures.forEach((fx, i) => {
      const env = JSON.parse(fx.raw);
      const d = env.data;
      all.push({ era: run.era, seed: run.seed, idx: i, key: `${run.era}-${run.seed}-${i}`, raw: fx.raw, eventId: d.pending.eventId, age: d.age, tier: d.character.parentWealth, choiceIds: d.pending.choiceIds });
    });
  }
}
const byEvent = new Map();
for (const fx of all) {
  if (!byEvent.has(fx.eventId)) byEvent.set(fx.eventId, []);
  byEvent.get(fx.eventId).push(fx);
}
const picked = [];
for (const [ev, list] of [...byEvent].sort()) {
  // 시대·재력 단계가 고르게 섞이도록: 키 순으로 돌려 가며 하나씩
  const buckets = new Map();
  for (const fx of list) {
    const b = `${fx.era}-${fx.tier}`;
    if (!buckets.has(b)) buckets.set(b, []);
    buckets.get(b).push(fx);
  }
  const order = [...buckets.keys()].sort();
  let n = 0;
  for (let round = 0; n < perEvent; round++) {
    let any = false;
    for (const b of order) {
      const fx = buckets.get(b)[round];
      if (fx && n < perEvent) {
        picked.push(fx);
        n++;
        any = true;
      }
    }
    if (!any) break;
  }
}
const jobs = [];
const keepAdult = (fx) => !SUF || fx.age >= 20;
for (const fx of picked.filter(keepAdult).slice(0, limit)) for (const cid of fx.choiceIds) jobs.push({ fx, cid });
console.log(`픽스처 ${all.length}개 중 이벤트 ${byEvent.size}종 ${picked.length}개 선택 → 재생 ${jobs.length}번`);
fs.writeFileSync(outFile, '');

const browser = await launch();
let idx = 0;
let done = 0;
async function worker(w) {
  while (idx < jobs.length) {
    const job = jobs[idx++];
    const { fx, cid } = job;
    const rec = { fixtureKey: fx.key, era: fx.era, eventId: fx.eventId, age: fx.age, tier: fx.tier, choiceId: cid };
    let ctx;
    try {
      // 일시정지 상태로 연다: 선택을 누르고 저장을 읽는 동안 다음 해 시계가 돌지 않게
      const raw = editSave(fx.raw, (d) => {
        d.paused = true;
        // 변형 rich: 순자산에 +10억을 얹어 한도(D19)·안전망이 걸리지 않는 상태에서 현금흐름이 낀 표기를 본다
        if (SUF && d.assets) d.assets.net = Math.min(2000000, d.assets.net + 100000);
      });
      ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
      await seedStorage(ctx, { [GAME_KEY]: raw });
      const p = await ctx.newPage();
      await p.goto(DEV, { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 6000 });
      rec.pre = { raw: await p.evaluate((k) => localStorage.getItem(k), GAME_KEY), dash: await p.evaluate(READ_DASH_M5) };
      await p.locator(`[data-testid="choice-${cid}"]`).click({ timeout: 4000 });
      // 저장이 바뀔 때까지(= 선택이 해결되고 한 해가 마무리될 때까지)
      await p.waitForFunction(
        ([k, before]) => {
          const now = localStorage.getItem(k);
          return now !== null && now !== before;
        },
        [GAME_KEY, rec.pre.raw],
        { timeout: 5000 },
      );
      await sleep(120);
      rec.post = { raw: await p.evaluate((k) => localStorage.getItem(k), GAME_KEY), dash: await p.evaluate(READ_DASH_M5) };
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    if (ctx) await ctx.close();
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    done++;
    if (done % 25 === 0) console.log(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: workers }, (_, i) => worker(i)));
await browser.close();
console.log('DONE', done, 'consoleItems', con.items.length);

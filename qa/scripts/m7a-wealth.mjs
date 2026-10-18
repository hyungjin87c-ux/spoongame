// QA-003 M7a 수저 차이: craft-saves.json의 저장(같은 이벤트·재력 1~5단계)을 실제 화면(prod)에 넣고, 보이는 선택지·영향 줄·카드 문장을 읽는다.
// 사용: node qa/scripts/m7a-wealth.mjs [filterRegex] [workers=2]   결과: qa/results/m7a/wealth-ui.jsonl, 스크린샷 M7a-W-<이벤트>-<시대>-t<재력>[-<접미>].png
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, TOUCH, VP, READ_DASH_M7A, shot, con } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const filter = new RegExp(process.argv[2] || '^w-');
const workers = Number(process.argv[3] || 2);
const crafted = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const names = Object.keys(crafted).filter((n) => filter.test(n));
const outFile = path.join(OUT, RP + `wealth-ui${process.env.OUT_SUFFIX || ''}.jsonl`);
if (!process.env.QA_APPEND) fs.writeFileSync(outFile, '');
const SHOT_TIERS = new Set(['t1', 't5']);

const browser = await launch();
let idx = 0;
async function worker() {
  while (idx < names.length) {
    const name = names[idx++];
    const c = crafted[name];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await seedStorage(ctx, { [GAME_KEY]: c.raw });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 150)));
    await p.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
    const rec = { name, meta: c.meta };
    try {
      await p.goto(PROD, { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
      await p.locator('[data-speed="8"]').click({ timeout: 4000 }).catch(() => {});
      await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
      await sleep(250);
      const d = await p.evaluate(() => window.__readDash());
      rec.dash = { age: d.age, key: d.choiceKey, title: d.choiceTitle, text: d.choiceText, choices: d.choices.map((x) => ({ id: x.id, label: x.label, impact: x.impact, name: x.name })), hint: d.hint };
      if (SHOT_TIERS.has(name.split('-').pop())) rec.shot = await shot(p, `W-${c.meta.event}-${c.meta.era}-${name.split('-').pop()}`);
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    rec.errors = errors;
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    console.log(`${name}: ${rec.err ? 'ERR ' + rec.err : rec.dash.choices.map((x) => x.id).join(',')}`);
    await ctx.close();
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();

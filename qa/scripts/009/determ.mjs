import { chromium, inject, birthState, toLife, readSave, BASE } from './qalib.mjs';
async function run(seed, reload, opts) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await inject(page, birthState({ seed, ...opts }), { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=40');
  await toLife(page);
  const t0 = Date.now(); let reloads = 0;
  while (Date.now() - t0 < 170000) {
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
    if (reload) {
      await page.waitForTimeout(120 + Math.floor(Math.random() * 450));
      await page.reload().catch(() => {}); reloads++;
      await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="ending-screen"]', { timeout: 10000 }).catch(() => {});
      if (await page.getByTestId('title-screen').isVisible().catch(() => false)) await page.getByRole('button', { name: /이어서/ }).first().click().catch(() => {});
    } else await page.waitForTimeout(300);
  }
  const s = (await readSave(page)).data;
  await browser.close();
  return { s, reloads, errors };
}
const strip = (s) => JSON.stringify({ history: s.history, stats: s.stats, age: s.age, flags: s.flags, death: s.death, seen: s.seen, family: s.family });
for (const [seed, opts] of [[8101, { generation: 'g86', wealth: 2, birthYear: 1968, region: '전남' }], [8102, { generation: 'boomer', wealth: 1, birthYear: 1960, region: '강원' }]]) {
  const a = await run(seed, false, opts);
  const b = await run(seed, true, opts);
  const same = strip(a.s) === strip(b.s);
  console.log(`seed ${seed}: straight age ${a.s.age} hist ${a.s.history.length} | reloaded(${b.reloads}x) age ${b.s.age} hist ${b.s.history.length} | identical=${same} | errors ${a.errors.length + b.errors.length}`);
  if (!same) {
    const A = a.s.history, B = b.s.history;
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (JSON.stringify(A[i]) !== JSON.stringify(B[i])) { console.log('  first diff @', i, JSON.stringify(A[i])?.slice(0, 160), '||', JSON.stringify(B[i])?.slice(0, 160)); break; }
  }
  const fam = b.s.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => h.age + ':' + h.eventId);
  console.log('  fam lines (reloaded run):', fam.join(' '));
}

import { chromium, inject, lifeAt, sceneNow } from './qalib.mjs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const rows = [];
for (const region of ['강원', '전남', '서울', '경기']) for (const wealth of [1, 2, 3]) {
  const line = [];
  for (const year of [1969, 1970, 1975, 1976]) {
    const birthYear = 1962;
    await inject(p, lifeAt({ generation: 'boomer', birthYear, age: year - birthYear, wealth, region, seed: 9100 + wealth }), { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=100');
    await p.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]', { timeout: 15000 });
    const s = await p.evaluate(() => {
      const el = document.querySelector('[data-testid="scene-house"] [data-layer="집"] [data-piece]');
      return { yr: document.querySelector('.scene__year time')?.textContent, id: el?.getAttribute('data-piece'), thatch: !!el && el.innerHTML.includes('Q 40,-92'), bg: document.querySelector('[data-layer="배경"] [data-piece]')?.getAttribute('data-piece') };
    });
    line.push(`${s.yr?.replace('년','')}:${s.id?.replace('house-','')}${s.thatch ? '(초가)' : ''}`);
  }
  rows.push(`${region} 재력${wealth} | ${line.join('  ')}`);
}
console.log(rows.join('\n')); console.log('errors', errs.length);
await b.close();

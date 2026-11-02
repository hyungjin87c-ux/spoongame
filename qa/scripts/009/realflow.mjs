import { chromium, BASE } from './qalib.mjs';
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.goto(BASE + '/?__timescale=60');
const begin = page.getByTestId('start-birth'); await begin.waitFor();
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="start-birth"]'); return x && !x.disabled && x.getAttribute('aria-disabled') !== 'true'; });
await begin.click();
await page.getByTestId('roulette-screen').waitFor();
await page.getByTestId('skip-roulette').click().catch(() => {});
await page.waitForFunction(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') === 'result');
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="to-birth"]'); return x && !x.disabled && x.getAttribute('aria-disabled') !== 'true'; });
await page.getByTestId('to-birth').click();
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="next-life"]'); return x && !x.disabled && x.getAttribute('aria-disabled') !== 'true'; });
await page.getByTestId('next-life').click();
await page.getByTestId('life-screen').waitFor();
await page.locator('[data-speed="8"]').click();
await page.getByTestId('auto').click();
// 진행 중 정보 수집: 해마다 시대의 창 상태
const years = new Map();
const t0 = Date.now();
while (Date.now() - t0 < 200000) {
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
  const s = await page.evaluate(() => ({ yr: document.querySelector('.scene__year time')?.textContent, empty: document.querySelector('#scene-era')?.getAttribute('data-empty'), era: document.querySelector('#scene-era')?.getAttribute('data-era') }));
  if (s.yr) years.set(s.yr, s);
  await page.waitForTimeout(100);
}
const ended = await page.getByTestId('ending-screen').isVisible();
const s = JSON.parse(await page.evaluate(() => localStorage.getItem('suzeo-game:save'))).data;
const empties = [...years.values()].filter((y) => y.empty === 'true').map((y) => y.yr);
console.log('title→끝', ended, '| 세대', s.generation, '재력', s.character?.parentWealth, '출생', s.character?.birthYear, '지역', s.birthReport?.region, '| 사망', JSON.stringify(s.death), '| 해 수', years.size, '| 빈 틀이던 해', empties.join(','), '| errors', errors.length, errors.slice(0, 2));
// 다시 태어나기
await page.waitForTimeout(1500);
await page.getByTestId('rebirth').click();
await page.getByTestId('title-screen').waitFor({ timeout: 8000 });
await page.waitForTimeout(500);
const s2 = JSON.parse(await page.evaluate(() => localStorage.getItem('suzeo-game:save'))).data;
console.log('다시 태어나기 뒤: phase', s2.phase, 'history', s2.history.length, 'family', s2.family ? 'x' : '없음', '시대 줄 DOM', await page.locator('[data-tl="era"]').count());
await b.close();

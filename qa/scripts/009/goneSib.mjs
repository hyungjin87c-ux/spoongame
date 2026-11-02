import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
for (const key of ['gone-and-sib-genz', 'gone-and-sib-industrial']) {
  const st = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.json`, 'utf8'));
  const exp = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.expected.json`, 'utf8'));
  const a0 = st.data.age;
  console.log(key, 'state age', a0, '코어 연표', exp.history.filter((h) => h.age >= a0 && h.age <= a0 + 1).map((h) => `${h.age}세 ${h.eventId ?? h.kind}「${h.text.slice(0, 26)}」`).join(' / '));
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=8');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction((a) => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= a + 2, a0, { timeout: 60000 });
  await page.getByTestId('pause').click();
  await page.waitForTimeout(500);
  await page.getByTestId('scene-more').locator('summary').click().catch(() => {});
  const view = await page.evaluate(() => ({
    line: document.querySelector('[data-testid="scene-line"]')?.textContent,
    pets: document.querySelector('[data-testid="scene-pets"]')?.textContent,
    people: [...document.querySelectorAll('[data-testid="scene-people"] li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    yr: document.querySelector('.scene__year time')?.textContent,
    rows: [...document.querySelectorAll('[data-testid="log-list"] li')].slice(0, 9).map((li) => li.textContent.replace(/\s+/g, ' ').slice(0, 52)),
    pieces: [...document.querySelectorAll('[data-layer="식구"] [data-piece]')].map((e) => e.getAttribute('data-piece')),
  }));
  console.log('  장면', view.yr, '|', view.line, '|', view.people.join(' ; '), '\n  조각', view.pieces.join(','), '\n  기록(위가 최신)', '\n    ' + view.rows.join('\n    '), '\n  errors', errors.length);
  await page.context().close();
}
await b.close();

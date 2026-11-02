import { chromium, GAME_KEY, SAVE_VERSION, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const DIR = 'qa/scripts/009/states';
const keys = process.argv.slice(2);
const mode = process.env.QA_MODE ?? 'auto8';
for (const key of keys) {
  const st = JSON.parse(readFileSync(`${DIR}/${key}.json`, 'utf8'));
  const exp = JSON.parse(readFileSync(`${DIR}/${key}.expected.json`, 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: mode.includes('360') ? 360 : 1280, height: mode.includes('360') ? 740 : 800 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  await page.goto(BASE + '/');
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: true, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=40');
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  // 강제 카드 해를 지나는 동안: 비모달 부모 카드가 뜨는가
  let sawParentCard = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 170000) {
    if (await page.getByTestId('parent-card').isVisible().catch(() => false)) sawParentCard = true;
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
    await page.waitForTimeout(40);
  }
  const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  const same = JSON.stringify(s.history) === JSON.stringify(exp.history) && s.age === exp.age && JSON.stringify(s.death) === JSON.stringify(exp.death) && JSON.stringify(s.stats) === JSON.stringify(exp.stats);
  let diff = '';
  if (!same) for (let i = 0; i < Math.max(s.history.length, exp.history.length); i++) if (JSON.stringify(s.history[i]) !== JSON.stringify(exp.history[i])) { diff = `첫 차이 @${i}: 브라우저 ${JSON.stringify(s.history[i])?.slice(0, 120)} / 코어 ${JSON.stringify(exp.history[i])?.slice(0, 120)}`; break; }
  const sib = s.history.filter((h) => h.eventId === 'infant-new-sibling').length;
  console.log(`${key}: start ${st.data.age}세 → 끝 ${s.age}세 phase=${s.phase} | 코어와 동일=${same} | 강제 카드 줄 ${sib}개 | 부모 카드 관찰=${sawParentCard} | errors ${errors.length} ${errors.slice(0, 2).join(';')} ${diff}`);
  await browser.close();
}

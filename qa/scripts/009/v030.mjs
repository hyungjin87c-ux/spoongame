import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const FIX = 'tests/fixtures';
const b = await chromium.launch();
for (const age of [0, 20, 65]) {
  const raw0 = readFileSync(`${FIX}/save-v030-age${age}.json`, 'utf8');
  const fx = JSON.parse(raw0);
  const hist0 = fx.data.history.length;
  for (const [mode, paused] of [['paused', true], ['run', false]]) {
    const data = { ...fx.data, paused };
    const raw = JSON.stringify({ version: fx.version, data });
    const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
    await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, raw, SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: true, noteCards: false })]);
    for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
    await page.goto(BASE + '/?__timescale=40');
    await page.getByTestId('life-screen').waitFor();
    await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]', { timeout: 15000 });
    await page.waitForTimeout(700);
    if (mode === 'paused') {
      const stored = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
      const rowsNow = await page.locator('[data-testid="log-row"]').count();
      const line = await page.getByTestId('scene-line').textContent();
      const sceneYr = await page.locator('.scene__year time').textContent();
      const ageNow = await page.getByTestId('life-age').textContent();
      console.log(`v0.3.0 ${age}세 [paused]: 저장 원문에 family ${stored.includes('"family"') ? '있음(열기만 했는데 썼다)' : '없음(열기만 하면 쓰지 않는다)'} | 기록 줄 ${rowsNow} (원문 ${hist0}) | 장면 ${sceneYr} ${line} | 나이 ${ageNow.trim()} | errors ${errors.length}`);
      // 한 해 진행: 일시정지 풀기
      await page.getByTestId('pause').click();
      await page.waitForTimeout(1500);
      await page.getByTestId('pause').click();
      const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
      const retro = s.history.slice(0, hist0).some((h) => (h.eventId ?? '').startsWith('fam-'));
      console.log(`   진행 뒤: age ${s.age} family ${s.family ? 'lg=' + s.family.lg + ' 로그 ' + s.family.l.length + '건' : '없음'} | 소급(원문 구간에 fam- 줄) ${retro ? '있음' : '없음'} | 새 fam- 줄 ${s.history.filter((h, i) => i >= hist0 && (h.eventId ?? '').startsWith('fam-')).length}`);
    } else {
      await page.getByTestId('ending-screen').waitFor({ timeout: 120000 }).catch(() => {});
      const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
      const dupDeath = s.history.filter((h) => h.kind === 'death').length;
      console.log(`v0.3.0 ${age}세 [끝까지]: phase ${s.phase} age ${s.age} 사망 줄 ${dupDeath} 새 fam- 줄 ${s.history.filter((h, i) => i >= hist0 && (h.eventId ?? '').startsWith('fam-')).length} | errors ${errors.length} ${errors.slice(0, 2)}`);
    }
    await page.context().close();
  }
}
await b.close();

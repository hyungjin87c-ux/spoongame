import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const key = process.argv[2] ?? 'fam17';
const st = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.json`, 'utf8'));
for (const gentle of [true, false]) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/');
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: true, noteCards: false, gentle })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=30');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? 0) >= 52, null, { timeout: 120000 });
  await page.getByTestId('pause').click();
  await page.waitForTimeout(400);
  const hist = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data.history;
  const fam = hist.filter((h) => (h.eventId ?? '').startsWith('fam-'));
  const heavyIds = new Set(['fam-parent-gone', 'fam-parents-apart', 'fam-gp-gone']);
  const body = await page.evaluate(() => document.body.innerText);
  const aria = await page.locator('[data-testid="log-list"]').ariaSnapshot();
  const leaks = [], vis = [];
  for (const h of fam) {
    const inInner = body.includes(h.text), inAria = aria.includes(h.text.slice(0, 12));
    if (heavyIds.has(h.eventId)) (inInner || inAria ? leaks : vis).push(`${h.age}세 ${h.eventId}${inInner ? ' [innerText]' : ''}${inAria ? ' [aria]' : ''}`);
  }
  const veiledRows = await page.locator('[data-testid="log-list"] li[data-veiled="true"]').count();
  const nonHeavyVisible = fam.filter((h) => !heavyIds.has(h.eventId)).every((h) => body.includes(h.text));
  console.log(`${key} gentle=${gentle}: fam- 줄 ${fam.length}개(무거운 쪽 ${fam.filter((h) => heavyIds.has(h.eventId)).length}) | 무거운 줄 원문 노출 ${leaks.length}${leaks.length ? ' → ' + leaks.join(', ') : ''} | 가려진 줄 ${veiledRows} | 동생 출생·독립 줄 원문 보임=${nonHeavyVisible} | errors ${errors.length}`);
  if (gentle) {
    // 끝까지 가서 엔딩 화면도 본다
    await page.getByTestId('pause').click();
    await page.getByTestId('ending-screen').waitFor({ timeout: 150000 });
    await page.waitForTimeout(600);
    const endBody = await page.evaluate(() => document.body.innerText);
    const endAria = await page.getByTestId('ending-screen').ariaSnapshot();
    const hist2 = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data.history.filter((h) => heavyIds.has(h.eventId ?? ''));
    console.log('   엔딩 화면: 무거운 가족 줄 원문 노출', hist2.filter((h) => endBody.includes(h.text) || endAria.includes(h.text.slice(0, 12))).map((h) => `${h.age}세 ${h.eventId}`));
  }
  await browser.close();
}

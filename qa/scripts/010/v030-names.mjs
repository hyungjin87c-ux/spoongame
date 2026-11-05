import { chromium, webkit, newPage, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const FIX = 'tests/fixtures';
const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
for (const age of [20, 65]) {
  const fx = JSON.parse(readFileSync(`${FIX}/save-v030-age${age}.json`, 'utf8'));
  console.log(`v0.3.0 ${age}세 원문: flags=${fx.data.flags.filter((f) => /married|partner|child|friend|divorc/.test(f)).join(',') || '(없음)'} family=${fx.data.family ? '있음' : '없음'}`);
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify({ version: fx.version, data: { ...fx.data, paused: true } }), SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=40');
  await page.getByTestId('family-card').waitFor();
  await settle(page, 600);
  const read = async () => (await page.getByTestId('family-card').innerText()).replace(/\s+/g, ' ');
  const names = async () => page.evaluate(() => [...document.querySelectorAll('[data-testid="family-card"] .family-who')].map((e) => e.textContent.trim()));
  const a = await names(); const text0 = await read();
  console.log(`  카드 사람 ${a.length}명:`, a.slice(0, 14).join(', '));
  let same = true; for (let i = 0; i < 4; i++) { await page.reload(); await page.getByTestId('family-card').waitFor(); await settle(page, 300); if ((await read()) !== text0) same = false; }
  console.log('  새로고침 4번 뒤 카드 글 같음:', same);
  // 한 해 진행 후 새로고침
  await settle(page, 2500);
  const age1 = (await page.getByTestId('life-age').textContent()).trim();
  const b = await names(); await page.reload(); await page.getByTestId('family-card').waitFor(); await settle(page, 400); const c = await names();
  const keep = a.filter((x) => !/세에|떠남/.test(x)).map((x) => x.replace(/ \d+세$/, ''));
  const after = c.map((x) => x.replace(/ \d+세$/, ''));
  console.log(`  진행(${age1}) 뒤 이름 유지: 처음 이름 ${keep.length}명 중 진행 뒤에도 있는 것 ${keep.filter((n) => after.includes(n)).length}명, 재열기 전후 같음 ${JSON.stringify(b.map((x) => x.replace(/ \d+세$/, ''))) === JSON.stringify(c.map((x) => x.replace(/ \d+세$/, '')))}`);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
  const nameInSave = ['married', 'has_child'].some(() => false);
  console.log('  저장 family 칸 이름 필드(성인 식구는 저장 안 함):', JSON.stringify(Object.keys(saved.family ?? {})), '저장 크기', JSON.stringify(saved).length);
}
console.log('errors', errors);
await browser.close();

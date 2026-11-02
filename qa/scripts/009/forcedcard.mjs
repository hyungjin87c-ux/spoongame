import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
async function boot(b, st, settings, scale) {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope(settings)]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + `/?__timescale=${scale}`);
  await page.getByTestId('life-screen').waitFor();
  return { page, errors };
}
const readS = async (page) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
const b = await chromium.launch();
for (const key of ['forced-genx', 'forced-parentgone-genz']) {
  const st = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.json`, 'utf8'));
  const exp = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.expected.json`, 'utf8'));
  const startAge = st.data.age;
  // 1) 수동 모드 「다음 결정으로」
  {
    const { page, errors } = await boot(b, st, { speed: 1, autoMode: false, noteCards: false }, 30);
    const skip = page.getByTestId('skip');
    await skip.waitFor(); await page.waitForFunction(() => { const x = document.querySelector('[data-testid="skip"]'); return x && !x.disabled && x.getAttribute('aria-disabled') !== 'true'; });
    await skip.click();
    await page.locator('button[data-testid^="choice-"]').first().waitFor({ timeout: 30000 });
    const s = await readS(page);
    const cnt = s.history.filter((h) => h.eventId === 'infant-new-sibling').length;
    const sameAsCore = JSON.stringify(s.history) === JSON.stringify(exp.history.slice(0, s.history.length));
    console.log(`${key} [skip]: ${startAge}세 → 멈춘 나이 ${s.age} pending ${s.pending?.key} | 강제 카드 줄 ${cnt}개 | 지금까지 연표가 코어와 같은 앞부분=${sameAsCore} | errors ${errors.length}`);
    await page.context().close();
  }
  // 2) 부모 카드가 떠 있는 동안 새로고침 연타 (1배속 · 시계 10배)
  {
    const { page, errors } = await boot(b, st, { speed: 1, autoMode: false, noteCards: false }, 10);
    let sawCard = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 40000 && !sawCard) { sawCard = await page.getByTestId('parent-card').isVisible().catch(() => false); await page.waitForTimeout(30); }
    let reloads = 0;
    if (sawCard) for (let i = 0; i < 10; i++) { await page.reload(); reloads++; await page.getByTestId('life-screen').waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(80 + Math.floor(Math.random() * 200)); }
    await page.waitForTimeout(1500);
    const s = await readS(page);
    const cnt = s.history.filter((h) => h.eventId === 'infant-new-sibling').length;
    const famDup = s.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => `${h.age}:${h.eventId}`);
    const dupEra = await page.locator('[data-tl="era"]').evaluateAll((els) => { const ids = els.map((e) => e.id); return ids.length - new Set(ids).size; });
    console.log(`${key} [카드 중 새로고침 ${reloads}회]: 카드 관찰=${sawCard} | age ${s.age} | 강제 카드 줄 ${cnt}개 | fam 줄 ${famDup.join(' ') || '없음'} | 시대 줄 id 중복 ${dupEra} | errors ${errors.length}`);
    await page.context().close();
  }
}
await b.close();

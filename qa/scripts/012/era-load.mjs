// 시대의 창 덩어리가 늦게 올 때(느린 네트워크) 창↔줄 일치, 새로고침 연타 뒤 복원 — 일시정지한 판으로 본다
import { chromium, newPage, evalCore, inject, BASE } from './lib.mjs';
const rec = (id, verdict, note) => console.log(`${id} | ${verdict} | ${note}`);
const { browser: b0, page: p0 } = await newPage(chromium);
await p0.goto(BASE + '/');
const snap = await evalCore(p0, `
  for (let seed = 1; seed < 3000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'millennial')));
    if (s.character.birthYear !== 1995) continue;
    for (let a = 0; a < 7; a++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; a--; continue; } s = core.stepYear(s).state; }
    if (s.phase === 'life' && s.age === 7) return { ...s, paused: true };
  }
  return null;`);
await b0.close();
delete snap.play;
const by = snap.character.birthYear;
for (const delay of [0, 1500, 5000]) {
  const { browser, ctx, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  await ctx.route(/eraWindows\/d19(9|8)0\.ts/, async (route) => { await new Promise((r) => setTimeout(r, delay)); await route.continue(); });
  await ctx.route(/eraWindows\/d2000\.ts/, async (route) => { await new Promise((r) => setTimeout(r, delay)); await route.continue(); });
  await inject(page, snap, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  const t0 = Date.now();
  const early = await page.evaluate(() => ({ era: document.querySelector('#scene-era')?.dataset.era ?? null, empty: document.querySelector('#scene-era')?.dataset.empty ?? null, rows: document.querySelectorAll('[data-tl=era]').length }));
  await page.waitForFunction(() => document.querySelectorAll('[data-tl=era]').length >= 8, null, { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(800);
  const late = await page.evaluate(() => ({ era: document.querySelector('#scene-era')?.dataset.era ?? null, empty: document.querySelector('#scene-era')?.dataset.empty ?? null, rows: [...document.querySelectorAll('[data-tl=era]')].map((r) => r.id + ':' + (r.querySelector('.log__sent')?.textContent ?? '')) }));
  const yr = await page.evaluate(() => document.querySelector('.scene__year time')?.textContent);
  rec(`era-load 지연 ${delay}ms`, late.rows.length > 0 && errors.length === 0 ? 'PASS' : 'FAIL', `처음 ${JSON.stringify(early)} → 나중(${Date.now() - t0}ms) 창 ${late.era}/empty=${late.empty} (${yr}), 시대 줄 ${late.rows.length}개 [${late.rows.slice(-2).join(' | ')}], 오류 ${errors.length}`);
  // 새로고침 연타
  for (let i = 0; i < 12; i++) await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('[data-tl=era]').length >= 8, null, { timeout: 40000 }).catch(() => {});
  const r2 = await page.evaluate(() => ({ rows: document.querySelectorAll('[data-tl=era]').length, age: document.querySelector('[data-testid=life-age]')?.textContent.trim() }));
  rec(`era-load 새로고침 12연타(지연 ${delay}ms)`, r2.rows === late.rows.length && errors.length === 0 ? 'PASS' : 'FAIL', `시대 줄 ${late.rows.length}→${r2.rows}, 나이 ${r2.age}, 오류 ${errors.length}`);
  await browser.close();
}

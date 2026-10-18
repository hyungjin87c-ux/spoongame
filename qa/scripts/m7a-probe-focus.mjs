// 도구 점검·재현: 특정 카드·뷰포트에서 선택지에 Tab으로 닿았을 때 포커스 링과 하단 띠의 위치(스크롤이 끝난 뒤)를 반복 측정한다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, setRootFont, shot } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';
const state = process.argv[2] || 'card-infant-early-lessons';
const [w, h] = (process.argv[3] || '360x568').split('x').map(Number);
const font = Number(process.argv[4] || 200);
const reps = Number(process.argv[5] || 5);
const browser = await launch();
for (let rep = 0; rep < reps; rep++) {
  const ctx = await mkctx(browser, { viewport: { width: w, height: h } });
  const raw = fs.readFileSync(path.join(OUT, RP + 'saves', `${state}.json`), 'utf8');
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('s', '1'); } } catch {} }, [GAME_KEY, raw, SETTINGS_KEY, JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } })]);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(400);
  if (font !== 100) await setRootFont(page, font);
  await sleep(300);
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  const log = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    await sleep(600);
    const m = await page.evaluate(() => {
      const a = document.activeElement;
      const r = a.getBoundingClientRect();
      const cs = getComputedStyle(a);
      const bar = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
      return { id: a.getAttribute('data-testid'), top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, h: Math.round(r.height), outline: `${cs.outlineWidth} ${cs.outlineStyle} offset ${cs.outlineOffset}`, barTop: Math.round(bar.top), vh: window.innerHeight, scrollY: Math.round(window.scrollY) };
    });
    log.push(m);
    if (m.id === 'choice-english') {
      if (rep === 0) console.log(await shot(page, 'PROBE', `focus-english-${w}x${h}-${font}`));
      break;
    }
  }
  console.log(rep, JSON.stringify(log[log.length - 1]));
  await ctx.close();
}
await browser.close();

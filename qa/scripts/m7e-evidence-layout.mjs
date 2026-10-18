// QA-003 M7e 레이아웃 증거 스크린샷: (1) 결정 카드 「무리해서라도 뒷바라지한다」 라벨 낱말 끊김(320×568 · 글자 200%) (2) 합쇼체로 길어진 낱말(「가시방석이었습니다」)이 한 줄보다 넓은 인생 기록 줄(360×740 · 글자 200%)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, setRootFont, SHOT_DIR, SHOT_PREFIX } from './m7e-lib.mjs';
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const b = await launch();
for (const [name, vp, font, sel, out] of [
  ['card-middle-child-school-present', { viewport: { width: 320, height: 568 } }, 200, '[data-testid="choice-fund"]', SHOT_PREFIX + '-L02-card-middle-child-school-320x568-200.png'],
  ['card-senior-estate-present', { viewport: { width: 360, height: 740 }, ...TOUCH }, 200, '[data-testid="log-list"]', SHOT_PREFIX + '-L02-log-unavoidable-word-360x740-200.png'],
]) {
  const ctx = await mkctx(b, vp);
  await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', name + '.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((x) => x.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  await sleep(300);
  await setRootFont(p, font);
  await sleep(400);
  await p.locator(sel).scrollIntoViewIfNeeded();
  if (sel.includes('log-list')) await p.evaluate(() => { const l = document.querySelector('[data-testid="log-list"]'); const row = [...l.querySelectorAll('[data-testid="log-row"]')].find((r) => /가시방석/.test(r.textContent)); if (row) row.scrollIntoView({ block: 'center', behavior: 'instant' }); });
  await sleep(300);
  await p.screenshot({ path: path.join(SHOT_DIR, out) });
  console.log(out, await p.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').slice(0, 80), sel));
  await ctx.close();
}
await b.close();

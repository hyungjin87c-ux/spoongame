// QA-003 M7e 2회차 C20 증거: 부모 임종 카드 「가족·친척과 의논해 치른다」 선택지 버튼의 접근성 이름·보이는 글자·같은 카드 다른 선택지와 비교
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-c20detail.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, shot } from './m7e-lib.mjs';

const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', 'card-farewell-plain.json'), 'utf8'), [SETTINGS_KEY]: SPEED8 });
const page = await ctx.newPage();
await page.goto(PROD, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
await sleep(900);
const cdp = await ctx.newCDPSession(page);
const out = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].map((b) => ({
    id: b.getAttribute('data-testid'),
    aria: b.getAttribute('aria-label'),
    visible: b.querySelector('.choice__label')?.textContent,
    hasDot: (b.getAttribute('aria-label') || '').includes('·'),
  })),
);
await shot(page, 'C20', 'farewell-share-label');
fs.writeFileSync(path.join(OUT, 'c20-detail.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await ctx.close();
await browser.close();

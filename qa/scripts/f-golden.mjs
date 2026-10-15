// 골든 저장 만들기: 앱을 실제로 조작해 birth / life(선택지 대기) / ending 저장 원문을 모은다. 변조 케이스의 재료.
import fs from 'node:fs';
import path from 'node:path';
import { DEV, RES_DIR, launch, mkctx, toLife, toBirth, waitScreen, readRaw, snap, readChoice, sleep, SETTINGS_KEY } from './f-compat.mjs';

const out = {};
const browser = await launch();
const ctx = await mkctx(browser);
const page = await ctx.newPage();
await page.goto(DEV + '/?__timescale=50&__guard=0');
await toBirth(page, 'present');
out.birth = await readRaw(page);
await page.getByTestId('next-life').click();
await waitScreen(page, 'life-screen');
await sleep(600);
let n = 0;
const log = [];
for (let i = 0; i < 200; i++) {
  const s = await snap(page);
  if (s.screen === 'ending-screen') break;
  if (s.hasChoice) {
    const c = await readChoice(page);
    n++;
    if (n === 1) out.lifeChoice = await readRaw(page);
    log.push({ age: s.age, title: c.title, textLen: c.text.length, labels: c.choices.map((x) => x.label) });
    await page.locator('.choice-list button').first().click();
    await sleep(120);
  } else {
    await page.getByTestId('skip').click();
    await sleep(120);
  }
}
await waitScreen(page, 'ending-screen', 5000);
out.ending = await readRaw(page);
out.settings = await readRaw(page, SETTINGS_KEY);
fs.writeFileSync(path.join(RES_DIR, 'golden.json'), JSON.stringify(out, null, 1));
console.log('choices', n, JSON.stringify(log.map((l) => l.title)));
console.log(Object.keys(out), out.ending.length);
await browser.close();

// 고정 저장(tests/fixtures/*.json)을 주입해 열고 화면 글을 뽑는다: node qa/scripts/012/fixture-open.mjs <fixture파일명> [폭x높이] [ending|life]
import { chromium, newPage, inject, SAVE_VERSION, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const [fx, vp = '1280x800'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
const { browser, page, errors } = await newPage(chromium, { width: w, height: h });
const raw = JSON.parse(readFileSync(`tests/fixtures/${fx}`, 'utf8'));
await inject(page, raw.data, { speed: 1, autoMode: false, noteCards: false });
await page.waitForTimeout(1500);
const scr = await page.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.getAttribute('data-testid'));
console.log('screen', scr);
if (scr === 'ending-screen') {
  const tl = await page.evaluate(() => [...document.querySelectorAll('[data-testid="timeline-picked"], [data-testid="timeline-delegated"], [data-testid="timeline-flowed"]')].slice(0, 80).map(e => e.textContent.trim().replace(/\s+/g, ' ')));
  console.log(tl.filter(t => /부모|어머니|아버지|정했|이렇게/.test(t)).join('\n'));
  console.log('--- summary text');
  const t = await page.evaluate(() => document.body.innerText);
  console.log('큰 결정 가운데 문장:', /큰 결정 가운데/.test(t), '| 번의 선택:', (t.match(/살아오며[^\n]*번의 선택[^\n]*/) ?? [])[0]);
}
console.log('errors', errors);
await browser.close();

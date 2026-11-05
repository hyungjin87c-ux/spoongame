import { chromium, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 });
const st = JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[94];
await inject(page, { ...st, paused: true }, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
await page.getByTestId('life-screen').waitFor();
await page.waitForFunction(() => document.querySelectorAll('[data-tl="era"]').length > 60, null, { timeout: 20000 });
await settle(page, 400);
const dump = async (label, loc) => console.log(`--- ${label}\n` + (await loc.ariaSnapshot()).split('\n').slice(0, 14).join('\n'));
await dump('2110 창(링크)', page.locator('#scene-era'));
await dump('2110 끝 줄', page.locator('#log-y2110'));
await dump('2109 줄(칩·근거 단추)', page.locator('#log-y2109'));
await dump('2095 줄', page.locator('#log-y2095'));
console.log('창 접근 이름(링크):', await page.getByRole('link', { name: /시대의 창/ }).first().evaluate((e) => e.getAttribute('title')));
// 펼친 근거 칸
await page.locator('#log-y2095 [data-testid="why-btn"]').click();
await dump('2095 줄(펼침)', page.locator('#log-y2095'));
console.log('errors', errors);
await browser.close();

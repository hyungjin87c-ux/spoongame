// 탭 두 개: 같은 판을 두 탭에서 진행 — 한쪽만 이어지고 다른 쪽은 밀린 화면이어야 하며, 배속 설정 변경이 서로 오류를 내지 않는다
import { chromium, newPage, inject, GAME_KEY, SETTINGS_KEY, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
const { browser, ctx, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
const st = { ...raw, paused: false }; delete st.play;
await inject(page, st, { speed: 4, autoMode: true, noteCards: false }, '/?__timescale=20');
await page.getByTestId('life-screen').waitFor({ state: 'visible' });
const p2 = await ctx.newPage(); const e2 = [];
p2.on('pageerror', (e) => e2.push(e.message));
await p2.goto(BASE + '/?__timescale=20');
await page.waitForTimeout(3000);
await p2.waitForTimeout(1500);
const scr = async (p) => p.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
const s1 = await scr(page), s2 = await scr(p2);
if (s2 === 'life-screen') { await p2.getByTestId('speed').click().catch(() => {}); }
if (s1 === 'life-screen') { await page.getByTestId('speed').click().catch(() => {}); }
await page.waitForTimeout(3000);
const s1b = await scr(page), s2b = await scr(p2);
const save = await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)).data; return `${d.phase} ${d.age}세`; }, GAME_KEY);
console.log(`탭1 ${s1}→${s1b}, 탭2 ${s2}→${s2b}, 저장 ${save}, 오류 ${errors.length + e2.length} ${[...errors, ...e2].slice(0, 2)}`);
await browser.close();

// 공격: 새로고침 연타 · 창(시대의 창 링크) 연속 클릭·Enter 연타 · 뒤로가기 · 저장 중 종료
import { chromium, webkit, newPage, inject, settle, readSave, GAME_KEY, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
const base = JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[28];
await inject(page, { ...base, paused: false }, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=20');
await page.getByTestId('life-screen').waitFor();
await settle(page, 500);
// 1) 새로고침 연타 15번(진행 중, 기다림 거의 없이)
let reloadFail = 0;
for (let i = 0; i < 15; i++) { await page.reload({ waitUntil: 'commit' }); await page.waitForTimeout(150 + (i % 4) * 120); }
await page.locator('[data-testid="life-screen"], [data-testid="ending-screen"]').first().waitFor();
const s1 = await readSave(page);
console.log(`새로고침 15번 뒤: phase ${s1.data.phase} age ${s1.data.age} 기록 ${s1.data.history.length}, 시대 줄 DOM ${await page.locator('[data-tl="era"]').count()}, 중복 id ${await page.evaluate(() => { const ids = [...document.querySelectorAll('[id^="log-y"]')].map((e) => e.id); return ids.length - new Set(ids).size; })}`);
// 2) 창 연속 클릭 60번 + Enter 25번 (달리는 중)
await page.getByTestId('life-screen').waitFor().catch(() => {});
let h0 = await page.evaluate(() => history.length); const u0 = page.url();
for (let i = 0; i < 60; i++) await page.locator('#scene-era').click({ timeout: 2000, force: true }).catch(() => {});
await page.locator('#scene-era').focus().catch(() => {});
for (let i = 0; i < 25; i++) await page.keyboard.press('Enter');
const h1 = await page.evaluate(() => history.length);
console.log(`창 클릭 60·Enter 25: 주소 같음 ${page.url() === u0}, history ${h0} → ${h1}, 오류 ${errors.length}`);
// 3) 뒤로가기·앞으로
await page.goBack().catch(() => {}); await settle(page, 300);
const after = await page.locator('[data-testid="life-screen"], [data-testid="ending-screen"], [data-testid="title-screen"]').first().getAttribute('data-testid').catch(() => '?');
await page.goForward().catch(() => {}); await settle(page, 300);
console.log(`뒤로가기 뒤 화면 ${after}, 저장 phase ${(await readSave(page))?.data?.phase}`);
// 4) 저장 중 종료: 빠르게 새 탭을 열고 닫기
let ok = 0;
for (let i = 0; i < 5; i++) { const p2 = await page.context().newPage(); await p2.goto(BASE + '/?__timescale=20'); await p2.waitForTimeout(400 + i * 150); await p2.close({ runBeforeUnload: true }); ok++; }
await page.waitForTimeout(500);
const s2 = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return 'broken'; } }, GAME_KEY);
console.log(`탭 닫기 5번 뒤 저장 읽힘 ${s2 && s2 !== 'broken'} (version ${s2?.version}, phase ${s2?.data?.phase}), errors ${errors.length} ${errors.slice(0, 2).join('|').slice(0, 200)}`);
await browser.close();

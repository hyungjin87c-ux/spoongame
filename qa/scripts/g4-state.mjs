import { open, go, sleep, rec, shot, GAME_KEY, SETTINGS_KEY } from './g4-lib.mjs';
import fs from 'node:fs';
const U = 'http://localhost:4377/';
const txt = (page, sel) => page.$eval(sel, (e) => e.innerText.replace(/\n/g, ' ')).catch(() => null);
async function toLife(page, gen = 'genx') {
  await go(page); await sleep(300);
  await page.locator(`[data-testid="gen-row-${gen}"]`).click(); await page.click('[data-testid="start-birth"]');
  await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); await sleep(700); await page.click('[data-testid="to-birth"]');
  await page.waitForSelector('[data-testid="birth-screen"]'); await sleep(700); await page.click('[data-testid="next-life"]'); await page.waitForSelector('[data-testid="life-screen"]');
}
const { browser, ctx, page, logs } = await open('d1280');
await toLife(page); await page.getByRole('button', { name: '8배' }).click(); await sleep(6000);
const age1 = await txt(page, '[data-testid="life-age"]');
const saveStr = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const ver = JSON.parse(saveStr).version;
console.log('save version', ver, 'age', age1);
// 이어서 살기: 새로고침
await page.reload(); await sleep(1500);
const r1 = await page.evaluate(() => ({ life: !!document.querySelector('[data-testid="life-screen"]'), title: !!document.querySelector('[data-testid="title-screen"]'), age: document.querySelector('[data-testid="life-age"]')?.innerText }));
rec('S01', '인생 진행 중(약 6초) 새로고침', '인생 화면으로 복원, 나이 유지', `${age1} → ${JSON.stringify(r1)}`, r1.life ? 'PASS' : 'FAIL');
// 나가기 → 첫 화면 → 이어서 살기
await page.click('[data-testid="tool-exit"]'); await sleep(500);
console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean).join(' | ')));
await page.getByRole('button', { name: /첫 화면|나가기|나간다/ }).last().click().catch(() => {}); await sleep(900);
const t = await page.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), resume: document.querySelector('[data-testid="resume"]')?.innerText, begin: document.querySelector('[data-testid="begin-new"]')?.innerText, w: document.documentElement.scrollWidth, head: document.body.innerText.slice(0, 200).replace(/\n/g, ' ') }));
rec('S02', '인생 중 나가기 → 첫 화면', '이어서 살기 기본 + 새로 태어나기 보조', JSON.stringify(t), t.title && t.resume ? 'PASS' : 'RECORD');
if (t.resume) { await sleep(600); await page.click('[data-testid="resume"]'); await sleep(900); rec('S03', '이어서 살기 클릭', '인생 화면으로', String(await page.$('[data-testid="life-screen"]') !== null), (await page.$('[data-testid="life-screen"]')) ? 'PASS' : 'FAIL'); }
// 밀린 화면: 다른 탭에서 저장을 바꾼다
const pageB = await ctx.newPage(); await pageB.goto(U); await sleep(1200);
const liveB = await pageB.evaluate(() => document.querySelector('[data-testid="life-screen"]') ? 'life' : document.querySelector('[data-testid="title-screen"]') ? 'title' : '?');
await pageB.getByRole('button', { name: '8배' }).click().catch(() => {}); await sleep(3500);
await page.bringToFront(); await sleep(1200);
const sup = await page.evaluate(() => ({ sup: !!document.querySelector('[data-testid="superseded-screen"]'), text: document.querySelector('[data-testid="superseded-text"]')?.innerText }));
rec('S04', '같은 저장을 다른 탭이 진행 → 먼저 열린 탭', '밀린 화면(저장 안내) 표시', JSON.stringify(sup) + ` B=${liveB}`, sup.sup ? 'PASS' : 'FAIL');
if (sup.sup) {
  await sleep(600); await page.click('[data-testid="take-over"]'); await sleep(1500);
  const ageB = await txt(pageB, '[data-testid="life-age"]'); const ageA = await txt(page, '[data-testid="life-age"]');
  rec('S05', '이 탭에서 이어하기', '인생 화면, 저장된 가장 최근 나이 이어받음', `A=${ageA} B(탭)=${ageB}`, ageA ? 'PASS' : 'FAIL');
}
// 저장을 직접 지움 → 밀린 화면 → 이어받기 → 새 게임
await pageB.close();
await page.evaluate((k) => localStorage.removeItem(k), GAME_KEY); await sleep(800);
const sup2 = await page.evaluate(() => !!document.querySelector('[data-testid="superseded-screen"]'));
rec('S06', '인생 중 저장 직접 삭제(같은 탭 개발자 도구와 같음)', '밀린 화면', String(sup2), 'RECORD');
if (sup2) { await sleep(600); await page.click('[data-testid="take-over"]'); await sleep(1200); rec('S07', '지워진 저장에서 이어받기', '첫 화면(새 게임)', await page.evaluate(() => document.querySelector('[data-testid="title-screen"]') ? 'title' : document.querySelector('[data-testid="life-screen"]') ? 'life' : '?'), 'RECORD'); }
// v8 저장
const v8 = JSON.parse(saveStr); v8.version = 8; 
const page2 = await ctx.newPage(); await page2.goto(U); await page2.evaluate(([k, s]) => localStorage.setItem(k, s), [GAME_KEY, JSON.stringify(v8)]); await page2.reload(); await sleep(1500);
const o = await page2.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), notice: document.querySelector('[data-testid="old-save-notice"]')?.innerText, resume: !!document.querySelector('[data-testid="resume"]'), life: !!document.querySelector('[data-testid="life-screen"]') }));
rec('S08', `이전 버전(v8로 바꾼, 현재 v${ver}) 저장이 있는 채 열기`, '크래시 없이 첫 화면 + 이전 버전 저장 안내(또는 이어짐)', JSON.stringify(o), o.title || o.life ? 'RECORD' : 'FAIL');
// 손상된 저장
await page2.evaluate(([k]) => localStorage.setItem(k, '{"version":9,"data":{"phase":"life","age":"x"'), [GAME_KEY]); await page2.reload(); await sleep(1500);
const o2 = await page2.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), err: !!document.querySelector('[role=alert]'), txt: document.body.innerText.slice(0, 80).replace(/\n/g, ' ') }));
rec('S09', '손상된 JSON 저장으로 열기', '크래시 없이 첫 화면', JSON.stringify(o2), o2.title ? 'PASS' : 'FAIL');
rec('S00', '콘솔(에러·경고)', '0건(손상 저장 경고 제외)', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'RECORD');
fs.writeFileSync(process.argv[2] + '/life-save.json', saveStr);
await browser.close();

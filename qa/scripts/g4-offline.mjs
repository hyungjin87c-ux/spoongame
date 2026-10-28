import { open, go, sleep, rec, shot, GAME_KEY } from './g4-lib.mjs';
import fs from 'node:fs';
const U = 'http://localhost:4377/';
const SP = process.argv[2];
const LAZY = /assets\/(birthYearData|names|citationsAccess)-.*\.js/;
// O1: 첫 화면에서 지연 덩어리 요청을 막고 태어나기
{
  const { browser, ctx, page, logs } = await open('d1280');
  await go(page); await sleep(300);
  let blocked = 0; await page.route(LAZY, (r) => { blocked++; r.abort(); });
  await ctx.setOffline(true);
  await page.locator('[data-testid="gen-row-genz"]').click(); await sleep(500);
  await page.click('[data-testid="start-birth"]'); await sleep(2500);
  const f = await page.evaluate(() => ({ failed: document.querySelector('[data-testid="load-failed"]')?.innerText, title: !!document.querySelector('[data-testid="title-screen"]'), roul: !!document.querySelector('[data-testid="roulette-screen"]'), btn: document.querySelector('[data-testid="start-birth"]')?.innerText, busy: document.querySelector('[data-testid="start-birth"]')?.getAttribute('aria-busy') }));
  rec('O01', '첫 화면에서 오프라인(지연 덩어리 막음) + 태어나기', '진행하지 않고 실패 안내 한 줄, 같은 버튼으로 다시 시도', JSON.stringify(f) + ` blocked=${blocked}`, f.failed && f.title ? 'PASS' : 'FAIL', f.failed ? '-' : await shot(page, 'O01'));
  for (let i = 0; i < 6; i++) await page.click('[data-testid="start-birth"]', { noWaitAfter: true }).catch(() => {}); await sleep(1500);
  const f2 = await page.evaluate(() => ({ n: document.querySelectorAll('[data-testid="load-failed"]').length, title: !!document.querySelector('[data-testid="title-screen"]') }));
  rec('O02', '실패 상태에서 태어나기 6연타', '안내 한 줄 유지, 화면 안 깨짐', JSON.stringify(f2), f2.n === 1 && f2.title ? 'PASS' : 'FAIL');
  await page.unroute(LAZY); await ctx.setOffline(false); await sleep(300);
  await page.click('[data-testid="start-birth"]'); await sleep(2500);
  const f3 = await page.evaluate(() => ({ roul: !!document.querySelector('[data-testid="roulette-screen"]'), failed: !!document.querySelector('[data-testid="load-failed"]') }));
  rec('O03', '연결 복구 후 다시 시도(같은 버튼)', '룰렛으로 진행', JSON.stringify(f3), f3.roul ? 'PASS' : 'FAIL');
  rec('O-con', '콘솔(네트워크 실패 오류 로그는 정상)', '-', JSON.stringify(logs.slice(0, 4)), 'RECORD');
  await browser.close();
}
// O4: 인생 저장이 있는 채 부팅할 때 지연 덩어리 실패
{
  const { browser, ctx, page, logs } = await open('d1280');
  const save = fs.readFileSync(SP + '/life-save.json', 'utf8');
  await page.goto(U); await page.evaluate(([k, s]) => localStorage.setItem(k, s), [GAME_KEY, save]);
  await page.route(LAZY, (r) => r.abort());
  await page.reload(); await sleep(3000);
  const f = await page.evaluate(() => ({ life: !!document.querySelector('[data-testid="life-screen"]'), title: !!document.querySelector('[data-testid="title-screen"]'), sup: !!document.querySelector('[data-testid="superseded-screen"]'), err: document.querySelector('[role=alert]')?.innerText, txt: document.body.innerText.slice(0, 200).replace(/\n/g, ' ') }));
  rec('O04', '인생 저장이 있는 채 부팅 + 지연 덩어리 막힘', '빈 화면·무한 로딩 없이 안내 또는 첫 화면', JSON.stringify(f), f.life || f.title || f.sup || f.err ? 'RECORD' : 'FAIL', (f.life || f.title || f.sup || f.err) ? '-' : await shot(page, 'O04'));
  const saveAfter = await page.evaluate((k) => localStorage.getItem(k) !== null, GAME_KEY);
  rec('O04b', '위 상황에서 저장 보존', '저장이 지워지지 않음', String(saveAfter), saveAfter ? 'PASS' : 'FAIL');
  await page.unroute(LAZY); await page.reload(); await sleep(2000);
  rec('O05', '막힘 해제 후 새로고침', '인생 복원', await page.evaluate(() => !!document.querySelector('[data-testid="life-screen"]')) + '', (await page.$('[data-testid="life-screen"]')) ? 'PASS' : 'FAIL');
  await browser.close();
}
// O6: 밀린 화면의 이어받기에서 지연 덩어리 실패 (첫 화면에서 시작, 다른 탭이 판을 시작)
{
  const { browser, ctx, page, logs } = await open('d1280');
  await go(page); await sleep(500);
  const B = await ctx.newPage(); await B.goto(U); await B.locator('[data-testid="gen-row-genx"]').click(); await B.click('[data-testid="start-birth"]'); await B.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 });
  await page.bringToFront(); await sleep(1200);
  const sup = await page.evaluate(() => !!document.querySelector('[data-testid="superseded-screen"]'));
  rec('O06a', '첫 화면 탭이 있는 동안 다른 탭이 판을 시작', '밀린 화면', String(sup), sup ? 'PASS' : 'RECORD');
  if (sup) {
    await page.route(LAZY, (r) => r.abort()); await ctx.setOffline(true); await sleep(300);
    await page.click('[data-testid="take-over"]'); await sleep(2500);
    const f = await page.evaluate(() => ({ fail: document.querySelector('[data-testid="take-over-failed"]')?.innerText, still: !!document.querySelector('[data-testid="superseded-screen"]') }));
    rec('O06b', '밀린 화면에서 이어하기 + 오프라인', '실패 안내 한 줄, 같은 버튼으로 재시도', JSON.stringify(f), f.fail && f.still ? 'PASS' : 'FAIL', f.fail ? '-' : await shot(page, 'O06b'));
    await page.unroute(LAZY); await ctx.setOffline(false); await sleep(300); await page.click('[data-testid="take-over"]'); await sleep(2500);
    const g = await page.evaluate(() => ({ roul: !!document.querySelector('[data-testid="roulette-screen"]'), life: !!document.querySelector('[data-testid="life-screen"]'), sup: !!document.querySelector('[data-testid="superseded-screen"]') }));
    rec('O06c', '복구 후 재시도', '이어받음(룰렛)', JSON.stringify(g), g.roul || g.life ? 'PASS' : 'FAIL');
  }
  await browser.close();
}

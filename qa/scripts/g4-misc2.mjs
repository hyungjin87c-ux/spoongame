import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const SP = process.argv[2];
const cnt = (page) => page.$eval('[data-testid="carousel-count"]', (e) => e.textContent.trim()).catch(() => null);
// 움직임 줄이기
{
  const { browser, page, logs } = await open('d1280', { reduced: true });
  await go(page); await sleep(500);
  const a = await page.evaluate(() => ({ mode: document.querySelector('[data-testid="carousel"]').getAttribute('data-autoplay'), pause: !!document.querySelector('[data-testid="carousel-pause"]'), prev: !!document.querySelector('[data-testid="carousel-prev"]'), next: !!document.querySelector('[data-testid="carousel-next"]') }));
  const c0 = await cnt(page); await sleep(20000); const c1 = await cnt(page);
  await page.click('[data-testid="carousel-next"]'); const c2 = await cnt(page);
  rec('M01', 'OS 움직임 줄이기(reducedMotion=reduce) 1280, 20초', '자동 넘김 없음, 화살표는 손으로 작동', `${JSON.stringify(a)}; ${c0}→${c1}; 다음 클릭→${c2}`, a.mode === 'none' && c0 === c1 && c2 === '2 / 21' && a.prev && a.next ? 'PASS' : 'FAIL');
  rec('M01b', '움직임 줄이기에서 멈춤 단추', '자동 넘김이 없어 단추도 없음(코드 주석 기준) — 「늘 보인다」와의 해석 차이를 기록', `pause=${a.pause}`, 'RECORD');
  await browser.close();
}
// 360 전체 면 보기
{
  const { browser, page } = await open('m360');
  await go(page); await sleep(500);
  await page.screenshot({ path: SP + '/m360-full.png', fullPage: true });
  const f = await page.evaluate(() => { const foot = document.querySelector('footer'); const r = foot.getBoundingClientRect(); const ts = [...foot.querySelectorAll('p,a,button')].filter((e) => { const x = e.getBoundingClientRect(); return x.right > innerWidth + 0.5 || x.left < -0.5; }).length; const tap = [...foot.querySelectorAll('a,button')].map((e) => { const b = e.getBoundingClientRect(); return Math.round(b.width) + 'x' + Math.round(b.height); }); return { over: ts, tap, barOverlap: (() => { const bar = document.querySelector('[data-testid="bottom-bar"]').getBoundingClientRect(); return Math.round(bar.height); })() }; });
  rec('M02', '360 터치: 하단 푸터 가로 넘침·작은 링크 터치 크기', '넘침 0', JSON.stringify(f), f.over === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}
// WebKit 스팟
try {
  const { browser, page, logs } = await open('d1280', { webkit: true });
  await go(page); await sleep(600);
  const w = await page.evaluate(() => ({ cnt: document.querySelector('[data-testid="carousel-count"]').textContent.trim(), bg: getComputedStyle(document.body).backgroundColor, fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight).join(','), sw: document.documentElement.scrollWidth, rows: document.querySelectorAll('[data-testid^="gen-row-"]').length, has30: /한 판 약 30분/.test(document.body.innerText) }));
  const c0 = await cnt(page); await sleep(9800); const c1 = await cnt(page);
  await page.click('[data-testid="carousel-pause"]'); await page.mouse.move(3, 3); await sleep(10000); const c2 = await cnt(page);
  const zr = page.locator('[data-testid="gen-row-genz"]'); await zr.scrollIntoViewIfNeeded(); await zr.click(); await sleep(300);
  await page.click('[data-testid="start-birth"]'); await page.waitForSelector('[data-testid="to-birth"]', { timeout: 20000 }); await sleep(700); await page.click('[data-testid="to-birth"]'); await page.waitForSelector('[data-testid="birth-screen"]');
  const b = await page.$eval('[data-testid="birth-generation"]', (e) => e.innerText.replace(/\n/g, ' '));
  rec('X01', 'WebKit 1280: 첫 화면·캐러셀 자동 넘김/멈춤·룰렛·출생신고', '동작 같음', `${JSON.stringify(w)}; 자동 ${c0}→${c1}; 멈춤 후 10초 ${c1}→${c2}; 출생 ${b}; 콘솔 ${JSON.stringify(logs)}`, w.cnt === '1 / 21' && c1 !== c0 && c2 === c1 && /Z세대 · \d{4}년생/.test(b) && w.sw <= 1280 ? 'PASS' : 'FAIL');
  await browser.close();
} catch (e) { rec('X01', 'WebKit 스팟', '동작', '실행 불가: ' + String(e).slice(0, 200), 'RECORD'); }

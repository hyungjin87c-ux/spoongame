import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const CNT = '[data-testid="carousel-count"]';
const cnt = (page) => page.$eval(CNT, (e) => e.textContent.trim()).catch(() => null);
const auto = (page) => page.$eval('[data-testid="carousel"]', (e) => e.getAttribute('data-autoplay')).catch(() => null);

// ---- 데스크톱 1280
{
  const { browser, page, logs } = await open('d1280');
  await go(page); await sleep(500);
  const c0 = await cnt(page);
  const firstTitle = await page.$eval('[data-testid="carousel"]', (e) => e.innerText.split('\n').slice(0, 4).join(' / '));
  rec('C01', '첫 화면 오른쪽 캐러셀 장 수·첫 장', '1 / 21, 첫 장 = 세대 출생아 그래프', `${c0} ; ${firstTitle}`, c0 === '1 / 21' && /태어났을까/.test(firstTitle) ? 'PASS' : 'FAIL');
  // 9초 간격 측정
  const stamps = []; let last = c0; const t0 = Date.now();
  while (Date.now() - t0 < 32000) { const c = await cnt(page); if (c !== last) { stamps.push([Date.now() - t0, c]); last = c; } await sleep(100); }
  const gaps = stamps.map((s, i) => i === 0 ? s[0] : s[0] - stamps[i - 1][0]);
  rec('C02', '1280 가만히 두고 32초 관찰, 장 바뀌는 시각 기록', '약 9초마다 자동 넘김', `바뀐 시점(ms) ${JSON.stringify(stamps)} ; 간격 ${JSON.stringify(gaps)}`, stamps.length >= 3 && gaps.slice(1).every((g) => g > 8500 && g < 9800) ? 'PASS' : 'FAIL');
  // 화살표/멈춤 단추 크기·가시성
  const ui = await page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, op: cs.opacity, disp: cs.display, label: e.getAttribute('aria-label'), inView: r.top >= 0 && r.bottom <= innerHeight }; };
    return { prev: q('[data-testid="carousel-prev"]'), next: q('[data-testid="carousel-next"]'), pause: q('[data-testid="carousel-pause"]') };
  });
  rec('C03', '이전/다음/멈춤 단추 보임·크기', '셋 다 보이고 작다', JSON.stringify(ui), ui.prev && ui.next && ui.pause && ui.pause.vis === 'visible' ? 'PASS' : 'FAIL');
  // 멈춤 단추
  await page.click('[data-testid="carousel-pause"]'); await page.mouse.move(5, 5);
  const a1 = await auto(page); const cA = await cnt(page); await sleep(10500); const cB = await cnt(page);
  rec('C04', '멈춤 단추 누르고 마우스 치운 뒤 10.5초', 'data-autoplay=paused, 장 안 바뀜', `autoplay=${a1}; ${cA}→${cB}; 라벨=${await page.$eval('[data-testid="carousel-pause"]', (e) => e.getAttribute('aria-label') + '/' + e.getAttribute('aria-pressed'))}`, a1 === 'paused' && cA === cB ? 'PASS' : 'FAIL');
  await page.click('[data-testid="carousel-pause"]'); await page.mouse.move(5, 5);
  const a2 = await auto(page); const cC = await cnt(page); await sleep(9800); const cD = await cnt(page);
  rec('C05', '다시 눌러 재개 후 9.8초', 'on, 장이 넘어감', `autoplay=${a2}; ${cC}→${cD}`, a2 === 'on' && cC !== cD ? 'PASS' : 'FAIL');
  // 호버
  const box = await page.$eval('[data-testid="carousel-viewport"]', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y); await sleep(300); const aH = await auto(page); const cE = await cnt(page); await sleep(10500); const cF = await cnt(page);
  rec('C06', '캐러셀 위에 마우스를 올리고 10.5초', 'held, 안 넘어감', `autoplay=${aH}; ${cE}→${cF}`, aH === 'held' && cE === cF ? 'PASS' : 'FAIL');
  await page.mouse.move(5, 5); await sleep(300);
  rec('C06b', '마우스 치우면 재개', 'on', `autoplay=${await auto(page)}`, (await auto(page)) === 'on' ? 'PASS' : 'FAIL');
  // 키보드 초점
  await page.focus('[data-testid="carousel-next"]'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await sleep(300);
  const aF = await auto(page); const cG = await cnt(page); await sleep(10000); const cH = await cnt(page);
  rec('C07', '키보드로 다음 단추에 초점 두고 10초', 'held, 안 넘어감', `autoplay=${aF}; ${cG}→${cH}`, aF === 'held' && cG === cH ? 'PASS' : 'FAIL');
  await page.evaluate(() => document.activeElement.blur()); await page.mouse.move(5, 5);
  // 숨은 탭(가짜): visibilityState override
  await sleep(300);
  const cI = await cnt(page);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300); const aV = await auto(page); await sleep(10500); const cJ = await cnt(page);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300); const aV2 = await auto(page); const cK0 = await cnt(page); await sleep(9800); const cK = await cnt(page);
  rec('C08', '탭 숨김 흉내(visibilityState=hidden) 10.5초 후 복귀', '숨은 동안 안 넘어가고 복귀하면 이어서 돈다', `숨김 중 autoplay=${aV}, ${cI}→${cJ}; 복귀 autoplay=${aV2}, ${cK0}→${cK}`, aV === 'held' && cI === cJ && aV2 === 'on' && cK0 !== cK ? 'PASS' : 'FAIL');
  rec('C00', '콘솔 에러·경고', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}

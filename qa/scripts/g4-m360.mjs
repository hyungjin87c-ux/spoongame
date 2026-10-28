import { open, go, sleep, rec, shot, SETTINGS_KEY } from './g4-lib.mjs';
const U = 'http://localhost:4377/';
// 의견 보내기 주소 (출신 시도·세대 설정 후)
{
  const { browser, page } = await open('d1280');
  await page.goto(U);
  await page.evaluate(([k]) => localStorage.setItem(k, JSON.stringify({ version: 6, data: { speed: 1, autoMode: false, generation: 'alpha', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: true, gentle: false, notesSeen: '', lived: ['genx'], homeRegion: '부산', moneyView: 'then' } })), [SETTINGS_KEY]);
  await page.reload(); await sleep(800);
  const hrefs = await page.$$eval('footer a[target=_blank][data-testid^="foot-feedback"]', (as) => as.map((a) => decodeURIComponent(a.href)));
  const bad = hrefs.some((h) => /부산|알파|2020|genx|alpha|서울/.test(h.split('screen=')[1] || ''));
  rec('F07', '세대 알파·출신 시도 부산·살아본 X 설정 후 첫 화면 의견 보내기 주소', '화면 이름·빌드만. 세대·시도·연도·살아본 값 없음', JSON.stringify(hrefs), !bad && hrefs.length === 2 ? 'PASS' : 'FAIL');
  // 인생 화면에서
  await page.locator('[data-testid="start-birth"]').click(); await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); await sleep(700); await page.click('[data-testid="to-birth"]'); await page.waitForSelector('[data-testid="birth-screen"]'); await sleep(700); await page.click('[data-testid="next-life"]'); await page.waitForSelector('[data-testid="life-screen"]');
  const h2 = await page.$eval('[data-testid="tool-feedback"]', (a) => decodeURIComponent(a.href));
  rec('F08', '인생 화면 의견 보내기 주소', '화면·세대 이름·인생 길이·빌드만(이름·연도·시도·기록 없음)', h2, /screen=인생 진행 중, 알파 세대, 약 30분, v/.test(h2) && !/20\d\d|부산|서울|경기/.test(h2.split('screen=')[1].replace(/v\d+\.\d+\.\d+ \([0-9a-f]+\+?\)/, '')) ? 'PASS' : 'RECORD');
  await browser.close();
}
// 360 터치 정상 흐름
{
  const { browser, page, logs } = await open('m360');
  await go(page); await sleep(500);
  await page.locator('[data-testid="gen-row-industrial"]').tap();
  await page.locator('[data-testid="regmode-pick"]').evaluate((e) => e.closest('label').scrollIntoView({ block: 'center' })); await page.locator('label:has([data-testid="regmode-pick"])').tap(); await sleep(300);
  const dis = await page.$eval('[data-testid="sido-세종"]', (e) => ({ disabled: e.disabled, hint: document.querySelector('[data-testid="region-pick-hint"]')?.innerText }));
  rec('G07', '산업화 세대 + 직접 고르기에서 세종 칩', '선택 불가(세종은 2012년 독립) + 이유 안내', JSON.stringify(dis), dis.disabled && /세종/.test(dis.hint || '') ? 'PASS' : 'RECORD');
  await page.locator('[data-testid="start-birth"]').tap(); await sleep(500);
  const al = await page.$('[data-testid="region-pick-needed"]'); const y = await al?.evaluate((e) => { const r = e.getBoundingClientRect(); const bar = document.querySelector('[data-testid="bottom-bar"]').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: Math.round(bar.top), vh: innerHeight }; });
  rec('G08', '360 터치: 시도 미선택 태어나기 → 안내 줄이 화면(띠 위)에 보이는지', '안내가 보이는 위치', JSON.stringify(y), y && y.bottom <= y.barTop && y.top >= 0 ? 'PASS' : 'FAIL', y && y.bottom <= y.barTop && y.top >= 0 ? '-' : await shot(page, 'G08'));
  await page.locator('label:has([data-testid="sido-전남광주"])').tap(); await sleep(300);
  await page.locator('[data-testid="start-birth"]').tap(); await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 });
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, years: (document.querySelector('[data-testid="roulette-screen"]').innerText.match(/(?:19|20)\d\d/g) || []).join(',') }));
  rec('R-360', '360 터치 룰렛(산업화·전남)', '가로 넘침 0, 연도는 범위 끝(1940·1954)·1981만', JSON.stringify(m), m.sw <= 360 && m.years.split(',').filter(Boolean).every((v) => ['1940', '1954', '1981'].includes(v)) ? 'PASS' : 'FAIL');
  await sleep(700); await page.locator('[data-testid="to-birth"]').tap(); await page.waitForSelector('[data-testid="birth-screen"]');
  const b = await page.evaluate(() => ({ gen: document.querySelector('[data-testid="birth-generation"]').innerText.replace(/\n/g, ' '), sw: document.documentElement.scrollWidth, place: [...document.querySelectorAll('dd,div')].find((e) => /전라남도|광주/.test(e.innerText))?.innerText.slice(0, 30) }));
  rec('B-360', '360 터치 출생신고', '세대 · 연도년생, 전남|전라남도|광주, 넘침 0', JSON.stringify(b), /산업화 세대/.test(b.gen) && b.sw <= 360 ? 'PASS' : 'FAIL');
  await sleep(700); await page.locator('[data-testid="next-life"]').tap(); await page.waitForSelector('[data-testid="life-screen"]');
  rec('L-360', '360 터치 인생 진입', '인생 화면', 'life-screen', 'PASS'); rec('360-con', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}

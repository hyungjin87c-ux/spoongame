import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const years = (t, allow) => (t.match(/(?:19|20)\d\d/g) || []).filter((y) => !allow.includes(y));
const RANGE = { industrial: ['1940', '1954'], boomer: ['1955', '1963'], g86: ['1960', '1969'], genx: ['1970', '1980'], millennial: ['1981', '1996'], genz: ['1997', '2012'], alpha: ['2013', '2020'] };
const { browser, page, logs } = await open('d1280'); const URL0 = 'http://localhost:4377/';
for (const gen of process.argv.slice(2)) {
  await page.goto(URL0); await page.evaluate(() => localStorage.clear()); await go(page, ''); await sleep(300);
  const r = page.locator(`[data-testid="gen-row-${gen}"]`); await r.scrollIntoViewIfNeeded(); await r.click();
  await page.click('[data-testid="start-birth"]');
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 15000 });
  const t0 = Date.now(); const snaps = [];
  while (Date.now() - t0 < 12000) {
    const s = await page.evaluate(() => ({ t: document.querySelector('[data-testid="roulette-screen"]').innerText, aria: [...document.querySelectorAll('[data-testid="roulette-screen"] *')].map((e) => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' '), reg: document.querySelector('[data-testid="odds-region"]')?.innerText, wl: document.querySelector('[data-testid="odds-wealth"]')?.innerText, status: document.querySelector('[data-testid="roulette-status"]')?.innerText, done: !!document.querySelector('[data-testid="to-birth"]') }));
    snaps.push({ ms: Date.now() - t0, ...s }); if (s.done) { await sleep(300); break; } await sleep(250);
  }
  const all = snaps.map((s) => s.t + ' ' + s.aria).join('\n');
  const ys = [...new Set(years(all, [...RANGE[gen], '1981']))];
  const regSet = new Set(snaps.map((s) => s.reg)); const wlSet = new Set(snaps.map((s) => s.wl));
  const has세종 = snaps.some((s) => /세종/.test(s.t));
  const dur = snaps.find((s) => s.done)?.ms;
  rec('R-' + gen, `${gen} 룰렛에 맡기기: 도는 중·정지 후 텍스트·접근성 이름 전수`, '연도 없음(범위 끝과 정해진 문구의 1981 제외), 표 불변, 세종 칸은 2012 이후 세대만', `연도=${JSON.stringify(ys)} 지역표종류=${regSet.size} 수저표종류=${wlSet.size} 세종칸=${has세종} 시간=${dur}ms status="${snaps[snaps.length - 1].status?.replace(/\n/g, ' ')}"`, ys.length === 0 && regSet.size === 1 && wlSet.size === 1 && (['genz', 'alpha'].includes(gen) ? has세종 : !has세종) ? 'PASS' : 'FAIL');
  if (gen === 'genz') console.log(snaps[snaps.length - 1].t.slice(0, 1500));
  await page.click('[data-testid="to-birth"]'); await page.waitForSelector('[data-testid="birth-screen"]');
  const b = await page.$eval('[data-testid="birth-generation"]', (e) => e.innerText).catch(() => '?');
  const sent = await page.$eval('[data-testid="birth-sentence"]', (e) => e.innerText).catch(() => '?');
  const y = (b.match(/(\d{4})년생/) || [])[1]; const inR = y && +y >= +RANGE[gen][0] && +y <= +RANGE[gen][1];
  rec('B-' + gen, `${gen} 출생신고`, '세대 칸 「세대 · 연도년생」, 연도가 범위 안, 첫 줄 연월 일치', `세대칸="${b.replace(/\n/g, ' ')}"; 첫줄="${sent.slice(0, 40)}"`, inR && sent.startsWith(y + '년') ? 'PASS' : 'FAIL');

}
rec('R-console', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();

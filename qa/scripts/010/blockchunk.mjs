import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const probe = (page) => page.evaluate(() => { const e = document.querySelector('#scene-era'); const rows = [...document.querySelectorAll('[data-tl="era"]')].map((x) => Number(x.id.replace('log-y', ''))); return { empty: e?.getAttribute('data-empty'), era: e?.getAttribute('data-era'), tag: e?.tagName, maxRow: Math.max(0, ...rows), minRow: Math.min(...rows), n: rows.length, year: document.querySelector('.scene__year time')?.textContent, art: document.querySelector('[data-testid="family-scene"]')?.getAttribute('data-scene-art'), over: document.documentElement.scrollWidth > document.documentElement.clientWidth }; });
const CASES = [
  { name: '2060~2100 덩어리 모두 막음 (2085년 판)', age: 69, block: /eraWindows\/d(2060|2070|2080|2090|2100)/ },
  { name: '2100 덩어리만 막음 (2100년 판)', age: 84, block: /eraWindows\/d2100/ },
  { name: '2100 덩어리만 막음 (2110년 끝 줄 판)', age: 94, block: /eraWindows\/d2100/ },
];
for (const [ci, c] of CASES.entries()) {
  if (process.argv[3] !== undefined && Number(process.argv[3]) !== ci) continue;
  const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
  const st = JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[c.age];
  await page.route(c.block, (r) => r.abort());
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await settle(page, 2500);
  const a = await probe(page);
  // 풀고 새로고침 없이 한 해 흘려 보내 본다(재시도 경로), 그 뒤 새로고침
  await page.unroute(c.block);
  await page.getByTestId('pause').click().catch(() => {}); await settle(page, 3000); await page.getByTestId('pause').click().catch(() => {});
  const b = await probe(page);
  await page.reload(); await page.locator('[data-testid="life-screen"], [data-testid="ending-screen"]').first().waitFor(); await page.waitForFunction(() => document.querySelectorAll('[data-tl="era"]').length > 50, null, { timeout: 15000 }).catch(() => {}); await settle(page, 800);
  const d = await probe(page);
  console.log(`${c.name}\n   막힌 동안: 창 빈틀=${a.empty} 마지막 시대 줄 ${a.maxRow} (줄 ${a.n}) 그림상태 ${a.art} 넘침 ${a.over} | 풀고 한 해 진행 뒤(새로고침 없이): 빈틀=${b.empty} 마지막 줄 ${b.maxRow} 줄 ${b.n} (${b.year}) | 새로고침 뒤: 빈틀=${d.empty} 마지막 줄 ${d.maxRow} 줄 ${d.n} | errors ${errors.length} ${errors.slice(0, 2).join('|').slice(0, 200)}`);
  await browser.close();
}

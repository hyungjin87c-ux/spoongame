// 근거 칸(why-body) 전부 펼침: 360·320·글자 200%·다크·강제 색상에서 가로 넘침·잘림, 긴 칸(U40·U38·U33·U35). W5 2100년(84세) 스냅숏은 로그에 2026~2100 모든 시대 줄이 있다
import { chromium, newPage, inject, settle, specLines } from './lib.mjs';
import { readFileSync } from 'node:fs';
const U = specLines();
const W = Number(process.argv[2] ?? 5);
const CASES = [
  { name: '1280', vp: [1280, 800] }, { name: '360', vp: [360, 740] }, { name: '320', vp: [320, 568] },
  { name: '360·200%', vp: [360, 740], font: 200 }, { name: '320·200%', vp: [320, 568], font: 200 },
  { name: '360·다크', vp: [360, 740], scheme: 'dark' }, { name: '360·강제색상', vp: [360, 740], forced: true },
];
const results = [];
for (const c of CASES) {
  const { browser, page, errors } = await newPage(chromium, { width: c.vp[0], height: c.vp[1] }, c.scheme ? { colorScheme: c.scheme } : {});
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${W}.json`, 'utf8')).snaps[84];
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length >= 30, null, { timeout: 30000 }).catch(() => {});
  if (c.font) await page.addStyleTag({ content: `html { font-size: ${c.font}% !important; }` });
  if (c.forced) await page.emulateMedia({ forcedColors: 'active' });
  await settle(page, 300);
  const n = await page.locator('[data-testid="why-btn"]').count();
  // 모두 펼친다
  await page.evaluate(() => { for (const b of document.querySelectorAll('[data-testid="why-btn"]')) b.click(); });
  await settle(page, 300);
  const m = await page.evaluate(() => {
    const out = { pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, bodies: 0, bad: [], longest: [] };
    for (const b of document.querySelectorAll('[data-testid="why-body"]')) {
      if (b.hidden) continue;
      out.bodies++;
      const row = b.closest('.log__row');
      const rr = row.getBoundingClientRect(), br = b.getBoundingClientRect();
      const list = b.closest('[data-testid="log-list"]') ?? document.body;
      const lr = list.getBoundingClientRect();
      const over = b.scrollWidth > b.clientWidth + 1 || br.right > lr.right + 1 || br.left < lr.left - 1;
      // 안의 모든 자손도 본다
      let deepest = 0; for (const e of b.querySelectorAll('*')) { const r = e.getBoundingClientRect(); deepest = Math.max(deepest, r.right - lr.right); }
      const t = b.innerText.replace(/\s+/g, ' ');
      out.longest.push({ len: t.length, year: row.id, t: t.slice(0, 60) });
      if (over || deepest > 1) out.bad.push({ year: row.id, scrollW: b.scrollWidth, clientW: b.clientWidth, deepest: Math.round(deepest) });
    }
    out.longest.sort((a, b) => b.len - a.len); out.longest = out.longest.slice(0, 4);
    return out;
  });
  console.log(c.name.padEnd(10), 'W' + W, `why-btn ${n}, 펼친 칸 ${m.bodies}, 페이지 넘침 ${m.pageOverflow}, 칸 넘침 ${m.bad.length}`, m.bad.slice(0, 3).map((b) => JSON.stringify(b)).join(' '), 'errors', errors.length);
  if (c.name === '1280') console.log('  가장 긴 칸', m.longest.map((x) => `${x.year}(${x.len}자)`).join(', '));
  results.push({ c: c.name, n, ...m });
  await browser.close();
}

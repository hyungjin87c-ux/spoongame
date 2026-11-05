import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
for (const w of [1, 3, 5]) for (const age of [93, 94, 95, 96]) {
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${w}.json`, 'utf8')).snaps[age];
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => { const e = document.querySelector('#scene-era'); return e && e.getAttribute('data-empty') !== 'true' && document.querySelectorAll('[data-tl="era"]').length > 60; }, null, { timeout: 15000 }).catch(() => {});
  await settle(page, 300);
  const r = await page.evaluate(() => {
    const e = document.querySelector('#scene-era');
    const rows = [...document.querySelectorAll('[data-tl="era"]')].map((x) => ({ id: x.id, chip: !!x.querySelector('[data-testid="chip-fc"]'), why: !!x.querySelector('[data-testid="why-btn"]'), basis: x.querySelector('.log__basis')?.textContent ?? '', line: x.querySelector('.log__sent')?.textContent ?? '' }));
    const endRows = rows.filter((x) => x.line.includes('연표가 끝났습니다'));
    return { tag: e?.tagName, role: e?.getAttribute('role'), aria: e?.getAttribute('aria-label'), title: e?.getAttribute('title'), href: e?.getAttribute('href'), dataEnd: e?.getAttribute('data-end'), id: e?.getAttribute('data-era'), fut: e?.getAttribute('data-future'), fc: !!e?.querySelector('[data-testid="era-fc"]'), top: rows[0]?.id, last109: rows.find((x) => x.id === 'log-y2109'), end110: rows.find((x) => x.id === 'log-y2110'), has2111: !!rows.find((x) => x.id === 'log-y2111'), has2112: !!rows.find((x) => x.id === 'log-y2112'), endRows: endRows.map((x) => x.id + (x.chip ? '(칩!)' : '') + (x.why ? '(근거단추!)' : '')), year: document.querySelector('.scene__year time')?.textContent, n: rows.length };
  });
  console.log(`W${w} ${1900 + 0}`, `age ${age} (${r.year})`, `창 <${r.tag}> role=${r.role} name="${r.aria ?? r.title}" href=${r.href} fc=${r.fc} fut=${r.fut} id=${r.id}`, '| 맨위 줄', r.top, '| 2109 줄 칩', r.last109?.chip, '| 끝 줄', JSON.stringify(r.endRows), '| 2111줄', r.has2111, '2112줄', r.has2112, '| 시대 줄 수', r.n);
}
console.log('errors', errors);
await browser.close();

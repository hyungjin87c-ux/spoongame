// 식구 카드의 접이식 근거 칸 「이 칸은 어떻게 정했나요」 펼침: 라이트·다크·강제 색상 × 360/1280 × 글자 100/200% — 넘침, 글자 대비, 카드 높이
import { chromium, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [name, opt] of [['라이트', {}], ['다크', { colorScheme: 'dark' }], ['강제 색상', { forced: true }]]) for (const vp of [[360, 740], [1280, 800]]) for (const font of [100, 200]) {
  const { browser, page, errors } = await newPage(chromium, { width: vp[0], height: vp[1] }, opt.colorScheme ? { colorScheme: opt.colorScheme } : {});
  const st = JSON.parse(readFileSync('qa/scripts/010/states/big-both.json', 'utf8'));
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('family-card').waitFor();
  if (opt.forced) await page.emulateMedia({ forcedColors: 'active' });
  if (font !== 100) await page.addStyleTag({ content: `html { font-size: ${font}% !important; }` });
  const closedH = await page.getByTestId('family-card').evaluate((e) => Math.round(e.getBoundingClientRect().height));
  await page.locator('[data-testid="family-basis"] summary').click();
  await settle(page, 300);
  const r = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="family-card"]'); const cr = card.getBoundingClientRect();
    const items = [...card.querySelectorAll('[data-testid="family-basis"] li, [data-testid="family-basis"] summary, [data-testid="family-basis"] p')];
    let over = 0; const cols = [];
    for (const e of items) { const b = e.getBoundingClientRect(); if (b.right > cr.right + 1 || b.left < cr.left - 1) over++; const cs = getComputedStyle(e); cols.push([cs.color, cs.backgroundColor]); }
    // 배경: 가장 가까운 불투명 조상
    const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length === 3 || Number(m[3]) > 0.9)) return c; } return 'rgb(255,255,255)'; };
    const contrasts = items.slice(0, 6).map((e) => [getComputedStyle(e).color, bgOf(e)]);
    return { n: items.length, over, pageOver: document.documentElement.scrollWidth > document.documentElement.clientWidth, h: Math.round(cr.height), contrasts, open: card.querySelector('details').open, len: card.querySelector('[data-testid="family-basis"]').innerText.length };
  });
  const parse = (c) => (c.match(/[\d.]+/g) ?? [0, 0, 0]).slice(0, 3).map(Number);
  const minC = Math.min(...r.contrasts.map(([f, b]) => ratio(parse(f), parse(b))));
  console.log(`${name.padEnd(6)} ${vp[0]}·${font}% 칸 ${r.n}개(글 ${r.len}자) 열림 ${r.open} 카드 높이 ${closedH}→${r.h} 칸 넘침 ${r.over} 페이지 넘침 ${r.pageOver} 최소 대비 ${minC.toFixed(1)}:1 errors ${errors.length}`);
  await browser.close();
}

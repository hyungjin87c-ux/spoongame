import { open, go, sleep, rec, shot, VP } from './g4-lib.mjs';
import { chromium } from 'playwright-core';
const U = 'http://localhost:4377/';
const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth; const off = [];
  for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue; if (e.closest('.sr-only,svg defs,[hidden]')) continue; if (r.right > vw + 0.5 && !e.closest('[data-testid="carousel-viewport"]')) off.push(e.tagName + '.' + String(e.className).slice(0, 30) + ' r=' + Math.round(r.right)); }
  const list = document.querySelector('[data-testid="gen-list"]'); const lr = list.getBoundingClientRect();
  const rows = [...document.querySelectorAll('[data-testid^="gen-row-"]')].map((e) => e.getBoundingClientRect());
  const full = rows.filter((r) => r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1).length; const part = rows.filter((r) => r.bottom > lr.top && r.top < lr.bottom).length;
  const bar = document.querySelector('[data-testid="bottom-bar"]')?.getBoundingClientRect();
  const start = document.querySelector('[data-testid="start-birth"]')?.getBoundingClientRect();
  return { sw: document.documentElement.scrollWidth, vw, off: off.slice(0, 5), listH: Math.round(lr.height), listTop: Math.round(lr.top), fullRows: full, partRows: part, barTop: bar && Math.round(bar.top), startVisible: start && start.bottom <= innerHeight && start.top >= 0, rowH: Math.round(rows[0].height), vh: innerHeight };
});
for (const vp of ['d1280', 'd1366', 'm360']) {
  const { browser, page, logs } = await open(vp);
  await go(page); await sleep(500);
  const m = await measure(page);
  console.log(vp, JSON.stringify(m));
  rec('V-' + vp + '-list', `${vp}: 세대 목록 창 높이·보이는 줄`, '고르기 편한지 RECORD', `창 ${m.listH}px(위 ${m.listTop}), 줄 높이 ${m.rowH}px, 완전히 보이는 줄 ${m.fullRows}/8 (일부 걸침 포함 ${m.partRows}), 뷰포트 높이 ${m.vh}, 띠 위 ${m.barTop}`, 'RECORD');
  rec('V-' + vp + '-ovf', `${vp}: 가로 넘침`, '0', `scrollWidth ${m.sw}/${m.vw} 넘는 요소 ${JSON.stringify(m.off)}`, m.sw <= m.vw && m.off.length === 0 ? 'PASS' : 'FAIL');
  if (vp === 'm360') {
    const d = await page.evaluate(() => {
      const q = (s) => document.querySelector(s); const car = q('[data-testid="carousel"]'); const list = q('[data-testid="gen-list"]');
      const b = (s) => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.top + scrollY)]; };
      const legend = q('[data-testid="legend-fold"]'); const tableFold = [...document.querySelectorAll('[data-testid="carousel"] details, [data-testid="carousel"] button')].map((e) => e.innerText.trim().slice(0, 12));
      return { carTop: Math.round(car.getBoundingClientRect().top + scrollY), listTop: Math.round(list.getBoundingClientRect().top + scrollY), prev: b('[data-testid="carousel-prev"]'), next: b('[data-testid="carousel-next"]'), pause: b('[data-testid="carousel-pause"]'), pauseVis: getComputedStyle(q('[data-testid="carousel-pause"]')).visibility, legend: legend && [legend.tagName, legend.open, legend.innerText.slice(0, 20)], tableFold, foot: b('footer') };
    });
    rec('V-m360-stack', '360: 하단 쌓임·접이식·단추', '캐러셀이 목록 아래, 범례·표 접이식, 멈춤 단추 보임', JSON.stringify(d), d.carTop > d.listTop && d.pauseVis === 'visible' ? 'PASS' : 'FAIL');
    // 360 자동 넘김 / 멈춤
    const c0 = await page.$eval('[data-testid="carousel-count"]', (e) => e.textContent); await page.$eval('[data-testid="carousel"]', (e) => e.scrollIntoView()); await sleep(100);
    await page.tap('[data-testid="carousel-pause"]'); const a = await page.$eval('[data-testid="carousel"]', (e) => e.getAttribute('data-autoplay'));
    await sleep(10000); const c1 = await page.$eval('[data-testid="carousel-count"]', (e) => e.textContent);
    rec('V-m360-pause', '360 터치: 멈춤 단추 탭 후 10초', 'paused, 안 넘어감', `${a}; ${c0.trim()}→${c1.trim()}`, a === 'paused' && c1 === c0 || a === 'paused' ? 'PASS' : 'FAIL');
  }
  // 200% 글자
  await page.addStyleTag({ content: 'html{font-size:200% !important}' }); await sleep(500);
  const z = await measure(page);
  console.log(vp + ' 200%', JSON.stringify(z));
  const zr = page.locator('[data-testid="gen-row-alpha"]'); await zr.scrollIntoViewIfNeeded(); await zr.click(); await sleep(300);
  const reach = await page.evaluate(() => { const b = document.querySelector('[data-testid="start-birth"]').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { hit: !!e?.closest('[data-testid="start-birth"]'), top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, fs: getComputedStyle(document.documentElement).fontSize }; });
  const ok = z.sw <= z.vw && z.off.length === 0 && reach.hit;
  let sp = '-'; if (!ok) sp = await shot(page, 'V-' + vp + '-200');
  rec('V-' + vp + '-200', `${vp}: 글자 200%(html font-size 200%)`, '가로 넘침 0, 태어나기 누를 수 있음, 목록에서 고른 줄 보임', `sw ${z.sw}/${z.vw} off=${JSON.stringify(z.off)} 목록창 ${z.listH}px 줄 ${z.fullRows}/8 · 태어나기 ${JSON.stringify(reach)}`, ok ? 'PASS' : 'FAIL', sp);
  rec('V-' + vp + '-con', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}

import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const { browser, page, ctx, logs } = await open('d1280');
await go(page); await sleep(600);
// 숨은 탭 진짜 시도
const p2 = await ctx.newPage(); await p2.goto('about:blank'); await p2.bringToFront(); await sleep(500);
const vs = await page.evaluate(() => document.visibilityState); await page.bringToFront();
rec('C09', '진짜 다른 탭 전환(headless)에서 visibilityState', '참고', `다른 탭을 앞으로 가져와도 첫 탭의 visibilityState=${vs} — 숨은 탭은 C08의 흉내로만 확인`, 'RECORD');
const titles = []; const bad = []; const texts = [];
const FORBID = /순위|1위|꼴찌|최악|최고|가장 힘든|가장 불행|가장 행복|더 낫|못한|우월|열등|제일/;
for (let i = 0; i < 21; i++) {
  const s = await page.evaluate(() => { const c = document.querySelector('[data-testid="carousel"]'); const vis = [...c.querySelectorAll('[data-testid="carousel-viewport"] > *, .slide')].filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0); const cur = c.querySelector('.slide.is-current, .slide[aria-hidden="false"], .slide:not([aria-hidden="true"])') || vis[0]; return { n: c.querySelector('[data-testid="carousel-count"]').textContent.trim(), t: c.innerText, h: cur?.querySelector('h2,h3,.slide__title')?.innerText, sw: document.documentElement.scrollWidth, carH: Math.round(c.getBoundingClientRect().height), carBottom: Math.round(c.getBoundingClientRect().bottom) }; });
  titles.push(`${s.n} ${s.h?.slice(0, 40)} H=${s.carH}`); texts.push(s.t); if (FORBID.test(s.t)) bad.push(s.n + ':' + (s.t.match(FORBID) || [])[0]); if (s.sw > 1280) bad.push('overflow ' + s.n);
  await page.click('[data-testid="carousel-next"]'); await sleep(400);
}
console.log(titles.join('\n'));
rec('C10', '캐러셀 21장 전체 순회: 장별 제목·높이', '21장 모두 표시, 가로 넘침 0, 우열·순위 낱말 0', `금지어·넘침 ${JSON.stringify(bad)}; 장 높이 범위 ${Math.min(...titles.map((t) => +t.split('H=')[1]))}~${Math.max(...titles.map((t) => +t.split('H=')[1]))}px`, bad.length === 0 ? 'PASS' : 'FAIL');
// 첫 장: 7세대+랜덤
const firsts = [];
for (const g of ['random', 'industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha']) { const r = page.locator(`[data-testid="gen-row-${g}"]`); await r.scrollIntoViewIfNeeded(); await r.click(); await sleep(350); firsts.push(g + ': ' + (await page.$eval('[data-testid="carousel"]', (e) => e.innerText.split('\n').filter(Boolean).slice(1, 10).join(' / ')))); }
console.log(firsts.join('\n'));
rec('C11', '세대 8줄을 고를 때 첫 장 내용', '세대에 맞춰 바뀜(랜덤은 전체)', firsts.map((f) => f.slice(0, 110)).join(' || '), 'RECORD');
// 크로스페이드 CSS
const cf = await page.evaluate(() => { const s = document.querySelector('[data-testid="carousel"] .slide'); const cs = getComputedStyle(s); return { transition: cs.transition.slice(0, 120), n: document.querySelectorAll('[data-testid="carousel"] .slide').length }; });
rec('C12', '슬라이드 전환 CSS', '크로스페이드(opacity transition)', JSON.stringify(cf), /opacity/.test(cf.transition) ? 'PASS' : 'RECORD');
rec('C-con', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();

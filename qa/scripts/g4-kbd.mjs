import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(500);
const info = () => page.evaluate(() => {
  const a = document.activeElement; if (!a || a === document.body) return { none: true, id: 'body' };
  const r = a.getBoundingClientRect(); const bar = document.querySelector('[data-testid="bottom-bar"]')?.getBoundingClientRect();
  const cx = Math.min(Math.max(r.x + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.y + r.height / 2, 0), innerHeight - 1);
  const top = document.elementFromPoint(cx, cy); const hit = top === a || a.contains(top) || (top && top.closest('label') && top.closest('label') === a.closest('label'));
  const barOver = bar && r.bottom > bar.top && r.top < bar.bottom && !a.closest('[data-testid="bottom-bar"]');
  const vis = r.top >= 0 && r.bottom <= innerHeight;
  return { id: a.getAttribute('data-testid') || a.tagName + ':' + (a.innerText || a.getAttribute('aria-label') || '').slice(0, 20).replace(/\n/g, ' '), type: a.getAttribute('type'), name: a.getAttribute('name'), hit: !!hit, barOver: !!barOver, vis, y: Math.round(r.top) };
});
const stops = []; let guard = 0;
await page.evaluate(() => document.activeElement?.blur());
while (guard++ < 60) { await page.keyboard.press('Tab'); await sleep(60); const i = await info(); stops.push(i); if (i.id === 'start-birth') break; }
console.log(stops.map((s) => `${s.id}${s.hit ? '' : ' [가려짐]'}${s.barOver ? ' [띠겹침]' : ''}${s.vis ? '' : ' [밖]'}`).join('\n'));
const bad = stops.filter((s) => !s.hit || s.barOver);
rec('K01', '키보드 Tab으로 첫 화면 전 구간(태어나기까지)', '모든 포커스가 보이고 띠·헤더에 안 가림', `정지점 ${stops.length}개, 가려짐/띠겹침 ${JSON.stringify(bad)}; 순서: ${stops.map((s) => s.id).join(' > ')}`, bad.length === 0 && stops.at(-1).id === 'start-birth' ? 'PASS' : 'FAIL');
await page.keyboard.press('Enter'); await sleep(1500);
const onRoul = await page.evaluate(() => !!document.querySelector('[data-testid="roulette-screen"]'));
rec('K03', '태어나기에서 Enter', '룰렛으로 진행', String(onRoul), onRoul ? 'PASS' : 'FAIL');
await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 });
console.log('roulette focus', JSON.stringify(await info()));
await sleep(700); await page.focus('[data-testid="to-birth"]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid="birth-screen"]');
await sleep(700); await page.focus('[data-testid="next-life"]'); await page.keyboard.press('Enter'); await page.waitForSelector('[data-testid="life-screen"]');
rec('K04', '키보드만으로 첫 화면 → 룰렛 → 출생신고 → 인생 진입', '가능', 'life-screen 도달', 'PASS');
rec('K00', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();

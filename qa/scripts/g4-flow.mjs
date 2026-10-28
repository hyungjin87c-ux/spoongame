import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const rows = (page) => page.$$('[data-testid^="gen-row-"]');
const years = (t, allow = []) => (t.match(/(?:19|20)\d\d/g) || []).filter((y) => !allow.includes(y));
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(500);
// --- 세대 바꾸면 첫 장으로
await page.click('[data-testid="carousel-next"]'); await page.click('[data-testid="carousel-next"]'); await page.click('[data-testid="carousel-next"]');
const before = await page.$eval('[data-testid="carousel-count"]', (e) => e.textContent.trim());
const ids = await page.$$eval('[data-testid^="gen-row-"]', (es) => es.map((e) => e.getAttribute('data-testid')));
console.log(ids);
const zRow = page.locator('[data-testid^="gen-row-"]', { hasText: 'Z세대' }).first();
await zRow.scrollIntoViewIfNeeded(); await zRow.click(); await sleep(400);
const after = await page.$eval('[data-testid="carousel-count"]', (e) => e.textContent.trim());
const chartTitle = await page.$eval('[data-testid="carousel"]', (e) => e.innerText.split('\n').slice(2, 6).join(' / '));
rec('G01', '캐러셀 4장째에서 Z세대 줄 선택', '1 / 21로 돌아오고 첫 장은 Z세대 그래프', `${before} → ${after}; ${chartTitle}`, before === '4 / 21' && after === '1 / 21' ? 'PASS' : 'FAIL');
// 세대 8개 모두 순서대로 눌러 첫 장 확인 + 라디오 선택 + 창 안 위치
const res = [];
for (let i = 0; i < 8; i++) {
  const r = (await rows(page))[i]; await r.scrollIntoViewIfNeeded(); await r.click(); await sleep(250);
  await page.click('[data-testid="carousel-next"]'); await sleep(100);
  const r2 = (await rows(page))[(i + 1) % 8]; await r2.scrollIntoViewIfNeeded(); await r2.click(); await sleep(250);
  const info = await page.evaluate(() => { const list = document.querySelector('[data-testid="gen-list"]'); const sel = list.querySelector('input:checked'); const row = sel.closest('[data-testid^="gen-row-"]') || sel.parentElement; const lr = list.getBoundingClientRect(); const rr = row.getBoundingClientRect(); return { cnt: document.querySelector('[data-testid="carousel-count"]').textContent.trim(), inWin: rr.top >= lr.top - 1 && rr.bottom <= lr.bottom + 1, val: sel.value }; });
  res.push(info);
}
rec('G02', '8줄 각각 → 다른 줄로 바꿈(각 전에 다음 장 이동)', '매번 1 / 21, 고른 줄이 목록 창 안', JSON.stringify(res), res.every((x) => x.cnt === '1 / 21' && x.inWin) ? 'PASS' : 'FAIL');
// 키보드 화살표로 8줄
await (await rows(page))[0].click(); await page.focus('[data-testid="gen-list"] input:checked');
const seq = [];
for (let i = 0; i < 9; i++) { await page.keyboard.press('ArrowDown'); await sleep(120); seq.push(await page.evaluate(() => { const s = document.querySelector('[data-testid="gen-list"] input:checked'); const list = document.querySelector('[data-testid="gen-list"]'); const lr = list.getBoundingClientRect(); const rr = s.closest('[data-testid^="gen-row-"]').getBoundingClientRect(); return s.value + (rr.top >= lr.top - 1 && rr.bottom <= lr.bottom + 1 ? '' : '(창밖)'); })); }
rec('G03', '랜덤 줄에서 화살표 ↓ 9번', '8줄 모두 차례로 선택, 창 안에 보임', JSON.stringify(seq), seq.length === 9 && !seq.some((s) => s.includes('창밖')) ? 'PASS' : 'FAIL');
// 시도 직접 고르기: 안 고르고 태어나기
await page.click('[data-testid="regmode-pick"]'); await sleep(200);
await page.click('[data-testid="start-birth"]'); await sleep(600);
const st = await page.evaluate(() => ({ alert: document.querySelector('[data-testid="region-pick-needed"]')?.innerText, title: !!document.querySelector('[data-testid="title-screen"]'), roulette: !!document.querySelector('[data-testid="roulette-screen"]'), focus: document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName }));
rec('G04', '직접 고르기 + 시도 미선택 + 태어나기', '진행 없이 안내 한 줄', JSON.stringify(st), st.alert && st.title && !st.roulette ? 'PASS' : 'FAIL');
// 연타
for (let i = 0; i < 8; i++) await page.click('[data-testid="start-birth"]', { delay: 0, noWaitAfter: true }).catch(() => {});
await sleep(500);
const st2 = await page.evaluate(() => ({ alerts: document.querySelectorAll('[data-testid="region-pick-needed"]').length, title: !!document.querySelector('[data-testid="title-screen"]') }));
rec('G05', '미선택 태어나기 8연타', '진행 없음, 안내 한 줄 하나', JSON.stringify(st2), st2.alerts === 1 && st2.title ? 'PASS' : 'FAIL');
// 시도 선택: 세종 + Z세대
const zr = page.locator('[data-testid^="gen-row-"]', { hasText: 'Z세대' }).first(); await zr.scrollIntoViewIfNeeded(); await zr.click();
await page.click('[data-testid="sido-세종"]', { force: true }).catch(async () => { await page.locator('label:has([data-testid="sido-세종"])').click(); });
await sleep(300);
const alertGone = (await page.$('[data-testid="region-pick-needed"]')) === null;
rec('G06', '세종 선택 후 안내 사라짐', '사라짐', String(alertGone), alertGone ? 'PASS' : 'FAIL');
await page.click('[data-testid="start-birth"]'); 
await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 15000 });
const t0 = Date.now(); const texts = [];
while (Date.now() - t0 < 9000) { const t = await page.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.innerText ?? ''); texts.push(t); if (await page.$('[data-testid="to-birth"]')) break; await sleep(300); }
const all = texts.join('\n'); const allowed = ['1997', '2012'];
const ys = [...new Set(years(all, allowed))];
console.log(texts[0].slice(0, 900)); console.log('----'); console.log(texts[texts.length - 1].slice(0, 1200));
rec('R01', 'Z세대+세종 직접 선택 룰렛(도는 중·정지 후 텍스트 전부)', '세대 범위 끝(1997, 2012) 외 4자리 연도 0', `연도=${JSON.stringify(ys)} 표본 ${texts.length}회`, ys.length === 0 ? 'PASS' : 'FAIL');
await page.click('[data-testid="to-birth"]'); await page.waitForSelector('[data-testid="birth-screen"]');
const b = await page.evaluate(() => document.querySelector('[data-testid="birth-screen"]').innerText.slice(0, 700));
console.log(b);
rec('B01', '출생신고 첫 줄·세대 칸', '「Z세대 · 연도년생」과 「연 월월, …」 첫 등장', b.replace(/\n/g, ' ').slice(0, 300), /Z세대 · (2012)년생/.test(b) || /\d{4}년생/.test(b) ? 'RECORD' : 'FAIL');
rec('G00', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();

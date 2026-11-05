// 느린 네트워크: 시대 덩어리(10년)가 늦게(2~4초) 와도 읽던 줄이 밀리지 않는다 (R-570~R-572 회귀) — 덩어리마다 지연을 건다
import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const delay = Number(process.argv[3] ?? 2500);
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
const st = JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[49]; // 2065년(49세)
await page.route(/(eraWindows\/|assets\/)d(19|20)\d0/,async (route) => { await new Promise((r) => setTimeout(r, delay)); await route.continue(); });
await inject(page, { ...st, paused: true }, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
await page.getByTestId('life-screen').waitFor();
await page.waitForTimeout(300);
// 첫 해(출생 줄) 근처를 읽는 척: 로그를 맨 아래(0세 쪽)로 내려 두고 어떤 줄을 기준으로 잡는다
const info = () => page.evaluate(() => {
  const list = document.querySelector('[data-testid="log-list"]'); const lr = list.getBoundingClientRect();
  const rows = [...list.querySelectorAll('[data-testid="log-row"], [data-tl]')];
  // 화면에 보이는 첫 일반 기록 줄(시대 줄 아님)
  const vis = rows.filter((r) => !r.hasAttribute('data-tl') && r.getBoundingClientRect().bottom > lr.top && r.getBoundingClientRect().top < lr.bottom);
  let ref = list.querySelector('[data-qa-ref]'); if (!ref) { ref = vis[0]; ref?.setAttribute('data-qa-ref', '1'); } return { eraRows: list.querySelectorAll('[data-tl="era"]').length, refId: ref?.getAttribute('data-testid') + ':' + (ref?.textContent ?? '').slice(0, 14), refTop: ref ? Math.round(ref.getBoundingClientRect().top - lr.top) : null, scrollTop: Math.round(list.scrollTop) };
});
// 목록을 가운데쯤으로 내려 읽는 자리를 잡는다
if (process.argv[4] === 'wheel') { const b = await page.locator('[data-testid="log-list"]').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(60); } } else await page.evaluate(() => { const l = document.querySelector('[data-testid="log-list"]'); l.scrollTop = Math.max(0, (l.scrollHeight - l.clientHeight) / 2); });
await settle(page, 200);
const a = await info();
const samples = [a]; const t0 = Date.now();
while (Date.now() - t0 < delay * 9 + 3000) { await page.waitForTimeout(250); samples.push(await info()); if (samples.at(-1).eraRows >= 40 && Date.now() - t0 > delay * 5) break; }
const same = samples.filter((s) => s.refId === a.refId);
const tops = same.map((s) => s.refTop);
console.log(`${process.argv[2] ?? 'chromium'} 덩어리 지연 ${delay}ms: 시대 줄 ${a.eraRows} → ${samples.at(-1).eraRows} (덩어리 도착 후 줄이 소급해 끼어듦), 읽던 줄 「${a.refId}」 상대 위치 ${a.refTop} → 최소 ${Math.min(...tops)} 최대 ${Math.max(...tops)} (표본 ${same.length}/${samples.length}), errors ${errors.length}`);
await browser.close();

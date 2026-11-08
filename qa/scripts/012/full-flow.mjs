// 정상 플레이 한 판(사람처럼 버튼으로): 첫 화면 → 룰렛 → 출생 → 살아가기(배속 한 단추로 8배, 자동 모드) → 엔딩. 360 터치.
// 사용: node qa/scripts/012/full-flow.mjs [generation=genz] [chromium|webkit]
import { chromium, webkit, newPage, toLife, BASE } from './lib.mjs';
const eng = process.argv[3] === 'webkit' ? webkit : chromium;
const { browser, page, errors } = await newPage(eng, { width: 360, height: 740 }, { hasTouch: true });
await page.goto(BASE + '/?__timescale=30');
await page.getByTestId('title-screen').waitFor({ state: 'visible' });
await page.getByTestId('start-birth').waitFor({ state: 'visible' });
await page.waitForTimeout(600);
await page.getByTestId('start-birth').tap();
await toLife(page);
console.log('life 진입', await page.evaluate(() => document.querySelector('[data-testid=life-age]')?.textContent.trim()));
await page.waitForTimeout(800);
for (let i = 0; i < 3; i++) { await page.getByTestId('speed').tap(); await page.waitForTimeout(250); }
console.log('배속', await page.getByTestId('speed').getAttribute('data-speed'), await page.getByTestId('speed').getAttribute('aria-label'));
const dismissNote = async () => { const sk = page.getByTestId('note-skip'); if (await sk.isVisible().catch(() => false)) { await page.waitForFunction(() => document.querySelector('[data-testid=note-skip]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 8000 }).catch(() => {}); await sk.tap({ timeout: 3000 }).catch(() => {}); return true; } return false; };
for (let i = 0; i < 5 && (await dismissNote()); i++) await page.waitForTimeout(400);
for (let i = 0; i < 12; i++) { await dismissNote(); try { await page.getByTestId('auto').tap({ timeout: 2500 }); break; } catch {} }
await page.waitForTimeout(400);
console.log('자동', await page.getByTestId('auto').getAttribute('aria-pressed'));
const t0 = Date.now(); let ended = false; const ages = new Set(); let modalSeen = 0, parentCard = 0, minBar = 999, maxBar = 0;
while (Date.now() - t0 < 500000) {
  await dismissNote();
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
  const s = await page.evaluate(() => ({ age: document.querySelector('[data-testid=life-age]')?.textContent.trim(), modal: !!document.querySelector('[data-testid=decision-overlay]'), pc: !!document.querySelector('[data-testid=parent-card]'), bar: document.querySelector('[data-testid=controls]')?.getBoundingClientRect().height ?? null, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  if (s.age) ages.add(s.age);
  if (s.modal) modalSeen++;
  if (s.pc) parentCard++;
  if (s.bar) { minBar = Math.min(minBar, s.bar); maxBar = Math.max(maxBar, s.bar); }
  if (s.ox > 0) errors.push('가로 넘침 ' + s.ox + ' @' + s.age);
  await page.waitForTimeout(300);
}
const e = await page.evaluate(() => ({ text: document.body.innerText, choices: document.querySelector('[data-testid=ending-choices]')?.textContent.trim(), stamps: [...document.querySelectorAll('[data-testid=timeline-picked][data-by=parent]')].map((x) => x.textContent.trim().slice(0, 12)) }));
console.log(`끝남 ${ended} (${Math.round((Date.now() - t0) / 1000)}s), 본 나이 ${ages.size}종, 모달 결정 ${modalSeen}프레임, 부모 카드 ${parentCard}프레임, 하단 띠 높이 ${minBar}~${maxBar}, 큰 결정 문장 ${/큰 결정 가운데/.test(e.text)}, 선택 문장 "${e.choices}", 부모 도장 ${[...new Set(e.stamps)].join('/')}, 오류 ${errors.length} ${errors.slice(0, 3)}`);
await browser.close();

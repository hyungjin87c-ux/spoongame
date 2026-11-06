// 정상 한 판 끝까지(첫 화면 → 태어나기 → 룰렛 → 출생신고 → 살아가기 → 자동 진행 → 엔딩). 사용: QA_BASE=… node qa/scripts/009/fm7a-fullrun.mjs [세대 id] [뷰포트 폭]
import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readSave } from './fm7a-lib.mjs';

const gen = process.argv[2] ?? 'industrial';
const width = Number(process.argv[3] ?? 1280);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width, height: width < 500 ? 740 : 800 }, hasTouch: width < 500, locale: 'ko-KR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
await page.goto(BASE + '/');
await page.evaluate(([sk, sv]) => { localStorage.setItem(sk, sv); }, [SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: true, noteCards: false, generation: gen, lifeLength: 'short30' })]);
await page.goto(BASE + '/?__timescale=60');
await page.getByTestId('title-screen').waitFor({ timeout: 15000 });
await page.getByTestId(`gen-${gen}`).check({ timeout: 4000 }).catch(() => {});
const begin = page.getByTestId('start-birth');
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="start-birth"]'); return x && !x.disabled; }, null, { timeout: 8000 });
await begin.click();
await page.getByTestId('roulette-screen').waitFor();
const st = await page.getByTestId('roulette-screen').getAttribute('data-state');
if (st === 'spinning' || st === 'draw') { await page.waitForFunction(() => { const x = document.querySelector('[data-testid="skip-roulette"]'); return x && !x.disabled; }); await page.getByTestId('skip-roulette').click(); }
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="to-birth"]'); return x && !x.disabled; });
await page.getByTestId('to-birth').click();
await page.getByTestId('birth-screen').waitFor();
console.log('출생신고:', (await page.getByTestId('birth-sentence').textContent()).replace(/\s+/g, ' ').trim());
await page.waitForFunction(() => { const x = document.querySelector('[data-testid="next-life"]'); return x && !x.disabled; });
await page.getByTestId('next-life').click();
await page.getByTestId('life-screen').waitFor();
const t0 = Date.now();
let lastAge = -1;
while (Date.now() - t0 < 200000) {
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
  const a = await page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1));
  lastAge = a;
  // 자동 모드가 꺼져 있으면(일시정지 등) 이어 간다
  const card = await page.locator('button[data-testid^="choice-"]:not([data-testid="choice-ask"])').first().isVisible().catch(() => false);
  if (card) await page.locator('button[data-testid^="choice-"]:not([data-testid="choice-ask"])').first().click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(150);
}
const ended = await page.getByTestId('ending-screen').isVisible().catch(() => false);
const sv = await readSave(page);
console.log(`엔딩 도달 ${ended} (마지막 나이 ${lastAge}) | phase ${sv?.data?.phase} | errors ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
const fam = (sv?.data?.history ?? []).filter((h) => /^fam-/.test(h.eventId ?? '') && h.eventId !== 'fam-sib-born' && h.eventId !== 'fam-sib-left');
for (const h of fam) console.log(`  ${h.age}세 ${h.eventId}: ${h.text}`);
const txt = ended ? await page.evaluate(() => document.querySelector('[data-testid="ending-screen"]').innerText.replace(/\s+/g, ' ').slice(0, 1400)) : '';
console.log('엔딩 화면:', txt);
await b.close();

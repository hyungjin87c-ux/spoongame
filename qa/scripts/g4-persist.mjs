import { open, go, sleep, rec, SETTINGS_KEY } from './g4-lib.mjs';
const U = 'http://localhost:4377/';
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(500);
await page.locator('[data-testid="gen-row-genz"]').click(); await page.click('[data-testid="regmode-pick"]'); await sleep(200);
await page.locator('label:has([data-testid="sido-부산"])').click(); await sleep(400);
const s = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
console.log(s);
await page.reload(); await sleep(900);
const r = await page.evaluate(() => ({ sel: document.querySelector('[data-testid="gen-list"] input:checked')?.value, mode: document.querySelector('[data-testid="region-mode"] input:checked')?.value, sido: document.querySelector('[data-testid="region-chips"] input:checked')?.value }));
rec('P05', 'Z세대·직접 고르기·부산 선택 후 새로고침', '세대는 기억(GS4), 시도는 기억하지 않아도 됨 — 실제 값 기록', JSON.stringify(r), r.sel === 'genz' ? 'PASS' : 'FAIL');
// lived 주입: 앱이 쓴 봉투에 lived만 덧씀
const env = JSON.parse(s); env.data.lived = ['genx', 'alpha']; env.data.homeRegion = '서울';
await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, JSON.stringify(env)]); await page.reload(); await sleep(900);
const t = await page.evaluate(() => ({ lived: [...document.querySelectorAll('[data-testid^="gen-lived-"]')].map((e) => e.getAttribute('data-testid').slice(10) + ':' + e.innerText), origin: document.querySelector('[data-testid="origin-current"]')?.innerText, sel: document.querySelector('[data-testid="gen-list"] input:checked')?.value }));
rec('P06', '설정에 살아본 세대 2개·출신 시도 서울 주입 후 열기', '해당 두 줄에 「살아봄」, 출신 시도 표시', JSON.stringify(t), t.lived.length === 2 ? 'PASS' : 'FAIL');
// 내 출신 시도 칩 바로가기
await page.click('[data-testid="regmode-pick"]'); await sleep(200);
const chip = await page.$('[data-testid="sido-origin-서울"]');
rec('P07', '직접 고르기에서 「내 출신 시도」 바로가기', '출신 시도(서울) 칩이 보임', String(!!chip), chip ? 'PASS' : 'FAIL');
if (chip) { await chip.click(); await sleep(300); const sel = await page.$eval('[data-testid="region-chips"] input:checked', (e) => e.value).catch(() => null); rec('P08', '「내 출신 시도」 칩 클릭', '서울 선택됨', String(sel), sel === '서울' ? 'PASS' : 'FAIL'); await page.click('[data-testid="start-birth"]'); await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); const st = await page.$eval('[data-testid="roulette-status"]', (e) => e.innerText.replace(/\n/g, ' ')); rec('P09', '서울 직접 선택으로 룰렛 시작', '결과 지역=서울', st, /서울/.test(st) ? 'PASS' : 'FAIL'); }
// 시도를 숨긴 설정에서 의견 보내기 주소
console.log(await page.$$eval('footer a[target=_blank]', (as) => as.map((a) => decodeURIComponent(a.href))));
rec('P00', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();

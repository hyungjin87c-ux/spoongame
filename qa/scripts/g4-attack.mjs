import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const U = 'http://localhost:4377/';
const cnt = (page) => page.$eval('[data-testid="carousel-count"]', (e) => e.textContent.trim()).catch(() => null);
const fresh = async (page) => { await page.goto(U); await page.evaluate(() => localStorage.clear()); await go(page); await sleep(300); };
{
  const { browser, page, logs } = await open('d1280');
  await fresh(page);
  // A1 세대·시도 빠른 연속 클릭
  await page.click('[data-testid="regmode-pick"]');
  const gens = ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha', 'random'];
  const sidos = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  let err = 0;
  for (let i = 0; i < 60; i++) {
    const g = gens[(i * 5) % 8]; const s = sidos[(i * 7) % 17];
    await page.locator(`[data-testid="gen-row-${g}"]`).click({ timeout: 2000, noWaitAfter: true, force: true }).catch(() => err++);
    await page.locator(`label:has([data-testid="sido-${s}"])`).click({ timeout: 2000, noWaitAfter: true, force: true }).catch(() => err++);
  }
  await sleep(500);
  const st = await page.evaluate(() => ({ checkedGen: [...document.querySelectorAll('[data-testid="gen-list"] input:checked')].map((e) => e.value), checkedSido: [...document.querySelectorAll('[data-testid="region-chips"] input:checked')].map((e) => e.value), cnt: document.querySelector('[data-testid="carousel-count"]')?.textContent.trim(), w: document.documentElement.scrollWidth }));
  rec('A01', '세대 줄·시도 칩 120회 번갈아 연속 클릭(대기 없음)', '선택은 각각 정확히 1개, 캐러셀 정상, 가로 넘침 0, 에러 0', `${JSON.stringify(st)} 클릭실패=${err}`, st.checkedGen.length === 1 && st.checkedSido.length <= 1 && st.w <= 1280 && logs.length === 0 ? 'PASS' : 'FAIL');
  // 캐러셀 화살표 연타
  await fresh(page);
  for (let i = 0; i < 100; i++) await page.click('[data-testid="carousel-next"]', { noWaitAfter: true, delay: 0 });
  await sleep(500); const c1 = await cnt(page);
  for (let i = 0; i < 50; i++) await page.click('[data-testid="carousel-prev"]', { noWaitAfter: true });
  await sleep(500); const c2 = await cnt(page);
  // 100%21 = 16 → index 16 → "17 / 21"; 50번 뒤로 → 16-50 = -34 mod 21 = 8 → "9 / 21"
  rec('A02', '캐러셀 다음 100연타 후 이전 50연타', '장 번호가 산술대로(17 → 9) 돌고 멈추지 않음', `${c1} → ${c2}`, c1 === '17 / 21' && c2 === '9 / 21' ? 'PASS' : 'FAIL');
  // 키보드 ←→ 와 점
  const dots = await page.$$eval('[data-testid="carousel-dots"] button, [data-testid="carousel-dots"] *', (es) => es.length).catch(() => 0);
  rec('A02b', '캐러셀 점 표시', '(조작 없음이 아님 — 점은 규격 외)', `dots=${dots}`, 'RECORD');
  // 태어나기 연타 (정상 상태)
  await fresh(page);
  await page.locator('[data-testid="gen-row-genz"]').click();
  await sleep(500); // 입력 가드 지나가게
  const starts = []; for (let i = 0; i < 12; i++) starts.push(page.click('[data-testid="start-birth"]', { noWaitAfter: true, timeout: 1500 }).catch(() => 'x'));
  await Promise.all(starts); await sleep(1200);
  const rs = await page.evaluate(() => ({ roul: document.querySelectorAll('[data-testid="roulette-screen"]').length, title: document.querySelectorAll('[data-testid="title-screen"]').length, save: localStorage.getItem('suzeo-game:save')?.length, phase: JSON.parse(localStorage.getItem('suzeo-game:save') || '{}').data?.phase }));
  rec('A03', '태어나기 12연타', '룰렛 화면 하나, 한 번만 시작', JSON.stringify(rs), rs.roul === 1 && rs.title === 0 ? 'PASS' : 'FAIL');
  // 룰렛 중 새로고침
  const status1 = await page.evaluate(() => JSON.parse(localStorage.getItem('suzeo-game:save')).data);
  await page.reload(); await sleep(1200);
  const after = await page.evaluate(() => ({ roul: !!document.querySelector('[data-testid="roulette-screen"]'), title: !!document.querySelector('[data-testid="title-screen"]'), birth: !!document.querySelector('[data-testid="birth-screen"]'), txt: document.body.innerText.slice(0, 140).replace(/\n/g, ' ') }));
  rec('A04', '룰렛 도는 중 새로고침', '진행 화면 복원(룰렛 또는 이어하기), 깨짐 없음', JSON.stringify(after) + ` saved.phase=${status1.phase}`, 'RECORD');
  // 결과는 새로고침해도 같은가 (RL5): 룰렛 끝에서 지역·수저 읽고 새로고침 → 같은지
  await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }).catch(() => {});
  const r1 = await page.$eval('[data-testid="roulette-status"]', (e) => e.innerText.replace(/\n/g, ' ')).catch(() => null);
  await page.reload(); await sleep(1500); await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }).catch(() => {});
  const r2 = await page.$eval('[data-testid="roulette-status"]', (e) => e.innerText.replace(/\n/g, ' ')).catch(() => null);
  rec('A05', '룰렛 결과 뒤 새로고침', '같은 결과(RL5)', `${r1} → ${r2}`, r1 && r1 === r2 ? 'PASS' : 'FAIL');
  // 새로고침 연타 10회+
  for (let i = 0; i < 12; i++) { await page.reload({ waitUntil: 'commit' }).catch(() => {}); await sleep(150); }
  await sleep(1500);
  const r3 = await page.$eval('[data-testid="roulette-status"]', (e) => e.innerText.replace(/\n/g, ' ')).catch(() => null);
  rec('A06', '룰렛 결과 화면 새로고침 12연타', '같은 결과·깨짐 없음', `${r3}`, r3 === r1 ? 'PASS' : 'FAIL');
  // 뒤로가기
  const urlBefore = page.url(); await page.goBack({ waitUntil: 'commit' }).catch(() => {}); await sleep(1200);
  const bk = await page.evaluate(() => ({ url: location.href, title: !!document.querySelector('[data-testid="title-screen"]'), roul: !!document.querySelector('[data-testid="roulette-screen"]'), txt: document.body.innerText.slice(0, 100).replace(/\n/g, ' ') }));
  rec('A07', '룰렛 화면에서 뒤로가기', '앱이 깨지지 않음(다른 사이트로 가면 RECORD)', JSON.stringify(bk) + ' from ' + urlBefore, 'RECORD');
  rec('A00', '콘솔 에러·경고', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}

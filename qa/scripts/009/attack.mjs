import { chromium, inject, birthState, toLife, readSave, sceneNow, BASE } from './qalib.mjs';

const which = process.argv[2];
const seedArg = Number(process.argv[3] ?? 7001);

async function open(opts = {}) {
  const { viewport = { width: 1280, height: 800 }, scale = 20, settings = {}, gen = 'genx', wealth = 3, birthYear = 1975, region = '서울', seed = seedArg, lifeLength = 'short30', phase = 'roulette' } = opts;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 500 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
  await inject(page, birthState({ seed, generation: gen, wealth, birthYear, region, lifeLength, phase }), { speed: 8, autoMode: false, noteCards: false, ...settings }, `/?__timescale=${scale}`);
  await toLife(page);
  return { browser, ctx, page, errors };
}

async function waitDecision(page, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.locator('[data-testid="choice-panel"], [role="dialog"]').first().isVisible().catch(() => false)) return true;
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) return false;
    await page.waitForTimeout(80);
  }
  return false;
}

const scenarios = {
  // A1: 결정 모달이 뜬 해의 새로고침 연타
  async reloadAtDecision() {
    const { browser, page, errors } = await open({ scale: 20 });
    let reloads = 0;
    const out = [];
    for (let round = 0; round < 3; round++) {
      const got = await waitDecision(page);
      if (!got) { out.push('결정이 안 떴다'); break; }
      const s0 = (await readSave(page)).data;
      const key0 = s0.pending?.key;
      const scene0 = await sceneNow(page);
      const rows0 = await page.locator('[data-tl="era"]').count();
      for (let i = 0; i < 12; i++) {
        await page.reload();
        reloads++;
        await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"]');
        if (await page.getByTestId('title-screen').isVisible().catch(() => false)) {
          // 첫 화면이면 이어서 살기
          const resume = page.getByTestId('resume').or(page.getByRole('button', { name: /이어서/ }));
          await resume.first().click().catch(() => {});
          await page.getByTestId('life-screen').waitFor({ timeout: 8000 }).catch(() => {});
        }
      }
      await page.waitForTimeout(600);
      const s1 = (await readSave(page)).data;
      const scene1 = await sceneNow(page);
      const rows1 = await page.locator('[data-tl="era"]').count();
      const eraIds = await page.locator('[data-tl="era"]').evaluateAll((els) => els.map((e) => e.id));
      const dup = eraIds.length - new Set(eraIds).size;
      out.push(`R${round}: age ${s0.age}→${s1.age} pending ${key0}→${s1.pending?.key} scene ${scene0.yr}→${scene1.yr} eraRows ${rows0}→${rows1} dupEraIds ${dup} dialog=${await page.locator('[role="dialog"], [data-testid="choice-panel"]').first().isVisible().catch(() => false)}`);
      // 선택해서 진행
      const opt = page.locator('button[data-testid^="choice-"]').first();
      await opt.click({ timeout: 4000 }).catch((e) => out.push('선택 클릭 실패 ' + String(e).slice(0, 80)));
    }
    console.log('reloadAtDecision:', reloads, 'reloads |', out.join('\n   '), '| errors', errors.length, errors.slice(0, 3));
    await browser.close();
  },

  // A1b: 자동 진행 중 무작위 간격 새로고침 → 끝까지 가는가
  async randomReloadAuto() {
    const { browser, page, errors } = await open({ scale: 40, settings: { autoMode: true }, seed: seedArg });
    let reloads = 0;
    const t0 = Date.now();
    let ended = false;
    while (Date.now() - t0 < 150000) {
      if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
      await page.waitForTimeout(150 + Math.floor(Math.random() * 500));
      await page.reload().catch(() => {});
      reloads++;
      await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="ending-screen"]', { timeout: 10000 }).catch(() => {});
      if (await page.getByTestId('title-screen').isVisible().catch(() => false)) {
        await page.getByRole('button', { name: /이어서/ }).first().click().catch(() => {});
      }
    }
    const save = await readSave(page);
    const h = save?.data?.history ?? [];
    let mono = true; for (let i = 1; i < h.length; i++) if (h[i].age < h[i - 1].age) mono = false;
    const ids = h.map((x) => x.eventId).filter((x) => x && x.startsWith('fam-'));
    const dupFam = ids.length - new Set(ids).size;
    console.log('randomReloadAuto: ended', ended, 'reloads', reloads, 'age', save?.data?.age, 'phase', save?.data?.phase, 'history', h.length, 'monotonic', mono, 'dup fam- lines', dupFam, '| errors', errors.length, errors.slice(0, 3));
    await browser.close();
  },

  // A2: 시대의 창 링크 연타
  async eraClickSpam() {
    const { browser, page, errors } = await open({ gen: 'g86', birthYear: 1965, scale: 10, settings: { autoMode: true, speed: 4 } });
    // 1980 무렵까지 간 뒤 일시정지
    await page.waitForFunction(() => /198\d/.test(document.querySelector('.scene__year time')?.textContent ?? ''), null, { timeout: 90000 });
    await page.getByTestId('pause').click();
    await page.waitForTimeout(500);
    const era = page.locator('#scene-era');
    await era.waitFor();
    const url0 = page.url();
    const hist0 = await page.evaluate(() => history.length);
    const scrollY0 = await page.evaluate(() => scrollY);
    for (let i = 0; i < 40; i++) await page.mouse.click(...(await era.boundingBox().then((b) => [b.x + b.width / 2, b.y + b.height / 2])));
    await era.focus();
    for (let i = 0; i < 25; i++) await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const active = await page.evaluate(() => document.activeElement?.id);
    const hist1 = await page.evaluate(() => history.length);
    const flash = await page.locator('[data-flash="true"]').count();
    const ov = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    console.log('eraClickSpam: url same', page.url() === url0, 'history.length', hist0, '→', hist1, 'active', active, 'flashRows', flash, 'noOverflow', ov, 'scrollY', scrollY0, '→', await page.evaluate(() => scrollY), '| errors', errors.length, errors.slice(0, 3));
    // 달리는 중 연타
    await page.getByTestId('pause').click();
    for (let i = 0; i < 40; i++) { await era.click({ timeout: 2000 }).catch(() => {}); }
    console.log('  running spam ok; errors', errors.length);
    await browser.close();
  },

  // A3: 그림 덩어리 차단 후 복구 (집 그림 + 시대의 창 덩어리)
  async chunkBlock() {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.route('**/data/familyArt/**', (r) => r.abort());
    await page.route('**/eraWindows/**', (r) => r.abort());
    await inject(page, birthState({ seed: seedArg, generation: 'genx', wealth: 3, birthYear: 1975, region: '서울' }), { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=15');
    await toLife(page);
    await page.waitForFunction(() => /19(8|9)\d/.test(document.querySelector('.scene__year time')?.textContent ?? ''), null, { timeout: 90000 });
    const a = await page.evaluate(() => ({ art: document.querySelector('[data-testid="family-scene"]').getAttribute('data-scene-art'), era: document.querySelector('#scene-era')?.getAttribute('data-empty'), eraRows: document.querySelectorAll('[data-tl="era"]').length, ov: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
    console.log('chunkBlock 차단 중:', JSON.stringify(a));
    await page.getByTestId('pause').click();
    await page.unroute('**/data/familyArt/**');
    await page.unroute('**/eraWindows/**');
    await page.getByTestId('scene-art-retry').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="family-scene"]').getAttribute('data-scene-art') === 'ready', null, { timeout: 15000 });
    await page.waitForTimeout(800);
    const b = await page.evaluate(() => ({ art: document.querySelector('[data-testid="family-scene"]').getAttribute('data-scene-art'), era: document.querySelector('#scene-era')?.getAttribute('data-empty'), eraId: document.querySelector('#scene-era')?.getAttribute('data-era'), eraRows: document.querySelectorAll('[data-tl="era"]').length }));
    console.log('  다시 불러오기 뒤:', JSON.stringify(b));
    // 시대 줄 덩어리는 재시도 단추가 없으니 해가 바뀌면 되살아나는지(다음 해 진행)
    await page.getByTestId('pause').click();
    await page.waitForTimeout(3000);
    await page.getByTestId('pause').click();
    const c = await page.evaluate(() => ({ yr: document.querySelector('.scene__year time')?.textContent, era: document.querySelector('#scene-era')?.getAttribute('data-empty'), eraId: document.querySelector('#scene-era')?.getAttribute('data-era'), eraRows: document.querySelectorAll('[data-tl="era"]').length }));
    console.log('  이어서 진행 뒤:', JSON.stringify(c), 'errors', errors.length, errors.slice(0, 3));
    await browser.close();
  },

  // A4: 뒤로가기
  async backButton() {
    const { browser, page, errors } = await open({ scale: 30, settings: { autoMode: true } });
    await page.waitForTimeout(1500);
    const age0 = (await readSave(page)).data.age;
    const url0 = page.url();
    const h0 = await page.evaluate(() => history.length);
    await page.goBack().catch(() => {});
    await page.waitForTimeout(800);
    const url1 = page.url();
    const screen = await page.evaluate(() => [...document.querySelectorAll('[data-testid$="-screen"]')].map((e) => e.getAttribute('data-testid')));
    const dlg = await page.locator('[role="dialog"], [role="alertdialog"]').count();
    console.log('backButton: url', url0, '→', url1, 'history', h0, 'screens', screen, 'dialogs', dlg);
    await page.goForward().catch(() => {});
    await page.waitForTimeout(600);
    const save = await readSave(page);
    console.log('  이후 save phase', save?.data?.phase, 'age', age0, '→', save?.data?.age, 'screens', await page.evaluate(() => [...document.querySelectorAll('[data-testid$="-screen"]')].map((e) => e.getAttribute('data-testid'))), 'errors', errors.length, errors.slice(0, 3));
    await browser.close();
  },

  // A5: 저장 중 종료 (진행 중 탭 닫기 → 다시 열기)
  async closeWhileRunning() {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await inject(page, birthState({ seed: seedArg, generation: 'millennial', wealth: 2, birthYear: 1988, region: '경북' }), { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=40');
    await toLife(page);
    const results = [];
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(400 + Math.floor(Math.random() * 900));
      const before = (await readSave(page))?.data?.age;
      await page.close({ runBeforeUnload: Math.random() < 0.5 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      await page.goto(BASE + '/?__timescale=40');
      await page.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"], [data-testid="error-screen"], [data-testid="superseded-screen"]', { timeout: 10000 });
      const screen = await page.evaluate(() => [...document.querySelectorAll('[data-testid$="-screen"]')].map((e) => e.getAttribute('data-testid')).join(','));
      const resume = page.getByRole('button', { name: /이어서/ }).first();
      if (await resume.isVisible().catch(() => false)) { await resume.click(); await page.getByTestId('life-screen').waitFor({ timeout: 8000 }).catch(() => {}); }
      const s = (await readSave(page))?.data;
      const sc = await sceneNow(page);
      results.push(`${i}: 닫기 전 ${before}세 → ${screen} → 저장 ${s?.age}세 ${s?.phase} 장면 ${sc.yr} art=${sc.art}`);
    }
    console.log('closeWhileRunning:\n   ' + results.join('\n   '), '\n  errors', errors.length, errors.slice(0, 3));
    await browser.close();
  },
};

if (!scenarios[which]) { console.log('usage: node attack.mjs <' + Object.keys(scenarios).join('|') + '> [seed]'); process.exit(1); }
await scenarios[which]();

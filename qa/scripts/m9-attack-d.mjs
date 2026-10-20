// QA-003 M9 D군(저장·환경) 보충: 구 저장 v4~v7 열기(새 게임 + 안내 한 줄), 오프라인(로드 뒤 끊기 — 정상 / 새로고침 실패는 결함이 아니라 RECORD만, CM3).
// (변조 저장·쿼터 초과·저장 차단·두 탭은 M7c 회귀 REG-R-G*·REG-B05*와 M8 TB군이 한다.)
// 사용: node qa/scripts/m9-attack-d.mjs
import { launch, openOracle, plainLife, openSeededRaw, openSeeded, mkctx, cleanStorageOnce, fixSeed, readCard, readSave, sleep, shot, runCase, waitGuard, whichScreen, SET_MANUAL, GAME_KEY, SAVE_VERSION, PROD, toRoulette, skipToBirth, birthToLife } from './m7c-lib.mjs';
import { auditLayout } from './m9-audit.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const adult = await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true });

for (const [tag, vp, touch] of [['d1280', { width: 1280, height: 800 }, false], ['m360', { width: 360, height: 740 }, true]]) {
  await runCase({ id: `D-old-saves-${tag}`, cat: 'D 저장·환경', title: `구 저장 v4·v5·v6·v7(${tag}): 새 게임으로 시작하고 첫 화면에 안내 한 줄, 이어서 살기 없음, 새 판을 시작하면 안내가 사라지고 새 저장이 v8`, steps: '게임 저장에 {version: 4|5|6|7, data: 성인 판}을 심고 열기 → 첫 화면의 안내(old-save-notice)·이어서 살기 유무 → 태어나기 → 저장 버전' }, async () => {
    const problems = [];
    const lines = [];
    let shotPath = null;
    for (const v of [4, 5, 6, 7]) {
      const { ctx, page } = await openSeededRaw(browser, JSON.stringify({ version: v, data: adult }), { vp, touch, settings: SET_MANUAL });
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
      await sleep(500);
      const scr = await whichScreen(page);
      const notice = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[data-testid="old-save-notice"]')];
        return { n: els.length, text: els[0] ? els[0].textContent.replace(/\s+/g, ' ').trim() : null, lines: els[0] ? Math.round(els[0].getBoundingClientRect().height / parseFloat(getComputedStyle(els[0]).lineHeight)) : null };
      });
      const resume = await page.locator('[data-testid="resume"]').count();
      if (scr !== 'title-screen') problems.push(`v${v}: 화면 ${scr}`);
      if (notice.n !== 1) problems.push(`v${v}: 안내 ${notice.n}개`);
      if (resume !== 0) problems.push(`v${v}: 이어서 살기 버튼이 보임`);
      const lay = await auditLayout(page);
      problems.push(...lay.problems.map((x) => `v${v}: ${x}`));
      if (problems.length && !shotPath) shotPath = await shot(page, `D-old-saves-${tag}`, `v${v}`);
      if (v === 7) {
        await toRoulette(page, 'present');
        await skipToBirth(page);
        await birthToLife(page);
        await sleep(500);
        const sv = await readSave(page);
        if (!sv || sv.version !== SAVE_VERSION) problems.push(`새 판 저장 버전 ${sv && sv.version} (기대 ${SAVE_VERSION})`);
      }
      if (errs.length) problems.push(`v${v}: 페이지 오류 ${errs[0]}`);
      lines.push(`v${v}: 안내 「${(notice.text || '').slice(0, 40)}」 ${notice.lines}줄`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : `v4~v7 모두 새 게임 첫 화면 + 안내 1개·이어서 살기 없음, 새 판 저장 v${SAVE_VERSION} — ${lines.join(' · ')}`, shots: shotPath ? [shotPath] : [] };
  });
}

// 오프라인
await runCase({ id: 'D-offline-midgame', cat: 'D 저장·환경', title: '오프라인(로드 뒤 끊기): 판 도중 네트워크가 끊겨도 게임은 정상으로 계속된다(요청이 없으므로) — 결정 카드 선택·저장·엔딩 흐름 그대로', steps: '8배속으로 대시보드에서 setOffline(true) → 15초 진행·결정 카드 하나 선택 → 저장 읽기 → 다시 온라인' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, 97);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await waitGuard(page, 'pause');
  await page.locator('[data-speed="8"]').click();
  await ctx.setOffline(true);
  const problems = [];
  const age0 = (await readCard(page)).age;
  let picked = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const c = await readCard(page);
    if (c.screen !== 'life-screen') break;
    if (c.mode === 'sheet' && picked < 2) {
      await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt !== null && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 }).catch(() => {});
      await sleep(200);
      await page.getByTestId(`choice-${c.choices[0].id}`).click().catch(() => {});
      picked++;
      await sleep(300);
    } else if (c.skipDisabled !== 'true' && c.mode === null) {
      await page.getByTestId('skip').click().catch(() => {});
    }
    await sleep(150);
  }
  const c1 = await readCard(page);
  const sv = await readSave(page);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await sleep(200);
  const sv2 = await readSave(page);
  if (c1.screen === 'error-screen' || c1.screen === 'BLANK') problems.push(`화면 ${c1.screen}`);
  if (!(c1.age > age0)) problems.push(`오프라인에서 나이가 안 늘어남 ${age0}→${c1.age}`);
  if (!sv2 || !sv2.data || sv2.data.age < age0) problems.push('저장이 안 따라옴');
  if (errs.length) problems.push(`오류 ${errs.length}: ${errs[0]}`);
  await ctx.setOffline(false);
  const s = problems.length ? await shot(page, 'D-offline-midgame') : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `오프라인 25초 동안 ${age0}→${c1.age}세, 결정 ${picked}장 선택, 저장 따라옴, 오류 0`, shots: s ? [s] : [] };
});

await runCase({ id: 'D-offline-reload', cat: 'D 저장·환경', title: '오프라인에서 새로고침(CM3: 보장하지 않음): 로드 뒤 끊긴 상태의 새로고침이 실패해도 결함이 아니라 관찰 기록만 — 다시 연결하고 새로고침하면 저장된 판으로 복원', steps: '대시보드에서 setOffline(true) → reload 시도 → 결과 관찰 → setOffline(false) → reload → 복원 확인' }, async () => {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, 98);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await sleep(600);
  const age = (await readCard(page)).age;
  await ctx.setOffline(true);
  let reloadResult = '';
  try {
    await page.reload({ waitUntil: 'load', timeout: 8000 });
    reloadResult = `새로고침 성공(캐시) — 화면 ${await whichScreen(page)}`;
  } catch (e) {
    reloadResult = `새로고침 실패: ${String(e.message).split('\n')[0].slice(0, 80)}`;
  }
  const failed = reloadResult.startsWith('새로고침 실패');
  const sFail = failed ? await shot(page, 'D-offline-reload').catch(() => null) : null;
  await ctx.setOffline(false);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"]', { timeout: 8000 });
  const scr = await whichScreen(page);
  let resumed = scr;
  if (scr === 'title-screen') {
    await waitGuard(page, 'resume').catch(() => {});
    if (await page.locator('[data-testid="resume"]').count()) {
      await page.getByTestId('resume').click();
      await page.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
      resumed = 'life-screen(이어서 살기)';
    }
  }
  const age2 = (await readCard(page)).age;
  const ok = (resumed.startsWith('life-screen')) && age2 >= age;
  await ctx.close();
  return { verdict: !ok ? 'FAIL' : failed ? 'RECORD' : 'PASS', actual: `${reloadResult}. 다시 연결 뒤: ${resumed}, 나이 ${age}→${age2}${failed ? ' — 오프라인 새로고침이 열리지 않는 것은 보장 범위 밖(CM3, 서비스 워커 없음) — README 「열리지 않을 수 있습니다」' : ''}`, shots: sFail ? [sFail] : [] };
});

await browser.close();

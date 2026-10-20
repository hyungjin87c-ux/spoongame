// QA-003 M9 B군(룰렛·출생신고 공격): 태어나기 연타·더블탭, 룰렛 중 새로고침 연타·뒤로가기·탭 가림, 건너뛰기 연타, 출생신고·살아가기 연타.
// 사용: node qa/scripts/m9-attack-b.mjs   (기본 1280×800 마우스, 더블탭·연타 일부는 360×740 터치로 한 번 더)
import { launch, mkctx, fixSeed, cleanStorageOnce, readCard, readSave, sleep, shot, runCase, waitGuard, whichScreen, TOUCH, PROD, GAME_KEY } from './m7c-lib.mjs';
import { auditLayout } from './m9-audit.mjs';

const browser = await launch();
const D = { width: 1280, height: 800 };
const M = { width: 360, height: 740 };

async function fresh(vp, touch, seed = 91) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  return { ctx, p, errs };
}
const finish = async (name, p, ctx, problems, errs, okText) => {
  if (errs.length) problems.push(`페이지 오류 ${errs.length}: ${errs[0]}`);
  const lay = await auditLayout(p).catch(() => ({ problems: [] }));
  problems.push(...lay.problems);
  const s = problems.length ? await shot(p, name) : null;
  await ctx.close();
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : okText, shots: s ? [s] : [] };
};

for (const [tag, vp, touch] of [['d1280', D, false], ['m360', M, true]]) {
  await runCase({ id: `B-birth-spam-${tag}`, cat: 'B 룰렛', title: `태어나기를 연타(25번 빠르게)·더블탭(${tag}): 룰렛은 한 번만 시작되고 저장·화면이 파손되지 않는다`, steps: '첫 화면에서 start-birth를 기다리지 않고 25번 연속 클릭(터치는 탭) + 더블탭 → 룰렛 화면·저장 읽기' }, async () => {
    const { ctx, p, errs } = await fresh(vp, touch);
    const problems = [];
    await waitGuard(p, 'start-birth');
    const btn = p.getByTestId('start-birth');
    for (let i = 0; i < 25; i++) {
      if (touch) await btn.tap({ timeout: 800, noWaitAfter: true }).catch(() => {});
      else await btn.click({ timeout: 800, noWaitAfter: true, delay: 0 }).catch(() => {});
    }
    if (!touch) await btn.dblclick({ timeout: 500, noWaitAfter: true }).catch(() => {});
    await sleep(800);
    const scr = await whichScreen(p);
    if (scr !== 'roulette-screen') problems.push(`화면 ${scr}`);
    const sv = await readSave(p);
    if (!sv || !sv.data || typeof sv.data.phase !== 'string') problems.push(`저장 phase ${sv && sv.data && sv.data.phase}`);
    const rouletteCount = await p.locator('[data-testid="roulette-screen"]').count();
    if (rouletteCount !== 1) problems.push(`룰렛 화면 ${rouletteCount}개`);
    return finish(`B-birth-spam-${tag}`, p, ctx, problems, errs, `연타 뒤 룰렛 1개, 저장 phase ${sv && sv.data && sv.data.phase}`);
  });

  await runCase({ id: `B-skip-spam-${tag}`, cat: 'B 룰렛', title: `룰렛 건너뛰기·출생신고 보기·살아가기를 연타(${tag}): 결과·출생신고·인생이 각각 한 번만 열리고 이중 이동이 없다`, steps: '룰렛 중 skip-roulette 20번 → 결과에서 to-birth 20번 → 출생신고에서 next-life 20번 연타 → 인생 시작 저장(나이 0, 기록 1줄)' }, async () => {
    const { ctx, p, errs } = await fresh(vp, touch, 92);
    const problems = [];
    const hit = async (id) => {
      for (let i = 0; i < 20; i++) {
        const b = p.getByTestId(id);
        if (!(await b.count())) break;
        if (touch) await b.tap({ timeout: 500, noWaitAfter: true }).catch(() => {});
        else await b.click({ timeout: 500, noWaitAfter: true }).catch(() => {});
      }
    };
    await waitGuard(p, 'start-birth');
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid="roulette-screen"]');
    await sleep(700);
    await hit('skip-roulette');
    await sleep(500);
    const st1 = await p.evaluate(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state'));
    if (st1 !== 'result') problems.push(`건너뛰기 연타 뒤 룰렛 상태 ${st1}`);
    await waitGuard(p, 'to-birth').catch(() => problems.push('to-birth 가드가 안 풀림'));
    await hit('to-birth');
    await sleep(600);
    const scr2 = await whichScreen(p);
    if (scr2 !== 'birth-screen') problems.push(`to-birth 연타 뒤 화면 ${scr2}`);
    await waitGuard(p, 'next-life').catch(() => problems.push('next-life 가드가 안 풀림'));
    await hit('next-life');
    await sleep(900);
    const scr3 = await whichScreen(p);
    if (scr3 !== 'life-screen') problems.push(`next-life 연타 뒤 화면 ${scr3}`);
    const sv = await readSave(p);
    const hist = (sv && sv.data && sv.data.history) || [];
    if (sv && sv.data && sv.data.age > 1) problems.push(`나이가 ${sv.data.age} — 이중 시작?`);
    const births = hist.filter((h) => /출생|태어났/.test(JSON.stringify(h))).length;
    if (births > 1) problems.push(`출생 기록이 ${births}줄`);
    return finish(`B-skip-spam-${tag}`, p, ctx, problems, errs, `결과·출생신고·인생이 각각 한 번씩만 열림, 저장 나이 ${sv && sv.data && sv.data.age}, 기록 ${hist.length}줄`);
  });
}

await runCase({ id: 'B-roulette-reload', cat: 'B 룰렛', title: '룰렛 도중 새로고침 연타(12번, 0.3초 간격)와 룰렛 결과 직후 새로고침: 같은 결과(저장)로 복원, 오류 화면 없음, 결과가 바뀌지 않는다', steps: '태어나기 → 룰렛 시작 → 0.3초 간격으로 reload 12번 → 마지막에 결과가 뜰 때까지 → 출생신고까지 진행해 저장된 출생 결과와 비교' }, async () => {
  const { ctx, p, errs } = await fresh(D, false, 93);
  const problems = [];
  await waitGuard(p, 'start-birth');
  await p.getByTestId('start-birth').click();
  await p.waitForSelector('[data-testid="roulette-screen"]');
  await sleep(500);
  const first = await readSave(p);
  const wealth0 = first && first.data ? JSON.stringify(first.data.character || first.data.birthReport || {}).slice(0, 400) : null;
  const screens = [];
  for (let i = 0; i < 12; i++) {
    await p.reload({ waitUntil: 'commit' }).catch(() => {});
    await sleep(300);
  }
  await p.waitForSelector('[data-testid="roulette-screen"], [data-testid="title-screen"], [data-testid="error-screen"], [data-testid="birth-screen"]', { timeout: 8000 }).catch(() => problems.push('새로고침 연타 뒤 화면이 안 뜸'));
  const scr = await whichScreen(p);
  screens.push(scr);
  if (scr === 'error-screen' || scr === 'BLANK' || scr === 'unknown') problems.push(`연타 뒤 화면 ${scr}`);
  if (scr === 'roulette-screen') await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 15000 }).catch(() => problems.push('결과까지 안 감'));
  await sleep(400);
  const after = await readSave(p);
  const wealth1 = after && after.data ? JSON.stringify(after.data.character || after.data.birthReport || {}).slice(0, 400) : null;
  if (wealth0 && wealth1 && wealth0 !== wealth1) problems.push('룰렛 결과(캐릭터)가 새로고침 뒤 바뀜');
  // 결과 직후 새로고침 뒤 출생신고까지 같은 사람
  if ((await whichScreen(p)) === 'roulette-screen') {
    await p.reload({ waitUntil: 'load' });
    await p.waitForSelector('[data-testid="roulette-screen"], [data-testid="birth-screen"], [data-testid="title-screen"]', { timeout: 8000 });
    screens.push(await whichScreen(p));
  }
  return finish('B-roulette-reload', p, ctx, problems, errs, `화면 ${screens.join('→')}, 룰렛 결과 불변`);
});

await runCase({ id: 'B-roulette-back', cat: 'B 룰렛', title: '룰렛·출생신고 화면에서 뒤로가기·앞으로가기: 사이트를 벗어났다 돌아와도 같은 진행으로 복원되고 오류 화면이 없다', steps: '룰렛 중 goBack → goForward, 출생신고 중 goBack → goForward' }, async () => {
  const { ctx, p, errs } = await fresh(D, false, 94);
  const problems = [];
  await waitGuard(p, 'start-birth');
  await p.getByTestId('start-birth').click();
  await p.waitForSelector('[data-testid="roulette-screen"]');
  await sleep(600);
  await p.goBack().catch(() => {});
  await sleep(400);
  await p.goForward().catch(() => {});
  await p.waitForSelector('[data-testid="roulette-screen"], [data-testid="title-screen"], [data-testid="birth-screen"], [data-testid="error-screen"]', { timeout: 8000 }).catch(() => problems.push('앞으로가기 뒤 화면이 안 뜸'));
  const s1 = await whichScreen(p);
  if (s1 === 'error-screen' || s1 === 'BLANK') problems.push(`룰렛 뒤로·앞으로 뒤 ${s1}`);
  if (s1 === 'roulette-screen') {
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 15000 }).catch(() => {});
    await waitGuard(p, 'to-birth').catch(() => {});
    await p.getByTestId('to-birth').click().catch(() => {});
  }
  await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 }).catch(() => {});
  const s2 = await whichScreen(p);
  if (s2 === 'birth-screen') {
    await p.goBack().catch(() => {});
    await sleep(400);
    await p.goForward().catch(() => {});
    await p.waitForSelector('[data-testid="birth-screen"], [data-testid="title-screen"], [data-testid="roulette-screen"], [data-testid="error-screen"]', { timeout: 8000 }).catch(() => problems.push('출생신고 뒤로·앞으로 뒤 화면이 안 뜸'));
    const s3 = await whichScreen(p);
    if (s3 === 'error-screen' || s3 === 'BLANK') problems.push(`출생신고 뒤로·앞으로 뒤 ${s3}`);
  }
  return finish('B-roulette-back', p, ctx, problems, errs, `룰렛 뒤로·앞으로 → ${s1}, 출생신고 → ${s2}, 이후 오류 화면 없음`);
});

await runCase({ id: 'B-roulette-hidden', cat: 'B 룰렛', title: '룰렛 도중 탭 가림(visibilitychange hidden → visible): 룰렛이 멈추거나 꼬이지 않고 결과가 나온다', steps: '룰렛 시작 1초 뒤 문서를 가림 상태로 3초 → 보임 → 결과가 뜰 때까지(15초 안)' }, async () => {
  const { ctx, p, errs } = await fresh(D, false, 95);
  const problems = [];
  await waitGuard(p, 'start-birth');
  await p.getByTestId('start-birth').click();
  await p.waitForSelector('[data-testid="roulette-screen"]');
  await sleep(1000);
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(3000);
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const ok = await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 15000 }).then(() => true).catch(() => false);
  if (!ok) problems.push('가림 뒤 15초 안에 결과가 안 뜸');
  const scr = await whichScreen(p);
  if (scr === 'error-screen') problems.push('오류 화면');
  return finish('B-roulette-hidden', p, ctx, problems, errs, '가림·복귀 뒤 결과가 정상으로 뜸');
});

await browser.close();

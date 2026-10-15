// 모든 진행 버튼 연타(좌·중·우 지점): 배속 4개·다음 결정으로·자동 모드·선택지 버튼
import { DEV, FAST, GAME_KEY, SETTINGS_KEY, launch, mkctx, MOBILE, shot, snap, waitScreen, sleep, readSave, readSettings, runCase, mkState, pendingOf, envelope, inject, toLife } from './f-lib.mjs';

const browser = await launch();
const XF = [0.06, 0.5, 0.94];

await runCase({ id: 'F-AU10', cat: '#18 버튼 연타', title: '인생 화면 진행 버튼 6개(1·2·4·8배, 다음 결정으로, 자동 모드)를 좌·중·우 지점에서 각 15연타 (360x740 터치, 실시간)', steps: '가드가 풀린 뒤 버튼마다 left/center/right 15번씩 탭. 속도 버튼은 마지막 누른 배속, 자동은 홀짝, 다음 결정으로는 첫 선택지에서 멈추되 선택은 확정하지 않음', expected: '상태가 입력과 일치, 오류·밀린 화면 없음, 선택 자동 확정 없음' }, async () => {
  const ctx = await mkctx(browser, MOBILE);
  const page = await ctx.newPage();
  await page.goto(DEV + '/');
  await toLife(page, 'present');
  await sleep(700);
  const fails = [];
  const det = [];
  const tapN = async (loc, xf, n) => {
    const b = await loc.boundingBox();
    for (let i = 0; i < n; i++) await page.touchscreen.tap(b.x + b.width * xf, b.y + b.height / 2);
  };
  for (const sp of [1, 2, 4, 8]) {
    for (const xf of XF) {
      await tapN(page.locator(`[data-speed="${sp}"]`), xf, 15);
      await sleep(80);
      const s = await snap(page);
      const st = await readSettings(page);
      if (s.speed !== String(sp) || st?.data?.speed !== sp) fails.push(`속도 ${sp}배 xf=${xf}: 화면 ${s.speed} 저장 ${st?.data?.speed}`);
    }
  }
  det.push('속도 4×3지점 OK');
  let auto = (await snap(page)).auto === 'true';
  for (const xf of XF) {
    await tapN(page.getByTestId('auto'), xf, 15);
    await sleep(80);
    auto = !auto; // 15번 = 홀수 → 한 번 뒤집힘
    const s = await snap(page);
    if ((s.auto === 'true') !== auto) fails.push(`자동 xf=${xf}: 화면 ${s.auto} 기대 ${auto}`);
  }
  if (auto) {
    await page.getByTestId('auto').tap();
    await sleep(60);
  }
  det.push('자동 3지점 OK');
  await page.locator('[data-speed="8"]').tap();
  const before = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
  for (const xf of XF) {
    const s0 = await snap(page);
    if (s0.hasChoice) break;
    await tapN(page.getByTestId('skip'), xf, 15);
    await sleep(250);
  }
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 12000 });
  await sleep(300);
  const s1 = await snap(page);
  const after = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
  if (!s1.hasChoice) fails.push('다음 결정으로 연타 뒤 선택지가 없음');
  if (after !== before) fails.push(`다음 결정으로 연타가 선택을 확정함(${before}→${after})`);
  det.push(`다음 결정으로 연타 후 선택지 ${s1.choiceKey}, 선택 수 ${before}→${after}`);
  const sh = await shot(page, 'F-AU10');
  const sv = (await readSave(page)).data;
  if (sv.phase !== 'life') fails.push(`phase ${sv.phase}`);
  await ctx.close();
  return { verdict: fails.length ? 'FAIL' : 'PASS', actual: fails.length ? fails.join(' / ') : det.join(' | '), shots: [sh] };
});

for (const [id, vp] of [['F-AU11', [360, 740]], ['F-AU12', [360, 568]]]) {
  await runCase({ id, cat: '#18 버튼 연타', title: `선택지 버튼을 좌·중·우 지점에서 12연타, 선택지마다 3번 반복 (${vp[0]}x${vp[1]} 터치, 8배, 다음 선택지가 곧 뜸)`, ts: true, steps: '?__timescale=40, 선택지가 뜨면 가드가 풀린 뒤 첫째 선택지 버튼의 왼쪽/가운데/오른쪽 끝을 12번 탭(둘째 선택지 버튼도 같은 방식)', expected: '한 번의 연타로 선택은 1개만 확정되고, 곧바로 뜨는 다음 선택지는 눌리지 않는다' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: vp[0], height: vp[1] }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(DEV + '/?__timescale=40');
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: false } })]);
    await page.reload();
    await toLife(page, 'present');
    let rounds = 0;
    const bad = [];
    const durs = [];
    const t0 = Date.now();
    while (rounds < 9 && Date.now() - t0 < 90000) {
      const s = await snap(page);
      if (s.screen === 'ending-screen') break;
      if (!s.hasChoice) {
        await sleep(30);
        continue;
      }
      await page.waitForFunction(() => { const b = document.querySelector('.choice-list button'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 }).catch(() => {});
      const which = Math.floor(rounds / 3) % 2;
      const xf = XF[rounds % 3];
      const btn = page.locator('.choice-list button').nth(which);
      await btn.scrollIntoViewIfNeeded().catch(() => {});
      const box = await btn.boundingBox();
      if (!box) continue;
      const before = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
      const key0 = s.choiceKey;
      const tb = Date.now();
      for (let i = 0; i < 12; i++) await page.touchscreen.tap(box.x + box.width * xf, box.y + Math.min(box.height - 2, box.height / 2));
      const dur = Date.now() - tb;
      durs.push(dur);
      await sleep(80);
      const after = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
      rounds++;
      if (after - before > 1) bad.push(`라운드 ${rounds}(${key0}, xf=${xf}): 연타 ${dur}ms 동안 선택 ${after - before}개 확정`);
      await sleep(450);
    }
    const sh = await shot(page, id);
    await ctx.close();
    return { verdict: bad.length ? 'FAIL' : rounds >= 6 ? 'PASS' : 'ERROR', actual: bad.length ? bad.join('; ') : `${rounds}번의 연타 라운드(좌·중·우 × 첫째·둘째 선택지)에서 선택은 한 번에 1개씩만 확정됨(12연타 소요 ${Math.min(...durs)}~${Math.max(...durs)}ms)`, shots: [sh] };
  });
}
await browser.close();
console.log('done');

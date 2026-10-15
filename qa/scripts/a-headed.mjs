// 실제 창(헤드풀 Chromium)에서 탭을 바꿔 진짜 visibilitychange 로 "탭 가림" 검증. 창이 잠깐 뜬다.
import { DEV, launch, mkctx, runCase, shot, snap, toLife, readSave, sleep } from './lib.mjs';
const browser = await launch({ headless: false, args: ['--window-size=420,820'] });
await runCase('a-headed', { id: 'M3-A101', cat: '탭 가림(실제 창)', title: '실제(헤드풀) 브라우저: 다른 탭으로 전환해 진짜 가림 상태로 50초(1배·8배) 뒤 복귀', steps: '헤드풀 Chromium에서 인생 진행 중 새 탭을 앞으로 → 첫 탭의 visibilityState 확인 → 50초 → 첫 탭 복귀 → 나이 변화', expected: '가린 동안 나이 불변(브라우저 타이머 조절과 무관하게 앱이 멈춤), 복귀 후 몇 년이 한꺼번에 지나가지 않음' }, async () => {
  const bad = [];
  const rows = [];
  let sh = null;
  for (const sp of [1, 8]) {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    await ctx.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, ['suzeo-game:settings', JSON.stringify({ version: 1, data: { speed: sp, autoMode: sp === 8 } })]);
    const A = await ctx.newPage();
    await A.goto(DEV + '/');
    await toLife(A, 'present');
    await sleep(sp === 1 ? 5000 : 1200);
    const a0 = await snap(A);
    const B = await ctx.newPage();
    await B.goto('about:blank');
    await B.bringToFront();
    await sleep(800);
    const vis = await A.evaluate(() => document.visibilityState);
    const aH0 = await snap(A);
    await sleep(50000);
    const aH1 = await snap(A);
    const savedH = (await readSave(A)).data.age;
    await A.bringToFront();
    await sleep(sp === 1 ? 1500 : 800);
    const aV = await snap(A);
    await sleep(sp === 1 ? 9000 : 3000);
    const aV2 = await snap(A);
    const g = (s) => Number(String(s.age || '').replace('세', ''));
    rows.push(`${sp}배: 가림 상태=${vis}, 직전 ${a0.age} → 가린 뒤 ${aH0.age} → 50초 뒤 ${aH1.age}(저장 ${savedH}) → 복귀 직후 ${aV.age} → ${sp === 1 ? 10 : 4}초 뒤 ${aV2.age}`);
    if (vis !== 'hidden') rows.push(`(주의: 가림 상태가 ${vis} — 이 환경에서는 진짜 가림이 재현되지 않음)`);
    if (g(aH1) !== g(aH0)) bad.push(`${sp}배: 가린 동안 나이 변화 ${aH0.age}→${aH1.age}`);
    if (g(aV) - g(aH1) > 1) bad.push(`${sp}배: 복귀 직후 ${g(aV) - g(aH1)}년 점프`);
    if (aV.screen === 'superseded-screen' || aV.screen === 'error-screen') bad.push(`${sp}배: 복귀 후 ${aV.screen}`);
    if (sp === 1) sh = await shot(A, 'M3-A101');
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: sh ? [sh] : [] };
});
await browser.close();

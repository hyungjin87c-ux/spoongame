// QA-003 M8 LM6·LM5: 플레이 시간 타이머 — 늘어야 할 때 늘고(연출·결정 읽기) 늘지 않아야 할 때(일시정지·탭 가림·카드 접기·기록 시트·나가기 확인·첫 화면 다시 열기) 늘지 않는가.
// 사용: node qa/scripts/m8-play.mjs <part ...>   part: grow pause hidden fold note exit title reload close freeze
// 배포 번들(prod, 시간 배율 없음) 실제 시계. 지금 값은 `pagehide`를 보내 앱이 저장에 담아 쓰게 한 뒤 저장에서 읽는다(앱 코드는 그대로).
import { launch, openOracle, plainLife, pendingState, openSeeded, flushPlay, readSave, shot, sleep, runCase, appendJsonl, SET_MANUAL, GAME_KEY, PROD } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const W = Number(process.env.M8_WAIT || 20000);
const VIS_INIT = () => {
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};
const setVis = (page, v) =>
  page.evaluate((x) => {
    window.__vis = x;
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);

const d = (a, b) => ({ hold: b.hold - a.hold, decide: b.decide - a.decide, fold: b.fold - a.fold, note: b.note - a.note, idle: b.idle - a.idle, offSpeed: b.offSpeed - a.offSpeed, auto: b.auto - a.auto, skips: b.skips - a.skips, resumes: b.resumes - a.resumes });
const sec = (x) => +(x / 1000).toFixed(2);
const brief = (x) => `hold ${sec(x.hold)} decide ${sec(x.decide)} fold ${sec(x.fold)} note ${sec(x.note)} idle ${sec(x.idle)}`;

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const runState = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: false });
const pendState = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
if (!runState || !pendState) throw new Error('상태 만들기 실패');
appendJsonl('play-states.jsonl', { runPlay: runState.play ?? null, pendPlay: pendState.play ?? null, runAge: runState.age, pendAge: pendState.age, pendKey: pendState.pending && pendState.pending.key });

const near = (v, target, tolMs) => Math.abs(v - target) <= tolMs;
const open = (state, extra = {}) => openSeeded(browser, state, { settings: SET_MANUAL, init: VIS_INIT, ...extra });

if (parts.includes('grow')) {
  await runCase({ id: 'PL01', title: '연출 구간에서 hold가 흐른 시간만큼 늘고 다른 버킷은 그대로' }, async () => {
    const { ctx, page } = await open(runState);
    const a = await flushPlay(page);
    await sleep(12000);
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = near(x.hold, 12000, 1000) && x.decide === 0 && x.fold === 0 && x.note === 0 && x.idle === 0 && x.offSpeed === 0 && x.auto === 0;
    const s = await shot(page, 'PL01', 'hold-grow');
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `12초 동안 ${brief(x)}, offSpeed ${sec(x.offSpeed)} auto ${sec(x.auto)} (시작 play=${JSON.stringify(a)})`, shots: [s] };
  });
  await runCase({ id: 'PL02', title: '결정 카드를 읽는 동안 decide가 늘고 hold는 그대로' }, async () => {
    const { ctx, page } = await open(pendState);
    await page.waitForSelector('[data-testid="choice-panel"]');
    const a = await flushPlay(page);
    await sleep(12000);
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = near(x.decide, 12000, 1000) && x.hold <= 1000 && x.fold === 0 && x.note === 0 && x.idle === 0;
    const s = await shot(page, 'PL02', 'decide-grow');
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `카드가 열린 12초 동안 ${brief(x)}`, shots: [s] };
  });
}

if (parts.includes('pause')) {
  await runCase({ id: 'PL03', title: '일시정지 20초: hold+decide 증가 ≤ 1초, idle ≈ 20초, 재개하면 hold 이어서 늘어남' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    await page.getByTestId('pause').click();
    await sleep(300);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    const s1 = await shot(page, 'PL03', 'paused');
    await page.getByTestId('pause').click();
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const idleSpan = c.idle - a.idle; // idle만 바뀐 상태는 저장에 쓰지 않는 빌드가 있어(R-417) 재개 뒤 첫 저장에서 합쳐 읽는다
    const ok = x.hold + x.decide <= 1000 && near(idleSpan, W, 1500) && y.hold >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `일시정지 ${W / 1000}초: ${brief(x)} / 재개 4초 뒤: ${brief(y)} / 정지부터 재개 뒤까지 idle ${sec(idleSpan)}초`, shots: [s1] };
  });
}

if (parts.includes('hidden')) {
  await runCase({ id: 'PL04', title: '탭 가림 20초: hold+decide 증가 ≤ 1초, idle ≈ 20초, 다시 보이면 이어서 증가' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    await setVis(page, 'hidden');
    await sleep(300);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    await setVis(page, 'visible');
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const idleSpan = c.idle - a.idle;
    const ok = x.hold + x.decide <= 1000 && near(idleSpan, W, 1500) && y.hold >= 3000;
    const s = await shot(page, 'PL04', 'visible-again');
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `가려진 ${W / 1000}초: ${brief(x)} / 다시 보인 4초 뒤: ${brief(y)} / 가림부터 복귀 뒤까지 idle ${sec(idleSpan)}초`, shots: [s] };
  });
  await runCase({ id: 'PL04b', title: '결정 카드가 떠 있는 채 탭 가림 20초: decide 증가 ≤ 1초' }, async () => {
    const { ctx, page } = await open(pendState);
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(1500);
    await setVis(page, 'hidden');
    await sleep(300);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    await setVis(page, 'visible');
    await sleep(3000);
    const c = await flushPlay(page);
    const idleSpan = c.idle - a.idle;
    const y = d(b, c);
    const ok = x.hold + x.decide <= 1000 && near(idleSpan, W, 1500) && y.decide >= 1500;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `카드 열림 + 가림 ${W / 1000}초: ${brief(x)} / 다시 보인 3초 뒤: ${brief(y)} / idle ${sec(idleSpan)}초` };
  });
}

if (parts.includes('fold')) {
  await runCase({ id: 'PL05', title: '결정 카드 접기 20초: fold만 증가(decide ≤ 1초), 다시 열면 decide 증가' }, async () => {
    const { ctx, page } = await open(pendState);
    await page.waitForSelector('[data-testid="choice-panel"]');
    const before = await flushPlay(page);
    await sleep(3000);
    await page.getByTestId('decision-fold-btn').click();
    await sleep(500);
    const a = await flushPlay(page);
    const pre = d(before, a);
    const s1 = await shot(page, 'PL05', 'folded');
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    await page.getByTestId('decision-reopen').click();
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const ok = x.hold + x.decide <= 1000 && near(x.fold, W, 1500) && y.decide >= 3000 && pre.decide >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `열린 3.5초: decide ${sec(pre.decide)} / 접은 ${W / 1000}초: ${brief(x)} / 다시 연 4초: ${brief(y)}`, shots: [s1] };
  });
}

if (parts.includes('note')) {
  await runCase({ id: 'PL06', title: '기록 시트(생각 남기기) 열린 20초: note만 증가(hold+decide ≤ 1초), 닫으면 이어서 hold 증가' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    await page.getByTestId('tool-note').click();
    await page.waitForSelector('[data-testid="note-sheet"]');
    await sleep(300);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    const s1 = await shot(page, 'PL06', 'note-open');
    await page.keyboard.press('Escape');
    await sleep(900);
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const ok = x.hold + x.decide <= 1000 && near(x.note, W, 1500) && y.hold >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `시트가 열린 ${W / 1000}초: ${brief(x)} / 닫은 뒤 약 5초: ${brief(y)}`, shots: [s1] };
  });
}

if (parts.includes('exit')) {
  await runCase({ id: 'PL07', title: '나가기 확인 단계 20초: idle만 증가(hold+decide ≤ 1초), 「돌아가기」하면 이어서 hold' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]');
    await sleep(300);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    const s1 = await shot(page, 'PL07', 'exit-ask');
    await page.getByTestId('exit-no').click();
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const idleSpan = c.idle - a.idle;
    const ok = x.hold + x.decide <= 1000 && near(idleSpan, W, 1500) && y.hold >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `나가기 확인 ${W / 1000}초: ${brief(x)} / 돌아와 4초 뒤: ${brief(y)} / idle ${sec(idleSpan)}초`, shots: [s1] };
  });
  await runCase({ id: 'PL07b', title: '결정 카드를 접은 채 나가기 확인 20초: decide 증가 ≤ 1초' }, async () => {
    const { ctx, page } = await open(pendState);
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(1500);
    const hasFold = await page.getByTestId('decision-fold-btn').count();
    if (hasFold) {
      await page.getByTestId('decision-fold-btn').click();
      await sleep(600);
    }
    await page.getByTestId('tool-exit').click({ timeout: 4000 }).catch(() => {});
    await sleep(300);
    const open1 = await page.getByTestId('exit-ask').count();
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    await page.getByTestId('exit-no').click({ timeout: 3000 }).catch(() => {});
    await sleep(3000);
    const c = await flushPlay(page);
    const idleSpan = c.idle - a.idle;
    const ok = open1 === 1 && x.hold + x.decide <= 1000 && near(idleSpan, W, 1500);
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `접힘 + 나가기 확인(열림 ${open1}) ${W / 1000}초: ${brief(x)} / idle ${sec(idleSpan)}초` };
  });
}

if (parts.includes('title')) {
  await runCase({ id: 'PL08', title: '「나가기」로 첫 화면을 다시 연 20초: idle만 증가, 새로고침 뒤에도 같은 기록' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]');
    await page.getByTestId('exit-yes').click();
    await page.waitForSelector('[data-testid="title-screen"]');
    await sleep(400);
    const a = await flushPlay(page);
    await sleep(W);
    const b = await flushPlay(page);
    const x = d(a, b);
    const s1 = await shot(page, 'PL08', 'title-reopened');
    await page.getByTestId('resume').click();
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(300);
    // 나가기는 일시정지 상태로 저장하므로 이어서 살아도 일시정지다 — 계속하기를 눌러야 연출이 흐른다
    if ((await page.getByTestId('pause').getAttribute('data-paused')) === 'true') await page.getByTestId('pause').click();
    await sleep(4000);
    const c = await flushPlay(page);
    const y = d(b, c);
    const idleSpan = c.idle - a.idle;
    const ok = x.hold + x.decide <= 1000 && near(idleSpan, W, 1500) && y.hold >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `첫 화면 다시 열기 ${W / 1000}초: ${brief(x)} / 「이어서 살기」 + 계속하기 4초 뒤: ${brief(y)} / idle ${sec(idleSpan)}초`, shots: [s1] };
  });
}

if (parts.includes('reload')) {
  await runCase({ id: 'PL09', title: '새로고침 뒤 이어서 누적(이어하기 +1, 줄지 않음), 새로고침 연타 10회에도 유지' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(15000);
    const a = await flushPlay(page);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(300);
    const b = await flushPlay(page);
    await sleep(8000);
    const c = await flushPlay(page);
    const trail = [];
    for (let i = 0; i < 10; i++) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      await sleep(250);
      trail.push((await flushPlay(page)).hold);
    }
    const e = await flushPlay(page);
    const mono = trail.every((v, i) => i === 0 || v >= trail[i - 1] - 50);
    const ok = b.hold >= a.hold - 300 && b.resumes === a.resumes + 1 && c.hold - b.hold >= 6500 && c.hold - b.hold <= 9500 && e.resumes === c.resumes + 10 && mono && e.hold >= c.hold - 300;
    const s1 = await shot(page, 'PL09', 'after-reload-storm');
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `새로고침 전 hold ${sec(a.hold)} resumes ${a.resumes} → 직후 ${sec(b.hold)} resumes ${b.resumes} → 8초 뒤 ${sec(c.hold)} → 연타 10회 뒤 ${sec(e.hold)} resumes ${e.resumes}(+${e.resumes - c.resumes}); 단조 ${mono}`, shots: [s1] };
  });
}

if (parts.includes('close')) {
  await runCase({ id: 'PL10', title: '탭 닫기(저장 flush 없이) 뒤 같은 저장으로 다시 열면 이어서 누적 — 잃는 시간 ≤ 약 10초' }, async () => {
    const { ctx, page } = await open(runState, { localFlag: true });
    await sleep(27000);
    const raw1 = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const saved1 = raw1 ? JSON.parse(raw1).data.play : null;
    await page.close({ runBeforeUnload: false });
    const p2 = await ctx.newPage();
    await p2.goto(PROD, { waitUntil: 'load' });
    await p2.waitForSelector('[data-testid="life-screen"]');
    await sleep(400);
    const after = await flushPlay(p2);
    const ok = saved1 !== null && after.hold >= saved1.hold - 200 && after.resumes === saved1.resumes + 1 && saved1.hold >= 27000 - 11500;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `27초 뒤 저장돼 있던 hold ${sec(saved1 ? saved1.hold : -1)}(잃은 몫 ≈ ${sec(27000 - (saved1 ? saved1.hold : 0))}초) → 다시 열어 ${sec(after.hold)} resumes ${saved1 ? saved1.resumes : '?'} → ${after.resumes}` };
  });
}

if (parts.includes('freeze')) {
  await runCase({ id: 'PL11', title: '5초 클램프: 페이지가 12초 멈췄다 풀려도 hold는 한 틱에 5초까지만' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(2500);
    const a = await flushPlay(page);
    const cdp = await ctx.newCDPSession(page);
    let how = 'frozen';
    try {
      await cdp.send('Debugger.enable');
      await cdp.send('Debugger.pause');
      await sleep(12000);
      await cdp.send('Debugger.resume');
    } catch (e) {
      how = 'no-cdp:' + String(e.message).slice(0, 60);
    }
    await sleep(600);
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = how === 'frozen' && x.hold <= 5000 + 2500 && x.hold >= 3000;
    await ctx.close();
    return { verdict: how === 'frozen' ? (ok ? 'PASS' : 'FAIL') : 'SKIP', actual: `디버거 정지 12초(${how}) 뒤 ${brief(x)} — 벽시계는 약 15초 흘렀다` };
  });
}


const total = (x) => x.hold + x.decide + x.fold + x.note + x.idle;

if (parts.includes('spam')) {
  await runCase({ id: 'PL12', title: '탭 가림/보임 20회 전환(20초): 모든 버킷의 합 ≈ 흐른 시간(이중 계산·누락 없음), hold ≈ 보인 시간, idle ≈ 가린 시간' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(1500);
    const a = await flushPlay(page);
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      await setVis(page, 'hidden');
      await sleep(400);
      await setVis(page, 'visible');
      await sleep(600);
    }
    const wall = Date.now() - t0;
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = Math.abs(total(x) - wall) <= 1200 && Math.abs(x.idle - 8000) <= 2500 && Math.abs(x.hold - 12000) <= 2500 && x.decide === 0;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `벽시계 ${sec(wall)}초 동안 ${brief(x)} (합 ${sec(total(x))})` };
  });
  await runCase({ id: 'PL13', title: '일시정지·재개 연타 40회(약 10초): 버킷 합 ≈ 흐른 시간, hold+idle 외 증가 0' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(1500);
    const a = await flushPlay(page);
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) {
      await page.getByTestId('pause').click({ timeout: 2000 }).catch(() => {});
      await sleep(200);
    }
    const wall = Date.now() - t0;
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = Math.abs(total(x) - wall) <= 1200 && x.decide === 0 && x.fold === 0 && x.note === 0;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `벽시계 ${sec(wall)}초 동안 ${brief(x)} (합 ${sec(total(x))})` };
  });
  await runCase({ id: 'PL14', title: '결정 카드 접기·다시 열기 연타 30회(약 10초): decide+fold ≈ 흐른 시간, hold 증가 0' }, async () => {
    const { ctx, page } = await open(pendState);
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(800);
    const a = await flushPlay(page);
    const t0 = Date.now();
    for (let i = 0; i < 30; i++) {
      const fold = page.getByTestId('decision-fold-btn');
      const reopen = page.getByTestId('decision-reopen');
      if (await fold.count()) await fold.click({ timeout: 1000 }).catch(() => {});
      else if (await reopen.count()) await reopen.click({ timeout: 1000 }).catch(() => {});
      await sleep(330);
    }
    const wall = Date.now() - t0;
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = Math.abs(total(x) - wall) <= 1200 && x.hold <= 300 && x.note === 0 && x.idle === 0;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `벽시계 ${sec(wall)}초 동안 ${brief(x)} (합 ${sec(total(x))})` };
  });
  await runCase({ id: 'PL15', title: '기록 시트 열기·닫기 반복 15회: hold+note ≈ 흐른 시간, decide·fold·idle 증가 0' }, async () => {
    const { ctx, page } = await open(runState);
    await sleep(1200);
    const a = await flushPlay(page);
    const t0 = Date.now();
    for (let i = 0; i < 15; i++) {
      await page.getByTestId('tool-note').click({ timeout: 2000 }).catch(() => {});
      await sleep(500);
      await page.keyboard.press('Escape');
      await sleep(650);
    }
    const wall = Date.now() - t0;
    const b = await flushPlay(page);
    const x = d(a, b);
    const ok = Math.abs(total(x) - wall) <= 1200 && x.decide === 0 && x.fold === 0 && x.idle === 0 && x.note >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `벽시계 ${sec(wall)}초 동안 ${brief(x)} (합 ${sec(total(x))})` };
  });
}

if (parts.includes('tabs')) {
  await runCase({ id: 'PL16', title: '두 탭: 다른 탭이 저장을 앞서면 밀린 탭은 시간을 쌓지 않고, 「이어하기」하면 앞선 탭의 기록에서 이어 쌓는다(되감기·이중 계산 없음)' }, async () => {
    const { ctx, page: A } = await open(runState, { localFlag: true });
    await sleep(3000);
    const B = await ctx.newPage();
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector('[data-testid="life-screen"], [data-testid="superseded-screen"]');
    await sleep(800);
    await B.getByTestId('pause').click().catch(() => {});
    await B.getByTestId('pause').click().catch(() => {});
    await sleep(500);
    const aScreen = await A.evaluate(() => (document.querySelector('[data-testid="superseded-screen"]') ? 'superseded' : document.querySelector('[data-testid="life-screen"]') ? 'life' : '?'));
    const bScreen = await B.evaluate(() => (document.querySelector('[data-testid="superseded-screen"]') ? 'superseded' : document.querySelector('[data-testid="life-screen"]') ? 'life' : '?'));
    // B가 마지막 쓰기라면 A가 밀린다 (또는 반대)
    const slow = aScreen === 'superseded' ? A : B;
    const live = aScreen === 'superseded' ? B : A;
    const liveName = aScreen === 'superseded' ? 'B' : 'A';
    const before = await flushPlay(live);
    await sleep(12000);
    const after = await flushPlay(live);
    const x = d(before, after);
    // 밀린 탭이 12초 동안 저장을 덮지 않았는가 → 살아 있는 탭의 기록이 12초 늘어 있다
    const s1 = await shot(slow, 'PL16', 'superseded-tab');
    await slow.getByTestId('take-over').click();
    await sleep(1500);
    const afterTake = await flushPlay(slow);
    const ok = (aScreen === 'superseded' || bScreen === 'superseded') && near(x.hold, 12000, 1200) && afterTake.hold >= after.hold - 300 && afterTake.hold <= after.hold + 3500;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `A ${aScreen} / B ${bScreen}, 살아 있는 탭(${liveName}) 12초: ${brief(x)} / 이어받은 뒤 hold ${sec(afterTake.hold)} (이어받기 전 ${sec(after.hold)})`, shots: [s1] };
  });
}

if (parts.includes('back')) {
  await runCase({ id: 'PL17', title: '뒤로가기·앞으로가기: 앱을 벗어났다 돌아와도 play가 줄지 않고, 벗어나 있던 시간은 hold에 들어가지 않는다' }, async () => {
    const { ctx, page } = await open(runState, { localFlag: true });
    await page.goto('about:blank');
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(6000);
    const a = await flushPlay(page);
    await page.goBack();
    await sleep(9000); // 앱 밖에서 9초
    await page.goForward();
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
    await sleep(500);
    const b = await flushPlay(page);
    await sleep(4000);
    const c = await flushPlay(page);
    const away = d(a, b);
    const ok = b.hold >= a.hold - 200 && away.hold <= 6200 && c.hold - b.hold >= 3000;
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `나가기 전 hold ${sec(a.hold)} resumes ${a.resumes} → 앞으로가기 직후 hold ${sec(b.hold)} resumes ${b.resumes}(밖에서 9초 + 돌아온 0.5초 동안 hold +${sec(away.hold)}) → 4초 뒤 +${sec(c.hold - b.hold)}` };
  });
}

if (parts.includes('btn')) {
  await runCase({ id: 'PL18', title: '「다음 결정으로」·배속·자동 연타 30회: skips는 실제로 건너뛴 횟수만, 최종 상태와 기록이 어긋나지 않는다' }, async () => {
    const { ctx, page } = await open({ ...runState, paused: false }, { settings: { ...SET_MANUAL, noteCards: false } });
    await sleep(800);
    const a = await flushPlay(page);
    for (let i = 0; i < 30; i++) await page.getByTestId('skip').click({ timeout: 1500, noWaitAfter: true }).catch(() => {});
    await sleep(500);
    const b = await flushPlay(page);
    const pending = await page.evaluate(() => !!document.querySelector('[data-testid="choice-panel"]'));
    for (let i = 0; i < 30; i++) {
      await page.locator('[data-speed="' + [2, 4, 8, 1][i % 4] + '"]').click({ timeout: 800, noWaitAfter: true }).catch(() => {});
      await page.getByTestId('auto').click({ timeout: 800, noWaitAfter: true }).catch(() => {});
    }
    await sleep(500);
    const c = await flushPlay(page);
    const st = await page.evaluate(() => ({ auto: document.querySelector('[data-testid="auto"]').getAttribute('aria-pressed'), speed: document.querySelector('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') }));
    const sv = (await readSave(page)).data;
    const ok = b.skips - a.skips >= 1 && b.skips - a.skips <= 2 && pending && c.skips === b.skips && sv.age >= 9 && !!c;
    const s1 = await shot(page, 'PL18', 'after-spam');
    await ctx.close();
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `건너뛰기 30번 클릭 → skips +${b.skips - a.skips}(카드 대기 ${pending}), 배속·자동 연타 60번 뒤 skips ${c.skips}, offSpeed ${sec(c.offSpeed)} auto ${sec(c.auto)}, 화면 상태 자동 ${st.auto} 배속 ${st.speed}, 나이 ${sv.age}`, shots: [s1] };
  });
}

await browser.close();
console.log('parts done', parts.join(','));

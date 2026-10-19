// QA-003 M8 2회차 (가)(나): 다중 탭·저장 실패 불변식을 시간을 재는 판(withPlay: 오라클 상태는 play가 있다, UI로 태어난 판도 포함)으로 다시 잰다.
//  TB01-{pending,running,paused}  탭 A가 판을 연 채 같은 저장을 탭 B로 열기만 한다. 열고 7초 동안 B의 localStorage.setItem(게임 키·설정 키)을 센다 → 0회, A는 밀린 화면이 아니고 시간이 계속 쌓인다
//  TB01-ui-born                   A가 UI로 태어나기부터 시작한 판(이 탭이 시작한 판) → B 열기만
//  TB01-bg / -close / -pausedA    B를 가려진 채 열기 / B를 열고 곧바로 닫기(pagehide 이벤트 + 실제 닫기) / A를 일시정지해 둔 채 배경 탭 B를 닫기만
//  TB01-did                       반대 짝: 일시정지해 둔 한 탭이 일시정지를 풀고 2.5초 흘린 뒤 pagehide → 쓰기 ≥ 1, resumes +1
//  TB02-{pending,paused}-{gamekey,allkeys}  정상 저장소로 한 번 열어 앱이 자기 형식으로 쓰게 한 뒤 쓰기가 막힌 기기로 바꿔 새로고침 → 열기만: 3.5초·(pending은) 13.5초에 안내 없음, 열고 7초 안 쓰기 시도 0회
//  TB02-ctl-choice / -ctl-note / -sheet-open  대조: 막힌 기기에서 선택 1회 → 안내 + 앱 계속 / 기록 시트만 열면 안내 없음, 글을 담으면 안내 + 기록이 인생 기록에 남음
//  TB02-13s                       막힌 기기에서 결정 카드를 13.5초 열어 둔다 → 안내 없음 (PASS)
//  TB03 / TB03-vis                보이는 탭 A가 결정 카드를 10초 넘게 열어 둔다 → A가 쓰고 열기만 한 B가 밀린 화면, 이어받으면 이어서 (PASS)
// 사용: node qa/scripts/m8-r2-tabs.mjs [part ...]  part: b01 b01x b01c ux b02 b02ctl b03
import { launch, openOracle, plainLife, pendingState, openSeeded, flushPlay, readSave, shot, sleep, runCase, mkctx, toRoulette, skipToBirth, birthToLife, SET_MANUAL, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, PROD, TOUCH, readNote, readLog } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const want = (p) => parts.length === 0 || parts.includes(p);
const browser = await launch();
const { page: oracle } = await openOracle(browser);
const runState = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: false });
const pausedState = { ...runState, paused: true };
const pendState = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
if (!runState || !pendState || !runState.play || !pendState.play) throw new Error('상태 만들기 실패 또는 play 없음(withPlay 아님)');

/** 모든 localStorage.setItem을 센다(키 이름 기록) */
const WRAP = () => {
  window.__writes = [];
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__writes.push(String(k));
    return original.call(this, k, v);
  };
};
/** 쓰기가 막힌 기기를 흉내: 플래그(localStorage __qa_throw)가 켜진 뒤 suzeo-game:* 키의 setItem이 던진다. 시도 횟수를 센다. '1' = 게임·설정 키 모두, 'game' = 게임 키만 */
const THROW = () => {
  window.__attempts = [];
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && String(k).startsWith('suzeo-game:')) {
      const flag = Storage.prototype.getItem.call(this, '__qa_throw');
      if (flag === '1' || (flag === 'game' && k === 'suzeo-game:save')) {
        window.__attempts.push(String(k));
        throw new DOMException('quota', 'QuotaExceededError');
      }
    }
    return original.call(this, k, v);
  };
};
const HIDDEN_FROM_START = () => {
  window.__vis = 'hidden';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};
const screenOf = (p) => p.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen', 'error-screen', 'ending-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'none');
const writesOf = (p) => p.evaluate(() => window.__writes || []);
const rawOf = (p) => p.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const rawSet = (p) => p.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
const sec = (x) => +(x / 1000).toFixed(2);
const WAIT_B = '[data-testid="life-screen"], [data-testid="superseded-screen"]';
const savedPlay = async (p) => {
  const s = await readSave(p);
  return s && s.data ? s.data.play : null;
};

if (want('b01')) {
  // ---- TB01 세 상태: 열고 7초 창
  for (const [name, state, sel] of [['pending', pendState, '[data-testid="choice-panel"]'], ['running', runState, '[data-testid="life-screen"]'], ['paused', pausedState, '[data-testid="life-screen"]']]) {
    await runCase({ id: `TB01-${name}`, title: `다중 탭(R-047, withPlay): 탭 A가 ${name} 판을 연 채 탭 B로 같은 저장을 열기만 한다 — 열고 7초 동안 B의 setItem(게임·설정 키) 0회, A는 밀리지 않고 시간이 쌓인다` }, async () => {
      const { ctx, page: A } = await openSeeded(browser, state, { localFlag: true, wait: sel, init: WRAP });
      await sleep(2500);
      const aBefore = (await writesOf(A)).length;
      const rawBefore = await rawOf(A);
      const B = await ctx.newPage();
      await B.goto(PROD, { waitUntil: 'load' });
      await B.waitForSelector(WAIT_B);
      const tOpen = Date.now();
      await sleep(7000 - (Date.now() - tOpen));
      const bWrites = await writesOf(B);
      const aScreen = await screenOf(A);
      const bScreen = await screenOf(B);
      const aWritesInWindow = (await writesOf(A)).length - aBefore;
      const s1 = await shot(A, `TB01-${name}`, 'tab-A');
      const s2 = await shot(B, `TB01-${name}`, 'tab-B');
      // A의 시간이 계속 쌓이는지: pagehide로 A가 쓴 play (B가 이 쓰기로 밀리는 것은 R-011 — 이 창 밖)
      const playA = await flushPlay(A);
      const grew = name === 'paused' ? playA.hold + playA.decide === 0 : playA.hold + playA.decide >= 8000;
      await ctx.close();
      const ok = bWrites.length === 0 && aScreen === 'life-screen' && grew;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `B 쓰기 ${bWrites.length}회(${[...new Set(bWrites)].join(',') || '-'}) / A 화면 ${aScreen}(창 안 A 쓰기 ${aWritesInWindow}회) / B 화면 ${bScreen} / A의 쌓인 시간(창 끝 pagehide) hold ${sec(playA.hold)} decide ${sec(playA.decide)} idle ${sec(playA.idle)} resumes ${playA.resumes} — ${name === 'paused' ? '일시정지라 hold·decide 증가 없음이 정상' : `hold+decide 8초 이상이어야 함`}`, shots: [s1, s2] };
    });
  }

  // ---- UI로 태어나기부터 시작한 판(이 탭이 시작한 판)도 B가 열기만 하면 0회
  await runCase({ id: 'TB01-ui-born', title: '다중 탭(R-047, withPlay): 탭 A가 UI로 태어나기부터 시작한 판을 살고 있을 때 탭 B가 열기만 해도 B의 setItem 0회, A는 밀리지 않는다' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(() => {
      try {
        if (!localStorage.getItem('__qa_cleaned')) {
          localStorage.clear();
          localStorage.setItem('__qa_cleaned', '1');
        }
      } catch {}
    });
    await ctx.addInitScript(WRAP);
    const A = await ctx.newPage();
    await A.goto(PROD, { waitUntil: 'load' });
    await A.waitForSelector('[data-testid="title-screen"]');
    await toRoulette(A, 'present');
    await skipToBirth(A);
    await birthToLife(A);
    await sleep(4000);
    const rawBefore = await rawOf(A);
    const B = await ctx.newPage();
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector(WAIT_B);
    await sleep(7000);
    const bWrites = await writesOf(B);
    const aScreen = await screenOf(A);
    const bScreen = await screenOf(B);
    const s1 = await shot(A, 'TB01-ui-born', 'tab-A');
    const playA = await flushPlay(A);
    await ctx.close();
    const ok = bWrites.length === 0 && aScreen === 'life-screen' && playA.hold >= 8000;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `B 쓰기 ${bWrites.length}회(${[...new Set(bWrites)].join(',') || '-'}) / A 화면 ${aScreen} / B 화면 ${bScreen} / A의 hold ${sec(playA.hold)}초 resumes ${playA.resumes}(이 탭이 시작한 판이라 0이어야 함)`, shots: [s1] };
  });
}

if (want('b01x')) {
  // ---- TB01-bg: B를 가려진 채 열기
  await runCase({ id: 'TB01-bg', title: '다중 탭: B를 처음부터 가려진(hidden) 채 열기만 해도 B의 쓰기 0회, A는 밀리지 않는다 (7초 + 가림 유지 14초)' }, async () => {
    const { ctx, page: A } = await openSeeded(browser, pendState, { localFlag: true, wait: '[data-testid="choice-panel"]', init: WRAP });
    await sleep(2500);
    const B = await ctx.newPage();
    await B.addInitScript(HIDDEN_FROM_START);
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector(WAIT_B);
    await sleep(7000);
    const w7 = (await writesOf(B)).length;
    await sleep(7000);
    const w14 = await writesOf(B);
    const aScreen = await screenOf(A);
    const bScreen = await screenOf(B);
    const s1 = await shot(A, 'TB01-bg', 'tab-A');
    await ctx.close();
    return { verdict: w14.length === 0 && aScreen === 'life-screen' ? 'PASS' : 'FAIL', actual: `가려진 B 쓰기 7초 ${w7}회 · 14초 ${w14.length}회(${[...new Set(w14)].join(',') || '-'}) / A ${aScreen} / B ${bScreen}`, shots: [s1] };
  });

  // ---- TB01-close: B를 열고 곧바로 닫기 (pagehide 이벤트 + 실제 닫기), 결정 카드가 떠 있는 판(51ms 짜리 decide가 쌓이는 경로)
  for (const [name, state, sel] of [['pending', pendState, '[data-testid="choice-panel"]'], ['running', runState, '[data-testid="life-screen"]']]) {
    await runCase({ id: `TB01-close-${name}`, title: `다중 탭: ${name} 판을 A가 열어 둔 채 B를 열고 곧바로 닫는다(pagehide 이벤트 → 실제 닫기) — B 쓰기 0회, 저장 원문 그대로, A는 밀리지 않는다` }, async () => {
      const { ctx, page: A } = await openSeeded(browser, state, { localFlag: true, wait: sel, init: WRAP });
      await sleep(2400);
      const rawBefore = await rawOf(A);
      const aW0 = (await writesOf(A)).length;
      const B = await ctx.newPage();
      await B.goto(PROD, { waitUntil: 'load' });
      await B.waitForSelector(WAIT_B);
      await sleep(250); // 열자마자(결정 카드·연출이 겨우 보이는 시점)
      await B.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await sleep(120);
      const bWrites = await writesOf(B);
      await B.close({ runBeforeUnload: true });
      await sleep(1500);
      const aScreen = await screenOf(A);
      const rawAfter = await rawOf(A);
      const aW1 = (await writesOf(A)).length;
      const s1 = await shot(A, `TB01-close-${name}`, 'tab-A');
      await ctx.close();
      const same = rawBefore === rawAfter;
      const ok = bWrites.length === 0 && aScreen === 'life-screen' && same && aW1 === aW0;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `B pagehide 뒤 쓰기 ${bWrites.length}회 / A 화면 ${aScreen} / 저장 원문 ${same ? '그대로' : '바뀜'} / 그 사이 A 쓰기 ${aW1 - aW0}회`, shots: [s1] };
    });
  }

  // ---- TB01-pausedA: A를 일시정지해 둔 채 배경 탭 B를 닫기만
  await runCase({ id: 'TB01-pausedA', title: '다중 탭: A를 일시정지해 둔 채 가려진 배경 탭 B를 열었다 닫기만 — B 쓰기 0회, A 안 밀림, 저장 원문 그대로' }, async () => {
    const { ctx, page: A } = await openSeeded(browser, pausedState, { localFlag: true, wait: '[data-testid="life-screen"]', init: WRAP });
    await sleep(2500);
    const rawBefore = await rawOf(A);
    const B = await ctx.newPage();
    await B.addInitScript(HIDDEN_FROM_START);
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector(WAIT_B);
    await sleep(3000);
    await B.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await sleep(120);
    const bWrites = await writesOf(B);
    await B.close({ runBeforeUnload: true });
    await sleep(2000);
    const aScreen = await screenOf(A);
    const rawAfter = await rawOf(A);
    const s1 = await shot(A, 'TB01-pausedA', 'tab-A');
    await ctx.close();
    const same = rawBefore === rawAfter;
    return { verdict: bWrites.length === 0 && aScreen === 'life-screen' && same ? 'PASS' : 'FAIL', actual: `B 쓰기 ${bWrites.length}회 / A ${aScreen} / 저장 원문 ${same ? '그대로' : '바뀜'}`, shots: [s1] };
  });

  // ---- TB01-did: 한 탭, 일시정지를 풀고 2.5초 흘린 뒤 pagehide
  await runCase({ id: 'TB01-did', title: '반대 짝(한 탭): 일시정지해 둔 채 열린 탭이 일시정지를 풀고 2.5초 흘린 뒤 pagehide → 쓰기 ≥ 1, resumes +1 (사람이 한 일이 있으면 쓴다)' }, async () => {
    const { ctx, page } = await openSeeded(browser, pausedState, { wait: '[data-testid="life-screen"]', init: WRAP });
    await sleep(1500);
    const before = await savedPlay(page);
    const w0 = (await writesOf(page)).length;
    await page.getByTestId('pause').click();
    await sleep(2500);
    // 마스터 정정 ④: 일시정지를 푸는 것 자체가 저장 effect로 쓰므로, 세는 쓰기는 「푼 뒤 2.5초가 지나고 pagehide를 보낸 쓰기」다
    const wMid = (await writesOf(page)).length;
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await sleep(120);
    const after = await savedPlay(page);
    const w1 = (await writesOf(page)).length;
    const s1 = await shot(page, 'TB01-did', 'after');
    await ctx.close();
    const ok = w1 - wMid >= 1 && after.resumes === before.resumes + 1 && after.hold >= 2000;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `일시정지를 푼 쓰기 ${wMid - w0}회(상태 변화 저장) 뒤 2.5초 + pagehide로 쓴 쓰기 ${w1 - wMid}회 / resumes ${before.resumes} → ${after.resumes} / hold ${sec(before.hold)} → ${sec(after.hold)}`, shots: [s1] };
  });
}

const VIS_INIT = () => {
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};
const WRAP_VIS = () => {
  window.__writes = [];
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__writes.push(String(k));
    return original.call(this, k, v);
  };
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
};
const setVis = (page, v) =>
  page.evaluate((x) => {
    window.__vis = x;
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);

if (want('b01c')) {
  // ---- 마스터 정정 ①: 앱이 뜬 뒤 1초 안에 닫기·가리기 → B 쓰기 0, A 안 밀림 / 2초 이상 보인 뒤 닫기 → B 쓰기 1, A는 밀린 화면, 이어하기 뒤 손실 0 (PASS)
  await runCase({ id: 'TB01-hide1s', title: '다중 탭(정정 ①): B를 연 뒤 1초 안에 가리면(visibilitychange hidden) B 쓰기 0회, A는 밀리지 않는다, 저장 원문 그대로' }, async () => {
    const { ctx, page: A } = await openSeeded(browser, pendState, { localFlag: true, wait: '[data-testid="choice-panel"]', init: WRAP_VIS });
    await sleep(2400);
    const rawBefore = await rawOf(A);
    const B = await ctx.newPage();
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector(WAIT_B);
    await sleep(400);
    await setVis(B, 'hidden');
    await sleep(300);
    const bWrites = await writesOf(B);
    await sleep(2000);
    const aScreen = await screenOf(A);
    const rawAfter = await rawOf(A);
    const s1 = await shot(A, 'TB01-hide1s', 'tab-A');
    await ctx.close();
    const ok = bWrites.length === 0 && aScreen === 'life-screen' && rawBefore === rawAfter;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `B가 뜬 뒤 약 0.4초에 가림 → B 쓰기 ${bWrites.length}회 / A ${aScreen} / 저장 원문 ${rawBefore === rawAfter ? '그대로' : '바뀜'}`, shots: [s1] };
  });

  for (const [name, state, sel] of [['pending', pendState, '[data-testid="choice-panel"]'], ['running', runState, '[data-testid="life-screen"]']]) {
    await runCase({ id: `TB01-close2s-${name}`, title: `대조(정정 ①): ${name} 판에서 B를 2.5초 보인 뒤 닫으면(pagehide) B가 쓴다(쓰기 ≥ 1) → A는 밀린 화면, 「이 탭에서 이어하기」 뒤 진행 손실 0 (마지막 쓰기 우선 R-011 / M-1, PASS)` }, async () => {
      const { ctx, page: A } = await openSeeded(browser, state, { localFlag: true, wait: sel, init: WRAP });
      await sleep(2400);
      const snap0 = await readSave(A);
      const B = await ctx.newPage();
      await B.goto(PROD, { waitUntil: 'load' });
      await B.waitForSelector(WAIT_B);
      await sleep(2500);
      const w0 = (await writesOf(B)).length;
      await B.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await sleep(150);
      const bWrites = (await writesOf(B)).length - w0;
      const stored = await readSave(B);
      await B.close({ runBeforeUnload: true });
      await sleep(900);
      const aScreen = await screenOf(A);
      const s1 = await shot(A, `TB01-close2s-${name}`, 'tab-A-superseded');
      let after = null;
      let lossOk = false;
      if (aScreen === 'superseded-screen') {
        await A.getByTestId('take-over').click();
        await sleep(2500);
        after = await flushPlay(A);
        const sv = await readSave(A);
        lossOk = sv.data.age === stored.data.age && sv.data.history.length === stored.data.history.length && JSON.stringify(sv.data.pending) === JSON.stringify(stored.data.pending) && sv.data.history.length >= snap0.data.history.length && after.hold + after.decide >= stored.data.play.hold + stored.data.play.decide - 100;
      }
      const s2 = await shot(A, `TB01-close2s-${name}`, 'tab-A-resumed');
      await ctx.close();
      const ok = bWrites >= 1 && aScreen === 'superseded-screen' && lossOk;
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `B가 2.5초 보인 뒤 pagehide → B 쓰기 ${bWrites}회(B의 hold ${sec(stored.data.play.hold)} decide ${sec(stored.data.play.decide)}) / A ${aScreen} / 이어하기 한 번 뒤 진행 손실 ${lossOk ? '0' : '있음'}${after ? `, 이어받은 뒤 hold ${sec(after.hold)} decide ${sec(after.decide)}` : ''}`, shots: [s1, s2] };
    });
  }
}

if (want('ux')) {
  // ---- M-1 사용자 경험 기록: 데스크톱에서 같은 게임을 새 탭으로 열어 3초 훑어본 뒤 첫 탭으로 돌아간다
  await runCase({ id: 'UX-dup-tab', title: 'M-1 경험 기록(데스크톱 1280×800): 같은 게임을 새 탭(B)으로 열어 3초 훑어본 뒤 첫 탭(A)으로 돌아간다 — A가 어떻게 보이는가, 몇 번 눌러야 이어지는가, 진행 손실' }, async () => {
    const { ctx, page: A } = await openSeeded(browser, runState, { vp: { width: 1280, height: 800 }, touch: false, localFlag: true, wait: '[data-testid="life-screen"]', init: WRAP_VIS });
    await sleep(5000);
    const snap0 = await readSave(A);
    // 새 탭을 연다: 새 탭이 앞으로 나오고 첫 탭은 가려진다
    await setVis(A, 'hidden');
    const B = await ctx.newPage();
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector(WAIT_B);
    const bScreenOpen = await screenOf(B);
    const sB = await shot(B, 'UX-dup-tab', 'B-looking');
    await sleep(3000); // 3초 훑어본다
    // 첫 탭으로 돌아간다: B는 가려지고 A가 다시 보인다
    await setVis(B, 'hidden');
    await setVis(A, 'visible');
    await sleep(1200);
    const bWrites = await writesOf(B);
    const aScreen = await screenOf(A);
    const sA = await shot(A, 'UX-dup-tab', 'A-after-return');
    const text = await A.evaluate(() => (document.querySelector('[data-testid="superseded-screen"]') ? document.querySelector('[data-testid="superseded-screen"]').innerText.replace(/\s+/g, ' ').trim() : null));
    let clicks = 0;
    let lossOk = true;
    let after = null;
    if (aScreen === 'superseded-screen') {
      await A.getByTestId('take-over').click();
      clicks = 1;
      await sleep(2200);
      const nowScreen = await screenOf(A);
      const sv = await readSave(A);
      after = await flushPlay(A);
      lossOk = nowScreen === 'life-screen' && sv.data.age >= snap0.data.age && sv.data.history.length >= snap0.data.history.length && after.hold >= snap0.data.play.hold;
    }
    const sA2 = await shot(A, 'UX-dup-tab', 'A-resumed');
    await ctx.close();
    const ok = lossOk;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `새 탭 B가 열린 화면 ${bScreenOpen}, 3초 훑어본 뒤 B 쓰기 ${bWrites.length}회(가림 때 flush: 사람의 시간 1.5초 이상) → 첫 탭 A로 돌아가니 ${aScreen === 'superseded-screen' ? `「밀린 화면」(글: ${text}) — 버튼 ${clicks}번 눌러 이어짐` : '밀리지 않고 그대로 인생 화면'} / 진행 손실 ${lossOk ? '0' : '있음'}${after ? `, 이어받은 뒤 hold ${sec(after.hold)}(이전 저장 ${sec(snap0.data.play.hold)})` : ''}`, shots: [sB, sA, sA2] };
  });
}

if (want('b02')) {
  // ---- TB02: 쓰기가 막힌 기기에서 저장된 판을 열기만
  for (const [name, state, sel] of [['pending', pendState, '[data-testid="choice-panel"]'], ['paused', pausedState, '[data-testid="life-screen"]']]) {
    for (const flag of ['game', '1']) {
      await runCase({ id: `TB02-${name}-${flag === 'game' ? 'gamekey' : 'allkeys'}`, title: `저장 실패(R-006·NC-11, withPlay): 쓰기가 막힌 기기(${flag === 'game' ? '게임 키만' : '게임·설정 키 모두'})에서 저장된 판(${name})을 열기만 한다 — 3.5초${name === 'pending' ? '·13.5초' : '·13.5초(일시정지)'}에 안내 없음, 열고 7초 안 쓰기 시도 0회` }, async () => {
        // 1) 정상 저장소로 한 번 열어 앱이 자기 형식으로 설정·저장을 쓰게 한다 2) 쓰기를 막고 새로고침 3) 열기만 한다
        const { ctx, page } = await openSeeded(browser, state, { localFlag: true, init: THROW, wait: sel });
        await sleep(1800);
        await page.evaluate((fl) => localStorage.setItem('__qa_throw', fl), flag);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector(sel);
        const t0 = Date.now();
        const noticeAt = async () => page.evaluate(() => (document.querySelector('[data-testid="save-notice"]') ? document.querySelector('[data-testid="save-notice"]').textContent.trim() : null));
        await sleep(3500 - (Date.now() - t0));
        const n35 = await noticeAt();
        const s1 = await shot(page, `TB02-${name}-${flag}`, 'opened');
        await sleep(7000 - (Date.now() - t0));
        const att7 = await page.evaluate(() => window.__attempts.slice());
        await sleep(13500 - (Date.now() - t0));
        const n135 = await noticeAt();
        const att135 = await page.evaluate(() => window.__attempts.slice());
        const screen = await screenOf(page);
        await ctx.close();
        const ok = n35 === null && n135 === null && att7.length === 0 && screen === 'life-screen';
        return { verdict: ok ? 'PASS' : 'FAIL', actual: `열고 3.5초 안내 ${n35 === null ? '없음' : '「' + n35 + '」'} · 13.5초 안내 ${n135 === null ? '없음' : '「' + n135 + '」'} / 7초까지 쓰기 시도 ${att7.length}회 · 13.5초까지 ${att135.length}회(${[...new Set(att135)].join(',') || '-'}) / 화면 ${screen}`, shots: [s1] };
      });
    }
  }
}

if (want('b02ctl')) {
  await runCase({ id: 'TB02-13s', title: '막힌 기기에서 결정 카드를 13.5초 열어 둔다(play가 쌓여 10초 주기 저장을 조용히 시도) → 안내 없음 (13-2 ②, PASS)' }, async () => {
    const { ctx, page } = await openSeeded(browser, pendState, { localFlag: true, init: THROW, wait: '[data-testid="choice-panel"]' });
    await sleep(1800);
    await page.evaluate(() => localStorage.setItem('__qa_throw', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]');
    const t0 = Date.now();
    await sleep(3500);
    const early = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    await sleep(13500 - (Date.now() - t0));
    const late = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    const att = await page.evaluate(() => window.__attempts.length);
    const s1 = await shot(page, 'TB02-13s', 'card-open');
    const screen = await screenOf(page);
    await ctx.close();
    return { verdict: !early && !late && screen === 'life-screen' ? 'PASS' : 'FAIL', actual: `3.5초 안내 ${early} · 13.5초 안내 ${late} / 10초 주기 저장 시도(조용히) ${att}회 / 화면 ${screen}`, shots: [s1] };
  });

  await runCase({ id: 'TB02-ctl-choice', title: '대조: 막힌 기기에서 결정 카드를 열기만 하면 안내 없음 → 선택 1회 뒤 안내가 뜨고 앱은 계속 동작한다' }, async () => {
    const { ctx, page } = await openSeeded(browser, pendState, { localFlag: true, init: THROW, wait: '[data-testid="choice-panel"]' });
    await sleep(1800);
    await page.evaluate(() => localStorage.setItem('__qa_throw', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(1000);
    const before = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    const ageBefore = await page.evaluate(() => parseInt(document.querySelector('[data-testid="life-age"] b').textContent, 10));
    const btn = await page.evaluate(() => document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]:not([aria-disabled="true"])').getAttribute('data-testid'));
    await page.getByTestId(btn).click();
    await sleep(1200);
    const notice = await page.evaluate(() => (document.querySelector('[data-testid="save-notice"]') ? document.querySelector('[data-testid="save-notice"]').textContent.trim() : null));
    const gone = await page.evaluate(() => !document.querySelector('[data-testid="choice-panel"]'));
    await sleep(9500); // 앱 계속: 연출이 흘러 나이가 올라간다(8.75초 해)
    const ageAfter = await page.evaluate(() => parseInt(document.querySelector('[data-testid="life-age"] b').textContent, 10));
    const screen = await screenOf(page);
    const s1 = await shot(page, 'TB02-ctl-choice', 'after-choice');
    await ctx.close();
    const ok = !before && notice !== null && gone && ageAfter > ageBefore && screen === 'life-screen';
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `열기만 한 직후 안내 ${before} → 선택 뒤 안내 ${notice === null ? '없음' : '「' + notice + '」'} / 카드 닫힘 ${gone} / 나이 ${ageBefore} → ${ageAfter}(앱 계속) / 화면 ${screen}`, shots: [s1] };
  });

  await runCase({ id: 'TB02-sheet-open', title: '(나) R-006·NC-11: 막힌 기기에서 기록 시트(생각 남기기)를 열어 두고 글을 쓰기만 해서는 안내가 없고, 글을 담으면 안내가 뜨며 기록은 인생 기록에 남고 앱은 계속 동작한다' }, async () => {
    const { ctx, page } = await openSeeded(browser, pausedState, { localFlag: true, init: THROW, wait: '[data-testid="life-screen"]' });
    await sleep(1800);
    await page.evaluate(() => localStorage.setItem('__qa_throw', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(500);
    const noticeOf = () => page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    await page.getByTestId('tool-note').click();
    await page.waitForSelector('[data-testid="note-sheet"]');
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="note-save"]'); return b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled; }, null, { timeout: 8000 });
    await sleep(4000);
    const openOnly = await noticeOf();
    await page.getByTestId('note-input').focus();
    const TEXT = '막힌 기기에서 쓴 글 ㅎㅏㄴ글 😀 <b>';
    await page.keyboard.insertText(TEXT);
    await sleep(1500);
    const typed = await noticeOf();
    const s1 = await shot(page, 'TB02-sheet-open', 'typed');
    const att0 = await page.evaluate(() => window.__attempts.length);
    await page.getByTestId('note-save').click();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 6000 });
    await sleep(900);
    const after = await noticeOf();
    const log = (await readLog(page)).filter((r) => r.isNote);
    const screen = await screenOf(page);
    const s2 = await shot(page, 'TB02-sheet-open', 'after-save');
    await ctx.close();
    const ok = !openOnly && !typed && after && log.length === 1 && log[0].text === TEXT && screen === 'life-screen';
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `시트만 열고 4초 안내 ${openOnly} · 글 쓴 뒤 1.5초 안내 ${typed}(시도 ${att0}회) → 담은 뒤 안내 ${after} / 인생 기록 ${log.length}줄 「${log[0] ? log[0].text : '-'}」 / 화면 ${screen}`, shots: [s1, s2] };
  });
}

if (want('b03')) {
  // ---- TB03: 보이는 탭 A가 결정 카드를 10초 넘게 열어 두면 A가 쓰고 열기만 한 B가 밀린다 (M-1 허용)
  for (const [id, bHidden] of [['TB03', true], ['TB03-vis', false]]) {
    await runCase({ id, title: `M-1(PASS 시험): 보이는 탭 A가 결정 카드를 10초 넘게 열어 두면 A가 쓰고 열기만 한 B(${bHidden ? '가려진 배경 탭' : '함께 보이는 탭'})는 밀린 화면이 된다 — 진행 손실 0, 이어받으면 이어서` }, async () => {
      const { ctx, page: A } = await openSeeded(browser, pendState, { localFlag: true, wait: '[data-testid="choice-panel"]', init: WRAP });
      await sleep(1500);
      const B = await ctx.newPage();
      if (bHidden) await B.addInitScript(HIDDEN_FROM_START);
      await B.goto(PROD, { waitUntil: 'load' });
      await B.waitForSelector(WAIT_B);
      const snap0 = await readSave(A);
      await sleep(13500);
      const aW = await writesOf(A);
      const bW = await writesOf(B);
      const aScreen = await screenOf(A);
      const bScreen = await screenOf(B);
      const s1 = await shot(A, id, 'tab-A');
      const s2 = await shot(B, id, 'tab-B');
      // 한쪽이 밀렸다면 밀린 탭에서 이어받기 → 이어받은 뒤 시간이 이어서 쌓이고 되감기·이중 계산 없음
      const slow = aScreen === 'superseded-screen' ? A : bScreen === 'superseded-screen' ? B : null;
      const live = slow === A ? B : A;
      const stored = await readSave(live);
      let take = 'n/a';
      let okTake = true;
      if (slow) {
        await slow.getByTestId('take-over').click();
        await sleep(2600);
        const afterTake = await flushPlay(slow);
        const storedPlay = stored.data.play;
        okTake = afterTake.decide >= storedPlay.decide - 200 && afterTake.decide <= storedPlay.decide + 6000 && afterTake.hold <= storedPlay.hold + 6000;
        take = `이어받은 뒤 decide ${sec(afterTake.decide)}초 (이어받기 전 저장 ${sec(storedPlay.decide)}초, 이중 계산·되감기 없음 ${okTake})`;
      }
      const sameProgress = stored.data.age === snap0.data.age && stored.data.pending && snap0.data.pending && stored.data.pending.key === snap0.data.pending.key && stored.data.history.length === snap0.data.history.length;
      await ctx.close();
      const exactlyOneSlow = (aScreen === 'superseded-screen') !== (bScreen === 'superseded-screen');
      const ok = exactlyOneSlow && sameProgress && okTake && (bHidden ? aScreen === 'life-screen' && bScreen === 'superseded-screen' && aW.length >= 1 && bW.length === 0 : true);
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `13.5초 뒤 A ${aScreen}(쓰기 ${aW.length}회) · B ${bScreen}(쓰기 ${bW.length}회) / 진행(나이·대기 카드·연표) 손실 ${sameProgress ? '0' : '있음'} / ${take}`, shots: [s1, s2] };
    });
  }
}

await browser.close();
console.log('parts done', parts.join(',') || 'all');

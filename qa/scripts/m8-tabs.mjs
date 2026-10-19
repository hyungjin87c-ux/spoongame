// QA-003 M8 다중 탭·저장 실패 회귀(R-047·R-006·NC-11·R-011): 시간을 재는 판(play 있음)으로 다시 잰다.
//  TB01  열기만 한 두 번째 탭은 저장소에 쓰지 않고 활성 탭을 밀어내지 않는다 (결정 카드 대기 판 / 흐르는 판 / 일시정지 판)
//  TB02  저장이 막힌 기기(setItem이 던짐)에서 저장된 판을 열기만 하면 실패 안내가 뜨지 않는다 (결정 카드 대기 / 일시정지)
//  TB03  보이는 두 번째 탭이 가만히 있어도(10초 이상) 첫 탭을 밀어내는가 (관찰: decide가 쌓여 쓰게 되는 경우)
//  TB04  탭 가림 직후 곧바로 멈춘 페이지(CDP 정지)에서 돌아왔을 때 멈춘 시간이 hold에 들어가는가 (R-422 관찰)
// 사용: node qa/scripts/m8-tabs.mjs [part ...]  part: b01 b02 b03 b04   (인자 없으면 전부)
import { launch, openOracle, plainLife, pendingState, openSeeded, flushPlay, readSave, shot, sleep, runCase, SET_MANUAL, GAME_KEY, PROD } from './m8-lib.mjs';

const parts = process.argv.slice(2);
const want = (p) => parts.length === 0 || parts.includes(p);
const browser = await launch();
const { page: oracle } = await openOracle(browser);
const runState = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: false });
const pausedState = { ...runState, paused: true };
const pendState = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });

const WRAP = () => {
  window.__writes = [];
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage) window.__writes.push(k);
    return original.call(this, k, v);
  };
};
const THROW = () => {
  // 플래그(localStorage __qa_throw)가 켜진 뒤부터 저장소 쓰기가 막힌 기기를 흉내 낸다: '1' = 게임·설정 키 모두, 'game' = 게임 키만
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && String(k).startsWith('suzeo-game:')) {
      const flag = Storage.prototype.getItem.call(this, '__qa_throw');
      if (flag === '1' || (flag === 'game' && k === 'suzeo-game:save')) throw new DOMException('quota', 'QuotaExceededError');
    }
    return original.call(this, k, v);
  };
};
const screenOf = (p) => p.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen', 'error-screen', 'ending-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'none');

if (want('b01')) {
  for (const [name, state, sel] of [['pending', pendState, '[data-testid="choice-panel"]'], ['running', runState, '[data-testid="life-screen"]'], ['paused', pausedState, '[data-testid="life-screen"]']]) {
    await runCase({ id: `TB01-${name}`, title: `다중 탭(R-047): 두 번째 탭을 열기만 해도(${name}) 저장소에 쓰지 않고 첫 탭을 밀어내지 않는다` }, async () => {
      const { ctx, page: A } = await openSeeded(browser, state, { localFlag: true, wait: sel });
      await sleep(2500);
      const B = await ctx.newPage();
      await B.addInitScript(WRAP);
      await B.goto(PROD, { waitUntil: 'load' });
      await B.waitForSelector('[data-testid="life-screen"], [data-testid="superseded-screen"]');
      await sleep(3500);
      const writes = await B.evaluate(() => window.__writes);
      const aScreen = await screenOf(A);
      const bScreen = await screenOf(B);
      const s1 = await shot(A, `TB01-${name}`, 'tab-A');
      await ctx.close();
      const ok = writes.length === 0 && aScreen !== 'superseded-screen';
      return { verdict: ok ? 'PASS' : 'FAIL', actual: `열기만 한 탭 B의 저장소 쓰기 ${writes.length}번(${[...new Set(writes)].join(',') || '-'}), 첫 탭 A 화면 ${aScreen}, B 화면 ${bScreen}`, shots: [s1] };
    });
  }
}

if (want('b02')) {
  for (const [name, state] of [['pending', pendState], ['paused', pausedState]]) {
    for (const flag of ['game', '1']) {
      await runCase({ id: `TB02-${name}-${flag === 'game' ? 'gamekey' : 'allkeys'}`, title: `저장 실패(R-006·NC-11): 쓰기가 막힌 기기(${flag === 'game' ? '게임 키만' : '게임·설정 키 모두'})에서 저장된 판(${name})을 열기만 하면 저장 실패 안내가 뜨지 않는다` }, async () => {
        // 1) 정상 저장소로 한 번 열어 앱이 자기 형식으로 설정·저장을 쓰게 한다 2) 쓰기를 막고 새로고침 3) 열기만 하고 3.5초
        const { ctx, page } = await openSeeded(browser, state, { localFlag: true, init: THROW, wait: '[data-testid="life-screen"]' });
        await sleep(1500);
        await page.evaluate((fl) => localStorage.setItem('__qa_throw', fl), flag);
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="life-screen"]');
        await sleep(3500);
        const notice = await page.evaluate(() => (document.querySelector('[data-testid="save-notice"]') ? document.querySelector('[data-testid="save-notice"]').textContent.trim() : null));
        const s1 = await shot(page, `TB02-${name}-${flag}`, 'opened');
        await ctx.close();
        return { verdict: notice === null ? 'PASS' : 'FAIL', actual: `다시 열고 3.5초 뒤 안내 ${notice === null ? '없음' : '「' + notice + '」'}`, shots: [s1] };
      });
    }
  }
  await runCase({ id: 'TB02-progress', title: '저장 실패: 진행이 생기면(결정 선택) 안내가 뜨고 앱은 계속 동작한다 (대조)' }, async () => {
    const { ctx, page } = await openSeeded(browser, pendState, { localFlag: true, init: THROW, wait: '[data-testid="choice-panel"]' });
    await sleep(1500);
    await page.evaluate(() => localStorage.setItem('__qa_throw', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(800);
    const btn = await page.evaluate(() => document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]:not([aria-disabled="true"])').getAttribute('data-testid'));
    await page.getByTestId(btn).click();
    await sleep(900);
    const notice = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    const screen = await screenOf(page);
    await ctx.close();
    return { verdict: notice && screen === 'life-screen' ? 'PASS' : 'FAIL', actual: `선택 뒤 안내 ${notice}, 화면 ${screen}` };
  });
}

if (want('b02b')) {
  await runCase({ id: 'TB02-13s', title: '관찰: 쓰기가 막힌 기기에서 결정 카드를 읽는 채 13초 두면(play가 쌓여 10초 주기 저장을 시도) 실패 안내가 뜨는가' }, async () => {
    const { ctx, page } = await openSeeded(browser, pendState, { localFlag: true, init: THROW, wait: '[data-testid="choice-panel"]' });
    await sleep(1500);
    await page.evaluate(() => localStorage.setItem('__qa_throw', '1'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]');
    await sleep(3500);
    const early = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    await sleep(10000);
    const late = await page.evaluate(() => !!document.querySelector('[data-testid="save-notice"]'));
    await ctx.close();
    return { verdict: 'RECORD', actual: `열고 3.5초 뒤 안내 ${early}, 13.5초 뒤 안내 ${late} (결정 카드를 읽는 시간이 쌓이면 10초 주기 저장이 실패하며 안내가 뜰 수 있다 — 진행이 생겼을 때의 정상 동작으로 본다)` };
  });
}

if (want('b03')) {
  await runCase({ id: 'TB03', title: '관찰: 보이는 두 번째 탭이 결정 카드를 띄운 채 12초 가만히 있어도 첫 탭을 밀어내는가 (열기만 한 탭)' }, async () => {
    const { ctx, page: A } = await openSeeded(browser, pendState, { localFlag: true, wait: '[data-testid="choice-panel"]' });
    await sleep(1500);
    const B = await ctx.newPage();
    await B.addInitScript(WRAP);
    await B.goto(PROD, { waitUntil: 'load' });
    await B.waitForSelector('[data-testid="choice-panel"], [data-testid="superseded-screen"]');
    await sleep(13000);
    const writes = await B.evaluate(() => window.__writes);
    const aScreen = await screenOf(A);
    const bScreen = await screenOf(B);
    await ctx.close();
    return { verdict: aScreen !== 'superseded-screen' ? 'PASS' : 'RECORD', actual: `B 쓰기 ${writes.length}번, A ${aScreen}, B ${bScreen} (결정 카드가 떠 있는 두 탭이 함께 decide를 쌓는 판 — 10초 주기 저장에서 밀림이 생기는지 관찰)` };
  });
}

if (want('b04')) {
  await runCase({ id: 'TB04', title: 'R-422 관찰: 가림 이벤트를 렌더가 처리하기 전에 페이지가 멈춰 있다 돌아오면 멈춘 시간이 hold에 얼마나 들어가는가' }, async () => {
    const results = [];
    for (const mode of ['hidden-then-freeze', 'freeze-only']) {
      const { ctx, page } = await openSeeded(browser, runState, { init: () => {
        window.__vis = 'visible';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
      } });
      await sleep(2500);
      const a = await flushPlay(page);
      const cdp = await ctx.newCDPSession(page);
      let note = 'ok';
      try {
        if (mode === 'hidden-then-freeze') {
          // 가림 이벤트를 보낸 같은 tick에 곧바로 디버거로 멈춘다(렌더 task가 돌기 전)
          await page.evaluate(() => {
            window.__vis = 'hidden';
            document.dispatchEvent(new Event('visibilitychange'));
          });
          await cdp.send('Debugger.enable');
          await cdp.send('Debugger.pause');
        } else {
          await cdp.send('Debugger.enable');
          await cdp.send('Debugger.pause');
        }
        await sleep(20000);
        await cdp.send('Debugger.resume');
        if (mode === 'hidden-then-freeze') {
          await page.evaluate(() => {
            window.__vis = 'visible';
            document.dispatchEvent(new Event('visibilitychange'));
          });
        }
      } catch (e) {
        note = 'cdp-error:' + String(e.message).slice(0, 80);
      }
      await sleep(700);
      const b = await flushPlay(page);
      results.push({ mode, note, hold: b.hold - a.hold, idle: b.idle - a.idle });
      await ctx.close();
    }
    const txt = results.map((r) => `${r.mode}: 20초 멈춤 뒤 hold +${(r.hold / 1000).toFixed(2)}초 idle +${(r.idle / 1000).toFixed(2)}초 (${r.note})`).join(' / ');
    const worst = Math.max(...results.map((r) => r.hold));
    return { verdict: worst <= 1500 ? 'PASS' : 'RECORD', actual: txt + ' — 클램프로 한 번에 최대 5초만 센다' };
  });
}

await browser.close();
console.log('parts done');

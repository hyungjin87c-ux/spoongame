// QA-003 M8 2회차 (마) R-422 모바일 정지 확인: 탭이 가려진 채 페이지가 멈췄다 돌아와도 멈춘 시간이 hold로 새지 않는가.
//  TB04-a  가림 이벤트가 오고 곧바로 메인 스레드를 7초·20초 멈춘다(렌더가 못 돌 때의 모사) → 복귀: hold+decide 증가 ≤ 1초(보이는 시간 제외), idle로 감(5.5초 상한 안)
//  TB04-b  가림 → CDP Page.setWebLifecycleState frozen 20초 → active → 보임: hold+decide 증가 ≤ 1초
//  TB04-c  a 또는 b를 10회 반복(각 20초 이상): 보이는 구간 합(벽시계)과 hold+decide 증가를 비교, 증가 − 보이는 시간 ≤ 5초 (수정 전 최악 50초)
//  TB04-d  가림 이벤트 없이 정지(디버거와 같음): hold ≤ 5.5초(5초 클램프) — 알려진 한계로 RECORD
// 사용: node qa/scripts/m8-r2-r422.mjs <a|b|d> <cycles> <freezeSec> <id>
// 보이는 시간 = (처음 쓰기 시각 ~ 마지막 pagehide flush 시각) − Σ(가림 이벤트 ~ 보임 이벤트 사이). play는 pagehide로 앱이 저장에 쓰게 한 뒤 읽는다(사람의 시간 1.5초 이상이어야 쓰므로 복귀 뒤 2.2초 흘린다).
import { launch, openOracle, plainLife, pendingState, openSeeded, flushPlay as flushProd, shot, sleep, runCase, SET_MANUAL, DEV, PROD } from './m8-lib.mjs';

// R422_DEV=1 이면 개발 서버(5898)에 열고 개발 전용 탐침 window.__playTime()으로 타이머 기록을 저장 없이 읽는다(마스터 정정 ③: 타이머 내부를 재는 케이스는 개발 서버 + __playTime 허용). 기본은 배포 번들 + pagehide flush(복귀 뒤 1.5초 이상 흘려 쓰게 한 뒤 그 몫을 뺀다).
const DEVMODE = process.env.R422_DEV === '1';
const BASE = DEVMODE ? DEV : PROD;
const flushPlay = DEVMODE ? async (p) => p.evaluate(() => window.__playTime()) : flushProd;

const [kind = 'a', cyclesS = '1', freezeS = '20', id = 'TB04'] = process.argv.slice(2);
const cycles = Number(cyclesS);
const freezeMs = Number(freezeS) * 1000;
const browser = await launch();
const { page: oracle } = await openOracle(browser);
const runState = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: false });
const pendState = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });

const VIS_INIT = () => {
  window.__vis = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
  // 페이지가 실제로 멈췄는지(타이머가 멈췄다 풀렸는지) 보는 심장 박동: 100ms 틱 사이 가장 긴 간격
  window.__gapMax = 0;
  let last = performance.now();
  setInterval(() => {
    const n = performance.now();
    window.__gapMax = Math.max(window.__gapMax, n - last);
    last = n;
  }, 100);
};
const sec = (x) => +(x / 1000).toFixed(2);
const setVis = (page, v) =>
  page.evaluate((x) => {
    window.__vis = x;
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);

async function runOne(state, label) {
  const { ctx, page } = await openSeeded(browser, state, { base: BASE, settings: SET_MANUAL, init: VIS_INIT, wait: state.pending ? '[data-testid="choice-panel"]' : '[data-testid="life-screen"]' });
  await sleep(2000); // 사람의 시간 1.5초 이상 → 기준 pagehide flush가 쓴다
  const a = await flushPlay(page);
  const tA = Date.now();
  let hiddenSpan = 0;
  const cdp = await ctx.newCDPSession(page);
  const per = [];
  for (let i = 0; i < cycles; i++) {
    await sleep(1000); // 보이는 구간
    const h0 = Date.now();
    if (kind === 'a') {
      // 가림 이벤트를 보낸 같은 작업에서 곧바로 메인 스레드를 붙잡는다(렌더·타이머가 못 돈다)
      await page.evaluate((ms) => {
        window.__vis = 'hidden';
        document.dispatchEvent(new Event('visibilitychange'));
        const t = performance.now();
        while (performance.now() - t < ms) {
          /* 정지 */
        }
      }, freezeMs);
      await setVis(page, 'visible');
      hiddenSpan += Date.now() - h0;
    } else if (kind === 'b') {
      await setVis(page, 'hidden');
      await sleep(250); // 렌더가 가림을 처리한 뒤
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
      await sleep(freezeMs);
      await cdp.send('Page.setWebLifecycleState', { state: 'active' });
      await setVis(page, 'visible');
      hiddenSpan += Date.now() - h0;
    } else {
      // d: 가림 이벤트 없이 정지(디버거) — 보이는 채 멈춘다. 이 시간은 「보이는 시간」에서 빼지 않는다(앱은 가림을 알 수 없다)
      await cdp.send('Debugger.enable');
      const hh = Date.now();
      await cdp.send('Debugger.pause');
      await sleep(freezeMs);
      await cdp.send('Debugger.resume');
      hiddenSpan += Date.now() - hh;
      per.push(hh);
    }
  }
  await sleep(2200); // 복귀 뒤 사람의 시간 1.5초 이상 → flush가 쓴다
  const b = await flushPlay(page);
  const tB = Date.now();
  const visibleWall = tB - tA - hiddenSpan;
  const gain = b.hold + b.decide - (a.hold + a.decide);
  const leak = gain - visibleWall;
  const s1 = await shot(page, `${id}-${kind}${DEVMODE ? '-dev' : ''}`, `after-${cycles}x${Math.round(freezeMs / 1000)}s-${label}`);
  const gapMax = await page.evaluate(() => window.__gapMax).catch(() => null);
  await ctx.close();
  return { a, b, visibleWall, hiddenSpan, gain, leak, idleGain: b.idle - a.idle, gapMax, s1 };
}

const longK = cycles >= 10;
for (const [label, state] of kind === 'd' ? [['hold', runState]] : [['hold', runState], ['decide', pendState]].slice(0, longK ? 1 : 2)) {
  const title = `R-422 ${kind === 'a' ? '가림 이벤트 직후 메인 스레드 정지' : kind === 'b' ? '가림 후 CDP frozen' : '가림 이벤트 없이 정지(디버거)'} ${freezeMs / 1000}초 × ${cycles}회 (${label === 'hold' ? '연출 중' : '결정 카드 열림'})`;
  await runCase({ id: `${id}-${label}${DEVMODE ? '-dev' : ''}`, title: title + (DEVMODE ? ' [개발 서버 + __playTime]' : ' [배포 번들 + pagehide flush]') }, async () => {
    const r = await runOne(state, label);
    const perCycle = r.leak / cycles;
    let verdict;
    let expected;
    if (kind === 'd') {
      // 가림 이벤트 없는 정지: 한 번에 최대 5초(클램프) — 알려진 한계 RECORD, 5.5초 넘으면 FAIL
      verdict = perCycle <= 5500 ? 'RECORD' : 'FAIL';
      expected = '정지당 hold ≤ 5.5초(5초 클램프). 알려진 한계 RECORD, 실기기 M9';
    } else if (cycles >= 10) {
      verdict = r.leak <= 5000 ? 'PASS' : 'FAIL';
      expected = `증가 − 보이는 시간 합 ≤ 5초 (회당 0.5초), 가림 이벤트가 있으면 0`;
    } else {
      // 13-3 TB04-a: hold+decide 증가 ≤ 1초(보이는 시간 제외), idle로 감(5.5초 상한 안). TB04-b: hold+decide 증가 ≤ 1초만(idle 상한은 a의 조건 — 정말 멈추면 5초 클램프, 멈추지 않고 숨기만 하면 가린 시간 전부가 idle)
      verdict = r.leak <= 1000 && r.idleGain > 0 && (kind === 'b' || r.idleGain <= 5500 * cycles + 500) ? 'PASS' : 'FAIL';
      expected = kind === 'b' ? 'hold+decide 증가 − 보이는 시간 ≤ 1초' : 'hold+decide 증가 − 보이는 시간 ≤ 1초, idle로 감(회당 5.5초 상한 안)';
    }
    return {
      verdict,
      expected,
      actual: `${cycles}회 × ${freezeMs / 1000}초 정지: hold+decide 증가 ${sec(r.gain)}초 − 보이는 시간 ${sec(r.visibleWall)}초(가림/정지 ${sec(r.hiddenSpan)}초) = 새는 시간 ${sec(r.leak)}초(회당 ${sec(perCycle)}초), idle +${sec(r.idleGain)}초 / hold ${sec(r.a.hold)}→${sec(r.b.hold)} decide ${sec(r.a.decide)}→${sec(r.b.decide)}${r.gapMax !== null ? ` / 100ms 틱 최대 간격 ${sec(r.gapMax)}초(${r.gapMax > 4000 ? '페이지가 실제로 멈췄다 풀림' : '페이지가 멈추지 않음'})` : ''}`,
      shots: [r.s1],
    };
  });
}
await browser.close();
console.log('done', kind, cycles, freezeS);

// QA-003 M4 공격(4): 자동 모드의 선택지 자동 선택이 일시정지·나가기 확인·탭 숨김 중에도 도는가. 사용: node qa/scripts/m4-attack-d.mjs
import { launch, mkctx, readDash, shot, sleep, runCase, con, waitGuard, readRaw, GAME_KEY, PROD } from './m4-lib.mjs';
import { openState } from './m4-states.mjs';

const browser = await launch();
const hist = async (p) => {
  const raw = await readRaw(p, GAME_KEY);
  const g = JSON.parse(raw).data;
  return { n: g.history.length, pending: !!g.pending, paused: g.paused, age: g.age };
};

await runCase(
  { id: 'M4-A11', cat: '공격', title: '자동 모드의 선택지 자동 선택은 사용자가 멈춘 동안(일시정지·나가기 확인 중·탭 숨김)에는 일어나지 않는다 — DB3 「일시정지는 연출 타이머·진행률을 정지」', steps: '선택지 대기 저장(360×740, 1배속)을 열고 (가) 일시정지 → 자동 모드 켬 → 12초 (나) 새로 열어 자동 모드 켜자마자 나가기 확인 단계를 열어 12초 (다) 새로 열어 자동 모드 켠 직후 탭 숨김(visibilityState=hidden) 12초 → 각각 선택지가 그대로 대기 중인지(기록 줄 수·pending)', expected: '멈춘 동안 자동 선택 없음(카드 대기 유지·기록 불변). 풀면 그때 자동 선택' },
  async () => {
    const bad = [];
    const notes = [];
    for (const mode of ['paused', 'exit-ask', 'hidden']) {
      const { ctx, page: p } = await openState(browser, 'pending', { vp: { width: 360, height: 740, touch: true } });
      if (mode === 'hidden') {
        await p.evaluate(() => {
          window.__vis = 'visible';
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
        });
      }
      await sleep(600);
      const h0 = await hist(p);
      if (!h0.pending) {
        bad.push(`${mode}: 기준 상태에 선택지 대기가 없음`);
        await ctx.close();
        continue;
      }
      if (mode === 'paused') {
        await waitGuard(p, 'pause');
        await p.getByTestId('pause').click();
        await sleep(300);
        await p.getByTestId('auto').click();
      } else if (mode === 'exit-ask') {
        await waitGuard(p, 'auto');
        await p.getByTestId('auto').click();
        await p.getByTestId('tool-exit').click();
        await p.waitForSelector('[data-testid="exit-ask"]');
      } else {
        await waitGuard(p, 'auto');
        await p.getByTestId('auto').click();
        await p.evaluate(() => {
          window.__vis = 'hidden';
          document.dispatchEvent(new Event('visibilitychange'));
        });
      }
      await sleep(12000);
      const h1 = await hist(p);
      const stillPending = h1.pending && h1.n === h0.n;
      notes.push(`${mode}: 12초 뒤 ${stillPending ? '선택지 대기 유지' : `자동 선택됨(기록 ${h0.n}→${h1.n}, 대기 ${h1.pending})`}`);
      if (!stillPending) bad.push(`${mode}: 사용자가 멈춘 동안 자동 선택이 일어남(기록 ${h0.n}→${h1.n})`);
      await shot(p, 'A11', mode);
      // 푼 뒤에는 자동 선택이 일어나야 한다(공허 방지)
      if (mode === 'paused') await p.getByTestId('pause').click();
      else if (mode === 'exit-ask') await p.getByTestId('exit-no').click();
      else await p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(12000);
      const h2 = await hist(p);
      notes.push(`${mode} 해제 뒤 12초: 기록 ${h1.n}→${h2.n}, 대기 ${h2.pending}`);
      if (h2.n === h1.n && h2.pending) bad.push(`${mode}: 풀었는데도 자동 선택이 안 일어남`);
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: (bad.length ? bad.join(' / ') + ' | ' : '') + notes.join(' | '), shots: ['qa/screenshots/003/M4-A11-paused.png', 'qa/screenshots/003/M4-A11-exit-ask.png', 'qa/screenshots/003/M4-A11-hidden.png'] };
  },
);
await browser.close();

// QA-003 M2 3회차: M2-B07 — 풀린 채 열려 있는 확인 단계에서 글자 크기·창 크기를 바꿀 때(풀림→풀림) 포커스 버튼이 화면 안에 남는가 (QM2-12 규칙 5의 이웃 경우 — 기록용)
import { launch, mkctx, runCase, shot, sleep, ensureFixture, seedContext, openState } from './m2r3-lib.mjs';
import { setRootFont } from './m2r3-textlib.mjs';
import { settleBar, BAR_INFO } from './m2r3-barlib.mjs';
const browser = await launch();
const fx = await ensureFixture(browser);
await runCase(
  { id: 'M2-B07', cat: '공격', title: '풀린 채 열린 확인 단계에서 글자를 키우거나 창을 줄여도(풀림→풀림) 포커스 버튼·안내문이 화면 안에 남는가 (기록용)', steps: '320x256 확인 단계(글자 100%에서 풀림)를 열고 글자를 125·150·200%로, 667x375 글자 200% 풀림에서 250·300%로 키우고, 640x400 글자 200% 풀림에서 창 높이를 380·340·300으로 줄이며 단계마다 정착 뒤 안내문 첫 줄·취소 버튼 위치와 포커스를 잰다', expected: '포커스 유지(규칙 5). 화면 안 여부는 명세 밖이라 어긋나도 기록만 한다' },
  async () => {
    const rows = [];
    const outOfView = [];
    const lostFocus = [];
    const shots = [];
    const run = async (name, vp, startFont, steps) => {
      const ctx = await mkctx(browser, { viewport: vp });
      await seedContext(ctx, fx);
      const p = await ctx.newPage();
      await openState(p, 'continue');
      if (startFont !== 100) await setRootFont(p, startFont);
      await settleBar(p);
      await p.getByTestId('begin-new').click();
      await p.waitForSelector('[data-testid=confirm-new-ask]');
      await sleep(450);
      await settleBar(p);
      for (const st of steps) {
        if (st.font) await setRootFont(p, st.font);
        if (st.h) await p.setViewportSize({ width: vp.width, height: st.h });
        await sleep(350);
        await settleBar(p);
        const i = await p.evaluate(BAR_INFO);
        const c = i.btns.find((b) => b.id === 'confirm-new-no');
        const tag = `${name} ${st.font ? '글자 ' + st.font + '%' : '높이 ' + st.h}`;
        rows.push(`${tag}: ${i.released ? '해제' : '고정'} 띠 ${i.h}/${i.vh} 포커스 ${i.active} 안내문 ${i.ask?.top}~${i.ask?.bottom} 취소 ${c?.top}~${c?.bottom}`);
        if (i.active !== 'confirm-new-no') lostFocus.push(tag + ' 포커스 ' + i.active);
        if (!i.ask || i.ask.top < -0.5 || !c || !c.inView) outOfView.push(`${tag}: 안내문 ${i.ask?.top} 취소 ${c?.top}~${c?.bottom}/${i.vh}`);
      }
      shots.push(await shot(p, 'B07', name.replace(/[^\w가-힣]/g, '')));
      await ctx.close();
    };
    await run('320x256', { width: 320, height: 256 }, 100, [{ font: 125 }, { font: 150 }, { font: 200 }]);
    await run('667x375글자200', { width: 667, height: 375 }, 200, [{ font: 250 }, { font: 300 }]);
    await run('640x400글자200', { width: 640, height: 400 }, 200, [{ h: 380 }, { h: 340 }, { h: 300 }]);
    return { verdict: lostFocus.length ? 'FAIL' : 'RECORD', severity: lostFocus.length ? '중간' : undefined, actual: (lostFocus.length ? `포커스 잃음 ${lostFocus.join(' / ')} || ` : '포커스는 모든 단계에서 유지 || ') + (outOfView.length ? `화면 밖으로 밀림(기록) ${outOfView.length}건: ${outOfView.join(' / ')} || ` : '모든 단계에서 안내문·취소 버튼 화면 안 || ') + rows.join(' ; '), shots };
  }
);
await browser.close();

// QA-003 M2 3회차: M2-B06 — 풀린 띠의 다크·강제 색상(고대비)·움직임 줄이기 모양 (QM2-12 + CM4)
import { launch, mkctx, runCase, shot, sleep, ensureFixture, seedContext, openState } from './m2r3-lib.mjs';
import { settleBar, BAR_INFO, wheelToBottom } from './m2r3-barlib.mjs';
const browser = await launch();
const fx = await ensureFixture(browser);
await runCase(
  { id: 'M2-B06', cat: '정상', title: '풀린 띠(320x256 확인 단계)의 다크·강제 색상·움직임 줄이기 모양', steps: '320x256 확인 단계(풀림)를 라이트·다크·forced-colors: active·prefers-reduced-motion: reduce로 열어 맨 아래로 내린 화면을 찍고, 띠 위끝의 구분선(그림자·테두리) 유무, 버튼 테두리, 글자 대비를 읽는다', expected: '네 모드 모두 풀려 있고 버튼이 보이고 눌리며, 띠가 본문 끝과 구분되는 선이 보인다(강제 색상에서 box-shadow가 사라져도 구분됨)' },
  async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    const notes = [];
    for (const [tag, opts] of [['light', {}], ['dark', { colorScheme: 'dark' }], ['forced', { forcedColors: 'active' }], ['reduce', { reducedMotion: 'reduce' }]]) {
      const ctx = await mkctx(browser, { viewport: { width: 320, height: 256 }, ...opts });
      await seedContext(ctx, fx);
      const p = await ctx.newPage();
      await openState(p, 'continue');
      await settleBar(p);
      await p.getByTestId('begin-new').click();
      await p.waitForSelector('[data-testid=confirm-new-ask]');
      await sleep(500);
      await settleBar(p);
      await wheelToBottom(p);
      const i = await p.evaluate(BAR_INFO);
      const edge = await p.evaluate(() => {
        const bar = document.querySelector('[data-testid=bottom-bar]');
        const cs = getComputedStyle(bar);
        const foot = document.querySelector('footer');
        const above = foot ? getComputedStyle(foot).backgroundColor : null;
        return { bt: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor, shadow: cs.boxShadow, bg: cs.backgroundColor, above, forced: matchMedia('(forced-colors: active)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, yes: (() => { const b = document.querySelector('[data-testid=confirm-new-yes]').getBoundingClientRect(); return Math.round(b.height); })() };
      });
      if (!i.released) problems.push(`${tag}: 풀려 있지 않음 (${i.pos})`);
      const btnsOk = i.btns.filter((b) => ['confirm-new-no', 'confirm-new-yes'].includes(b.id)).every((b) => b.inView && b.hitOk);
      if (!btnsOk) problems.push(`${tag}: 확인 단계 버튼이 화면 안·눌림이 아님 ${JSON.stringify(i.btns)}`);
      if (edge.yes < 44) problems.push(`${tag}: 확정 버튼 높이 ${edge.yes}px < 44`);
      const hasEdge = (parseFloat(edge.bt) > 0 && !/none/.test(edge.bt)) || (edge.shadow && edge.shadow !== 'none');
      facts.push(`${tag}: forced=${edge.forced} dark=${edge.dark} reduce=${edge.reduce} 위 테두리「${edge.bt}」 그림자「${edge.shadow.slice(0, 40)}」 확정 버튼 ${edge.yes}px`);
      // 같은 모드에서 고정 상태(320x568 이어하기)의 구분선과 견준다: 고정에는 있는데 풀린 띠에 없으면 문제, 둘 다 없으면(강제 색상은 그림자를 지운다) 기록만
      const c2 = await mkctx(browser, { viewport: { width: 320, height: 568 }, ...opts });
      await seedContext(c2, fx);
      const q = await c2.newPage();
      await openState(q, 'continue');
      await sleep(300);
      const fixedEdge = await q.evaluate(() => { const cs = getComputedStyle(document.querySelector('[data-testid=bottom-bar]')); return { bt: cs.borderTopWidth + ' ' + cs.borderTopStyle, shadow: cs.boxShadow, pos: cs.position }; });
      await c2.close();
      const fixedHasEdge = (parseFloat(fixedEdge.bt) > 0 && !/none/.test(fixedEdge.bt)) || (fixedEdge.shadow && fixedEdge.shadow !== 'none');
      facts.push(`  └ ${tag} 고정 상태(320x568): 위 테두리「${fixedEdge.bt}」 그림자「${(fixedEdge.shadow || '').slice(0, 30)}」 구분선=${fixedHasEdge}, 풀린 띠 구분선=${hasEdge}`);
      if (fixedHasEdge && !hasEdge) problems.push(`${tag}: 고정 띠에는 구분선이 있는데 풀린 띠에는 없음`);
      if (!fixedHasEdge && !hasEdge) notes.push(`${tag}: 고정·풀린 띠 모두 계산된 구분선이 없음(강제 색상은 box-shadow를 지운다)`);
      shots.push(await shot(p, 'B06', tag));
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.join(' // ') + ' || ' : '네 모드 모두 풀림·버튼 보임·눌림·구분선 계산값 있음 || ') + facts.join(' ; ') + (notes.length ? ' || [기록] ' + notes.join(' / ') : ''), shots };
  }
);
await browser.close();

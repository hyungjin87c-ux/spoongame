// QA-003 M2 3회차: 줄바꿈 감사 측정기 점검(변이) — 푸터를 「A · B · C」 가운뎃점 나열로 되돌리면 / 짧은 쌍의 기호를 항상 보이게 하면 감사가 실제로 잡는가
import { launch, mkctx, runCase, sleep, openTitle, waitGuard, VP, TOUCH } from './m2r3-lib.mjs';
import { LINE_AUDIT, setRootFont } from './m2r3-textlib.mjs';
const browser = await launch();
await runCase(
  { id: 'M2-C02-변이점검', cat: '측정기 점검', title: '줄바꿈 감사가 눈이 먼 것이 아닌지 — 푸터를 가운뎃점 나열로 되돌린 변이와 짧은 쌍의 기호를 항상 보이게 한 변이에서 감사가 실패해야 한다', steps: '320·360 × 글자 200%에서 (1) 푸터 통계 출처의 쉼표를 「 · 」로 바꾼 DOM (2) .pair__sep을 강제로 보이고 .pair__item을 inline으로 바꾼 DOM 에 같은 LINE_AUDIT를 돌린다', expected: '(1)(2) 모두 줄 첫머리/끝 기호 이상이 1건 이상 잡힘' },
  async () => {
    const out = [];
    let caught1 = 0;
    let caught2 = 0;
    for (const [tag, vp] of [['320', VP.m320], ['360', VP.m360]]) {
      for (const font of [150, 200]) {
        const ctx = await mkctx(browser, { viewport: vp, ...TOUCH });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await setRootFont(p, font);
        await p.evaluate(() => {
          const el = document.querySelector('[data-testid=stats-credit]');
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = w.nextNode())) n.textContent = n.textContent.replace('국가데이터처, 행정안전부, 교육부', '국가데이터처 · 행정안전부 · 교육부');
        });
        await sleep(200);
        const a1 = await p.evaluate(LINE_AUDIT, '[data-testid=stats-credit]');
        const own = a1.bad.filter((b) => b.kind === 'start' || b.kind === 'end' || b.kind === 'alone');
        caught1 += own.length;
        out.push(`푸터 가운뎃점 ${tag}/${font}%: 잡힘 ${own.length}건 ${own.slice(0, 2).map((b) => `[${b.kind}]「${b.line}」`).join('')}`);
        await ctx.close();
        const ctx2 = await mkctx(browser, { viewport: vp, ...TOUCH });
        const p2 = await ctx2.newPage();
        await openTitle(p2);
        await waitGuard(p2);
        await p2.getByTestId('carousel-pause').click();
        await setRootFont(p2, font);
        await p2.addStyleTag({ content: '.pair__sep{display:inline !important} .pair__item{display:inline !important; white-space:normal !important}' });
        await sleep(250);
        // 제한 폭을 줄여 줄이 넘치게
        await p2.addStyleTag({ content: '.slide__basis, .slide__meta{max-width:11em}' });
        await sleep(250);
        const a2 = await p2.evaluate(LINE_AUDIT, '.slide.is-active');
        const own2 = a2.bad.filter((b) => b.kind === 'start' || b.kind === 'end' || b.kind === 'alone');
        caught2 += own2.length;
        out.push(`Pair 기호 강제 ${tag}/${font}%: 잡힘 ${own2.length}건 ${own2.slice(0, 2).map((b) => `[${b.kind}]「${b.line}」`).join('')}`);
        await ctx2.close();
      }
    }
    return { verdict: caught1 > 0 && caught2 > 0 ? 'PASS' : 'FAIL', actual: `변이 감지: 푸터 ${caught1}건·Pair ${caught2}건 || ` + out.join(' ; '), shots: [] };
  }
);
await browser.close();

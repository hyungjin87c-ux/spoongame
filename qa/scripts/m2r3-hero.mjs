// QA-003 M2 3회차: M2-C04 — 첫 화면 한 줄 설명(「한국인의 한 번의 인생」)의 「한 번의」가 큰 글자에서 갈라지지 않는가 (r5의 R-237)
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH } from './m2r3-lib.mjs';
import { setRootFont } from './m2r3-textlib.mjs';
const browser = await launch();
await runCase(
  { id: 'M2-C04', cat: '공격', title: '한 줄 설명 「한국인의 한 번의 인생」 — 「한 번의」가 줄 사이에서 갈라지지 않는가 (글자 100·150·200% × 폭 320·360·1280)', steps: '글자 단위 Range로 줄을 나눠 「한」「번」「의」 세 글자가 같은 줄에 있는지, 설명 문구 전체의 줄바꿈 모양을 기록한다', expected: '모든 조합에서 「한 번의」가 한 줄 안, 줄 끝 구분 기호 없음, 가로 넘침 0' },
  async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
      for (const font of [100, 150, 200]) {
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        if (font !== 100) await setRootFont(p, font);
        await sleep(250);
        const r = await p.evaluate(() => {
          const el = document.querySelector('.hero__tag');
          if (!el) return { none: true };
          const tn = [];
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = w.nextNode())) tn.push(n);
          const chars = [];
          for (const node of tn) for (let i = 0; i < node.textContent.length; i++) {
            const rg = document.createRange();
            rg.setStart(node, i);
            rg.setEnd(node, i + 1);
            const rc = rg.getClientRects()[0];
            chars.push({ ch: node.textContent[i], top: rc ? Math.round(rc.top) : null });
          }
          const full = chars.map((c) => c.ch).join('');
          const idx = full.indexOf('한 번의');
          const part = idx >= 0 ? chars.slice(idx, idx + 4).filter((c) => c.top !== null) : [];
          const tops = [...new Set(chars.filter((c) => c.top !== null).map((c) => c.top))];
          const lines = tops.map((t) => chars.filter((c) => c.top === t).map((c) => c.ch).join('').trim());
          return { full, sameLine: part.length > 0 && new Set(part.map((c) => c.top)).size === 1, lines };
        });
        if (r.none) problems.push(`${tag}/${font}%: .hero__tag 없음`);
        else {
          if (!r.sameLine) problems.push(`${tag}/${font}%: 「한 번의」가 갈라짐 ${JSON.stringify(r.lines)}`);
          facts.push(`${tag}/${font}%: ${r.lines.join(' / ')}`);
        }
        if (font === 200 && tag !== '1280') shots.push(await shot(p, 'C04', `hero-${tag}-200`));
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.join(' // ') + ' || ' : '「한 번의」 갈라짐 0 || ') + facts.join(' ; '), shots };
  }
);
await browser.close();

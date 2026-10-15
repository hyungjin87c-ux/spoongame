// QA-003 M2 3회차: M2-C05 — 구 저장(v4) 안내문(첫 화면 위쪽 알림)의 줄바꿈 (QM2-5·QM2-10 감사 표본 밖의 첫 화면 본문 조각)
import { launch, mkctx, runCase, shot, sleep, waitGuard, PROD, SETTINGS_KEY, GAME_KEY, VP, TOUCH } from './m2r3-lib.mjs';
import { LINE_AUDIT, setRootFont } from './m2r3-textlib.mjs';
const browser = await launch();
await runCase(
  { id: 'M2-C05', cat: '공격', title: '구 저장(v4) 안내문 — 폭 320·360·1280 × 글자 100·150·200%에서 줄바꿈 감사', steps: 'v4 진행 저장을 심고 prod를 열어 나타난 안내문(role=status)을 글자 단위로 줄을 나눠 기호·숫자/단위 이상을 잰다', expected: '이상 0, 안내문 가로 넘침 0' },
  async () => {
    const problems = [];
    let n = 0;
    let text = '';
    for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
      for (const font of [100, 150, 200]) {
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        await ctx.addInitScript(([k]) => { try { localStorage.setItem(k, '{"version":4,"data":{"phase":"life","era":"present","age":10,"character":{"name":"김민준"}}}'); } catch {} }, [GAME_KEY]);
        const p = await ctx.newPage();
        await p.goto(PROD);
        await p.waitForSelector('[data-testid="old-save-notice"]', { timeout: 8000 });
        await waitGuard(p);
        if (font !== 100) await setRootFont(p, font);
        await sleep(250);
        text = await p.evaluate(() => document.querySelector('[data-testid="old-save-notice"]').innerText.replace(/\s+/g, ' '));
        const la = await p.evaluate(LINE_AUDIT, '[data-testid="old-save-notice"]');
        n += la.lineCount;
        for (const b of la.bad) problems.push(`${tag}/${font}% [${b.kind}] 「${b.line}」`);
        const ov = await p.evaluate(() => { const e = document.querySelector('[data-testid="old-save-notice"]').getBoundingClientRect(); return { right: e.right, vw: innerWidth, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
        if (ov.over > 0 || ov.right > ov.vw + 0.5) problems.push(`${tag}/${font}%: 안내문 가로 넘침 ${JSON.stringify(ov)}`);
        if (font === 200 && tag === '320') await shot(p, 'C05', 'notice-320-200');
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.slice(0, 6).join(' // ') + ' || ' : `9조합 이상 0(줄 ${n}) || `) + `안내문: 「${text}」`, shots: ['qa/screenshots/003/M2r3-C05-notice-320-200.png'] };
  }
);
await browser.close();

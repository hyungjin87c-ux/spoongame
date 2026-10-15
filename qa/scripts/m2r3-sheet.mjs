// QA-003 M2 3회차: 사람 눈 확인용 — 창 높이를 천천히 줄이며(경계 300.8px 근처) 찍은 연속 화면을 한 장의 시트로 묶는다
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, runCase, sleep, ensureFixture, seedContext, openState, SHOT_DIR } from './m2r3-lib.mjs';
import { settleBar } from './m2r3-barlib.mjs';
const browser = await launch();
const fx = await ensureFixture(browser);
await runCase(
  { id: 'M2-B04e', cat: '정상', title: '경계 근처 연속 화면(사람 눈) — 320폭 확인 단계 글자 100%에서 창 높이를 2px씩 줄이며 찍은 시트', steps: '320x330에서 시작해 2px씩 320x286까지 줄이며(단계마다 정착) 화면을 찍어 한 장의 시트로 묶고 눈으로 본다. 경계는 높이 300.8(띠 150.4px의 두 배)', expected: '한 번만 고정에서 풀림으로 바뀌고 그 앞뒤 화면은 일정하게 이어진다(깜빡임·되돌아감 없음)' },
  async () => {
    const ctx = await mkctx(browser, { viewport: { width: 320, height: 330 } });
    await seedContext(ctx, fx);
    const p = await ctx.newPage();
    await openState(p, 'continue');
    await settleBar(p);
    await p.getByTestId('begin-new').click();
    await p.waitForSelector('[data-testid=confirm-new-ask]');
    await sleep(450);
    const tiles = [];
    for (let vh = 330; vh >= 286; vh -= 2) {
      await p.setViewportSize({ width: 320, height: vh });
      await sleep(250);
      await settleBar(p);
      const rel = await p.evaluate(() => document.documentElement.classList.contains('bar-released'));
      const buf = await p.screenshot();
      tiles.push({ vh, rel, data: buf.toString('base64') });
    }
    await ctx.close();
    const html = `<body style="margin:0;background:#888;font:14px sans-serif"><div style="display:grid;grid-template-columns:repeat(6,330px);gap:8px;padding:8px">${tiles.map((t) => `<div><div style="color:#fff">높이 ${t.vh} — ${t.rel ? '해제' : '고정'}</div><img style="width:320px;border:1px solid #000" src="data:image/png;base64,${t.data}"></div>`).join('')}</div></body>`;
    const c2 = await mkctx(browser, { viewport: { width: 2100, height: 800 } });
    const q = await c2.newPage();
    await q.setContent(html);
    await sleep(300);
    const name = 'M2r3-B04e-sweep-sheet.png';
    await q.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
    await c2.close();
    const seq = tiles.map((t) => (t.rel ? 'R' : 'F')).join('');
    const flips = [...seq].filter((c, i) => i > 0 && c !== seq[i - 1]).length;
    return { verdict: flips === 1 ? 'PASS' : 'FAIL', actual: `높이 330→286(2px 간격 ${tiles.length}장) 상태열 ${seq} (F=고정·R=해제) 전환 ${flips}번`, shots: [`qa/screenshots/003/${name}`] };
  }
);
await browser.close();

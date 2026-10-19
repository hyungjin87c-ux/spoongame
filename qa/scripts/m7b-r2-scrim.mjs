// QA-003 M7b 2회차 A20 확장: 시트 바깥(어두운 바탕 .overlay) 위에서 쓸거나 휠을 굴릴 때 시트 뒤 문서가 스크롤되는가
// 사용: QA_OUT=qa/results/m7b/r2 QA_SHOT_PREFIX=M7b-r2 node qa/scripts/m7b-r2-scrim.mjs
import { launch, sleep, shot, runCase, cardReady } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const b = await launch();
const swipe = async (cdp, x, y0, dy) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let k = 1; k <= 10; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (dy * k) / 10 }] });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
};
await runCase(
  { id: 'A20b', cat: '2회차', title: '시트 바깥(어두운 바탕) 위에서 쓸기·휠 — 시트 뒤 문서 scrollY', steps: '(a) 360×740 터치, 짧은 카드(noise-present)에서 시트 바로 위 바탕에서 화면 위 끝까지 쓸기 6번 (b) 긴 카드(sibling-past)에서 같은 쓸기 6번 (c) 1280×800 휠을 바탕 위(y=40)에서 8번(짧은 카드, 긴 카드)', expected: '(권고) 시트 뒤 문서 scrollY 불변' },
  async () => {
    const rows = [];
    const bad = [];
    const shots = [];
    const probe = (name, vp, kind) => async () => {
      const { ctx, page } = await openCard(b, name, 'sheet', { vp, hidden: true });
      await cardReady(page);
      const cdp = await ctx.newCDPSession(page);
      const g = await page.evaluate(() => { const s = document.querySelector('.sheet').getBoundingClientRect(); return { sheetTop: Math.round(s.top), vh: innerHeight, docH: document.documentElement.scrollHeight }; });
      const y = Math.max(6, g.sheetTop - 6);
      if (kind === 'touch') for (let i = 0; i < 6; i++) await swipe(cdp, 180, y, -(y - 4)); // 바탕 안에서만: 시트 위쪽 가장자리 바로 위에서 화면 위쪽 끝까지
      else for (let i = 0; i < 8; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: Math.min(40, g.sheetTop - 5), deltaX: 0, deltaY: 400 }); await sleep(100); }
      const docY = await page.evaluate(() => Math.round(scrollY));
      shots.push(await shot(page, 'A20b', `${name}-${kind}-after`));
      await ctx.close();
      return { g, y, docY };
    };
    for (const [name, vp, kind] of [['noise-present', VPS[2], 'touch'], ['sibling-past', VPS[2], 'touch'], ['noise-present', VPS[8], 'wheel'], ['sibling-past', VPS[8], 'wheel']]) {
      const r = await probe(name, vp, kind)();
      rows.push(`${name}/${kind}: 시트 위쪽 y ${r.g.sheetTop}(화면 ${r.g.vh}, 문서 ${r.g.docH}), 바탕 위 y ${r.y}에서 → docY ${r.docY}`);
      if (r.g.docH <= r.g.vh) rows.push('  (문서가 안 길어 시험 공허)');
      if (r.docY !== 0) bad.push(`${name}/${kind}: 바탕 위에서 문서가 ${r.docY}px 스크롤됨`);
    }
    return { verdict: bad.length ? 'RECORD' : 'PASS', actual: (bad.length ? bad.join(' / ') + ' || ' : '') + rows.join(' | '), shots };
  },
);
await b.close();

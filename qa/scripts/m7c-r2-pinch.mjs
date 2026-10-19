// QA-003 M7c 2회차 R-405 / QA2-2: 두 시트(기록·결정)가 열린 채 시트 위·스크림 위 두 손가락 핀치 → 확대(visualViewport.scale > 1),
// 스크림 한 손가락 끌기로 뒤 문서는 안 움직임(스크롤 잠금 재확인). 두 손가락은 CDP Input.dispatchTouchEvent로 직접 만든다.
// 통제 실험: (1) 시트 없는 화면에서도 같은 핀치가 확대시키는가(방법이 유효한가) (2) 시험 중 스크림에 touch-action:none을 주입하면 확대가 막히는가(시험이 R-405 결함을 잡을 수 있는가)
// 사용: node qa/scripts/m7c-r2-pinch.mjs [ID 일부]
import { launch, openOracle, plainLife, dueStateFor, pendingState, openSeeded, sheetReady, shot, sleep, runCase, SET_MANUAL } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '핀치 확대(R-405)', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots, ...extra.rec };
};

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });

async function pinch(cdp, cx, cy, d0 = 60, d1 = 240, steps = 12) {
  const pts = (d) => [
    { x: cx - d / 2, y: cy, id: 1 },
    { x: cx + d / 2, y: cy, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(d0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d0 + ((d1 - d0) * i) / steps) });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(350);
}
async function drag(cdp, x, y0, y1, steps = 10) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps, id: 1 }] });
    await sleep(14);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(250);
}
const scaleOf = (page) => page.evaluate(() => (window.visualViewport ? Math.round(window.visualViewport.scale * 1000) / 1000 : null));
const geo = (page) =>
  page.evaluate(() => {
    const sh = document.querySelector('[data-testid="note-sheet"]') || document.querySelector('[data-testid="choice-panel"]');
    const ov = document.querySelector('[data-testid="note-overlay"]') || document.querySelector('.overlay');
    const r = sh ? sh.getBoundingClientRect() : null;
    const o = ov ? ov.getBoundingClientRect() : null;
    const cs = (e) => (e ? getComputedStyle(e).touchAction : null);
    return { sheet: r && { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom }, overlay: o && { x: o.x, y: o.y, w: o.width, h: o.height }, taSheet: cs(sh), taOverlay: cs(ov), scrollY: Math.round(window.scrollY), vw: innerWidth, vh: innerHeight };
  });

const SHEETS = [
  { id: 'note-manual', label: '기록 시트(수동)', state: base, wait: '[data-testid="life-screen"]', open: async (p) => { await p.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 }); await p.evaluate(() => document.querySelector('[data-testid="tool-note"]').click()); await sheetReady(p); } },
  { id: 'note-auto', label: '기록 시트(자동 ①, 인용 있음)', state: infant, wait: '[data-testid="note-sheet"]', open: async (p) => { await sheetReady(p); } },
  { id: 'decision', label: '결정 시트(모달)', state: pend, wait: '[data-testid="choice-panel"]', open: async (p) => { await sleep(500); } },
];

await run({ id: 'PZ-baseline', title: '통제: 시트가 없는 인생 화면에서 두 손가락 핀치가 확대시킨다(시험 방법이 유효함)', steps: '360×740 터치, 시트 없음, 중앙에서 두 손가락 60→240px 벌리기', expected: 'visualViewport.scale > 1.3' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  const cdp = await ctx.newCDPSession(page);
  const s0 = await scaleOf(page);
  await pinch(cdp, 180, 400);
  const s1 = await scaleOf(page);
  chk(`scale ${s0}→${s1}`, s0 === 1 && s1 > 1.3, `${s0}→${s1}`);
  await ctx.close();
  return done(checks, []);
});

for (const S of SHEETS) {
  await run({ id: `PZ-${S.id}`, title: `${S.label}: 시트 위·스크림 위 핀치 확대 + 스크림 한 손가락 끌기로 문서 불변`, steps: '문서를 300px 스크롤한 채 시트를 열고 ① 시트 위 핀치 ② 새로 열어 스크림 위 핀치 ③ 스크림 한 손가락 끌기 ④ 시트 위 한 손가락 끌기(시트가 스크롤 상자가 아닐 때 문서 불변)', expected: '핀치 → scale > 1.3, 끌기 → scrollY 300 그대로' }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const rec = {};
    // ① 시트 위 핀치
    {
      const { ctx, page } = await openSeeded(b, S.state, { wait: S.wait });
      await S.open(page);
      const cdp = await ctx.newCDPSession(page);
      const g = await geo(page);
      rec.geo = g;
      chk('touch-action: 스크림 pinch-zoom · 시트 pan-y pinch-zoom', /pinch-zoom/.test(g.taOverlay || '') && !/^none$/.test(g.taOverlay || '') && /pinch-zoom/.test(g.taSheet || ''), JSON.stringify({ overlay: g.taOverlay, sheet: g.taSheet }));
      const cx = g.sheet.x + g.sheet.w / 2;
      const cy = g.sheet.y + Math.min(g.sheet.h / 2, 300);
      const s0 = await scaleOf(page);
      await pinch(cdp, cx, cy);
      const s1 = await scaleOf(page);
      rec.onSheet = { s0, s1 };
      chk(`시트 위 핀치 scale ${s0}→${s1}`, s0 === 1 && s1 > 1.3, `${s0}→${s1}`);
      shots.push(await shot(page, `PZ-${S.id}`, 'on-sheet-zoomed'));
      // 확대된 채 시트가 아직 열려 있고 기능한다
      const still = await page.evaluate(() => !!(document.querySelector('[data-testid="note-sheet"]') || document.querySelector('[data-testid="choice-panel"]')));
      chk('확대 뒤에도 시트가 열려 있음', still, still);
      await ctx.close();
    }
    // ② 스크림 위 핀치
    {
      const { ctx, page } = await openSeeded(b, S.state, { wait: S.wait });
      await S.open(page);
      const cdp = await ctx.newCDPSession(page);
      const g = await geo(page);
      const scrimH = g.sheet.y; // 시트 위쪽 빈 곳
      rec.scrimH = Math.round(scrimH);
      if (scrimH >= 30) {
        const s0 = await scaleOf(page);
        await pinch(cdp, 180, scrimH / 2, 40, 220);
        const s1 = await scaleOf(page);
        rec.onScrim = { s0, s1 };
        chk(`스크림 위 핀치(스크림 높이 ${Math.round(scrimH)}px) scale ${s0}→${s1}`, s0 === 1 && s1 > 1.3, `${s0}→${s1}`);
        shots.push(await shot(page, `PZ-${S.id}`, 'on-scrim-zoomed'));
      } else {
        rec.onScrim = { skipped: `스크림 높이 ${Math.round(scrimH)}px 부족` };
        chk(`스크림 위 핀치: 스크림이 ${Math.round(scrimH)}px뿐이라 한 손가락 끌기만 본다`, true, '');
      }
      await ctx.close();
    }
    // ③ ④ 스크림 한 손가락 끌기
    {
      const { ctx, page } = await openSeeded(b, S.state, { wait: S.wait });
      await page.evaluate(() => window.scrollTo(0, 300));
      await sleep(200);
      const y0 = await page.evaluate(() => Math.round(window.scrollY));
      await S.open(page);
      const cdp = await ctx.newCDPSession(page);
      const g = await geo(page);
      const yOpen = g.scrollY;
      const scrimH = g.sheet.y;
      rec.scrollBefore = y0;
      rec.scrollOpen = yOpen;
      if (scrimH >= 30) {
        await drag(cdp, 180, scrimH - 6, 4);
        const a = await page.evaluate(() => Math.round(window.scrollY));
        await drag(cdp, 180, 4, scrimH - 6);
        const a2 = await page.evaluate(() => Math.round(window.scrollY));
        rec.drag = { up: a, down: a2 };
        chk(`스크림 한 손가락 위·아래 끌기 scrollY ${yOpen}→${a}→${a2}`, a === yOpen && a2 === yOpen, `${yOpen}/${a}/${a2}`);
      } else {
        rec.drag = { skipped: '스크림 부족' };
      }
      // 시트 위 끌기(시트가 스크롤 상자라면 시트 안만 움직이고 문서는 불변)
      const sx = g.sheet.x + g.sheet.w / 2;
      await drag(cdp, sx, g.sheet.y + 40, g.sheet.y + 8 + Math.min(200, g.sheet.h - 60));
      await drag(cdp, sx, g.sheet.y + Math.min(200, g.sheet.h - 20), g.sheet.y + 20);
      const a3 = await page.evaluate(() => Math.round(window.scrollY));
      rec.dragSheet = a3;
      chk(`시트 위 끌기 뒤에도 문서 scrollY 불변(${yOpen}→${a3})`, a3 === yOpen, `${yOpen}/${a3}`);
      shots.push(await shot(page, `PZ-${S.id}`, 'after-drag'));
      // 닫은 뒤 위치 복원
      await page.keyboard.press('Escape');
      await sleep(600);
      const a4 = await page.evaluate(() => Math.round(window.scrollY));
      rec.afterClose = a4;
      chk(`(참고) 닫은 뒤 scrollY ${a4}`, true, a4);
      await ctx.close();
    }
    // ⑤ 통제: 스크림에 touch-action:none을 주입하면 시트 위 핀치가 막히는가(시험이 R-405를 잡을 수 있는가)
    {
      const { ctx, page } = await openSeeded(b, S.state, { wait: S.wait });
      await S.open(page);
      await page.addStyleTag({ content: '.overlay{touch-action:none !important}' });
      await sleep(120);
      const cdp = await ctx.newCDPSession(page);
      const g = await geo(page);
      const s0 = await scaleOf(page);
      await pinch(cdp, g.sheet.x + g.sheet.w / 2, g.sheet.y + Math.min(g.sheet.h / 2, 300));
      const s1 = await scaleOf(page);
      rec.mutation = { s0, s1, taSheet: g.taSheet };
      chk(`통제(변이): 스크림 touch-action:none을 주입하면 시트 위 핀치가 확대되지 않는다 ${s0}→${s1}`, s1 <= 1.05, `${s0}→${s1}`);
      await ctx.close();
    }
    return done(checks, shots, { rec: { rec } });
  });
}

await run({ id: 'PZ-doubletap', title: '두 번 탭 확대: 시트가 열린 채 / 시트가 없는 화면', steps: 'CDP Input.synthesizeTapGesture tapCount 2', expected: '(참고) 시트 없는 화면에서도 확대가 없으면 에뮬레이션/뷰포트 설정상 두 번 탭 확대 자체가 없는 것 — 실기기 M9' }, async () => {
  const { ctx, page } = await openSeeded(b, base);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.synthesizeTapGesture', { x: 180, y: 400, tapCount: 2, gestureSourceType: 'touch' }).catch((e) => String(e));
  await sleep(500);
  const noSheet = await scaleOf(page);
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await sheetReady(page);
  const g = await geo(page);
  await cdp.send('Input.synthesizeTapGesture', { x: g.sheet.x + g.sheet.w / 2, y: g.sheet.y + 20, tapCount: 2, gestureSourceType: 'touch' }).catch((e) => String(e));
  await sleep(500);
  const onSheet = await scaleOf(page);
  await ctx.close();
  return { verdict: 'RECORD', actual: `두 번 탭: 시트 없는 화면 scale ${noSheet}, 시트가 열린 뒤 scale ${onSheet}. 뷰포트가 device-width라 모바일 크롬은 두 번 탭 확대를 하지 않고(시트와 무관), 이 환경은 이를 재현하지 못함 — 실기기(안드로이드 크롬·삼성 인터넷·iPhone Safari)는 M9`, shots: [] };
});

await b.close();

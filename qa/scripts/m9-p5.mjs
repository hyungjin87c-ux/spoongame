// QA-003 M9 P5: 데스크톱 3열 대시보드 — 1280×800·1920×1080 각 한 화면에 프로필·기록·식구/또래가 들어오고 가로 넘침 0, 창 폭 경계(DB1: 폭 960은 3열, 959는 1열).
// 8배속 완주 1판씩은 m9-p2.mjs(d1280·d1920)가 한다(P5-play-*). 이 스크립트는 상태를 심어 열 배치만 정밀하게 잰다.
// 사용: node qa/scripts/m9-p5.mjs
import { launch, openOracle, plainLife, openSeeded, mkctx, cleanStorageOnce, sleep, shot, runCase, PROD, SET_MANUAL } from './m7c-lib.mjs';
import { auditLayout, COLUMNS_AUDIT } from './m9-audit.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const states = {
  adult: await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true }),
  infant: await plainLife(oracle, { era: 'present', seed: 4242, age: 2, paused: true }),
  elder: await plainLife(oracle, { era: 'present', seed: 4242, age: 70, paused: true }),
};

await runCase({ id: 'P5-dash-3col', cat: 'P5 데스크톱 3열', title: '대시보드 3열: 1280×800·1920×1080에서 영유아·성인·노년 모두 좌(프로필)·중(기록)·우(식구) 3열이 첫 화면에 들어오고 가로 넘침·겹침 0', steps: '상태를 심어 열고 프로필·인생 기록·식구 카드의 위치를 잼 + m9-audit 배치 감사' }, async () => {
  const problems = [];
  const notes = [];
  let shotPath = null;
  for (const [vpName, vp] of [['1280x800', { width: 1280, height: 800 }], ['1920x1080', { width: 1920, height: 1080 }]]) {
    for (const [sn, st] of Object.entries(states)) {
      const { ctx, page } = await openSeeded(browser, st, { vp, touch: false, settings: SET_MANUAL });
      await sleep(400);
      const c = await page.evaluate(COLUMNS_AUDIT);
      const lay = await auditLayout(page);
      const w = `${vpName} ${sn}`;
      if (c.columns !== 3) problems.push(`${w}: 열 ${c.columns}`);
      else if (!c.allInFirstScreen) problems.push(`${w}: 프로필·기록·식구가 첫 화면에 다 들어오지 않음`);
      if (!c.peersInView) notes.push(`${w}: 또래 카드가 첫 화면 밖(스크롤해서 봄)`);
      problems.push(...lay.problems.map((x) => `${w}: ${x}`));
      if ((c.columns !== 3 || !c.allInFirstScreen || lay.problems.length) && !shotPath) shotPath = await shot(page, 'P5-dash-3col', w.replace(' ', '-'));
      await ctx.close();
    }
  }
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : `2크기 × 3나이 모두 3열·첫 화면 안, 배치 감사 0${notes.length ? ` (참고: ${notes.slice(0, 3).join(' · ')})` : ''}`, shots: shotPath ? [shotPath] : [] };
});

await runCase({ id: 'P5-width-boundary', cat: 'P5 데스크톱 3열', title: 'DB1 폭 경계: 창 폭 960은 3열, 959는 1열 (대시보드 · 첫 화면의 2열/1열도 같은 경계)', steps: '높이 800에서 폭 959·960·961·1024를 바꿔 가며 열 수를 잼(대시보드: 프로필·기록·식구 위치, 첫 화면: 오른쪽 카드 칸이 본문 옆인가)' }, async () => {
  const problems = [];
  const lines = [];
  for (const w of [959, 960, 961, 1024]) {
    const { ctx, page } = await openSeeded(browser, states.adult, { vp: { width: w, height: 800 }, touch: false, settings: SET_MANUAL });
    await sleep(350);
    const c = await page.evaluate(COLUMNS_AUDIT);
    const lay = await auditLayout(page);
    const want = w >= 960 ? 3 : 1;
    if (c.columns !== want) problems.push(`대시보드 폭 ${w}: 열 ${c.columns} (기대 ${want})`);
    problems.push(...lay.problems.map((x) => `대시보드 폭 ${w}: ${x}`));
    lines.push(`${w}:${c.columns}열`);
    await ctx.close();
    // 첫 화면
    const ctx2 = await mkctx(browser, { viewport: { width: w, height: 800 } });
    await cleanStorageOnce(ctx2);
    const p = await ctx2.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await sleep(350);
    const t = await p.evaluate(() => {
      const main = document.querySelector('.title__main') || document.querySelector('[data-testid="title-screen"] main');
      const side = document.querySelector('.title__side');
      if (!main || !side) return { ok: false };
      const m = main.getBoundingClientRect();
      const s = side.getBoundingClientRect();
      return { ok: true, sideBeside: s.left >= m.right - 2 };
    });
    const layT = await auditLayout(p);
    if (t.ok && t.sideBeside !== (w >= 960)) problems.push(`첫 화면 폭 ${w}: 오른쪽 카드 칸이 본문 ${t.sideBeside ? '옆' : '아래'}에 놓임(기대 ${w >= 960 ? '옆' : '아래'})`);
    problems.push(...layT.problems.map((x) => `첫 화면 폭 ${w}: ${x}`));
    lines.push(`첫화면 ${w}:${t.ok ? (t.sideBeside ? '2열' : '1열') : '?'}`);
    await ctx2.close();
  }
  return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : `대시보드·첫 화면 모두 경계 지켜짐 — ${lines.join(', ')}`, shots: [] };
});
await browser.close();

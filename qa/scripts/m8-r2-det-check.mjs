// QA-003 M8 2회차 (바) D-97·D-98: 지시 관형사(이·그·저)가 줄 끝에 홀로 남지 않는가.
//  DET-control   탐지기가 공허하지 않은지: 합성 글(Glue 없음)에서 폭을 바꿔 가며 관형사가 홀로 남는 폭을 찾아 탐지기가 잡는지, 묶음(inline-block)으로 감싸면 안 잡는지
//  DET-life-*    인생 화면의 D-98 대상 둘: 나가기 확인 보조 문장(exit-ask p.t-sm)·영향 안내(choice-hint) — 폭 320·360 × 글자 100·200%
// (엔딩 462조합·첫 화면 132조합 안의 확인은 m8-r2-ending.mjs layout · m8-r2-title.mjs 가 한다)
import { DET_AUDIT } from './m8-r2-det.mjs';
import { launch, openOracle, plainLife, pendingState, openSeeded, shot, sleep, runCase, setRootFont, SET_MANUAL } from './m8-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const quiet = await plainLife(oracle, { era: 'present', seed: 4242, age: 9, paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });

await runCase({ id: 'DET-control', title: '줄 끝 관형사 탐지기 점검: 합성 글에서 폭을 바꿔 홀로 남는 폭을 찾아 잡는지, 묶음으로 감싸면 안 잡는지 (공허 통과 방지)' }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 600 }, locale: 'ko-KR' });
  const page = await ctx.newPage();
  const TEXT = '이 판의 기록은 이 기기에만 저장됩니다. 그 아이는 이 해에 저 집으로 이사했습니다.';
  await page.setContent(`<style>body{font:16px/1.6 sans-serif;margin:0} #a,#b{word-break:keep-all;overflow-wrap:normal}</style><div id="a"></div><div id="b"></div>`);
  let found = null;
  for (let w = 120; w <= 380 && !found; w += 1) {
    const r = await page.evaluate(
      ([text, width]) => {
        const a = document.getElementById('a');
        a.style.width = width + 'px';
        a.textContent = text;
        return null;
      },
      [TEXT, w],
    );
    const res = await page.evaluate(DET_AUDIT, ['#a']);
    if (res.violations.length) found = { width: w, v: res.violations[0] };
  }
  let guarded = null;
  if (found) {
    // 같은 폭에서 「관형사 + 바로 뒤 어절」을 묶음(inline-block)으로 감싸면 탐지가 사라진다
    await page.evaluate(
      ([text, width]) => {
        const b = document.getElementById('b');
        b.style.width = width + 'px';
        b.innerHTML = text.replace(/(^|\s)([이그저]) ([가-힣]+)/g, (m, s, d, n) => `${s}<span style="display:inline-block">${d} ${n}</span>`);
      },
      [TEXT, found.width],
    );
    guarded = await page.evaluate(DET_AUDIT, ['#b']);
  }
  await ctx.close();
  const ok = !!found && guarded !== null && guarded.violations.length === 0 && guarded.tokens > 5;
  return { verdict: ok ? 'PASS' : 'FAIL', actual: found ? `폭 ${found.width}px에서 「${found.v.word}」(다음 「${found.v.next}」)가 줄 끝에 홀로 남는 것을 탐지 / 묶음으로 감싼 같은 폭에서는 위반 ${guarded.violations.length}건(어절 ${guarded.tokens}개)` : '홀로 남는 폭을 못 찾음' };
});

const DET_SPOTS = [
  { id: 'exit', label: '나가기 확인 보조 문장', sel: '[data-testid="exit-ask"] p.t-sm', prep: async (page) => { await page.getByTestId('tool-exit').click(); await page.waitForSelector('[data-testid="exit-ask"]'); }, state: quiet, wait: '[data-testid="life-screen"]' },
  { id: 'hint', label: '영향 안내', sel: '[data-testid="choice-hint"]', prep: async () => {}, state: pend, wait: '[data-testid="choice-panel"]' },
];
for (const spot of DET_SPOTS) {
  const problems = [];
  let lines = 0;
  let tokens = 0;
  const shots = [];
  for (const width of [320, 360]) {
    for (const pct of [100, 200]) {
      const { ctx, page } = await openSeeded(browser, spot.state, { vp: { width, height: 740 }, touch: true, settings: SET_MANUAL, wait: spot.wait, localFlag: false });
      await setRootFont(page, pct);
      await sleep(150);
      await spot.prep(page);
      await sleep(250);
      const present = await page.evaluate((s) => !!document.querySelector(s), spot.sel);
      const r = await page.evaluate(DET_AUDIT, [spot.sel]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      lines += r.lines;
      tokens += r.tokens;
      if (!present) problems.push(`${width}/${pct}: 대상 없음`);
      if (overflow) problems.push(`${width}/${pct}: 가로 넘침`);
      for (const v of r.violations) problems.push(`${width}/${pct}: 「${v.word}」 홀로 — ${v.context}`);
      if (width === 320 && pct === 200) shots.push(await shot(page, `DET-life-${spot.id}`, '320-text200'));
      await ctx.close();
    }
  }
  await runCase({ id: `DET-life-${spot.id}`, title: `D-98 ${spot.label}: 폭 320·360 × 글자 100·200%에서 줄 끝에 홀로 선 이·그·저 0` }, async () => ({
    verdict: problems.length === 0 && lines > 0 ? 'PASS' : 'FAIL',
    actual: problems.length === 0 ? `4조합 모두 위반 0 (잰 어절 ${tokens}개·줄 ${lines}개)` : problems.slice(0, 5).join(' / '),
    shots,
  }));
}
await browser.close();

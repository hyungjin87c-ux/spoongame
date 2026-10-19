// QA-003 M7c 참고 대조: 중대 결정 카드(M7b)의 선택지를 더블탭했을 때도 둘째 탭이 시트가 닫힌 뒤 컨트롤을 누르는가 — 기록 시트(M7c)의 같은 현상이 M7c만의 문제인지 이전부터인지 가르는 대조군.
// 사용: node qa/scripts/m7c-attack5.mjs
import { launch, openOracle, pendingState, openSeeded, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, readCard } from './m7c-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });

const readUi = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  return {
    paused: q('[data-testid="pause"]') ? q('[data-testid="pause"]').getAttribute('data-paused') : null,
    speed: q('[data-speed][aria-pressed="true"]') ? q('[data-speed][aria-pressed="true"]').getAttribute('data-speed') : null,
    theme: document.documentElement.getAttribute('data-theme'),
    auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
    sheet: !!q('[data-testid="note-sheet"]'),
    exitAsk: !!q('[data-testid="exit-ask"]'),
    choice: !!q('[data-testid="choice-panel"]'),
  };
});

for (const font of [100, 200]) {
  await runCase({ id: `D-decision-${font}`, cat: '입력 가드(대조)', title: `대조: 중대 결정 카드의 선택지 더블탭(60ms) — 글자 ${font}% · 공통 뷰포트 11종에서 둘째 탭이 닫힌 뒤 컨트롤을 누르는가`, steps: '대기 중인 결정 카드의 첫 선택지를 60ms 간격으로 두 번 탭', expected: '(참고) 기록 시트와 같은 현상이 결정 카드에도 있는지' }, async () => {
    const hits = [];
    const table = [];
    for (const vp of STD_VIEWPORTS) {
      const { ctx, page } = await openSeeded(b, pend, { vp: { width: vp.width, height: vp.height }, wait: '[data-testid="choice-panel"]' });
      await setRootFont(page, font);
      await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 }).catch(() => {});
      await sleep(400);
      const ch = page.locator('.choice').first();
      await ch.scrollIntoViewIfNeeded().catch(() => {});
      const box = await ch.boundingBox();
      if (!box) { table.push({ vp: vp.name, error: 'no box' }); await ctx.close(); continue; }
      const x = box.x + box.width / 2;
      const y = Math.min(box.y + box.height / 2, vp.height - 2);
      const before = await readUi(page);
      await page.touchscreen.tap(x, y);
      await sleep(60);
      await page.touchscreen.tap(x, y);
      await sleep(700);
      const after = await readUi(page);
      const diff = {};
      for (const k of Object.keys(before)) if (before[k] !== after[k]) diff[k] = `${before[k]}→${after[k]}`;
      delete diff.choice;
      const rec = { vp: vp.name, font, diff };
      table.push(rec);
      appendJsonl('dbltap-decision.jsonl', rec);
      if (Object.keys(diff).length) hits.push(rec);
      await ctx.close();
    }
    return { verdict: hits.length ? 'RECORD' : 'PASS', actual: hits.length ? `(참고) 결정 카드 선택지 더블탭의 둘째 탭이 컨트롤을 작동시킨 뷰포트 ${hits.length}/${STD_VIEWPORTS.length}: ${hits.map((h) => `${h.vp} ${JSON.stringify(h.diff)}`).join(' | ')}` : '11개 뷰포트에서 둘째 탭이 컨트롤을 작동시키지 않음', table };
  });
}
await b.close();

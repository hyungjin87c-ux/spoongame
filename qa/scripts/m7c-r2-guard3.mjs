// QA-003 M7c 2회차 F-1 보충(11-1-3 표의 나머지 닫힘 사건): 40개 안내 「닫기」·Esc 뒤 가드, 결정 카드 접기·다시 열기 가드(M7b foldEpoch가 합쳐진 뒤에도 그대로),
// 시트 안 동작(끄기/켜기·빈 입력 안내·확인 단계 열기·돌아가기)은 인생 화면 컨트롤에 가드를 걸지 않는다(G9) — 시트가 닫히기 전에는 가드 표시 변화 0.
// 사용: node qa/scripts/m7c-r2-guard3.mjs
import { launch, openOracle, plainLife, pendingState, withNotes, openSeeded, sheetReady, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, setRootFont, SET_MANUAL, GAME_KEY } from './m7c-r2-lib.mjs';

const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots };
};
const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const full = await withNotes(oracle, base, 40);
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
const VP3 = STD_VIEWPORTS.filter((v) => ['360x740', '320x568', '1280x800'].some((n) => v.name.startsWith(n)));

const ctrlState = (page) =>
  page.evaluate(() => ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-exit'].map((t) => { const e = document.querySelector('[data-testid="' + t + '"]'); return e ? { t, dis: e.getAttribute('aria-disabled') } : null; }).concat([...document.querySelectorAll('[data-speed]')].map((e) => ({ t: 'speed' + e.getAttribute('data-speed'), dis: e.getAttribute('aria-disabled') }))).filter(Boolean));
const uiOf = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return { paused: q('[data-testid="pause"]')?.getAttribute('data-paused'), speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed'), auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed'), dark: q('[data-testid="tool-dark"]')?.getAttribute('aria-pressed'), exit: !!q('[data-testid="exit-ask"]'), sheet: document.querySelectorAll('[data-testid="note-sheet"]').length, age: q('[data-testid="life-age"] b')?.textContent };
  });

await runCase({ id: 'G-limit-close', cat: '입력 가드(2회차)', title: '40개 안내 시트의 「닫기」 더블탭 / Esc — 닫힌 직후 컨트롤이 가드되고 둘째 탭이 컨트롤을 작동시키지 않는다 (11-1-3 표: 40개 안내 닫기·Esc는 「겁니다」)', steps: '기록 40개 판에서 도구 줄 「생각 남기기」 → 40개 안내 → 「닫기」 더블탭(60ms) / 따로 Esc → 100ms 뒤 컨트롤 aria-disabled', expected: '직후 모든 인생 화면 컨트롤 aria-disabled=true, 600ms 뒤 컨트롤 상태 불변(작동 0), 풀림' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  for (const vp of VP3) {
    for (const mode of ['dbltap', 'esc']) {
      const { ctx, page } = await openSeeded(b, full, { vp: { width: vp.width, height: vp.height }, wait: '[data-testid="life-screen"]' });
      await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
      await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
      await sheetReady(page);
      await sleep(300);
      const before = await uiOf(page);
      const bt = await page.getByTestId('note-limit-close').boundingBox();
      const x = bt.x + bt.width / 2;
      const y = Math.min(bt.y + bt.height / 2, vp.height - 2);
      await page.evaluate(() => { window.__clicks = []; document.addEventListener('click', (e) => { const t = e.target.closest('button, a') || e.target; window.__clicks.push({ tid: t.getAttribute('data-testid') || t.getAttribute('data-speed') || t.tagName, dis: (e.target.closest('button, a') || {}).getAttribute?.('aria-disabled') }); }, true); });
      if (mode === 'dbltap') {
        await page.touchscreen.tap(x, y);
        await sleep(60);
        await page.touchscreen.tap(x, y);
      } else {
        await page.keyboard.press('Escape');
      }
      await sleep(60);
      const cs = await ctrlState(page);
      await sleep(600);
      const after = await uiOf(page);
      const clicks = await page.evaluate(() => window.__clicks);
      const diff = Object.keys(before).filter((k) => !['sheet'].includes(k) && before[k] !== after[k]).map((k) => `${k}:${before[k]}→${after[k]}`);
      const allGuarded = cs.length >= 10 && cs.every((c) => c.dis === 'true');
      chk(`${vp.name} ${mode}: 닫힌 직후 컨트롤 ${cs.length}개 모두 aria-disabled`, allGuarded, JSON.stringify(cs.filter((c) => c.dis !== 'true')));
      chk(`${vp.name} ${mode}: 컨트롤 작동 0·새 시트 0`, diff.length === 0 && after.sheet === 0, JSON.stringify({ diff, sheet: after.sheet, clicks }));
      appendJsonl('guard3.jsonl', { vp: vp.name, mode, cs: cs.length, diff, clicks });
      if (vp.name.startsWith('360x740') && mode === 'dbltap') shots.push(await shot(page, 'G-limit-close', `${vp.name}-after`));
      await ctx.close();
    }
  }
  return done(checks, shots);
});

await runCase({ id: 'G-fold-guard', cat: '입력 가드(2회차)', title: '결정 카드 접기·다시 열기 가드(M7b)가 가드 세대 합치기(foldEpoch + inputEpoch) 뒤에도 그대로 — 접은 직후 100ms에 접힌 띠의 「결정 다시 열기」·컨트롤은 가드, 450ms 뒤 작동', steps: '결정 시트에서 「카드 접기」 → 100ms 뒤 접힌 띠 탭(거부) → 450ms 뒤 탭(열림)', expected: '100ms: 열리지 않음 · 컨트롤 aria-disabled, 450ms: 열림' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  for (const vp of VP3) {
    const { ctx, page } = await openSeeded(b, pend, { vp: { width: vp.width, height: vp.height }, wait: '[data-testid="choice-panel"]' });
    await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
    await sleep(500);
    await page.getByTestId('decision-fold-btn').click();
    await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
    await sleep(60);
    const cs = await ctrlState(page);
    const strip = await page.evaluate(() => { const e = document.querySelector('[data-testid="decision-reopen"]') || document.querySelector('[data-testid="decision-fold"] button'); return e ? { tid: e.getAttribute('data-testid'), dis: e.getAttribute('aria-disabled') } : null; });
    chk(`${vp.name}: 접은 직후 컨트롤 ${cs.length}개 aria-disabled`, cs.length >= 10 && cs.every((c) => c.dis === 'true'), JSON.stringify(cs.filter((c) => c.dis !== 'true')));
    chk(`${vp.name}: 접힌 띠의 다시 열기 버튼이 가드 중`, strip && strip.dis === 'true', JSON.stringify(strip));
    await sleep(500);
    const cs2 = await ctrlState(page);
    // 「다음 결정으로」는 결정 카드가 대기 중이면 가드와 무관하게 계속 비활성(M4부터의 지속 비활성) — 풀림 대상에서 뺀다
    chk(`${vp.name}: 500ms 뒤 모두 풀림(대기 결정 중 지속 비활성인 「다음 결정으로」 제외)`, cs2.filter((c) => c.t !== 'skip').every((c) => c.dis !== 'true'), JSON.stringify(cs2.filter((c) => c.dis === 'true')));
    if (vp.name.startsWith('360x740')) shots.push(await shot(page, 'G-fold-guard', `${vp.name}-folded`));
    await ctx.close();
  }
  return done(checks, shots);
});

await runCase({ id: 'G-in-sheet', cat: '입력 가드(2회차)', title: '시트 안 동작(끄기/켜기·빈 입력 안내·확인 단계 열기·돌아가기)은 시트가 닫히기 전에는 인생 화면 컨트롤 가드를 새로 걸지 않는다(G9) — 닫히는 순간에만 걸린다', steps: '수동 시트: 끄기/켜기 칸 탭 → 빈 1번 → 글 입력 Esc → 확인 → 돌아가기. 각 동작 뒤 시트가 열려 있는 동안 컨트롤 가드 상태, 마지막에 2번으로 닫고 직후', expected: '시트가 열린 동안 컨트롤은 inert(눌림 불가)이고 aria-disabled 변화 없음 · 닫는 순간 모두 aria-disabled' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await sheetReady(page);
  await sleep(500);
  const ctrlBefore = JSON.stringify(await ctrlState(page));
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(150);
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(150);
  await page.getByTestId('note-save').tap(); // 빈 입력 → 안내
  await sleep(300);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('가드 시험');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="note-confirm"]');
  await sleep(500);
  await page.getByTestId('note-confirm-back').tap();
  await sleep(600);
  const ctrlMid = JSON.stringify(await ctrlState(page));
  chk('시트가 열려 있는 동안 컨트롤 aria-disabled 상태가 변하지 않음(가드 새로 걸리지 않음)', ctrlBefore === ctrlMid, `${ctrlBefore.slice(0, 120)} / ${ctrlMid.slice(0, 120)}`);
  await page.getByTestId('note-input').focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await sleep(100);
  await page.getByTestId('note-skip').tap();
  await sleep(60);
  const cs = await ctrlState(page);
  chk('닫는 순간 컨트롤 모두 aria-disabled', cs.length >= 10 && cs.every((c) => c.dis === 'true'), JSON.stringify(cs.filter((c) => c.dis !== 'true')));
  await ctx.close();
  return done(checks, []);
});

await b.close();

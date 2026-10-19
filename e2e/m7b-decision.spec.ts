import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, activeTestId, countKind, findPendingState, injectSave, lifeState, oracleLife, rapidInput, readSave, readSettings, setPageVisible, settle, startPageHidden, withPlay } from './helpers';
import { SETTINGS_AUTO, SETTINGS_MANUAL, cardReady, findCardState, openCard } from './m7bStates';

/**
 * M7b 중대 결정 카드 (SPEC-003 MD1·MD2, content-M7b 10절 M-6·M-7, copy.md 6절): 두 틀(모달 시트 / 비모달 인라인), 접기·다시 열기, 포커스, 인용 박스, 자동 모드와의 관계.
 * 시간 경쟁을 줄이려고 가려진 탭(startPageHidden)으로 앱 타이머를 멈춘 채 화면을 준비하고, 시간이 흘러야 하는 시험(접은 동안 정지·자동 선택 재개)만 실제 시간을 쓴다.
 */

/** 심은 상태에 이미 있는 선택 기록 수 (앞선 결정은 첫 선택지로 넘겨 만든 상태다) */
const chosen = (state: GameState) => state.history.filter((h) => h.kind === 'choice').length;
const text = async (page: Page, id: string) => ((await page.getByTestId(id).innerText()) ?? '').replace(/\s+/g, ' ').trim();

test('수동 모드: 카드는 모달 시트로 뜨고(role=dialog·aria-modal·이름=제목), 바깥은 inert이며, 포커스는 제목이다 — 머리·제목·상황·인용·선택지·안내 순서 (MD1·MD2, M-6)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute('aria-labelledby', 'dc-title');
  await expect(dialog, '대화상자 이름 = 카드 제목').toHaveAccessibleName(await text(page, 'choice-title'));
  await expect.poll(() => activeTestId(page), '포커스는 선택지 제목').toBe('choice-title');
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');

  // 바깥 전부 inert (헤더·도구 줄·main·본문 끝 여백) — Tab이 시트 뒤로 새지 않는다
  for (const sel of ['[data-testid="dash-head"]', '.toolbar', 'main.dash', '.page-end-space']) await expect(page.locator(sel), sel).toHaveAttribute('inert', '');
  await expect(dialog).not.toHaveAttribute('inert', '');

  // 머리: ◆ 중대 결정 · 「{연도}년 · {나이}세」 · 「카드 접기」
  await expect(dialog.locator('.decision__kind')).toHaveText('중대 결정');
  const year = state.character!.birthYear + state.age;
  expect(await text(page, 'decision-when')).toBe(`${year}년 · ${state.age}세`);
  await expect(page.getByTestId('decision-fold-btn')).toHaveAccessibleName('카드 접기');

  // 제목(h2) → 상황 → 인용 박스 → 선택지 → 영향 안내 → 자동 모드 안내
  await expect(page.getByTestId('choice-title')).toHaveJSProperty('tagName', 'H2');
  const ys = await Promise.all(['choice-title', 'choice-text', 'cite', 'choice-hint', 'auto-note'].map(async (id) => (await page.getByTestId(id).boundingBox())!.y));
  const firstChoice = (await dialog.locator('.choice').first().boundingBox())!.y;
  expect(ys[0]).toBeLessThan(ys[1]);
  expect(ys[1]).toBeLessThan(ys[2]);
  expect(ys[2]).toBeLessThan(firstChoice);
  expect(firstChoice).toBeLessThan(ys[3]);
  expect(ys[3]).toBeLessThan(ys[4]);
  expect(await text(page, 'auto-note'), '꺼짐 안내 한 문장').toBe('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.');
});

test('인용 박스: 통계 카드는 「통계」 라벨 + 요약 + 출처 줄이고 링크·DOI·URL이 없다. 인용이 없는 카드에는 요소 자체가 없다 (MD2·EV6)', async ({ page }) => {
  await page.goto('/');
  const withCite = await findCardState(page, 'school-tutoring');
  await openCard(page, withCite, SETTINGS_MANUAL);
  await cardReady(page);
  const cite = page.getByTestId('cite');
  await expect(cite).toBeVisible();
  await expect(cite.locator('.cite__kind')).toHaveText('통계');
  await expect(cite.locator('.cite__text')).toContainText('2025년 초·중·고 학생의 75.7%');
  await expect(cite.locator('.cite__src')).toHaveText('국가데이터처(2026), 2025년 초중고사교육비조사 결과');
  expect(await cite.locator('a, [href]').count(), '인용 박스 안 링크 0').toBe(0);
  expect(await cite.innerHTML()).not.toMatch(/https?:|doi|pubmed|pmid/i);

  // 인용이 없는 카드(원칙적 무인용 X1: 한밤의 열)에는 .cite 요소가 없다
  await page.goto('/');
  const noCite = await findCardState(page, 'infant-fever');
  await openCard(page, noCite, SETTINGS_MANUAL);
  await cardReady(page);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  expect(await page.locator('.cite').count(), '빈 박스 0').toBe(0);
});

test('연구 인용: 「연구」 라벨 + 저자 성만의 출처 줄(「Teti 외(1996),」 + 원제) (M-11)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'infant-new-sibling');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  const cite = page.getByTestId('cite');
  await expect(cite.locator('.cite__kind')).toHaveText('연구');
  await expect(cite.locator('.cite__src')).toHaveText('Teti 외(1996), And baby makes four: predictors of attachment security among preschool-age firstborns during the transition to siblinghood');
  await expect(cite.locator('.cite__src .keep-phrase').first()).toHaveText('Teti 외(1996),');
  // K11: 영문 저자 성과 영문 원제는 lang="en"(스크린 리더가 한국어 음성으로 읽지 않게), 한글 「외」·연도는 아니다
  await expect(cite.locator('.cite__src .keep-phrase [lang="en"]')).toHaveText(['Teti']);
  await expect(cite.locator('.cite__src > span[lang="en"]')).toContainText('And baby makes four');
  await expect(cite.locator('.cite__text [lang]'), '요약(한국어)에는 lang이 없다').toHaveCount(0);
  // K11: 머리 「{연도}년 · {나이}세」의 가운뎃점은 접근성 트리에서 숨는다 — 화면은 그대로 「 · 」
  const when = page.getByTestId('decision-when');
  await expect(when.locator('span[aria-hidden="true"]:not(.fit-pair__probe)')).toHaveText('·');
  expect(await text(page, 'decision-when')).toBe(`${state.character!.birthYear + state.age}년 · ${state.age}세`);
});

test('선택하면 시트가 사라지고 선택이 기록되며 포커스는 인생 화면 제목으로 간다', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  const first = page.locator('.choice').first();
  await expect(first).toBeEnabled();
  await page.keyboard.press('Tab'); // 제목 → 첫 선택지(시트 안에서만 돈다)
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), 'Tab이 시트 안에 머문다').toBe(true);
  await first.click();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await settle(page);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state) + 1);
  await expect(page.getByTestId('dash-head')).not.toHaveAttribute('inert', '');
});

test('Tab은 시트 안에서만 돈다: 열 번 눌러도 포커스가 시트 밖(헤더·진행 줄·도구 줄)으로 새지 않는다 (aria-modal + 바깥 inert, design-system 11-10)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const a = document.activeElement;
      return a !== null && a !== document.body && a.closest('[role="dialog"]') !== null;
    });
    // 시트 안의 마지막 요소 다음 Tab은 브라우저 주소창으로 나갈 수 있다(body) — 그때도 문서 안 시트 밖 요소가 포커스를 받지는 않는다
    const outsideDoc = await page.evaluate(() => document.activeElement === document.body);
    expect(inside || outsideDoc, `${i + 1}번째 Tab`).toBe(true);
  }
});

test('카드 접기: 접힌 띠가 카드 자리에 생기고 포커스는 「결정 다시 열기」로 간다. 접은 동안 게임은 정지를 유지하고 컨트롤은 쓸 수 있다 (MD1, U1·U6(b)·U8)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  const key = (await page.getByTestId('choice-panel').getAttribute('data-key'))!;
  const age0 = await text(page, 'life-age');
  const pct0 = await page.getByTestId('year-progress').getAttribute('aria-valuenow');

  await page.getByTestId('decision-fold-btn').click();
  const fold = page.getByTestId('decision-fold');
  await expect(fold).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect.poll(() => activeTestId(page), '접으면 「결정 다시 열기」').toBe('decision-reopen');
  await expect(fold).toContainText('다시 열 때까지 시간은 멈춥니다.');
  const reopen = page.getByTestId('decision-reopen');
  await expect(reopen, '접근 가능한 이름 = 결정 다시 열기 {제목}').toHaveAccessibleName(`결정 다시 열기 ${await text(page, 'decision-fold-title')}`);
  // 바깥 inert가 풀렸다
  for (const sel of ['[data-testid="dash-head"]', '.toolbar', 'main.dash']) await expect(page.locator(sel), sel).not.toHaveAttribute('inert', '');

  // 접은 동안 정지: 나이·진행률 불변, 대기 중인 선택지도 그대로
  await page.waitForTimeout(2500);
  expect(await text(page, 'life-age')).toBe(age0);
  expect(await page.getByTestId('year-progress').getAttribute('aria-valuenow')).toBe(pct0);
  expect((await readSave(page)).data.pending?.key).toBe(key);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state));

  // 컨트롤은 쓸 수 있다 (속도 바꾸기)
  await expect(page.locator('[data-speed="2"]')).toBeEnabled();
  await page.locator('[data-speed="2"]').click();
  await expect(page.locator('[data-speed="2"]')).toHaveAttribute('aria-pressed', 'true');

  // 다시 열기: 시트가 같은 선택지로 돌아오고 포커스는 제목으로
  await expect(reopen).toBeEnabled();
  await reopen.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', key);
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  await expect(page.getByTestId('decision-fold')).toHaveCount(0);
});

test('Esc = 수동 시트 접기. 인라인 카드(자동 모드)에서는 Esc가 아무 일도 하지 않는다 (U7)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('decision-reopen');

  // 자동 모드(가려진 탭으로 자동 선택 타이머를 멈춘다): 인라인 카드에서 Esc는 무동작
  await page.goto('/');
  await openCard(page, state, SETTINGS_AUTO, { hidden: true });
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await page.getByTestId('choice-title').focus();
  await page.keyboard.press('Escape');
  await settle(page);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('decision-fold')).toHaveCount(0);
});

test('입력 가드: 「카드 접기」 더블탭의 둘째 입력은 그 자리에 생긴 「결정 다시 열기」에, 「결정 다시 열기」 더블탭의 둘째 입력은 새 카드에 떨어지지 않는다 (U9, 선택지 오탭 0)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);

  await rapidInput(page, 'mouse2', page.getByTestId('decision-fold-btn'));
  await settle(page);
  await expect(page.getByTestId('decision-fold'), '둘째 입력이 다시 열기를 누르지 못했다').toBeVisible();
  await expect(page.getByTestId('decision-reopen')).toBeEnabled(); // 400ms 가드가 풀린 뒤

  await rapidInput(page, 'mouse2', page.getByTestId('decision-reopen'));
  await settle(page);
  await expect(page.getByRole('dialog'), '둘째 입력이 곧바로 접지 못했다').toBeVisible();
  expect(countKind(await readSave(page), 'choice'), '선택지 오탭 0').toBe(chosen(state));
});

test('접기·다시 열기 연타 20회: 상태가 어긋나지 않는다 (카드는 늘 하나, 선택은 기록되지 않는다)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  for (let i = 0; i < 10; i++) {
    await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-reopen')).toBeEnabled();
    await page.getByTestId('decision-reopen').click();
  }
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('decision-fold')).toHaveCount(0);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state));
});

test('새로고침: 접힌 채 새로고침하면 열린 카드(시트)로 복원되고 접힘은 저장되지 않는다 (U5, 스키마 불변)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  // 시간을 재는 판(withPlay)으로 연다: 판 상태의 플레이 시간 기록(play, M8)에는 카드를 접어 둔 시간(ms)의 필드 이름 fold가 있어 아래 단언이 play를 따로 본다
  await openCard(page, withPlay(state), SETTINGS_MANUAL);
  await cardReady(page);
  const key = (await page.getByTestId('choice-panel').getAttribute('data-key'))!;
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  // 접힘 상태는 저장하지 않는다. play는 상태가 아니라 시간 기록이라 빼고 본다 — 대신 play의 키 집합이 정확히 아홉 개(시간 일곱 + 횟수 둘)인지 함께 본다: 접힘 상태가 play 안에 숨어 저장되는 경우까지 막는다 (REV-003-M8-1 관찰 1)
  const saved = (await readSave(page)).data;
  expect(JSON.stringify({ ...saved, play: undefined })).not.toMatch(/fold|folded|collapsed/i);
  expect(Object.keys(saved.play ?? {}).sort(), 'play의 키 집합').toEqual(['auto', 'decide', 'fold', 'hold', 'idle', 'note', 'offSpeed', 'resumes', 'skips']);
  await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-key', key);
  await expect(page.getByTestId('decision-fold')).toHaveCount(0);
  await expect.poll(() => activeTestId(page), '복원된 열린 카드는 제목으로').toBe('choice-title');
});

test('자동 모드 켜짐: 카드는 비모달 인라인이다 — 대화상자·inert·포커스 이동이 없고 자동 모드 버튼에 그대로 닿는다. 안내 한 문장은 「켜져 있습니다」 (M-6·M-13)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_AUTO, { hidden: true });
  const panel = page.getByTestId('choice-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-mode', 'inline');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const sel of ['[data-testid="dash-head"]', '.toolbar', 'main.dash']) await expect(page.locator(sel), sel).not.toHaveAttribute('inert', '');
  expect(await activeTestId(page), '자동 모드에서는 포커스를 가져오지 않는다').not.toBe('choice-title');
  expect(await text(page, 'auto-note')).toBe('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('auto').focus();
  expect(await activeTestId(page)).toBe('auto');
});

test('자동 모드를 끄면 인라인 카드가 그 자리에서 모달 시트로 바뀌고 포커스는 제목이다 (R-048, D-52)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_AUTO, { hidden: true });
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  const auto = page.getByTestId('auto');
  await expect(auto).toBeEnabled();
  await auto.focus(); // 키보드 사용자가 자동 모드 버튼에 와 있다
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  await expect.poll(() => activeTestId(page), '컨트롤에 있던 포커스도 제목으로(바깥이 inert가 된다)').toBe('choice-title');
  expect((await readSettings(page)).autoMode).toBe(false);
  expect(await text(page, 'auto-note')).toBe('자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.');
});

test('자동 모드에서 접으면 자동 선택 타이머가 멈추고, 다시 열면 AUTO_CHOICE_MS(3초) 뒤부터 센다 (U3(a))', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  const key = state.pending!.key;
  await openCard(page, state, SETTINGS_AUTO);
  await cardReady(page);
  await page.getByTestId('decision-fold-btn').click(); // 3초가 되기 전에 접는다
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await page.waitForTimeout(4000); // 접지 않았다면 이미 자동으로 골랐을 시간
  expect((await readSave(page)).data.pending?.key, '접은 동안 자동 선택이 멈췄다').toBe(key);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state));

  const reopen = page.getByTestId('decision-reopen');
  await expect(reopen).toBeEnabled();
  const t0 = Date.now();
  await reopen.click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect(page.getByTestId('choice-title'), '다시 열기는 사용자가 직접 눌렀으므로 포커스는 선택지 제목이다 (D-52)').toBeFocused();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0, { timeout: 6000 }); // 다시 열면 자동 선택이 재개된다
  // R-393: 포커스가 있던 카드 제목이 자동 선택으로 사라져도 포커스는 body로 떨어지지 않고 인생 화면 제목(이름)으로 간다
  await expect(page.getByTestId('life-name'), '자동 선택으로 카드가 사라진 뒤 포커스 = 이름 (R-393)').toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body), '포커스가 body로 떨어지지 않았다').toBe(false);
  const waited = Date.now() - t0;
  expect(waited, '다시 열기부터 AUTO_CHOICE_MS를 새로 센다').toBeGreaterThanOrEqual(2500);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state) + 1);
});

test('접은 채 자동 모드를 켜도 다시 열기 전에는 고르지 않고, 다시 열면 그때의 자동 모드에 맞는 틀(인라인)로 뜬다 (U8, copy.md 6-2 전환 한 바퀴)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  const key = state.pending!.key;
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('auto').click();
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => activeTestId(page), '접힌 띠 상태에서 자동 모드를 켜도 포커스는 그 버튼에 머문다').toBe('auto');
  await page.waitForTimeout(4000);
  await expect(page.getByTestId('decision-fold'), '띠 유지').toBeVisible();
  expect((await readSave(page)).data.pending?.key).toBe(key);

  await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  await page.getByTestId('decision-reopen').click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect.poll(() => activeTestId(page), '다시 열면 자동 모드여도 사용자가 직접 눌렀으므로 제목으로').toBe('choice-title');
});

test('접은 채 자동 모드를 끄면 카드는 접힌 채 그대로이고 다시 열면 시트로 뜬다 (자동 켜짐 → 접기 → 끄기 → 다시 열기)', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_AUTO, { hidden: true });
  await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('auto').click();
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('decision-fold'), '접힌 채 유지').toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  await page.getByTestId('decision-reopen').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
});

test('수동 모드에서 시간이 흘러 선택지가 뜨면 포커스가 속도 버튼에 있었어도 시트의 제목으로 간다 (D-52 — 바깥이 inert가 되어 「알리기만」이 불가능하다). 이때 누른 Space는 선택을 확정하지 않는다', async ({ page }) => {
  await startPageHidden(page);
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
  const start = await oracleLife(page, decision.seed, 'present');
  await injectSave(page, start, '/?__timescale=200', SETTINGS_MANUAL); // 풀리면 선택지가 곧바로 뜬다
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('life-name');
  const four = page.locator('[data-speed="4"]');
  await expect(four).toBeEnabled();
  await four.focus(); // 키보드 사용자가 속도 버튼 사이를 이동 중이다
  expect(await activeTestId(page)).toBe('speed-4');

  await setPageVisible(page, true); // 시간이 흐른다 → 선택지가 뜬다
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => activeTestId(page), '컨트롤에 있던 포커스가 제목으로 옮겨졌다').toBe('choice-title');
  await page.keyboard.press('Space'); // 제목(버튼이 아님)에서 누른 Space — 엉뚱한 선택 확정이 없다
  await settle(page);
  expect(countKind(await readSave(page), 'choice')).toBe(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(four, '속도도 바뀌지 않았다').toHaveAttribute('aria-pressed', 'false');
});

test('나가기 확인 단계를 연 채 「다음 결정으로」로 시트가 뜬 뒤 Esc 한 번은 맨 위(시트) 하나만 처리한다 — 카드 접기와 나가기 확인 닫기가 함께 일어나지 않는다 (REV-003-M7b-1 관찰 3)', async ({ page }) => {
  await startPageHidden(page); // 타이머가 끼어들지 않게
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', SETTINGS_MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('tool-exit')).toBeEnabled();
  await page.getByTestId('tool-exit').click();
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  // 나가기 확인이 열린 채 「다음 결정으로」를 누를 수 있다 — 첫 선택지가 시트로 뜬다
  await expect(page.getByTestId('skip')).toBeEnabled();
  await page.getByTestId('skip').click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  await expect.poll(() => activeTestId(page), '시트의 제목').toBe('choice-title');
  // Esc 한 번: 맨 위인 시트만 접힌다. 나가기 확인은 그대로 열려 있다
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('decision-fold'), '시트가 접혔다').toBeVisible();
  await expect(page.getByTestId('exit-ask'), '나가기 확인은 같이 닫히지 않았다').toBeVisible();
  // 시트가 없어졌으니 다음 Esc는 나가기 확인을 닫고 포커스는 「나가기」 도구로 돌아간다
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exit-ask')).toHaveCount(0);
  await expect(page.getByTestId('decision-fold'), '접힌 띠는 그대로').toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('tool-exit');
});

test('시트 끝까지 쓴 뒤 더 쓸어도 시트 뒤 대시보드는 같이 스크롤되지 않는다 — 행동으로 본다 (QA-003-M7b A20, M7c T1: 계산 스타일이 아니라 scrollY)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const state = await findCardState(page, 'school-tutoring');
  await openCard(page, state, SETTINGS_MANUAL);
  await cardReady(page);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  // 시트 뒤 문서가 충분히 길어야 연쇄 스크롤이 눈에 보인다
  await page.evaluate(() => {
    document.documentElement.style.minHeight = '5000px';
    window.scrollTo(0, 0);
  });
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight), '문서가 시트 뒤에서 스크롤 가능하다').toBeGreaterThan(800);
  const sheet = page.getByRole('dialog');
  const box = (await sheet.boundingBox())!;
  const wheelPastEnd = async () => {
    await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"]') as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(150); // 새 휠 제스처마다 연쇄 여부가 다시 정해진다
    }
    return page.evaluate(() => window.scrollY);
  };
  // 행동 단언: 시트가 끝에 닿은 뒤 더 쓸어도 문서는 그대로다(연쇄는 contain이, 문서 스크롤 자체는 html.sheet-open 잠금이 막는다 — e2e/m7c-scroll-lock.spec.ts가 (a)~(h)로 더 본다)
  expect(await wheelPastEnd(), '시트 끝 이후 문서 scrollY 불변').toBe(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '시트가 떠 있는 동안 문서 잠금 클래스').toBe(true);
  // 대조(시험이 실제로 잡는다): 연쇄 차단과 문서 잠금을 모두 풀면 같은 동작이 문서를 끌고 간다
  await page.addStyleTag({ content: '.sheet, .overlay { overscroll-behavior: auto !important; } html.sheet-open { overflow: visible !important; padding-right: 0 !important; }' });
  expect(await wheelPastEnd(), '규칙을 풀면 연쇄 스크롤이 일어난다').toBeGreaterThan(0);
});

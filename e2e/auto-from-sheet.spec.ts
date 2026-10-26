import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { AUTO_CHOICE_MS } from '../src/data/timingTable';
import { DASH_TEXT } from '../src/data/dashText';
import { INSIGHT_BY_ID } from '../src/data/citationInsights';
import { activeTestId, countKind, injectSave, rapidInput, readSave, readSettings, recordClicks, recordedClicks, settle, withPlay, withoutPlay } from './helpers';
import { SETTINGS_AUTO, SETTINGS_MANUAL, cardReady, findCardState, openCard } from './m7bStates';
import { heavyPending } from './gentleStates';
import { infantDue } from './m7cStates';
import { findDelegatedYear, showParentCard } from './parentStates';

/**
 * 결정 카드 맨 끝의 「이후 결정을 자동으로 고르게 하기」 (SPEC-005 r4 UX12·QI12, 완료 기준 4 (a)~(i), 마스터 결정 M-6을 이 버튼 하나에 한해 개정, M22 가린 카드에는 없음):
 * 자동 모드 꺼짐의 모달 시트 맨 끝 버튼이 기존 자동 모드(`settings.autoMode`)를 켜고 **같은 카드**가 비모달 인라인 카드로 바뀐다. 인라인 카드 맨 끝의 「이후 결정을 직접 고르기」가 끄면 같은 카드가 시트로 돌아온다.
 *  (a) `data-mode` sheet → inline, `data-key` 같음, 스크림·inert 없음  (b) `autoMode` 참(새로고침해도 유지)  (c) 진행 줄 「자동 모드」가 켜짐  (d) 포커스가 카드 제목  (e) 전환 뒤 400ms 안의 둘째 입력이 선택지에 닿지 않음(더블탭)
 *  (f) 누른 순간부터 `AUTO_CHOICE_MS` 뒤 자동 선택  (g) 인라인의 끄는 버튼 → 같은 카드가 시트로, `autoMode` 거짓  (h) 도구 줄로 끄기도 같음  (i) 8배속에서 `.overlay`가 전환 뒤 다시 나타나지 않음.
 * 그리고 부모 결정·흘러감 카드·기록 카드 시트·가린 카드에는 버튼이 없고, 같은 시드·같은 선택이면 이 버튼으로 켠 판과 도구 줄로 켠 판의 상태 전체·자동 모드 표시·엔딩 보조 문장이 같다.
 * 시간 경쟁을 줄이려고 가려진 탭(startPageHidden)으로 앱 타이머를 멈춘 채 화면을 준비하고, 시간이 흘러야 하는 시험((f)·(i)·같은 판)만 실제 시계를 쓴다.
 */

const chosen = (state: GameState) => state.history.filter((h) => h.kind === 'choice' && h.by === undefined).length;
const key = (page: Page) => page.getByTestId('choice-panel').getAttribute('data-key');
const mode = (page: Page) => page.getByTestId('choice-panel').getAttribute('data-mode');

/** 수동 모드의 본인 결정 시트(통계 인용 + 풀이가 있는 카드)를 열고 입력 가드가 풀릴 때까지 기다린다 */
async function openSheet(page: Page, opts: { hidden?: boolean; speed?: 1 | 2 | 4 | 8; play?: boolean } = {}): Promise<GameState> {
  await page.goto('/');
  const state = await findCardState(page, 'youth-startup');
  await openCard(page, opts.play === true ? withPlay(state) : state, { ...SETTINGS_MANUAL, speed: opts.speed ?? 1 }, { hidden: opts.hidden });
  await cardReady(page);
  await expect(page.getByTestId('auto-on-btn')).toBeEnabled();
  return state;
}

test('(a)~(d) 시트 하단 「이후 결정을 자동으로 고르게 하기」: 같은 카드가 인라인으로 바뀌고(data-key 같음) 자동 모드가 켜지며 진행 줄이 켜짐이고 포커스는 카드 제목이다', async ({ page }) => {
  const state = await openSheet(page, { hidden: true });
  const before = await key(page);
  expect(before).not.toBeNull();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');

  // 버튼: 선택지보다 낮은 위계의 보조 버튼, 이름과 보조 한 줄(aria-describedby)
  const btn = page.getByTestId('auto-on-btn');
  await expect(btn).toHaveAccessibleName(DASH_TEXT.autoOnBtn);
  await expect(btn).toHaveAccessibleDescription(DASH_TEXT.autoOnSub);
  const btnBox = (await btn.boundingBox())!;
  const lastChoiceBox = (await page.locator('.choice').last().boundingBox())!;
  expect(btnBox.y, '선택지 아래 카드 맨 끝').toBeGreaterThan(lastChoiceBox.y + lastChoiceBox.height - 1);
  expect(await btn.evaluate((e) => getComputedStyle(e).fontWeight), '선택지(굵은 라벨)보다 가벼운 글자').toBe('400');
  expect((await readSettings(page)).autoMode).toBe(false);

  await btn.click();

  // (a) 같은 카드가 인라인 틀로
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  expect(await key(page), '같은 카드(data-key)').toBe(before);
  await expect(page.locator('.overlay'), '스크림 제거').toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const sel of ['[data-testid="dash-head"]', '.toolbar', 'main.dash']) await expect(page.locator(sel), `${sel}의 inert 해제`).not.toHaveAttribute('inert', '');
  // (b) 같은 설정을 켰다
  await expect.poll(async () => (await readSettings(page)).autoMode, 'autoMode 저장').toBe(true);
  // (c) 진행 줄의 「자동 모드」가 켜진 상태
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('auto')).toContainText(DASH_TEXT.autoOn);
  // (d) 포커스는 카드 제목
  await expect.poll(() => activeTestId(page), '포커스').toBe('choice-title');
  // 선택은 기록되지 않았다(가려진 탭이라 자동 선택 타이머도 멈춰 있다) — 인라인 카드의 끄는 버튼이 생겼다
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state));
  await expect(page.getByTestId('auto-off-btn')).toHaveAccessibleName(DASH_TEXT.autoOffBtn);
  await expect(page.getByTestId('auto-on-btn')).toHaveCount(0);
  // 새로고침해도 유지(새 판에서도 유지되는 기존 동작) — 같은 카드가 인라인으로 복원
  await page.reload();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'true');
  expect((await readSettings(page)).autoMode).toBe(true);
});

test('(e) 더블탭: 전환 뒤 400ms 안의 둘째 입력은 선택지·끄는 버튼에 떨어지지 않는다 (U9 입력 가드)', async ({ page }) => {
  await recordClicks(page);
  const state = await openSheet(page, { hidden: true });
  await rapidInput(page, 'mouse2', page.getByTestId('auto-on-btn'));
  await settle(page);
  const clicks = await recordedClicks(page);
  expect(clicks[0], '첫 입력은 켜는 버튼').toBe('auto-on-btn');
  expect(clicks.length, '둘째 입력이 들어갔다').toBeGreaterThanOrEqual(2);
  for (const c of clicks.slice(1)) {
    expect(c.startsWith('choice-') && !c.endsWith('(가드)'), `둘째 이후 입력 「${c}」가 눌린 선택지가 아니다`).toBe(false);
    expect(c === 'auto-off-btn', `둘째 입력이 끄는 버튼을 눌렀다`).toBe(false);
  }
  // 전환으로 바뀐 자리에는 새로 마운트된 카드 버튼(마운트 가드)뿐 아니라 시트가 사라지며 inert가 풀린 진행 줄·도구 줄도 있다 — 그 컨트롤은 마운트되지 않으므로 전환 때 올리는 입력 가드 세대(App#autoFromCard의 bumpGuard)가 막는다.
  // 그래서 둘째 이후 입력은 가드에 막힌 버튼이거나 버튼이 아닌 곳이어야 한다(가드에 막히지 않은 버튼 0).
  for (const c of clicks.slice(1)) expect(c.startsWith('비버튼') || c.endsWith('(가드)'), `둘째 이후 입력 「${c}」가 가드에 막히지 않은 버튼을 눌렀다`).toBe(true);
  await expect(page.getByTestId('choice-panel'), '카드는 그대로 인라인').toHaveAttribute('data-mode', 'inline');
  expect(countKind(await readSave(page), 'choice'), '선택지 오탭 0').toBe(chosen(state));
  expect((await readSettings(page)).autoMode, '둘째 입력이 다시 끄지 못했다').toBe(true);
  // 가드가 풀린 뒤에는 끄는 버튼이 눌린다
  await expect(page.getByTestId('auto-off-btn')).toBeEnabled();
});

test('(e2) 더블탭: 전환 직후 진행 줄의 배속 버튼은 400ms 동안 입력 가드에 막힌다 — 시트가 사라지며 inert가 풀린 컨트롤(마운트되지 않는 부품)도 전환 때 올리는 세대로 닫힌다', async ({ page }, testInfo) => {
  // 모바일은 진행 줄이 화면 아래에 고정이라 전환 뒤에도 자리가 그대로다. PC는 진행 줄이 문서 맨 위 도구 줄에 있어 전환 때 앱이 카드 제목으로 문서를 스크롤하므로 좌표가 달라진다.
  test.skip(testInfo.project.name !== 'mobile-360', '좌표 입력이라 진행 줄이 고정인 mobile-360에서만 실행');
  await recordClicks(page);
  await openSheet(page, { hidden: true });
  const speedBefore = (await readSettings(page)).speed;
  const speed4 = page.locator('[data-speed="4"]');
  await page.getByTestId('auto-on-btn').click();
  const box = (await speed4.boundingBox())!; // 전환 뒤의 자리(스크롤 잠금이 풀리며 가로 자리가 바뀔 수 있다) — 400ms 안이다
  // 둘째 입력: 시트가 있던 동안 inert였던 진행 줄의 버튼. 좌표 입력이다 — Playwright의 locator.click은 aria-disabled(가드)가 풀릴 때까지 기다려 가드를 우회하기 때문이다
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
  expect(await recordedClicks(page), '둘째 입력은 가드에 막힌 배속 버튼이다').toEqual(['auto-on-btn', 'speed-4(가드)']);
  expect((await readSettings(page)).speed, '배속이 바뀌지 않았다').toBe(speedBefore);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
});

test('(f) 자동 선택 타이머는 누른 순간부터 AUTO_CHOICE_MS 뒤에 돈다 — 그 사이 직접 골라도 된다', async ({ page }) => {
  test.setTimeout(60_000);
  const state = await openSheet(page);
  const t0 = Date.now();
  await page.getByTestId('auto-on-btn').click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await page.waitForTimeout(AUTO_CHOICE_MS - 1200);
  expect(countKind(await readSave(page), 'choice'), `누른 뒤 ${AUTO_CHOICE_MS - 1200}ms에는 아직 자동으로 고르지 않았다`).toBe(chosen(state));
  await expect(page.getByTestId('choice-panel'), '자동으로 고르면 카드가 사라진다').toHaveCount(0, { timeout: 10_000 });
  const elapsed = Date.now() - t0;
  expect(elapsed, `누른 순간부터 걸린 시간(ms) — ${AUTO_CHOICE_MS}ms 안팎`).toBeGreaterThanOrEqual(AUTO_CHOICE_MS - 500);
  expect(elapsed).toBeLessThanOrEqual(AUTO_CHOICE_MS + 4000);
  await expect.poll(async () => countKind(await readSave(page), 'choice'), '자동 선택이 기록됐다').toBe(chosen(state) + 1);
});

test('전환 중에 직접 고를 수 있다: 인라인으로 바뀐 뒤 가드가 풀리면 선택지를 눌러 직접 고른다 (자동 선택 전)', async ({ page }) => {
  const state = await openSheet(page, { hidden: true });
  await page.getByTestId('auto-on-btn').click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  const first = page.locator('.choice').first();
  await expect(first).toBeEnabled();
  await first.click();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect.poll(async () => countKind(await readSave(page), 'choice')).toBe(chosen(state) + 1);
  expect((await readSettings(page)).autoMode, '자동 모드는 켜진 채 남는다').toBe(true);
});

test('(g) 인라인 카드 맨 끝 「이후 결정을 직접 고르기」: 같은 카드가 시트로 돌아오고 autoMode가 거짓이며 포커스는 제목이다 · (h) 도구 줄의 「자동 모드」로 꺼도 같다', async ({ page }) => {
  await page.goto('/');
  const state = await findCardState(page, 'youth-startup');
  await openCard(page, state, SETTINGS_AUTO, { hidden: true });
  await cardReady(page);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  const k = await key(page);
  const off = page.getByTestId('auto-off-btn');
  await expect(off).toBeEnabled();
  await expect(off).toHaveAccessibleName(DASH_TEXT.autoOffBtn);
  await expect(off).toHaveAccessibleDescription(DASH_TEXT.autoOffSub);

  await off.click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  expect(await key(page), '같은 카드').toBe(k);
  await expect(page.locator('.overlay')).toHaveCount(1);
  await expect.poll(async () => (await readSettings(page)).autoMode, 'autoMode 거짓').toBe(false);
  await expect.poll(() => activeTestId(page), '포커스는 제목').toBe('choice-title');
  await expect(page.getByTestId('dash-head')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('auto-on-btn')).toBeEnabled();

  // 다시 켜고(카드 버튼) 이번에는 도구 줄로 끈다: 시트가 떠 있으면 도구 줄이 inert라 → 덮어 두기 → 도구 줄 → 다시 열기 (M-6 개정은 카드 버튼 하나뿐이다)
  await page.getByTestId('auto-on-btn').click();
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('auto').click();
  await expect(page.getByTestId('choice-panel'), '도구 줄로 끄면 같은 카드가 시트로').toHaveAttribute('data-mode', 'sheet');
  expect(await key(page)).toBe(k);
  await expect.poll(async () => (await readSettings(page)).autoMode).toBe(false);
  expect(countKind(await readSave(page), 'choice'), '어느 길로도 선택은 기록되지 않았다').toBe(chosen(state));
});

test('M-6 개정의 범위: 시트가 떠 있는 동안 진행 줄·도구 줄은 inert이고 시트 안에 자동 모드를 켜는 길은 이 버튼 하나뿐이다', async ({ page }) => {
  await openSheet(page, { hidden: true });
  await expect(page.locator('.toolbar')).toHaveAttribute('inert', '');
  await expect(page.locator('[role="dialog"] [data-testid="auto"], [role="dialog"] [data-testid="tool-bgm"]')).toHaveCount(0);
  const autoControls = await page.locator('[role="dialog"] button').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? '').filter((id) => /auto/.test(id)));
  expect(autoControls).toEqual(['auto-on-btn']);
});

test('(i) 8배속: 전환 뒤 .overlay(스크림)가 다시 나타나지 않는다 — 시트와 인라인이 번갈아 뜨고 지는 일 0 (M-6이 막으려던 번쩍임)', async ({ page }) => {
  test.setTimeout(60_000);
  await openSheet(page, { speed: 8 });
  await page.evaluate(() => {
    const w = window as unknown as { __overlayAfter: number; __flash: boolean };
    w.__overlayAfter = 0;
    w.__flash = false;
    new MutationObserver(() => {
      if (w.__flash && document.querySelector('.overlay') !== null) w.__overlayAfter++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('auto-on-btn').click();
  await page.evaluate(() => {
    (window as unknown as { __flash: boolean }).__flash = true;
  });
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  // 8배속 자동: 3초 안팎 동안 카드가 여러 번 자동으로 고르고 새로 뜬다 — 그 사이 스크림이 한 번도 생기지 않는다
  await page.waitForTimeout(4000);
  const seen = await page.evaluate(() => (window as unknown as { __overlayAfter: number }).__overlayAfter);
  expect(seen, '전환 뒤 .overlay가 DOM에 생긴 횟수').toBe(0);
  await expect(page.locator('.overlay')).toHaveCount(0);
  expect((await readSettings(page)).autoMode).toBe(true);
  expect((await readSettings(page)).speed).toBe(8);
});

test('낭독: 전환 순간 한 번 알리는 상태 문장(role=status)이 켬/끔 각각 들어가고 잠시 뒤 비워진다 — 자동 선택마다 읽히지 않는다', async ({ page }) => {
  await openSheet(page, { hidden: true });
  const status = page.getByTestId('auto-status');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status, '처음에는 비어 있다').toHaveText('');
  await page.getByTestId('auto-on-btn').click();
  await expect(status).toHaveText(DASH_TEXT.autoOnStatus);
  await expect(status, '잠시 뒤 비운다').toHaveText('', { timeout: 6000 });
  await expect(page.getByTestId('auto-off-btn')).toBeEnabled();
  await page.getByTestId('auto-off-btn').click();
  await expect(status).toHaveText(DASH_TEXT.autoOffStatus);
  await expect(status).toHaveText('', { timeout: 6000 });
});

test('키보드: 시트 안에서 Tab으로 버튼에 닿아 Enter로 켜면 포커스가 제목으로 가고, 인라인에서 Tab으로 끄는 버튼에 닿아 Space로 끄면 시트로 돌아온다', async ({ page }) => {
  await openSheet(page, { hidden: true });
  await page.keyboard.press('Shift'); // 키보드 사용 중(:focus-visible)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    if ((await activeTestId(page)) === 'auto-on-btn') break;
  }
  expect(await activeTestId(page), 'Tab 순서가 읽기 순서(덮어 두기 → 제목 → 선택지 → 자동 버튼)라 버튼에 닿는다').toBe('auto-on-btn');
  expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), '시트 안').toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    if ((await activeTestId(page)) === 'auto-off-btn') break;
  }
  expect(await activeTestId(page)).toBe('auto-off-btn');
  await expect(page.getByTestId('auto-off-btn')).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
});

test('연타·번갈아 켜고 끄기 10회(카드 버튼 · 도구 줄): 카드는 늘 하나이고 모드가 설정과 어긋나지 않으며 선택은 기록되지 않는다', async ({ page }) => {
  test.setTimeout(90_000);
  const state = await openSheet(page, { hidden: true });
  const k = await key(page);
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('auto-on-btn').click();
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
    await expect(page.getByTestId('auto-off-btn')).toBeEnabled();
    if (i % 2 === 0) {
      await page.getByTestId('auto-off-btn').click();
    } else {
      await expect(page.getByTestId('auto')).toBeEnabled();
      await page.getByTestId('auto').click();
    }
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
    await expect(page.getByTestId('auto-on-btn')).toBeEnabled();
    expect(await key(page)).toBe(k);
    await expect(page.getByTestId('choice-panel')).toHaveCount(1);
  }
  expect((await readSettings(page)).autoMode).toBe(false);
  expect(countKind(await readSave(page), 'choice')).toBe(chosen(state));
});

test('누르자마자 새로고침: 설정이 저장돼 있으면 같은 카드가 인라인으로, 저장 전이면 시트로 복원된다 — 어느 쪽이든 카드는 하나이고 모드는 설정과 같다', async ({ page }) => {
  await openSheet(page, { hidden: true });
  await page.getByTestId('auto-on-btn').click();
  await page.reload();
  await expect(page.getByTestId('choice-panel')).toHaveCount(1);
  const m = await mode(page);
  const auto = (await readSettings(page)).autoMode;
  expect(m, `모드(${m})가 autoMode(${auto})와 같다`).toBe(auto ? 'inline' : 'sheet');
});

test('카드가 아닌 곳에는 버튼이 없다 (M22 · UX12-6): 부모님이 정한·아이의 일로 흘러간 카드와 기록 카드 시트', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const y = await findDelegatedYear(page, { eventId: 'infant-new-sibling', by: 'child', firstBorn: true });
  await showParentCard(page, y);
  await expect(page.getByTestId('parent-card')).toBeVisible();
  for (const id of ['auto-set', 'auto-on-btn', 'auto-off-btn', 'choice-ask', 'cite-insight']) await expect(page.getByTestId(id), `부모·흘러감 카드: ${id}`).toHaveCount(0);
  // 같은 인용 박스(연구)가 있어도 풀이는 그리지 않는다 (M23)
  await expect(page.getByTestId('parent-card').getByTestId('cite')).toBeVisible();
  await expect(page.getByTestId('parent-card').locator('.cite__insight')).toHaveCount(0);

  // 기록 카드 시트 (5세 — 인용 c-102, 풀이 없음)
  await page.goto('/');
  const due = await infantDue(page);
  await injectSave(page, due.state, '/', { speed: 1, autoMode: false, noteCards: true });
  await expect(page.getByTestId('note-sheet')).toBeVisible();
  for (const id of ['auto-set', 'auto-on-btn', 'auto-off-btn', 'choice-ask']) await expect(page.getByTestId(id), `기록 카드 시트: ${id}`).toHaveCount(0);
  await expect(page.getByTestId('note-sheet').getByTestId('cite')).toBeVisible();
  await expect(page.getByTestId('note-sheet').locator('.cite__insight'), '기록 카드의 인용에는 풀이가 없다').toHaveCount(0);
  await expect(page.getByTestId('note-sheet').getByTestId('cite')).toContainText('4세 8개월');
});

test('가린 카드(무거운 장면 가리기)에는 질문·풀이·자동 고르기 묶음이 없고 버튼은 둘뿐이며, 「펼쳐서 읽기」 뒤에는 모두 보인다 (M22)', async ({ page }) => {
  await page.goto('/');
  const game = await heavyPending(page, 'middle-layoff');
  await injectSave(page, game, '/', { ...SETTINGS_MANUAL, gentle: true });
  await cardReady(page).catch(() => undefined);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-veiled', 'true');
  for (const id of ['choice-ask', 'cite-insight', 'auto-set', 'auto-on-btn', 'auto-off-btn']) await expect(page.getByTestId(id), `가린 카드: ${id}`).toHaveCount(0);
  await expect(page.getByTestId('veil-open')).toBeVisible();
  await expect(page.getByTestId('veil-auto')).toBeVisible();
  expect(await page.locator('[role="dialog"] button').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')).filter((id) => id !== 'decision-fold-btn')), '머리의 덮기 버튼 말고는 버튼 둘').toEqual(['veil-open', 'veil-auto']);
  await expect(page.getByTestId('veil-open')).toBeEnabled();
  await page.getByTestId('veil-open').click();
  await expect(page.getByTestId('choice-ask')).toHaveText(DASH_TEXT.choiceAsk);
  await expect(page.getByTestId('auto-on-btn')).toBeVisible();
  await expect(page.getByTestId('cite-insight')).toContainText(INSIGHT_BY_ID['c-083']);
});

test('같은 시드·같은 선택이면 이 버튼으로 켠 판과 도구 줄로 켠 판의 상태 전체·자동 모드 표시·엔딩 보조 문장이 같다 (UX12-2)', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const state = withoutPlay(await findCardState(page, 'youth-startup'));
  const settings = { ...SETTINGS_MANUAL, speed: 8 as const, noteCards: false };

  async function finish(how: 'card' | 'tool'): Promise<{ game: Record<string, unknown>; autoUsed: number; clean: boolean; note: string }> {
    await injectSave(page, withPlay(state), '/?__timescale=2000', settings);
    await cardReady(page);
    await expect(page.getByTestId('auto-on-btn')).toBeEnabled();
    if (how === 'card') {
      await page.getByTestId('auto-on-btn').click();
    } else {
      // 도구 줄 길: 덮어 두기 → 도구 줄 「자동 모드」 → 결정 다시 열기
      await page.getByTestId('decision-fold-btn').click();
      await expect(page.getByTestId('decision-reopen')).toBeEnabled();
      await expect(page.getByTestId('auto')).toBeEnabled();
      await page.getByTestId('auto').click();
      await page.getByTestId('decision-reopen').click();
    }
    await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 120_000 });
    // 엔딩 화면이 그려진 직후에는 저장 효과가 아직 안 돈 때가 있다(WebKit에서 직전 해의 저장을 읽은 적이 있다) — 저장이 엔딩이 될 때까지 기다린 뒤 읽는다
    await expect.poll(async () => ((await readSave(page)).data as unknown as GameState).phase, { timeout: 10_000 }).toBe('ending');
    const save = (await readSave(page)).data as unknown as GameState & { play: NonNullable<GameState['play']> };
    const note = (await page.getByTestId('ending-playtime-note').innerText()).replace(/\s+/g, ' ').replace(/\d+분 \d+초/g, 'N분 N초').replace(/\d{2}:\d{2}/g, 'mm:ss');
    const { play, ...game } = save;
    return { game: game as unknown as Record<string, unknown>, autoUsed: play.auto, clean: play.offSpeed === 0 && play.auto === 0 && play.skips === 0 /* core/playClock.ts#isCleanRun과 같은 정의 — Playwright 로더가 그 모듈의 JSON 가져오기를 읽지 못해 여기서 다시 쓴다 */, note };
  }

  const a = await finish('card');
  const b = await finish('tool');
  expect(a.game.phase, '엔딩까지 갔다').toBe('ending');
  expect(JSON.stringify(a.game), '상태 전체(play 제외)가 같다').toBe(JSON.stringify(b.game));
  expect(a.autoUsed, '자동 모드로 보낸 시간이 쌓였다(카드 버튼)').toBeGreaterThan(0);
  expect(b.autoUsed, '자동 모드로 보낸 시간이 쌓였다(도구 줄)').toBeGreaterThan(0);
  expect(a.clean, '깨끗하지 않은 판(카드 버튼)').toBe(false);
  expect(b.clean, '깨끗하지 않은 판(도구 줄)').toBe(false);
  expect(a.note, '엔딩 보조 문장(시간 숫자 제외)이 같다').toBe(b.note);
  expect(a.note, '자동 모드를 쓴 판의 보조 문장(깨끗하지 않은 판)이 들어 있다').toContain('배속이나 자동 모드, 「다음 결정으로」를 쓴 판이라'); // data/endingText.ts#PLAYTIME_TEXT.notClean의 앞머리(그 모듈은 Playwright 로더가 못 읽는 JSON 가져오기를 끌어와 글자로 적는다)
});

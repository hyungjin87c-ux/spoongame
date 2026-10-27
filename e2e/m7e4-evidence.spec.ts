import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, startPageHidden } from './helpers';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { setRootFontPercent } from './textResize';

/**
 * M7e-4 증거 화면과 단언 (QA-003-M7e FAIL T03a·T03b·L02, R-379, planner content-M7e.md 10절):
 *  - `youth-housing` 결정 카드: 독립 판은 「부모님 집으로 돌아간다」(return)가 보이고 「부모님 집에 머문다」(parents)는 없다 / 가족 집 판은 그 반대 / 독립 판에서 「혼자 먹는 저녁」을 겪었으면 둘 다 없다 (F-1)
 *  - 부모님과 한집에 사는 미혼 판의 인생 기록에는 「혼자 맞는 명절」이 없다 (T03b)
 *  - 고친 라벨 두 개(「무리를 해서라도 뒷받침한다」·「무리를 해서라도 다녀온다」)가 320×568 · 글자 200%에서 낱말 중간에서 끊기지 않는다 (L02, 모든 라벨의 감사는 e2e/m7e4-labels.spec.ts)
 *  - 「따로 살기로 한다」를 고르면 인생 기록에 「따로 꾸리는 살림」 결과가 남는다 (R-379)
 * 증거: qa/screenshots/003/dev-M7e-4-*.png. 모두 mobile-360에서만 돈다.
 */

const SHOT = 'qa/screenshots/003/dev-M7e-4';
// 자동 모드 켜짐 = 비모달 인라인 카드(M7b) — 가려진 탭이라 자동 선택은 일어나지 않고, 카드 전체가 문서 안에 놓여 낱말·접근성 이름 측정이 모두 본다 (이름은 예전 그대로)
const MANUAL = { speed: 1, autoMode: true } as const;

/** 「살 곳을 구하는 일」이 결정을 기다리는 판 중 보이는 선택지가 조건에 맞는 것을 찾는다 (앱 페이지가 열려 있어야 한다) */
async function findHousing(page: Page, kind: 'independent' | 'family' | 'lonely'): Promise<{ state: GameState; visible: string[] }> {
  const found = await evalCore<{ state: GameState; visible: string[] } | null>(
    page,
    `const { EVENT_POOL } = await import('/src/data/events/index.ts');
     const ev = EVENT_POOL.byId.get('youth-housing');
     for (let seed = 1; seed < 4000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       if (arg.kind === 'family' && s.character.parentWealth < 3) continue;
       if (arg.kind !== 'family' && s.character.parentWealth > 2) continue;
       for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === 'youth-housing') {
           const visible = core.visibleChoices(ev, core.condContextOf(s)).map((c) => c.id);
           const lonely = s.flags.includes('lives_alone');
           const ok = arg.kind === 'family' ? visible.includes('parents') : arg.kind === 'independent' ? visible.includes('return') && !lonely : lonely && !visible.includes('return');
           if (ok) return { state: s, visible };
           break;
         }
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { kind },
  );
  expect(found, `${kind}: 「살 곳을 구하는 일」 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

const labelsOf = async (page: Page): Promise<string[]> => page.locator('[data-testid="choice-panel"] .choice__label').allInnerTexts();

test('T03a: 독립 판의 「살 곳을 구하는 일」에는 「부모님 집으로 돌아간다」가 보이고 「부모님 집에 머문다」는 없다 — 가족 집 판은 그 반대', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await startPageHidden(page);
  await page.goto('/');
  for (const [kind, shot, expected, absent] of [
    ['independent', 'return-card', ['보증금이 낮은 월세방을 구한다', '부모님 집으로 돌아간다', '빚을 내서라도 집을 마련한다'], '부모님 집에 머문다'],
    ['family', 'housing-family-card', ['보증금이 낮은 월세방을 구한다', '부모님 집에 머문다', '빚을 내서라도 집을 마련한다'], '부모님 집으로 돌아간다'],
  ] as const) {
    const { state, visible } = await findHousing(page, kind);
    expect(visible.length, kind).toBe(3);
    await injectSave(page, state, '/', MANUAL);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled();
    await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
    expect(await labelsOf(page), kind).toEqual(expected);
    expect(await labelsOf(page)).not.toContain(absent);
    await expect(page.getByTestId(kind === 'independent' ? 'choice-return' : 'choice-parents')).toBeVisible();
    await expect(page.getByTestId(kind === 'independent' ? 'choice-parents' : 'choice-return')).toHaveCount(0);
    await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-${shot}.png` });
  }
  // 「혼자 먹는 저녁」을 겪은 독립 판(F-1): return도 숨김 — 선택지는 둘
  const lonely = await findHousing(page, 'lonely');
  expect(lonely.visible).toEqual(['rent', 'loan']);
  await injectSave(page, lonely.state, '/', MANUAL);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  expect(await labelsOf(page)).toEqual(['보증금이 낮은 월세방을 구한다', '빚을 내서라도 집을 마련한다']);
});

test('T03a: 「부모님 집으로 돌아간다」를 고르면 인생 기록에 결과가 남고 이후 주거가 가족 집이다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await startPageHidden(page);
  await page.goto('/');
  const { state } = await findHousing(page, 'independent');
  await injectSave(page, state, '/', MANUAL);
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('choice-return').click();
  const log = page.getByTestId('log');
  await expect(log).toContainText('짐을 싸 부모님 집으로 돌아갔습니다.');
  await expect(log).toContainText('독립은 한 걸음 물러섰습니다.');
  await expect(log).toContainText('선택: 부모님 집으로 돌아간다');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await log.scrollIntoViewIfNeeded();
  await log.screenshot({ path: `${SHOT}-return-log.png` });
});

test('T03b: 부모님과 한집에 사는 미혼 판(가족 집)의 인생 기록에는 「혼자 맞는 명절」이 없다 — 61세까지 가족 집·미혼으로 산 판 (판을 미리 거르지 않는다)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await startPageHidden(page);
  await page.goto('/');
  const state = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 6000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       let n = 0;
       for (let guard = 0; guard < 4000 && s.phase === 'life'; guard++) {
         if (s.age >= 61 && s.pending === null) break;
         if (s.pending !== null) {
           const ids = s.pending.choiceIds;
           // 가족 집에 남는 길(부모님 집에 머문다)을 고르고, 결혼·독립으로 가는 선택은 피한다(마지막 선택지 우선)
           const pick = s.pending.eventId === 'youth-housing' && ids.includes('parents') ? 'parents' : ids[(seed + n++) % ids.length];
           s = core.resolveChoice(s, s.pending.key, pick);
         } else s = core.stepYear(s).state;
       }
       if (s.phase !== 'life' || s.age < 61 || s.assets === null) continue;
       if (s.flags.includes('married') || s.assets.dwelling !== 'family' || !s.flags.includes('lives_with_parents')) continue;
       // 이 해들에 「혼자 맞는 명절」 후보 나이(42~60)를 가족 집·미혼으로 지난 첫 판을 고른다 — 그 이벤트를 겪은 판을 미리 건너뛰지 않는다(REV-003-M7e-2 R-387): 조건이 고장 나 사건이 일어나면 아래 단언이 실패한다
       return s;
     }
     return null;`,
  );
  expect(state, '61세까지 가족 집·미혼으로 산 판을 찾지 못했다').not.toBeNull();
  expect(state!.assets!.dwelling).toBe('family');
  expect(state!.flags).not.toContain('married');
  // 실제 단언: 42~60세를 가족 집·미혼으로 지났는데 「혼자 맞는 명절」이 일어난 적이 없다 (탐색이 그런 판을 버리지 않으므로 조건이 고장 나면 여기서 실패한다)
  expect(state!.seen['middle-lonely-holiday'], '가족 집·미혼으로 42~60세를 지난 판에 「혼자 맞는 명절」이 일어났다').toBeUndefined();
  expect(state!.history.filter((h) => (h.text ?? '').includes('혼자 명절')).map((h) => `${h.age}세 ${h.text}`), '연표에 「혼자 명절」').toEqual([]);
  await injectSave(page, state!, '/', MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  const log = page.getByTestId('log');
  await expect(log).not.toContainText('혼자 명절');
  await expect(log).not.toContainText('혼자 맞는 명절');
  // 인생 기록의 40~60대 줄을 보인다
  const rows = page.locator('[data-testid="log-row"]');
  expect(await rows.count()).toBeGreaterThan(20);
  const mid = rows.filter({ hasText: /^(4[2-9]|5\d|60)세/ }).first();
  if ((await mid.count()) > 0) await mid.scrollIntoViewIfNeeded();
  await log.screenshot({ path: `${SHOT}-family-no-holiday.png` });
  // 같은 나이에 독립한(월세) 판은 이 이벤트를 만날 수 있다는 것은 tests/m7eContent.test.ts(3개 시대 × 1000판)가 본다
});

test('L02: 고친 라벨 「무리를 해서라도 뒷받침한다」·「무리를 해서라도 다녀온다」가 320×568 · 글자 200%에서 낱말 중간에서 끊기지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
  await setRootFontPercent(page, 200);
  for (const [id, label, shot] of [
    ['middle-child-school', '무리를 해서라도 뒷받침한다', 'label-child-school-320-200'],
    ['senior-travel', '무리를 해서라도 다녀온다', 'label-travel-320-200'],
  ] as const) {
    await page.evaluate((x) => (window as unknown as { __layout: { show: (id: string) => void } }).__layout.show(x), id);
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
    const label2 = page.locator('.choice__label', { hasText: label });
    await expect(label2).toHaveCount(1);
    // 낱말 「해서라도」·「뒷받침한다」·「다녀온다」가 한 줄에 온전히 놓인다 — 공통 낱말 끊김 감사기로 결함 끊김 0, 한 줄보다 긴 낱말 0
    const words = await measureWordBreaks(page, { scope: '[data-testid="choice-panel"]', categories: { label: '.choice__label' } });
    expect(words.categories.label, '라벨 낱말을 쟀다').toBeGreaterThan(5);
    expect(words.broken.map(describeWordBreak), `${id}: 낱말 끊김`).toEqual([]);
    expect(words.unavoidable.map(describeWordBreak), `${id}: 한 줄보다 긴 낱말`).toEqual([]);
    await expect(label2.locator('xpath=ancestor-or-self::*[contains(@class, "choice")][1]')).toContainText(label);
    await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
    await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
    await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-${shot}.png` });
  }
});

test('R-379: 「따로 살기로 한다」를 고르면 인생 기록에 「따로 꾸리는 살림」 결과가 남는다 (상태를 단정하는 「홀로」 없음)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 360, height: 740 });
  await startPageHidden(page);
  await page.goto('/');
  const state = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 8000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === 'middle-marriage-crisis' && s.pending.choiceIds.includes('apart')) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
  );
  expect(state, '「서먹해진 식탁」 결정을 기다리는 판을 찾지 못했다').not.toBeNull();
  await injectSave(page, state!, '/', MANUAL);
  await expect(page.getByTestId('auto')).toBeEnabled();
  await page.getByTestId('choice-apart').click();
  const log = page.getByTestId('log');
  await expect(log).toContainText('따로 꾸리는 살림은 가벼워졌고, 오랜 긴장도 풀렸습니다.');
  await expect(log).not.toContainText('홀로 꾸리는');
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await log.scrollIntoViewIfNeeded();
  await log.screenshot({ path: `${SHOT}-apart-result.png` });
});

test('C20: 부모 임종 카드의 「일가친척과 의논해 치른다」 — 한글·공백뿐이라 접근성 이름에 기호가 없고, 360×740에서 한 줄이며 320×568 · 글자 200%에서도 낱말이 끊기지 않는다 (QA-003-M7e 2회차)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  const label = '일가친척과 의논해 치른다';
  const frames = (): Promise<void> => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  const show = async (): Promise<void> => {
    await page.goto('/harness/layout.html');
    await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
  };
  // 360×740 · 글자 100%: 라벨이 한 줄이고 카드가 진행 줄 위에 온전히 들어온다
  await page.setViewportSize({ width: 360, height: 740 });
  await show();
  await page.evaluate(() => (window as unknown as { __layout: { show: (id: string) => void } }).__layout.show('middle-parents-farewell'));
  await frames();
  const el = page.locator('.choice__label', { hasText: label });
  await expect(el).toHaveCount(1);
  const lineHeight = await el.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
  const height = await el.evaluate((e) => e.getBoundingClientRect().height);
  expect(height, `라벨 높이 ${height}px / 한 줄 ${lineHeight}px — 한 줄이다`).toBeLessThan(lineHeight * 1.5);
  // 접근성 이름: 선택지 이름 + 영향 문장, 기호(가운뎃점 등)가 없다
  const button = page.getByRole('button', { name: new RegExp(`^${label}`) });
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAccessibleName(/^일가친척과 의논해 치른다 /);
  // 모든 선택지 버튼의 접근성 이름(브라우저가 계산한 이름)에 가운뎃점·세모 기호가 없다 — 눈에 보이는 영향 줄의 기호는 aria-hidden이라 이름에 들지 않는다
  const buttons = await page.locator('[data-testid="choice-panel"] button.choice').all();
  expect(buttons.length).toBe(3);
  for (const b of buttons) await expect(b).toHaveAccessibleName(/^[^·▲▼]+$/);
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-farewell-share-label-360.png` });

  // 320×568 · 글자 200%: 낱말(일가친척과·의논해·치른다)이 중간에서 끊기지 않는다
  await page.setViewportSize({ width: 320, height: 568 });
  await show();
  await setRootFontPercent(page, 200);
  await page.evaluate(() => (window as unknown as { __layout: { show: (id: string) => void } }).__layout.show('middle-parents-farewell'));
  await frames();
  const words = await measureWordBreaks(page, { scope: '[data-testid="choice-panel"]', categories: { label: '.choice__label' } });
  expect(words.categories.label, '라벨 낱말을 쟀다').toBeGreaterThan(5);
  expect(words.broken.map(describeWordBreak), '낱말 끊김').toEqual([]);
  expect(words.unavoidable.map(describeWordBreak), '한 줄보다 긴 낱말').toEqual([]);
  await expect(page.locator('.choice__label', { hasText: label })).toHaveCount(1);
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
  await page.getByTestId('choice-panel').scrollIntoViewIfNeeded();
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOT}-farewell-share-label-320-200.png` });
});

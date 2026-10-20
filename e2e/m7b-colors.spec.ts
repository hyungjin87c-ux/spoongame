import { expect, test, type Page } from '@playwright/test';
import { CARD_UI_STATES, openCardIn, startHidden, type CardUiState } from './m7bCards';
import { findCardState } from './m7bStates';
import { findDelegatedYear, showParentCard } from './parentStates';
import { measureRenderedContrast } from './renderedContrast';

/**
 * 중대 결정 카드의 색 (SPEC-003 CM4, DS3, QM3-5, 완료 기준 17⑤ — M7b 마일스톤의 완료 조건, content-M7b 7절).
 * 라이트·다크·수동 다크(OS 라이트)·수동 라이트(OS 다크)·강제 색상(라이트·다크) 6조합 × 카드 3상태(모달 시트 · 접힌 띠 · 인라인 카드) × 통계 인용 카드·연구 인용 카드:
 *  - 글자를 품은 모든 색 바탕 상자(인용 박스의 쪽빛 면 + 놋쇠 막대, 시트, 인라인 카드, 접힌 띠, 선택지, 접기 버튼)를 요소 스크린샷으로 떠서 글자 자리의 **렌더 픽셀** 명도 대비가 4.5:1 이상 (e2e/renderedContrast.ts).
 *    모달 시트 뒤(`[inert]`)의 바깥은 스크림에 어두워져 읽는 글자가 아니라 재지 않는다(diff-003.md D-59).
 *  - 인용 박스(`.cite`)와 접힌 띠(`.fold`)가 잰 상자에 실제로 들었다(공허 통과 방지).
 *  - 강제 색상: 인용 박스가 Canvas 바탕 + CanvasText 글자·막대이고, 시트는 CanvasText 테두리로 가려진다(스크림이 투명이므로).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

// 픽셀로 글자 색을 읽는 측정은 LCD 글자 가장자리 번짐에 약하다 — 회색조 글자 렌더로 열고 3배 화소로 뜬다 (e2e/m4-colors.spec.ts와 같다)
test.use({ launchOptions: { args: ['--disable-lcd-text'] }, deviceScaleFactor: 3 });

type Combo = 'light' | 'dark' | 'manual-dark' | 'manual-light' | 'forced-light' | 'forced-dark';
const COMBOS: readonly Combo[] = ['light', 'dark', 'manual-dark', 'manual-light', 'forced-light', 'forced-dark'];
// SPEC-005 QI5: 사람이 고르는 카드(시트·접힌 띠·인라인)는 통계 인용이 붙은 youth-startup(예전 school-tutoring)으로, 「연구」 인용이 붙는 카드(infant-new-sibling)는
// 이제 아이의 일로 흘러간 비모달 카드라 아래 별도 묶음(`부모님이 정한·흘러간 카드`)에서 색을 잰다.
const CARDS = [{ id: 'youth-startup', era: 'present' as const, kind: '통계' }];

async function applyCombo(page: Page, combo: Combo): Promise<void> {
  const forced = combo.startsWith('forced');
  const scheme = combo === 'dark' || combo === 'manual-light' || combo === 'forced-dark' ? 'dark' : 'light';
  await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
}

/** 고정 요소가 다른 상자를 가리지 않게 흐름 안에 둔다(대비는 색의 문제이고 위치와 무관하다). 모달 시트의 스크림·시트는 그대로 둔다 */
async function flowFixedElements(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
}

for (const combo of COMBOS) {
  for (const ui of CARD_UI_STATES) {
    for (const card of CARDS) {
      test(`${combo} · ${ui} · ${card.id}(${card.kind} 인용): 글자를 품은 모든 색 바탕 상자의 렌더 픽셀 대비가 4.5:1 이상이다 (QM3-5, 17⑤)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 360, height: 740 });
        await applyCombo(page, combo);
        await startHidden(page);
        const state = await findCardState(page, card.id, card.era);
        await openCardIn(page, state, ui);
        if (combo === 'manual-dark' || combo === 'manual-light') {
          const theme = combo === 'manual-dark' ? 'dark' : 'light';
          await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        }
        await flowFixedElements(page);
        // 입력 가드(0.4초, 과도 상태)가 풀린 뒤에 잰다 — 지속 비활성(data-unavailable)은 면제 없이 잰다
        await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
        let report = await measureRenderedContrast(page, { min: 4.5 });
        if (ui === 'sheet') {
          // 시트는 안쪽 스크롤 영역이라 스크롤 밖 글자는 잴 수 없다 — 맨 위와 맨 아래 두 자리에서 재서 합친다
          await page.evaluate(() => {
            const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
            sheet.scrollTop = sheet.scrollHeight;
          });
          const bottom = await measureRenderedContrast(page, { min: 4.5 });
          report = { ...report, texts: report.texts + bottom.texts, low: [...report.low, ...bottom.low], min: Math.min(report.min, bottom.min), measured: [...report.measured, ...bottom.measured] };
        }
        expect(report.low, `가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
        expect(report.texts, '잰 글자 수').toBeGreaterThan(ui === 'folded' ? 8 : 12);
        expectMeasured(report.measured, ui);
        testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1` });
      });
    }
  }
}

// SPEC-005 QI5: 「연구」 인용 박스(CitationBox)가 붙는 카드는 아이의 일로 흘러간 비모달 카드다 — 같은 인용 박스 부품의 색을 6조합에서 같은 기준(4.5:1)으로 잰다.
for (const combo of COMBOS) {
  test(`${combo} · 아이의 일로 흘러간 카드 · infant-new-sibling(연구 인용): 칩·제목·고른 길·도장·영향 줄·인용 박스의 렌더 픽셀 대비가 4.5:1 이상이다 (QM3-5, PD8)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await applyCombo(page, combo);
    await page.goto('/');
    const y = await findDelegatedYear(page, { eventId: 'infant-new-sibling', by: 'child', firstBorn: true });
    await showParentCard(page, y);
    if (combo === 'manual-dark' || combo === 'manual-light') {
      const theme = combo === 'manual-dark' ? 'dark' : 'light';
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    }
    await flowFixedElements(page);
    const report = await measureRenderedContrast(page, { min: 4.5 });
    expect(report.low, `가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
    expect(report.texts, '잰 글자 수').toBeGreaterThan(12);
    expect(report.measured.some((m) => m.startsWith('div.cite')), '인용 박스(쪽빛 면) 글자').toBe(true);
    expect(report.measured.some((m) => m.startsWith('section.card#parent-card|아이의 일')), '카드 칩 글자').toBe(true);
    expect(report.measured.some((m) => m.startsWith('section.card#parent-card|이렇게 흘러갔습니다')), '카드 도장 글자').toBe(true);
    testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1` });
  });
}

/** 공허 통과 방지: 이 상태에서 반드시 재야 하는 상자의 글자가 실제로 들었다 */
function expectMeasured(measured: string[], ui: CardUiState): void {
  const has = (prefix: string) => measured.some((m) => m.startsWith(prefix));
  if (ui === 'folded') {
    expect(has('section.card#decision-fold|') || has('section.card.fold#decision-fold|'), '접힌 띠 글자').toBe(true);
    expect(has('button.btn.btn--secondary#decision-reopen|') || has('button.btn#decision-reopen|'), '「결정 다시 열기」 글자').toBe(true);
    return;
  }
  expect(measured.some((m) => m.startsWith('div.cite')), '인용 박스(쪽빛 면) 글자').toBe(true);
  expect(measured.some((m) => /^button\.choice/.test(m)), '선택지 버튼 글자').toBe(true);
  // 「카드 접기」는 바탕이 투명한 고스트 버튼이라 가장 가까운 색 바탕 상자(카드·시트)의 글자로 잰다
  expect(measured.some((m) => m.endsWith('|카드 접기')), '「카드 접기」 글자').toBe(true);
  expect(measured.some((m) => /^(div|section)\.(sheet|card)/.test(m)), ui === 'sheet' ? '시트 글자' : '인라인 카드 글자').toBe(true);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`강제 색상(${scheme}): 인용 박스는 Canvas 바탕 + CanvasText 글자·막대, 시트는 CanvasText 테두리, 접힌 띠·인라인 카드는 CanvasText 테두리다 (스크림이 투명이라 테두리가 시트를 가른다)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), '강제 색상 모드').toBe(true);
    await startHidden(page);
    const state = await findCardState(page, 'youth-startup');
    const probe = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, borderLeft: cs.borderLeftColor, borderWidth: cs.borderTopWidth, left: cs.borderLeftWidth };
      }, selector);
    await openCardIn(page, state, 'sheet');
    const cite = await probe('.cite');
    const sheet = await probe('[role="dialog"]');
    const canvas = await page.evaluate(() => {
      const probeEl = document.createElement('div');
      probeEl.style.cssText = 'background-color: Canvas; color: CanvasText; border: 1px solid CanvasText';
      document.body.appendChild(probeEl);
      const cs = getComputedStyle(probeEl);
      const out = { bg: cs.backgroundColor, text: cs.color };
      probeEl.remove();
      return out;
    });
    expect(cite.bg, '인용 박스 바탕 = Canvas').toBe(canvas.bg);
    expect(cite.color, '인용 박스 글자 = CanvasText').toBe(canvas.text);
    expect(cite.borderLeft, '인용 박스 막대 = CanvasText').toBe(canvas.text);
    expect(parseFloat(cite.left), '막대 두께 5px').toBe(5);
    expect(sheet.border, '시트 테두리 = CanvasText').toBe(canvas.text);
    expect(parseFloat(sheet.borderWidth)).toBeGreaterThanOrEqual(1);
    await openCardIn(page, state, 'inline');
    expect((await probe('[data-testid="choice-panel"]')).border, '인라인 카드 테두리 = CanvasText').toBe(canvas.text);
    await openCardIn(page, state, 'folded');
    expect((await probe('[data-testid="decision-fold"]')).borderLeft, '접힌 띠 막대 = CanvasText').toBe(canvas.text);
  });
}

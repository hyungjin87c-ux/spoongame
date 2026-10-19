import { expect, test, type Page } from '@playwright/test';
import { injectSave } from './helpers';
import { settleDash } from './m4Fixed';
import { endedWithLongNotes, lifeWithLongNotes, openNoteIn, startNoteHidden, type NoteUi } from './m7cSheets';
import { measureRenderedContrast } from './renderedContrast';

/**
 * 기록 시트와 「나의 기록」 줄의 색 (SPEC-003 CM4, DS3, QM3-5, content-M7c 6-4절 17⑤ — M7c 마일스톤의 완료 조건).
 * 라이트·다크·수동 다크(OS 라이트)·수동 라이트(OS 다크)·강제 색상(라이트·다크) 6조합 × 시트 3상태(열림 · 확인 단계 · 40개 안내) + 인생 기록 줄 + 엔딩 연표 줄:
 *  - 글자를 품은 모든 색 바탕 상자(시트·인용 박스의 쪽빛 면 + 놋쇠 막대·입력란 테두리 안 글자 수·오류 문장·두 버튼·확인 상자·끄기 칸·나의 기록 줄의 놓음빛 면 + 막대)를 요소 스크린샷으로 떠서
 *    글자 자리의 **렌더 픽셀** 대비가 4.5:1 이상이다(e2e/renderedContrast.ts). 사용자 글(data-user-text)도 잰다 — 색 감사는 글을 빼지 않는다(D-80은 낱말 끊김 감사에서만 뺀다).
 *  - 강제 색상: 입력란 테두리·확인 상자·나의 기록 줄·연표 note 행이 CanvasText 테두리·막대라 색 없이도 구분되고, 빈 입력 오류의 입력란은 색 대신 이중 테두리(double 4px)다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다. 스크린샷은 qa/screenshots/003/dev-M7c-colors-*.png.
 */

// 픽셀로 글자 색을 읽는 측정은 LCD 글자 가장자리 번짐에 약하다 — 회색조 글자 렌더로 열고 3배 화소로 뜬다 (e2e/m7b-colors.spec.ts와 같다)
test.use({ launchOptions: { args: ['--disable-lcd-text'] }, deviceScaleFactor: 3 });

const SHOTS = 'qa/screenshots/003';
type Combo = 'light' | 'dark' | 'manual-dark' | 'manual-light' | 'forced-light' | 'forced-dark';
const COMBOS: readonly Combo[] = ['light', 'dark', 'manual-dark', 'manual-light', 'forced-light', 'forced-dark'];
const NOTE_STATES: readonly NoteUi[] = ['open', 'confirm', 'limit'];

async function applyCombo(page: Page, combo: Combo): Promise<void> {
  const forced = combo.startsWith('forced');
  const scheme = combo === 'dark' || combo === 'manual-light' || combo === 'forced-dark' ? 'dark' : 'light';
  await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
}
async function applyManualTheme(page: Page, combo: Combo): Promise<void> {
  if (combo === 'manual-dark' || combo === 'manual-light') await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), combo === 'manual-dark' ? 'dark' : 'light');
}

/** 고정 요소가 다른 상자를 가리지 않게 흐름 안에 둔다(대비는 색의 문제이고 위치와 무관하다) */
async function flowFixedElements(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
}

for (const combo of COMBOS) {
  for (const ui of NOTE_STATES) {
    test(`${combo} · ${ui}: 글자를 품은 모든 색 바탕 상자의 렌더 픽셀 대비가 4.5:1 이상이다 (QM3-5, 17⑤)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 360, height: 740 });
      await applyCombo(page, combo);
      await startNoteHidden(page);
      await openNoteIn(page, ui);
      await applyManualTheme(page, combo);
      await flowFixedElements(page);
      // 빈 입력 오류의 문장 색(빨강 계열)도 잰다: 열림 상태에서 비운 채 1번을 눌러 오류를 띄운다
      if (ui === 'open') {
        await page.getByTestId('note-save').click();
        await expect(page.locator('[data-testid="note-msg"]')).toContainText('적을 말이 없다면');
        await expect(page.getByTestId('note-input')).toHaveAttribute('aria-invalid', 'true');
        await page.getByTestId('note-input').fill('쓰다 만 글');
        await page.getByTestId('note-input').evaluate((el) => (el as HTMLElement).blur());
      }
      await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
      // 시트는 안쪽 스크롤 영역이라 스크롤 밖 글자는 잴 수 없다 — 맨 위와 맨 아래 두 자리에서 재서 합친다
      let report = await measureRenderedContrast(page, { min: 4.5 });
      await page.evaluate(() => {
        const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
        sheet.scrollTop = sheet.scrollHeight;
      });
      const bottom = await measureRenderedContrast(page, { min: 4.5 });
      report = { ...report, texts: report.texts + bottom.texts, low: [...report.low, ...bottom.low], min: Math.min(report.min, bottom.min), measured: [...report.measured, ...bottom.measured] };
      expect(report.low, `가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
      expect(report.texts, '잰 글자 수').toBeGreaterThan(ui === 'limit' ? 6 : 14);
      const has = (re: RegExp) => report.measured.some((m) => re.test(m));
      expect(has(/^(div|section)\.sheet/), '시트 글자').toBe(true);
      if (ui === 'open') {
        expect(has(/^div\.cite/), '인용 박스(쪽빛 면) 글자').toBe(true);
        expect(has(/^button\.note-choice/), '두 버튼 글자').toBe(true);
        expect(report.measured.some((m) => m.includes('|저절로 뜨는')), '끄기 칸 글자').toBe(true);
      } else if (ui === 'confirm') {
        expect(report.measured.some((m) => m.includes('|글을 지우고')) && report.measured.some((m) => m.includes('|돌아가서 이어')), '확인 단계 두 버튼 글자').toBe(true);
      } else {
        expect(report.measured.some((m) => m.includes('|닫기')), '「닫기」 글자').toBe(true);
      }
      // 증거 샷은 맨 위에서 찍는다(R-410) — 위에서 아래 대비를 재려고 시트를 맨 아래로 내렸으므로 되돌린다. 아래쪽 장면을 보려면 -bottom을 붙여 따로 찍는다
      await page.evaluate(() => {
        (document.querySelector('[role="dialog"]') as HTMLElement).scrollTop = 0;
      });
      await page.screenshot({ path: `${SHOTS}/dev-M7c-colors-${combo}-${ui}.png` });
      testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1` });
    });
  }

  test(`${combo} · 「나의 기록」 줄(인생 기록·엔딩 연표, 긴 글·방향 글 포함): 놋쇠 면 위 글자 대비가 4.5:1 이상이다 (QM3-5, 17⑤)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await applyCombo(page, combo);
    await startNoteHidden(page);
    // 인생 기록 줄
    const life = await lifeWithLongNotes(page);
    await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await applyManualTheme(page, combo);
    await flowFixedElements(page);
    await page.addStyleTag({ content: '.log__list { max-height: none !important; overflow: visible !important; }' }); // 다섯 줄이 모두 보이게
    await settleDash(page);
    const lifeReport = await measureRenderedContrast(page, { min: 4.5 });
    expect(lifeReport.low, `인생 기록: 가장 낮은 대비 ${lifeReport.min.toFixed(2)}:1`).toEqual([]);
    expect(lifeReport.measured.some((m) => m.startsWith('li.log__row#log-row|나의 기록')), '나의 기록 줄(놋쇠 면)의 라벨 글자를 쟀다').toBe(true);
    expect(lifeReport.measured.filter((m) => m.startsWith('li.log__row#log-row|') && (m.includes('|https') || m.includes('|가가가') || m.includes('|xxxx'))).length, '사용자 글(긴 글·URL)의 글자도 쟀다').toBeGreaterThan(0);
    await page.getByTestId('log').screenshot({ path: `${SHOTS}/dev-M7c-colors-${combo}-log-rows.png` });
    // 엔딩 연표 줄
    const ended = await endedWithLongNotes(page);
    await injectSave(page, ended, '/', { speed: 1, autoMode: false, noteCards: false });
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await applyManualTheme(page, combo);
    await flowFixedElements(page);
    await expect(page.locator('.timeline li.is-note').first()).toBeVisible();
    const endReport = await measureRenderedContrast(page, { min: 4.5 });
    expect(endReport.low, `엔딩 연표: 가장 낮은 대비 ${endReport.min.toFixed(2)}:1`).toEqual([]);
    expect(endReport.measured.some((m) => m.includes('|나의 기록')), '연표 note 행의 라벨 글자를 쟀다').toBe(true);
    await page.locator('.timeline li.is-note').first().scrollIntoViewIfNeeded();
    await page.locator('.timeline li.is-note').first().screenshot({ path: `${SHOTS}/dev-M7c-colors-${combo}-timeline-row.png` });
    testInfo.annotations.push({ type: '대비', description: `인생 기록 ${lifeReport.boxes}상자 최저 ${lifeReport.min.toFixed(2)}:1 · 엔딩 ${endReport.boxes}상자 최저 ${endReport.min.toFixed(2)}:1` });
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`강제 색상(${scheme}): 입력란 테두리·확인 상자·나의 기록 줄·연표 note 행이 CanvasText 테두리이고, 빈 입력 오류의 입력란은 색 대신 이중 테두리다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), '강제 색상 모드').toBe(true);
    await startNoteHidden(page);
    const probe = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor, borderLeft: cs.borderLeftColor, borderWidth: cs.borderTopWidth, borderStyle: cs.borderTopStyle };
      }, selector);
    const canvas = () =>
      page.evaluate(() => {
        const el = document.createElement('div');
        el.style.cssText = 'background-color: Canvas; color: CanvasText; border: 1px solid CanvasText';
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        const out = { bg: cs.backgroundColor, text: cs.color };
        el.remove();
        return out;
      });
    await openNoteIn(page, 'open');
    const c = await canvas();
    const input = await probe('[data-testid="note-input"]');
    expect(input.border, '입력란 테두리 = CanvasText').toBe(c.text);
    expect(parseFloat(input.borderWidth)).toBeGreaterThanOrEqual(1);
    expect((await probe('.cite')).bg, '인용 박스 바탕 = Canvas').toBe(c.bg);
    expect((await probe('[role="dialog"]')).border, '시트 테두리 = CanvasText').toBe(c.text);
    // 빈 입력 오류: 색이 아니라 이중 테두리 4px
    await page.getByTestId('note-save').click();
    await expect(page.getByTestId('note-input')).toHaveAttribute('aria-invalid', 'true');
    const invalid = await probe('[data-testid="note-input"]');
    expect(invalid.borderStyle, '오류 입력란은 이중 테두리').toBe('double');
    expect(parseFloat(invalid.borderWidth)).toBe(4);
    // 확인 단계 상자
    await page.getByTestId('note-input').fill('글');
    await page.getByTestId('note-skip').click();
    await expect(page.getByTestId('note-confirm')).toBeVisible();
    expect((await probe('[data-testid="note-confirm"]')).border, '확인 상자 테두리 = CanvasText').toBe(c.text);
    // 나의 기록 줄(인생 기록)·연표 note 행
    const life = await lifeWithLongNotes(page);
    await injectSave(page, life, '/', { speed: 1, autoMode: false, noteCards: false });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const row = await probe('.log__row--note');
    expect(row.bg, '나의 기록 줄 바탕 = Canvas').toBe(c.bg);
    expect(row.color, '나의 기록 줄 글자 = CanvasText').toBe(c.text);
    expect(row.border, '나의 기록 줄 테두리 = CanvasText').toBe(c.text);
    const ended = await endedWithLongNotes(page);
    await injectSave(page, ended, '/', { speed: 1, autoMode: false, noteCards: false });
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const tl = await probe('.timeline li.is-note');
    expect(tl.bg, '연표 note 행 바탕 = Canvas').toBe(c.bg);
    expect(tl.borderLeft, '연표 note 행 막대 = CanvasText').toBe(c.text);
  });
}

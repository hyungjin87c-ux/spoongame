import { expect, test, type Page } from '@playwright/test';
import { BIRTH_TEXT } from '../src/data/birthReportText';
import { NO_CONTAINER_QUERIES, WITH_CONTAINER_QUERIES, cssAppliedBy, withoutBlocks } from '../tests/helpers/browserCss';
import { setRootFontPercent } from './textResize';
import { openWordBreakState } from './wordBreakStates';

/**
 * 컨테이너 질의를 모르는 브라우저(Safari 16 미만)의 폴백을 **실제 화면에서** 잰다 (REV-003-M3-4 R-302 ①②, design-system.md 11-6).
 * Playwright의 Chromium은 컨테이너 질의를 알기 때문에, 화면의 `doc.css`를 「그 브라우저가 적용할 CSS」(`tests/helpers/browserCss.ts#cssAppliedBy`)로 바꿔 끼운다:
 * `@container` 블록이 사라지고, `container-type` 선언이 사라지고, `@supports (width: 1cqi)` 안쪽은 건너뛰고 `@supports not (container-type: inline-size)` 안쪽이 올라온다.
 * (규칙 문자열 자체의 단언은 tests/docCssFallback.test.ts가 한다.)
 *
 *  ① 룰렛 제목: 모르는 브라우저에서는 `.t-title` 기본 크기(`--fs-2xl`)다 — 본문 크기(16px)로 떨어지지 않는다. 아는 브라우저에서는 폭 320 · 글자 200%에서 줄 폭 기준 상한이 걸려 그보다 작다
 *     대조: 컨테이너 단위를 모르는 단위(`cqx`)로 바꿔 가드 없이 적으면 제목이 본문 크기로 떨어진다(R-302 ①이 막으려던 모습)
 *  ② 출생신고 비교 표: 모르는 브라우저에서도 뷰포트 < 640px에서 한 행씩 쌓이고(`tr`이 격자), ≥ 640px에서는 표 그대로다. 서류 격자는 ≥ 640px에서 3열, 그 아래는 2열이다
 *     대조: 폴백 블록이 없는 CSS(r4 상태)를 모르는 브라우저로 걸러 보면 휴대폰에서도 비교 표가 쌓이지 않고 넓은 화면의 격자가 2열에 머문다
 * 개발 서버가 `doc.css`를 `<style data-vite-dev-id=…/src/styles/doc.css>`로 심으므로 그 요소의 내용을 바꾼다. 모든 시험이 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

async function readDocCss(): Promise<string> {
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  return fs.readFileSync('src/styles/doc.css', 'utf-8');
}

/** 화면의 doc.css를 주어진 CSS 글자로 바꿔 끼운다 */
async function swapDocCss(page: Page, css: string): Promise<void> {
  await page.evaluate((text) => {
    const el = document.querySelector('style[data-vite-dev-id$="/src/styles/doc.css"]');
    if (el === null) throw new Error('doc.css를 심은 <style>을 찾지 못했다');
    el.textContent = text;
  }, css);
}

/** `--fs-2xl`·`--fs-md`의 계산값(px) — 루트 글자 크기를 따른다 */
async function tokenPx(page: Page, token: string): Promise<number> {
  return page.evaluate((t) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;font-size:var(${t})`;
    document.body.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    return px;
  }, token);
}

const headingPx = (page: Page): Promise<number> => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-testid="roulette-heading"]')!).fontSize));

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
});

test.describe('① 룰렛 제목 글자 크기 (cqi를 모르는 브라우저)', () => {
  test('폭 320 · 글자 200%: 아는 브라우저는 줄 폭 상한으로 줄어든 제목, 모르는 브라우저는 `.t-title` 기본 크기(--fs-2xl) — 본문 크기가 아니다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await openWordBreakState(page, 'roulette-result-3');
    await setRootFontPercent(page, 200);
    const docCss = await readDocCss();
    const fs2xl = await tokenPx(page, '--fs-2xl');
    const body = await tokenPx(page, '--fs-md');
    expect(fs2xl, '글자 200%에서 --fs-2xl은 56px').toBeCloseTo(56, 0);

    await swapDocCss(page, cssAppliedBy(docCss, WITH_CONTAINER_QUERIES));
    const modern = await headingPx(page);
    expect(modern, `아는 브라우저의 제목 ${modern}px는 상한이 걸려 --fs-2xl(${fs2xl}px)보다 작다 (공허 통과 방지: 폴백과 값이 다르다)`).toBeLessThan(fs2xl - 1);
    expect(modern).toBeGreaterThan(body);

    await swapDocCss(page, cssAppliedBy(docCss, NO_CONTAINER_QUERIES));
    const legacy = await headingPx(page);
    expect(legacy, `모르는 브라우저의 제목 ${legacy}px는 --fs-2xl(${fs2xl}px) 그대로다`).toBeCloseTo(fs2xl, 1);
    expect(legacy, '본문 크기로 떨어지지 않는다').toBeGreaterThan(body * 1.5);
  });

  test('폭 360 · 글자 100%: 모르는 브라우저의 제목은 28px(--fs-2xl)이고 본문(16px)보다 크다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'roulette-result-3');
    await swapDocCss(page, cssAppliedBy(await readDocCss(), NO_CONTAINER_QUERIES));
    const legacy = await headingPx(page);
    expect(legacy).toBeCloseTo(28, 1);
    expect(legacy).toBeGreaterThan(await tokenPx(page, '--fs-md'));
  });

  test('대조: 컨테이너 단위 식을 `@supports` 가드 없이(모르는 단위로) 적으면 제목이 본문 크기로 떨어진다 — R-302 ①이 막으려던 모습을 이 측정이 본다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'roulette-result-3');
    const legacy = cssAppliedBy(await readDocCss(), NO_CONTAINER_QUERIES);
    // r4 상태: 식이 가드 밖에 있고 브라우저가 단위를 모른다(= 선언 전체가 무효 → font-size가 unset → 상속한 본문 크기)
    await swapDocCss(page, `${legacy}\n.roulette__lead .t-title { font-size: max(var(--fs-lg), min(var(--fs-2xl), calc(100cqx / var(--title-chars, 8)))); }`);
    const broken = await headingPx(page);
    const body = await tokenPx(page, '--fs-md');
    expect(broken, `가드 없는 식: 제목 ${broken}px`).toBeCloseTo(body, 1);
    expect(broken).toBeLessThan(await tokenPx(page, '--fs-2xl'));
  });
});

/** 비교 표·서류 격자의 모양을 읽는다 */
async function docShape(page: Page): Promise<{ tableDisplay: string; rowDisplay: string; headClip: boolean; gridColumns: number; cellLabelBefore: string }> {
  return page.evaluate(() => {
    const table = document.querySelector('[data-testid="compare-table"]')!;
    const row = table.querySelector('tbody tr')!;
    const head = table.querySelector('thead')!;
    const grid = document.querySelector('[data-testid="birth-grid"]')!;
    const headCs = getComputedStyle(head);
    const cell = row.querySelector('td')!;
    return {
      tableDisplay: getComputedStyle(table).display,
      rowDisplay: getComputedStyle(row).display,
      headClip: headCs.position === 'absolute' && parseFloat(headCs.width) <= 1,
      gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter((c) => c !== '').length,
      cellLabelBefore: getComputedStyle(cell, '::before').content,
    };
  });
}

test.describe('② 출생신고 비교 표·서류 격자 (컨테이너 질의를 모르는 브라우저)', () => {
  test('폭 360(< 640px): 모르는 브라우저에서도 비교 표가 한 행씩 쌓이고(tr 격자·머리글 가림·칸 이름표), 서류는 2열이다 — 아는 브라우저와 같은 모양', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'birth');
    const docCss = await readDocCss();
    await swapDocCss(page, cssAppliedBy(docCss, WITH_CONTAINER_QUERIES));
    const modern = await docShape(page);
    await swapDocCss(page, cssAppliedBy(docCss, NO_CONTAINER_QUERIES));
    const legacy = await docShape(page);
    expect(legacy, '모르는 브라우저(폴백)').toEqual({ tableDisplay: 'block', rowDisplay: 'grid', headClip: true, gridColumns: 2, cellLabelBefore: `"${BIRTH_TEXT.compareColAll}"` });
    expect(legacy, '폴백이 아는 브라우저의 모양과 같다(쌓기·2열)').toEqual(modern);
  });

  test('폭 1024(≥ 640px, 글자 100%): 모르는 브라우저에서도 비교 표는 표 그대로이고 서류 격자는 3열이다', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openWordBreakState(page, 'birth');
    const docCss = await readDocCss();
    await swapDocCss(page, cssAppliedBy(docCss, WITH_CONTAINER_QUERIES));
    const modern = await docShape(page);
    await swapDocCss(page, cssAppliedBy(docCss, NO_CONTAINER_QUERIES));
    const legacy = await docShape(page);
    expect(legacy.tableDisplay).toBe('table');
    expect(legacy.rowDisplay).toBe('table-row');
    expect(legacy.gridColumns, '서류 격자 3열').toBe(3);
    expect(legacy, '아는 브라우저와 같은 모양').toEqual(modern);
  });

  test('대조(r4 상태): 폴백 블록이 없는 CSS를 모르는 브라우저로 걸러 보면 휴대폰에서도 비교 표가 쌓이지 않고 넓은 화면의 서류 격자가 2열에 머문다 — 이 측정이 퇴행을 본다', async ({ page }) => {
    const docCss = await readDocCss();
    const r4 = cssAppliedBy(withoutBlocks(docCss, '@supports not (container-type: inline-size)'), NO_CONTAINER_QUERIES);

    await page.setViewportSize({ width: 360, height: 740 });
    await openWordBreakState(page, 'birth');
    await swapDocCss(page, r4);
    const phone = await docShape(page);
    expect(phone.tableDisplay, '휴대폰인데 비교 표가 표 그대로').toBe('table');
    expect(phone.headClip).toBe(false);

    await page.setViewportSize({ width: 1024, height: 768 });
    await swapDocCss(page, r4);
    const wide = await docShape(page);
    expect(wide.gridColumns, '넓은 화면인데 서류 격자가 2열').toBe(2);
  });
});

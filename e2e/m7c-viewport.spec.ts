import { expect, test, type Page } from '@playwright/test';
import { injectSave, settle, startPageHidden } from './helpers';
import { infantDue, sheetReady, teenDue } from './m7cStates';
import { setRootFontPercent } from './textResize';

/**
 * 가상 키보드와 기록 시트 (SPEC-003 M7c K1~K7, content-M7c 6-1절, D-71·D-72; 잠정값 NC-14 — 실기기 확인(M9) 뒤 조정). Playwright는 실제 가상 키보드를 띄우지 못하므로
 * `addInitScript`로 `window.visualViewport`를 높이·`offsetTop`을 바꿀 수 있는 가짜(`EventTarget`)로 바꾸고 `resize`·`scroll`을 일으켜 본다.
 *  K1 시트 바탕(.overlay)이 보이는 영역(--vv-top·--vv-h)에 맞고 시트 max-height가 그 안이다.
 *  K2 compact는 **고정 문턱이 아니라 「전체 시트가 보이는 영역에 들어가는가」**다(마스터 결정 2026-10-19): 입력 영역에 포커스가 있고 전체 시트(인용 박스·보조 설명 포함)가 최대 높이에 안 들어갈 때만
 *     인용 박스·두 버튼의 보조 설명을 숨긴다. 예전 고정 문턱 520은 인용 박스가 있는 전체 시트(약 616px)가 보이는 높이 520~616에서 두 버튼을 시트 안 스크롤 밖에 두었다.
 *  K3 보이는 높이 340 이상 **전 구간(340~전체 시트 높이 이상)**에서 입력란 전체와 두 버튼이 보이는 영역 안에 함께 보인다 — 인용 있는 카드(①)와 없는 카드(②), 폭 320·360, 글자 100%.
 *     글자 200%는 compact 시트도 한 화면에 안 들어갈 수 있어(K7) 포커스를 가진 입력란은 늘 보이고 두 버튼은 시트 안 스크롤로 닿는다 — 그래도 「compact가 아닌데 시트가 잘리는」 일은 없다.
 *  K4 포커스 때 입력란이 보이는 영역에 놓이고 문서는 안 움직인다. K5 입력란 글자 크기 ≥ 16px. K6 키보드가 내려가면 compact가 풀리고 원래 높이로.
 * 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다. 스크린샷은 qa/screenshots/003/dev-M7c-viewport-*.png.
 */

const SHOTS = 'qa/screenshots/003';
const MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;

async function installFakeVisualViewport(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = new EventTarget();
    const fake = Object.assign(target, { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
    (window as unknown as { __setVV: (h: number, top?: number) => void }).__setVV = (h, top = 0) => {
      fake.height = h;
      fake.offsetTop = top;
      target.dispatchEvent(new Event('resize'));
      target.dispatchEvent(new Event('scroll'));
    };
  });
}
const setVV = (page: Page, height: number, top = 0): Promise<void> => page.evaluate(([h, t]) => (window as unknown as { __setVV: (h: number, t: number) => void }).__setVV(h, t), [height, top] as const);

type Subject = 'cited' | 'plain';

/** cited = 인용 박스가 있는 카드 ①(가장 높은 시트) / plain = 인용 없는 카드 ② */
async function openSheet(page: Page, width: number, percent: number, subject: Subject = 'cited'): Promise<void> {
  await page.setViewportSize({ width, height: 740 });
  await installFakeVisualViewport(page);
  await page.goto('/');
  const due = subject === 'cited' ? await infantDue(page) : await teenDue(page);
  await startPageHidden(page);
  await injectSave(page, due.state, '/', MANUAL);
  await sheetReady(page);
  if (percent !== 100) await setRootFontPercent(page, percent);
}

interface Boxes {
  top: number;
  bottom: number;
}
const boxOf = (page: Page, testId: string): Promise<Boxes> =>
  page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });

/** 보이는 높이를 340부터 키보드 없는 전체 높이까지 쓸어 본다 (전체 시트 높이 약 400~620px 구간을 촘촘히 포함) */
const HEIGHTS = [340, 360, 400, 440, 480, 520, 560, 600, 620, 660, 700, 740] as const;

for (const subject of ['cited', 'plain'] as const) {
  for (const [width, percent] of [
    [360, 100],
    [320, 100],
    [360, 200],
    [320, 200],
  ] as const) {
    test(`K1~K7 폭 ${width} · 글자 ${percent}% · ${subject === 'cited' ? '인용 있는 카드' : '인용 없는 카드'}: 보이는 영역이 340~740으로 줄어도 입력란과 두 버튼이 보이고(글자 100%) compact가 아닌데 시트가 잘리는 일이 없다 (K3 전 구간)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      await openSheet(page, width, percent, subject);
      const input = page.getByTestId('note-input');
      const overlay = page.getByTestId('note-overlay');
      const sheet = page.getByTestId('note-sheet');
      // K5: 입력란 글자 크기 ≥ 16px (iOS 확대 방지)
      expect(await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), 'K5 입력란 글자 크기').toBeGreaterThanOrEqual(16);
      expect(await page.getByTestId('cite').count(), '카드 종류 확인').toBe(subject === 'cited' ? 1 : 0);
      await input.focus();
      let sawCompact = false;
      let sawFull = false;
      for (const [h, top] of [...HEIGHTS.map((x) => [x, 0] as const), [400, 60] as const, [620, 60] as const]) {
        await setVV(page, h, top);
        await input.focus();
        await settle(page); // 상태 갱신 → 재측정 → compact 반영까지
        const label = `${h}/${top}`;
        await expect(overlay, `K1 높이 ${label}: 바탕이 보이는 영역에 맞다`).toHaveAttribute('style', new RegExp(`--vv-h: ${h}px.*--vv-top: ${top}px`));
        const rect = (await overlay.boundingBox())!;
        expect(Math.round(rect.y), `K1 바탕 위쪽 ${label}`).toBe(top);
        expect(Math.round(rect.height), `K1 바탕 높이 ${label}`).toBe(h);
        expect((await sheet.boundingBox())!.height, `K1 시트가 보이는 영역 안(${label})`).toBeLessThanOrEqual(h);
        const compact = (await sheet.getAttribute('data-compact')) === 'true';
        const overflow = await sheet.evaluate((el) => el.scrollHeight - el.clientHeight);
        // 핵심 불변식(K3 구멍): compact가 아닌데 시트가 잘리는(안쪽 스크롤이 생기는) 높이가 없다 — 전체 시트가 들어가면 전체를 보이고, 안 들어가면 compact다
        if (!compact) expect(overflow, `compact가 아닌데 시트 안 스크롤이 생겼다 (${label}, 넘침 ${overflow}px)`).toBeLessThanOrEqual(1);
        if (compact) {
          sawCompact = true;
          await expect(page.getByTestId('cite'), `K2 compact: 인용 박스 숨김(${label})`).toBeHidden();
          await expect(page.locator('.note-choice__sub').first(), `K2 compact: 두 버튼의 보조 설명 숨김(${label})`).toBeHidden();
          for (const keep of ['note-hint', 'note-count', 'note-input']) await expect(page.getByTestId(keep), `K2 compact에서도 ${keep}는 보인다(${label})`).toBeVisible();
          // D-88(REV 관찰 1): compact에서 질문은 시트 위에 고정된 한 줄 — 쓰는 동안에도 보이고(보이는 영역 안), 입력란·버튼과 겹치지 않으며, 한 줄로 줄인다(sticky · ellipsis · nowrap · overflow hidden)
          const titleBox = await boxOf(page, 'note-title');
          const fieldBox = await boxOf(page, 'note-input');
          expect(titleBox.top, `D-88 질문 줄이 보이는 영역 위쪽 안(${label})`).toBeGreaterThanOrEqual(top - 1);
          expect(titleBox.bottom, `D-88 질문 줄이 보이는 영역 아래쪽 안(${label})`).toBeLessThanOrEqual(top + h + 1);
          expect(titleBox.bottom, `D-88 질문 줄과 입력란이 겹치지 않는다(${label})`).toBeLessThanOrEqual(fieldBox.top + 1);
          for (const id of ['note-save', 'note-skip']) expect(titleBox.bottom, `D-88 질문 줄과 ${id}가 겹치지 않는다(${label})`).toBeLessThanOrEqual((await boxOf(page, id)).top + 1);
          expect(await page.getByTestId('note-title').evaluate((el) => ({ position: getComputedStyle(el).position, textOverflow: getComputedStyle(el).textOverflow, whiteSpace: getComputedStyle(el).whiteSpace, overflowX: getComputedStyle(el).overflowX })), `D-88 질문 줄의 모양(${label})`).toEqual({ position: 'sticky', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflowX: 'hidden' });
          expect(await page.getByTestId('note-title').evaluate((el) => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1), `D-88 질문은 한 줄이다(${label})`).toBe(true);
        } else {
          sawFull = true;
          await expect(page.locator('.note-choice__sub').first(), `전체 시트에는 보조 설명이 보인다(${label})`).toBeVisible();
          if (subject === 'cited') await expect(page.getByTestId('cite'), `전체 시트에는 인용 박스가 보인다(${label})`).toBeVisible();
        }
        // K4: 포커스를 가진 입력란은 늘 보이는 영역 안, 문서는 안 움직인다
        const field = await boxOf(page, 'note-input');
        expect(field.top, `K4 입력란 위쪽이 보이는 영역 안(${label})`).toBeGreaterThanOrEqual(top - 1);
        expect(field.bottom, `K4 입력란 아래쪽이 보이는 영역 안(${label})`).toBeLessThanOrEqual(top + h + 1);
        expect(await page.evaluate(() => Math.round(window.scrollY)), 'K4 문서는 움직이지 않는다').toBe(0);
        if (percent === 100) {
          // K3: 340 이상 전 구간에서 입력란 전체와 두 버튼이 모두 보이는 영역 안
          for (const [name, id] of [['적어두고 살기', 'note-save'], ['마음속에 담고 살기', 'note-skip']] as const) {
            const b = await boxOf(page, id);
            expect(b.top, `K3 ${name} 위쪽 (${label})`).toBeGreaterThanOrEqual(top - 1);
            expect(b.bottom, `K3 ${name} 아래쪽 (${label})`).toBeLessThanOrEqual(top + h + 1);
          }
        } else {
          // K7: 글자 200%는 compact 시트도 안 들어갈 수 있다 — 두 버튼은 시트 안 스크롤로 닿는다(들어가면 이미 보인다)
          for (const id of ['note-save', 'note-skip']) {
            await page.getByTestId(id).evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
            const b = await boxOf(page, id);
            expect(b.top, `K7 ${id} 스크롤로 닿음 (${label}) 위`).toBeGreaterThanOrEqual(top - 1);
            expect(b.bottom, `K7 ${id} 스크롤로 닿음 (${label}) 아래`).toBeLessThanOrEqual(top + h + 1);
          }
          await input.focus();
        }
      }
      // 공허 통과 방지: 가장 낮은 높이는 compact. 인용 없는 카드(전체 높이 약 560~620px)는 높이가 충분하면 전체 시트를 보인다. 인용 있는 카드(전체 약 770~810px)는 창 높이 740의 94dvh(695px)에도 안 들어가므로 입력 영역에 포커스가 있는 동안 늘 compact다
      expect(sawCompact, '340에서는 compact였다').toBe(true);
      if (subject === 'plain' && percent === 100) expect(sawFull, '높이가 충분하면 전체 시트를 보였다').toBe(true);
      if (subject === 'cited' && percent === 100) expect(sawFull, '전체 시트가 94dvh에도 안 들어가므로 compact뿐이다').toBe(false);
      // K6: 키보드가 내려가면(포커스 해제 + visualViewport 복귀) compact가 풀리고 시트가 원래 높이로 돌아온다
      await setVV(page, 740, 0);
      await input.evaluate((el) => (el as HTMLElement).blur());
      await expect(sheet).toHaveAttribute('data-compact', 'false');
      await page.screenshot({ path: `${SHOTS}/dev-M7c-viewport-${subject}-${width}-${percent}-after.png` });
    });
  }
}

test('경계 (K2·K3): 인용 없는 카드 폭 360 · 글자 100%에서 compact는 정확히 「전체 시트가 최대 높이에 안 들어갈 때」부터다 — 전체 높이 바로 위·아래에서 바뀌고, 예전 고정 문턱(520) 위·아래와 무관하다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  await openSheet(page, 360, 100, 'plain');
  const sheet = page.getByTestId('note-sheet');
  const input = page.getByTestId('note-input');
  // 키보드 없는 전체 시트의 높이(내용 높이 + 테두리) — 안쪽 스크롤 높이로 재서 최대 높이에 잘리지 않은 값이다
  const natural = await sheet.evaluate((el) => Math.round(el.scrollHeight + ((el as HTMLElement).offsetHeight - el.clientHeight)));
  expect(natural, '인용 없는 전체 시트는 520보다 높다(예전 고정 문턱이 놓치던 구간이 실제로 있다)').toBeGreaterThan(540);
  await input.focus();
  // 최대 높이 = 보이는 높이 − 8: 들어간다 → compact 아님, 전체를 보인다
  await setVV(page, natural + 9, 0);
  await settle(page);
  await expect(sheet).toHaveAttribute('data-compact', 'false');
  expect((await sheet.evaluate((el) => el.scrollHeight - el.clientHeight)), '들어가므로 시트 안 스크롤이 없다').toBeLessThanOrEqual(1);
  // 몇 px 모자라면 안 들어간다 → compact
  await setVV(page, natural + 5, 0);
  await settle(page);
  await expect(sheet).toHaveAttribute('data-compact', 'true');
  // 예전 문턱 520 바로 위(전체 시트가 안 들어가는 구간)에서도 compact이고 두 버튼이 보인다
  for (const h of [524, 540, natural - 2]) {
    await setVV(page, h, 0);
    await settle(page);
    await expect(sheet, `보이는 높이 ${h}`).toHaveAttribute('data-compact', 'true');
    for (const id of ['note-save', 'note-skip']) {
      const bx = await boxOf(page, id);
      expect(bx.top, `${id} 위쪽 (${h})`).toBeGreaterThanOrEqual(-1);
      expect(bx.bottom, `${id} 보이는 높이 ${h} 안`).toBeLessThanOrEqual(h + 1);
    }
  }
});

test('K2·K3 스크린샷: 폭 360 · 키보드가 올라와 보이는 높이 340(compact)에서 입력란·두 버튼이 함께 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await openSheet(page, 360, 100);
  await page.getByTestId('note-input').focus();
  await page.getByTestId('note-input').fill('가상 키보드가 올라온 상태에서 쓰는 글');
  await setVV(page, 340, 0);
  await expect(page.getByTestId('note-sheet')).toHaveAttribute('data-compact', 'true');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/dev-M7c-viewport-compact-360x340.png` });
  await setVV(page, 400, 60);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/dev-M7c-viewport-offset-360x400.png` });
});

test('버튼을 눌러도 입력란 포커스가 풀리지 않아 compact가 풀리지 않고 눌림이 빗나가지 않는다 (mousedown 기본 동작 차단)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await openSheet(page, 360, 100);
  await page.getByTestId('note-input').fill('눌러도 빗나가지 않는 글');
  await page.getByTestId('note-input').focus();
  await setVV(page, 360, 0);
  await expect(page.getByTestId('note-sheet')).toHaveAttribute('data-compact', 'true');
  // 눌림 직전의 버튼 자리를 기억해 두고 눌러도 같은 자리에서 눌려 저장된다
  const before = await boxOf(page, 'note-save');
  await page.getByTestId('note-save').click();
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  expect(before.bottom).toBeLessThanOrEqual(360 + 1);
  await expect(page.getByTestId('note-text').last()).toHaveText('눌러도 빗나가지 않는 글');
});

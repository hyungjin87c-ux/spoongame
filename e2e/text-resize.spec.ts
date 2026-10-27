import { expect, test, type Page } from '@playwright/test';
import { slideCount } from './carouselHelpers';
import { barViolations, measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';
import { BAR_MAIN_BUTTON, BAR_STATES, openBarState } from './titleStates';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 글자 크기 확대(WCAG 1.4.4)와 리플로(1.4.10) — SPEC-003 CM11, QM2-3 완료 기준 a~d (QA-003-M2 M2-V04).
 * (가) 루트 글자 100·125·150·175·200% × 폭·높이 320×568·360×740 × 라이트·다크 × 첫 화면 3상태(새 판·이어하기·확인 단계):
 *      가로 넘침 0px, 글자 잘림 0, 수저 이름표 겹침 0, 하단 띠의 버튼 높이 ≥ 44px·눌림, 띠 ≤ 화면 높이의 50%.
 * (나) 브라우저 확대 상당 뷰포트 640×400(1280 창의 200%)·512×384(1024 창의 200%)·320×256(1280 창의 400%): 가로 넘침 0. 접이식 폰 280px(글자 100%)은 회귀 방지.
 * (b) 캐러셀 21장을 모두 넘기며 (가)의 320·360에서 같은 단언.
 * QM2-12(2회차 보완): 하단 띠 규칙은 「고정이면 높이 ≤ 뷰포트의 50%, 50%를 넘으면 고정을 풀어 본문 끝에 둔다」다 — 공통 뷰포트 11종 × 글자 100·200% × 3상태 66조합(a),
 * 해제 상태의 스크롤 여백·오른쪽 열 max-height(b), 같은 페이지에서 고정 ↔ 해제 전환(포커스 유지·확인 단계가 화면 안, c).
 * 이전 구현에서 실패함을 확인했다: 360×740 · 200%에서 `P.hero__tag`·`SPAN.nowrap`·`SPAN.spoon-fig__name`이 366px > 360px (ai-log 「변이 점검」).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';
const PERCENTS = [100, 125, 150, 175, 200] as const;
const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;

for (const size of SIZES) {
  test.describe(`글자 확대 ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });
    for (const scheme of ['light', 'dark'] as const) {
      for (const percent of PERCENTS) {
        for (const state of BAR_STATES) {
          test(`(가) ${size.width}x${size.height} · 글자 ${percent}% · ${scheme} · ${state}: 가로 넘침 0px·글자 잘림 0·이름표 겹침 0·띠 버튼 ≥ 44px·띠 ≤ 화면 절반`, async ({ page }, testInfo) => {
            test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
            await page.emulateMedia({ colorScheme: scheme });
            await openBarState(page, state);
            await expect(page.getByTestId(BAR_MAIN_BUTTON[state])).toBeVisible();
            await setRootFontPercent(page, percent);
            const label = `${size.width}x${size.height}/${percent}%/${scheme}/${state}`;
            const m = await measureTextResize(page);
            expect(m.nameCount, '첫 화면에는 수저 이름표가 없다(SPEC-004 GS11 — 수저 다섯 자루 줄 삭제)').toBe(0);
            expect(textResizeViolations(m, label), `루트 글자 ${m.rootFontPx}px`).toEqual([]);
            expect(barViolations(m, label)).toEqual([]);
            // 「태어나기」(또는 상태의 큰 버튼)가 실제로 눌린다: 한가운데를 눌러 동작을 본다는 대신, 한가운데에서 맞는 요소가 그 버튼인지(barViolations의 hit)를 본다
            // 증거 스크린샷은 입력 가드가 풀린 뒤에 찍는다 — 가드 중에는 큰 버튼이 회색(비활성)으로 보인다(REV-003-M2-3 R-235 ③)
            await expect(page.getByTestId(BAR_MAIN_BUTTON[state])).toBeEnabled();
            if (percent === 200 && scheme === 'light' && size.width === 360) await page.screenshot({ path: `${SHOTS}/dev-M2-r4-v04-360x740-200pct-${state}.png` });
            if (percent === 200 && scheme === 'light' && size.width === 320) await page.screenshot({ path: `${SHOTS}/dev-M2-r4-v04-320x568-200pct-${state}.png` });
          });
        }
      }
    }

    for (const percent of PERCENTS) {
      test(`(b) ${size.width}x${size.height} · 글자 ${percent}%: 캐러셀 21장을 모두 넘기며 가로 넘침 0px·글자 잘림 0, 그래프 글자 ≥ 12px`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(90_000);
        await page.goto('/');
        await expect(page.getByTestId('start-birth')).toBeEnabled();
        await page.getByTestId('carousel-pause').click(); // 일시정지하고 모두 넘긴다
        await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 다시 시작');
        await setRootFontPercent(page, percent);
        const n = await slideCount(page);
        expect(n, "첫 장 세대 그래프 + 지표 20장").toBe(21);
        const problems: string[] = [];
        let charted = 0;
        for (let i = 0; i < n; i++) {
          const id = await page.evaluate(() => document.querySelector('.slide.is-active')?.getAttribute('data-slide-id') ?? '');
          const label = `${size.width}x${size.height}/${percent}%/${i + 1}/${n} ${id}`;
          const m = await measureTextResize(page);
          problems.push(...textResizeViolations(m, label));
          const fonts = await page.evaluate(() => {
            const svg = document.querySelector('.slide.is-active svg.chart') as SVGSVGElement | null;
            if (svg === null) return [];
            const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
            return [...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale);
          });
          charted += fonts.length;
          for (const px of fonts) if (px < 12) problems.push(`${label}: 그래프 글자 ${px.toFixed(2)}px < 12px`);
          if (i < n - 1) await page.getByTestId('carousel-next').click();
        }
        expect(charted, '그래프 글자를 실제로 잰 개수(공허 통과 방지)').toBeGreaterThan(100);
        expect(problems).toEqual([]);
      });
    }
  });
}

/** (나) 브라우저 확대 상당 뷰포트 + 접이식 폰 280px */
for (const [name, width, height] of [
  ['1280 창의 200% = 640x400', 640, 400],
  ['1024 창의 200% = 512x384', 512, 384],
  ['1280 창의 400% = 320x256', 320, 256],
  ['접이식 폰 280x653 (글자 100%)', 280, 653],
] as const) {
  test.describe(`리플로 ${name}`, () => {
    test.use({ viewport: { width, height } });
    for (const state of BAR_STATES) {
      test(`(나) ${name} · ${state}: 가로 넘침 0px·글자 잘림 0·이름표 겹침 0, 「${BAR_MAIN_BUTTON[state]}」가 화면에 보이고 눌린다`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await openBarState(page, state);
        const m = await measureTextResize(page);
        expect(textResizeViolations(m, `${width}x${height}/${state}`)).toEqual([]);
        const main = m.buttons.find((b) => b.id === BAR_MAIN_BUTTON[state]);
        expect(main, `${BAR_MAIN_BUTTON[state]}가 띠에 있다`).toBeDefined();
        expect(main!.hit).toBe(true);
        expect(main!.inViewport).toBe(true);
        expect(main!.height).toBeGreaterThanOrEqual(44);
        // 띠 규칙(QM2-12 f): 고정이면 ≤ 화면 절반, 절반을 넘으면(예: 320×256 확인 단계 150px = 59%) 고정이 풀려 본문 끝에 놓인다 — 어느 쪽이든 규칙을 지킨다
        expect(barViolations(m, `${width}x${height}/${state}`)).toEqual([]);
        testInfo.annotations.push({ type: 'bar', description: `${state}: 띠 ${Math.round(m.bar!.height)}px / 화면 ${height}px — ${m.bar!.fixed ? '고정' : '해제'}` });
        if (state === 'new') {
          await expect(page.getByTestId('start-birth')).toBeEnabled();
          await page.screenshot({ path: `${SHOTS}/dev-M2-r4-v04-${width}x${height}.png` });
        }
      });
    }

    test(`(나) ${name}: 캐러셀 21장을 모두 넘기며 가로 넘침 0px`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(90_000);
      await page.goto('/');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      await page.getByTestId('carousel-pause').click();
      const n = await slideCount(page);
      const problems: string[] = [];
      for (let i = 0; i < n; i++) {
        const m = await measureTextResize(page);
        problems.push(...textResizeViolations(m, `${width}x${height}/${i + 1}/${n}`));
        if (i < n - 1) await page.getByTestId('carousel-next').click();
      }
      expect(problems).toEqual([]);
    });
  });
}

// ---------- QM2-12: 낮은 화면에서 하단 띠 — 절반을 넘으면 고정을 푼다 ----------

/** 해제 상태의 스크롤 여백 기준 — 기본 간격 `--sp-3` (px) */
async function spacing3(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sp-3')));
}

test('QM2-12 (a·b): 공통 뷰포트 11종 × 글자 100·200% × 상태 3(새 판·이어하기·확인 단계) 66조합 — 고정이면 띠 ≤ 뷰포트 50%, 아니면 본문 끝 아래에 겹침 없이 놓이고 버튼이 눌린다; 해제 조합의 목록 출력, 320×256 확인 단계는 해제 조합에 있다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(480_000);
  const problems: string[] = [];
  const rows: string[] = [];
  const released: string[] = [];
  let fixedCount = 0;
  let combos = 0;
  for (const vp of STANDARD_VIEWPORTS) {
    for (const percent of [100, 200] as const) {
      for (const state of BAR_STATES) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        if (state === 'new') {
          // 앞 조합이 진행 중인 판을 저장해 두었으므로(이어하기·확인 단계) 저장을 비워 첫 방문 화면(새 판)으로 연다
          await page.goto('/');
          await page.evaluate(() => localStorage.clear());
        }
        await openBarState(page, state);
        if (percent !== 100) await setRootFontPercent(page, percent);
        const m = await measureTextResize(page);
        const label = `${vp.name}/${percent}%/${state}`;
        combos++;
        problems.push(...barViolations(m, label));
        const bar = m.bar!;
        rows.push(`${label}: ${bar.fixed ? '고정' : '해제'} · 띠 ${Math.round(bar.height)}px / 화면 ${vp.height}px (${(bar.ratio * 100).toFixed(0)}%)`);
        const sp3 = await spacing3(page);
        if (bar.fixed) {
          fixedCount++;
          // 고정: 스크롤 여백이 띠 높이 + 기본 간격 (CM10, QM2-1)
          if (bar.scrollPaddingBottom < bar.height + sp3 - 0.5) problems.push(`${label}: 고정 띠인데 scroll-padding-bottom ${bar.scrollPaddingBottom}px < 띠 ${Math.round(bar.height)}px + ${sp3}px`);
        } else {
          released.push(label);
          // 해제: 스크롤 여백이 기본 간격(--sp-3) 이하로 돌아온다 (QM2-12 b)
          if (bar.scrollPaddingBottom > sp3 + 0.5) problems.push(`${label}: 풀린 띠인데 scroll-padding-bottom ${bar.scrollPaddingBottom}px > 기본 간격 ${sp3}px`);
        }
      }
    }
  }
  console.log(`QM2-12 66조합 (${combos}):\n${rows.join('\n')}\n해제 조합 ${released.length}개: ${released.join(', ')}`);
  testInfo.annotations.push({ type: 'released', description: `${released.length}개: ${released.join(', ')}` });
  expect(combos).toBe(66);
  expect(problems).toEqual([]);
  // 공허 통과 방지: 해제 조합이 실제로 있고(기록 4의 59%), 고정 조합도 있다
  expect(released, '고정이 풀린 조합 — 320×256 확인 단계(띠 150px = 화면 높이의 59%)가 거기 들어 있다').toContain('320x256-zoom400/100%/confirm');
  expect(fixedCount, '고정으로 남은 조합').toBeGreaterThan(30);
});

test('QM2-12 (b): 폭 ≥ 960의 해제 상태 — 오른쪽 따라다니는 카드의 max-height도 하단 띠 높이(--bar-h)에 묶이지 않고 풀린다, 본문 끝 여백이 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  // 1000×400에 글자 200%: 확인 단계 띠(약 254px)가 화면의 절반을 넘어 풀리고, 폭 ≥ 960이라 통계 카드가 오른쪽 열(따라다니는 카드)에 있다
  await page.setViewportSize({ width: 1000, height: 400 });
  await openBarState(page, 'confirm');
  await setRootFontPercent(page, 200);
  const probe = () =>
    page.evaluate(() => {
      const side = document.querySelector('.carousel--005') as HTMLElement; // 따라다니는 것은 오른쪽 열이 아니라 카드다(GM4 2차: .title__side는 static)
      const space = document.querySelector('.page-end-space') as HTMLElement;
      const bar = document.querySelector('[data-testid="bottom-bar"]') as HTMLElement;
      return {
        position: getComputedStyle(bar).position,
        barH: bar.getBoundingClientRect().height,
        sideMax: parseFloat(getComputedStyle(side).maxHeight),
        spaceDisplay: getComputedStyle(space).display,
        vh: window.innerHeight,
      };
    });
  const r = await probe();
  expect(r.position, `띠 ${Math.round(r.barH)}px / 화면 ${r.vh}px → 고정이 풀린다`).toBe('static');
  expect(r.sideMax, '풀린 상태의 카드 max-height = 100vh − 24px − 12px (--bar-h를 빼지 않는다; GM4 2차: 아래 여유 3px → 12px)').toBeCloseTo(r.vh - 24 - 12, 0);
  expect(r.spaceDisplay, '본문 끝 여백(page-end-space)은 풀린 띠 아래에 필요 없다').toBe('none');
  // 대조: 같은 폭에서 화면이 충분히 높으면 고정이고 카드 max-height가 띠 높이를 뺀다
  await page.setViewportSize({ width: 1000, height: 900 });
  await expect.poll(async () => (await probe()).position).toBe('fixed');
  const fixed = await probe();
  expect(Math.abs(fixed.sideMax - (fixed.vh - fixed.barH - 24 - 12)), `고정 띠일 때는 카드 max-height(${fixed.sideMax})가 띠 높이(${fixed.barH})를 뺀다`).toBeLessThan(2); // --bar-h는 정수(offsetHeight)라 소수 높이와 1px쯤 다를 수 있다
  expect(fixed.spaceDisplay).not.toBe('none');
});

test('QM2-12 (c): 같은 페이지에서 뷰포트를 320×568 ↔ 320×256으로 바꾸고(새로고침 없이) 확인 단계를 열고 닫는다 — 고정 ↔ 해제가 바뀌고, 포커스 요소가 유지되며, 연 확인 단계의 안내문 첫 줄과 취소 버튼이 화면 안에 있다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  const barPosition = () => page.getByTestId('bottom-bar').evaluate((el) => getComputedStyle(el).position);
  const inView = async (testId: string): Promise<boolean> =>
    page.getByTestId(testId).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5;
    });
  const focusedId = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? '(없음)');

  await page.setViewportSize({ width: 320, height: 568 });
  await openBarState(page, 'continue');
  await expect(page.getByTestId('begin-new')).toBeEnabled();
  expect(await barPosition(), '320×568 이어하기 띠(120px)는 고정').toBe('fixed');

  // 1) 열기: 고정(150/568) → 확인 단계
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  await expect(page.getByTestId('confirm-new-no')).toBeFocused();
  expect(await barPosition(), '확인 단계 띠(150px = 26%)는 고정').toBe('fixed');

  // 2) 뷰포트만 320×256으로 — 새로고침 없이: 띠 150px = 59% → 고정이 풀린다. 포커스는 그대로이고 안내문 첫 줄·취소 버튼이 화면 안에 있다
  await page.setViewportSize({ width: 320, height: 256 });
  await expect.poll(barPosition, { message: '320×256에서 확인 단계 띠는 고정이 풀린다' }).toBe('static');
  expect(await focusedId(), '전환 중 포커스 유지').toBe('confirm-new-no');
  expect(await inView('confirm-new-ask'), '안내문 첫 줄이 화면 안에 있다').toBe(true);
  expect(await inView('confirm-new-no'), '취소 버튼이 화면 안에 있다').toBe(true);
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled(); // 입력 가드가 풀린 뒤에 찍는다(가드 중에는 버튼이 회색이다 — R-235 ③)
  await page.screenshot({ path: `${SHOTS}/dev-M2-r5-qm212-320x256-confirm-released.png` });

  // 3) 닫기(Esc): 이어하기 띠 120px(47%) → 다시 고정, 포커스는 「새로 태어나기」로 돌아온다
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  await expect.poll(barPosition).toBe('fixed');
  await expect(page.getByTestId('begin-new')).toBeFocused();
  expect(await inView('begin-new'), '닫은 뒤 「새로 태어나기」가 화면 안에 있다').toBe(true);

  // 4) 다시 열기: 고정(120/256) → 확인 단계(150px) — 열면서 고정 → 해제로 바뀌는 경우. 안내문 첫 줄과 포커스를 받은 취소 버튼이 모두 화면 안에 있다
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  await expect(page.getByTestId('confirm-new-no')).toBeFocused();
  await expect.poll(barPosition).toBe('static');
  expect(await focusedId()).toBe('confirm-new-no');
  expect(await inView('confirm-new-ask'), '열 때 고정 → 해제로 바뀌어도 안내문 첫 줄이 화면 안에 있다').toBe(true);
  expect(await inView('confirm-new-no'), '취소 버튼이 화면 안에 있다').toBe(true);

  // 5) 뷰포트를 다시 키우면(320×568) 고정으로 돌아오고 포커스는 그대로다
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(barPosition).toBe('fixed');
  expect(await focusedId(), '해제 → 고정 전환 중 포커스 유지').toBe('confirm-new-no');
  expect(await inView('confirm-new-no')).toBe(true);

  // 6) 글자 크기 변경도 같다: 더 낮은 화면(320×400)에서 글자 200%로 키우면 확인 단계 띠가 절반을 넘어 풀리고, 100%로 되돌리면 다시 고정
  await page.setViewportSize({ width: 320, height: 400 });
  await setRootFontPercent(page, 200);
  await expect.poll(barPosition, { message: '320×400 글자 200%: 확인 단계 띠가 절반을 넘어 풀린다' }).toBe('static');
  expect(await focusedId(), '글자 크기 변경으로 풀려도 포커스 유지').toBe('confirm-new-no');
  await setRootFontPercent(page, 100);
  await expect.poll(barPosition, { message: '글자를 100%로 되돌리면 다시 고정' }).toBe('fixed');
  expect(await focusedId()).toBe('confirm-new-no');
});

test('증거 스크린샷(QM2-12, 기록 4): 320×256 확인 단계 — 띠가 화면의 59%라 고정이 풀려 본문 끝에 놓인다(스크롤해서 확인 단계 전체가 보인다)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 256 });
  await openBarState(page, 'confirm');
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  const m = await measureTextResize(page);
  expect(m.bar!.fixed, `띠 ${Math.round(m.bar!.height)}px / 화면 256px`).toBe(false);
  expect(barViolations(m, '320x256/confirm')).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: `${SHOTS}/dev-M2-r5-qm212-320x256-confirm-bottom.png` });
});

// ---------- R-240: 띠 해제 판정은 주소창에 흔들리지 않는 작은 뷰포트 높이로 ----------

test('R-240: window.innerHeight만 바꾼 resize(모바일 주소창 접힘·펴짐 흉내)에서 bar-released 클래스 변화가 0번이다 — 해제·경계·고정 4조합, 판정은 작은 뷰포트 높이(100svh 탐침)다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  const cases = [
    { name: '해제: 320×256 확인 단계(150px = 59%)', width: 320, height: 256, percent: 100, state: 'confirm', released: true },
    { name: '경계: 667×375 글자 200% 확인 단계(약 56%)', width: 667, height: 375, percent: 200, state: 'confirm', released: true },
    { name: '고정: 360×740 새 판(68px = 9%)', width: 360, height: 740, percent: 100, state: 'new', released: false },
    { name: '고정: 320×568 이어하기(120px = 21%)', width: 320, height: 568, percent: 100, state: 'continue', released: false },
  ] as const;
  let flips = 0; // 옛 방식(innerHeight로 판정)이었다면 판정이 뒤집혔을 흉내 값의 수 — 공허 통과 방지
  for (const c of cases) {
    await page.setViewportSize({ width: c.width, height: c.height });
    if (c.state === 'new') {
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
    }
    await openBarState(page, c.state);
    if (c.percent !== 100) await setRootFontPercent(page, c.percent);
    const m = await measureTextResize(page);
    const label = c.name;
    expect(m.bar!.fixed, `${label}: 시작 상태`).toBe(!c.released);
    // 작은 뷰포트 탐침: 보이지 않고, 높이는 실제 뷰포트 높이다
    const probe = await page.evaluate(() => {
      const el = document.querySelector('[data-viewport-probe]') as HTMLElement | null;
      return el === null ? null : { height: el.getBoundingClientRect().height, visibility: getComputedStyle(el).visibility, position: getComputedStyle(el).position, ariaHidden: el.getAttribute('aria-hidden') };
    });
    expect(probe, `${label}: 탐침 요소`).not.toBeNull();
    expect(probe!.height, `${label}: 탐침 높이 = 실제 뷰포트 높이`).toBeCloseTo(c.height, 0);
    expect(probe!.visibility).toBe('hidden');
    expect(probe!.position).toBe('fixed');
    expect(probe!.ariaHidden).toBe('true');

    const barHeight = m.bar!.height;
    const fakes = [Math.round(c.height * 0.4), Math.round(c.height * 0.7), Math.round(c.height * 1.5), c.height * 2, Math.round(barHeight * 1.9), c.height];
    for (const f of fakes) if (barHeight > f * 0.5 !== c.released) flips++;
    const result = await page.evaluate(async (values) => {
      const root = document.documentElement;
      let classMutations = 0;
      let releasedMutations = 0;
      let lastReleased = root.classList.contains('bar-released');
      const mo = new MutationObserver((records) => {
        for (const r of records) {
          if (r.attributeName !== 'class') continue;
          classMutations++;
          const now = root.classList.contains('bar-released');
          if (now !== lastReleased) releasedMutations++;
          lastReleased = now;
        }
      });
      mo.observe(root, { attributes: true, attributeFilter: ['class'] });
      const frames = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 30))));
      const seen: number[] = [];
      for (const v of values) {
        Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => v });
        window.dispatchEvent(new Event('resize'));
        await frames();
        seen.push(window.innerHeight);
      }
      mo.disconnect();
      return { classMutations, releasedMutations, seen, released: root.classList.contains('bar-released') };
    }, fakes);
    expect(result.seen, `${label}: innerHeight를 실제로 바꿨다`).toEqual(fakes);
    expect(result.classMutations, `${label}: innerHeight만 바꾼 resize ${fakes.length}번 동안 <html> class 변화 0번 (값 ${fakes.join('·')})`).toBe(0);
    expect(result.releasedMutations).toBe(0);
    expect(result.released, `${label}: 끝난 뒤에도 같은 상태`).toBe(c.released);
    testInfo.annotations.push({ type: 'r240', description: `${label}: 띠 ${Math.round(barHeight)}px, innerHeight 흉내 ${fakes.join('·')} → class 변화 0` });
  }
  expect(flips, '옛 방식(innerHeight로 판정)이었다면 뒤집혔을 값이 있었다(공허 통과 방지)').toBeGreaterThanOrEqual(cases.length);
});

test('R-240: 진짜 뷰포트 높이가 바뀌면 판정은 따라 바뀐다(작은 뷰포트 탐침이 실제 창 크기를 본다) — innerHeight를 흉내 낸 뒤에도', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 568 });
  await openBarState(page, 'confirm'); // 150px / 568 = 26% → 고정
  const barPosition = () => page.getByTestId('bottom-bar').evaluate((el) => getComputedStyle(el).position);
  expect(await barPosition()).toBe('fixed');
  // 주소창이 접힌 척 innerHeight를 크게 흉내 내도 고정 그대로, 진짜 창 높이를 256으로 줄이면 풀린다
  await page.evaluate(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 900 });
    window.dispatchEvent(new Event('resize'));
  });
  await page.setViewportSize({ width: 320, height: 256 }); // 진짜 창 크기 변화(resize 이벤트) — innerHeight 흉내는 덮여 있어도 탐침은 256을 본다
  await expect.poll(barPosition, { message: '진짜 뷰포트 256에서 띠 150px = 59% → 풀린다' }).toBe('static');
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(barPosition, { message: '진짜 뷰포트 568로 돌아오면 고정' }).toBe('fixed');
});

// ---------- QA-003-M2 3회차 기록 1 (M2-B07): 풀린 채 열린 확인 단계에서 크기가 더 바뀌어도 안내문·취소 버튼이 화면 안에 ----------

test('M2-B07: 풀린 채 열려 있는 확인 단계에서 글자를 키우거나 창 높이를 줄여도 안내문 첫 줄과 취소 버튼이 화면 안에 오고 포커스는 취소 버튼에 남는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  const snapshot = () =>
    page.evaluate(() => {
      const ask = (document.querySelector('[data-testid="confirm-new-ask"]') as HTMLElement).getBoundingClientRect();
      const no = (document.querySelector('[data-testid="confirm-new-no"]') as HTMLElement).getBoundingClientRect();
      return {
        askTop: ask.top,
        noTop: no.top,
        noBottom: no.bottom,
        vh: window.innerHeight,
        focused: (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? '(없음)',
        released: document.documentElement.classList.contains('bar-released'),
        scrollY: window.scrollY,
      };
    });
  type Snap = Awaited<ReturnType<typeof snapshot>>;
  /** 안내문 첫 줄·취소 버튼이 화면 안: 위 ≥ 0, 취소 버튼 아래 ≤ 화면 높이 */
  const inside = (s: Snap) => s.askTop >= -0.5 && s.noTop >= -0.5 && s.noBottom <= s.vh + 0.5;
  const describeSnap = (s: Snap) => `안내문 위 ${Math.round(s.askTop)} · 취소 ${Math.round(s.noTop)}~${Math.round(s.noBottom)} / 화면 ${s.vh} · 포커스 ${s.focused} · ${s.released ? '풀림' : '고정'} · scrollY ${Math.round(s.scrollY)}`;
  const steps: string[] = [];
  const settleInside = async (label: string) => {
    await expect.poll(async () => inside(await snapshot()), { message: label, timeout: 5_000 }).toBe(true);
    return snapshot();
  };

  // 1) 320×256 글자 100%(풀림) → 125% → 150%: 글자를 키운다
  await page.setViewportSize({ width: 320, height: 256 });
  await openBarState(page, 'confirm');
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  let s = await snapshot();
  expect(s.released, '시작부터 풀려 있다(풀림 → 풀림 경로)').toBe(true);
  expect(inside(s), `열었을 때 ${describeSnap(s)}`).toBe(true);
  for (const percent of [125, 150] as const) {
    await setRootFontPercent(page, percent);
    s = await settleInside(`320×256 글자 ${percent}%`);
    expect(s.released, `글자 ${percent}%에서도 풀려 있다`).toBe(true);
    expect(s.focused).toBe('confirm-new-no');
    steps.push(`320×256 글자 ${percent}%: ${describeSnap(s)}`);
  }

  // 2) 667×375 글자 200%(풀림) → 250%
  await page.setViewportSize({ width: 667, height: 375 });
  await openBarState(page, 'confirm');
  await setRootFontPercent(page, 200);
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  await expect.poll(async () => (await snapshot()).released).toBe(true);
  await settleInside('667×375 글자 200%');
  await setRootFontPercent(page, 250);
  s = await settleInside('667×375 글자 250%');
  expect(s.released).toBe(true);
  expect(s.focused).toBe('confirm-new-no');
  steps.push(`667×375 글자 250%: ${describeSnap(s)}`);

  // 3) 640×400 글자 200%(풀림)에서 창 높이를 380 → 340 → 300으로 줄인다
  await page.setViewportSize({ width: 640, height: 400 });
  await openBarState(page, 'confirm');
  await setRootFontPercent(page, 200);
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  await expect.poll(async () => (await snapshot()).released).toBe(true);
  await settleInside('640×400 글자 200%');
  for (const height of [380, 340, 300] as const) {
    await page.setViewportSize({ width: 640, height });
    s = await settleInside(`640×${height} 글자 200%`);
    expect(s.released, `높이 ${height}에서도 풀려 있다`).toBe(true);
    expect(s.focused).toBe('confirm-new-no');
    steps.push(`640×${height} 글자 200%: ${describeSnap(s)}`);
  }
  console.log(`M2-B07 (풀림 → 풀림):\n${steps.join('\n')}`);
  testInfo.annotations.push({ type: 'b07', description: steps.join(' | ') });
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/dev-M2-r6-b07-640x300-200pct-confirm.png` });
});

test('M2-B07 대조: 주소창 접힘 흉내(innerHeight만 변화)와 같은 크기의 resize는 풀린 확인 단계의 스크롤 위치를 건드리지 않는다 — 사용자가 올려 둔 위치를 되돌리지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 256 });
  await openBarState(page, 'confirm');
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.classList.contains('bar-released'))).toBe(true);
  // 사용자가 맨 위로 올려 읽는 중이다(확인 단계는 열린 채, 포커스는 취소 버튼)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBe(0);
  for (const inner of [340, 256, 300, 256]) {
    await page.evaluate((v) => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => v });
      window.dispatchEvent(new Event('resize'));
    }, inner);
    await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.scrollY), '주소창이 접히고 펴져도(innerHeight만 변화) 화면이 되돌아가지 않는다').toBe(before);
});

// ---------- QA-003-M2 3회차 기록 5: 강제 색상에서 띠 구분선 ----------

test('강제 색상(고대비): 하단 띠 위끝에 CanvasText 1px 실선 테두리가 있다(고정·해제 모두) — 두 상태의 띠 높이가 같고 띠 규칙(barViolations)을 지킨다; 보통 색상에는 테두리가 없다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  const probe = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      const bar = document.querySelector('[data-testid="bottom-bar"]') as HTMLElement;
      const cs = getComputedStyle(bar);
      const sys = document.createElement('div');
      sys.style.color = 'CanvasText';
      document.body.appendChild(sys);
      const canvasText = getComputedStyle(sys).color;
      sys.remove();
      // 고정 ↔ 해제를 한 프레임 안에서 바꿔 띠 높이를 잰다(ResizeObserver 통지 전에 되돌린다)
      const hadClass = root.classList.contains('bar-released');
      const h0 = bar.getBoundingClientRect().height;
      root.classList.toggle('bar-released', !hadClass);
      const h1 = bar.getBoundingClientRect().height;
      root.classList.toggle('bar-released', hadClass);
      return { width: cs.borderTopWidth, style: cs.borderTopStyle, color: cs.borderTopColor, canvasText, position: cs.position, released: hadClass, h0, h1, forced: matchMedia('(forced-colors: active)').matches };
    });
  const seen: string[] = [];
  for (const c of [
    { vp: { width: 360, height: 740 }, state: 'new', released: false, label: '고정 360×740 새 판' },
    { vp: { width: 320, height: 256 }, state: 'confirm', released: true, label: '해제 320×256 확인 단계' },
  ] as const) {
    await page.setViewportSize(c.vp);
    await page.emulateMedia({ forcedColors: 'active' });
    await openBarState(page, c.state);
    const m = await measureTextResize(page);
    expect(barViolations(m, `forced ${c.label}`)).toEqual([]);
    const forced = await probe();
    expect(forced.forced, `${c.label}: 강제 색상이 켜졌다`).toBe(true);
    expect(forced.released, `${c.label}: 시작 상태`).toBe(c.released);
    expect(forced.width, `${c.label}: 위끝 테두리 굵기`).toBe('1px');
    expect(forced.style).toBe('solid');
    expect(forced.color, `${c.label}: 테두리 색 = CanvasText`).toBe(forced.canvasText);
    expect(forced.h1, `${c.label}: 고정 ↔ 해제를 바꿔도 띠 높이가 같다(${forced.h0} vs ${forced.h1})`).toBe(forced.h0);
    seen.push(`${c.label}: 테두리 ${forced.width} ${forced.style} ${forced.color}, 띠 ${forced.h0}px`);
    await expect(page.getByTestId(BAR_MAIN_BUTTON[c.state])).toBeEnabled(); // 입력 가드가 풀린 뒤에 찍는다
    await page.mouse.move(1, 1); // 확인 단계를 열 때 눌렀던 자리에 마우스가 남아 주 버튼이 hover 상태로 찍히지 않게 치운다(강제 색상의 hover는 글자가 안 보인다 — ai-log 「알려진 것」)
    await page.waitForTimeout(500); // 배경 전환(transition)이 끝난 뒤에 찍는다
    if (c.released) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.screenshot({ path: `${SHOTS}/dev-M2-r6-forced-colors-bar-${c.state}.png` });
    // 보통 색상: 테두리 없음(그림자 선), 띠 높이는 강제 색상일 때보다 테두리만큼(1px) 낮다
    await page.emulateMedia({ forcedColors: 'none' });
    const normal = await probe();
    expect(normal.forced).toBe(false);
    expect(normal.width, `${c.label}: 보통 색상에는 테두리가 없다`).toBe('0px');
    expect(normal.h0 + 1, `${c.label}: 보통 색상의 띠는 테두리만큼(1px) 낮다`).toBe(forced.h0);
  }
  testInfo.annotations.push({ type: 'forced-colors', description: seen.join(' | ') });
});

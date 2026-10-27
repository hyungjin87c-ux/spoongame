import { expect, test, type Page } from '@playwright/test';
import { AUTO_MS, CYCLE_MS, autoplayDisplay, centerOf, countText, currentIndex, displayIsConsistent, openWithClock, slideCount, tick } from './carouselHelpers';

/**
 * 캐러셀 자동 전환 재개 불변식 (SPEC-003 QM2-2, SC5, QA-003-M2 M2-A15).
 * 멈춤 사유는 ⓐ 일시정지 버튼 ⓑ 포인터(마우스·펜)가 카드 위 ⓒ 키보드 포커스가 카드 안 ⓓ 탭 가림 넷이다.
 *  I1 모두 풀리면 풀린 뒤 한 주기(9초 + 1초 여유) 안에 다음 슬라이드로 넘어간다 · I2 표시(data-autoplay·일시정지 버튼의 아이콘·이름) = 실제 동작 · I3 포인터 밑 요소가 바뀌어도 이탈을 놓치지 않는다 · I4 터치는 ⓑ로 세지 않는다.
 * SPEC-005(SH4·SH6·마스터 결정 M8): 자동 넘김 주기는 7초 → 9초이고, 머리글 문구(「7초마다 다음 지표」/「자동 넘김 멈춤」)가 없어져 I2의 「표시」는 일시정지 버튼의 아이콘·이름이다.
 * 시간은 가짜 시계로 흘린다(10초·20초를 실제로 기다리지 않는다). 포인터는 실제 마우스 이동이다.
 * 이전 구현(React의 onPointerLeave에 기댄 hovering)에서는 (a)·(b)가 실패한다 — 「다시 시작」 클릭으로 아이콘이 바뀐 뒤 포인터를 한 번에 카드 밖으로 옮기면 hovering이 true로 남았다(변이 점검은 ai-log).
 */

const SHOTS = 'qa/screenshots/003';

function desktopOnly(testInfo: { project: { name: string } }): void {
  test.skip(testInfo.project.name !== 'desktop', '마우스 포인터 시험 — 1280x800(desktop 프로젝트)에서만 실행');
}

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * 카드 밖의 한 점 (방향별). 카드와 하단 띠 모두 피한다.
 * SPEC-005: 1280×800에서 오른쪽 열의 카드는 일러스트 아래로 내려가 하단 띠 밑까지 이어진다(열 안쪽 스크롤) — 카드의 상자(boundingBox)가 보이는 영역을 넘으므로 「카드 밖」은 상자가 아니라
 * 그 점에서 실제로 맞는 요소(elementFromPoint)가 카드 안이 아닌지로 판정한다. 「아래」는 하단 띠 위의 점(띠가 카드를 가린 자리 — 포인터 밑 요소는 띠)이다.
 */
async function outsidePoint(page: Page, direction: Direction): Promise<{ x: number; y: number }> {
  const box = (await page.getByTestId('carousel').boundingBox())!;
  const vp = page.viewportSize()!;
  const bar = (await page.getByTestId('bottom-bar').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = Math.min(box.y + box.height / 2, bar.y - 40);
  const point = {
    up: { x: cx, y: Math.max(2, box.y - 12) },
    down: { x: cx, y: Math.min(bar.y - 6, box.y + box.height + 24) },
    left: { x: Math.max(2, box.x - 48), y: cy },
    right: { x: Math.min(vp.width - 2, box.x + box.width + 16), y: cy },
  }[direction];
  if (direction === 'down' && point.y <= box.y + box.height) point.y = bar.y + 12; // 카드가 띠 밑까지 이어지면 띠 위의 점
  const insideCard = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el !== null && document.querySelector('[data-testid="carousel"]')!.contains(el);
  }, point);
  expect(insideCard, `${direction}: 카드 밖의 점이어야 한다 (${JSON.stringify(point)}, 카드 ${JSON.stringify(box)})`).toBe(false);
  return point;
}

const autoplay = (page: Page) => page.getByTestId('carousel').getAttribute('data-autoplay');

/** 표시 셋이 서로 어긋나지 않는다 (I2) */
async function expectConsistent(page: Page, when: string): Promise<void> {
  const problem = displayIsConsistent(await autoplayDisplay(page));
  expect(problem, `${when}: 표시가 어긋남`).toBeNull();
}

/** 한 주기(9초 + 1초) 안에 슬라이드가 1장 이상 넘어간다 (I1) */
async function expectAdvancesWithinCycle(page: Page, when: string): Promise<void> {
  const before = await currentIndex(page);
  await tick(page, CYCLE_MS);
  expect(await currentIndex(page), `${when}: 한 주기(${AUTO_MS / 1000}초) 안에 다음 슬라이드로 넘어가야 한다`).not.toBe(before);
}

/** 한 주기보다 긴 시간(10초) 동안 슬라이드가 그대로다 (멈춘 상태가 거짓이 아니다 — I2) */
async function expectHoldsOverCycle(page: Page, when: string): Promise<void> {
  const before = await countText(page);
  await tick(page, CYCLE_MS);
  expect(await countText(page), `${when}: 멈춘 동안은 그대로여야 한다`).toBe(before);
}

test('M2-A15 재현 절차(QM2-2 a): 카드 밖 → 일시정지 → 카드 밖 → 「다시 시작」 → 이동 1번으로 카드 밖 → 한 주기 안에 넘어가고 그 뒤 20초에 2회 이상 전환', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openWithClock(page);
  const carousel = page.getByTestId('carousel');
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤
  await page.mouse.move(2, 2);
  const pause = await centerOf(page, 'carousel-pause');
  // 일시정지: 버튼 위로 들어가 누른다
  await page.mouse.move(pause.x, pause.y, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 다시 시작');
  await expect(carousel).toHaveAttribute('data-autoplay', 'paused');
  await expectConsistent(page, '일시정지 직후');
  // 카드 밖으로 → 여전히 멈춤(사용자가 멈췄다)
  await page.mouse.move(2, 2, { steps: 8 });
  await expect(carousel).toHaveAttribute('data-autoplay', 'paused');
  await expect(page.getByTestId('carousel-pause').locator('use')).toHaveAttribute('href', '#i-play'); // 상태 표시는 버튼의 아이콘·이름(SH6) — 머리글 문구는 없다
  // 다시 버튼 위로 → 「다시 시작」 클릭
  await page.mouse.move(pause.x, pause.y, { steps: 8 });
  await page.mouse.down();
  await page.mouse.up();
  // 이동 1번(steps: 1)으로 마우스를 카드 밖으로 — 누르자마자 곧바로. 이전 구현은 여기서 hovering이 남아 data-autoplay가 held로 멈춰 있었다
  await page.mouse.move(2, 2, { steps: 1 });
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 일시정지');
  await expect(carousel, '재개 직후 카드 밖으로 한 번에 치우면 자동 전환이 켜져 있어야 한다').toHaveAttribute('data-autoplay', 'on', { timeout: 3_000 });
  await expect(page.getByTestId('carousel-pause').locator('use')).toHaveAttribute('href', '#i-pause');
  await expectConsistent(page, '재개 직후');
  // 한 주기(9초 + 1초) 안에 넘어가고, 그 뒤 20초 동안 2회 이상 전환
  const start = await currentIndex(page);
  await tick(page, CYCLE_MS);
  const afterFirst = await currentIndex(page);
  expect(afterFirst, '한 주기 안에 슬라이드가 1장 이상 넘어간다').not.toBe(start);
  await tick(page, 20_000);
  const n = await slideCount(page);
  const advanced = (await currentIndex(page)) - afterFirst;
  expect((advanced + n) % n, '그 뒤 20초 동안 2회 이상 전환').toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${SHOTS}/dev-M2-r4-autoplay-resumed.png` });
});

/**
 * (b) 변형 반복: 이탈 방식(steps 1·12) × 방향(위·아래·왼·오) × 클릭부터 이탈까지 지연(0·50·500ms)을 각 20회.
 * 매 회: 일시정지 → 카드 밖 → 「다시 시작」 → 지연 → 이탈 → data-autoplay가 on이어야 하고 표시가 일치해야 한다. 조합마다 첫 회는 한 주기(10초)를 실제로 흘려 넘어가는지도 본다.
 */
const REPS = 20;
for (const steps of [1, 12]) {
  for (const direction of ['up', 'down', 'left', 'right'] as const) {
    test(`변형 반복(QM2-2 b): 이탈 steps=${steps} · ${direction} × 지연 0·50·500ms 각 ${REPS}회 — 멈춘 채 남는 횟수 0`, async ({ page }, testInfo) => {
      desktopOnly(testInfo);
      test.setTimeout(240_000);
      await openWithClock(page);
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      const out = await outsidePoint(page, direction);
      await page.mouse.move(out.x, out.y);
      const pause = await centerOf(page, 'carousel-pause');
      const stuck: string[] = [];
      for (const delay of [0, 50, 500]) {
        for (let rep = 0; rep < REPS; rep++) {
          const label = `steps=${steps} ${direction} 지연 ${delay}ms ${rep + 1}회`;
          await page.mouse.move(pause.x, pause.y, { steps: 4 });
          await page.mouse.down();
          await page.mouse.up(); // 일시정지
          await page.mouse.move(out.x, out.y, { steps: 4 });
          await page.mouse.move(pause.x, pause.y, { steps: 4 });
          await page.mouse.down();
          await page.mouse.up(); // 다시 시작
          if (delay > 0) await page.waitForTimeout(delay);
          await page.mouse.move(out.x, out.y, { steps });
          let state = await autoplay(page);
          // 이벤트 처리와 렌더 사이의 짧은 틈은 기다려 준다 — 그래도 안 켜지면 멈춘 채 남은 것이다
          for (let wait = 0; state !== 'on' && wait < 15; wait++) {
            await page.waitForTimeout(100);
            state = await autoplay(page);
          }
          if (state !== 'on') {
            stuck.push(label);
            // 다음 회를 위해 복구: 카드에 올렸다 내린다
            await page.mouse.move(pause.x, pause.y, { steps: 4 });
            await page.mouse.move(out.x, out.y, { steps: 4 });
            continue;
          }
          const problem = displayIsConsistent(await autoplayDisplay(page));
          if (problem !== null) stuck.push(`${label}: ${problem}`);
          if (delay === 0 && rep === 0) await expectAdvancesWithinCycle(page, label);
        }
      }
      expect(stuck, `멈춘 채 남은 횟수 ${stuck.length}/${3 * REPS}`).toEqual([]);
    });
  }
}

/** 포커스가 카드 안에 있는 동안 Tab을 눌러 카드 밖으로 나간다 — 첫 장(세대 그래프)에는 슬라이드 영역 다음에 「표로 보기」 요약도 있어 눌러야 하는 횟수가 슬라이드마다 다르다(최대 5번, 공허 방지로 2번 이상) */
async function tabOutOfCard(page: Page): Promise<void> {
  let presses = 0;
  while (presses < 5) {
    await page.keyboard.press('Tab');
    presses++;
    const inside = await page.evaluate(() => document.querySelector('[data-testid="carousel"]')!.contains(document.activeElement));
    if (!inside) break;
  }
  expect(presses, '슬라이드 영역을 지나 카드 밖으로 나갔다').toBeGreaterThanOrEqual(2);
}

test('다른 재개 경로(QM2-2 c): 키보드 Space로 멈췄다 재개하고 Tab으로 카드 밖 · 포인터만 올렸다가 한 번에 뺌 · 탭 가림 복귀 — 모두 풀린 뒤 한 주기 안에 재개', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openWithClock(page);
  const carousel = page.getByTestId('carousel');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.mouse.move(2, 2);

  // 1) 키보드: 일시정지 버튼에 포커스 → Space로 멈춤 → Space로 재개 → Tab으로 카드 밖(다음 칸은 슬라이드 영역, 그다음이 카드 밖의 출처 링크)
  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible)
  await page.getByTestId('carousel-pause').focus();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 다시 시작');
  await expect(carousel).toHaveAttribute('data-autoplay', 'paused');
  await expectHoldsOverCycle(page, '키보드로 멈춘 동안');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 일시정지');
  await expect(carousel, '재개했어도 포커스가 카드 안이면 멈춘 채다(사유 ⓒ)').toHaveAttribute('data-autoplay', 'held');
  await expectHoldsOverCycle(page, '재개했지만 포커스가 카드 안일 때');
  await tabOutOfCard(page); // → 슬라이드 영역 → (첫 장 세대 그래프의 「표로 보기」 요약) → 카드 밖
  expect(await page.evaluate(() => document.querySelector('[data-testid="carousel"]')!.contains(document.activeElement)), '포커스가 카드 밖으로 나갔다').toBe(false);
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await expectConsistent(page, '키보드로 카드를 떠난 직후');
  await expectAdvancesWithinCycle(page, '키보드로 카드를 떠난 뒤');

  // 2) 포인터만 올렸다가 한 번에 뺌
  await page.keyboard.press('Tab'); // 포커스가 카드 밖 어딘가(출처 링크·태어나기)에 머물게
  await page.getByTestId('start-birth').focus();
  const card = await centerOf(page, 'carousel-viewport');
  await page.mouse.move(card.x, card.y, { steps: 6 });
  await expect(carousel).toHaveAttribute('data-autoplay', 'held');
  await expectConsistent(page, '포인터가 올라간 동안');
  await expectHoldsOverCycle(page, '포인터가 올라간 동안');
  await page.mouse.move(2, 2, { steps: 1 });
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await expectAdvancesWithinCycle(page, '포인터를 한 번에 뺀 뒤');

  // 3) 탭 가림 복귀
  const setVisibility = (v: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, v);
  await setVisibility('hidden');
  await expect(carousel).toHaveAttribute('data-autoplay', 'held');
  await expectHoldsOverCycle(page, '탭이 가려진 동안');
  await setVisibility('visible');
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await expectAdvancesWithinCycle(page, '탭 가림에서 돌아온 뒤');
});

test('키보드 Enter 경로(QM2-2 c): Enter로 멈췄다 재개하고 Tab으로 카드 밖 — 포커스가 카드 안인 동안은 한 주기 넘게 불변이고, 카드 밖으로 나가면 한 주기 안에 재개한다', async ({ page }, testInfo) => {
  // REV-003-M2-3 R-235 ②: 완료 기준 (c)는 「키보드(Space·Enter)」인데 Space 경로만 시험했다. Enter는 keydown에서 click이 만들어지고 Space는 keyup에서라 브라우저 경로가 다르다.
  desktopOnly(testInfo);
  await openWithClock(page);
  const carousel = page.getByTestId('carousel');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.mouse.move(2, 2);

  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible)
  await page.getByTestId('carousel-pause').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 다시 시작');
  await expect(carousel).toHaveAttribute('data-autoplay', 'paused');
  await expectConsistent(page, 'Enter로 멈춘 직후');
  await expectHoldsOverCycle(page, 'Enter로 멈춘 동안');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 일시정지');
  await expect(carousel, '재개했어도 포커스가 카드 안이면 멈춘 채다(사유 ⓒ)').toHaveAttribute('data-autoplay', 'held');
  await expectConsistent(page, 'Enter로 재개했지만 포커스가 카드 안일 때');
  await expectHoldsOverCycle(page, 'Enter로 재개했지만 포커스가 카드 안일 때');
  await tabOutOfCard(page); // → 슬라이드 영역 → (첫 장 세대 그래프의 「표로 보기」 요약) → 카드 밖
  expect(await page.evaluate(() => document.querySelector('[data-testid="carousel"]')!.contains(document.activeElement)), '포커스가 카드 밖으로 나갔다').toBe(false);
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await expectConsistent(page, 'Enter 경로로 카드를 떠난 직후');
  await expectAdvancesWithinCycle(page, 'Enter 경로로 카드를 떠난 뒤');
});

test('사유가 겹친 경우(QM2-2 d): 포인터 사유만 풀고 포커스 사유가 남아 있으면 재개하지 않고(한 주기 넘게 불변), 마지막 사유가 풀리면 재개한다', async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await openWithClock(page);
  const carousel = page.getByTestId('carousel');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.mouse.move(2, 2);
  // 키보드 포커스를 카드 안(다음 지표 버튼)에 둔 채 포인터를 카드에 올렸다가 뺀다
  await page.keyboard.press('Tab');
  await page.getByTestId('carousel-next').focus();
  await expect(carousel).toHaveAttribute('data-autoplay', 'held');
  const card = await centerOf(page, 'carousel-viewport');
  await page.mouse.move(card.x, card.y, { steps: 6 });
  await page.mouse.move(2, 2, { steps: 1 });
  await expect(carousel, '포인터는 풀렸지만 키보드 포커스가 남아 있다').toHaveAttribute('data-autoplay', 'held');
  await expectConsistent(page, '포인터만 풀린 상태');
  await expectHoldsOverCycle(page, '포인터만 풀리고 포커스가 남은 동안');
  // 마지막 사유(포커스)가 풀린다: 카드 밖으로 Tab
  await page.getByTestId('carousel-next').blur();
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await expectConsistent(page, '마지막 사유가 풀린 직후');
  await expectAdvancesWithinCycle(page, '마지막 사유가 풀린 뒤');

  // 일시정지 + 포인터: 포인터를 빼도 사용자가 멈춘 것은 남는다
  const pause = await centerOf(page, 'carousel-pause');
  await page.mouse.move(pause.x, pause.y, { steps: 6 });
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(2, 2, { steps: 1 });
  await expect(carousel).toHaveAttribute('data-autoplay', 'paused');
  await expectConsistent(page, '일시정지 + 포인터 이탈');
  await expectHoldsOverCycle(page, '일시정지 상태');
});

test.describe('터치(QM2-2 f, I4)', () => {
  test.use({ hasTouch: true });
  test('360x740 터치: 카드를 탭하거나 스와이프한 뒤에도 한 주기 안에 자동 전환된다 — 터치는 포인터 정지 사유가 아니다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '터치 시험 — 360x740(mobile-360 프로젝트)에서만 실행');
    await openWithClock(page);
    const carousel = page.getByTestId('carousel');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await expect(carousel).toHaveAttribute('data-autoplay', 'on');
    await carousel.scrollIntoViewIfNeeded();
    const body = (await page.getByTestId('carousel-viewport').boundingBox())!;
    // 슬라이드 본문을 탭
    await page.touchscreen.tap(body.x + body.width / 2, Math.min(body.y + 40, 700));
    await expect(carousel, '탭 뒤에도 자동 전환이 켜져 있다').toHaveAttribute('data-autoplay', 'on');
    await expectConsistent(page, '탭 직후');
    await expectAdvancesWithinCycle(page, '탭 뒤');
    // 스와이프(왼쪽으로 밀기) — 실제 터치 포인터 이벤트와 같은 모양
    const before = await currentIndex(page);
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="carousel-viewport"]')!;
      const fire = (type: string, x: number, y: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
      fire('pointerenter', 250, 300);
      fire('pointerdown', 250, 300);
      fire('pointermove', 180, 302);
      fire('pointerup', 120, 305);
      fire('pointerleave', 120, 305);
    });
    expect(await currentIndex(page), '스와이프로 한 장 넘어갔다').not.toBe(before);
    await expect(carousel, '스와이프 뒤에도 자동 전환이 켜져 있다').toHaveAttribute('data-autoplay', 'on');
    await expectAdvancesWithinCycle(page, '스와이프 뒤');
    await page.screenshot({ path: `${SHOTS}/dev-M2-r4-autoplay-touch.png` });
  });
});

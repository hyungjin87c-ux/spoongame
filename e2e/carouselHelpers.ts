import { expect, type Page } from '@playwright/test';

/**
 * 첫 화면 캐러셀 e2e 공용 헬퍼 (QA-003-M2 보완 QM2-2·QM2-5 e2e가 같이 쓴다).
 * first-screen.spec.ts 안의 같은 이름 함수는 그 파일 전용으로 두고(기존 테스트를 건드리지 않는다), 새 e2e는 여기 것을 쓴다.
 */

/** 캐러셀의 현재 순서 「3 / 14」 */
export const countText = (page: Page): Promise<string> => page.getByTestId('carousel-count').innerText();

export const slideCount = (page: Page): Promise<number> => page.getByTestId('stat-slide').count();

/** 지금 보이는 슬라이드의 순서(1부터) */
export async function currentIndex(page: Page): Promise<number> {
  return Number((await countText(page)).split('/')[0].trim());
}

/**
 * 가짜 시계를 깔고(타이머를 직접 흘린다) 첫 화면을 연 뒤 흐름을 멈춘다. 실제 시간이 흘러 7초 타이머가 먼저 울리지 않게 열자마자 멈춘다.
 * 마우스 포인터는 화면 왼쪽 위 구석(캐러셀 밖)에 둔다.
 */
export async function openWithClock(page: Page, url = '/'): Promise<void> {
  await page.clock.install({ time: new Date('2026-10-16T03:10:00Z') });
  await page.goto(url);
  await expect(page.getByTestId('carousel')).toBeVisible();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 300));
  // 입력 가드(400ms)가 풀리도록 시계를 조금 흘린다 — 시계가 멈춰 있으면 가드 타이머도 울리지 않는다
  await tick(page, 500);
  await expect(page.getByTestId('start-birth')).toBeEnabled();
}

/** 가짜 시계를 ms만큼 흘린다. 1초씩 나눠 흘리고 그때마다 React가 다음 타이머를 다시 걸 시간을 준다(한 번에 길게 흘리면 다시 걸리기 전에 지나간다). */
export async function tick(page: Page, ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 1000) {
    await page.clock.runFor(Math.min(1000, left));
    await page.waitForTimeout(40);
  }
}

/** 요소 한가운데의 화면 좌표 (보이는 위치로 스크롤한 뒤) */
export async function centerOf(page: Page, testId: string): Promise<{ x: number; y: number }> {
  const loc = page.getByTestId(testId);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  expect(box, `${testId}가 화면에 있어야 한다`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** 캐러셀의 표시 셋: 안내 문구 · data-autoplay · 일시정지 버튼 이름 (QM2-2 I2) */
export interface AutoplayDisplay {
  auto: string | null;
  note: string;
  pauseName: string | null;
}

export async function autoplayDisplay(page: Page): Promise<AutoplayDisplay> {
  return page.evaluate(() => ({
    auto: document.querySelector('[data-testid="carousel"]')?.getAttribute('data-autoplay') ?? null,
    note: (document.querySelector('[data-testid="carousel-auto-note"]')?.textContent ?? '').trim(),
    pauseName: document.querySelector('[data-testid="carousel-pause"]')?.getAttribute('aria-label') ?? null,
  }));
}

/** 표시 셋이 서로 어긋나지 않는다: 「7초마다 다음 지표」·on·「자동 넘김 일시정지」이거나 「자동 넘김 멈춤」·off (I2). off일 때 안내 문구는 항상 「7초마다…」가 아니어도 된다(포인터·포커스로 멈춘 것은 문구가 그대로다). */
export function displayIsConsistent(d: AutoplayDisplay): string | null {
  if (d.auto === 'on') {
    if (d.note !== '7초마다 다음 지표') return `자동 전환 on인데 안내 문구가 「${d.note}」`;
    if (d.pauseName !== '자동 넘김 일시정지') return `자동 전환 on인데 버튼 이름이 「${d.pauseName}」`;
  }
  if (d.note === '자동 넘김 멈춤' && d.auto !== 'off') return `안내 문구는 「자동 넘김 멈춤」인데 data-autoplay가 ${d.auto}`;
  if (d.pauseName === '자동 넘김 다시 시작' && d.auto !== 'off') return `버튼 이름은 「다시 시작」인데 data-autoplay가 ${d.auto}`;
  return null;
}

import { expect, type Page } from '@playwright/test';

/**
 * 첫 화면 캐러셀 e2e 공용 헬퍼 (QA-003-M2 보완 QM2-2·QM2-5 e2e가 같이 쓴다).
 * first-screen.spec.ts 안의 같은 이름 함수는 그 파일 전용으로 두고(기존 테스트를 건드리지 않는다), 새 e2e는 여기 것을 쓴다.
 */

/**
 * 자동 넘김 주기(ms) — `core/carousel.ts#AUTO_ADVANCE_MS`와 같은 값이다(SPEC-005 마스터 결정 M8: 7초 → 9초). Playwright는 데이터 JSON을 가져올 수 없어(import 속성 필요) 앱 모듈을 읽지 못하므로
 * 값을 여기에 한 번 적고, 같은 값을 tests/carousel.test.ts(「자동 전환 주기는 9초다」)가 상수에서 잠근다 — 둘이 어긋나면 그 시험이 먼저 실패한다.
 */
export const AUTO_MS = 9_000;
/** 「한 주기 안에 넘어간다」를 보는 시간 = 주기 + 1초 여유 */
export const CYCLE_MS = AUTO_MS + 1_000;

/** 캐러셀의 현재 순서 「3 / 14」 */
export const countText = (page: Page): Promise<string> => page.getByTestId('carousel-count').innerText();

export const slideCount = (page: Page): Promise<number> => page.getByTestId('stat-slide').count();

/** 지금 보이는 슬라이드의 순서(1부터) */
export async function currentIndex(page: Page): Promise<number> {
  return Number((await countText(page)).split('/')[0].trim());
}

/**
 * 가짜 시계를 깔고(타이머를 직접 흘린다) 첫 화면을 연 뒤 흐름을 멈춘다. 실제 시간이 흘러 9초 타이머가 먼저 울리지 않게 열자마자 멈춘다.
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

/**
 * 캐러셀의 표시 셋: data-autoplay · 일시정지 버튼 이름 · 일시정지 버튼 아이콘 (QM2-2 I2).
 * SPEC-005 SH4·SH6: 머리글 문구(「7초마다 다음 지표」/「자동 넘김 멈춤」)가 없어져 자동 넘김의 상태 표시는 일시정지 버튼 자체(아이콘 + 이름)가 맡는다.
 */
export interface AutoplayDisplay {
  auto: string | null;
  pauseName: string | null;
  /** 일시정지 버튼 안 아이콘의 스프라이트 id (`#i-pause` 돌고 있음 / `#i-play` 멈춤) */
  pauseIcon: string | null;
}

export async function autoplayDisplay(page: Page): Promise<AutoplayDisplay> {
  return page.evaluate(() => ({
    auto: document.querySelector('[data-testid="carousel"]')?.getAttribute('data-autoplay') ?? null,
    pauseName: document.querySelector('[data-testid="carousel-pause"]')?.getAttribute('aria-label') ?? null,
    pauseIcon: document.querySelector('[data-testid="carousel-pause"] use')?.getAttribute('href') ?? null,
  }));
}

/**
 * 표시 둘이 서로 어긋나지 않는다 (I2): 버튼의 아이콘과 이름은 늘 짝이고(일시정지 아이콘 ↔ 「자동 넘김 일시정지」, 재생 아이콘 ↔ 「자동 넘김 다시 시작」),
 * 자동 전환이 돌고 있으면(on) 일시정지 아이콘·이름이며, 이름이 「다시 시작」이면(사용자가 멈춤) data-autoplay는 off다. 포인터·포커스로 멈춘 것은 버튼 상태가 그대로일 수 있다(사용자가 멈춘 것이 아니다).
 */
export function displayIsConsistent(d: AutoplayDisplay): string | null {
  if (d.pauseName === '자동 넘김 일시정지' && d.pauseIcon !== '#i-pause') return `버튼 이름은 「일시정지」인데 아이콘이 ${d.pauseIcon}`;
  if (d.pauseName === '자동 넘김 다시 시작' && d.pauseIcon !== '#i-play') return `버튼 이름은 「다시 시작」인데 아이콘이 ${d.pauseIcon}`;
  if (d.auto === 'on' && d.pauseName !== '자동 넘김 일시정지') return `자동 전환 on인데 버튼 이름이 「${d.pauseName}」`;
  if (d.pauseName === '자동 넘김 다시 시작' && d.auto !== 'off') return `버튼 이름은 「다시 시작」인데 data-autoplay가 ${d.auto}`;
  return null;
}

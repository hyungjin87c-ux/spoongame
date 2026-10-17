import { expect, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, pressBegin, rouletteState, titleState } from './helpers';
import { BIRTH_VARIANTS, BIRTH_VARIANT_IDS, birthVariantState, type BirthVariantId } from './m3Variants';
import { measureTextResize } from './textResize';

/**
 * M3 새 화면(룰렛·출생신고)의 하단 띠 상태 (SPEC-003 CM10·CM11·QM2-10·QM2-12). 첫 화면의 `titleStates.ts`와 같은 역할이다.
 *  - roulette-spin   룰렛 회전 중: 하단 띠에 「건너뛰기」(보조). 연출이 5.4초면 끝나므로 측정이 길면 `freezeTime`으로 시간을 멈춘다.
 *  - roulette-result 룰렛 결과: 하단 띠에 「출생신고 보기」(기본). 새로고침 복원과 같은 모습(저장을 심어 연다)이라 움직임이 없다.
 *  - birth           출생신고(기준선: 지금 세상·은수저·서울 종로구): 하단 띠에 「살아가기」(기본).
 *  - birth-dirt / birth-diamond / birth-past / birth-future  출생신고의 **가장 긴 내용 표본**(REV-003-M3-1 R-262) — 흙수저·다이아몬드수저·지난 세상·다가올 세상.
 *    표본의 값과 이유는 e2e/m3Variants.ts. 열 때마다 비교 표 행 수·하단 표기 줄 수·긴 장소가 실제로 화면에 있는지 확인한다(공허 통과 방지).
 */
export type M3Screen = 'roulette-spin' | 'roulette-result' | BirthVariantId;

export const M3_SCREENS: readonly M3Screen[] = ['roulette-spin', 'roulette-result', ...BIRTH_VARIANT_IDS];

/** 출생신고 화면 표본들 */
export const BIRTH_SCREENS: readonly M3Screen[] = BIRTH_VARIANT_IDS;

export function isBirthScreen(screen: M3Screen): screen is BirthVariantId {
  return (BIRTH_VARIANT_IDS as readonly string[]).includes(screen);
}

/** 화면마다 하단 띠의 버튼 data-testid */
export function mainButtonOf(screen: M3Screen): string {
  return screen === 'roulette-spin' ? 'skip-roulette' : screen === 'roulette-result' ? 'to-birth' : 'next-life';
}

/** 화면마다 제목(h1) data-testid — 화면이 뜬 뒤 포커스가 가는 곳 */
export function headingOf(screen: M3Screen): string {
  return isBirthScreen(screen) ? 'birth-heading' : 'roulette-heading';
}

/** 화면마다 본문 범위(줄바꿈 감사용) */
export function mainSelectorOf(screen: M3Screen): string {
  return isBirthScreen(screen) ? 'main.doc-page' : 'main.roulette';
}

/** 상태에 맞는 화면을 연다. 입력 가드가 풀린(띠 버튼이 활성인) 뒤에 돌려준다. */
export async function openM3Screen(page: Page, screen: M3Screen, seed = KNOWN_SEED): Promise<void> {
  if (screen === 'roulette-spin') {
    await injectSave(page, titleState(seed));
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  } else if (screen === 'roulette-result') {
    await injectSave(page, rouletteState(seed, 'present', 3, 50));
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
  } else {
    await injectSave(page, birthVariantState(screen, seed));
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    // 공허 통과 방지: 이 표본이 재려던 내용이 화면에 실제로 있다
    const v = BIRTH_VARIANTS[screen];
    await expect(page.getByTestId('compare-row'), `${screen}: 비교 표 행 수 (지금 세상만 3, 그 밖은 표 없음)`).toHaveCount(v.compareRows);
    await expect(page.locator('[data-testid="page-foot"] > p'), `${screen}: 하단 표기 줄 수`).toHaveCount(v.footNotes);
    await expect(page.getByTestId('birth-place'), `${screen}: 태어난 곳에 가장 긴 낱말`).toContainText(v.placeWord);
    await expect(page.getByTestId('peer'), `${screen}: 또래 4명`).toHaveCount(4);
    await expect(page.locator('[data-testid="peers"] .grade[data-grade="5"]'), `${screen}: 또래에 다이아몬드수저(가장 긴 수저 이름)`).toHaveCount(v.peerDiamond ? 1 : 0);
  }
  await expect(page.getByTestId(mainButtonOf(screen))).toBeEnabled();
}

/** 룰렛 회전 중에 연출이 끝나지 않았는지(측정이 끝난 뒤 확인용) */
export async function stillSpinning(page: Page): Promise<boolean> {
  return (await page.getByTestId('roulette-screen').getAttribute('data-state')) === 'spinning';
}

/**
 * 페이지의 시간을 멈춘다(타이머·requestAnimationFrame이 더는 돌지 않는다): 회전 중 화면을 연출이 끝나지 않게 붙들어 두고 측정하기 위해서다.
 * 멈추기 전에 하단 띠의 높이·고정 해제 판정을 정착시키고(measureTextResize가 정착할 때까지 기다린다) 글자 크기 등 rAF가 필요한 준비를 모두 끝내 둔다 —
 * 멈춘 뒤에는 `setRootFontPercent`처럼 rAF를 기다리는 헬퍼를 쓸 수 없다.
 */
export async function freezeTime(page: Page): Promise<void> {
  await measureTextResize(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
}

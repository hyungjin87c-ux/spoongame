import { expect, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState } from './helpers';

/**
 * 첫 화면의 하단 띠 세 상태 (SPEC-003 FS6, QM2-1): 새 판(「태어나기」) · 이어하기(「이어서 살기」+「새로 태어나기」) · 확인 단계(안내+확정+「돌아가기」).
 * 이어하기·확인 단계는 진행 중인 판을 둔 채 첫 화면을 다시 연 상태(개발 서버의 ?__exit 탐침)다 — 제품(Pages) 빌드에서는 「나가기」(M4)가 생기기 전까지 도달할 수 없다.
 * 띠 높이가 상태마다 다르다(새 판 68px · 이어하기 120px · 확인 단계 150px).
 */
export type BarState = 'new' | 'continue' | 'confirm';

export const BAR_STATES: readonly BarState[] = ['new', 'continue', 'confirm'];

/** 상태에 맞는 첫 화면을 연다 */
export async function openBarState(page: Page, state: BarState, seed = KNOWN_SEED): Promise<void> {
  if (state === 'new') {
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeVisible();
    return;
  }
  await injectSave(page, lifeState(seed), '/?__exit=1', { speed: 1, autoMode: false });
  await expect(page.getByTestId('resume')).toBeVisible();
  if (state === 'confirm') {
    await expect(page.getByTestId('begin-new')).toBeEnabled();
    await page.getByTestId('begin-new').click();
    await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  }
}

/** 상태에 따라 띠에서 가장 눈에 띄는(큰) 버튼의 data-testid */
export const BAR_MAIN_BUTTON: Readonly<Record<BarState, string>> = { new: 'start-birth', continue: 'resume', confirm: 'confirm-new-no' };

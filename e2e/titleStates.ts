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

/**
 * 큰 슬롯(「태어날 세대」 목록 `gen-list`)에 줄을 합성해 총 count줄로 만든다 — 세대 줄이 늘어난 경우를 흉내 낸다(SPEC-005 HS3: 슬롯은 줄 수·내용에 의존하지 않는다).
 * 실제 라디오 줄을 복제하고, 각자 따로 Tab이 닿도록 라디오 이름을 다르게 붙인다(복제 줄의 선택은 저장·게임에 영향이 없다 — 화면에서만 존재).
 * 목록은 평소 높이가 제한된 스크롤 창(GS1)이라 줄을 더해도 왼쪽 열이 길어지지 않는다 — 합성할 때는 창 제한을 풀어 줄 수만큼 열이 길어지게 한다.
 */
export async function synthesizeBigSlot(page: Page, count: number): Promise<void> {
  await page.evaluate((n) => {
    const grid = document.querySelector<HTMLElement>('[data-testid="gen-list"]')!;
    grid.style.maxHeight = 'none';
    grid.style.overflow = 'visible';
    const labels = [...grid.querySelectorAll('label')];
    for (let i = labels.length; i < n; i++) {
      const copy = labels[i % labels.length].cloneNode(true) as HTMLElement;
      copy.classList.remove('is-selected');
      const input = copy.querySelector('input')!;
      input.setAttribute('data-testid', `synth-card-${i}`); // 각 라디오가 서로 다른 이름을 가져야 Tab 순회 판정(같은 이름이면 이미 거친 요소로 본다)이 합성 줄을 따로 센다
      input.name = `synth-${i}`;
      input.checked = false;
      copy.querySelector('.gen-row__name')!.textContent = `합성 줄 ${i + 1}`;
      grid.appendChild(copy);
    }
    // 목록이 8줄에서 멈추지 않도록 줄마다 큰 소개 칸을 더해 열이 확실히 길어지게 한다
    for (const label of grid.querySelectorAll<HTMLElement>('label')) label.style.minHeight = '96px';
  }, count);
}

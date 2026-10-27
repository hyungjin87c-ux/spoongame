import { expect, type Page } from '@playwright/test';
import { injectSave, pressBegin, rouletteState, titleState, KNOWN_SEED } from './helpers';
import { BIRTH_VARIANT_IDS, birthVariantState, type BirthVariantId } from './m3Variants';
import { WORD_BREAK_EXTRA_IDS, wordBreakExtraState, type WordBreakExtraId } from './wordBreakVariants';
import type { ParentWealth } from '../src/core/types';

/**
 * 낱말 끊김 감사(QM3-1)의 화면 상태 12종 (+ 움직임 줄이기) — QA-003-M3 감사의 상태와 같다.
 *  - roulette-spin      룰렛 회전 중(시간을 멈춰 붙들고 잰다)
 *  - roulette-result-N  룰렛 결과, 수저 단계 N(1~5) — 지역은 결과 문장이 가장 긴 「광주」(광주광역시 + 지금의 전남광주통합특별시), 단계마다 칩 이름이 다르다
 *  - roulette-reduced   움직임 줄이기: 회전 없이 결과 + 안내 한 줄
 *  - 출생신고 표본 7가지: 가장 긴 내용 표본 5가지(e2e/m3Variants.ts) + 부모 직업·긴 지명 표본 2가지(e2e/wordBreakVariants.ts)
 * 회전 중과 움직임 줄이기는 페이지 시계·미디어 설정을 바꾸므로 같은 페이지에서 다른 상태를 이어 열지 않는다(회전 중은 따로 시험을 둔다).
 */
export type WordBreakStateId = 'roulette-spin' | 'roulette-result-1' | 'roulette-result-2' | 'roulette-result-3' | 'roulette-result-4' | 'roulette-result-5' | 'roulette-reduced' | BirthVariantId | WordBreakExtraId;

export const ROULETTE_RESULT_IDS = ['roulette-result-1', 'roulette-result-2', 'roulette-result-3', 'roulette-result-4', 'roulette-result-5'] as const;

/** 움직임 줄이기·회전 중을 뺀 상태: 한 페이지에서 이어 열어도 된다 */
export const PLAIN_STATE_IDS: readonly WordBreakStateId[] = [...ROULETTE_RESULT_IDS, ...BIRTH_VARIANT_IDS, ...WORD_BREAK_EXTRA_IDS];

/** 출생신고 표본 7가지 */
export const BIRTH_STATE_IDS: readonly WordBreakStateId[] = [...BIRTH_VARIANT_IDS, ...WORD_BREAK_EXTRA_IDS];

export function isRouletteState(id: WordBreakStateId): boolean {
  return id.startsWith('roulette-');
}

/** 결과 상태의 지역: 결과 문장의 글자가 가장 긴 「광주」 — 그 해의 이름 「광주광역시」에 지금의 시도 「전남광주통합특별시」를 병기한다(RG2) */
const LONGEST_REGION = { region: '광주' } as const;

/** 상태를 연다 (회전 중·움직임 줄이기 포함). 입력 가드가 풀린(띠 버튼이 활성인) 뒤에 돌려준다. */
export async function openWordBreakState(page: Page, id: WordBreakStateId, seed = KNOWN_SEED): Promise<void> {
  if (id === 'roulette-spin' || id === 'roulette-reduced') {
    if (id === 'roulette-reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    await injectSave(page, titleState(seed));
    await pressBegin(page);
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', id === 'roulette-spin' ? 'spinning' : 'result');
    await expect(page.getByTestId(id === 'roulette-spin' ? 'skip-roulette' : 'to-birth')).toBeEnabled();
    return;
  }
  const result = /^roulette-result-([1-5])$/.exec(id);
  if (result !== null) {
    await injectSave(page, rouletteState(seed, 'alpha', Number(result[1]) as ParentWealth, 50, { ...LONGEST_REGION }));
    await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'result');
    await expect(page.getByTestId('to-birth')).toBeEnabled();
    return;
  }
  const state = (BIRTH_VARIANT_IDS as readonly string[]).includes(id) ? birthVariantState(id as BirthVariantId, seed) : wordBreakExtraState(id as WordBreakExtraId, seed);
  await injectSave(page, state);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('next-life')).toBeEnabled();
}

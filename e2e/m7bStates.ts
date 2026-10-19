import { expect, type Page } from '@playwright/test';
import type { Era, GameState, PlaySettings } from '../src/core/types';
import { evalCore, injectSave, startPageHidden } from './helpers';

/**
 * M7b(중대 결정 카드 UI·인용, SPEC-003 MD1~MD4)의 e2e 상태 — 특정 카드가 대기 중인 저장 상태를 찾아 심고 화면을 연다.
 * 상태는 앱 페이지가 연 개발 서버의 core로 찾는다(같은 시드·같은 선택 → 같은 상태, 오라클). 앞선 결정은 첫 선택지로 넘긴다.
 */

export const SETTINGS_MANUAL: PlaySettings = { speed: 1, autoMode: false };
export const SETTINGS_AUTO: PlaySettings = { speed: 1, autoMode: true };

/** 카드 `eventId`가 대기 중인 인생 상태. 앱 페이지가 열려 있어야 한다(같은 origin). opts.minChoices: 보이는 선택지가 최소 이만큼 */
export async function findCardState(page: Page, eventId: string, era: Era = 'present', opts: { minChoices?: number; from?: number; to?: number; maxAge?: number } = {}): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= arg.maxAge; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === arg.id && s.pending.choiceIds.length >= arg.min) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { id: eventId, era, min: opts.minChoices ?? 2, from: opts.from ?? 1, to: opts.to ?? 6000, maxAge: opts.maxAge ?? 100 },
  );
  expect(found, `${eventId}(${era}): 결정 카드가 대기 중인 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 상태를 심고 인생 화면을 연다. hidden이면 가려진 탭처럼 앱 타이머를 멈춘 채 연다(시간 경쟁 없이 화면을 준비하려고 — 풀려면 setPageVisible). */
export async function openCard(page: Page, state: GameState, settings: PlaySettings, opts: { query?: string; hidden?: boolean } = {}): Promise<void> {
  if (opts.hidden === true) await startPageHidden(page);
  await injectSave(page, state, opts.query ?? '/', settings);
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

/** 카드가 보이고 입력 가드(400ms)가 풀릴 때까지 기다린다 — 선택지·접기 버튼이 활성이다 */
export async function cardReady(page: Page): Promise<void> {
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
}

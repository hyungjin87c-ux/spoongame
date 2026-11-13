import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, lifeState, oracleAuto, oracleLife } from './helpers';

/**
 * 엔딩 새 디자인(SPEC-003 M7e-3)의 e2e 공통 상태. e2e/m7e3-ending.spec.ts(형태·포커스·증거 화면)가 쓴다.
 * 2026-11-13(결정 후속 256): 출발선 막대의 오라클(`barOracle`)·좌표 측정(`geometry`)과 색 시험(m7e3-ending-colors.spec.ts)은 막대 삭제와 함께 걷었다. 상태 만들기만 남았다.
 */

export type Wealth = 1 | 2 | 3 | 4 | 5;
/** 앞섬(재력 1에서 큰 재산) · 뒤쪽(재력 4에서 빚) · 0원(재력 2에서 정확히 0) · 스무 살 전 */
export type Kind = 'ahead' | 'behind' | 'zero' | 'early';
export const KINDS: readonly Kind[] = ['ahead', 'behind', 'zero', 'early'];

export const SHOT = 'qa/screenshots/003/dev-M7e-3';

/** 알려진 시드의 엔딩 상태(core 자동 진행 결과) — 앱 페이지가 열려 있어야 한다 */
export async function endedBase(page: Page): Promise<GameState> {
  await page.goto('/');
  const ended = await oracleAuto(page, await oracleLife(page, KNOWN_SEED, 'alpha'));
  expect(ended.phase).toBe('ending');
  expect(ended.assets).not.toBeNull();
  return ended;
}

export function withFinal(ended: GameState, wealth: Wealth, net: number): GameState {
  return { ...ended, character: { ...ended.character!, parentWealth: wealth }, assets: { ...ended.assets!, net, debt: Math.max(ended.assets!.debt, -net) } };
}

/** 스무 살 전에 끝난 인생 (e2e/ending.spec.ts와 같은 상태, 합쇼체 연표) */
export function earlyState(): GameState {
  const base = lifeState(KNOWN_SEED);
  return {
    ...base,
    phase: 'ending',
    age: 9,
    history: [
      { age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났습니다.' },
      { age: 3, kind: 'event', title: '첫 말', text: '아이가 처음으로 또렷한 말을 했습니다.', eventId: 'infant-first-word' },
      { age: 7, kind: 'stage', text: '학교에 들어갈 나이가 되었습니다.' },
      { age: 9, kind: 'death', text: '세상을 떠났습니다. 원인은 갑작스러운 병이었습니다.' },
    ],
    death: { age: 9, cause: '갑작스러운 병' },
  };
}

export async function stateOf(page: Page, kind: Kind, base?: GameState): Promise<GameState> {
  if (kind === 'early') return earlyState();
  const ended = base ?? (await endedBase(page));
  if (kind === 'ahead') return withFinal(ended, 1, 150000);
  if (kind === 'behind') return withFinal(ended, 4, -3000);
  return withFinal(ended, 2, 0);
}

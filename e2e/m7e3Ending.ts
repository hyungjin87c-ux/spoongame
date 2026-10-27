import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, lifeState, oracleAuto, oracleLife } from './helpers';

/**
 * 엔딩 새 디자인(SPEC-003 M7e-3)의 e2e 공통 상태·오라클·좌표 측정. e2e/m7e3-ending.spec.ts(형태·포커스·증거 화면)와 e2e/m7e3-ending-colors.spec.ts(색)가 함께 쓴다.
 * 오라클은 개발 서버의 실제 모듈(core/ending.ts·data/endingText.ts)을 브라우저에서 불러 같은 코드로 계산한다.
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

export interface BarOracle {
  kind: 'early' | 'compared';
  wealth: number;
  low: number;
  high: number;
  bandLabel: string;
  endLabel: string | null;
  score: number | null;
  movement: 'up' | 'same' | 'down' | null;
  movementText: string | null;
  ariaLabel: string;
  journeyText: string;
}

/** core·data가 계산한 값 */
export async function barOracle(page: Page, state: GameState): Promise<BarOracle> {
  if (page.url() === 'about:blank') await page.goto('/'); // 스무 살 전 상태는 앱을 열지 않고 만들어진다 — 모듈을 불러오려면 앱 페이지가 열려 있어야 한다
  return page.evaluate<BarOracle>(`(async () => {
    const core = await import('/src/core/index.ts');
    await (await import('/src/data/gameData.ts')).loadGameData(); // MG8: 지연 로드 덩어리를 먼저 불러온다
    const text = await import('/src/data/endingText.ts');
    const birth = await import('/src/data/birthText.ts');
    const state = ${JSON.stringify(state)};
    const j = core.reviewEnding(state).journey;
    const compared = j.kind === 'compared';
    return {
      kind: j.kind,
      wealth: state.character.parentWealth,
      low: j.start.low,
      high: j.start.high,
      bandLabel: text.bandLabel(j.start),
      endLabel: compared ? birth.standingLabel(j.end) : null,
      score: compared ? core.standingScore(j.end) : null,
      movement: compared ? j.movement : null,
      movementText: compared ? text.MOVEMENT_TEXT[j.movement] : null,
      ariaLabel: text.journeyBarLabel(j),
      journeyText: text.journeyText(j),
    };
  })()`);
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}
export interface Geometry {
  bar: Box;
  track: Box;
  band: Box;
  mid: Box;
  end: Box | null;
  card: Box;
  vw: number;
}

export async function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (el === null) return null;
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
    };
    return {
      bar: box(document.querySelector('[data-testid="ending-bar"]'))!,
      track: box(document.querySelector('.journey__track'))!,
      band: box(document.querySelector('.journey__band'))!,
      mid: box(document.querySelector('.journey__mid'))!,
      end: box(document.querySelector('[data-testid="ending-bar-end"]')),
      card: box(document.querySelector('[data-testid="ending-journey-section"]'))!,
      vw: document.documentElement.clientWidth,
    };
  });
}

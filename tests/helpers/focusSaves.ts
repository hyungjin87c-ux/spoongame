import { parseOpened, playToEnd, serializeGame, type GameState } from '../../src/core';
import { preRomancePool } from './preRomancePool';
import { fnv } from './familyGolden';
import { lifeStateAt } from './focusStates';
import save030age0 from '../fixtures/save-v030-age0.json';
import save030age20 from '../fixtures/save-v030-age20.json';
import save030age65 from '../fixtures/save-v030-age65.json';
import save040father from '../fixtures/save-v040-father-ended.json';

/**
 * 「열어서 이어 진행한 결과」 골든의 표본 (SPEC-018 PL10, 설계 4절 ③④): 옛 저장 4개(출생 직후·20대·노년·가족 별세) + 맞춤 판(`persona` 있고 `focus`만 없는 v0.6.0 모양) 4개.
 * 값은 **초점 코드를 넣기 전** 트리의 `life.ts`·`storage.ts`·`session.ts`로 얼렸다 — 초점이 없는 저장을 열어 끝까지 이어 가면 변경 전과 바이트로 같아야 한다.
 */
export const SAVE_SAMPLES: ReadonlyArray<readonly [string, () => string]> = [
  ['v030-age0', () => JSON.stringify(save030age0)],
  ['v030-age20', () => JSON.stringify(save030age20)],
  ['v030-age65', () => JSON.stringify(save030age65)],
  ['v040-father-ended', () => JSON.stringify(save040father)],
  ['v060-persona-age14-millennial', () => serializeGame(lifeStateAt(11, 'millennial', 14, preRomancePool()))],
  ['v060-persona-age25-industrial', () => serializeGame(lifeStateAt(222, 'industrial', 25, preRomancePool()))],
  ['v060-persona-age45-alpha', () => serializeGame(lifeStateAt(3333, 'alpha', 45, preRomancePool()))],
  ['v060-persona-age70-genx', () => serializeGame(lifeStateAt(44444, 'genx', 70, preRomancePool()))],
];

/** 저장 원문을 열어 끝까지 자동으로 이어 간 결과의 해시 (열 때의 상태도 해시에 넣는다) */
export function continuedHash(raw: string): string {
  const opened = parseOpened(raw) as GameState | null;
  if (opened === null) throw new Error('샘플 저장이 열리지 않는다');
  const run = playToEnd(opened, null, preRomancePool()); // PL17-R 전 풀로 고정(얼린 값 불변)
  return fnv(JSON.stringify([opened, run.state, run.counts, run.last]));
}

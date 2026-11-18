import { describe, expect, it } from 'vitest';
import { playToEnd, withFocusEnabled, type GameState } from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { FOCUS_GOLDEN_ERAS, FOCUS_GOLDEN_STRATEGIES, focusCell, focusSeedOf, type FocusCell } from './helpers/focusGolden';
import { SAVE_SAMPLES, continuedHash } from './helpers/focusSaves';

/**
 * 올해의 초점 골든 ① (SPEC-018 PL10, 설계 `docs/data/focus-spend-model.md` 4절) — **초점 코드를 넣기 전** 커밋에서 변경 전 코드로 얼렸다(CX-006 공정 이탈 재발 방지).
 * 맞춤 인생을 켠 판(출하 값)의 시대 3개 × 전략 2 × 시드 100판: 전 생애 최종 상태·counts·마지막 틱의 해시 · 앞쪽 8판의 `rngState` 열 · 평균 카드 수·나이.
 * 초점 코드가 들어간 뒤에도 「초점 없음」 판은 이 값과 바이트로 같아야 한다. 고쳐 맞추지 않는다(One-way).
 */
const FROZEN: Readonly<Record<string, FocusCell>> = {
  'industrial/auto': { hash: 'a49651fa', rng: [2105820178, 3121309181, 2425538465, 3185262680, 402161363, 4200757834, 3369528424, 3561358166], cards: 27070, age: 82440 },
  'industrial/first': { hash: 'fa308006', rng: [906090035, 3121309181, 657913849, 3185262680, 281855269, 4200757834, 657938453, 2177380732], cards: 26430, age: 81290 },
  'millennial/auto': { hash: '4224037b', rng: [906090035, 3121309181, 721855046, 3185262680, 281855269, 4200757834, 4257128882, 402179816], cards: 28340, age: 82870 },
  'millennial/first': { hash: '3ea01902', rng: [2105820178, 3121309181, 721855046, 3185262680, 402161363, 1857662445, 3369528424, 402179816], cards: 27870, age: 82700 },
  'alpha/auto': { hash: '74bb71c8', rng: [906090035, 3121309181, 721855046, 3185262680, 281855269, 4200757834, 593997256, 4136828939], cards: 28550, age: 84240 },
  'alpha/first': { hash: '3d39c5f4', rng: [906090035, 3121309181, 2801609347, 3185262680, 402161363, 4200757834, 3369528424, 4136828939], cards: 27810, age: 82530 },
};

describe('focusRng ① 얼린 맞춤 켠 판 (초점 없음 = 변경 전)', () => {
  for (const era of FOCUS_GOLDEN_ERAS) {
    for (const strategy of FOCUS_GOLDEN_STRATEGIES) {
      it(`${era} / ${strategy}`, { timeout: 300_000 }, () => {
        expect(focusCell(era, strategy)).toEqual(FROZEN[`${era}/${strategy}`]);
      });
    }
  }
});

/**
 * ③④ 옛 저장을 열어 끝까지 이어 간 결과 (설계 4절): 값은 초점 코드를 넣기 **전** 트리의 `life.ts`·`storage.ts`·`session.ts`로 얼렸다(`tests/helpers/focusSaves.ts`).
 * 옛 저장 4개(출생 직후·20대·노년·가족 별세, `persona` 없음)와 `persona`는 있고 `focus`만 없는 v0.6.0 모양 맞춤 판 4개 — 초점 없는 저장은 변경 전과 바이트로 같다.
 */
const SAVES_FROZEN: Readonly<Record<string, string>> = {
  'v030-age0': 'd5c6cd9d',
  'v030-age20': '1bb3a838',
  'v030-age65': '50632ce0',
  'v040-father-ended': 'ce0063f1',
  'v060-persona-age14-millennial': '41413c57',
  'v060-persona-age25-industrial': '1c595c78',
  'v060-persona-age45-alpha': '379fa0f8',
  'v060-persona-age70-genx': '1f993b7c',
};

describe('focusRng ③④ 얼린 저장 샘플을 열어 이어 간 결과 (초점 없음 = 변경 전)', () => {
  for (const [name, raw] of SAVE_SAMPLES) {
    it(name, { timeout: 120_000 }, () => {
      expect(continuedHash(raw())).toBe(SAVES_FROZEN[name]);
    });
  }
});

/**
 * ② 스위치 끔 = 초점 없음: 저장된 `focus`가 있어도(통과·보존) `FOCUS_ENABLED`가 꺼지면 추첨이 닿지 않아 결과가 초점 없는 판과 같다. 켜면 다르다(공허 통과 방지).
 */
describe('focusRng ② FOCUS_ENABLED 끔 = 초점 없음', () => {
  const run = (seed: number, focus: GameState['focus'], on: boolean): string => {
    const s0 = startLife(seed, 'millennial');
    const start: GameState = focus === undefined ? s0 : { ...s0, focus };
    return withFocusEnabled(on, () => JSON.stringify(playToEnd(start)));
  };

  it('끈 채 저장된 초점(관계, 모든 구간을 마침)이 있는 판은 40판 모두 초점 없는 판과 같다 (저장된 focus 필드만 다르다)', () => {
    for (let i = 1; i <= 40; i++) {
      const seed = focusSeedOf(i);
      const withFocus = JSON.parse(run(seed, { id: 2, sec: 3 }, false)) as { state: Record<string, unknown> };
      const plain = JSON.parse(run(seed, undefined, false)) as { state: Record<string, unknown> };
      expect(withFocus.state.focus, `시드 ${seed}: 통과·보존`).toEqual({ id: 2, sec: 3 });
      delete withFocus.state.focus;
      expect(withFocus, `시드 ${seed}`).toEqual(plain);
    }
  });

  it('켠 채에서는 초점이 닿아 적어도 한 판은 결과가 달라진다', () => {
    let differs = 0;
    for (let i = 1; i <= 40; i++) {
      const seed = focusSeedOf(i);
      const a = JSON.parse(run(seed, { id: 2, sec: 3 }, true)) as { state: Record<string, unknown> };
      const b = JSON.parse(run(seed, undefined, true)) as { state: Record<string, unknown> };
      delete a.state.focus;
      if (JSON.stringify(a) !== JSON.stringify(b)) differs++;
    }
    expect(differs).toBeGreaterThan(0);
  });
});

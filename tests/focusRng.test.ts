import { describe, expect, it } from 'vitest';
import { FOCUS_GOLDEN_ERAS, FOCUS_GOLDEN_STRATEGIES, focusCell, type FocusCell } from './helpers/focusGolden';

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

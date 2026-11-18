import { describe, expect, it, vi } from 'vitest';
import { FOCUS_GOLDEN_ERAS, FOCUS_GOLDEN_STRATEGIES, focusCell, type FocusCell } from './helpers/focusGolden';

// 맞춤 인생을 끈 판 — 「persona 없는 판 = 옛 저장·스위치를 끈 판」 경로(rngSnapshot.test.ts 전례)
vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }));

/** 올해의 초점 골든 ① 맞춤 끈 판 — `tests/focusRng.test.ts`와 같은 표본, 초점 코드를 넣기 전 커밋에서 얼렸다 */
const FROZEN: Readonly<Record<string, FocusCell>> = {
  'industrial/auto': { hash: '5741f7cd', rng: [3433432715, 3057367984, 657913849, 2113414931, 281855269, 1857662445, 3369528424, 3561358166], cards: 24590, age: 81850 },
  'industrial/first': { hash: '418ca7d8', rng: [2865538242, 3057367984, 721855046, 2113414931, 402161363, 1857662445, 657938453, 402179816], cards: 24460, age: 82160 },
  'millennial/auto': { hash: '2e295346', rng: [26065877, 3561321260, 657913849, 3185262680, 281855269, 4200757834, 4257128882, 721885801], cards: 24960, age: 83140 },
  'millennial/first': { hash: 'eaca43f5', rng: [26065877, 3121309181, 721855046, 3185262680, 281855269, 3689228258, 657938453, 402179816], cards: 24780, age: 83140 },
  'alpha/auto': { hash: '668682f0', rng: [26065877, 3561321260, 721855046, 3185262680, 281855269, 4200757834, 657938453, 402179816], cards: 24740, age: 82930 },
  'alpha/first': { hash: 'ee0f92bf', rng: [26065877, 3121309181, 657913849, 3185262680, 281855269, 3689228258, 3369528424, 402179816], cards: 24480, age: 81910 },
};

describe('focusRng ① 얼린 맞춤 끈 판 (초점 없음 = 변경 전)', () => {
  for (const era of FOCUS_GOLDEN_ERAS) {
    for (const strategy of FOCUS_GOLDEN_STRATEGIES) {
      it(`${era} / ${strategy}`, { timeout: 300_000 }, () => {
        expect(focusCell(era, strategy)).toEqual(FROZEN[`${era}/${strategy}`]);
      });
    }
  }
});

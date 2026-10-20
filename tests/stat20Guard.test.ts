import { describe, expect, it } from 'vitest';
import { ERAS, autoResolveStep, resolveChoiceStep, stepYear, type Era, type GameState } from '../src/core';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 20세 평균 스탯 가드 (SPEC-003 M7a r2 마스터 결정 r2-1, REV-003-M7e-1 R-382 (b) — 마스터가 시험으로 잠그라고 했다):
 * 영유아·학창기 콘텐츠가 스탯을 올려 소득 배수 계단(지식 30·50·70)을 넘는 사람을 늘리면 경제 재보정이 다시 필요해진다(M7a r1: 20세 평균이 HEAD 대비 +3~+8이 되어 AGE 곱을 1.88로 올렸다).
 * 그래서 같은 시드(i × 7919 + 13) 3000판을 무작위 선택으로 20세까지 돌려 20세가 된 순간 살아 있는 판의 스탯 평균이 **기준선 대비 항목마다 +2 이하, 관계만 +3 이하**임을 지킨다.
 * 8세 시점 가드(`tests/infantContent.test.ts` "r2: 영유아 콘텐츠가 스탯을 크게 올리지 않는다")는 0~7세 변경만 본다 — 이 시험은 학창기(8~19세) 변경까지 본다.
 *
 * **기준선 교체 (SPEC-005 EK1·승인 A14, 2026-10-20)**: 옛 기준선 `HEAD_AT_20`은 M7a 이전 main `5fa0c54`에서 잰 값이었고 영유아·학창 *콘텐츠 변경*을 지키려는 것이었다. QI5(부모 결정, PD)는 0~18세 선택을
 * 사람이 고르던 방식에서 「부모님이 정하고 일부는 흘러가는」 방식으로 바꾸므로 20세 시작 상태가 구조적으로 움직인다 — 지금 세상 지식이 이미 +2.02(한계 +2.05)라 옛 가드는 반드시 깨진다.
 * 그래서 *콘텐츠 변경 없이 PD 구현 직후*(QI5 구현 트리, 부모 확률 모델 PARENT_PRIORITY·PARENT_FIT·ε 0.15·T_p 8·PD13 본인 영역 가중 ×2.0 확정 뒤 — 마스터 결정 9절 3번: 처음 ×1.5로 쟀던 기준선을 ×2.0으로 다시 쟀다)에 **같은 함수·같은 표본(3000판, 무작위 선택)**으로
 * 새 기준선 `PD_AT_20`을 소수 넷째 자리까지 쟀다. 한도 +2 / +3(관계)과 `KNOWN_OVER`는 이 새 기준선 대비 **앞으로의 콘텐츠 변경**에만 적용한다(옛 `KNOWN_OVER`의 지금 세상 지식 +2.05는 새 기준선에서 0이라 비웠다).
 *
 * PD로 인한 이동 크기(새 − 옛 = 부모 결정·흘러감을 끈 같은 트리의 3000판; 끈 쪽은 옛 문서의 +0.84/+1.78/+1.78/+2.55 · +2.02/+1.82/+1.42/+2.47 · +1.27/+1.13/+1.52/+0.90을 소수 셋째 자리까지 그대로 재현했다 — 비교 기준이 옳다는 증거):
 *   지난 지식 +1.13 · 건강 +0.03 · 행복 +0.66 · 관계 +1.15 / 지금 +0.04 · +0.37 · +0.90 · +1.51 / 다가올 +0.31 · +0.34 · +0.83 · +1.62 (표준오차 지식 0.32 · 건강 0.12 · 행복 0.10 · 관계 0.09). 처음 ×1.5로 쟀을 때는 지식 +1.13/+0.10/+0.40 · 건강 −0.05/+0.30/+0.27 · 행복 +0.60/+0.85/+0.77 · 관계 +1.04/+1.41/+1.49였다.
 *   설계 문서 4-7절 손계산(지식 +1~+3, 건강 0~+1, 행복 −1~−2, 관계 ±0.5)과 비교: 지식은 예측보다 작고(부모가 학력만 고르지 않고 확률 모델의 ε·적합도가 섞인다), 건강은 예측 범위의 아래쪽이며,
 *   행복·관계는 **예측과 반대로 올랐다** — 무작위로 고르던 0~18세 선택을 합리적인 결정(스탯 합이 큰 쪽이 더 잘 뽑히는)이 대신하니 모든 스탯이 같이 오르는 효과가 있다(옛 방식은 무작위라 평균 0에 가까웠다). 마스터가 한도 안의 소폭 상승으로 수용했다(설계 문서 9절 5번, 4-7절에 실측 기록).
 * 새 효과가 한계를 넘으면 옛 값을 고쳐 맞추지 말고 효과를 줄이거나 마스터에게 보고한다(경제 재보정이 따라온다).
 *
 * 「한도 안」의 뜻 (R-453): 설계 문서 9절 5번의 「한도 안」은 **PD 전 트리(`PRE_PD_AT_20`) 대비 이동량**이 한도 +2 / +3 안이라는 뜻이다(위 이동 크기 표). 옛 `HEAD_AT_20` 대비로는 한도를 넘는 항목이 여럿이다 —
 *   `PD_AT_20 − HEAD_AT_20`: 지난 지식 +1.97 · 건강 +1.81 · 행복 **+2.43** · 관계 **+3.70** / 지금 지식 **+2.06** · 건강 **+2.18** · 행복 **+2.32** · 관계 **+3.98** / 다가올 지식 +1.58 · 건강 +1.47 · 행복 **+2.35** · 관계 +2.51 (굵은 칸이 옛 한도 초과) —
 * 그래서 기준선을 교체했고, 이 시험의 한도는 새 기준선 대비 *앞으로의 콘텐츠 변경*에만 적용된다. 기준선은 현재 트리와 0.01 이내라 앞으로 0~19세 콘텐츠를 바꾸면 효과를 줄이는 쪽이 먼저이고, 불가피하면 기준선 재측정과 보고 상한 수정을 마스터 승인으로 처리한다.
 *
 * (옛 측정 기록, 보존) 기준선 재측정(REV-003-M7e-2 R-386): M7a 이전 main `5fa0c54`의 깨끗한 작업 사본에서 같은 함수·같은 표본으로 소수 네 자리까지 — 지난 [48.8433, 71.8704, 45.9292, 57.3532] · 지금 [53.5594, 71.7390, 46.8715, 54.5077] ·
 * 다가올 [54.2591, 71.8239, 47.5979, 53.8409] (지식·건강·행복·관계). 옛 가드는 이 값 대비 +2/+3이었다.
 */

/** QI5 구현 *직전* 트리(부모 결정·흘러감 끔 = 옛 방식, 0~18세를 사람이 고름)에서 같은 함수·표본으로 잰 20세 평균 [지식, 건강, 행복, 관계] — PD 이동 크기를 보고하는 기준으로만 쓴다(가드 기준선은 `PD_AT_20`).
 *  M7a 이전 `5fa0c54`(옛 `HEAD_AT_20`: 지난 [48.8433, 71.8704, 45.9292, 57.3532] · 지금 [53.5594, 71.7390, 46.8715, 54.5077] · 다가올 [54.2591, 71.8239, 47.5979, 53.8409]) 대비로는 옛 문서의 +0.84/+1.78/+1.78/+2.55 …와 같다. */
const PRE_PD_AT_20: Record<Era, [number, number, number, number]> = {
  past: [49.6833, 73.6508, 47.7057, 59.9037],
  present: [55.5755, 73.5588, 48.2956, 56.9729],
  future: [55.5257, 72.9556, 49.1198, 54.737],
};
/** 가드 기준선: QI5(PD) 구현 직후 같은 함수·같은 표본(시드 i × 7919 + 13, 3000판, 무작위 선택)으로 잰 20세 평균 [지식, 건강, 행복, 관계] — 살아서 20세가 된 판 2990·2994·2996개 */
const PD_AT_20: Record<Era, [number, number, number, number]> = {
  past: [50.8147, 73.6756, 48.3619, 61.0525],
  present: [55.6179, 73.9238, 49.1914, 58.484],
  future: [55.8391, 73.2934, 49.9466, 56.3528],
};
/** PD로 이동한 크기(`PD_AT_20 − PRE_PD_AT_20`)의 보고한 상한 — 기준선을 다시 재서 몰래 올리는 일을 막는다(올리려면 마스터 승인 + 이 표 수정) */
const REPORTED_SHIFT_CAP: Record<Era, [number, number, number, number]> = {
  past: [1.14, 0.03, 0.66, 1.15],
  present: [0.05, 0.37, 0.9, 1.52],
  future: [0.32, 0.34, 0.83, 1.62],
};
const LIMIT = [2, 2, 2, 3] as const;
const NAMES = ['지식', '건강', '행복', '관계'] as const;
/** 새 기준선(PD_AT_20) 대비 *앞으로의 콘텐츠 변경*에서 보고한 차이(마스터 수용 대기): `시대:항목 인덱스`의 한계 — 한도보다 크고, 이 값보다 나빠지지 않아야 한다. 지금은 없다 */
const KNOWN_OVER: Record<string, { limit: number; why: string }> = {};
const LIVES = 3000;

/** 20세가 된 순간(독립 직전의 자산 계산은 스탯에 닿지 않는다) 살아 있는 판의 스탯 평균. `post`는 그 순간의 판을 바꿔 보는 훅이다(가드가 실제로 잡는지 대조하는 시험이 쓴다) */
function meansAt20(era: Era, post: (s: GameState) => GameState = (s) => s): { n: number; mean: [number, number, number, number] } {
  const sums = [0, 0, 0, 0];
  let n = 0;
  for (let i = 1; i <= LIVES; i++) {
    const seed = (i * 7919 + 13) >>> 0;
    let s: GameState = startLife(seed, era);
    const chooser = chooserFor('random', seed);
    for (let g = 0; s.phase === 'life' && s.age < 20; g++) {
      if (g >= 3000) throw new Error('진행이 끝나지 않는다');
      const r =
        s.pending !== null
          ? (() => {
              const picked = chooser === null ? null : chooser(s);
              return picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
            })()
          : stepYear(s);
      s = r.state;
    }
    if (s.phase !== 'life' || s.age < 20) continue;
    s = post(s);
    n++;
    sums[0] += s.stats.education;
    sums[1] += s.stats.health;
    sums[2] += s.stats.happiness;
    sums[3] += s.stats.relationships;
  }
  return { n, mean: sums.map((x) => x / n) as [number, number, number, number] };
}

/** 한도(항목 +2·관계 +3)를 넘은 항목 — 보고한 차이(`KNOWN_OVER`)는 그 한계를 넘었을 때만 위반이다 */
function violations(era: Era, mean: readonly number[], known: Record<string, { limit: number; why: string }> = KNOWN_OVER): string[] {
  const out: string[] = [];
  mean.forEach((v, i) => {
    const diff = v - PD_AT_20[era][i];
    const limit = known[`${era}:${i}`]?.limit ?? LIMIT[i];
    if (diff > limit) out.push(`${era} ${NAMES[i]} 변화 ${diff.toFixed(3)} > 한계 ${limit}`);
  });
  return out;
}

describe('20세 평균 스탯 가드 (R-382 b, R-386, EK1): PD_AT_20(QI5 구현 직후 기준선) 대비 항목마다 +2 이하, 관계만 +3 이하 — 세 시대 3000판', () => {
  for (const era of ERAS) {
    it(`${era}: 지식·건강·행복 +2 이하, 관계 +3 이하 (기준선 PD_AT_20 대비)`, () => {
      const { n, mean } = meansAt20(era);
      expect(n, '20세까지 산 판 수(공허 통과 방지)').toBeGreaterThan(LIVES * 0.95);
      expect(violations(era, mean)).toEqual([]);
    });
  }

  it('기준선이 현재 트리의 진짜 값이다 (공허 통과 방지): 세 시대 모두 현재 평균이 PD_AT_20과 소수 둘째 자리까지 같다 — 콘텐츠를 바꾸지 않았다면 차이는 반올림뿐이다', () => {
    for (const era of ERAS) {
      const { mean } = meansAt20(era);
      mean.forEach((v, i) => expect(Math.abs(v - PD_AT_20[era][i]), `${era} ${NAMES[i]}`).toBeLessThan(0.01));
    }
  });

  it('PD 이동 크기는 보고한 표를 넘지 않는다 (기준선 PD_AT_20 − PRE_PD_AT_20 ≤ 보고 상한; 기준선을 다시 재서 올리면 이 시험이 알린다 — 마스터 승인 대상)', () => {
    for (const era of ERAS) {
      PD_AT_20[era].forEach((v, i) => {
        const shift = v - PRE_PD_AT_20[era][i];
        expect(shift, `${era} ${NAMES[i]} 이동 ${shift.toFixed(3)}`).toBeLessThanOrEqual(REPORTED_SHIFT_CAP[era][i]);
      });
    }
  });

  it('가드가 실제로 잡는다(공허 통과 방지): meansAt20 경로에서 20세가 된 판의 지식을 +2.5·관계를 +3.5 올리면(가짜 판) 지식·관계가 위반이고 건강·행복은 아니다 — 한 시대(지난 세상)로 확인', () => {
    const real = meansAt20('past');
    expect(violations('past', real.mean), '진짜 판은 통과').toEqual([]);
    const fake = meansAt20('past', (s) => ({ ...s, stats: { ...s.stats, education: Math.min(100, s.stats.education + 3), relationships: Math.min(100, s.stats.relationships + 4) } }));
    const found = violations('past', fake.mean);
    expect(found.length, found.join(' / ')).toBe(2);
    expect(found.some((v) => v.includes('지식'))).toBe(true);
    expect(found.some((v) => v.includes('관계'))).toBe(true);
    expect(found.some((v) => v.includes('건강') || v.includes('행복'))).toBe(false);
    // 지금 세상도 같다: 지식 +3을 더하면 위반(새 기준선 대비 약 +3.0 > 한도 +2)
    const bump = meansAt20('present', (s) => ({ ...s, stats: { ...s.stats, education: Math.min(100, s.stats.education + 3) } }));
    expect(violations('present', bump.mean).some((v) => v.includes('지식'))).toBe(true);
  });
});

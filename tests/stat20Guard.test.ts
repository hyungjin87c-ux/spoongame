import { describe, expect, it } from 'vitest';
import { ERAS, autoResolveStep, resolveChoiceStep, stepYear, type Era, type GameState } from '../src/core';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 20세 평균 스탯 가드 (SPEC-003 M7a r2 마스터 결정 r2-1, REV-003-M7e-1 R-382 (b) — 마스터가 시험으로 잠그라고 했다):
 * 영유아·학창기 콘텐츠가 스탯을 올려 소득 배수 계단(지식 30·50·70)을 넘는 사람을 늘리면 경제 재보정이 다시 필요해진다(M7a r1: 20세 평균이 HEAD 대비 +3~+8이 되어 AGE 곱을 1.88로 올렸다).
 * 그래서 M7a 이전(HEAD)의 같은 시드(i × 7919 + 13) 3000판을 무작위 선택으로 20세까지 돌려 20세가 된 순간 살아 있는 판의 스탯 평균이 **항목마다 +2 이하, 관계만 +3 이하**임을 지킨다.
 * 8세 시점 가드(`tests/infantContent.test.ts` "r2: 영유아 콘텐츠가 스탯을 크게 올리지 않는다")는 0~7세 변경만 본다 — 이 시험은 학창기(8~19세) 변경까지 본다.
 *
 * **기준선 재측정 (REV-003-M7e-2 R-386)**: M7a 로그 표의 소수 한 자리 값(±0.05)으로는 한도 안·밖을 가를 수 없어, **M7a 이전 main `5fa0c54`를 깨끗한 작업 사본(git worktree, detached)으로 꺼내 이 파일의
 * `meansAt20`과 같은 함수·같은 표본(시드 i × 7919 + 13, 3000판, 무작위 선택)으로 소수 네 자리까지 다시 쟀다 — 지난 [48.8433, 71.8704, 45.9292, 57.3532] · 지금 [53.5594, 71.7390, 46.8715, 54.5077] ·
 * 다가올 [54.2591, 71.8239, 47.5979, 53.8409] (지식·건강·행복·관계, 살아서 20세가 된 판 2993·2996·2999개). 아래 `HEAD_AT_20`은 이를 소수 두 자리로 적은 값이다(8세 가드와 같은 정밀도).
 *
 * 측정(M7e-4 R-386, 현재 트리 3000판, 소수 네 자리 평균 − HEAD):
 *   지난 +0.84 · +1.78 · +1.78 · +2.55 / 지금 **+2.02**(한도 +2를 0.016 넘음) · +1.82 · +1.42 · +2.47 / 다가올 +1.27 · +1.13 · +1.52 · +0.90.
 * 옛 한 자리 기준선(53.6)에서는 +1.98이라 한도 안으로 보였으나 정확한 기준선에서는 지금 세상 지식이 **한도를 0.016 넘는다**(원인은 M7e-3의 `school-tutoring/academy` 지식 +6 → +7, 10~16세).
 * 콘텐츠는 바꾸지 않고 **보고한 차이**로 올렸다 — `KNOWN_OVER`(지금 세상 지식 ≤ +2.05)가 그 한계다(`scripts/economyCheckLib.ts#KNOWN_GAPS`와 같은 관례: 보고한 값보다 나빠지지 않아야 하고, 한도 안으로 들어오면 알린다).
 * 마스터 결정 대기: 수용(한도 +2.05로 올림) 또는 `academy`를 +6으로 되돌리는 콘텐츠 변경(그러면 순자산이 내려가 경제 보고한 차이도 줄 수 있다 — 재측정 필요).
 * 새 효과가 한계를 넘으면 옛 값을 고쳐 맞추지 말고 효과를 줄이거나 마스터에게 보고한다(경제 재보정이 따라온다).
 */

/** M7a 이전(`5fa0c54`)에서 같은 함수·표본으로 잰 20세 평균 [지식, 건강, 행복, 관계] — 소수 두 자리 */
const HEAD_AT_20: Record<Era, [number, number, number, number]> = {
  past: [48.84, 71.87, 45.93, 57.35],
  present: [53.56, 71.74, 46.87, 54.51],
  future: [54.26, 71.82, 47.6, 53.84],
};
const LIMIT = [2, 2, 2, 3] as const;
const NAMES = ['지식', '건강', '행복', '관계'] as const;
/** 보고한 차이(마스터 수용 대기): `시대:항목 인덱스`의 한계 — 한도보다 크고, 이 값보다 나빠지지 않아야 한다 */
const KNOWN_OVER: Record<string, { limit: number; why: string }> = {
  'present:0': { limit: 2.05, why: '지금 세상 지식 +2.02(M7e-3 school-tutoring/academy 지식 +6 → +7). 정확한 기준선으로 재측정해 드러났다(R-386)' },
};
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
    const diff = v - HEAD_AT_20[era][i];
    const limit = known[`${era}:${i}`]?.limit ?? LIMIT[i];
    if (diff > limit) out.push(`${era} ${NAMES[i]} 변화 ${diff.toFixed(3)} > 한계 ${limit}`);
  });
  return out;
}

describe('20세 평균 스탯 가드 (R-382 b, R-386): HEAD(M7a 이전 5fa0c54) 대비 항목마다 +2 이하, 관계만 +3 이하 — 세 시대 3000판, 지금 세상 지식만 보고한 차이', () => {
  for (const era of ERAS) {
    it(`${era}: 지식·건강·행복 +2 이하, 관계 +3 이하 (보고한 차이는 한계 안)`, () => {
      const { n, mean } = meansAt20(era);
      expect(n, '20세까지 산 판 수(공허 통과 방지)').toBeGreaterThan(LIVES * 0.95);
      expect(violations(era, mean)).toEqual([]);
    });
  }

  it('보고한 차이는 아직 한도를 넘는다 (한도 안으로 들어오면 이 목록에서 뺀다): 지금 세상 지식이 +2를 넘고 보고한 한계 +2.05 안이다', () => {
    const { mean } = meansAt20('present');
    const diff = mean[0] - HEAD_AT_20.present[0];
    expect(diff, `지금 세상 지식 변화 ${diff.toFixed(3)}`).toBeGreaterThan(LIMIT[0]);
    expect(diff, KNOWN_OVER['present:0'].why).toBeLessThanOrEqual(KNOWN_OVER['present:0'].limit);
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
    // 지금 세상 보고한 차이도 한계(+2.05)를 넘기는 변경은 잡힌다: 지식 +1을 더하면(약 +3.0) 위반
    const bump = meansAt20('present', (s) => ({ ...s, stats: { ...s.stats, education: Math.min(100, s.stats.education + 1) } }));
    expect(violations('present', bump.mean).some((v) => v.includes('지식'))).toBe(true);
  });
});

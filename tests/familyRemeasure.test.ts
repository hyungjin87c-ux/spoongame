import { describe, expect, it } from 'vitest';
import { SIBLING_COUNT_RULE, familyTables } from '../src/core';
import { VARIANTS, measureVariant, mean, tierStats, type LifeRow } from '../scripts/familyRemeasureLib';

/**
 * 분포 재측정 시험 (SPEC-009 FM4b, `docs/data/family-model.md` 12-1절 L2): 해시 L1은 K2·K4·이른 부모 별세 효과를 끈 세계에서만 지키므로(tests/familyHash.test.ts), 켠 세계의 **분포**는 여기서 같은 시드로 짝지어 지킨다.
 * 큰 표본의 보고(7세대 × 2000판, 표와 해석)는 `docs/data/family-remeasure.md` (`npm run report:family -- 2000 --write`) — 이 시험은 그보다 작은 고정 표본(세대당 300판)으로 합격 기준 중 **표본이 작아도 흔들리지 않는 것**만 단언한다:
 *   ① 최종 순자산 평균 변화 ≤ 3% ② 단계 순서 뒤바뀜 0 (20세 시작·최종 순자산 평균) ③ (엔딩 방향 판정 분포 변화 ≤ 2%p는 결정 후속 256으로 걷었다) ④ 효과가 걸린 판 비율이 걸리는 이유(19세 이하 부모 별세)와 맞다.
 * ①의 20세 시작 평균 절대 변화 ≤ 150만 원은 5단계 표본이 작아 걸린 판 수에 크게 흔들리므로 큰 표본 보고서(`scripts/familyRemeasure.ts#passes`, 1절)가 판정한다. 중앙값은 보고만 한다(마스터 결정 2026-11-02).
 */
const PER_GEN = 300;
const V = Object.fromEntries(VARIANTS.map((v) => [v.id, v])) as Record<string, (typeof VARIANTS)[number]>;

describe('이른 부모 별세 효과의 분포 (V2 → V3, 같은 시드 짝)', () => {
  const v2 = measureVariant(V.V2, PER_GEN);
  const v3 = measureVariant(V.V3, PER_GEN);

  it('효과는 19세 이하에 부모 한 분이 떠난 판에만 걸리고, 그 판 비율은 세대가 이를수록 높다(산업화 ≫ 알파)', () => {
    expect(v3.length).toBe(v2.length);
    const hit = (rows: LifeRow[], gen: string): number => rows.filter((r) => r.gen === gen && r.earlyLoss).length / PER_GEN;
    expect(hit(v3, 'industrial')).toBeGreaterThan(hit(v3, 'genx'));
    expect(hit(v3, 'genx')).toBeGreaterThan(hit(v3, 'alpha'));
    expect(hit(v3, 'industrial')).toBeGreaterThan(0.2);
    expect(hit(v3, 'alpha')).toBeLessThan(0.15);
    // 효과가 걸리지 않은 판은 V2와 20세 시작·최종 순자산이 같다(난수 흐름이 같고 효과가 없다)
    const same = new Map(v2.map((r) => [`${r.gen}/${r.seed}`, r]));
    let identical = 0;
    for (const r of v3.filter((x) => !x.earlyLoss)) {
      const o = same.get(`${r.gen}/${r.seed}`)!;
      if (o.net20 === r.net20 && o.finalNet === r.finalNet && o.deathAge === r.deathAge) identical++;
    }
    expect(identical, '효과가 없는 판은 변화 없음').toBe(v3.filter((x) => !x.earlyLoss).length);
  });

  it('② 단계 순서 뒤바뀜 0: 20세 시작·최종 순자산 평균이 재력 단계 순서를 지킨다', () => {
    const order = (rows: LifeRow[], key: 'meanNet20' | 'meanFinalNet'): number[] => [1, 2, 3, 4, 5].map((t) => tierStats(rows, t)[key]);
    for (const key of ['meanNet20', 'meanFinalNet'] as const) {
      const a = order(v2, key);
      const b = order(v3, key);
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) if (a[i] <= a[j]) expect(b[i] <= b[j] + 1e-9, `${key} 단계 ${i + 1} ≤ ${j + 1}이 뒤집혔다`).toBe(true);
    }
  });

  it('① 재력 단계별 최종 순자산 평균 변화 ≤ 3% (분모 바닥 1,000만 원, scripts/familyRemeasure.ts#rel과 같은 정의)', () => {
    for (const t of [1, 2, 3, 4, 5]) {
      const a = tierStats(v2, t).meanFinalNet;
      const b = tierStats(v3, t).meanFinalNet;
      expect((Math.abs(b - a) / Math.max(Math.abs(a), 1000)) * 100, `${t}단계 ${a} → ${b}`).toBeLessThanOrEqual(3);
    }
  });


  it('효과 크기: 효과가 걸린 판의 20세 시작 순자산이 평균 수백만 원 낮아지고(재력 배율 0.8~2.0), 걸리지 않은 판은 그대로다', () => {
    const base = new Map(v2.map((r) => [`${r.gen}/${r.seed}`, r]));
    const d = v3.filter((r) => r.earlyLoss && r.net20 !== null).map((r) => r.net20! - (base.get(`${r.gen}/${r.seed}`)!.net20 ?? 0));
    expect(d.length).toBeGreaterThan(100);
    expect(mean(d)).toBeLessThan(-200);
    expect(mean(d)).toBeGreaterThan(-1200);
  });
}, 600_000);

describe('K1은 FM6에서 켰다 (형제 수 규칙은 새 정의, 옛 규칙은 측정 전용 훅)', () => {
  it('SIBLING_COUNT_RULE은 view이고, 새 정의로 상속을 나누면 형제 수가 늘어 상속액 평균이 내려간다(옛 규칙은 측정 전용 훅 withSiblingCountRule)', () => {
    expect(SIBLING_COUNT_RULE).toBe('view');
    const rows = measureVariant(V.V4, 100);
    expect(mean(rows.map((r) => r.siblingsView))).toBeGreaterThan(mean(rows.map((r) => r.siblingsLegacy)));
    expect(mean(rows.map((r) => r.inheritView))).toBeLessThan(mean(rows.map((r) => r.inheritLegacy)));
    // V3는 K1을 켜기 전(옛 규칙)의 세계다 — 같은 시드의 V3와 V4(배포 값)는 상속이 다르다
    const v3 = measureVariant(V.V3, 100);
    expect(v3.some((r, i) => r.finalNet !== rows[i].finalNet)).toBe(true);
  }, 300_000);
});

describe('1945년 이전 출생 어머니 보정과 설계값 표', () => {
  it('보정 표는 모든 코호트가 FD6 센서스 코호트 평균에 맞춘 값이다(tests/familyBirth.test.ts T-FA3c가 ±0.45를 단언) — 표는 근거 칸과 함께 있다', () => {
    const d = familyTables().design;
    expect(d.highOrderContinue.basis).toBe('design');
    expect(d.highOrderContinue.note.length).toBeGreaterThan(30);
    expect(d.earlyLoss.basis).toBe('design');
    expect(d.home.basis).toBe('design');
  });
});

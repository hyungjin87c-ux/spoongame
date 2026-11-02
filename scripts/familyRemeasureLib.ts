import {
  GENERATION_IDS,
  autoResolveStep,
  countTick,
  emptyCounts,
  estimatePlaySeconds,
  inheritanceAmount,
  reviewEnding,
  siblingCountOf,
  stepYear,
  timingEraOfProfile,
  withSiblingCountRule,
  yearLineCount,
  type EndingGame,
  type EventPool,
  type GameState,
  type ProfileId,
  type SiblingCountRule,
  type TickCounts,
} from '../src/core';
import { eventPool } from '../src/core';
import { EARLY_LOSS_HALF, withEarlyLoss, withEarlyLossRule } from './familyRulesLib';
import { k2OnlyPool, preFm4bPool } from './preFm4bPool';
import { startLife } from './simulateLib';
import { spreadSeeds } from '../tests/helpers/familyGolden';

/**
 * 가족 변경(SPEC-009 FM4b)의 분포 재측정 (설계 문서 12-1절 L2, 4-7절 (1) 합격 기준, 7-1절 K1): 같은 시드의 같은 판을 **원인별로 하나씩 켠 세계**에서 돌려 나란히 잰다.
 *   V0 FM4a 기준(FM4b 전 영유아·학창 이벤트 · 이른 별세 효과 끔 · 형제 수 옛 규칙)
 *   V1 + K2(동생 반응 카드를 구성이 정한 해에 강제)
 *   V2 + K4(가족 낱말 사건에 가족 조건 — 지금의 풀)
 *   V3 + 이른 부모 별세 효과 ← 배포 값(K1은 꺼 둔다)
 *   V4 + K1(형제 수 새 정의로 상속) — 켜지 않는다, 켰을 때의 영향만 잰다
 * 같은 시드·같은 선택 전략(자동 성향)이라 변이 사이의 차이는 켠 원인에서만 온다(짝지은 표본). 실행: `npm run report:family` (docs/data/family-remeasure.md를 쓴다).
 */

export interface Variant {
  id: 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V3h';
  label: string;
  pool: () => EventPool;
  /** true 배포 값 · false 끔 · 'half' 효과 절반(측정용 대안) */
  earlyLoss: boolean | 'half';
  rule: SiblingCountRule;
}

export const VARIANTS: readonly Variant[] = [
  { id: 'V0', label: 'FM4a 기준 (FM4b 전 풀 · 효과 끔 · 옛 형제 수)', pool: preFm4bPool, earlyLoss: false, rule: 'legacy' },
  { id: 'V1', label: '+ K2 (동생 반응 카드 강제)', pool: k2OnlyPool, earlyLoss: false, rule: 'legacy' },
  { id: 'V2', label: '+ K4 (가족 낱말 사건에 가족 조건)', pool: eventPool, earlyLoss: false, rule: 'legacy' },
  { id: 'V3', label: '+ 이른 부모 별세 효과 (배포 값)', pool: eventPool, earlyLoss: true, rule: 'legacy' },
  { id: 'V4', label: '+ K1 켜기 (형제 수 새 정의로 상속)', pool: eventPool, earlyLoss: true, rule: 'view' },
  { id: 'V3h', label: '(대안) 이른 별세 효과를 절반으로', pool: eventPool, earlyLoss: 'half', rule: 'legacy' },
];

export interface LifeRow {
  gen: ProfileId;
  seed: number;
  tier: number;
  /** 20세 독립 직후 순자산(만 원), 20세 전에 끝난 판은 null */
  net20: number | null;
  /** 판이 끝났을 때 순자산(만 원), 20세 전에 끝난 판은 null */
  finalNet: number | null;
  /** 엔딩 방향 판정(up·same·down), 스무 살 전에 끝나면 early */
  movement: 'up' | 'same' | 'down' | 'early';
  deathAge: number;
  /** 19세 이하에 부모 한 분이 떠났는가(이른 별세 효과 대상) */
  earlyLoss: boolean;
  /** 끝난 판의 형제 수: 옛 규칙 · 새 정의 */
  siblingsLegacy: number;
  siblingsView: number;
  /** 상속액(만 원): 두 규칙으로 계산한 값 */
  inheritLegacy: number;
  inheritView: number;
  /** 가족 변화 줄 수(fam-) */
  famLines: number;
  /** 한 판 추정 시간(초, 1배속 수동·읽는 시간 중앙): 가족 줄 포함 · 뺀 값 */
  seconds1x: number;
  seconds1xNoFam: number;
  /** 이 판의 최종 인생 기록 줄 수 */
  historyLength: number;
}

/** 줄을 연표 줄과 같은 규칙으로 센다(FA0-7)는 약속에서 가족 줄을 뺀 추정 시간 — 가족 줄만 있는 해는 서술 해에서 조용한 해로, 다른 줄이 있는 해는 줄 대기를 뺀다 */
function secondsWithoutFamily(final: GameState, counts: TickCounts, era: ReturnType<typeof timingEraOfProfile>): number {
  const c: TickCounts = { ...counts };
  const ages = new Set(final.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => h.age));
  for (const age of ages) {
    const fam = final.history.filter((h) => h.age === age && (h.eventId ?? '').startsWith('fam-')).length;
    const all = yearLineCount(final.history, age);
    if (all > fam) c.extraLines -= fam; // 다른 줄이 있는 해: 줄 대기만 줄어든다
    else {
      // 가족 줄만 있는 해: 서술 해 하나가 조용한 해로 (줄이 둘 이상이면 그 둘째 줄부터의 대기도 뺀다)
      c.narrative = Math.max(0, c.narrative - 1);
      c.quiet += 1;
      c.extraLines -= Math.max(0, fam - 1);
    }
  }
  c.extraLines = Math.max(0, c.extraLines);
  return estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, final.lifeLength, era, 'median');
}

/** 한 변이의 한 판: `playToEnd`와 같은 걸음(자동 성향)으로 돌리며 20세 순자산·걸음 집계를 함께 센다 */
export function runLife(v: Variant, gen: ProfileId, seed: number): LifeRow {
  const run = <T>(fn: () => T): T => (v.earlyLoss === 'half' ? withEarlyLoss(true, () => withEarlyLossRule(EARLY_LOSS_HALF, fn)) : withEarlyLoss(v.earlyLoss, fn));
  return run(() =>
    withSiblingCountRule(v.rule, () => {
      const pool = v.pool();
      let s: GameState = startLife(seed, gen);
      let net20: number | null = null;
      const counts = emptyCounts();
      for (let g = 0; s.phase === 'life' && g < 400; g++) {
        const r = s.pending !== null ? autoResolveStep(s, s.pending.key, pool) : stepYear(s, pool);
        s = r.state;
        countTick(counts, r.tick, s.lifeLength);
        if (net20 === null && s.assets !== null && s.age >= 20) net20 = s.assets.net;
      }
      if (s.phase !== 'ending' || s.death === null) throw new Error(`${gen}/${seed}: 사망에 도달하지 못했다`);
      const tier = s.character!.parentWealth;
      const review = reviewEnding(s as EndingGame);
      const movement = review.journey.kind === 'compared' ? review.journey.movement : 'early';
      const reached = s.death.age >= 20 && s.assets !== null;
      const era = timingEraOfProfile(gen);
      const legacy = siblingCountOf(s, 'legacy');
      const view = siblingCountOf(s, 'view');
      return {
        gen,
        seed,
        tier,
        net20,
        finalNet: reached ? s.assets!.net : null,
        movement,
        deathAge: s.death.age,
        earlyLoss: s.family!.l.some((e) => e[0] === 5 && e[1] <= 19),
        siblingsLegacy: legacy,
        siblingsView: view,
        inheritLegacy: inheritanceAmount(tier, legacy),
        inheritView: inheritanceAmount(tier, view),
        famLines: s.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).length,
        seconds1x: estimatePlaySeconds(counts, { speed: 1, skipToDecision: false }, s.lifeLength, era, 'median'),
        seconds1xNoFam: secondsWithoutFamily(s, counts, era),
        historyLength: s.history.length,
      };
    }),
  );
}

export interface TierStats {
  n: number;
  medianNet20: number;
  medianFinalNet: number;
  meanNet20: number;
  meanFinalNet: number;
  nFinal: number;
  movement: { up: number; same: number; down: number; early: number };
}

const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function tierStats(rows: readonly LifeRow[], tier: number): TierStats {
  const t = rows.filter((r) => r.tier === tier);
  const m = { up: 0, same: 0, down: 0, early: 0 };
  for (const r of t) m[r.movement]++;
  return {
    n: t.length,
    medianNet20: median(t.filter((r) => r.net20 !== null).map((r) => r.net20!)),
    medianFinalNet: median(t.filter((r) => r.finalNet !== null).map((r) => r.finalNet!)),
    meanNet20: mean(t.filter((r) => r.net20 !== null).map((r) => r.net20!)),
    meanFinalNet: mean(t.filter((r) => r.finalNet !== null).map((r) => r.finalNet!)),
    nFinal: t.filter((r) => r.finalNet !== null).length,
    movement: m,
  };
}

/** 한 변이를 7세대 × `perGen`판 돌린다 (세대마다 다른 시드 열) */
export function measureVariant(v: Variant, perGen: number): LifeRow[] {
  const rows: LifeRow[] = [];
  GENERATION_IDS.forEach((gen, gi) => {
    for (const seed of spreadSeeds(perGen, gi)) rows.push(runLife(v, gen, seed));
  });
  return rows;
}

export const GEN_LIST = GENERATION_IDS;

/** 보고서 끝에 붙는 읽는 법 (정적 글 — 숫자는 위 표에서 읽는다) */
export const REPORT_NOTES = `## 5. 읽는 법과 한계

- **중앙값 변화 ≤ 3%(합격 기준 ①)** — 낮은 재력 단계의 20세 시작 순자산은 학자금 대출 바닥(−150만 원 등)에 모여 있어, 효과가 걸린 판이 17%뿐이어도 중앙값이 한 칸(150만 원) 옮겨 가면 상대 변화가 크게 읽힌다. 그래서 표에 평균을 함께 두었다. 평균 기준의 변화는 1절 표의 평균 칸이다. 효과를 절반으로 줄인 대안(V3h)도 같은 칸에서 같은 모양이라, 크기를 줄여도 이 칸은 풀리지 않는다 — 기준 ①을 평균으로 바꿀지는 마스터가 정한다.
- **K2·K4(2절)의 중앙값 흔들림**은 효과가 아니라 난수 흐름이 옮겨 간 잡음이다(같은 사건 풀을 공유하지 않는 세계끼리라 짝지은 표본이어도 사건이 달라진다) — 같은 규칙의 이른 별세 효과(V2 → V3)는 난수 흐름이 같아 짝이 정확하다.
- **K1(3절)** 형제 수는 \`siblingCountOf(final, 'view')\`(살아 있는 형제 전원, 독립 포함, 별세 제외)와 옛 규칙의 비교이고, 상속액은 \`INHERIT[재력] ÷ (형제 수 + 1)\`을 두 값으로 계산한 평균이다. 출산이 많던 코호트(산업화·베이비붐)에서 새 정의의 형제 수가 크게 늘어(FM4b의 1940년 이전 어머니 보정이 출산 수를 센서스 평균에 맞췄다) 상속액이 절반 가까이 준다.
- **판 길이(4절)**는 자동 성향 선택으로 잰 추정 시간이다(판정에 쓰는 수동 흉내·시대별 표본은 \`tests/simulation.test.ts\`·\`npm run report:time\`). 가족 줄을 뺀 값은 같은 판의 걸음 집계에서 가족 줄만 있는 해를 조용한 해로 바꾸고, 다른 줄이 있는 해는 줄 대기를 뺀 근사다.
`;

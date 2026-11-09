import { describe, expect, it } from 'vitest';
import '../src/data/installAll';
import { GENERATION_IDS } from '../src/core';
import { ASK_KINDS, ASK_PET_ENABLED } from '../src/data/askTable';
import { cardMoveOf, choiceShare, dominanceOf, exposureOf, grantRows, poolWithoutAsk, sampleAsk, strainStats, type AskLife, type AskStrategy } from '../scripts/askReportLib';

/**
 * 조르기 시뮬레이션 (SPEC-011 AK10, 완료 기준 1·2·6·7·8·10 — `npm run report:ask`와 같은 표본): 7세대 × 1000판 = 7000판, 20세 전까지. 전략 셋 — 자동 성향 · 무작위 수동 흉내 · 기대 행복 최대.
 * 수치는 ▲(설계값)이고 이 시험은 설계 문서 `docs/data/ask-model.md` 12절 표의 판정을 그대로 단언한다. 기대 행복 최대 전략의 선택 분포는 **보고만**이다(AQ9).
 */

const LIVES = 1000;
const sampleAll = (st: AskStrategy): AskLife[] => GENERATION_IDS.flatMap((era, gi) => sampleAsk(era, LIVES, st, undefined, gi)); // 세대마다 시드 구간을 띄워 7세대 표본이 독립이다(scripts/askReportLib.ts#GENERATION_SEED_STRIDE)
const auto = sampleAll('auto');
const random = sampleAll('random');
const evmax = sampleAll('evmax');
const bySeed = (lives: AskLife[], era: string): AskLife[] => lives.filter((l) => l.era === era);

describe('AK10 노출·나이·수 (완료 기준 1·2) — 7세대 × 1000판', () => {
  it('3세 이하·13세 이상 0건, 4세는 장난감뿐, 같은 해 2장 0, 한 종류 최대 1장, 판당 최대 3장 — 두 전략 모두', () => {
    expect(auto).toHaveLength(7000);
    for (const [name, lives] of [['auto', auto], ['random', random]] as const) {
      for (const l of lives) {
        expect(l.asks.length, `${name}#${l.seed}`).toBeLessThanOrEqual(3);
        expect(l.sameYearAsk, `${name}#${l.seed}`).toBe(0);
        for (const a of l.asks) {
          expect(a.age).toBeGreaterThanOrEqual(4);
          expect(a.age).toBeLessThanOrEqual(12);
          if (a.age === 4) expect(a.kind).toBe('toy');
        }
        for (const k of ASK_KINDS) expect(l.asks.filter((a) => a.kind === k).length).toBeLessThanOrEqual(1);
        if (!ASK_PET_ENABLED) expect(l.asks.some((a) => a.kind === 'pet')).toBe(false);
      }
    }
  });

  it('노출: 4~12세에 조르기 카드가 1장 이상 나온 판 ≥ 80%▲ · 판당 평균 1.5~2.5장▲ — 세대별 7개 모두 (반려동물 꺼짐 — 장난감 60·예체능 55)', () => {
    for (const era of GENERATION_IDS) {
      const e = exposureOf(bySeed(auto, era));
      expect(e.shareAtLeast1, `${era} 1장 이상`).toBeGreaterThanOrEqual(0.8);
      expect(e.mean, `${era} 평균`).toBeGreaterThanOrEqual(1.5);
      expect(e.mean, `${era} 평균`).toBeLessThanOrEqual(2.5);
    }
    const all = exposureOf(auto);
    expect(all.dist[0] + all.dist[1] + all.dist[2] + all.dist[3]).toBeCloseTo(1, 12);
    expect(all.kindShare.toy).toBeGreaterThan(0.6);
    expect(all.kindShare.lessons).toBeGreaterThan(0.6);
    expect(all.kindShare.pet).toBe(0);
  });

  it('카드 이동: 조르기 사건을 넣으면 부모+흘러감 카드가 줄고 본인 카드가 는다 (판당 평균, 같은 시드·같은 전략의 기준선과 견줌) — 이동 폭을 이 시험이 잠근다', () => {
    const base = poolWithoutAsk();
    const without = GENERATION_IDS.flatMap((era, gi) => sampleAsk(era, 300, 'auto', base, gi));
    const withAsk = GENERATION_IDS.flatMap((era, gi) => sampleAsk(era, 300, 'auto', undefined, gi));
    const a = cardMoveOf(without);
    const b = cardMoveOf(withAsk);
    expect(a.parent + a.child, '기준선(조르기 없음) 부모+흘러감').toBeGreaterThan(5);
    expect(b.parent + b.child, '조르기가 칸을 나눠 쓴다').toBeLessThan(a.parent + a.child - 1);
    expect(b.self - a.self, '본인 카드 증가 = 조르기 평균 장수').toBeGreaterThan(1.2);
    expect(b.self - a.self).toBeLessThan(2.2);
    expect(a.diedYoung, '20세 전 사망 비율은 조르기와 무관').toBeCloseTo(b.diedYoung, 2);
  }, 120_000);

  it('결정론: 같은 시드·같은 전략은 같은 관찰이다 (진행 난수는 조르기 때문에 흩어지지 않는다)', () => {
    const again = sampleAsk('genx', 100, 'auto', undefined, GENERATION_IDS.indexOf('genx'));
    expect(again).toEqual(bySeed(auto, 'genx').slice(0, 100));
  });
});

describe('AK10 들어줌 비율 (완료 기준 6) — 무작위 전략 표본', () => {
  const rows = grantRows(random);

  it('종류 × 선택(조른다·떼쓴다)마다 재력 단계가 오르면 들어줌 비율이 오르고(실측 5단계 − 1단계 ≥ 30%p▲), 식의 기대값과 4σ 안이다', () => {
    let cells = 0;
    for (const kind of ASK_KINDS.filter((k) => ASK_PET_ENABLED || k !== 'pet')) {
      for (const choice of ['beg', 'tantrum'] as const) {
        const rs = [1, 2, 3, 4, 5].map((w) => rows.find((r) => r.kind === kind && r.wealth === w && r.choice === choice));
        for (const r of rs) {
          expect(r, `${kind}/${choice}`).toBeDefined();
          if (r!.n >= 30) {
            expect(Math.abs(r!.granted - r!.expected), `${kind}/W${r!.wealth}/${choice} n=${r!.n}`).toBeLessThanOrEqual(4 * r!.sd + 1e-9);
            cells++;
          }
        }
        // 식의 기대값은 재력에 단조 증가(사이 평균이 단계마다 조금씩 달라 한 칸은 비교 폭 안에서 본다)
        for (let i = 1; i < 5; i++) expect(rs[i]!.expected, `${kind}/${choice} 기대값 ${i + 1}단계`).toBeGreaterThanOrEqual(rs[i - 1]!.expected - 0.02);
        if (rs[0]!.n >= 30 && rs[4]!.n >= 30) expect(rs[4]!.granted - rs[0]!.granted, `${kind}/${choice} 5−1단계`).toBeGreaterThanOrEqual(0.3);
        else expect(rs[4]!.expected - rs[0]!.expected, `${kind}/${choice} 기대 5−1단계`).toBeGreaterThanOrEqual(0.3);
      }
    }
    expect(cells, '검증한 칸').toBeGreaterThanOrEqual(15);
  });
});

describe('AK10 사이 비용 (완료 기준 7·8)', () => {
  it('parent_strained는 떼쓰다 거절당한 갈래에서만 생기고(그 밖 0건), 그 비율이 s(C) 기대값과 4σ 안이다 — 세 전략 모두', () => {
    for (const [name, lives] of [['auto', auto], ['random', random], ['evmax', evmax]] as const) {
      const s = strainStats(lives);
      expect(s.strainedOutsideTantrumDenied, name).toBe(0);
      expect(s.tantrumDenied, `${name} 표본`).toBeGreaterThan(300);
      expect(Math.abs(s.strained - s.expected), `${name}: 실측 ${s.strained} 기대 ${s.expected.toFixed(1)}`).toBeLessThanOrEqual(4 * s.sd);
    }
  });

  it('참는다는 확정 결과다 — 어느 판에서도 endure 갈래가 사이 나빠짐·들어줌이 되지 않고, 사이 나빠짐이 있으면 판 끝까지 플래그가 남는다', () => {
    for (const l of [...auto, ...random]) {
      for (const a of l.asks) if (a.choice === 'endure') expect(a.branch).toBe('endure');
      if (l.asks.some((a) => a.branch === 'strained')) expect(l.strainedAtEnd).toBe(true);
      else expect(l.strainedAtEnd).toBe(false);
    }
  });
});

describe('AK10 지배 방지·선택 분포 (완료 기준 10, AQ9)', () => {
  it('자동 성향: (종류 × 재력 × 양육 방식 × 사이 C) 칸(표본 ≥ 30)에서 한 선택지 ≤ 90%▲, 세 선택지 모두 전체에서 5% 이상', () => {
    const cells = dominanceOf(auto);
    expect(cells.length).toBeGreaterThanOrEqual(30);
    for (const c of cells) expect(c.max, `${c.cell} n=${c.n}`).toBeLessThanOrEqual(0.9);
    const sh = choiceShare(auto);
    expect(sh.beg).toBeGreaterThan(0.05);
    expect(sh.tantrum).toBeGreaterThan(0.05);
    expect(sh.endure).toBeGreaterThan(0.05);
  });

  it('기대 행복 최대 전략의 선택 분포는 보고만 한다(AQ9) — 떼쓰기 비율이 60%를 넘으면 마스터가 11절 사다리 사용 여부를 정한다. 이 시험은 값이 계산되고 합이 1임만 본다', () => {
    const sh = choiceShare(evmax);
    expect(sh.beg + sh.tantrum + sh.endure).toBeCloseTo(1, 12);
    expect(sh.n).toBeGreaterThan(5000);
    // 보고용 로그: `npm run report:ask`의 「AQ9 판정 재료」와 같은 값 — 60% 초과 여부는 마스터 판단 재료
    console.info(`AQ9 기대 행복 최대 전략 선택 비율: 조른다 ${(sh.beg * 100).toFixed(1)}% · 떼를 쓴다 ${(sh.tantrum * 100).toFixed(1)}% · 참는다 ${(sh.endure * 100).toFixed(1)}%`);
  });
});

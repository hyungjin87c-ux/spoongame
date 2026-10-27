import { describe, expect, it } from 'vitest';
import {
  PARENT_WEALTHS,
  PEER_BLOCK_YEARS,
  PEER_MAX_SEEKING_YEARS,
  PEER_MIN_HOLD_YEARS,
  PEER_SEEKING_COOLDOWN_YEARS,
  PEER_STATUS_AGES,
  PEER_STATUS_LABEL,
  peerStatusSeries,
  peersNow,
  stepYear,
  type ParentWealth,
  type PeerStatus,
} from '../src/core';
import { SIM_PROFILES, startLife } from '../scripts/simulateLib';

/**
 * 한 해짜리 끼임 0 — 새 상태는 최소 2년 유지한다 (QA-003-M4 N10c, 마스터 결정).
 * QA 실측: 또래 168명 중 「한 해만 끼는 A → B → A 흔들림」이 48건(예: 일하는 사람 → 학교에 다님 → 일하는 사람)이었다. 인생 운을 4년 블록으로 다시 뽑는 시각(블록 경계 4의 배수)과
 * 규칙표가 바뀌는 시각(구간 경계 19·25·30·45·55·65·75·90세)이 한 해 간격으로 겹칠 때, 그리고 「구직 중」 상한(4년)이 걸릴 때 생겼다.
 * 규칙(src/core/peerNow.ts#peerStatusSeries): 바뀌려는 새 라벨이 다음 해에는 있을 수 없으면(허용 나이를 벗어남·「구직 중」 상한) 시작하지 않고 이전 라벨을 잇고,
 * 시작한 새 상태가 다음 해에 또 바뀌려 하면 한 해 더 이어 두 해를 채운다. 앞 나이의 라벨은 뒤 나이에 영향받지 않는다(한 해 앞의 후보는 maxAge와 무관하게 정해진다).
 * 은퇴 뒤 「일하는 사람」 복귀 자체는 고령 노동(표의 의도)이라 허용한다 — 막은 것은 한 해짜리 끼임이지 복귀가 아니다.
 * 마스터 기준(R-328: 흙수저 평생 미취업 ≤ 5%·「구직 중」 최장 연속 ≤ 4년)과 나이별 분포는 tests/peerNowSample.test.ts가 그대로 본다.
 */

const N = 4000;
const inAges = (s: PeerStatus, age: number) => age >= PEER_STATUS_AGES[s].min && age <= PEER_STATUS_AGES[s].max;

/** 시드 n개의 또래 줄기 (순번 0) — tests/peerNowSample.test.ts와 같은 시드 */
function lives(wealth: ParentWealth, n: number, maxAge = 120, options: Parameters<typeof peerStatusSeries>[4] = {}): PeerStatus[][] {
  return Array.from({ length: n }, (_, k) => peerStatusSeries(1000 + k * 7919, 0, wealth, maxAge, options));
}

function longestRun(series: readonly PeerStatus[], s: PeerStatus): number {
  let best = 0;
  let run = 0;
  for (const x of series) {
    run = x === s ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** 줄기를 같은 라벨의 연속 구간으로 */
function runsOf(series: readonly PeerStatus[]): Array<{ label: PeerStatus; start: number; length: number }> {
  const out: Array<{ label: PeerStatus; start: number; length: number }> = [];
  series.forEach((label, age) => {
    const last = out[out.length - 1];
    if (last !== undefined && last.label === label) last.length++;
    else out.push({ label, start: age, length: 1 });
  });
  return out;
}

/** 끝 구간을 뺀 모든 구간 중 길이 1짜리(= 한 해만 끼었다 바뀐 것)와, 그중 앞뒤 라벨이 같은 것(A → B → A) */
function singleYearRuns(series: readonly PeerStatus[]): { single: string[]; sandwiched: string[] } {
  const runs = runsOf(series);
  const single: string[] = [];
  const sandwiched: string[] = [];
  // 마지막 구간은 지금 막 시작했을 수 있어(어느 나이에서 멈춰 봐도 같은 규칙이다) 뺀다. 첫 구간은 길이 7(어린 시절)이라 해당 없다.
  for (let i = 0; i < runs.length - 1; i++) {
    if (runs[i].length !== 1) continue;
    const label = `${runs[i].start}세 ${PEER_STATUS_LABEL[runs[i].label]}`;
    single.push(label);
    if (i > 0 && runs[i - 1].label === runs[i + 1].label) sandwiched.push(label);
  }
  return { single, sandwiched };
}

describe('한 해짜리 끼임 0: 새 상태는 최소 2년 유지한다 (QA-003-M4 N10c)', () => {
  it('규칙 값: 최소 유지 2년. 블록 길이(4년)·구직 중 상한(4년)·쉬는 해(4년)와 R-328 기준 값은 그대로다', () => {
    expect(PEER_MIN_HOLD_YEARS).toBe(2);
    expect(PEER_BLOCK_YEARS).toBe(4);
    expect(PEER_MAX_SEEKING_YEARS).toBe(4);
    expect(PEER_SEEKING_COOLDOWN_YEARS).toBe(4);
  });

  it('대량 표본: 5개 수저 단계 × 4000명 × 0~120세에서 한 해짜리 끼임(끝 구간 제외)이 0건이고 A → B → A도 0건이다', () => {
    let people = 0;
    let runCount = 0;
    const bad: string[] = [];
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, N)) {
        people++;
        runCount += runsOf(series).length;
        const { single } = singleYearRuns(series);
        if (single.length > 0) bad.push(`수저 ${w}: ${single.join(', ')}`);
      }
    }
    expect(bad.slice(0, 5), '한 해짜리 끼임이 있는 줄기').toEqual([]);
    expect(people).toBe(PARENT_WEALTHS.length * N);
    expect(runCount / people, '공허 통과 방지: 줄기마다 여러 번 바뀐다(모든 구간이 길다고 통과한 것이 아니다)').toBeGreaterThan(8);
  });

  it('대조: 같은 표본을 예전 모델(minHoldYears 1)로 만들면 한 해짜리 끼임이 수만 건이고 A → B → A가 그중 절반쯤이다 — 시험이 실제로 결함을 잡는다 (QA 실측: 또래 168명 중 48건)', () => {
    let people = 0;
    let withSingle = 0;
    let single = 0;
    let sandwiched = 0;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, N, 120, { minHoldYears: 1 })) {
        people++;
        const r = singleYearRuns(series);
        if (r.single.length > 0) withSingle++;
        single += r.single.length;
        sandwiched += r.sandwiched.length;
      }
    }
    expect(single, '예전 모델의 한 해짜리 끼임').toBeGreaterThan(10_000);
    expect(sandwiched, '예전 모델의 A → B → A').toBeGreaterThan(5_000);
    expect(withSingle / people, '예전 모델에서 한 번이라도 끼임이 있는 사람').toBeGreaterThan(0.3);
  });

  it('끼임이 몰리던 자리마다 사라졌다: 학교 → 일 → 학교(19세), 일 → 학교 → 일(24세), 일 → 은퇴 → 일(55세), 64세·75세 — 예전 모델에는 많고 새 모델에는 하나도 없다', () => {
    const where = [19, 24, 55, 64, 75];
    const count = (options: Parameters<typeof lives>[3]) => {
      const hits = new Map<number, number>();
      for (const w of PARENT_WEALTHS) {
        for (const series of lives(w, N, 120, options)) {
          for (const r of runsOf(series).slice(0, -1)) if (r.length === 1 && where.includes(r.start)) hits.set(r.start, (hits.get(r.start) ?? 0) + 1);
        }
      }
      return hits;
    };
    const old = count({ minHoldYears: 1 });
    for (const age of where) expect(old.get(age) ?? 0, `예전 모델 ${age}세 한 해짜리`).toBeGreaterThan(100);
    expect(count({}).size, '새 모델은 어느 자리에도 없다').toBe(0);
  });

  it('은퇴 뒤 「일하는 사람」 복귀(고령 노동)는 그대로 허용된다 — 복귀가 있고 복귀한 「일하는 사람」은 두 해 이상 이어진다. 막은 것은 한 해짜리 끼임이다', () => {
    let returns = 0;
    let shortest = Number.POSITIVE_INFINITY;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, N)) {
        const runs = runsOf(series);
        for (let i = 1; i < runs.length - 1; i++) {
          if (runs[i - 1].label === 'retired' && runs[i].label === 'working') {
            returns++;
            shortest = Math.min(shortest, runs[i].length);
          }
        }
      }
    }
    expect(returns, '복귀 장면이 사라지지 않았다').toBeGreaterThan(1000);
    expect(shortest, '복귀한 「일하는 사람」은 최소 두 해').toBeGreaterThanOrEqual(PEER_MIN_HOLD_YEARS);
  });

  it('어느 나이에서 멈춰도 같다 (한 해 앞의 후보를 미리 봐도): 모든 끝 나이 0~120 × 수저 5단계 × 40개 줄기에서 짧은 줄기가 긴 줄기의 앞부분과 같다', () => {
    for (const w of PARENT_WEALTHS) {
      for (let k = 0; k < 40; k++) {
        const seed = 77 + k * 104_729;
        const full = peerStatusSeries(seed, 1, w, 120);
        for (let age = 0; age <= 120; age++) {
          expect(peerStatusSeries(seed, 1, w, age), `수저 ${w} 시드 ${seed} ${age}세까지`).toEqual(full.slice(0, age + 1));
        }
      }
    }
  });

  it('줄기 전수: 0~120세 어디에도 그 나이에 있을 수 없는 라벨이 없고 「구직 중」은 4년을 넘지 않는다 — 한 해짜리를 없애려고 라벨을 잇거나 당겨 써도 모순이 생기지 않는다', () => {
    let checked = 0;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, 2000)) {
        series.forEach((st, age) => {
          if (!inAges(st, age)) throw new Error(`수저 ${w} ${age}세에 ${PEER_STATUS_LABEL[st]}`);
          checked++;
        });
        expect(longestRun(series, 'seeking')).toBeLessThanOrEqual(PEER_MAX_SEEKING_YEARS);
      }
    }
    expect(checked).toBe(5 * 2000 * 121);
  });

  it('실제 판(화면이 쓰는 경로: 한 해씩 나이를 먹으며 peersNow를 부른다): 세 시대 × 40판 × 또래 4명에서 해마다 본 라벨에 한 해짜리 끼임이 0건이다 — 화면에 A → B → A가 보이지 않는다', () => {
    let seen = 0;
    let runCount = 0;
    const bad: string[] = [];
    for (const era of SIM_PROFILES) {
      for (let seed = 1; seed <= 40; seed++) {
        let g = startLife(seed, era);
        const labels: PeerStatus[][] = [[], [], [], []];
        for (let i = 0; i < 140 && g.phase === 'life'; i++) {
          peersNow(g).forEach((p, k) => {
            if (labels[k].length === g.age) labels[k].push(p.status); // 나이마다 한 번만
          });
          g = g.pending ? { ...g, pending: null } : stepYear(g).state;
        }
        labels.forEach((series, k) => {
          seen += series.length;
          runCount += runsOf(series).length;
          const { single } = singleYearRuns(series);
          if (single.length > 0) bad.push(`${era} ${seed} 또래 ${k}: ${single.join(', ')}`);
        });
      }
    }
    expect(bad.slice(0, 5), '한 해짜리 끼임').toEqual([]);
    expect(seen, '공허 통과 방지').toBeGreaterThan(30_000);
    expect(runCount / (3 * 40 * 4), '또래마다 여러 번 바뀐다').toBeGreaterThan(6);
  });
});

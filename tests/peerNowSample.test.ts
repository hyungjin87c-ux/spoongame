import { describe, expect, it } from 'vitest';
import {
  PARENT_WEALTHS,
  PEER_BLOCK_YEARS,
  PEER_KEEP_CHANCE,
  PEER_MAX_SEEKING_YEARS,
  PEER_MIN_HOLD_YEARS,
  PEER_SEEKING_COOLDOWN_YEARS,
  PEER_STATUSES,
  PEER_STATUS_AGES,
  PEER_STATUS_LABEL,
  PEER_STATUS_TABLE,
  peerBandOf,
  peerStatusSeries,
  type ParentWealth,
  type PeerStatus,
} from '../src/core';

/**
 * 같은 해 태어난 사람들의 요즘 모습 — 대량 표본 (SPEC-003 VP4, R-328 / REV-003-M4-1 마스터 결정).
 * 문제였던 것: 또래마다 평생 변하지 않는 「인생 운」 u 하나로 라벨을 정해, 하위 꼬리가 평생이 됐다 — 흙수저 또래의 25%는 평생 「일하는 사람」이 한 번도 안 나왔고,
 * 5%는 19~54세 36년 내내 「구직 중」이었다(「흙수저 = 평생 일하지 않음」 고정관념이자 표의 의도와 반대).
 * 마스터 기준: **흙수저 또래가 19~64세 동안 한 번도 「일하는 사람」이 아닐 비율 ≤ 5%, 「구직 중」 최장 연속 ≤ 4년.**
 * 이 파일은 그 기준을 대량 표본으로 재고, 같은 표본에서 예전 모델(`keepChance: 1` = 평생 고정 운, `maxSeekingYears: Infinity` = 상한 없음)은 실패함을 보여 시험이 실제로 잡음을 증명한다.
 * 표(`PEER_STATUS_TABLE`) 안의 모순 0·결정성은 tests/peerNow.test.ts가 본다.
 *
 * N10c(QA-003-M4): 한 해짜리 끼임(A → B → A) 금지 — 새 상태는 최소 2년 유지한다(tests/peerNowHold.test.ts). 이 파일의 R-328 기준 시험(평생 미취업 ≤ 5%·구직 최장 ≤ 4년·나이별 분포 허용 오차)은
 * 한 글자도 안 바꾸고 새 모델에서 그대로 통과한다. 「라벨이 바뀌는 곳」 시험만 세 번째 갈래(최소 2년 유지로 한 해 미뤄진 변화)를 더했다 — 앞의 두 갈래는 그대로이고 새 갈래는 좁게(바로 앞 해가 경계, 직전 라벨이 정확히 2년) 정했다.
 */

const N = 4000;
const inAges = (s: PeerStatus, age: number) => age >= PEER_STATUS_AGES[s].min && age <= PEER_STATUS_AGES[s].max;

/** 시드 n개의 또래 줄기 (순번 0) — 시드는 서로 멀리 떨어뜨려 상관을 피한다 */
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

const neverWorked = (series: readonly PeerStatus[]) => !series.slice(19, 65).includes('working');

describe('대량 표본: 평생 고정 인생 운이 만들던 하위 꼬리가 없다 (R-328)', () => {
  it('흙수저 또래 4000명 중 19~64세 동안 한 번도 「일하는 사람」이 아닌 사람이 5% 이하다', () => {
    const never = lives(1, N, 64).filter(neverWorked).length;
    expect(never / N, `평생 미취업 ${never}명`).toBeLessThanOrEqual(0.05);
  });

  it('대조: 같은 표본을 예전 모델(평생 고정 운 — keepChance 1, 상한 없음)로 만들면 평생 미취업이 20%를 넘는다 — 시험이 실제로 결함을 잡는다', () => {
    const old = lives(1, N, 64, { keepChance: 1, maxSeekingYears: Infinity }).filter(neverWorked).length;
    expect(old / N, `예전 모델의 평생 미취업 ${old}명`).toBeGreaterThan(0.2);
  });

  it('「구직 중」 최장 연속이 4년 이하다 — 모든 수저 단계 × 0~120세 전수', () => {
    expect(PEER_MAX_SEEKING_YEARS).toBe(4);
    let reachedCap = 0;
    let withSeeking = 0;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, N)) {
        const run = longestRun(series, 'seeking');
        expect(run, `수저 ${w}`).toBeLessThanOrEqual(4);
        if (run === 4) reachedCap++;
        if (run > 0) withSeeking++;
      }
    }
    expect(withSeeking, '「구직 중」이 실제로 나온다 — 라벨을 없애서 통과한 것이 아니다').toBeGreaterThan(N);
    expect(reachedCap, '상한 4년이 실제로 걸리는 사람이 있다 — 상한이 있어서 통과했다는 증거').toBeGreaterThan(100);
  });

  it('대조: 상한을 빼면(maxSeekingYears 무한) 같은 표본에서 흙수저 또래의 「구직 중」이 4년을 넘는다 (예전 모델은 36년까지)', () => {
    const longest = Math.max(...lives(1, N, 120, { maxSeekingYears: Infinity }).map((series) => longestRun(series, 'seeking')));
    expect(longest, '상한 없는 줄기의 최장 연속').toBeGreaterThan(4);
    const oldLongest = Math.max(...lives(1, N, 120, { keepChance: 1, maxSeekingYears: Infinity }).map((series) => longestRun(series, 'seeking')));
    expect(oldLongest, '예전 모델의 최장 연속(평생 고정 운)').toBeGreaterThanOrEqual(20);
  });

  it('이전 값과 상관이 있다 — 한 블록 뒤(같은 구간 안)에도 같은 라벨일 확률이 독립일 때보다 높지만(이어받음) 1이 아니다(다시 뽑음). 평생 고정 운이면 1이다', () => {
    // 30~44세 구간(수저 3단계): 32세와 36세는 서로 다른 블록, 같은 가중치 구간
    const at = (sample: PeerStatus[][], age: number) => sample.map((series) => series[age]);
    const sample = lives(3, N, 40);
    const a = at(sample, 32);
    const b = at(sample, 36);
    const same = a.filter((x, i) => x === b[i]).length / N;
    const weights = peerBandOf(32).byWealth[2];
    const independent = PEER_STATUSES.reduce((sum, st) => sum + ((weights[st] ?? 0) / 100) ** 2, 0);
    expect(same, `같은 라벨 비율 ${same.toFixed(3)} (독립이면 ${independent.toFixed(3)})`).toBeGreaterThan(independent + 0.1);
    expect(same, '다시 뽑는 블록이 있어 늘 같지는 않다').toBeLessThan(0.95);
    // 대조: 평생 고정 운(keepChance 1)에서는 늘 같다
    const fixed = lives(3, N, 40, { keepChance: 1, maxSeekingYears: Infinity });
    const fa = at(fixed, 32);
    const fb = at(fixed, 36);
    expect(fa.filter((x, i) => x === fb[i]).length / N, '평생 고정 운').toBe(1);
    // 같은 블록 안(32세와 33세)에서는 운이 같아 거의 같다 — 「구직 중」 상한이 걸릴 때만 다르다
    const sameBlock = at(sample, 32).filter((x, i) => x === at(sample, 33)[i]).length / N;
    expect(sameBlock).toBeGreaterThan(0.97);
    expect(PEER_BLOCK_YEARS).toBe(4);
    expect(PEER_SEEKING_COOLDOWN_YEARS).toBe(4);
    expect(PEER_KEEP_CHANCE).toBeGreaterThan(0);
    expect(PEER_KEEP_CHANCE).toBeLessThan(1);
  });

  it('나이별 분포는 규칙표를 따른다: 상한에 걸릴 수 없는 나이(수저 4단계 21세·흙수저 21세)는 표와 3%p 이내, 걸릴 수 있는 나이(흙수저 27·35세, 수저 2단계 50세)는 7%p 이내이고 모든 라벨이 나온다 — 이어받은 운이라도 표가 바뀌면 라벨이 바뀐다', () => {
    for (const [wealth, age, tolerance] of [
      [1, 21, 0.03],
      [4, 21, 0.03],
      [1, 27, 0.07],
      [1, 35, 0.07],
      [2, 50, 0.07],
    ] as const) {
      const sample = lives(wealth, N, age);
      const weights = peerBandOf(age).byWealth[wealth - 1];
      for (const st of PEER_STATUSES) {
        const share = sample.filter((series) => series[age] === st).length / N;
        const expected = (weights[st] ?? 0) / 100;
        expect(Math.abs(share - expected), `수저 ${wealth} ${age}세 ${PEER_STATUS_LABEL[st]} (표 ${(expected * 100).toFixed(0)}%, 표본 ${(share * 100).toFixed(1)}%)`).toBeLessThanOrEqual(tolerance);
        if (expected >= 0.05) expect(share, `수저 ${wealth} ${age}세 ${PEER_STATUS_LABEL[st]}가 사라졌다`).toBeGreaterThan(expected * 0.4);
      }
    }
  });

  it('G3 유지: 같은 나이라도 수저가 높을수록 구직 중의 몫이 작고(27세) 학교의 몫이 크다(21세) — 표본에서도 단조', () => {
    const share = (wealth: ParentWealth, age: number, st: PeerStatus) => lives(wealth, N, age).filter((series) => series[age] === st).length / N;
    const seeking = PARENT_WEALTHS.map((w) => share(w, 27, 'seeking'));
    const school = PARENT_WEALTHS.map((w) => share(w, 21, 'school'));
    for (let i = 1; i < 5; i++) {
      expect(seeking[i], `구직 중 27세 ${seeking.map((x) => x.toFixed(2)).join('/')}`).toBeLessThan(seeking[i - 1] + 0.005);
      expect(school[i], `학교 21세 ${school.map((x) => x.toFixed(2)).join('/')}`).toBeGreaterThan(school[i - 1]);
    }
    expect(seeking[0] - seeking[4], '흙수저와 다이아몬드수저의 27세 구직 중 차이').toBeGreaterThan(0.08);
  });

  it('줄기 전수: 0~120세 어디에도 그 나이에 있을 수 없는 라벨이 없다 (모든 수저 × 표본 — 이어받은 운·구직 중 상한이 모순을 만들지 않는다)', () => {
    let checked = 0;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, 1500)) {
        series.forEach((st, age) => {
          if (!inAges(st, age)) throw new Error(`수저 ${w} ${age}세에 ${PEER_STATUS_LABEL[st]}`);
          checked++;
        });
      }
    }
    expect(checked).toBe(5 * 1500 * 121);
  });

  it('라벨이 바뀌는 곳은 블록 경계·구간 경계, 「구직 중」과 얽힌 변화(상한·쉬는 해), 그리고 최소 2년 유지로 한 해 미뤄진 변화뿐이다 — 해마다 뒤죽박죽 바뀌지 않는다', () => {
    // 앞의 두 갈래는 N10c 이전과 같다(경계 / 4년 이어진 「구직 중」 뒤 8년 안의 「구직 중」 변화). 세 번째 갈래(N10c, 최소 2년 유지 — tests/peerNowHold.test.ts):
    // 한 해만 가는 새 상태를 막으려고 바뀜을 한 해 미룬 경우 — 바로 앞 해가 블록·구간 경계이고(원래라면 거기서 바뀌었을 자리) 바뀌기 직전 라벨이 정확히 PEER_MIN_HOLD_YEARS년 이어졌다.
    // 그 밖에 경계 밖의 변화는 하나도 없다.
    const boundary = (age: number) => age % PEER_BLOCK_YEARS === 0 || peerBandOf(age).from === age;
    let changes = 0;
    let nonBoundary = 0;
    let deferred = 0;
    const unexplained: string[] = [];
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, 300)) {
        for (let age = 1; age < series.length; age++) {
          if (series[age] === series[age - 1]) continue;
          changes++;
          if (boundary(age)) continue;
          nonBoundary++;
          const involvesSeeking = series[age] === 'seeking' || series[age - 1] === 'seeking';
          if (involvesSeeking && longestRun(series.slice(Math.max(0, age - 9), age), 'seeking') >= PEER_MAX_SEEKING_YEARS) continue; // 「구직 중」 상한·쉬는 해와 얽힌 변화
          let previousLength = 0;
          for (let a = age - 1; a >= 0 && series[a] === series[age - 1]; a--) previousLength++;
          if (boundary(age - 1) && previousLength === PEER_MIN_HOLD_YEARS) {
            deferred++;
            continue;
          }
          unexplained.push(`수저 ${w} ${age}세에서 ${PEER_STATUS_LABEL[series[age - 1]]}(${previousLength}년) → ${PEER_STATUS_LABEL[series[age]]}`);
        }
      }
    }
    expect(unexplained.slice(0, 5), '블록·구간 경계도, 「구직 중」과도, 한 해 미룸도 아닌 변화').toEqual([]);
    expect(changes, '공허 통과 방지').toBeGreaterThan(5000);
    expect(nonBoundary, '경계 밖의 변화(상한·쉬는 해·미룬 변화)가 실제로 있다').toBeGreaterThan(0);
    expect(deferred, '최소 2년 유지로 미뤄진 변화가 실제로 있다 — 세 번째 갈래가 공허하지 않다').toBeGreaterThan(100);
    // 대조: 한 해짜리 끼임을 허용하는 예전 모델(minHoldYears 1)에는 「구직 중」과 상관없는 경계 밖 변화가 없다 — 세 번째 갈래는 N10c 규칙이 만든 것뿐이다
    let oldOutside = 0;
    for (const w of PARENT_WEALTHS) {
      for (const series of lives(w, 300, 120, { minHoldYears: 1 })) {
        for (let age = 1; age < series.length; age++) {
          if (series[age] === series[age - 1] || boundary(age)) continue;
          if (series[age] === 'seeking' || series[age - 1] === 'seeking') continue;
          oldOutside++;
        }
      }
    }
    expect(oldOutside, '예전 모델: 경계 밖의 「구직 중」과 상관없는 변화').toBe(0);
  });

  it('상한이 걸린 뒤 같은 운이 곧바로 「구직 중」을 되풀이하지 않는다 — 흙수저 또래 중 어떤 10년 창에서든 「구직 중」이 8년 이상인 사람이 1% 이하다 (쉬는 해가 한 해뿐이면 약 33%)', () => {
    const heavy = (series: readonly PeerStatus[]) => {
      for (let a = 19; a + 10 <= 65; a++) if (series.slice(a, a + 10).filter((x) => x === 'seeking').length >= 8) return true;
      return false;
    };
    const share = lives(1, N, 64).filter(heavy).length / N;
    expect(share, '10년 중 8년 이상 구직 중').toBeLessThanOrEqual(0.01);
  });
});

/**
 * M5 착수 때 함께(REV-003-M4-3 관찰, 2026-10-17): N10c의 분포 대가가 큰 나이(20·56·65세)의 상한 시험과 20세 G3 단조성.
 * 「분포 대가」 = 같은 시드의 같은 표본을 N10c 이전 모델(`minHoldYears: 1`)과 지금 모델로 만들었을 때 라벨 비율이 달라진 크기(%p). 측정(표본 4000명, 시드는 `lives`와 같다):
 * 3%p 넘게 달라진 나이는 20(9.9)·24(9.7)·25(7.5)·45(3.1)·56(10.3)·64(4.3)·65(8.4)·76(3.4)세뿐이고 최대 10.3%p(수저 3단계 56세 「일하는 사람」 46.7 → 36.4)다.
 * 같은 표본의 표(`PEER_STATUS_TABLE`) 대비 편차는 20세 10.7·56세 9.8·65세 9.3%p(5수저 중 최대). 시드가 같아 표본이 결정적이므로 측정값 바로 위에 상한을 둔다 —
 * 규칙이나 표를 고쳐 대가가 커지면 이 시험이 먼저 알린다. (참고: 표 대비 편차가 가장 큰 곳은 23~26세 흙수저의 18~23%p — 「구직 중」 상한(R-328)과 N10c가 함께 만든 것이고 이 파일 위쪽 시험의 허용 밖이라 대상이 아니다.)
 */
describe('N10c 분포 대가 상한과 20세 G3 단조성 (REV-003-M4-3 관찰, M5 착수)', () => {
  const share = (sample: PeerStatus[][], age: number, st: PeerStatus) => sample.filter((series) => series[age] === st).length / sample.length;
  /** 같은 시드·수저의 지금 모델과 N10c 이전 모델의 라벨 비율 차이 최댓값(모든 수저·라벨) */
  const costAt = (age: number): number => {
    let worst = 0;
    for (const w of PARENT_WEALTHS) {
      const now = lives(w, N, 120);
      const old = lives(w, N, 120, { minHoldYears: 1 });
      for (const st of PEER_STATUSES) worst = Math.max(worst, Math.abs(share(now, age, st) - share(old, age, st)));
    }
    return worst;
  };
  const tableDeviationAt = (age: number): number => {
    let worst = 0;
    for (const w of PARENT_WEALTHS) {
      const sample = lives(w, N, age);
      const weights = peerBandOf(age).byWealth[w - 1];
      for (const st of PEER_STATUSES) worst = Math.max(worst, Math.abs(share(sample, age, st) - (weights[st] ?? 0) / 100));
    }
    return worst;
  };

  it('N10c가 3%p 넘게 바꾼 나이는 20·24·25·45·56·64·65·76세뿐이고, 가장 큰 변화도 11%p 이하다 (모든 나이 0~120 × 5수저 × 6라벨)', () => {
    const KNOWN = new Set([20, 24, 25, 45, 56, 64, 65, 76]);
    const samples = PARENT_WEALTHS.map((w) => ({ now: lives(w, N, 120), old: lives(w, N, 120, { minHoldYears: 1 }) }));
    let worst = 0;
    const over3: number[] = [];
    for (let age = 0; age <= 120; age++) {
      let atAge = 0;
      for (const s of samples) for (const st of PEER_STATUSES) atAge = Math.max(atAge, Math.abs(share(s.now, age, st) - share(s.old, age, st)));
      if (atAge > 0.03) over3.push(age);
      worst = Math.max(worst, atAge);
    }
    expect(over3.filter((a) => !KNOWN.has(a)), `3%p 넘게 달라진 나이 ${over3.join('·')}`).toEqual([]);
    expect(over3.length, '공허 통과 방지: 대가가 실제로 있는 나이가 있다').toBeGreaterThanOrEqual(5);
    expect(worst, `최대 변화 ${(worst * 100).toFixed(1)}%p`).toBeLessThanOrEqual(0.11);
  });

  it('20·56·65세: N10c 이전 대비 변화가 각각 11%p·11%p·9.5%p 이하이고, 표 대비 편차도 12%p·11%p·10.5%p 이하다 (측정 9.9·10.3·8.4 / 10.7·9.8·9.3)', () => {
    for (const [age, costMax, tableMax] of [
      [20, 0.11, 0.12],
      [56, 0.11, 0.11],
      [65, 0.095, 0.105],
    ] as const) {
      const cost = costAt(age);
      const dev = tableDeviationAt(age);
      expect(cost, `${age}세 N10c 변화 ${(cost * 100).toFixed(1)}%p`).toBeLessThanOrEqual(costMax);
      expect(cost, `${age}세: 대가가 있는 나이라는 전제 — 3%p 넘는다`).toBeGreaterThan(0.03);
      expect(dev, `${age}세 표 대비 편차 ${(dev * 100).toFixed(1)}%p`).toBeLessThanOrEqual(tableMax);
    }
  });

  it('20세 G3 단조성: 수저가 높을수록 「학교에 다님」의 몫이 크고(표 35·46·58·70·80) 구직 중·일하는 사람의 몫은 작다 — 이웃 단계 사이 학교 몫 차이가 9%p 이상(측정 9.8~13.8)', () => {
    const at20 = PARENT_WEALTHS.map((w) => lives(w, N, 20));
    const school = at20.map((s) => share(s, 20, 'school'));
    const seeking = at20.map((s) => share(s, 20, 'seeking'));
    const working = at20.map((s) => share(s, 20, 'working'));
    for (let i = 1; i < 5; i++) {
      expect(school[i] - school[i - 1], `학교 20세 ${school.map((x) => x.toFixed(2)).join('/')}`).toBeGreaterThanOrEqual(0.09);
      expect(seeking[i], `구직 중 20세 ${seeking.map((x) => x.toFixed(2)).join('/')}`).toBeLessThan(seeking[i - 1]);
      expect(working[i], `일하는 사람 20세 ${working.map((x) => x.toFixed(2)).join('/')}`).toBeLessThan(working[i - 1]);
    }
    expect(school[4] - school[0], '흙수저와 다이아몬드수저의 20세 학교 몫 차이').toBeGreaterThan(0.4);
  });

  it('19~29세에서도 같은 방향이다: 학교 몫은 수저가 높을수록 줄지 않는다(구간 표 단조 + 표본) — 이웃 단계 사이 0.5%p까지 표본 오차 허용', () => {
    for (let age = 19; age <= 29; age++) {
      const school = PARENT_WEALTHS.map((w) => share(lives(w, N, age), age, 'school'));
      for (let i = 1; i < 5; i++) expect(school[i], `${age}세 학교 몫 ${school.map((x) => x.toFixed(3)).join('/')}`).toBeGreaterThanOrEqual(school[i - 1] - 0.005);
    }
    // 표 자체도 단조(설계값 점검): 모든 구간에서 학교 가중치가 수저 단계에 대해 줄지 않는다
    for (const band of PEER_STATUS_TABLE) {
      const weights = band.byWealth.map((x) => x.school ?? 0);
      for (let i = 1; i < 5; i++) expect(weights[i], `${band.from}~${band.to}세 표`).toBeGreaterThanOrEqual(weights[i - 1]);
    }
  });
});

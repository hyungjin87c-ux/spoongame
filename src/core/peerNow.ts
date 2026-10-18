import { peersOf, type Peer } from './peers';
import { createRng, mixSeed } from './rng';
import { PARENT_WEALTHS, type GameState, type ParentWealth } from './types';

/**
 * 같은 해 태어난 사람들의 요즘 모습 (SPEC-003 VP4). 대시보드 우측(좁은 화면은 맨 아래) 「같은 해 태어난 사람들」 칸에 또래 4명의 **지금 상태 라벨**을 보인다.
 * 또래는 주인공과 같은 해에 태어나 같은 나이를 먹는다. 라벨은 **나이 × 수저 단계 규칙표**(`PEER_STATUS_TABLE`, 설계값 — 통계가 아니다)에서 결정적으로 뽑는다.
 *
 * 결정성: 또래마다 시드에서 정해지는 난수 줄기(`createRng(mixSeed(또래 시드, 순번))`)를 0세부터 한 해씩 따라가며 상태를 정한다 — 같은 시드는 새로고침해도 같고, 어느 나이에서 멈춰도 그 나이까지의 길이 같다(앞 나이의 상태는 뒤 나이에 영향받지 않는다).
 * 평생 고정 「인생 운」 하나로 정하지 않는 이유(R-328, REV-003-M4-1): 운 하나를 평생 쓰면 하위 꼬리가 평생이 된다 — 흙수저 또래의 25%는 평생 「일하는 사람」이 한 번도 안 나오고, 5%는 19~54세 36년 내내 「구직 중」이었다(「흙수저 = 평생 일하지 않음」 고정관념이자 표의 의도와 반대).
 * 지금은 **나이대(4년 블록)마다 인생 운을 다시 뽑되 이전 값과 상관이 있게** 한다: 블록이 시작될 때 이전 운을 확률 `PEER_KEEP_CHANCE`로 그대로 이어받고 아니면 새로 뽑는다. 라벨은 그 나이의 규칙표에 운을 대 본 값이라
 * 운이 균등하면 라벨 분포가 어느 나이에서나 표와 같고, 이어받은 운이라도 표가 바뀌면 라벨이 바뀐다(대학에 다니던 운이 서른 살에 계속 학생으로 남지 않는다).
 * 「구직 중」이 `PEER_MAX_SEEKING_YEARS`(4년) 이어졌으면 그 해부터 4년은 같은 운을 「구직 중」을 뺀 가중치에 다시 대 본다 — 최장 연속이 구조적으로 그 이하이고 같은 운이 곧바로 되풀이하지 않는다.
 * 기준(마스터 결정, tests/peerNowSample.test.ts 대량 표본): 흙수저 또래가 19~64세 동안 한 번도 「일하는 사람」이 아닐 비율 ≤ 5%, 「구직 중」 최장 연속 ≤ 4년.
 * 한 해짜리 끼임 0 (QA-003-M4 N10c, 마스터 결정): 새 상태는 **최소 `PEER_MIN_HOLD_YEARS`(2)년** 유지한다 — 「일하는 사람 → 학교에 다님 → 일하는 사람」처럼 한 해만 끼었다 돌아오는 흔들림이 없다.
 * 줄기를 만들 때 한 해 앞의 후보 라벨을 미리 본다(난수는 나이에만 묶이고 상태와 무관해 미리 계산해도 같다). 지금 규칙(R-350으로 바로잡음 — 예전 주석은 「한 해짜리가 될 바뀜을 건너뛴다」만 적었다):
 *   ① **막 시작한 라벨은 두 해를 채운다**(기본 동작): 바뀌어 한 해 된 라벨이 다음 해에 또 바뀌려 하면(허용 나이 안이고 「구직 중」 상한·쉬는 해에 걸리지 않을 때) 이전 라벨을 한 해 더 이어 두 해가 되게 한다.
 *   ② **다음 해에 있을 수 없는 라벨은 시작하지 않는다**(표의 가중치가 0 — 허용 나이를 벗어남 — 이거나 「구직 중」 상한에 걸림): 이전 라벨을 잇고, 이전 라벨을 이을 수 없으면 다음 해 후보 라벨을 한 해 일찍 받아들인다.
 *   ③ 그래서 **라벨이 바뀌는 해가 블록·구간 경계에서 한 해 미뤄질 수 있다**(경계 바로 다음 해에 바뀜) — 경계 밖의 변화가 전혀 없는 것이 아니다. 새 바뀜을 만드는 것이 아니라 한 해 미룰 뿐이고, 어디서 미뤄지는지는
 *      tests/peerNowSample.test.ts 「라벨이 바뀌는 곳은 …」(세 번째 갈래: 바로 앞 해가 경계이고 바뀌기 직전 라벨이 정확히 2년)가 못 박는다. 둘 다 안 되는 자리가 있으면 한 해짜리가 남는다 — tests/peerNowHold.test.ts가 그 수를 0으로 못 박는다(끼임 0·A→B→A 0).
 * 은퇴 뒤 「일하는 사람」 복귀 자체는 고령 노동(표의 의도)이라 허용한다(두 해 이상 이어지는 한).
 * **분포 대가(REV-003-M4-3 R-350, 마스터가 수용)**: 두 해를 채우느라 라벨 비율이 표(설계값)에서 더 벗어난다. 같은 시드의 같은 표본을 N10c 이전 모델(`minHoldYears: 1`)과 견주면 3%p 넘게 달라진 나이는 20·24·25·45·56·64·65·76세뿐이고
 * 최대 10.3%p다(표본 10000명, N10c 작업의 측정: 수저 3단계 56세 「일하는 사람」 표 46% → 이전 47.1% → 이후 36.8%, 20세 「학교에 다님」 표 58% → 57.4% → 47.7%, 65세 「은퇴」 표 62% → 60.6% → 52.4%).
 * 표본 4000명의 시험 측정으로 표 대비 편차는 20세 최대 10.7%p·56세 9.8%p·65세 9.3%p(5수저 중 최대)다.
 * 이 크기는 tests/peerNowSample.test.ts 「N10c 분포 대가 상한과 20세 G3 단조성」이 상한으로 지킨다(규칙이나 표를 고쳐 대가가 커지면 먼저 실패한다). 참고: 표 대비 편차가 가장 큰 곳은 23~26세 흙수저의 18~23%p로, N10c 이전에도 있던 「구직 중」 상한(R-328)의 대가가 N10c로 조금 커진 것이다.
 * 모순 0: 어떤 나이에도 그 나이에 있을 수 없는 라벨(5세의 「일하는 사람」 등)이 나오지 않는다 — `PEER_STATUS_AGES`(라벨별 허용 나이)가 표와 따로 정의된 독립 기준이고,
 * tests/peerNow.test.ts가 표의 모든 구간·모든 수저·난수 전수와 실제 또래 줄기 전수에서 대조한다.
 */

export const PEER_STATUSES = ['child', 'school', 'working', 'seeking', 'caring', 'retired'] as const;
export type PeerStatus = (typeof PEER_STATUSES)[number];

/** 라벨 글자 (copy.md 대시보드 또래 카드) */
export const PEER_STATUS_LABEL: Record<PeerStatus, string> = {
  child: '어린 시절',
  school: '학교에 다님',
  working: '일하는 사람',
  seeking: '구직 중',
  caring: '돌봄',
  retired: '은퇴',
};

/** 은퇴 뒤 다시 일하는 모습의 표시 라벨 (SPEC-003 M7e-3, 마스터 결정 E-7): 상태 키는 그대로 `working`이고(표·분포·시험 불변) 표시만 나눈다 — 그 전 해들에 `retired`가 있었던 `working`은 「다시 일하는 사람」이다. */
export const PEER_RETURN_LABEL = '다시 일하는 사람';

/** 라벨마다 있을 수 있는 나이 범위(포함). 표(`PEER_STATUS_TABLE`)와 따로 둔 독립 기준 — 표의 가중치가 0이 아닌 칸은 모두 이 범위 안이어야 한다. */
export const PEER_STATUS_AGES: Record<PeerStatus, { min: number; max: number }> = {
  child: { min: 0, max: 6 },
  school: { min: 7, max: 29 },
  working: { min: 18, max: 120 },
  seeking: { min: 19, max: 64 },
  caring: { min: 30, max: 89 },
  retired: { min: 55, max: 120 },
};

/** 한 나이대의 구간 표: 수저 1~5단계별 [라벨 → 가중치] (가중치 합 100) */
export interface PeerBand {
  from: number;
  to: number;
  /** 수저 단계(1~5) 순서의 5칸 — 칸마다 라벨별 가중치 */
  byWealth: readonly [Weights, Weights, Weights, Weights, Weights];
}
type Weights = Partial<Record<PeerStatus, number>>;

const w = (working: number, seeking: number, caring: number, retired: number, school = 0): Weights => ({ working, seeking, caring, retired, school });

/**
 * 나이 × 수저 규칙표(설계값). 나이가 낮은 쪽이 학교·구직으로 기울고, 수저 단계가 높을수록 학교(대학 이후)가 길고 구직 중·돌봄의 몫이 작다(G3: 같은 나이라도 수저에 따라 요즘 모습이 다르다).
 * 고령에서는 수저가 낮을수록 일을 계속하는 몫이 크다. 숫자는 게임의 설계값이며 실제 비율이 아니다(화면 카드 끝에 「설계값, 통계가 아님」을 적는다).
 */
export const PEER_STATUS_TABLE: readonly PeerBand[] = [
  { from: 0, to: 6, byWealth: [{ child: 100 }, { child: 100 }, { child: 100 }, { child: 100 }, { child: 100 }] },
  { from: 7, to: 18, byWealth: [{ school: 100 }, { school: 100 }, { school: 100 }, { school: 100 }, { school: 100 }] },
  // 19~24: 대학·구직·일 (수저가 높을수록 학교가 길다)
  { from: 19, to: 24, byWealth: [w(40, 25, 0, 0, 35), w(36, 18, 0, 0, 46), w(30, 12, 0, 0, 58), w(22, 8, 0, 0, 70), w(16, 4, 0, 0, 80)] },
  // 25~29: 일 중심, 학교(대학원·준비)는 수저가 높을 때 조금. 돌봄(육아·부모 돌봄)은 30세부터라 이 구간에는 없다(허용 나이, tests/peerNow.test.ts가 잡았다)
  { from: 25, to: 29, byWealth: [w(72, 28, 0, 0, 0), w(74, 20, 0, 0, 6), w(78, 16, 0, 0, 6), w(76, 12, 0, 0, 12), w(72, 10, 0, 0, 18)] },
  // 30~44: 일·구직·돌봄(육아)
  { from: 30, to: 44, byWealth: [w(66, 14, 20, 0), w(70, 11, 19, 0), w(74, 8, 18, 0), w(78, 6, 16, 0), w(82, 4, 14, 0)] },
  // 45~54: 일·구직·돌봄(부모 돌봄)
  { from: 45, to: 54, byWealth: [w(70, 12, 18, 0), w(74, 9, 17, 0), w(78, 7, 15, 0), w(82, 5, 13, 0), w(86, 3, 11, 0)] },
  // 55~64: 일 · 구직 · 돌봄 · 은퇴 시작
  { from: 55, to: 64, byWealth: [w(58, 12, 14, 16), w(52, 10, 14, 24), w(46, 8, 14, 32), w(40, 5, 13, 42), w(34, 3, 13, 50)] },
  // 65~74: 일(고령 노동) · 돌봄 · 은퇴
  { from: 65, to: 74, byWealth: [w(44, 0, 10, 46), w(36, 0, 10, 54), w(28, 0, 10, 62), w(20, 0, 10, 70), w(14, 0, 10, 76)] },
  // 75~89: 대부분 은퇴
  { from: 75, to: 89, byWealth: [w(18, 0, 12, 70), w(12, 0, 12, 76), w(8, 0, 12, 80), w(5, 0, 11, 84), w(3, 0, 10, 87)] },
  // 90~: 돌봄(허용 나이 89까지)이 빠지고 은퇴가 거의 전부
  { from: 90, to: 120, byWealth: [w(10, 0, 0, 90), w(8, 0, 0, 92), w(6, 0, 0, 94), w(4, 0, 0, 96), w(3, 0, 0, 97)] },
];

/** 나이가 속한 구간 (표는 0~120세를 빈틈없이 덮는다 — tests/peerNow.test.ts). 범위 밖이면 가장 가까운 구간. */
export function peerBandOf(age: number): PeerBand {
  const a = Number.isFinite(age) ? Math.max(0, Math.floor(age)) : 0;
  return PEER_STATUS_TABLE.find((b) => a >= b.from && a <= b.to) ?? PEER_STATUS_TABLE[PEER_STATUS_TABLE.length - 1];
}

/**
 * 나이·수저·난수 u(0 이상 1 미만)로 정하는 라벨 **한 번의 뽑기**. 구간의 가중치를 표의 순서(PEER_STATUSES)대로 누적해 u에 닿는 첫 라벨이다.
 * 가중치가 0인 라벨은 나올 수 없다 — 그래서 표가 허용 나이를 지키면 모순이 없다. `excluded`를 주면 그 라벨의 가중치를 0으로 두고 나머지로 다시 비례해 뽑는다(남는 라벨이 없으면 제외하지 않는다).
 */
export function peerStatusOf(age: number, wealth: ParentWealth, u: number, excluded?: PeerStatus): PeerStatus {
  const weights = peerBandOf(age).byWealth[PARENT_WEALTHS.indexOf(wealth)];
  const weightOf = (s: PeerStatus) => (s === excluded ? 0 : (weights[s] ?? 0));
  const total = PEER_STATUSES.reduce((sum, s) => sum + weightOf(s), 0);
  if (total <= 0) return excluded === undefined ? PEER_STATUSES[0] : peerStatusOf(age, wealth, u);
  const target = Math.min(0.999999999, Math.max(0, Number.isFinite(u) ? u : 0)) * total;
  let acc = 0;
  let last: PeerStatus = PEER_STATUSES[0];
  for (const s of PEER_STATUSES) {
    const weight = weightOf(s);
    if (weight <= 0) continue;
    last = s;
    acc += weight;
    if (target < acc) return s;
  }
  return last;
}

/** 나이대 블록 길이(년): 인생 운을 다시 뽑을지 정하는 단위 */
export const PEER_BLOCK_YEARS = 4;
/** 블록이 시작될 때 이전 인생 운을 그대로 이어받을 확률 — 이전 값과 상관을 만드는 값(이어받지 않으면 새로 뽑는다) */
export const PEER_KEEP_CHANCE = 0.6;
/** 「구직 중」 최장 연속(년): 이만큼 이어졌으면 그 해에는 「구직 중」을 뺀 라벨로 정한다 (마스터 결정 ≤ 4년) */
export const PEER_MAX_SEEKING_YEARS = 4;
/**
 * 「구직 중」이 상한(PEER_MAX_SEEKING_YEARS)에 걸린 해부터 「구직 중」을 다시 막는 햇수 — 블록 한 칸(4년). 상한 직후 한 해만 막으면 같은 운이 곧바로 다시 「구직 중」을 만들어
 * 「4년 구직 중 → 1년 다른 모습 → 4년 구직 중」으로 흙수저 또래의 33%가 10년 중 8년 이상을 「구직 중」으로 보내는 반복이 됐다(측정). 4년을 막으면 0.2%다.
 */
export const PEER_SEEKING_COOLDOWN_YEARS = PEER_BLOCK_YEARS;
/** 새 상태를 최소 이만큼(년) 유지한다: 한 해만 끼었다 돌아오는 흔들림 금지 (QA-003-M4 N10c). 다음 해에 또 바뀔 바뀜은 하지 않는다. */
export const PEER_MIN_HOLD_YEARS = 2;
/** 또래 난수 줄기의 소금 (순번을 더해 또래마다 다르다) */
const PEER_STREAM_SALT = 0x70e00000;
/** 이 나이를 넘으면 더 따라가지 않는다(표는 0~120세) */
const PEER_MAX_AGE = 120;

/** 줄기를 만드는 규칙의 값을 바꾸는 선택 인자 — 시험이 「예전 모델」(keepChance 1 = 평생 고정 운, maxSeekingYears Infinity = 상한 없음, minHoldYears 1 = 한 해짜리 끼임 허용)과 대조하려고 쓴다. 화면은 기본값만 쓴다 */
export interface PeerSeriesOptions {
  keepChance?: number;
  maxSeekingYears?: number;
  /** 새 상태를 최소 유지하는 햇수(기본 `PEER_MIN_HOLD_YEARS`) — 1이면 규칙 없음(N10c 이전 모델, 대조용) */
  minHoldYears?: number;
}

/** 한 해의 결과: 그 해의 라벨과 「구직 중」 연속 햇수·쉬는 해 남은 햇수 */
interface SeriesStep {
  status: PeerStatus;
  run: number;
  cooldown: number;
}

/**
 * 또래 한 명(순번 index)의 0세부터 maxAge세까지 해마다의 요즘 모습 (결정적 — 같은 시드·순번·수저는 늘 같은 줄기): 0세부터 한 해씩 따라간다.
 *  - 인생 운 u(0~1)는 나이대 블록(`PEER_BLOCK_YEARS`년)이 시작될 때 확률 `PEER_KEEP_CHANCE`로 이전 값을 이어받고 아니면 새로 뽑는다 — 이전 값과 상관이 있다. 라벨은 그 나이의 규칙표에 u를 대 본 값이라
 *    u가 균등하면 라벨의 분포는 어느 나이에서나 표와 같다(이어받아도 표가 바뀌면 라벨이 바뀐다 — 대학에 다니던 운이 서른 살에 계속 학생으로 남지 않는다).
 *  - 「구직 중」이 `PEER_MAX_SEEKING_YEARS`년 이어졌으면 그 해부터 `PEER_SEEKING_COOLDOWN_YEARS`년 동안은 같은 u를 「구직 중」을 뺀 가중치로 다시 대 본 라벨로 정한다(`peerStatusOf`의 `excluded`) —
 *    난수를 더 쓰지 않고 u도 바꾸지 않는다. 최장 연속이 구조적으로 상한 이하이고, 같은 운이 곧바로 다시 「구직 중」을 만들지 않는다. 대가: 하위 단계의 「구직 중」 몫이 표보다 조금 적다
 *    (흙수저 35세 표 14% → 약 8%; 표는 설계값이고 상한은 마스터 기준이다). 21세처럼 상한에 걸릴 수 없는 나이는 표와 같다.
 *  - 새 상태는 `PEER_MIN_HOLD_YEARS`(2)년 유지한다(N10c, 위 머리 주석 ①~③): ① 막 시작한 라벨은 다음 해에 또 바뀌려 하면 한 해 더 이어 두 해를 채운다. ② 바뀌려는 새 라벨이 다음 해에는 있을 수 없으면(허용 나이·「구직 중」 상한)
 *    그 라벨은 시작하지 않고 이전 라벨을 잇는다 — 이전 라벨을 이을 수 없으면 다음 해 라벨을 한 해 일찍 받아들인다. ③ 그래서 바뀌는 해가 경계 바로 다음 해로 한 해 미뤄질 수 있다.
 * 앞 나이의 라벨은 뒤 나이에 영향받지 않는다 — maxAge가 달라도 앞부분이 같다(어느 나이에서 멈춰도 그 나이까지의 길이 같다): 한 해 앞의 후보를 미리 보지만 그 후보는 시드·나이·수저와 지금까지의 줄기에서만
 * 정해지고 maxAge와는 무관하다(줄기는 늘 maxAge보다 한 해 더 만들어 두었다가 자른다). 범위 밖 나이는 0~120으로 맞춘다. 길이 = 맞춘 maxAge + 1.
 */
export function peerStatusSeries(peerSeed: number, index: number, wealth: ParentWealth, maxAge: number, options: PeerSeriesOptions = {}): PeerStatus[] {
  const keepChance = options.keepChance ?? PEER_KEEP_CHANCE;
  const maxSeekingYears = options.maxSeekingYears ?? PEER_MAX_SEEKING_YEARS;
  const target = Number.isFinite(maxAge) ? Math.min(PEER_MAX_AGE, Math.max(0, Math.floor(maxAge))) : 0;
  const rng = createRng(mixSeed(peerSeed, PEER_STREAM_SALT + index));
  // 인생 운은 나이에만 묶인다(상태와 무관) — 한 해 앞까지 미리 만들어 두면 한 해 앞의 후보를 볼 수 있고, maxAge가 달라도 같은 값이다
  const luck: number[] = [rng.next()];
  for (let t = 1; t <= target + 1; t++) {
    let u = luck[t - 1];
    if (t % PEER_BLOCK_YEARS === 0 && rng.next() >= keepChance) u = rng.next();
    luck.push(u);
  }
  /** 이 나이에 이 라벨이 나올 수 있는가(표의 가중치가 0이 아니다 — 허용 나이를 지킨다) */
  const possible = (status: PeerStatus, age: number): boolean => (peerBandOf(age).byWealth[PARENT_WEALTHS.indexOf(wealth)][status] ?? 0) > 0;
  /** 한 해의 후보: 인생 운을 그 나이의 표에 대 보고, 「구직 중」 상한·쉬는 해를 적용한다 */
  const candidate = (t: number, run: number, cooldown: number): SeriesStep => {
    let status = peerStatusOf(t, wealth, luck[t]);
    if (status === 'seeking' && (run >= maxSeekingYears || cooldown > 0)) {
      if (run >= maxSeekingYears) cooldown = PEER_SEEKING_COOLDOWN_YEARS;
      status = peerStatusOf(t, wealth, luck[t], 'seeking');
    }
    if (cooldown > 0) cooldown--;
    return { status, run: status === 'seeking' ? run + 1 : 0, cooldown };
  };
  /** 후보 대신 이 라벨로 하는 해: 쉬는 해 계산은 후보의 것을 그대로 쓰고 「구직 중」 연속만 다시 센다 */
  const forced = (status: PeerStatus, base: SeriesStep, run: number): SeriesStep => ({ status, run: status === 'seeking' ? run + 1 : 0, cooldown: base.cooldown });
  /** 「구직 중」은 상한·쉬는 해에 걸리지 않을 때만 받아들일 수 있다 */
  const allowed = (status: PeerStatus, t: number, run: number, cooldown: number): boolean =>
    possible(status, t) && (status !== 'seeking' || (run < maxSeekingYears && cooldown === 0));

  const minHold = options.minHoldYears ?? PEER_MIN_HOLD_YEARS;
  let run = 0; // 지금까지 이어진 「구직 중」 햇수
  let cooldown = 0; // 상한에 걸린 뒤 「구직 중」을 다시 막는 남은 햇수
  let held = 0; // 지금 라벨이 이어진 햇수
  const out: PeerStatus[] = [];
  for (let t = 0; t <= target; t++) {
    let step = candidate(t, run, cooldown);
    const prev = t > 0 ? out[t - 1] : null;
    if (prev !== null && step.status !== prev && minHold > 1) {
      if (held < minHold && allowed(prev, t, run, cooldown)) {
        // 막 시작한 상태는 최소 minHold년 유지한다: 시작한 라벨이 다음 해에 또 바뀌려 하면 한 해 더 이어 두 해를 채운다
        step = forced(prev, step, run);
      } else if (!allowed(step.status, t + 1, step.run, step.cooldown)) {
        // 새 라벨이 다음 해에는 있을 수 없다(허용 나이를 벗어남·「구직 중」 상한) — 시작하면 한 해짜리다: 시작하지 않고 이전 라벨을 잇는다(이을 수 없으면 다음 해 후보를 일찍 받아들인다)
        const next = candidate(t + 1, step.run, step.cooldown);
        if (allowed(prev, t, run, cooldown)) step = forced(prev, step, run);
        else if (allowed(next.status, t, run, cooldown)) step = forced(next.status, step, run);
      }
    }
    held = step.status === prev ? held + 1 : 1;
    run = step.run;
    cooldown = step.cooldown;
    out.push(step.status);
  }
  return out;
}

/** 또래 한 명이 그 나이에 보이는 요즘 모습 (`peerStatusSeries`의 마지막 칸). 한 해마다 도는 비용은 최대 120걸음이라 화면이 그릴 때마다 불러도 가볍다. */
export function peerStatusAt(peerSeed: number, index: number, wealth: ParentWealth, age: number): PeerStatus {
  const series = peerStatusSeries(peerSeed, index, wealth, age);
  return series[series.length - 1];
}

export interface PeerNow extends Peer {
  status: PeerStatus;
  /** 화면 라벨 (은퇴 뒤 다시 일하는 사람은 「다시 일하는 사람」, `PEER_RETURN_LABEL`) */
  label: string;
}

/** 줄기의 마지막 해 라벨: 그 해가 `working`이고 앞선 해에 `retired`가 있었으면 「다시 일하는 사람」, 아니면 상태의 기본 라벨 */
export function peerLabelOf(series: readonly PeerStatus[]): string {
  const status = series[series.length - 1];
  if (status === 'working' && series.slice(0, -1).includes('retired')) return PEER_RETURN_LABEL;
  return PEER_STATUS_LABEL[status];
}

/** 대시보드 또래 칸: 또래 4명(출생신고와 같은 인물)과 지금 나이의 라벨. 출생 이후 단계의 상태만 받는다. */
export function peersNow(game: Pick<GameState, 'age' | 'peerSeed' | 'character' | 'birthReport'>): PeerNow[] {
  const { character, birthReport: report, peerSeed } = game;
  if (character === null || report === null || peerSeed === null) throw new Error('peersNow: 출생 전 상태에는 또래가 없다');
  return peersOf(peerSeed, character.birthYear, report.month, character.name).map((p, i) => {
    const series = peerStatusSeries(peerSeed, i, p.wealth, game.age);
    return { ...p, status: series[series.length - 1], label: peerLabelOf(series) };
  });
}

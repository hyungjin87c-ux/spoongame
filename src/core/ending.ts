import { STAGE_TABLE } from '../data/lifeTable';
import { wealthBottomPercent, wealthTopPercent } from './birth';
import { stageOfAge } from './events';
import { coParentsFn, type CoParents } from './parentSubject';
import { STAGES, type Character, type Death, type GameState, type ProfileId, type HistoryEntry, type ParentWealth, type Stage, type Stats } from './types';

/**
 * 엔딩 회고의 계산 (순수 함수). React·타이머·Date·Math.random을 쓰지 않는다. 문구는 data/endingText.ts, 화면은 screens/EndingScreen.tsx.
 *
 * 2026-11-13 삭제(결정 후속 256): 엔딩의 「출발선 대비 자리」(같은 세대 최종 순자산 분위수표로 도착 자리·이동 판정을 말하던 카드)와 그 계산(`finalWealthStanding`·`movementOf`·분위수표)을 걷었다.
 * 이 파일에 남은 `startBandOf`·`bandFromRange`·`StartBand`는 룰렛·출생신고·프로필이 쓰는 **출발점의 수저 구간**("하위 25% 안쪽")이라 그대로다.
 * 학력·행복·관계는 뜻이 변하지 않는 값이라 "처음 → 마지막" 원값을 그대로 보여 준다. 건강(나이 들며 줄 뿐)·외모(고정)는 견주지 않는다.
 */

// ---------- 독립(스무 살) ----------

/** 스무 살(청년 단계 진입) 이후까지 산 인생인가: 이때부터 자산이 있다(엔딩의 최종 순자산 줄은 이런 인생에만 금액을 보인다). */
export function reachedIndependence(deathAge: number): boolean {
  return deathAge >= STAGE_TABLE.youth.startAge;
}

// ---------- 출발선 구간 ----------

/**
 * 출발선: 이 시대의 재력 단계가 출생아 가운데 차지하는 구간. low·high는 **아래에서부터 센 백분위**(정수, 0~100)다.
 * 예: 지난 세상 1단계(가중치 40%)는 [0, 40], 지금 세상 3단계는 [55, 83]. 클수록 부유한 방향이다.
 * 화면은 이 구간을 R-018과 같은 규칙(퍼센트는 50을 넘지 않는다)으로 말한다 — kind가 말하는 방식을 정하고, 말하는 숫자는 모두 1~50이다.
 *  - bottom/top: 맨 아래/맨 위 단계 — "하위 N% 안쪽" / "상위 N% 안쪽"   - outsideTop/outsideBottom: 한쪽 끝에 붙었지만 반대편이 50%를 넘는 구간 — "상위 N% 밖" / "하위 N% 밖"
 *  - lower/upper: 한쪽 절반 안의 구간 — "하위 A~B% 사이" / "상위 A~B% 사이"   - center: 50%를 걸친 구간 — "하위 A% 선과 상위 B% 선 사이"   - whole: 구간이 전체(단계가 하나뿐인 표)
 */
export type StartBand = { low: number; high: number } & (
  | { kind: 'bottom'; percent: number }
  | { kind: 'top'; percent: number }
  | { kind: 'outsideTop'; percent: number }
  | { kind: 'outsideBottom'; percent: number }
  | { kind: 'lower'; from: number; to: number }
  | { kind: 'upper'; from: number; to: number }
  | { kind: 'center'; bottom: number; top: number }
  | { kind: 'whole' }
);

/**
 * [low, high] (아래에서부터 센 백분위, 0 <= low <= high <= 100인 정수) → 말하는 방식이 정해진 구간. 화면의 퍼센트는 항상 1~50이고 "0~"·"~100" 같은 끝값이 나오지 않는다.
 *
 * **돌려주는 구간(low·high)은 화면 문구가 말하는 구간과 언제나 같다** (R-096). 폭이 0인 맨 아래·맨 위 구간 [0, 0]·[100, 100]은 "약 0%"·"약 100%"를 말할 수 없어
 * "하위 1% 안쪽"·"상위 1% 안쪽"으로 올려 말하는데, 그때 돌려주는 끝값도 같은 값으로 맞춘다: [0, 0] → low 0·high 1, [100, 100] → low 99·high 100.
 * 그 밖의 구간은 넘긴 값 그대로다. (현재 재력 가중치표에는 이런 구간이 없다 — 가중치가 0인 단계가 생기면 나온다.)
 */
export function bandFromRange(low: number, high: number): StartBand {
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 100 || low > high) throw new RangeError(`bandFromRange: 구간이 맞지 않는다 (${low}, ${high})`);
  const base = { low, high };
  if (low === 0 && high === 100) return { ...base, kind: 'whole' };
  if (low === 0) {
    if (high > 50) return { ...base, kind: 'outsideTop', percent: 100 - high };
    const top = Math.max(1, high); // 폭 0인 맨 아래 구간은 "하위 1% 안쪽"으로 올려 말하고, 판정 끝값도 1로 맞춘다 (R-096)
    return { low, high: top, kind: 'bottom', percent: top };
  }
  if (high === 100) {
    if (low < 50) return { ...base, kind: 'outsideBottom', percent: low };
    const bottom = Math.min(99, low); // 폭 0인 맨 위 구간은 "상위 1% 안쪽"으로 올려 말하고, 판정 끝값도 99로 맞춘다 (R-096)
    return { low: bottom, high, kind: 'top', percent: 100 - bottom };
  }
  if (low >= 50) return { ...base, kind: 'upper', from: 100 - high, to: 100 - low };
  if (high <= 50) return { ...base, kind: 'lower', from: low, to: high };
  return { ...base, kind: 'center', bottom: low, top: 100 - high };
}

/**
 * 이 세대 전체 기준(섞은 값 — `wealthMixtureOfGame`, GS7·D4-48)에서 이 재력 단계 출생아의 출발선 구간. 숫자는 수저 비율의 누적에서 계산한다(하드코딩 없음).
 * 구간 = [이 단계보다 낮은 단계의 비율, 이 단계까지의 비율]을 정수로 반올림한 값 (현재 표는 가중치가 정수라 반올림이 값을 바꾸지 않는다).
 */
export function startBandOf(wealthMixture: readonly number[], wealth: ParentWealth): StartBand {
  return bandFromRange(Math.round(100 - wealthTopPercent(wealthMixture, wealth)), Math.round(wealthBottomPercent(wealthMixture, wealth)));
}

// ---------- 생애 연표 ----------

export interface TimelineGroup {
  stage: Stage;
  /** 이 단계의 연표 항목 (시간순, 하나도 빼지 않는다) */
  entries: readonly HistoryEntry[];
  /**
   * `entries`와 같은 길이: 줄마다 그 해에 함께 사는 부모(SPEC-011 DS1 `coParentsOf`) — 부모 결정 줄(`by: 'parent'`)의 도장 주어를 화면이 그리기만 하게 한다. **저장하지 않는 파생값**이다.
   * 부모 결정 줄이 아닌 줄의 값은 쓰이지 않는다(`'both'`). 주어 함수를 주지 않으면 모두 `'both'`(기존 문구).
   */
  subjects: readonly CoParents[];
}

/**
 * 연표를 생애 단계(영유아·학창·청년·중년·노년)별로 묶는다. 항목은 하나도 버리지 않는다 — 선택한 순간(choice)은 물론 서술 이벤트와 단계 기록도 그대로다.
 * (정상 플레이의 연표는 약 40~50줄이고 최대 약 117줄이다. 요약으로 줄이지 않고 단계 제목으로 나눠 읽게 한다.)
 */
export function buildTimeline(history: readonly HistoryEntry[], subjectOf?: (age: number) => CoParents): TimelineGroup[] {
  const byStage = new Map<Stage, HistoryEntry[]>();
  for (const h of history) {
    const stage = stageOfAge(h.age);
    const list = byStage.get(stage);
    if (list === undefined) byStage.set(stage, [h]);
    else list.push(h);
  }
  return STAGES.filter((s) => byStage.has(s)).map((stage) => {
    const entries = byStage.get(stage)!;
    return { stage, entries, subjects: entries.map((h) => (h.kind === 'choice' && h.by === 'parent' && subjectOf !== undefined ? subjectOf(h.age) : 'both')) };
  });
}

/** 단계 제목에 붙이는 나이 범위: 영유아 0~6세 / 학창 7~19세 / … / 노년 65세~ */
export function stageRangeOf(stage: Stage): { from: number; to: number | null } {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return { from: STAGE_TABLE[stage].startAge, to: next === undefined ? null : STAGE_TABLE[next].startAge - 1 };
}

// ---------- 회고 한 벌 ----------

/** 엔딩 화면이 필요로 하는 상태: 사망·시대·캐릭터·출생 스냅샷이 모두 있다(저장 검증이 ending 단계에서 보장한다). */
export type EndingGame = GameState & { generation: ProfileId; character: Character; death: Death; birthStats: Stats };

/** 학력·행복·관계: 처음 값과 마지막 값을 그대로 견줄 수 있는(뜻이 변하지 않는) 스탯 */
export const COMPARABLE_STATS = ['education', 'happiness', 'relationships'] as const;
export type ComparableStat = (typeof COMPARABLE_STATS)[number];

export interface StatChange {
  stat: ComparableStat;
  from: number;
  to: number;
}

export interface EndingReview {
  changes: StatChange[];
  /** 본인이 고른 선택의 수 (연표의 선택 기록 중 `by`가 없는 것) — 부모님이 정한·흘러간 선택은 세지 않는다 (SPEC-005 PD9) */
  choiceCount: number;
  /**
   * 어린 시절 결정 중 부모가 정한 횟수(`by: 'parent'`)와 아이의 일로 흘러간 횟수(`by: 'child'`). 엔딩 화면은 이 횟수를 문장으로 그리지 않는다(형진 님 요청으로 PD9 둘째 줄을 없앴다, 2026-11-08) —
   * 「본인 + 부모님 + 흘러감 = 연표의 선택 줄 수」 불변식과 파이프라인 점검(`scripts/pipelineLib.ts`)이 읽는다.
   */
  delegated: { parent: number; child: number };
  timeline: TimelineGroup[];
}

export function reviewEnding(game: EndingGame): EndingReview {
  // 부모 결정 줄의 도장 주어는 줄의 나이로 가족 계획에서 정한다(DS1 — 현재 플래그를 읽지 않아 어른이 된 뒤 그려도 그 해의 값이다)
  const subjectOf = coParentsFn(game);
  return {
    changes: COMPARABLE_STATS.map((stat) => ({ stat, from: game.birthStats[stat], to: game.stats[stat] })),
    choiceCount: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === undefined ? n + 1 : n), 0),
    delegated: {
      parent: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === 'parent' ? n + 1 : n), 0),
      child: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === 'child' ? n + 1 : n), 0),
    },
    timeline: buildTimeline(game.history, subjectOf),
  };
}

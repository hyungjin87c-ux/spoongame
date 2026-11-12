import { DEFAULT_COOLDOWN, STAGE_TABLE } from '../data/lifeTable';
import { LIMITS } from '../data/economyTable';
import { ASK_EFFECTS, type AskKind } from '../data/askTable';
import { STAT_MAX, STAT_MIN, addDeltas, type StatDeltas } from './stats';
import { looksChannelMult, type LooksChannel } from './looks';
import type { PersonaView } from './persona';
import { APT_KEYS, APT_TIERS, TEMPER_IDS, type ActKind, type AptKey, type AptTier, type RoleKind, type TemperId } from './personaKinds';
import {
  DWELLINGS,
  ERAS,
  ERA_YEAR_SPAN,
  GENDERS,
  HOUSINGS,
  OCCUPATIONS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  STAGES,
  STAT_KEYS,
  type AssetDeltas,
  type Assets,
  type Character,
  type Dwelling,
  type Effects,
  type Era,
  type Gender,
  type HeavyKind,
  type Housing,
  type Occupation,
  type ParentingStyle,
  type Stage,
  type StatKey,
  type Stats,
} from './types';

/**
 * 이벤트 엔진의 데이터 모델과 검증. React·DOM과 무관한 순수 모듈.
 * 이벤트는 src/data/events/*.json 에 있고, 작성법은 docs/data/events-schema.md 에 있다.
 * 코드 수정 없이 JSON만 추가해도 동작하고, 잘못된 데이터는 로드할 때 바로 예외로 드러난다(validateEventFiles).
 */

// ---------- 모델 ----------

/** 조건 검증용 상한: 형제 순서는 다섯째까지(출생신고 추첨 범위), 부모 나이(어머니 나이 포함)는 130살까지만 적을 수 있다 */
const BIRTH_ORDER_MAX = 5;
const PARENT_AGE_MAX = 130;

export interface Range {
  min?: number;
  max?: number;
}

/** 달력 연도 닫힌 구간 (이벤트 `yearRange`) */
export interface YearRange {
  from?: number;
  to?: number;
}

export const EVENT_TRACKS = ['standard', 'common', 'assembled'] as const;
export type EventTrack = (typeof EVENT_TRACKS)[number];

/** 달력 연도가 `yearRange` 안인가 (없으면 모든 연도) */
export function inYearRange(year: number, r: YearRange | undefined): boolean {
  return r === undefined || ((r.from === undefined || year >= r.from) && (r.to === undefined || year <= r.to));
}

/**
 * `yearRange`가 걸치는 시대 구간들(`ERA_YEAR_SPAN`): 세 구간 모두에 걸치거나 범위가 없으면 undefined(= 모든 시대). 구간 위쪽 끝은 출생 2020 + 110세까지.
 * 예) `{ to: 2000 }` → ['past'] · `{ from: 2001 }` → ['present', 'future'] · `{ from: 2026 }` → ['future'] · `{ from: 1955, to: 1989 }` → ['past'].
 */
export function erasOfYearRange(r: YearRange | undefined, window?: { from: number; to: number }): Era[] | undefined {
  if (r === undefined) return undefined;
  // 이벤트가 실제로 일어날 수 있는 달력 연도(`reachableYears` — 출생 1940~2020 + 단계·나이 범위)와 구간이 겹치는 시대만 센다: 영아 이벤트는 2026년 이후에 일어날 수 없다
  const lo = Math.max(r.from ?? -Infinity, window?.from ?? -Infinity);
  const hi = Math.min(r.to ?? Infinity, window?.to ?? Infinity);
  const eras = ERAS.filter((e) => lo <= ERA_YEAR_SPAN[e].to && hi >= ERA_YEAR_SPAN[e].from);
  return eras.length === ERAS.length ? undefined : eras;
}

/** 20세 이상 이벤트의 자산 조건(만 원): 순자산 하한·상한, 부채 상한, 연 소득 하한, 지금 사는 집(주거 `Assets.dwelling` 중 하나). 자산이 없는 20세 미만 상태에서는 맞지 않는다. */
export interface AssetCondition {
  netMin?: number;
  netMax?: number;
  debtMax?: number;
  incomeMin?: number;
  /** 지금의 주거 형태(가족 집 family · 월세 rent · 전세 jeonse · 자가 own · 돌봄 시설 care) 중 하나 — `Assets.dwelling` (SPEC-003 M7e-3, E-4: 「혼자 먹는 저녁」은 독립 주거에서만) */
  dwelling?: Dwelling[];
}

/** 조건: 적힌 항목이 모두 맞아야(AND) 참이다. 배열 항목(parenting·gender)은 그중 하나면 맞다. */
export interface Condition {
  stats?: Partial<Record<StatKey, Range>>;
  looks?: Range;
  parentWealth?: Range;
  /** 자산 조건(순자산·부채·연 소득, 만 원) — 20세 이상 이벤트에서만 쓴다 (SPEC-003 EC3·EC4) */
  assets?: AssetCondition;
  /** 형제 순서(1 첫째 ~ 5 다섯째) — 출생신고에서 정해진 값 (SPEC-003 BR6) */
  birthOrder?: Range;
  /** 두 부모 중 나이가 많은 쪽의 지금 나이 = 태어났을 때 나이 + 아이의 지금 나이 (SPEC-003 BR6). 부모의 병환·임종처럼 부모 나이와 어긋나면 안 되는 사건에 쓴다. */
  parentAge?: Range;
  /** 어머니의 지금 나이 = 태어났을 때 어머니 나이 + 아이의 지금 나이 (SPEC-003 BR6, R-268). 「동생이 생겼다」처럼 어머니 나이가 한계를 넘으면 안 되는 사건에 쓴다. */
  motherAge?: Range;
  parenting?: ParentingStyle[];
  gender?: Gender[];
  /** 출생신고의 「사는 집」(자가 own · 임차 rent · 무상 거주 free) 중 하나 — 태어난 때의 집이라 어릴 때 이사로 달라졌을 수 있다(근사). 하나라도 맞으면 참 (SPEC-003 M7a r3, CM9) */
  housing?: Housing[];
  /** 모두 설정돼 있어야 한다 */
  flags?: string[];
  /** 하나도 설정돼 있지 않아야 한다 */
  notFlags?: string[];
  /**
   * 지금 가장 두드러진 기질 중 하나 (SPEC-018 PL3, `docs/data/persona-model.md` 3절). 이 판에 `persona`가 없거나(구형 저장·스위치 끔) 모르면 **맞지 않는다**(가족 조건과 같다) — 부정 조건은 만들지 않는다.
   */
  temper?: TemperId[];
  /** 적성 축별 단계(low·mid·high) 중 하나 — 적힌 축이 모두 맞아야 한다(AND). 단계만 읽고 숫자는 보이지 않는다. `persona`가 없으면 맞지 않는다 */
  apt?: Partial<Record<AptKey, AptTier[]>>;
  /** 진로 트랙의 직업: 분야(`field`) 또는 세부 직업 id(`id`) 중 적은 것이 모두 맞아야 한다. 직업이 없거나 `persona`가 없으면 맞지 않는다 (3단계가 직업을 채운다) */
  job?: { field?: Occupation[]; id?: string[] };
  /** 달력 연도(= 출생 연도 + 나이) 구간 — 자격·가중·선택지 가시성·보너스·문장 변주가 **같은 연도**를 읽는다(`condContextOf`가 채운다). 모르면 맞지 않는다 */
  year?: Range;
  /** `true`이면 이 판에 `persona`(맞춤 인생)가 있어야 한다 — 구형 저장·스위치 끈 판은 맞지 않는다 */
  tailored?: true;
}

/** 조건이 맞을 때 효과를 더한다(부모 재력·교육방식·외모 같은 캐릭터 속성을 효과에 반영하는 방법). */
export interface Bonus {
  when: Condition;
  effects: Effects;
}

/** 조건이 맞으면 이벤트 가중치에 weight를 곱한다(예: 외모가 높을수록 연애 이벤트 확률 상승). */
export interface Modifier {
  when: Condition;
  weight: number;
}

/**
 * 문장 변주 (SPEC-018 PL3, 설계 3절): `when`이 맞으면 기본 글 대신 `text`를 보인다. 사건·선택지당 최대 `MAX_TEXT_VARIANTS`(3)개, **먼저 맞는 것이 이긴다**.
 * **글만** 바꾼다 — 효과·선택지·확률은 바꿀 수 없다. 카드가 만들어질 때(해결 때) 고르고 연표 줄에는 최종 글이 적힌다. 라벨 변주는 없다.
 */
export interface TextVariant {
  when: Condition;
  text: string;
}

/** 사건·선택지 하나의 문장 변주 수 상한 */
export const MAX_TEXT_VARIANTS = 3;

export interface ChoiceDef {
  id: string;
  label: string;
  /** 고른 뒤 보여 주는 결과 문구 */
  result: string;
  /** 결과 문구의 변주 (먼저 맞는 것이 이긴다, 효과는 그대로) — 부모가 정하는 카드의 `parentResult`는 변주하지 않는다 */
  resultVariants?: TextVariant[];
  /** 활동 표지 (SPEC-018 PL1): 고르면 기질·적성이 약하게 움직인다 — 갱신 값은 코드 표 `ACT`·`ACTAPT` 한 곳(데이터에 값을 쓰지 않는다). 부모가 정한·흘러간 카드는 절반 */
  act?: ActKind;
  /** 본보기 어른 표지 (SPEC-018 PL1): 존경하는 어른을 겪는 선택이면 그 어른의 기질 쪽으로 약하게 움직인다 */
  role?: RoleKind;
  /**
   * 부모가 정하는 카드에서만 라벨 대신 쓰는 문구 (SPEC-005 PD11 처리 (b)) — 선택지 라벨이 아이의 행동이라 「부모님이 이렇게 정했습니다」와 어긋날 때만 둔다
   * (`school-puppy` 세 선택지, `school-academy-night`의 `friends`, `school-scholarship`의 `pass` — 3장·9개 문자열, R-452). 본인·흘러감 결정에서는 쓰지 않는다. 기록 줄·카드·엔딩은 `parentLabel ?? label`.
   */
  parentLabel?: string;
  /** 부모가 정하는 카드에서만 `result` 대신 쓰는 결과 문구 (위와 같다). `parentResult ?? result` */
  parentResult?: string;
  /**
   * 조르기 사건(`ask`)의 선택지에서만 쓰는 **거절 결과 문장** (SPEC-011 AK2, `docs/data/ask-model.md` 1-2절): `result` = 들어주기, `askDenied` = 안 들어주기(`beg`·`tantrum`, 사이는 안 나빠진다),
   * `askStrained` = 안 들어주기 + 사이 나빠짐(`tantrum`만). 문장만 데이터에 두고 **갈래별 효과는 데이터에 쓰지 않는다**(코드 표 `ASK_EFFECTS` 한 곳, 결정 AQ1). 거절 문장은 한 사건의 모든 판에 같은 글이다.
   */
  askDenied?: string;
  askStrained?: string;
  effects?: Effects;
  bonuses?: Bonus[];
  /** 이 조건을 만족할 때만 선택지가 보인다 */
  requires?: Condition;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  /** 본문의 변주 (SPEC-018 PL3, 먼저 맞는 것이 이긴다 — 글만 바뀐다) */
  textVariants?: TextVariant[];
  /** 본보기 어른 표지 — **서술 사건(선택지 없음)만** 쓴다 (선택지 이벤트는 선택지마다 `role`) */
  role?: RoleKind;
  stages: Stage[];
  ageRange?: Range;
  /**
   * 달력 연도(= 출생 연도 + 나이) 닫힌 구간 `[from, to]` 안에서만 일어난다 (SPEC-004 MG2). 한쪽이 없으면 열려 있고, 필드가 없거나 `{}`면 모든 연도다.
   * 제도·기술이 있던 연도에 걸린 소재의 시대 제한을 이것으로 건다(`docs/data/event-conversion.md`). 이벤트 id·선택지 id·본문은 바뀌지 않았다.
   */
  yearRange?: YearRange;
  /**
   * 알파 판에서의 취급 (SPEC-004 AL3·MG2): `standard` 정석 코스형(알파 판에서 변형으로 바꾸거나 닫는다 — GM9) · `common` 공통 · `assembled` 알파 전용. 데이터의 모든 이벤트가 갖는다.
   * 다른 세대에서는 `standard`·`common` 모두 지금처럼 나온다.
   */
  track?: EventTrack;
  /**
   * **파생 필드**(데이터에 쓰지 않는다): `yearRange`가 걸치는 시대 구간(`ERA_YEAR_SPAN`)들. 세 구간 모두에 걸치면 undefined다 — 시대 소재 점검(eventLint)·인용 연결(citations)이 시대 구간으로 묻는 곳에서 읽는다.
   * `createEventPool`이 채운다. 인용·시간 모델이 연도 축으로 바뀌면(GM10) 없어진다.
   */
  eras?: Era[];
  /**
   * 어린 시절 조르기 사건 표지 (SPEC-011 AK2, `docs/data/ask-model.md` 1-2절): `{ kind: 'toy' | 'lessons' | 'pet' }`. 이 사건은 아이가 「조른다 · 떼를 쓴다 · 참는다」를 고르는 카드이고(선택지 id `beg`·`tantrum`·`endure` 고정),
   * 분류표의 영역은 `['ask']` 하나다(결정자 R1a — 나이와 무관하게 본인). 들어주기은 재력 단계 × 부모와의 사이로 정해진다(`core/ask.ts`). 선택 필드 — 없으면 일반 사건이다. 저장 대상이 아니다(데이터에서 읽는다).
   */
  ask?: { kind: AskKind };
  /**
   * **파생 필드**(데이터에 쓰지 않는다 — `eras`와 같은 방식): `ask`가 있는 사건마다 **같은 종류의 다른 조르기 사건 id**. `createEventPool`이 채우고 `isEventEligible`이 그중 하나라도 이미 본 적(`seen`)이 있으면 후보에서 뺀다 —
   * 시대 경계를 넘는 판에서 같은 종류의 다른 시대 사건이 또 뜨지 않게 한다(한 종류 최대 1장·판당 최대 3장, 새 저장 이름 없음 — 결정 AQ2). `seen`은 카드가 뜰 때 기록되므로 해결 전 새로고침에도 같은 종류가 다시 뜨지 않는다.
   */
  askPeers?: string[];
  /**
   * 결정 줄 질문 문장 (SPEC-014 QS1): 선택지 이벤트의 상황을 되묻는 「…할까?」 한 문장(사건당 하나, 그 사건의 모든 선택지가 같다, ≤ 30자). 선택지 이벤트만 쓴다.
   * `resolveChoiceCore`가 인생 기록 줄(`HistoryEntry.question`)에 적고, 인생 기록·엔딩 연표의 윗줄이 제목보다 먼저 쓴다. 선택지 카드의 질문 자리(「어떻게 하겠습니까?」)와 카드 읽기 글자 수에는 닿지 않는다.
   */
  question?: string;
  weight: number;
  once: boolean;
  /** once가 아닐 때 같은 이벤트가 다시 나오기까지의 최소 년수 (기본 DEFAULT_COOLDOWN) */
  cooldown?: number;
  conditions?: Condition;
  modifiers?: Modifier[];
  /** 서술 이벤트(선택지 없음)의 효과 */
  effects?: Effects;
  bonuses?: Bonus[];
  /** 선택지 이벤트(정의 2~4개, 어떤 상태에서도 보이는 것은 2~3개). 없으면 서술 이벤트. */
  choices?: ChoiceDef[];
  /**
   * 마일스톤 이벤트 (SPEC-003 IN3, M7a): 정한 나이 창(ageRange) 안에서 **모든 판**에 일어나는 서술 이벤트(첫 예방접종·첫 걸음마·첫 말).
   * 일반 추첨과 별개 슬롯이라 그 해의 일반 사건과 **함께** 연표에 한 줄을 남기고, 창의 마지막 해에는 100% 일어난다(`life.ts#stepYear`). 서술 전용·once 전용.
   */
  milestone?: boolean;
  /**
   * 일으키는 방식 (SPEC-009 K2, 설계 문서 7-2절): `'family'`이면 **일반 추첨·마일스톤 슬롯 후보가 아니다** — 가족 구성이 정한 해에만 `life.ts#stepYear`의 강제 슬롯이 일으킨다(`familyChangesFor`의 `forcedEvent`).
   * 지금은 `infant-new-sibling`(첫째의 첫 동생 반응 카드) 하나다. 조건(`conditions`)·`weight`·`modifiers`는 읽히지 않는다(검증은 그대로 한다). 선택지 이벤트·`once` 전용이고 `ageRange`가 있어야 한다.
   */
  trigger?: 'family';
  /**
   * 중대 결정 카드의 인용 연결 (SPEC-003 MD2, M7b — docs/data/content-M7b.md 5절 안 A). 선택지 이벤트만 쓴다.
   * 문자열 `"c-006"` = 이 카드가 뜨는 모든 세상에서 같은 인용, 객체 `{ past?, present?, future? }` = 세상마다 다른 인용(적히지 않은 세상은 인용 없음).
   * 인용이 그 세상에서 실제로 보이는지(시대·게임 속 연도)는 `core/citations.ts#citationFor`가 가른다.
   */
  citation?: string | Partial<Record<Era, string>>;
  /** 인용을 어느 세상에서도 붙이지 않는 카드의 사유 코드 — `NO_CITATION_CODES` (X1~X6 원칙적 무인용, D 맞는 자료 없음). `citation`과 함께 쓰지 않는다 */
  noCitation?: NoCitationCode;
  /**
   * 무거운 장면 표지 (SPEC-005 HV2, docs/data/events-schema.md 「무거운 장면 표지」): 사람이 다치거나 무언가를 잃는 장면(몸의 병·돌봄과 임종·관계 단절·방임/괴롭힘·생계 붕괴)이면 분류를 붙인다.
   * 설정 「무거운 장면 가리기」가 켜지면 이 이벤트의 **글**(제목·본문·선택지·결과·인용)이 화면에서 가려진다 — 사건·선택·효과·확률·난수·플래그는 그대로다(방식 A). 판단 단위는 이벤트 하나이고 선택지 단위 표지는 없다.
   * 서술 이벤트와 선택지 이벤트에 쓸 수 있고 마일스톤에는 쓰지 않는다. 저장 대상이 아니다(데이터에서 읽는다).
   */
  heavy?: { kind: HeavyKind };
  /**
   * 동적 후보 카드 (SPEC-018 PL4, 설계 4절 `[CX-002-001·002]`): `{ kind: 'field' | 'detail' }` — 진로 트랙의 분야 카드(`job-pick-field`)·세부 직업 카드(`job-pick-detail`) 전용.
   * 정의 `choices`가 없고 **일반 추첨 후보도 아니다**(`isEventEligible`가 거짓 — `trigger` 사건 전례). 후보는 카드가 열릴 때 `core/careerTrack.ts`가 정하고 안정 id를 `pending.choiceIds`에 저장한다.
   * 렌더·영향 줄·해결·자동 선택·복원은 모두 `pickChoicesOf` 하나를 거친다. 서술 이벤트처럼 보이지만 `once`가 아니고 간격·반복 린트의 예외다(전용 린트 `pickEventProblems`가 따로 본다).
   */
  pick?: { kind: 'field' | 'detail' };
  /**
   * 대체된 옛 사건 표지 (SPEC-018 PL4, 설계 4절 `[CX-002-002]`): `'persona'`이면 **맞춤 인생이 켜진 판에서는 일어나지 않는다**(진로 트랙이 대신한다 — `youth-first-job`). `persona`가 없는 판(구형 저장·스위치 끔)은 동작이 같다(골든 대상).
   */
  retiredWith?: 'persona';
  /**
   * 외모 영향 채널 (SPEC-018 PL16, 설계 4B): `'romance'`(연애·소개·첫 만남) · `'friend'`(교우). 있으면 `eventWeight`가 `modifiers` 곱 뒤에 표준 표 `LOOKW[채널][외모 단계]`를 곱한다
   * (시대 배율 `LOOKERA`는 맞춤 인생이 있는 판에서만). 외모는 가중에만 닿고 자격·선택지를 막지 않는다. 표준 표는 `persona`가 없는 판·스위치를 끈 판에도 적용한다(밸런스 변경, F11).
   */
  looksChannel?: LooksChannel;
}

/**
 * `noCitation`의 사유 코드 (content-M7b 1-4절): X1 의료·응급·진단 / X2 임종·가족 갈등의 존엄 / X3 재무·법률 행위 / X4 낙인 위험 / X5 다가올 세상 상상 전용 / X6 양육 방식 가치판단 유도 —
 * 이 여섯은 **원칙적 무인용**이라 목록 변경에 마스터 승인이 필요하다(M-8). D는 맞는 자료가 없어 서술 장면으로 둔 카드.
 */
export const NO_CITATION_CODES = ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'D'] as const;
export type NoCitationCode = (typeof NO_CITATION_CODES)[number];

/** 인용 id 형식 (`citations.json`의 id) */
export const CITATION_ID_PATTERN = /^c-\d{3}$/;

export function isChoiceEvent(ev: EventDef): boolean {
  return ev.choices !== undefined && ev.choices.length > 0;
}

/** 마일스톤 슬롯의 이벤트인가 (일반 추첨 후보에서는 빠진다) */
export function isMilestoneEvent(ev: EventDef): boolean {
  return ev.milestone === true;
}

export interface EventPool {
  events: readonly EventDef[];
  byId: ReadonlyMap<string, EventDef>;
}

/** 이벤트 목록 → 풀. id가 겹치면 throw. 개별 이벤트의 형태 검증은 validateEventFiles가 한다. */
export function createEventPool(input: readonly EventDef[]): EventPool {
  const byId = new Map<string, EventDef>();
  // 조르기 사건의 종류별 id 목록(입력 순서) — 파생 `askPeers`의 재료
  const askByKind = new Map<AskKind, string[]>();
  for (const ev of input) if (ev.ask !== undefined) askByKind.set(ev.ask.kind, [...(askByKind.get(ev.ask.kind) ?? []), ev.id]);
  // 파생 `eras`(yearRange가 있는 이벤트만; 세 시대 모두에 걸치면 필드 없음)와 `askPeers`(조르기 사건만 — 같은 종류의 다른 사건 id)를 채운다. 입력 객체는 건드리지 않는다
  const events = input.map((ev) => {
    const eras = erasOfYearRange(ev.yearRange, reachableYears(ev));
    const askPeers = ev.ask === undefined ? undefined : (askByKind.get(ev.ask.kind) ?? []).filter((id) => id !== ev.id);
    if (eras === undefined && askPeers === undefined) return ev;
    return { ...ev, ...(eras === undefined ? {} : { eras }), ...(askPeers === undefined ? {} : { askPeers }) };
  });
  for (const ev of events) {
    if (byId.has(ev.id)) throw new Error(`createEventPool: 이벤트 id가 겹친다 (${ev.id})`);
    byId.set(ev.id, ev);
  }
  return { events, byId };
}

// ---------- 조건 평가 ----------

/**
 * 조건이 읽는 출생 가족 정보 (출생신고 상세에서 온다: 형제 순서와 태어났을 때 부모 나이).
 * (SPEC-009 FM4a: 예전 이름 `FamilyView`는 가족 모델의 보기 `core/familyModel.ts#FamilyView`가 가져갔다 — 이 타입은 이름만 바꿨고 모양은 그대로다.)
 */
export interface CondFamilyInfo {
  birthOrder: number;
  motherBirthAge: number;
  fatherBirthAge: number;
  /** 출생신고의 사는 집(housing 조건에 필요). 모르면(옛 상태·시험용) housing 조건은 맞지 않는다. */
  housing?: Housing;
}

export interface CondContext {
  character: Character;
  stats: Stats;
  flags: ReadonlySet<string>;
  /** 지금 아이의 나이 (parentAge 조건에 필요) */
  age?: number;
  /** 출생 가족 정보 (birthOrder·parentAge 조건에 필요). 없으면 그 조건은 맞지 않는 것으로 본다. */
  family?: CondFamilyInfo | null;
  /** 자산 현황 (assets 조건에 필요). 20세 미만은 null이고, 모르면(undefined) 그 조건은 맞지 않는다. */
  assets?: Assets | null;
  /** 달력 연도 (`year` 조건에 필요). 모르면 그 조건은 맞지 않는다. `condContextOf`가 채운다 — 자격(`stepYear`의 `view.year`)과 같은 값이다 (SPEC-018 보충 6) */
  year?: number;
  /** 기질·적성 보기 (`temper`·`apt`·`job`·`tailored` 조건에 필요). `null`·없음 = 맞춤 인생이 없는 판(중립) — 그 조건은 맞지 않는다 */
  persona?: PersonaView | null;
}

const inRange = (value: number, r: Range | undefined): boolean =>
  r === undefined || ((r.min === undefined || value >= r.min) && (r.max === undefined || value <= r.max));

export function meetsCondition(cond: Condition | undefined, ctx: CondContext): boolean {
  if (cond === undefined) return true;
  if (cond.stats) {
    for (const key of STAT_KEYS) if (!inRange(ctx.stats[key], cond.stats[key])) return false;
  }
  if (!inRange(ctx.character.looks, cond.looks)) return false;
  if (!inRange(ctx.character.parentWealth, cond.parentWealth)) return false;
  if (cond.assets !== undefined) {
    const a = ctx.assets;
    if (a === undefined || a === null) return false;
    const c = cond.assets;
    if (c.netMin !== undefined && a.net < c.netMin) return false;
    if (c.netMax !== undefined && a.net > c.netMax) return false;
    if (c.debtMax !== undefined && a.debt > c.debtMax) return false;
    if (c.incomeMin !== undefined && a.income < c.incomeMin) return false;
    if (c.dwelling !== undefined && !c.dwelling.includes(a.dwelling)) return false;
  }
  if (cond.birthOrder !== undefined || cond.parentAge !== undefined || cond.motherAge !== undefined || cond.housing !== undefined) {
    // 가족 정보를 모르는데 가족 조건이 걸려 있으면 맞지 않는다(말이 안 되는 사건이 일어나는 쪽보다 안 일어나는 쪽이 안전하다)
    const family = ctx.family;
    if (family === undefined || family === null) return false;
    if (!inRange(family.birthOrder, cond.birthOrder)) return false;
    if (cond.housing !== undefined && (family.housing === undefined || !cond.housing.includes(family.housing))) return false;
    if (cond.parentAge !== undefined) {
      if (ctx.age === undefined) return false;
      if (!inRange(Math.max(family.motherBirthAge, family.fatherBirthAge) + ctx.age, cond.parentAge)) return false;
    }
    if (cond.motherAge !== undefined) {
      if (ctx.age === undefined) return false;
      if (!inRange(family.motherBirthAge + ctx.age, cond.motherAge)) return false;
    }
  }
  if (cond.parenting && !cond.parenting.includes(ctx.character.parenting)) return false;
  if (cond.gender && !cond.gender.includes(ctx.character.gender)) return false;
  if (cond.flags && !cond.flags.every((f) => ctx.flags.has(f))) return false;
  if (cond.notFlags && cond.notFlags.some((f) => ctx.flags.has(f))) return false;
  if (cond.year !== undefined && (ctx.year === undefined || !inRange(ctx.year, cond.year))) return false;
  if (cond.tailored === true && !ctx.persona) return false;
  if (cond.temper !== undefined || cond.apt !== undefined || cond.job !== undefined) {
    // 기질·적성·직업 조건: `persona`가 없거나 모르면 맞지 않는다 (안 일어나는 쪽이 안전하다 — 가족 조건과 같다)
    const persona = ctx.persona;
    if (!persona) return false;
    if (cond.temper !== undefined && !cond.temper.includes(persona.shown)) return false;
    if (cond.apt !== undefined) {
      for (const key of APT_KEYS) {
        const tiers = cond.apt[key];
        if (tiers !== undefined && !tiers.includes(persona.tiers[key])) return false;
      }
    }
    if (cond.job !== undefined) {
      const job = persona.job;
      if (job === undefined) return false;
      if (cond.job.field !== undefined && !cond.job.field.includes(job.field)) return false;
      if (cond.job.id !== undefined && (job.id === undefined || !cond.job.id.includes(job.id))) return false;
    }
  }
  return true;
}

/** 문장 변주를 고른다: 먼저 맞는 것이 이긴다(맞는 것이 없으면 기본 글). 글만 고르고 효과·확률에는 닿지 않는다 */
export function variantText(base: string, variants: readonly TextVariant[] | undefined, ctx: CondContext): string {
  if (variants !== undefined) for (const v of variants) if (meetsCondition(v.when, ctx)) return v.text;
  return base;
}

/** 이 판에서 사건 본문으로 보이는 글 (`textVariants` 반영) */
export const eventTextOf = (ev: Pick<EventDef, 'text' | 'textVariants'>, ctx: CondContext): string => variantText(ev.text, ev.textVariants, ctx);

/** 이 판에서 선택지 결과로 보이는 글 (`resultVariants` 반영) */
export const choiceResultOf = (choice: Pick<ChoiceDef, 'result' | 'resultVariants'>, ctx: CondContext): string => variantText(choice.result, choice.resultVariants, ctx);

/** 맞춤 인생 조건(`temper`·`apt`·`job`·`tailored`)을 쓰는 조건인가 — 이 조건을 쓰는 사건은 「조건 없는 선택지 ≥ 2」 대신 격자 하한 검사(`eventLint#visibleChoiceGridProblems`)를 받는다 (설계 3절) */
export function isPersonaCondition(c: Condition | undefined): boolean {
  return c !== undefined && (c.temper !== undefined || c.apt !== undefined || c.job !== undefined || c.tailored !== undefined);
}

/** 사건이 가진 모든 조건(사건 조건·모디파이어·보너스·선택지 requires·선택지 보너스·문장 변주의 when) */
export function eventConditions(ev: EventDef): Condition[] {
  const out: Condition[] = [];
  const add = (c: Condition | undefined): void => {
    if (c !== undefined) out.push(c);
  };
  add(ev.conditions);
  for (const m of ev.modifiers ?? []) add(m.when);
  for (const b of ev.bonuses ?? []) add(b.when);
  for (const v of ev.textVariants ?? []) add(v.when);
  for (const c of ev.choices ?? []) {
    add(c.requires);
    for (const b of c.bonuses ?? []) add(b.when);
    for (const v of c.resultVariants ?? []) add(v.when);
  }
  return out;
}

/** 이 사건이 맞춤 인생 조건을 하나라도 쓰는가 */
export const usesPersonaCondition = (ev: EventDef): boolean => eventConditions(ev).some(isPersonaCondition);

/** 지금 보이는 선택지(requires를 만족하는 것). 순서는 이벤트에 적힌 순서 그대로. */
export function visibleChoices(ev: EventDef, ctx: CondContext): ChoiceDef[] {
  return (ev.choices ?? []).filter((c) => meetsCondition(c.requires, ctx));
}

/** 이벤트가 일어날 수 있는 상태의 요약 (state에서 필요한 것만) */
export interface EligibilityView extends CondContext {
  age: number;
  /** 달력 연도 = 출생 연도 + 나이 (`yearRange`를 가른다) */
  year: number;
  /** id -> 마지막으로 일어난 나이 */
  seen: Readonly<Record<string, number>>;
}

export function stageOfAge(age: number): Stage {
  let found: Stage = 'infant';
  for (const s of STAGES) if (age >= STAGE_TABLE[s].startAge) found = s;
  return found;
}

/** 본 이벤트 기록에서 이 id를 마지막으로 본 나이. 자기 속성만 읽는다(`constructor` 같은 상속 속성이 "본 적 있음"으로 읽히지 않게, R-046). */
export function lastSeenAge(seen: Readonly<Record<string, number>>, id: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(seen, id) ? seen[id] : undefined;
}

export function isEventEligible(ev: EventDef, view: EligibilityView): boolean {
  if (ev.trigger !== undefined) return false; // 가족 구성이 일으키는 사건은 일반 추첨 후보가 아니다 (K2)
  if (ev.pick !== undefined) return false; // 진로 트랙 카드는 전용 예약 경로가 낸다 (SPEC-018 PL4)
  if (ev.retiredWith === 'persona' && view.persona) return false; // 맞춤 인생이 켜진 판에서는 진로 트랙이 대신한다
  if (!ev.stages.includes(stageOfAge(view.age))) return false;
  if (!inRange(view.age, ev.ageRange)) return false;
  if (!inYearRange(view.year, ev.yearRange)) return false;
  const last = lastSeenAge(view.seen, ev.id);
  if (last !== undefined) {
    if (ev.once) return false;
    if (view.age - last < (ev.cooldown ?? DEFAULT_COOLDOWN)) return false;
  }
  // 조르기: 같은 종류의 다른 사건을 이미 본 판에서는 나오지 않는다 (한 종류 최대 1장 — 파생 필드 `askPeers`, SPEC-011 AK2)
  if (ev.askPeers !== undefined && ev.askPeers.some((id) => lastSeenAge(view.seen, id) !== undefined)) return false;
  if (!meetsCondition(ev.conditions, view)) return false;
  if (isChoiceEvent(ev) && visibleChoices(ev, view).length < 2) return false;
  return true;
}

/** 기본 가중치 × 조건이 맞는 modifier 가중치들의 곱 */
export function eventWeight(ev: EventDef, ctx: CondContext): number {
  let w = ev.weight;
  for (const m of ev.modifiers ?? []) if (meetsCondition(m.when, ctx)) w *= m.weight;
  if (ev.looksChannel !== undefined) w *= looksChannelMult(ev.looksChannel, ctx.character.looks, ctx.year, ctx.persona !== undefined && ctx.persona !== null);
  return w;
}

export interface ResolvedEffects {
  stats: StatDeltas;
  /** 자산 변화(만 원, 20세 이상 이벤트). 없으면 0 */
  assets: Required<AssetDeltas>;
  /** 집안 살림 변화(만 원, 20세 미만 이벤트). 없으면 0 */
  family: number;
  setFlags: string[];
  clearFlags: string[];
}

/** 기본 효과 + 조건이 맞는 보너스 효과를 합친다. 보너스 조건은 효과를 적용하기 전 상태로 판정한다(보너스끼리 연쇄하지 않는다). */
export function resolveEffects(base: Effects | undefined, bonuses: Bonus[] | undefined, ctx: CondContext): ResolvedEffects {
  let stats: StatDeltas = { ...(base?.stats ?? {}) };
  const assets = { net: base?.assets?.net ?? 0, income: base?.assets?.income ?? 0, debt: base?.assets?.debt ?? 0 };
  let family = base?.family ?? 0;
  const setFlags = [...(base?.setFlags ?? [])];
  const clearFlags = [...(base?.clearFlags ?? [])];
  for (const b of bonuses ?? []) {
    if (!meetsCondition(b.when, ctx)) continue;
    stats = addDeltas(stats, b.effects.stats ?? {});
    assets.net += b.effects.assets?.net ?? 0;
    assets.income += b.effects.assets?.income ?? 0;
    assets.debt += b.effects.assets?.debt ?? 0;
    family += b.effects.family ?? 0;
    setFlags.push(...(b.effects.setFlags ?? []));
    clearFlags.push(...(b.effects.clearFlags ?? []));
  }
  return { stats, assets, family, setFlags, clearFlags };
}

// ---------- 스키마 검증 ----------

export const FLAG_PATTERN = /^[a-z][a-z0-9_]{0,38}$/;
/** 기록 카드(notes.json) id의 접두 — `seen`에 이 접두의 키는 기록 카드 전용이다(M7c, 이벤트 id는 이 접두로 시작하지 못한다) */
export const NOTE_ID_PREFIX = 'note-';
export const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
/** 직업 id 형식 (`persona.job.id`·`Condition.job.id`, 3단계 `jobs.json`의 id) */
const JOB_ID_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;
const MAX_AGE_ABS = 110;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * 수치 한도 (R-046): 검증은 통과하지만 런타임을 깨는 값을 막는다.
 *  - 가중치: 이벤트 0.1~100, 모디파이어 배수 0.1~10. 0에 가까운 값은 곱할수록 언더플로해 확률이 사라진다.
 *  - 모디파이어는 이벤트당 최대 MAX_MODIFIERS개, 곱의 최악(모두 맞을 때/모두 안 맞을 때)도 [MIN_EFFECTIVE_WEIGHT, MAX_EFFECTIVE_WEIGHT]를 지킨다.
 *  - 보너스는 목록당 최대 MAX_BONUSES개. 한 스탯에 더해질 수 있는 변화량의 최악의 합(기본 효과 + 모든 보너스)도 ±MAX_TOTAL_DELTA 이내여야 한다.
 *    자동 선택이 점수의 지수(Math.exp)를 가중치로 쓰므로, 합이 한없이 커지면 Infinity가 된다.
 */
export const MIN_EVENT_WEIGHT = 0.1;
export const MAX_EVENT_WEIGHT = 100;
export const MIN_MODIFIER_WEIGHT = 0.1;
export const MAX_MODIFIER_WEIGHT = 10;
export const MAX_MODIFIERS = 6;
/**
 * 선택지 수: 정의는 최대 6개(SPEC-018 PL3 — 4에서 올렸다), 같은 상태에서 보이는 것은 최대 3개(최소 2개 — 조건 없는 선택지가 2개 이상, 맞춤 조건을 쓰는 사건은 대신 격자 하한). 정의가 3개를 넘는 이벤트(infant-new-sibling: 플래그 유무로 grandma·notice가 배타)는
 * 서로 같이 보일 수 없는 선택지가 있을 때만 쓸 수 있다 — lint가 「동시에 보일 수 있는 선택지의 최대 수 ≤ 3」을 점검한다(eventLint#visibleChoiceProblems).
 */
export const MAX_DEFINED_CHOICES = 6;
export const MAX_VISIBLE_CHOICES = 3;
/** 한 해에 일어날 수 있는 마일스톤의 최대 수 (life.ts#stepYear). 창 끝이 이른 것부터, 같으면 id 오름차순으로 칸을 채우고 연표에는 id 오름차순으로 남긴다. */
export const MILESTONES_PER_YEAR_MAX = 3;
export const MIN_EFFECTIVE_WEIGHT = 0.01;
export const MAX_EFFECTIVE_WEIGHT = 10000;
export const MAX_BONUSES = 8;
export const MAX_TOTAL_DELTA = 50;
/** 자산 효과의 절댓값 상한(만 원): 순자산·부채 ±50,000, 소득 보정 ±5,000, 집안 살림 ±3,000. 한 선택지의 기본 + 모든 보너스의 최악의 합도 이 안이어야 한다. */
export const ASSET_DELTA_CAP = { net: 50_000, income: 5_000, debt: 50_000 } as const;
export const FAMILY_DELTA_CAP = 3_000;

/**
 * 이벤트 id 예약어 (R-046): 본 이벤트 기록(seen)은 평범한 객체라 `constructor` 같은 이름이 상속 속성으로 읽힐 수 있다.
 * 읽는 쪽(lastSeenAge)도 자기 속성만 보지만, 데이터 단계에서도 막아 둔다. 대소문자는 구분하지 않는다.
 */
export const RESERVED_EVENT_IDS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype).map((n) => n.toLowerCase()),
  'prototype',
  'proto',
  '__proto__',
]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export class EventDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`이벤트 데이터 오류 ${problems.length}건:\n- ${problems.join('\n- ')}`);
    this.name = 'EventDataError';
    this.problems = problems;
  }
}

/** 문제 목록에 `경로: 메시지`를 쌓는 작은 도우미 */
class Problems {
  readonly list: string[] = [];
  constructor(private readonly prefix: string) {}
  add(path: string, msg: string): void {
    this.list.push(`${this.prefix}${path ? ` ${path}` : ''}: ${msg}`);
  }
}

function checkKeys(o: Obj, allowed: readonly string[], required: readonly string[], path: string, p: Problems): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) p.add(path, `알 수 없는 항목 "${k}" (오타일 수 있다. 허용: ${allowed.join(', ')})`);
  for (const k of required) if (o[k] === undefined) p.add(path, `필수 항목 "${k}"가 없다`);
}

function checkText(v: unknown, path: string, min: number, max: number, p: Problems): void {
  if (typeof v !== 'string') return void p.add(path, '문자열이어야 한다');
  if (v !== v.trim()) p.add(path, '앞뒤 공백이 있다');
  if (CONTROL_CHARS.test(v)) p.add(path, '줄바꿈 등 제어 문자가 있다');
  if (v.length < min || v.length > max) p.add(path, `길이는 ${min}~${max}자여야 한다 (지금 ${v.length}자)`);
}

function checkRange(v: unknown, path: string, lo: number, hi: number, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '{ min, max } 객체여야 한다');
  checkKeys(v, ['min', 'max'], [], path, p);
  if (v.min === undefined && v.max === undefined) p.add(path, 'min 또는 max가 하나는 있어야 한다');
  for (const k of ['min', 'max'] as const) {
    const x = v[k];
    if (x === undefined) continue;
    if (!isInt(x) || x < lo || x > hi) p.add(`${path}.${k}`, `${lo}~${hi}의 정수여야 한다`);
  }
  if (isInt(v.min) && isInt(v.max) && v.min > v.max) p.add(path, `min(${v.min})이 max(${v.max})보다 크다`);
}

/** 플래그 이름 목록 검사. 문제가 없으면 true. */
function checkFlagList(v: unknown, path: string, p: Problems): boolean {
  if (!Array.isArray(v) || v.length === 0) {
    p.add(path, '비어 있지 않은 배열이어야 한다');
    return false;
  }
  let ok = true;
  const seen = new Set<string>();
  v.forEach((f, i) => {
    if (typeof f !== 'string' || !FLAG_PATTERN.test(f)) {
      p.add(`${path}[${i}]`, `플래그 이름은 소문자·숫자·밑줄(예: first_job)이어야 한다 (지금 ${JSON.stringify(f)})`);
      ok = false;
    } else if (seen.has(f)) {
      p.add(`${path}[${i}]`, `플래그가 중복이다 (${f})`);
      ok = false;
    }
    seen.add(String(f));
  });
  return ok;
}

function checkEnumList<T extends string>(v: unknown, all: readonly T[], path: string, p: Problems): void {
  if (!Array.isArray(v) || v.length === 0) return void p.add(path, `비어 있지 않은 배열이어야 한다 (허용: ${all.join(', ')})`);
  const seen = new Set<unknown>();
  v.forEach((x, i) => {
    if (!all.includes(x as T)) p.add(`${path}[${i}]`, `허용되지 않는 값 ${JSON.stringify(x)} (허용: ${all.join(', ')})`);
    else if (seen.has(x)) p.add(`${path}[${i}]`, `값이 중복이다 (${String(x)})`);
    seen.add(x);
  });
}

function checkAssetCondition(v: unknown, path: string, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '{ netMin, netMax, debtMax, incomeMin, dwelling } 객체여야 한다');
  checkKeys(v, ['netMin', 'netMax', 'debtMax', 'incomeMin', 'dwelling'], [], path, p);
  if (Object.keys(v).length === 0) p.add(path, '비어 있다');
  const bounded = (k: string, lo: number, hi: number): void => {
    const x = v[k];
    if (x !== undefined && (!isInt(x) || x < lo || x > hi)) p.add(`${path}.${k}`, `${lo}~${hi}의 정수여야 한다 (만 원)`);
  };
  bounded('netMin', LIMITS.netMin, LIMITS.netMax);
  bounded('netMax', LIMITS.netMin, LIMITS.netMax);
  bounded('debtMax', 0, LIMITS.debtMax);
  bounded('incomeMin', 0, LIMITS.incomeMax);
  if (isInt(v.netMin) && isInt(v.netMax) && v.netMin > v.netMax) p.add(path, `netMin(${v.netMin})이 netMax(${v.netMax})보다 크다`);
  if (v.dwelling !== undefined) checkEnumList(v.dwelling, DWELLINGS, `${path}.dwelling`, p);
}

function checkCondition(v: unknown, path: string, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '조건 객체여야 한다');
  checkKeys(v, ['stats', 'looks', 'parentWealth', 'assets', 'birthOrder', 'parentAge', 'motherAge', 'parenting', 'gender', 'housing', 'flags', 'notFlags', 'temper', 'apt', 'job', 'year', 'tailored'], [], path, p);
  if (Object.keys(v).length === 0) p.add(path, '빈 조건이다 (항목을 쓰거나 조건 자체를 빼야 한다)');
  if (v.stats !== undefined) {
    if (!isObj(v.stats)) p.add(`${path}.stats`, '{ 스탯이름: { min, max } } 객체여야 한다');
    else {
      for (const [k, r] of Object.entries(v.stats)) {
        if (!(STAT_KEYS as readonly string[]).includes(k)) p.add(`${path}.stats.${k}`, `알 수 없는 스탯 (허용: ${STAT_KEYS.join(', ')})`);
        else checkRange(r, `${path}.stats.${k}`, STAT_MIN, STAT_MAX, p);
      }
      if (Object.keys(v.stats).length === 0) p.add(`${path}.stats`, '비어 있다');
    }
  }
  if (v.looks !== undefined) checkRange(v.looks, `${path}.looks`, 0, 100, p);
  if (v.parentWealth !== undefined) checkRange(v.parentWealth, `${path}.parentWealth`, PARENT_WEALTHS[0], PARENT_WEALTHS[PARENT_WEALTHS.length - 1], p);
  if (v.assets !== undefined) checkAssetCondition(v.assets, `${path}.assets`, p);
  if (v.birthOrder !== undefined) checkRange(v.birthOrder, `${path}.birthOrder`, 1, BIRTH_ORDER_MAX, p);
  if (v.parentAge !== undefined) checkRange(v.parentAge, `${path}.parentAge`, 0, PARENT_AGE_MAX, p);
  if (v.motherAge !== undefined) checkRange(v.motherAge, `${path}.motherAge`, 0, PARENT_AGE_MAX, p);
  if (v.parenting !== undefined) checkEnumList(v.parenting, PARENTING_STYLES, `${path}.parenting`, p);
  if (v.gender !== undefined) checkEnumList(v.gender, GENDERS, `${path}.gender`, p);
  if (v.housing !== undefined) checkEnumList(v.housing, HOUSINGS, `${path}.housing`, p);
  if (v.temper !== undefined) checkEnumList(v.temper, TEMPER_IDS, `${path}.temper`, p);
  if (v.apt !== undefined) {
    if (!isObj(v.apt) || Object.keys(v.apt).length === 0) p.add(`${path}.apt`, `{ 적성축: [단계, ...] } 객체여야 한다 (축: ${APT_KEYS.join(', ')} · 단계: ${APT_TIERS.join(', ')}, 하나 이상)`);
    else {
      for (const [k, tiers] of Object.entries(v.apt)) {
        if (!(APT_KEYS as readonly string[]).includes(k)) p.add(`${path}.apt.${k}`, `알 수 없는 적성축 (허용: ${APT_KEYS.join(', ')})`);
        else checkEnumList(tiers, APT_TIERS, `${path}.apt.${k}`, p);
      }
    }
  }
  if (v.job !== undefined) {
    if (!isObj(v.job) || Object.keys(v.job).length === 0) p.add(`${path}.job`, '{ field?: [분야...], id?: [직업 id...] } 객체여야 한다 (하나 이상)');
    else {
      checkKeys(v.job, ['field', 'id'], [], `${path}.job`, p);
      if (v.job.field !== undefined) checkEnumList(v.job.field, OCCUPATIONS, `${path}.job.field`, p);
      if (v.job.id !== undefined) {
        if (!Array.isArray(v.job.id) || v.job.id.length === 0 || new Set(v.job.id).size !== v.job.id.length || !v.job.id.every((x: unknown) => typeof x === 'string' && JOB_ID_PATTERN.test(x))) {
          p.add(`${path}.job.id`, '비어 있지 않은 직업 id 배열(소문자·숫자·하이픈·밑줄, 중복 없음)이어야 한다');
        }
      }
    }
  }
  if (v.year !== undefined) checkRange(v.year, `${path}.year`, 1900, 2300, p);
  if (v.tailored !== undefined && v.tailored !== true) p.add(`${path}.tailored`, 'true여야 한다 (부정 조건은 만들지 않는다)');
  const flagsOk = v.flags === undefined ? true : checkFlagList(v.flags, `${path}.flags`, p);
  const notOk = v.notFlags === undefined ? true : checkFlagList(v.notFlags, `${path}.notFlags`, p);
  if (flagsOk && notOk && Array.isArray(v.flags) && Array.isArray(v.notFlags)) {
    for (const f of v.flags as string[]) if ((v.notFlags as string[]).includes(f)) p.add(path, `플래그 ${f}가 flags와 notFlags에 모두 있어 절대 참이 될 수 없다`);
  }
}


/**
 * 인용 연결 필드(`citation`·`noCitation`)의 형태만 본다 — 선택지가 있는가는 보지 않는다. 기록 카드(`src/data/notes.json`, core/noteCards.ts)가 같은 모양을 쓰므로 나눠 두었다.
 * 문제 목록(문장)을 돌려주는 공개 함수는 `citationShapeProblems`다.
 */
function checkCitationShape(ev: Obj, path: string, p: Problems): void {
  if (ev.citation === undefined && ev.noCitation === undefined) return;
  if (ev.citation !== undefined && ev.noCitation !== undefined) p.add(path, 'citation과 noCitation은 함께 쓸 수 없다 (인용이 있으면 사유가 없다)');
  const c = ev.citation;
  if (c !== undefined) {
    if (typeof c === 'string') {
      if (!CITATION_ID_PATTERN.test(c)) p.add(`${path}.citation`, `인용 id 형식이어야 한다 (예: c-006, 지금 "${c}")`);
    } else if (isObj(c)) {
      const keys = Object.keys(c);
      if (keys.length === 0) p.add(`${path}.citation`, '비어 있으면 안 된다 (인용이 없는 카드는 citation을 쓰지 말고 noCitation을 쓴다)');
      for (const k of keys) {
        if (!(ERAS as readonly string[]).includes(k)) p.add(`${path}.citation.${k}`, `알 수 없는 세상이다 (${ERAS.join(', ')} 중 하나)`);
        else if (typeof c[k] !== 'string' || !CITATION_ID_PATTERN.test(c[k] as string)) p.add(`${path}.citation.${k}`, '인용 id 형식이어야 한다 (예: c-006)');
      }
      // 이 카드가 뜨지 않는 시대 구간(yearRange가 걸치지 않는 구간)에 인용을 적으면 영원히 쓰이지 않는 연결이다 (기록 카드는 authored `eras`를 그대로 쓴다)
      const reach: readonly string[] | undefined = Array.isArray(ev.eras) ? (ev.eras as string[]) : isObj(ev.yearRange) ? erasOfYearRange(ev.yearRange as YearRange, Array.isArray(ev.stages) ? reachableYears({ stages: ev.stages as Stage[], ...(isObj(ev.ageRange) ? { ageRange: ev.ageRange as EventDef['ageRange'] } : {}) }) : undefined) : undefined;
      if (reach !== undefined) {
        for (const k of keys) if ((ERAS as readonly string[]).includes(k) && !reach.includes(k)) p.add(`${path}.citation.${k}`, `이 이벤트는 ${k} 시대 구간에서 일어나지 않는다 (${Array.isArray(ev.eras) ? 'eras' : 'yearRange'}가 걸치는 구간: ${reach.join(', ')})`);
      }
    } else {
      p.add(`${path}.citation`, '인용 id 문자열 또는 { past?, present?, future? } 객체여야 한다');
    }
  }
  if (ev.noCitation !== undefined && !(NO_CITATION_CODES as readonly unknown[]).includes(ev.noCitation)) {
    p.add(`${path}.noCitation`, `사유 코드(${NO_CITATION_CODES.join(', ')}) 중 하나여야 한다`);
  }
}

/** 인용 연결 필드 `citation`·`noCitation`의 형태 문제 목록(문장) — 기록 카드 데이터 검증(core/noteCards.ts)이 쓴다. `card`에는 이 필드들과 `eras`가 든 객체를 준다. */
export function citationShapeProblems(card: unknown, path: string): string[] {
  const p = new Problems(path);
  if (isObj(card)) checkCitationShape(card, '', p);
  return p.list;
}

/** 조건 객체(`conditions`·`requires`·`when`과 같은 문법) 하나의 형태 문제 목록(문장) — 기록 카드 데이터 검증(core/noteCards.ts)이 같은 조건 문법을 쓴다. */
export function conditionProblems(cond: unknown, path: string): string[] {
  const p = new Problems(path);
  checkCondition(cond, '', p);
  return p.list;
}


// ---------- 플래그 교차 검증 ----------

function flagsInCondition(c: Condition | undefined, out: Set<string>): void {
  for (const f of c?.flags ?? []) out.add(f);
  for (const f of c?.notFlags ?? []) out.add(f);
}

/** 이 이벤트가 조건에서 읽는 모든 플래그 */
export function flagsRead(ev: EventDef): Set<string> {
  const out = new Set<string>();
  flagsInCondition(ev.conditions, out);
  for (const m of ev.modifiers ?? []) flagsInCondition(m.when, out);
  for (const b of ev.bonuses ?? []) flagsInCondition(b.when, out);
  for (const v of ev.textVariants ?? []) flagsInCondition(v.when, out);
  for (const c of ev.choices ?? []) {
    flagsInCondition(c.requires, out);
    for (const b of c.bonuses ?? []) flagsInCondition(b.when, out);
    for (const v of c.resultVariants ?? []) flagsInCondition(v.when, out);
  }
  return out;
}

function effectsFlags(e: Effects | undefined, set: Set<string>, clear: Set<string>): void {
  for (const f of e?.setFlags ?? []) set.add(f);
  for (const f of e?.clearFlags ?? []) clear.add(f);
}

/** 이 이벤트가 켜거나 끄는 모든 플래그 */
export function flagsWritten(ev: EventDef): { set: Set<string>; clear: Set<string> } {
  const set = new Set<string>();
  const clear = new Set<string>();
  effectsFlags(ev.effects, set, clear);
  for (const b of ev.bonuses ?? []) effectsFlags(b.effects, set, clear);
  for (const c of ev.choices ?? []) {
    effectsFlags(c.effects, set, clear);
    for (const b of c.bonuses ?? []) effectsFlags(b.effects, set, clear);
  }
  // 조르기 사건의 들어주기·사이 나빠짐 갈래는 코드 표(`ASK_EFFECTS`)가 켜는 플래그다 — 데이터에 쓰이지 않으므로 여기서 함께 센다 (읽는 플래그 교차 검증이 놓치지 않게)
  if (ev.ask !== undefined) {
    effectsFlags(ASK_EFFECTS[`granted-${ev.ask.kind}`], set, clear);
    effectsFlags(ASK_EFFECTS.strained, set, clear);
  }
  return { set, clear };
}


function stageSpan(stage: Stage): [number, number] {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return [STAGE_TABLE[stage].startAge, next ? STAGE_TABLE[next].startAge - 1 : MAX_AGE_ABS];
}

/** 출생 연도 범위(세대 7종 합집합) — data/generations.ts의 FIRST_BIRTH_YEAR·LAST_BIRTH_YEAR와 같다(core가 data를 거꾸로 부르지 않으려고 따로 적고, tests/events.test.ts가 같은 값임을 잠근다) */
const FIRST_BIRTH_YEAR_FOR_RANGE = 1940;
const LAST_BIRTH_YEAR_FOR_RANGE = 2020;

/** 이벤트가 일어날 수 있는 달력 연도 창 [first, last] — 출생 연도(1940~2020, 세대 7종 합집합) + 단계·나이 범위의 나이. 단계가 없으면 undefined */
export function reachableYears(ev: Pick<EventDef, 'stages' | 'ageRange'>): { from: number; to: number } | undefined {
  const stages = (ev.stages ?? []).filter((s): s is Stage => (STAGES as readonly unknown[]).includes(s));
  if (stages.length === 0) return undefined;
  const lo = ev.ageRange?.min ?? 0;
  const hi = ev.ageRange?.max ?? MAX_AGE_ABS;
  const ageLo = Math.max(lo, Math.min(...stages.map((st) => stageSpan(st)[0])));
  const ageHi = Math.min(hi, Math.max(...stages.map((st) => stageSpan(st)[1])));
  return { from: FIRST_BIRTH_YEAR_FOR_RANGE + ageLo, to: LAST_BIRTH_YEAR_FOR_RANGE + ageHi };
}

/**
 * 이벤트 파일 검증 도우미 묶음 — **내부용**(`core/eventValidate.ts`만 쓴다). 조건·인용 형태 검사는 기록 카드 검증(`noteCards.ts`, 첫 화면 덩어리)도 쓰므로 이 파일에 남고,
 * 이벤트 파일 전용 검사(`validateEventFiles`·`checkEvent` 등)는 지연 덩어리로 가도록 `eventValidate.ts`로 옮겼다(SPEC-018 T3 — 초기 로드 ≤ 400,000 B). 한 이름으로 묶어 코어 공개 이름을 늘리지 않는다
 */
export const EVENT_CHECK = { isObj, isInt, checkKeys, checkText, checkRange, checkFlagList, checkEnumList, checkCondition, checkCitationShape, Problems, stageSpan, MAX_AGE_ABS, FIRST_BIRTH_YEAR_FOR_RANGE, LAST_BIRTH_YEAR_FOR_RANGE } as const;
export type EventCheckObj = Obj;
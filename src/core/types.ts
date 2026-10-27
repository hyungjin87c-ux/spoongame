import type { CurrentRegionName } from '../data/regionKeys';

/**
 * 저장되는 화면 단계. SPEC-003 FS1: title → roulette → birth → life → ending. 별도 시대 선택 단계(eraSelect)는 없어졌다 — 세상·인생 길이는 첫 화면(title)에서 고른다.
 * roulette(룰렛 화면)는 「태어나기」를 누르는 순간 출생 결과가 정해져 저장된 상태다(RL5): 룰렛 도중·직후에 새로고침해도 다시 돌지 않고 결과가 확정된 모습으로 복원된다.
 * birth는 출생신고 화면이다(BR). 「첫 화면 다시 열기」(나가기)는 저장되는 단계가 아니라 세션 상태다(core/session.ts#Session.showTitle, 마스터 결정 C3).
 */
export const PHASES = ['title', 'roulette', 'birth', 'life', 'ending'] as const;
export type Phase = (typeof PHASES)[number];

/**
 * 세대 7종 (SPEC-004 GD1) — 표시 이름·출생 연도 범위는 data/generations.ts, 세대별 설정값은 data/generationConfig.ts. 선택 순서(산업화 → 알파)가 이 배열의 순서다.
 * 첫 화면의 「랜덤 세대」는 세대가 아니라 목록의 첫 줄이다(`GenerationChoice`, 설정에 저장되는 값 `random`).
 */
export const GENERATION_IDS = ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha'] as const;
export type GenerationId = (typeof GENERATION_IDS)[number];

/** 첫 화면 세대 목록의 값 8가지: 「랜덤 세대」(`random`) 또는 세대 7종 중 하나 (GS1·GS4) */
export const GENERATION_CHOICES = ['random', ...GENERATION_IDS] as const;
export type GenerationChoice = (typeof GENERATION_CHOICES)[number];

/**
 * 시대 구간: 지난 / 지금 / 다가올 — **달력 연도의 구간**이다 (SPEC-004 MG2 주 규칙, 기준 연도 2000): 지난 ≤ 2000 · 지금 2001~2025 · 다가올 ≥ 2026.
 * 게임의 「태어날 세상」 선택은 세대 7종으로 바뀌어 사라졌고(판 상태·설정에 시대는 없다), 이 구간은 **이벤트의 시대 소재 점검(lint)·인용 노출·읽는 시간 모델**처럼 달력 연도로 가르는 곳에만 남는다
 * (인용·시간 모델의 연도 축 전환은 GM10 — MG4). 이벤트의 `yearRange`에서 파생되는 `EventDef.eras`도 이 구간이다.
 */
export const ERAS = ['past', 'present', 'future'] as const;
export type Era = (typeof ERAS)[number];

/** 시대 구간의 달력 연도 범위(포함) — 위쪽 끝은 출생 2020 + 110세 */
export const ERA_YEAR_SPAN: Readonly<Record<Era, { readonly from: number; readonly to: number }>> = {
  past: { from: 1940, to: 2000 },
  present: { from: 2001, to: 2025 },
  future: { from: 2026, to: 2130 },
};

/** 달력 연도 → 시대 구간 (2000 이하 지난 · 2001~2025 지금 · 2026 이상 다가올) */
export function eraOfYear(calendarYear: number): Era {
  return calendarYear <= ERA_YEAR_SPAN.past.to ? 'past' : calendarYear <= ERA_YEAR_SPAN.present.to ? 'present' : 'future';
}

/**
 * R1 프로필(「지금 세상」 = 2026년생)의 판 표지 — **시험·스크립트 전용**이다 (SPEC-004 EY17 ② 항등 시험의 `forceR1`). 첫 화면 목록·설정·저장에는 나오지 않고(저장 검증이 거부한다),
 * 연도 축 경제 배선이 R1 때의 값을 그대로 내는지 얼린 스냅숏(`tests/fixtures/r1-economy-snapshot.json`)과 줄 단위로 견주는 데만 쓴다.
 */
export const R1_PRESENT = 'r1-present' as const;
/** 판의 출생 프로필: 세대 7종 또는 R1 프로필(시험 전용) */
export type ProfileId = GenerationId | typeof R1_PRESENT;

/** 인생 길이: 약 30분 / 약 1시간 (SPEC-003 FS5·LM1). 시간 모델은 M8의 모드 표(data/timingTable.ts#LIFE_LENGTH_MODES)가 정하고, 엔진은 판의 값을 읽는다(LM3). */
export const LIFE_LENGTHS = ['short30', 'long60'] as const;
export type LifeLength = (typeof LIFE_LENGTHS)[number];

/**
 * 지금 고를 수 있는 인생 길이 (REV-003-M2-1 R-202). 「약 1시간」은 2차(M8)라 1차에서는 첫 화면에 카드는 보이되 선택할 수 없고(「준비 중」),
 * 저장된 설정이 long60이어도 short30으로 읽는다(core/storage.ts#parseSettings). M8(1차)은 시간 모델·시뮬레이션을 두 모드 모두 준비해 두고 「약 1시간」은 닫아 둔다(LD-4) — 2차에 열 때 여기에 'long60'을 더하고 모드 표의 selectable을 true로 바꾼다(tests/lifeLengthModes.test.ts가 둘이 같은지 잠근다).
 * 판에 고정되는 값(GameState.lifeLength)과 core 함수(beginBirth 등)는 두 값을 모두 안다 — 이 목록은 「화면에서 고를 수 있는가」만 정한다.
 */
export const SELECTABLE_LIFE_LENGTHS: readonly LifeLength[] = ['short30'];

export function isLifeLengthSelectable(lifeLength: LifeLength): boolean {
  return SELECTABLE_LIFE_LENGTHS.includes(lifeLength);
}

/** 고를 수 있는 값이면 그대로, 아니면 고를 수 있는 첫 값(약 30분)으로 읽는다. */
export function selectableLifeLength(lifeLength: LifeLength): LifeLength {
  return isLifeLengthSelectable(lifeLength) ? lifeLength : SELECTABLE_LIFE_LENGTHS[0];
}

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

/** 부모 재력 5단계: 1=흙 2=동 3=은 4=금 5=다이아 (화면에는 등급명을 직접 쓰지 않는다) */
export const PARENT_WEALTHS = [1, 2, 3, 4, 5] as const;
export type ParentWealth = (typeof PARENT_WEALTHS)[number];

/** 부모 교육방식: 방임 / 자유 / 헬리콥터 / 엄격 (Stats.education=학력과 구분하려고 parenting이라 부른다) */
export const PARENTING_STYLES = ['neglect', 'free', 'helicopter', 'strict'] as const;
export type ParentingStyle = (typeof PARENTING_STYLES)[number];

/** 생애 단계 5개: 영유아·학창·청년·중년·노년 (나이 경계는 data/lifeTable.ts#STAGE_TABLE) */
export const STAGES = ['infant', 'school', 'youth', 'middle', 'senior'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * 출생신고의 직업 대분류 (SPEC-003 BR2·BR4). 한국표준직업분류(8차) 대분류 중 근거 통계표(occupation-proxy, 30·40대 취업자)에 있는 9개.
 * 군인은 그 표에 없어 두지 않는다. 화면 이름과 통계표 이름의 대응은 data/birthReportTable.ts.
 */
export const OCCUPATIONS = ['manager', 'professional', 'clerk', 'service', 'sales', 'agri', 'craft', 'machine', 'labor'] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

/** 사는 집의 점유 형태: 자가 / 임차(전세·월세) / 무상 (주거실태조사 일반가구 점유형태). 임차를 전세·월세로 나눈 값은 원문 확인을 못 해 두지 않았다. */
export const HOUSINGS = ['own', 'rent', 'free'] as const;
export type Housing = (typeof HOUSINGS)[number];

export interface Parent {
  /** 아이가 태어난 해의 나이 */
  age: number;
  job: Occupation;
}

/**
 * 출생신고 상세 (SPEC-003 BR2~BR4, 저장 스키마 v6). 출생 로직(core/birth.ts#generateBirth)이 한 번에 정하고, 룰렛(RL2)과 출생신고(BR)가 이 값을 그대로 보인다.
 * 지역(region)은 룰렛 지역 릴의 값(시·도 줄임 이름), 시군구는 출생신고에서 시도 안의 출생아 비율로 뽑은 값이다.
 */
export interface BirthReport {
  /** 출생 월 1~12 (월별 출생아 수 가중 추첨, 남은 결정 R1) */
  month: number;
  /**
   * 룰렛이 정한(또는 직접 고른) 시·도 — 줄임 이름(서울·부산·…·광주·전남·제주). 그 출생 연도의 시·도 구분이다(SPEC-004 NR3 — 1995년생 세종 0).
   * R1 프로필(「지금 세상」 2026년생, 시험 전용)만 합쳐진 「전남광주」를 쓴다.
   */
  region: string;
  /** 시군구가 통계에서 속한 시·도(줄임 이름). **R1 프로필(2026년생)에만 있다** — 세대 판은 시도까지만 적는다(NR3 「출생지는 모든 세대 시도까지」). */
  sigunguSido?: string;
  /** 시군구 이름(R1 프로필만). 일반구가 있는 시는 「수원시 장안구」처럼 시 이름을 함께 적는다. */
  sigungu?: string;
  mother: Parent;
  father: Parent;
  housing: Housing;
  /** 출생 체중(kg), 소수 첫째 자리 */
  birthWeightKg: number;
  /** 형제 순서: 1 첫째 · 2 둘째 · 3 셋째 · 4 넷째 · 5 다섯째 이상 */
  birthOrder: number;
}

export interface Character {
  /** 성+이름 (예: 김민준) */
  name: string;
  gender: Gender;
  birthYear: number;
  parentWealth: ParentWealth;
  parenting: ParentingStyle;
  /** 외모 점수 0~100 (고정) */
  looks: number;
}

/**
 * 스탯 4개. 모두 정수이고 범위는 core/stats.ts의 STAT_MIN~STAT_MAX(0~100) 하나뿐이다.
 * 재산(wealth) 스탯은 없어졌다(SPEC-003 M5, 저장 v8): 20세부터는 `Assets`(순자산·연 소득·부채, 만 원), 20세 미만은 `GameState.familyFund`(집안 살림)다 — docs/data/economy-model.md.
 */
export const STAT_KEYS = ['education', 'health', 'happiness', 'relationships'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export interface Stats {
  /** 학력: 지금까지 쌓은 학업 성취. 출생 시에는 0에 가까운 낮은 값이고 살아가며 자란다(R-025). */
  education: number;
  health: number;
  happiness: number;
  relationships: number;
}

/**
 * 내 삶의 주거 형태 (경제 모델 EC2): 가족 집(무상)·월세·전세·자가·요양. 출생신고의 `Housing`(출생 시점 부모 집의 점유 형태)과 다른 값이다.
 */
export const DWELLINGS = ['family', 'rent', 'jeonse', 'own', 'care'] as const;
export type Dwelling = (typeof DWELLINGS)[number];

/**
 * 20세 이상의 자산 현황 (SPEC-003 EC1, docs/data/economy-model.md 3절). **모두 만 원 정수**(dwelling 제외). 화면에 보이는 값은 net·income·debt 셋이고
 * incomeAdj(이벤트가 남긴 소득 보정)·dwelling(주거 형태)은 계산에 필요한 내부 상태다. 불변식: debt ≥ max(0, −net) (자산이 바닥나면 부족분이 부채가 된다).
 */
export interface Assets {
  /** 순자산(= 총자산 − 부채, 음수 가능) */
  net: number;
  /** 연 소득(해마다 다시 계산한 값을 저장한다) */
  income: number;
  /** 부채(≥ 0) */
  debt: number;
  /** 이벤트가 남긴 소득 보정(연, 만 원) */
  incomeAdj: number;
  dwelling: Dwelling;
}

/** 선택지·이벤트가 자산에 주는 변화(만 원): 순자산·연 소득 보정·부채. 20세 이상 이벤트에서만 쓴다. */
export interface AssetDeltas {
  net?: number;
  income?: number;
  debt?: number;
}

/** 이벤트·선택지가 스탯·자산과 플래그에 주는 효과 */
export interface Effects {
  stats?: Partial<Record<StatKey, number>>;
  /** 20세 이상 이벤트: 자산 변화(순자산·소득 보정·부채, 만 원) */
  assets?: AssetDeltas;
  /** 20세 미만 이벤트: 집안 살림 변화(만 원) — 20세 시작 자산에 그대로 더해진다 */
  family?: number;

  setFlags?: string[];
  clearFlags?: string[];
}

/**
 * 생애 연표 항목의 종류: stage=출생·단계 진입, event=서술 이벤트, choice=선택지 이벤트(선택 내용 포함), death=사망,
 * note=사용자가 쓴 기록(「생각 남기기」, SPEC-003 M7c — `title`은 주제, `text`는 **사용자 글**, `eventId`는 카드 id 또는 `note-manual`). note 행의 글만 게임이 만든 글이 아니라서 저장 검증이 다르다(core/storage.ts).
 */
export const HISTORY_KINDS = ['stage', 'event', 'choice', 'death', 'note'] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];

export interface HistoryEntry {
  age: number;
  kind: HistoryKind;
  /** 본문(서술 이벤트는 사건 문구, 선택지 이벤트는 결과 문구) */
  text: string;
  /** 이벤트 제목 (event·choice) */
  title?: string;
  /** 고른 선택지의 문구 (choice) */
  choice?: string;
  eventId?: string;
  /**
   * 누가 정한 선택인가 (`kind: 'choice'`에만 허용, SPEC-005 PD6·SV1): `'parent'` 부모님이 정했다 · `'child'` 아이의 일로 흘러갔다. 없으면 본인이 고른 선택이다.
   * 선택 필드라 저장 스키마는 v8 그대로다 — 값이 이상하면 판을 버리지 않고 그 필드만 버린다(core/storage.ts#withValidBy).
   */
  by?: DelegatedBy;
}

/** 부모님이 정했다(`parent`) / 아이의 일로 흘러갔다(`child`) — `HistoryEntry.by`·`TickInfo.by` (SPEC-005 PD6) */
export const DELEGATED_BYS = ['parent', 'child'] as const;
export type DelegatedBy = (typeof DELEGATED_BYS)[number];

/**
 * 무거운 장면의 분류 (SPEC-005 HV2, docs/review/REV-005-HV-1.md): 이벤트 데이터의 선택 필드 `heavy: { kind }`가 쓰는 여섯 값. 화면에는 분류 **이름**만 보이고(data/gentleText.ts#HEAVY_KIND_TEXT — 이름 여섯과 1:1),
 * 이름은 그 분류의 모든 장면에 참이어야 한다(R-469). 판정 기준은 docs/data/events-schema.md 「무거운 장면 표지」.
 * home 집안 사정 · school 또래 사이 · health 건강 · loss 돌봄과 이별 · bond 멀어진 사이 · work 일과 생계
 */
export const HEAVY_KINDS = ['home', 'school', 'health', 'loss', 'bond', 'work'] as const;
export type HeavyKind = (typeof HEAVY_KINDS)[number];

/** 지금 화면에서 결정을 기다리는 선택지 이벤트. 저장 상태에 들어가므로 새로고침해도 같은 이벤트·같은 선택지가 다시 보인다. */
export interface PendingChoice {
  eventId: string;
  /** 이벤트 인스턴스의 고유 키 `${eventId}@${age}`. 화면의 선택 버튼 연타 방어 키로 쓴다. */
  key: string;
  age: number;
  /** 화면에 보이는 선택지 id (순서 그대로). 조건(requires)을 만족하는 것만 2~3개. */
  choiceIds: string[];
}

export interface Death {
  age: number;
  cause: string;
}

/**
 * 이 판의 플레이 시간 기록 (SPEC-003 LM5·LM6, M8 — docs/data/content-M8.md 5절). 게임 상태의 **선택 필드**라 저장 스키마는 v8 그대로다(진행 중인 판을 잃지 않는다, LD-6).
 * 시간은 밀리초 정수, 횟수는 정수. 시간을 다섯 버킷으로 나눠 쌓는다(어느 버킷인지는 `core/playClock.ts#playBucketOf`):
 *  - hold: 연출 시계가 흐른 시간(조용한 해·서술 해·결과) — 실제로 흐른 시간이라 배속이 빠르면 짧다 · decide: 결정 카드를 읽고 고르는 시간(자동 모드의 자동 선택 대기 포함)
 *  - fold: 결정 카드를 접어 둔 시간 · note: 기록 시트가 열려 있던 시간 · idle: 일시정지·탭 가림·나가기 확인·첫 화면 다시 열기·밀린 화면의 시간(표본이라 실제보다 작을 수 있다 — 한 번에 5초까지만 센다)
 * 화면에 보이는 플레이 시간 = ⌊hold/1000⌋ + ⌊decide/1000⌋초 (`displaySeconds` — 버킷별로 초를 버린 뒤 합). 나머지는 시간에서 빠지고 분해 기록으로만 남는다.
 * 깨끗한 판(`isCleanRun`) = 배속을 바꾸지 않고(offSpeed 0) 자동 모드를 쓰지 않고(auto 0) 「다음 결정으로」를 쓰지 않은(skips 0) 판 — 사람 실측은 깨끗한 판만 쓴다(LM7).
 *  - offSpeed: 1배속이 아닌 배속에서 흐른 hold의 ms · auto: 자동 모드 중에 흐른 hold + decide의 ms · skips: 「다음 결정으로」 횟수 · resumes: 새로고침·탭 닫기 뒤 이어하기 횟수
 * 날짜·시각·기기 정보는 기록하지 않는다. 서버로 보내지 않고 의견 보내기 주소에도 싣지 않는다(LD-11).
 */
export interface PlayTime {
  hold: number;
  decide: number;
  fold: number;
  note: number;
  idle: number;
  offSpeed: number;
  auto: number;
  skips: number;
  resumes: number;
}

export interface GameState {
  phase: Phase;
  /** 이 판의 세대 (SPEC-004 GS·MG1): 출생 결과가 정해지는 「태어나기」에서 고정된다(랜덤 세대면 그때 뽑힌 세대). 첫 화면(title)에서는 null. */
  generation: ProfileId | null;
  /** 이 판의 인생 길이(LM3: 판을 시작할 때 정해지고 진행 중에는 바뀌지 않는다). 출생 전(title)에는 null. */
  lifeLength: LifeLength | null;
  character: Character | null;
  stats: Stats;
  /** 출생 시점 스탯 스냅샷 (엔딩의 "출발선 대비"용). 출생 전에는 null. */
  birthStats: Stats | null;
  age: number;
  /** 생애 연표 (상한: data/lifeTable.ts#HISTORY_LIMITS) */
  history: HistoryEntry[];
  /** 지금 설정돼 있는 플래그 (정렬·중복 없음) */
  flags: string[];
  /** 본 이벤트: id -> 마지막으로 일어난 나이. once 이벤트는 다시 나오지 않고, 반복 이벤트는 cooldown 동안 쉰다. */
  seen: Record<string, number>;
  /** 대기 중인 선택지 이벤트 (없으면 null) */
  pending: PendingChoice | null;
  /** 마지막 선택지 이벤트가 일어난 나이 (선택지가 연달아 나오지 않게 간격을 둔다) */
  lastChoiceAge: number | null;
  /** 사망 정보 (phase가 ending일 때만 non-null) */
  death: Death | null;
  /** 출생신고 상세(출생 연월·지역·부모·주거·체중·형제 순서). 출생 전(title)에는 null. */
  birthReport: BirthReport | null;
  /** 같은 해 태어난 사람들(VP3)을 만드는 시드. 상태에는 시드만 저장하고 인물은 매번 같은 함수로 다시 만든다. 출생 전에는 null. */
  peerSeed: number | null;
  /**
   * 일시정지 중인가 (SPEC-003 DB3·DB8, 저장 스키마 v7). 인생 화면의 「일시정지」와 「나가기」(첫 화면으로 나가며 일시정지 상태로 저장)가 켠다.
   * 켜져 있으면 해마다 진행하는 타이머와 자동 선택 타이머가 멈추고, 탭이 다시 보여도 저절로 풀리지 않는다(사용자가 정지한 상태 유지). 인생(life) 단계에서만 true일 수 있다.
   */
  paused: boolean;
  /**
   * 20세 이상의 자산 현황(순자산·연 소득·부채, SPEC-003 EC1, 저장 스키마 v8). 20세가 되는 해(독립)에 `core/economy.ts#initialAssets`가 만들고, 그 전에는 null이다.
   */
  assets: Assets | null;
  /** 20세 미만의 「집안 살림」 누적(만 원, −3,000~3,000). 독립(20세)에 시작 자산에 더해지고 0이 된다. 20세 미만 이벤트의 `effects.family`가 쌓는다. */
  familyFund: number;
  /** 최초 난수 시드 (재현용) */
  seed: number;
  /** 현재 RNG 내부 상태. 저장에 포함되어 새로고침 후에도 수열이 이어진다. */
  rngState: number;
  /**
   * 이 판의 플레이 시간 기록 (선택 필드 — 위 `PlayTime`). 인생이 시작될 때(`enterLife`) 0으로 생기고, 없으면 시간을 재지 않은 판이다(M8 이전에 시작한 저장 — 엔딩에 줄을 그리지 않는다).
   * 값이 이상한 저장은 판을 버리지 않고 이 필드만 버린다(core/storage.ts#parseGame).
   */
  play?: PlayTime;
  /**
   * 이 판이 「무거운 장면 가리기」를 켠 채로 살았는가 (선택 필드 — SPEC-005 HV3·HV6·SV1): **판 도중 한 번이라도 켜졌으면 참**이다(켜고 나서 꺼도 참, 켠 채 시작해도 참).
   * 엔딩 맨 위 한 줄의 기준이다(설정값이 아니라 판의 기록). 켠 적이 없는 판에는 필드가 없다 — 값은 `true`만 쓴다(`false`를 쓰지 않아 끈 판의 저장이 이전 버전과 바이트까지 같다).
   * 선택 필드라 저장 스키마는 v8 그대로다 — 값이 이상하면 판을 버리지 않고 이 필드만 버린다(core/storage.ts#withValidGentleUsed). 분포·인생과 무관하다(같은 시드·같은 선택이면 이 필드와 `play`를 뺀 상태 전체가 같다, tests/gentle.test.ts).
   */
  gentleUsed?: boolean;
  /**
   * 시도를 직접 골라 시작한 판인가 (선택 필드 — SPEC-004 RG1·MG1): `true`만 쓴다(룰렛에 맡긴 판에는 필드가 없다). 값이 이상하면 판을 버리지 않고 그 필드만 버린다(core/storage.ts#withValidRegionPicked).
   * 켜져 있으면 지역 릴은 돌지 않고 고른 칸에 멈춰 있으며(GS6), 룰렛 지역 표는 「직접 고른 시도」로 바뀐다.
   */
  regionPicked?: true;
  /** 「랜덤 세대」 줄로 시작해 세대가 뽑힌 판인가 (선택 필드 — GS3): `true`만 쓴다. 룰렛 머리에 「랜덤 세대에서 뽑힌」이 보인다. */
  fromRandom?: true;
}

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

/** 화면 테마 선택 (DB6): 시스템 설정을 따름(기본) / 라이트 / 다크. 수동 선택(light·dark)은 설정에 저장돼 시스템 설정보다 우선한다. */
export const THEMES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEMES)[number];

/** BGM 설정 (DB4): 켬/끔(기본 꺼짐)과 볼륨(0~100 정수, 기본 낮음) */
export interface BgmSettings {
  on: boolean;
  volume: number;
}
export const BGM_VOLUME_MIN = 0;
export const BGM_VOLUME_MAX = 100;
export const DEFAULT_BGM: BgmSettings = { on: false, volume: 30 };

/** 설정은 게임 진행과 별도 키로 저장되며 새 판에도 유지된다. */
export interface Settings {
  speed: Speed;
  autoMode: boolean;
  /** 첫 화면 세대 목록에서 마지막으로 고른 줄 — 다음 첫 화면의 기본 선택(GS4). 처음 방문(선택 기록 없음)은 「랜덤 세대」(`random`)다. 설정 스키마 v6 */
  generation: GenerationChoice;
  /** 첫 화면에서 마지막으로 고른 인생 길이 — 다음 판의 기본 선택(FS5·LM1) */
  lifeLength: LifeLength;
  /** BGM 켬/끔·볼륨 (DB4, 설정 스키마 v3) */
  bgm: BgmSettings;
  /** 화면 테마 (DB6, 설정 스키마 v3) */
  theme: ThemeChoice;
  /** 기록 카드(「생각 남기기」 자동 카드)를 저절로 띄우는가 (FR7, 설정 스키마 v4, 기본 true). 꺼져 있으면 적격 카드를 시트 없이 소비한다. 수동 「생각 남기기」 버튼에는 영향이 없다. */
  noteCards: boolean;
  /**
   * 「무거운 장면 가리기」 (HV3, 설정 스키마 v5, 기본 false = 모든 장면 그대로). 가림은 이 값으로 화면이 정한다(화면 규칙 (A)): 켜져 있으면 지난 줄까지 모든 heavy 줄·카드·연표 줄·자살률 슬라이드가 가려지고, 끄면 모두 원문이다.
   * 이 값은 다음 판의 기본값이기도 하다. 판 도중 한 번이라도 켜진 판의 표지는 `GameState.gentleUsed`다.
   */
  gentle: boolean;
  /**
   * 마지막으로 본 새 소식의 버전 (NT4, 설정 스키마 v5, 기본 빈 글자 = 아직 본 적 없음). 현재 버전이 이보다 높으면 첫 화면 푸터의 「새 소식」 링크 옆에 「새」 표시가 뜬다.
   * 패널을 열면 현재 버전으로 갱신된다. `x.y.z` 꼴이 아닌 값은 읽을 때 기본값(빈 글자)으로 본다.
   */
  notesSeen: string;
  /**
   * 이 기기에서 끝까지 살아본 세대 (GS10 「살아봄」 표시, 설정 스키마 v6). 세대 순서대로 정렬·중복 없음. 순위·점수·보상은 없고 이 기기에만 남는다.
   */
  lived: GenerationId[];
  /**
   * 「내가 실제로 태어난 시도」 (RG3, 설정 스키마 v6, 기본 null = 밝히지 않음): 지금의 시·도 16개 중 하나(`CurrentRegionName`, 시군구 없음)뿐이고 **이 설정 키 하나에만** 있다 — 게임 저장(`GameState`)·의견 보내기 주소·콘솔·공유 문구에 넣지 않는다.
   */
  homeRegion: CurrentRegionName | null;
  /** 금액 보기 (EY11, 설정 스키마 v6): `then` 당시 화폐(기본) / `now` 지금 가치. GM10이 자산 카드에 쓴다 — 지금은 읽고 저장만 한다 */
  moneyView: MoneyView;
}

/** 금액 보기 기준 (EY11) */
export const MONEY_VIEWS = ['then', 'now'] as const;
export type MoneyView = (typeof MONEY_VIEWS)[number];

/** 인생 화면이 읽는 재생 설정(배속·자동 모드). Settings의 일부다. */
export type PlaySettings = Pick<Settings, 'speed' | 'autoMode'>;

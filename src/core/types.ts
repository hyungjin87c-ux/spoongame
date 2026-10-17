/**
 * 저장되는 화면 단계. SPEC-003 FS1: title → roulette → birth → life → ending. 별도 시대 선택 단계(eraSelect)는 없어졌다 — 세상·인생 길이는 첫 화면(title)에서 고른다.
 * roulette(룰렛 화면)는 「태어나기」를 누르는 순간 출생 결과가 정해져 저장된 상태다(RL5): 룰렛 도중·직후에 새로고침해도 다시 돌지 않고 결과가 확정된 모습으로 복원된다.
 * birth는 출생신고 화면이다(BR). 「첫 화면 다시 열기」(나가기)는 저장되는 단계가 아니라 세션 상태다(core/session.ts#Session.showTitle, 마스터 결정 C3).
 */
export const PHASES = ['title', 'roulette', 'birth', 'life', 'ending'] as const;
export type Phase = (typeof PHASES)[number];

/** 시대: 지난 세상 / 지금 세상 / 다가올 세상 */
export const ERAS = ['past', 'present', 'future'] as const;
export type Era = (typeof ERAS)[number];

/** 인생 길이: 약 30분 / 약 1시간 (SPEC-003 FS5·LM1). 이번 마일스톤(M2)은 선택값을 저장하는 데까지이고 실제 시간 모델은 M8 몫이다. */
export const LIFE_LENGTHS = ['short30', 'long60'] as const;
export type LifeLength = (typeof LIFE_LENGTHS)[number];

/**
 * 지금 고를 수 있는 인생 길이 (REV-003-M2-1 R-202). 「약 1시간」은 2차(M8)라 1차에서는 첫 화면에 카드는 보이되 선택할 수 없고(「준비 중」),
 * 저장된 설정이 long60이어도 short30으로 읽는다(core/storage.ts#parseSettings). M8이 시간 모델을 만들면 여기에 'long60'을 더하면 된다.
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
  /** 룰렛이 정한 시·도 — 줄임 이름(서울·부산…·전남광주·제주). 지난 세상은 그 시기의 시·도 구분(경기 = 경기+인천 등) */
  region: string;
  /** 시군구가 통계에서 속한 시·도(줄임 이름). 합쳐진 지역(전남광주·지난 세상의 경기 등) 안에서 같은 이름의 구를 가르는 데 쓴다. */
  sigunguSido: string;
  /** 시군구 이름. 일반구가 있는 시는 「수원시 장안구」처럼 시 이름을 함께 적는다. */
  sigungu: string;
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

/** 스탯 5개. 모두 정수이고 범위는 core/stats.ts의 STAT_MIN~STAT_MAX(0~100) 하나뿐이다. */
export const STAT_KEYS = ['wealth', 'education', 'health', 'happiness', 'relationships'] as const;
export type StatKey = (typeof STAT_KEYS)[number];

export interface Stats {
  /** 재산: 어릴 때는 집안 형편, 스무 살(INDEPENDENCE) 이후에는 내가 가진 것 */
  wealth: number;
  /** 학력: 지금까지 쌓은 학업 성취. 출생 시에는 0에 가까운 낮은 값이고 살아가며 자란다(R-025). */
  education: number;
  health: number;
  happiness: number;
  relationships: number;
}

/** 이벤트·선택지가 스탯과 플래그에 주는 효과 */
export interface Effects {
  stats?: Partial<Record<StatKey, number>>;
  setFlags?: string[];
  clearFlags?: string[];
}

/** 생애 연표 항목의 종류: stage=출생·단계 진입, event=서술 이벤트, choice=선택지 이벤트(선택 내용 포함), death=사망 */
export const HISTORY_KINDS = ['stage', 'event', 'choice', 'death'] as const;
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
}

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

export interface GameState {
  phase: Phase;
  era: Era | null;
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
  /** 최초 난수 시드 (재현용) */
  seed: number;
  /** 현재 RNG 내부 상태. 저장에 포함되어 새로고침 후에도 수열이 이어진다. */
  rngState: number;
}

export const SPEEDS = [1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];

/** 설정은 게임 진행과 별도 키로 저장되며 새 판에도 유지된다. */
export interface Settings {
  speed: Speed;
  autoMode: boolean;
  /** 첫 화면에서 마지막으로 고른 태어날 세상 — 다음 판의 기본 선택(FS4) */
  era: Era;
  /** 첫 화면에서 마지막으로 고른 인생 길이 — 다음 판의 기본 선택(FS5·LM1) */
  lifeLength: LifeLength;
}

/** 인생 화면이 읽는 재생 설정(배속·자동 모드). Settings의 일부다. */
export type PlaySettings = Pick<Settings, 'speed' | 'autoMode'>;

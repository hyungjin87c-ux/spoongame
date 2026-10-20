import type { BirthReport, Character, Era, GameState, LifeLength, ParentWealth, PlaySettings, Settings } from '../src/core/types';

/**
 * e2e가 주입하는 저장 데이터(순수 객체). Playwright에 의존하지 않으므로 vitest에서도
 * core의 검증기(parseGame)와 대조할 수 있다(tests/e2eHelpers.test.ts).
 */

export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SAVE_VERSION = 8;
/** 설정 봉투 버전(core/storage.ts#SETTINGS_VERSION)과 첫 화면의 기본 선택(core/state.ts#DEFAULT_SETTINGS) — tests/e2eHelpers.test.ts가 core와 같은지 대조한다. */
export const SETTINGS_VERSION = 5;
export const DEFAULT_ERA_CHOICE: Era = 'present';
export const DEFAULT_LIFE_LENGTH_CHOICE: LifeLength = 'short30';
/** 재현 가능한 실패를 위한 기본 시드 */
export const KNOWN_SEED = 20261013;

const PLACEHOLDER_STATS = { education: 50, health: 50, happiness: 50, relationships: 50 };

/** 인생이 시작되기 전(title·roulette·birth)에는 진행 기록이 모두 비어 있다. */
const FRESH = { flags: [] as string[], seen: {} as Record<string, number>, pending: null, lastChoiceAge: null, death: null };
/** 20세 미만의 돈 상태(스키마 v8): 자산은 없고 집안 살림만 있다 */
const YOUNG_MONEY = { assets: null, familyFund: 0 };

/** e2e가 주입하는 설정: 배속·자동 모드만 줘도 되고(세상·인생 길이는 첫 화면의 기본 선택) 첫 화면의 선택까지 줄 수도 있다. */
export type InjectedSettings = PlaySettings & Partial<Settings>;

/**
 * 설정 봉투(JSON 문자열). 비어 있는 필드는 기본값으로 채운다.
 * **기록 카드(`noteCards`)만은 e2e 기본이 꺼짐이다** — 앱의 기본(켜짐)대로 두면 수동 모드의 시계가 기록 카드에서 멈춰 이전 마일스톤의 e2e가 나이를 기다리다 걸린다(SPEC-003 M7c).
 * 새 기록 시험(m7c-*)만 `noteCards: true`를 명시한다.
 */
export function settingsEnvelope(settings: InjectedSettings): string {
  return JSON.stringify({ version: SETTINGS_VERSION, data: { era: DEFAULT_ERA_CHOICE, lifeLength: DEFAULT_LIFE_LENGTH_CHOICE, bgm: { on: false, volume: 30 }, theme: 'system', noteCards: false, ...settings } });
}

/** 새 게임: 첫 화면(title). 세상·인생 길이는 아직 정해지지 않았다(첫 화면의 선택은 설정에 있다). */
export function titleState(seed: number): GameState {
  return {
    phase: 'title',
    era: null,
    lifeLength: null,
    character: null,
    stats: { ...PLACEHOLDER_STATS },
    birthStats: null,
    age: 0,
    history: [],
    ...FRESH,
    ...YOUNG_MONEY,
    birthReport: null,
    peerSeed: null,
    paused: false,
    seed,
    rngState: seed,
  };
}

/**
 * 주입용 출생신고 상세 (스키마 v6): 모든 시대에서 유효한 지역(서울)·시군구(종로구)·체중(3.2kg, 격자 위)이다 — 저장 검증(core/birthReport.ts#isValidBirthReport)을 통과한다.
 * 검증은 tests/e2eHelpers.test.ts가 core의 parseGame으로 대조한다. 값을 바꿔 쓰려면 `report(...)`에 덮어쓸 필드를 준다.
 */
export function report(overrides: Partial<BirthReport> = {}): BirthReport {
  return {
    month: 1,
    region: '서울',
    sigunguSido: '서울',
    sigungu: '종로구',
    mother: { age: 30, job: 'clerk' },
    father: { age: 33, job: 'professional' },
    housing: 'own',
    birthWeightKg: 3.2,
    birthOrder: 1,
    ...overrides,
  };
}

/** 주입용 또래 시드 */
export const PEER_SEED = 424242;

/** 검증기를 통과하는 유효한 "인생 진행 중"(0세, 출생 직후) 저장. */
export function lifeState(seed: number): GameState {
  const character: Character = {
    name: '김민준',
    gender: 'male',
    birthYear: 2026, // 지금 세상 출생 연도(2026 고정, SPEC-003 Q1)
    parentWealth: 3,
    parenting: 'free',
    looks: 50,
  };
  const stats = { education: 6, health: 70, happiness: 52, relationships: 54 };
  return {
    phase: 'life',
    era: 'present',
    lifeLength: 'short30',
    character,
    stats,
    birthStats: { ...stats },
    age: 0,
    history: [{ age: 0, kind: 'stage', text: '2026년 1월, 서울특별시 종로구의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다. (3.2kg은 상위 약 50%)' }],
    ...FRESH,
    ...YOUNG_MONEY,
    birthReport: report(),
    peerSeed: PEER_SEED,
    paused: false,
    seed,
    rngState: seed + 1,
  };
}

/** 시대별로 범위 안의 출생 연도 하나 (출생 화면 표현 e2e용) */
const SAMPLE_BIRTH_YEAR: Record<Era, number> = { past: 1960, present: 2026, future: 2040 };

/** 검증기를 통과하는 "출생신고 화면"(birth) 저장. 재력 단계·외모를 지정해 표현(상위/하위/중간)을 전수 확인할 때 쓴다. phase를 roulette로 바꾸면 룰렛 화면(결과가 확정된 모습)이다(`rouletteState`). */
export function birthState(seed: number, era: Era, parentWealth: ParentWealth, looks: number, reportOverrides: Partial<BirthReport> = {}): GameState {
  const character: Character = {
    name: '김민준',
    gender: 'male',
    birthYear: SAMPLE_BIRTH_YEAR[era],
    parentWealth,
    parenting: 'free',
    looks,
  };
  const stats = { education: 6, health: 70, happiness: 52, relationships: 54 };
  return {
    phase: 'birth',
    era,
    lifeLength: 'short30',
    character,
    stats,
    birthStats: { ...stats },
    age: 0,
    history: [],
    ...FRESH,
    ...YOUNG_MONEY,
    birthReport: report(reportOverrides),
    peerSeed: PEER_SEED,
    paused: false,
    seed,
    rngState: seed + 1,
  };
}

/** 검증기를 통과하는 "룰렛 화면"(roulette) 저장 — 새로고침으로 열면 룰렛이 돌지 않고 결과가 확정된 모습이다(RL5). */
export function rouletteState(seed: number, era: Era, parentWealth: ParentWealth, looks: number, reportOverrides: Partial<BirthReport> = {}): GameState {
  return { ...birthState(seed, era, parentWealth, looks, reportOverrides), phase: 'roulette' };
}

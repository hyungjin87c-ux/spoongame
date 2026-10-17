import { ERA_CONFIG } from '../data/birthTable';
import { EVENT_POOL } from '../data/events';
import { HISTORY_LIMITS, STATE_LIMITS } from '../data/lifeTable';
import { EVENT_ID_PATTERN, FLAG_PATTERN, isChoiceEvent, type EventPool } from './events';
import { isValidBirthReport } from './birthReport';
import { isValidStat } from './stats';
import {
  ERAS,
  GENDERS,
  HISTORY_KINDS,
  LIFE_LENGTHS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  PHASES,
  SPEEDS,
  selectableLifeLength,
  type Character,
  type GameState,
  type Settings,
  type Stats,
} from './types';
import { DEFAULT_SETTINGS } from './state';

/**
 * 게임 진행과 설정은 별도 키. 스키마(또는 저장 검증 규칙)가 바뀌면 SCHEMA_VERSION을 올린다.
 * v3: 지금 세상 출생 연도 범위가 1990~2025 → 2008~2025로 바뀜(R-012). 구 저장은 새 게임으로 시작한다.
 * v4: 인생 진행(M3) — 플래그·본 이벤트·대기 중인 선택지·사망 정보 추가, 연표 항목 형태 변경, 스탯 0~100 정수 검증(R-024).
 * v5: 개편(SPEC-003 M2) — 화면 단계에서 시대 선택(eraSelect)이 빠지고(세상·인생 길이는 첫 화면에서 고른다), 판마다 인생 길이(lifeLength)가 고정된다. v4 이하 저장은 새 게임으로 시작한다(C6).
 * v6: 개편(SPEC-003 M3) — 화면 단계에 룰렛(roulette)이 더해지고, 판마다 출생신고 상세(birthReport)와 또래 시드(peerSeed)가 저장된다. 지금 세상 출생 연도가 2026 한 해로 고정되어
 *     (ERA_CONFIG.present.birthYears) M2 시기의 v5 저장(지금 세상 2008~2025년생)은 새 게임으로 시작한다 — 버전을 올려 「손상」이 아니라 「이전 버전」으로 분류하고 첫 화면에 안내 한 줄(C6)을 보인다(REV-003-M2-1 R-213).
 */
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SCHEMA_VERSION = 6;
/**
 * 설정 스키마는 게임 스키마와 따로 버전을 관리한다(게임 스키마가 바뀌어도 설정은 유지).
 * v2: 첫 화면에서 고른 세상(era)·인생 길이(lifeLength)가 더해졌다. v1 설정(배속·자동 모드만)은 그대로 읽고 새 필드는 기본값으로 채운다 — 배속·자동 모드를 잃지 않는다.
 */
export const SETTINGS_VERSION = 2;
/** 읽을 수 있는 설정 버전 (현재 + 이전 버전). 이 밖의 버전은 기본값. */
const READABLE_SETTINGS_VERSIONS: readonly number[] = [1, 2];

/** localStorage와 같은 최소 인터페이스 (테스트에서 가짜를 주입). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 접근 자체가 예외를 던질 수 있으므로(차단·시크릿 모드 등) null로 안전하게 처리. */
export function getBrowserStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

interface Envelope<T> {
  version: number;
  data: T;
}

export function serializeGame(state: GameState): string {
  const env: Envelope<GameState> = { version: SCHEMA_VERSION, data: state };
  return JSON.stringify(env);
}

export function serializeSettings(settings: Settings): string {
  const env: Envelope<Settings> = { version: SETTINGS_VERSION, data: settings };
  return JSON.stringify(env);
}

// ---------- 검증 ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isUint32 = (v: unknown): v is number => isInt(v) && v >= 0 && v <= 0xffffffff;
const isOneOf = (list: readonly unknown[], v: unknown): boolean => list.includes(v);

/** 스탯 5개가 모두 0~100의 정수 (범위 정책은 core/stats.ts 한 곳, R-024) */
function validStats(v: unknown): v is Stats {
  return (
    isObj(v) &&
    isValidStat(v.wealth) &&
    isValidStat(v.education) &&
    isValidStat(v.health) &&
    isValidStat(v.happiness) &&
    isValidStat(v.relationships)
  );
}

function validCharacter(v: unknown): v is Character {
  return (
    isObj(v) &&
    typeof v.name === 'string' &&
    v.name.length > 0 &&
    v.name.length <= 20 &&
    isOneOf(GENDERS, v.gender) &&
    isInt(v.birthYear) &&
    v.birthYear >= 1800 &&
    v.birthYear <= 2200 &&
    isOneOf(PARENT_WEALTHS, v.parentWealth) &&
    isOneOf(PARENTING_STYLES, v.parenting) &&
    isInt(v.looks) &&
    v.looks >= 0 &&
    v.looks <= 100
  );
}

/** 어느 시대에서든 가능한 가장 큰 나이 (시대를 알기 전의 상한) */
const ABSOLUTE_MAX_AGE = Math.max(...ERAS.map((e) => ERA_CONFIG[e].life.maxAge));

const optString = (v: unknown, max: number): boolean => v === undefined || (typeof v === 'string' && v.length <= max);

function validHistoryEntry(h: unknown, maxAge: number): boolean {
  return (
    isObj(h) &&
    isInt(h.age) &&
    h.age >= 0 &&
    h.age <= maxAge &&
    isOneOf(HISTORY_KINDS, h.kind) &&
    typeof h.text === 'string' &&
    h.text.length <= HISTORY_LIMITS.maxTextLength &&
    optString(h.title, HISTORY_LIMITS.maxTitleLength) &&
    optString(h.choice, HISTORY_LIMITS.maxChoiceLength) &&
    optString(h.eventId, 48)
  );
}

function validFlags(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= STATE_LIMITS.maxFlags &&
    v.every((f) => typeof f === 'string' && f.length <= STATE_LIMITS.maxFlagLength && FLAG_PATTERN.test(f)) &&
    new Set(v).size === v.length
  );
}

function validSeen(v: unknown, maxAge: number): boolean {
  if (!isObj(v)) return false;
  const entries = Object.entries(v);
  return (
    entries.length <= STATE_LIMITS.maxSeen &&
    entries.every(([id, age]) => id.length > 0 && id.length <= 48 && isInt(age) && age >= 0 && age <= maxAge)
  );
}

/**
 * 대기 중인 선택지의 정합성은 두 층으로 본다.
 *  1) 모양(pendingShapeOk): 이벤트 id 형식·나이·키·본 이벤트 기록·선택지 id 목록(2~3개, 중복 없음)이 저장 상태 안에서 서로 맞는가.
 *     어긋나면 손상·변조된 저장이므로 저장 전체를 버린다(새 게임).
 *  2) 풀과의 대조(pendingMatchesPool): 그 이벤트가 지금 풀에 있는 선택지 이벤트이고 선택지 id가 모두 그 이벤트의 것인가.
 *     모양은 멀쩡한데 여기서 어긋나면 **콘텐츠가 갱신되어 이벤트가 사라지거나 바뀐 것**이다(R-046). 그때는 대기만 풀고 이어간다
 *     (parseGame이 pending을 null로 바꾼 상태를 돌려준다) — 지금까지의 인생 전체를 새 게임으로 날리지 않는다.
 *     대기를 풀면 그 해는 다시 진행되고(stepYear), 이미 본 것으로 기록된 이벤트(seen)는 풀에서 사라졌으니 영향이 없다.
 */
function pendingShapeOk(v: unknown, age: number, seen: Record<string, number>): v is { eventId: string; choiceIds: string[] } {
  if (!isObj(v)) return false;
  if (typeof v.eventId !== 'string' || !EVENT_ID_PATTERN.test(v.eventId)) return false;
  if (!isInt(v.age) || v.age !== age) return false;
  if (v.key !== `${v.eventId}@${age}`) return false;
  if (!Object.prototype.hasOwnProperty.call(seen, v.eventId) || seen[v.eventId] !== age) return false;
  const ids = v.choiceIds;
  return Array.isArray(ids) && ids.length >= 2 && ids.length <= 3 && new Set(ids).size === ids.length && ids.every((id) => typeof id === 'string');
}

function pendingMatchesPool(p: { eventId: string; choiceIds: string[] }, pool: EventPool): boolean {
  const ev = pool.byId.get(p.eventId);
  if (ev === undefined || !isChoiceEvent(ev)) return false;
  const known = new Set((ev.choices ?? []).map((c) => c.id));
  return p.choiceIds.every((id) => known.has(id));
}

/** 'invalid' 새 게임 / 'valid' 그대로 / 'stale-pending' 대기 중이던 선택지만 풀에서 사라져 대기를 풀고 이어간다 */
type GameVerdict = 'invalid' | 'valid' | 'stale-pending';

function checkGameState(v: unknown, pool: EventPool): GameVerdict {
  if (!isObj(v)) return 'invalid';
  const basic =
    isOneOf(PHASES, v.phase) &&
    (v.era === null || isOneOf(ERAS, v.era)) &&
    (v.lifeLength === null || isOneOf(LIFE_LENGTHS, v.lifeLength)) &&
    (v.character === null || validCharacter(v.character)) &&
    (v.birthReport === null || isObj(v.birthReport)) &&
    (v.peerSeed === null || isUint32(v.peerSeed)) &&
    validStats(v.stats) &&
    (v.birthStats === null || validStats(v.birthStats)) &&
    isInt(v.age) &&
    v.age >= 0 &&
    v.age <= ABSOLUTE_MAX_AGE &&
    Array.isArray(v.history) &&
    v.history.length <= HISTORY_LIMITS.maxEntries &&
    v.history.every((h) => validHistoryEntry(h, v.age as number)) &&
    validFlags(v.flags) &&
    validSeen(v.seen, v.age as number) &&
    (v.lastChoiceAge === null || (isInt(v.lastChoiceAge) && v.lastChoiceAge >= 0 && v.lastChoiceAge <= (v.age as number))) &&
    (v.death === null ||
      (isObj(v.death) &&
        isInt(v.death.age) &&
        typeof v.death.cause === 'string' &&
        v.death.cause.length > 0 &&
        v.death.cause.length <= STATE_LIMITS.maxCauseLength)) &&
    isUint32(v.seed) &&
    isUint32(v.rngState);
  if (!basic) return 'invalid';

  // 필드 간 정합성 (R-001): 출생 이후 단계는 시대·캐릭터·출생 스냅샷이 모두 있어야 하고,
  // 출생 전 단계는 캐릭터가 없어야 한다. 출생 연도는 시대 범위 안이어야 한다.
  const phase = v.phase as GameState['phase'];
  const afterBirth = phase === 'roulette' || phase === 'birth' || phase === 'life' || phase === 'ending';
  const age = v.age as number;
  if (afterBirth) {
    if (v.era === null || v.lifeLength === null || v.character === null || v.birthStats === null) return 'invalid';
    const era = v.era as keyof typeof ERA_CONFIG;
    const range = ERA_CONFIG[era].birthYears;
    const year = (v.character as Character).birthYear;
    if (year < range.min || year > range.max) return 'invalid';
    if (age > ERA_CONFIG[era].life.maxAge) return 'invalid';
    // 출생신고 상세(M3): 룰렛 이후 모든 단계에 있어야 하고, 지역·시군구·체중·부모·주거가 그 출생 연도·성별에 맞아야 한다. 또래 시드도 있어야 한다.
    if (v.peerSeed === null || !isValidBirthReport(v.birthReport, year, (v.character as Character).gender)) return 'invalid';
  } else if (v.character !== null || v.birthStats !== null || v.birthReport !== null || v.peerSeed !== null) {
    return 'invalid';
  }
  // 첫 화면(title)에서는 세상·인생 길이가 아직 정해지지 않았다(고르는 값은 설정에 있다). 판 상태에 있으면 변조·손상이다.
  if (phase === 'title' && (v.era !== null || v.lifeLength !== null)) return 'invalid';

  // 인생 진행 필드 (M3): 인생이 시작되기 전에는 진행 기록이 모두 비어 있어야 하고,
  // 대기 중인 선택지는 life에서만, 사망 정보는 ending에서만(그리고 ending에는 반드시) 있다.
  const fresh = phase === 'title' || phase === 'roulette' || phase === 'birth';
  const pending = v.pending as unknown;
  const seen = v.seen as Record<string, number>;
  if (fresh) {
    if (age !== 0 || (v.history as unknown[]).length !== 0 || (v.flags as unknown[]).length !== 0 || Object.keys(seen).length !== 0) return 'invalid';
    if (pending !== null || v.lastChoiceAge !== null || v.death !== null) return 'invalid';
  } else if (phase === 'life') {
    if (v.death !== null) return 'invalid';
    if (pending !== null) {
      if (!pendingShapeOk(pending, age, seen)) return 'invalid';
      if (!pendingMatchesPool(pending, pool)) return 'stale-pending';
    }
  } else {
    // ending
    if (pending !== null || v.death === null || (v.death as { age: number }).age !== age) return 'invalid';
  }
  return 'valid';
}

/**
 * 설정 하나를 읽는다. 배속·자동 모드가 형태에 맞지 않으면 null(설정 전체 기본값). 세상·인생 길이는 v1에는 없고(v2에서 추가),
 * 없거나 알 수 없는 값이면 그 필드만 기본값으로 채운다(이미 고른 배속·자동 모드를 잃지 않는다).
 */
function readSettings(v: unknown): Settings | null {
  if (!isObj(v) || !isOneOf(SPEEDS, v.speed) || typeof v.autoMode !== 'boolean') return null;
  return {
    speed: v.speed as Settings['speed'],
    autoMode: v.autoMode,
    era: isOneOf(ERAS, v.era) ? (v.era as Settings['era']) : DEFAULT_SETTINGS.era,
    // 아직 고를 수 없는 인생 길이(1차에서는 「약 1시간」)가 저장돼 있으면 고를 수 있는 값(약 30분)으로 읽는다(R-202)
    lifeLength: isOneOf(LIFE_LENGTHS, v.lifeLength) ? selectableLifeLength(v.lifeLength as Settings['lifeLength']) : DEFAULT_SETTINGS.lifeLength,
  };
}

/** 봉투를 풀어 data를 돌려준다. versions에 없는 버전·손상은 undefined. */
function parseEnvelope(raw: string | null, versions: number | readonly number[]): unknown {
  if (raw === null) return undefined;
  try {
    const env: unknown = JSON.parse(raw);
    if (!isObj(env) || typeof env.version !== 'number') return undefined;
    const accepted = typeof versions === 'number' ? env.version === versions : versions.includes(env.version);
    return accepted ? env.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 저장된 게임 원문을 분류한다(순수 함수). 첫 화면이 「이전 버전 저장은 새 게임으로 시작합니다」 안내(C6)를 보일지 정하는 데 쓴다.
 *  - 'none' 저장이 없다 / 'valid' 지금 버전으로 읽힌다 / 'broken' 손상·알 수 없는 형태
 *  - 'old-version' 이전 스키마(v4 이하)라 읽지 않고, **진행한 판이 있었다**(출생 이후 단계) — 안내가 필요하다
 *  - 'old-version-empty' 이전 스키마이지만 진행 전 단계(첫 화면 title·시대 선택 eraSelect)였다 — 잃은 것이 없으므로 안내하지 않는다(REV-003-M2-1 R-214).
 *    단계를 알 수 없으면(data.phase가 없거나 낯선 값) 보수적으로 'old-version'이다.
 */
export type SavedGameKind = 'none' | 'valid' | 'old-version' | 'old-version-empty' | 'broken';

/** 이전 스키마(v4 이하)에서 아직 태어나기 전이던 화면 단계 이름 (v4의 eraSelect는 지금은 없는 단계) */
const OLD_SCHEMA_NO_PROGRESS_PHASES: readonly string[] = ['title', 'eraSelect'];

export function classifySavedGame(raw: string | null, pool: EventPool = EVENT_POOL): SavedGameKind {
  if (raw === null) return 'none';
  if (parseGame(raw, pool) !== null) return 'valid';
  try {
    const env: unknown = JSON.parse(raw);
    if (isObj(env) && isInt(env.version) && env.version < SCHEMA_VERSION) {
      const phase = isObj(env.data) ? env.data.phase : undefined;
      return typeof phase === 'string' && OLD_SCHEMA_NO_PROGRESS_PHASES.includes(phase) ? 'old-version-empty' : 'old-version';
    }
  } catch {
    // 아래 'broken'
  }
  return 'broken';
}

/**
 * 문자열 → 게임 상태. 손상·버전불일치·형태오류·정합성 위반이면 null(새 게임).
 * pool은 대기 중인 선택지가 실제 이벤트인지 대조할 때 쓴다: 콘텐츠 갱신으로 그 이벤트가 사라졌거나 선택지가 바뀌었다면
 * 저장 전체를 버리지 않고 **대기만 풀어** 이어간다(R-046 — 저장 형식은 그대로라 SCHEMA_VERSION은 올리지 않는다).
 */
export function parseGame(raw: string | null, pool: EventPool = EVENT_POOL): GameState | null {
  const data = parseEnvelope(raw, SCHEMA_VERSION);
  const verdict = checkGameState(data, pool);
  if (verdict === 'invalid') return null;
  return verdict === 'stale-pending' ? { ...(data as GameState), pending: null } : (data as GameState);
}

/** 문자열 → 설정. 문제가 있으면 기본값. */
export function parseSettings(raw: string | null): Settings {
  return readSettings(parseEnvelope(raw, READABLE_SETTINGS_VERSIONS)) ?? { ...DEFAULT_SETTINGS };
}

// ---------- 저장 직전 판단 (R-052) ----------

/** 'conflict' 저장소를 그 사이 다른 탭이 바꿨다(덮어쓰지 않는다) / 'unchanged' 저장소가 이미 지금 상태 그대로다(쓰지 않는다) / 'write' 쓴다 */
export type SaveDecision = 'conflict' | 'unchanged' | 'write';

/**
 * 저장 effect가 쓰기 직전에 하는 판단 (순수 함수). 세 값은 모두 직렬화된 원문이다.
 *  - stored: 지금 저장소에 있는 값(없으면 null)
 *  - known:  이 탭이 마지막으로 읽었거나 쓴 값 — "내가 아는 저장소의 모습"
 *  - next:   지금 상태를 직렬화한 값
 * 순서가 중요하다:
 *  1. stored === next → 저장소가 이미 지금 상태 그대로다. 쓸 필요가 없다(저장 실패 표시도 지워도 된다 — 잃을 것이 없다).
 *     다른 탭이 마침 같은 값을 썼거나 "이 탭에서 이어하기"로 막 이어받은 직후가 여기에 든다.
 *  2. stored !== known → 내가 아는 값과 다르다 = 읽은 뒤에 다른 탭(또는 개발자 도구)이 저장을 바꿨다. storage 이벤트 리스너를 붙이기 전의 변경도 잡는다.
 *     덮어쓰면 그 탭의 진행이 사라지므로 쓰지 않고 호출자가 "밀린 화면"으로 보낸다.
 *  3. 그 밖에는 쓴다 (첫 실행·진행·손상된 저장의 복구).
 */
export function decideSave(stored: string | null, known: string | null, next: string): SaveDecision {
  if (stored === next) return 'unchanged';
  if (stored !== known && !bothNothingToLose(stored, known)) return 'conflict';
  return 'write';
}

// ---------- 잃을 진행이 없는 첫 저장 (A66) ----------

/** 진행이 없는 저장인가: 유효한 타이틀 단계 저장. 시작을 누르기 전이라 덮어써도 잃을 것이 없다. */
export function isTitleSave(raw: string | null): boolean {
  if (raw === null) return false;
  return parseGame(raw)?.phase === 'title';
}

/** 이 탭이 읽은 저장(known)에 잃을 진행이 없는가: 비어 있었거나, 읽을 수 없어 새 게임이 된 손상 저장이거나, 진행 없는 타이틀이다. */
function nothingToLose(known: string | null): boolean {
  if (known === null) return true;
  const game = parseGame(known);
  return game === null || game.phase === 'title';
}

/**
 * 이 탭이 아는 저장(known)에 잃을 진행이 없고(nothingToLose), 지금 저장소의 값(stored)도 진행 없는 타이틀이면 true.
 * 빈 저장소에서 두 탭을 동시에 열면 둘 다 "비어 있음"을 읽고 각자 새 게임(타이틀)을 첫 저장으로 쓴다. 이 둘이 서로를 "다른 탭의 변경"으로 받아들여
 * 두 탭이 모두 밀리던 문제(QA A66)를 푼다. **진행이 있는 쪽은 그대로다**: stored가 시대 선택 이후 단계이거나, 이 탭이 이미 진행(known이 진행 있는 게임)했다면 false라
 * 충돌로 본다. stored가 비었거나 손상(null·파싱 불가)이어도 false — 누군가 저장을 지운 것이므로 전과 같이 충돌이다.
 */
function bothNothingToLose(stored: string | null, known: string | null): boolean {
  return isTitleSave(stored) && nothingToLose(known);
}

/**
 * storage 이벤트로 알게 된 게임 저장의 변경(changed: 바뀐 뒤의 값, 지워졌으면 null)이 이 탭을 "밀린 화면"으로 보내야 하는가.
 * decideSave와 같은 규칙이다: 둘 다 잃을 진행이 없는 타이틀이면 밀지 않고(A66), 그 밖에는 전처럼 모두 민다(R-011).
 */
export function isSupersedingChange(changed: string | null, known: string | null): boolean {
  return !bothNothingToLose(changed, known);
}

// ---------- 읽기/쓰기 (예외 안전) ----------

export function loadGame(storage: StorageLike | null, pool: EventPool = EVENT_POOL): GameState | null {
  if (!storage) return null;
  try {
    return parseGame(storage.getItem(GAME_KEY), pool);
  } catch {
    return null;
  }
}

/** 저장 성공 여부를 반환. 실패해도 앱은 계속 동작한다. */
export function saveGame(storage: StorageLike | null, state: GameState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(GAME_KEY, serializeGame(state));
    return true;
  } catch {
    return false;
  }
}

/** 저장된 게임을 지운다(설정은 건드리지 않는다). 성공 여부를 반환. */
export function clearGame(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(GAME_KEY);
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(storage: StorageLike | null): Settings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    return parseSettings(storage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, serializeSettings(settings));
    return true;
  } catch {
    return false;
  }
}

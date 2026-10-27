import { LIMITS } from '../data/economyTable';
import { generationDef } from '../data/generations';
import { HISTORY_LIMITS, LIFE_PARAMS_PLACEHOLDER, STAGE_TABLE, STATE_LIMITS } from '../data/lifeTable';
import { isCurrentRegionName } from '../data/regionKeys';
import { eventPool, isGameDataReady } from './gameData';
import { EVENT_ID_PATTERN, FLAG_PATTERN, isChoiceEvent, type EventPool } from './events';
import { isValidBirthReport } from './birthReport';
import { isValidStat } from './stats';
import { resolveDelegated } from './life';
import { decisionFor } from './parentDecision';
import {
  BGM_VOLUME_MAX,
  BGM_VOLUME_MIN,
  DELEGATED_BYS,
  DWELLINGS,
  GENDERS,
  GENERATION_CHOICES,
  GENERATION_IDS,
  HISTORY_KINDS,
  LIFE_LENGTHS,
  MONEY_VIEWS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  PHASES,
  SPEEDS,
  STAT_KEYS,
  THEMES,
  selectableLifeLength,
  type Character,
  type GameState,
  type HistoryEntry,
  type Settings,
  type Stats,
} from './types';
import { isValidAssets } from './economy';
import { cleanNoteForLoad, isInvisibleOnly } from './noteText';
import { readPlay } from './playClock';
import { DEFAULT_SETTINGS } from './state';
import { VERSION_PATTERN } from './build';
import type { GenerationId } from './types';

/**
 * 게임 진행과 설정은 별도 키. 스키마(또는 저장 검증 규칙)가 바뀌면 SCHEMA_VERSION을 올린다.
 * v3: 지금 세상 출생 연도 범위가 1990~2025 → 2008~2025로 바뀜(R-012). 구 저장은 새 게임으로 시작한다.
 * v4: 인생 진행(M3) — 플래그·본 이벤트·대기 중인 선택지·사망 정보 추가, 연표 항목 형태 변경, 스탯 0~100 정수 검증(R-024).
 * v5: 개편(SPEC-003 M2) — 화면 단계에서 시대 선택(eraSelect)이 빠지고(세상·인생 길이는 첫 화면에서 고른다), 판마다 인생 길이(lifeLength)가 고정된다. v4 이하 저장은 새 게임으로 시작한다(C6).
 * v6: 개편(SPEC-003 M3) — 화면 단계에 룰렛(roulette)이 더해지고, 판마다 출생신고 상세(birthReport)와 또래 시드(peerSeed)가 저장된다. 지금 세상 출생 연도가 2026 한 해로 고정되어
 *     (ERA_CONFIG.present.birthYears) M2 시기의 v5 저장(지금 세상 2008~2025년생)은 새 게임으로 시작한다 — 버전을 올려 「손상」이 아니라 「이전 버전」으로 분류하고 첫 화면에 안내 한 줄(C6)을 보인다(REV-003-M2-1 R-213).
 * v7: 개편(SPEC-003 M4) — 판 상태에 일시정지 여부(`paused`, DB3·DB8: 「나가기」가 일시정지 상태로 저장하고 새로고침해도 멈춘 채 열린다)가 더해졌다. 일시정지는 인생(life) 단계에서만 true일 수 있다.
 *     연표 상한도 160 → 300줄로 올랐다(data/lifeTable.ts#HISTORY_LIMITS, DB12). v6 이하 저장은 새 게임으로 시작하고 첫 화면에 안내 한 줄(C6).
 * v8: 개편(SPEC-003 M5) — **재산(wealth) 스탯이 없어지고** 20세부터의 자산 현황(`assets`: 순자산·연 소득·부채·소득 보정·주거 형태, 만 원 정수)과 20세 미만의 집안 살림(`familyFund`)이 판 상태에 더해졌다.
 *     v7 이하 저장은 새 게임으로 시작하고 첫 화면에 안내 한 줄(C6 — `classifySavedGame`이 `version < SCHEMA_VERSION`을 이전 버전으로 분류한다). docs/data/economy-model.md 10절.
 * v9: 개편(SPEC-004 GM4, MG1) — 판 상태의 `era`(지난·지금·다가올 세상)가 `generation`(세대 7종)으로 바뀌었다. 출생 연도는 고른 세대의 범위(1940~2020) 안이고, 출생지는 시도까지다(시군구 없음, NR3).
 *     선택 필드 `regionPicked`(시도를 직접 골라 시작한 판)·`fromRandom`(「랜덤 세대」로 세대가 뽑힌 판)이 더해졌다. **v8 이하(R1) 저장은 새 게임으로 시작하고 첫 화면에 안내 한 줄**(C6 전례 — R1의 2026년생은 알파 범위 밖이라 옮기지 않는다, N18 닫힘).
 *     SPEC-008 필드는 예약하지 않는다(N24): 앞으로의 선택 필드는 SPEC-005 SV1 방식(필드 단위 검증, 없는 저장은 기본값)으로 더하고 저장 버전을 올리지 않는다(tests/storageOptional.test.ts).
 * (M7c: 게임 스키마는 v8 그대로였다 — 연표 종류에 `note`가 더해지고 `seen`에 `note-…` 키가 생길 수 있지만 허용 범위만 넓어졌고, 기록이 없는 v8 저장은 새 규칙에서도 그대로 유효하다. 진행 중인 판을 잃지 않으려고 올리지 않았다, NC-1.)
 * (SPEC-005 QI6: 게임 스키마는 v8 그대로다 — 판 상태에 **선택 필드 `gentleUsed`**(판 도중 한 번이라도 「무거운 장면 가리기」가 켜졌으면 `true`, 엔딩 맨 위 한 줄의 기준)가 더해졌다. 없으면 켠 적이 없는 판이다. 값이 이상하면 판을 버리지 않고 그 필드만 버린다(`withValidGentleUsed`).
 *     `eventId`가 없는 상속 줄의 표지는 줄에 필드를 더하지 않고 글자 상수로 잡는다(core/gentle.ts) — 이 변경 이전에 저장된 판의 상속 줄도 같다(M20).)
 * (SPEC-005 QI5: 게임 스키마는 v8 그대로다 — 연표 줄에 **선택 필드 `by`**(`'parent'` 부모님이 정했다 · `'child'` 아이의 일로 흘러갔다, `kind: 'choice'`에만)가 더해졌다. 없으면 본인이 고른 선택이다. 다른 값이거나 선택 줄이 아니면 판을 버리지 않고 그 필드만 버린다(`withValidBy`).
 *     저장에 부모 영역·흘러감 카드가 대기(`pending`) 중이면 열자마자 그 해 안에서 부모님이 정한·흘러간 선택으로 처리한다(`settleDelegatedPending`, PD10).)
 * (M8: 게임 스키마는 v8 그대로다 — 판 상태에 **선택 필드 `play`**(플레이 시간 기록, core/playClock.ts)가 더해졌다. 없으면 시간을 재지 않은 판이고, 값이 이상하면 판을 버리지 않고 그 필드만 버린다(`withValidPlay`). 진행 중인 판을 잃지 않으려고 올리지 않았다, LD-6.)
 */
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SCHEMA_VERSION = 9;
/**
 * 설정 스키마는 게임 스키마와 따로 버전을 관리한다(게임 스키마가 바뀌어도 설정은 유지).
 * v2: 첫 화면에서 고른 세상(era)·인생 길이(lifeLength)가 더해졌다. v1 설정(배속·자동 모드만)은 그대로 읽고 새 필드는 기본값으로 채운다 — 배속·자동 모드를 잃지 않는다.
 * v3: 대시보드(SPEC-003 M4)의 BGM 켬/끔·볼륨(`bgm`, DB4)과 화면 테마(`theme`, DB6)가 더해졌다. v1·v2 설정은 그대로 읽고 새 필드는 기본값(BGM 꺼짐·시스템 테마)으로 채운다 — 이미 고른 값을 잃지 않는다.
 * v4: 기록 카드(SPEC-003 M7c)의 `noteCards`(자동 기록 카드 켬/끔, 기본 켜짐)가 더해졌다. v1~v3 설정은 그대로 읽고 새 필드는 기본값으로 채운다 — 이미 고른 값을 잃지 않는다.
 * v5: 「무거운 장면 가리기」(SPEC-005 HV3)의 `gentle`(기본 꺼짐)과 마지막으로 본 새 소식 버전 `notesSeen`(NT4, 기본 빈 글자)이 더해졌다. v1~v4 설정은 그대로 읽고 새 필드는 기본값으로 채운다 — 이미 고른 값을 잃지 않는다.
 *     index.html의 첫 그림 전 테마 스크립트의 읽을 수 있는 버전 목록도 같이 고쳤다(tests/themeInline.test.ts가 대조).
 * v6: 세대 선택(SPEC-004 MG1) — `era`가 `generation`(첫 화면 세대 목록의 마지막 줄, 기본 `random`)으로 바뀌고, 살아본 세대 `lived`(GS10)·내 출신 시도 `homeRegion`(RG3, 이 키 하나에만)·금액 보기 `moneyView`(EY11)가 더해졌다.
 *     v1~v5 설정은 그대로 읽고 새 필드는 기본값으로 채운다(옛 `era`는 버린다) — 이미 고른 배속·BGM·테마를 잃지 않는다. index.html의 테마 스크립트 목록도 같이 고쳤다.
 */
export const SETTINGS_VERSION = 6;
/** 읽을 수 있는 설정 버전 (현재 + 이전 버전). 이 밖의 버전은 기본값. index.html의 첫 그림 전 테마 스크립트도 같은 목록이다(tests/themeInline.test.ts가 대조한다). */
const READABLE_SETTINGS_VERSIONS: readonly number[] = [1, 2, 3, 4, 5, 6];

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

/** 스탯 4개가 모두 0~100의 정수이고 그 밖의 키는 없다 (범위 정책은 core/stats.ts 한 곳, R-024). 재산 스탯은 v8에서 없어졌다 — 옛 `wealth` 키가 남은 저장은 손상으로 본다. */
function validStats(v: unknown): v is Stats {
  return isObj(v) && Object.keys(v).length === STAT_KEYS.length && STAT_KEYS.every((k) => isValidStat(v[k]));
}

/**
 * 화면에 그대로 나가는 글(이름·연표 글·사망 원인)에 보이지 않는 방향·너비 제어 문자가 들어 있는가 (QA-003-M7b A12b): 양방향 제어(U+202A~202E 임베딩·덮어쓰기, U+2066~2069 격리, U+200E·200F 방향 표시)는 글자 순서를 뒤집고,
 * 제로폭(U+200B~200D, U+FEFF)은 이름을 비어 보이게 하거나 다른 이름과 구별되지 않게 한다. 게임이 만든 글에는 없으므로(이름은 이름표에서, 문장은 이벤트 데이터에서 온다) 있으면 저장을 직접 고친 손상으로 본다 — 첫 화면 정리.
 */
const HIDDEN_CONTROL = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/;
export const hasHiddenControl = (text: string): boolean => HIDDEN_CONTROL.test(text);
const cleanText = (v: unknown): boolean => typeof v === 'string' && !hasHiddenControl(v);

/**
 * 주인공 이름은 **한글 음절 3~5자**뿐이다 (SPEC-003 M7c T2·NC-13, QA-003-M7b A12d): 이름은 이름 풀(src/data/names.ts)에서만 오고 풀 전체(성 1자 + 이름 2~3자 — 성 1~2자까지 여유)가 이 패턴을 통과한다(tests/storage.test.ts).
 * 보이지 않는 글자만의 이름(U+3164·U+115F·U+2060·공백·결합 문자·U+061C 등)과 숨은 제어 문자가 든 이름을 한꺼번에 막는다. 이름은 사용자 입력이 아니라서 거부해도 정상 저장을 잃지 않는다.
 * **사용자 글(기록)에는 이 거부를 쓰지 않는다** — 기록 행은 별도 검증이다(`validHistoryEntry`).
 */
export const CHARACTER_NAME_PATTERN = /^[가-힣]{3,5}$/;

function validCharacter(v: unknown): v is Character {
  return (
    isObj(v) &&
    typeof v.name === 'string' &&
    CHARACTER_NAME_PATTERN.test(v.name) &&
    isOneOf(GENDERS, v.gender) &&
    isInt(v.birthYear) &&
    v.birthYear >= 1940 &&
    v.birthYear <= 2020 &&
    isOneOf(PARENT_WEALTHS, v.parentWealth) &&
    isOneOf(PARENTING_STYLES, v.parenting) &&
    isInt(v.looks) &&
    v.looks >= 0 &&
    v.looks <= 100
  );
}

/** 어느 출생 연도에서든 가능한 가장 큰 나이 (세대를 알기 전의 상한 — 사망 모형이 연도 축으로 바뀌면 GM10이 연도별 값으로 바꾼다) */
const ABSOLUTE_MAX_AGE = LIFE_PARAMS_PLACEHOLDER.maxAge;

const optString = (v: unknown, max: number): boolean => v === undefined || (typeof v === 'string' && v.length <= max && !hasHiddenControl(v));

/**
 * 연표 한 줄의 검증. **기록(`note`) 줄의 글(`text`)은 사용자가 쓴 글**이라 숨은 문자 거부(`cleanText`)·길이 400 거부를 쓰지 않는다(M7c H1·H4) — 이모지 하나(ZWJ)로 인생 전체가 날아가면 안 된다.
 * 문자열이 아니면 모양 위반이라 손상(H3)이고, 문자열이면 여기서는 통과시킨다. 위험한 글자는 `parseGame`이 `cleanNoteForLoad`로 걷어 내고 비면 그 줄만 버린다.
 * 기록 줄의 `title`(주제)·`eventId`(카드 id)는 게임이 만든 글이라 기존 검사를 그대로 받는다(H2).
 */
function validHistoryEntry(h: unknown, maxAge: number): boolean {
  if (!isObj(h) || !isInt(h.age) || h.age < 0 || h.age > maxAge || !isOneOf(HISTORY_KINDS, h.kind)) return false;
  const textOk = h.kind === 'note' ? typeof h.text === 'string' : cleanText(h.text) && (h.text as string).length <= HISTORY_LIMITS.maxTextLength;
  return textOk && optString(h.title, HISTORY_LIMITS.maxTitleLength) && optString(h.choice, HISTORY_LIMITS.maxChoiceLength) && optString(h.eventId, 48);
}

/** 불러온 기록 줄의 글에서 위험한 글자를 걷고, 걷은 뒤 보이는 글자가 없으면 그 줄만 버린다 (H3). 기록 줄이 없으면 같은 객체. */
function withCleanNotes(state: GameState): GameState {
  if (!state.history.some((h) => h.kind === 'note')) return state;
  const history: HistoryEntry[] = [];
  for (const h of state.history) {
    if (h.kind !== 'note') {
      history.push(h);
      continue;
    }
    const text = cleanNoteForLoad(h.text);
    if (isInvisibleOnly(text)) continue;
    history.push(text === h.text ? h : { ...h, text });
  }
  return { ...state, history };
}

/**
 * 플레이 시간 기록(`play`, SPEC-003 LM6 · M8 LD-6)은 **선택 필드**라 이상한 값이 판을 버리게 하지 않는다 — 값이 이상하면(음수·문자열·소수·NaN·상한 초과·키 모자람/넘침·배열·null, `readPlay`가 정한다)
 * **그 필드만 버리고** 판은 그대로 연다(NC-2 「거부하지 않고 걷어 낸다」, 없으면 시간을 재지 않은 판 = 엔딩에 줄이 없다). 인생·엔딩이 아닌 단계(첫 화면·룰렛·출생신고)에는 있을 수 없어 그 필드도 버린다. 필드가 없는 v8 저장은 그대로 유효하다(스키마를 올리지 않는다).
 */
function withValidPlay(state: GameState): GameState {
  if (!Object.prototype.hasOwnProperty.call(state, 'play')) return state;
  const raw: unknown = (state as { play?: unknown }).play;
  const play = state.phase === 'life' || state.phase === 'ending' ? readPlay(raw) : undefined;
  if (play !== undefined) return { ...state, play };
  const rest = { ...state } as Record<string, unknown>;
  delete rest.play;
  return rest as unknown as GameState;
}

/**
 * 판의 `regionPicked`(SPEC-004 RG1·MG1 — 시도를 직접 골라 시작한 판)는 **선택 필드**라 이상한 값이 판을 버리게 하지 않는다 — `true`가 아니거나 출생 이후 단계가 아닌 판에 있으면 **그 필드만 버린다**. 없는 저장은 룰렛에 맡긴 판이다.
 */
function withValidRegionPicked(state: GameState): GameState {
  if (!Object.prototype.hasOwnProperty.call(state, 'regionPicked')) return state;
  if ((state as { regionPicked?: unknown }).regionPicked === true && state.phase !== 'title') return state;
  const rest = { ...state } as Record<string, unknown>;
  delete rest.regionPicked;
  return rest as unknown as GameState;
}

/** 판의 `fromRandom`(GS3 — 「랜덤 세대」로 세대가 뽑힌 판): `regionPicked`와 같은 규칙의 선택 필드 */
function withValidFromRandom(state: GameState): GameState {
  if (!Object.prototype.hasOwnProperty.call(state, 'fromRandom')) return state;
  if ((state as { fromRandom?: unknown }).fromRandom === true && state.phase !== 'title') return state;
  const rest = { ...state } as Record<string, unknown>;
  delete rest.fromRandom;
  return rest as unknown as GameState;
}

/**
 * 판의 `gentleUsed`(SPEC-005 HV3·SV1 — 「무거운 장면 가리기」를 켠 채 산 판)는 **선택 필드**라 이상한 값이 판을 버리게 하지 않는다 — 불리언이 아니거나, 출생 이후(룰렛·출생신고·인생·엔딩) 단계가 아닌 판에 있으면 **그 필드만 버린다**
 * (첫 화면 단계의 판은 아직 살기 시작하지 않았다). 필드가 없는 v8 저장(이 변경 이전의 모든 판)은 그대로 유효하다. 버릴 필드가 없으면 같은 객체를 돌려준다.
 */
function withValidGentleUsed(state: GameState): GameState {
  if (!Object.prototype.hasOwnProperty.call(state, 'gentleUsed')) return state;
  const raw: unknown = (state as { gentleUsed?: unknown }).gentleUsed;
  if (typeof raw === 'boolean' && state.phase !== 'title') return state;
  const rest = { ...state } as Record<string, unknown>;
  delete rest.gentleUsed;
  return rest as unknown as GameState;
}

/**
 * 연표 줄의 `by`(SPEC-005 PD6)는 **선택 필드**라 이상한 값이 판을 버리게 하지 않는다 — `kind: 'choice'`이고 값이 `'parent'`·`'child'`가 아니면 **그 필드만 버린다**(없는 줄은 본인이 고른 선택).
 * 줄을 새로 만들지 않고, 버릴 필드가 없으면 같은 객체를 돌려준다.
 */
function withValidBy(state: GameState): GameState {
  const has = (h: object) => Object.prototype.hasOwnProperty.call(h, 'by');
  if (!state.history.some(has)) return state;
  let changed = false;
  const history = state.history.map((h) => {
    if (!has(h)) return h;
    if (h.kind === 'choice' && isOneOf(DELEGATED_BYS, (h as { by?: unknown }).by)) return h;
    changed = true;
    const rest = { ...h } as Record<string, unknown>;
    delete rest.by;
    return rest as unknown as HistoryEntry;
  });
  return changed ? { ...state, history } : state;
}

/**
 * 부모 영역·흘러감 카드가 대기(`pending`) 중인 저장 (SPEC-005 PD10): 이 변경 이전에는 어린 시절의 모든 결정을 사람이 골랐으므로 v8 저장에는 부모님이 정할 카드가 `pending`으로 남아 있을 수 있다.
 * 열자마자 그 해 안에서 부모님이 정한(또는 흘러간) 선택으로 처리하고 같은 연표 줄을 남긴다(`life.ts#resolveDelegated`) — 이미 지나간 해의 줄(사람이 고른 줄)은 바꾸지 않는다.
 */
function settleDelegatedPending(state: GameState, pool: EventPool): GameState {
  const pending = state.pending;
  if (state.phase !== 'life' || pending === null) return state;
  const who = decisionFor(pending.eventId, pending.age);
  return who === 'self' ? state : resolveDelegated(state, who, pool).state;
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
    (v.generation === null || isOneOf(GENERATION_IDS, v.generation)) &&
    (v.lifeLength === null || isOneOf(LIFE_LENGTHS, v.lifeLength)) &&
    (v.character === null || validCharacter(v.character)) &&
    (v.birthReport === null || isObj(v.birthReport)) &&
    (v.peerSeed === null || isUint32(v.peerSeed)) &&
    typeof v.paused === 'boolean' &&
    isInt(v.familyFund) &&
    v.familyFund >= -LIMITS.familyFundMax &&
    v.familyFund <= LIMITS.familyFundMax &&
    (v.assets === null || isValidAssets(v.assets, DWELLINGS)) &&
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
        cleanText(v.death.cause) &&
        (v.death.cause as string).length > 0 &&
        (v.death.cause as string).length <= STATE_LIMITS.maxCauseLength)) &&
    isUint32(v.seed) &&
    isUint32(v.rngState);
  if (!basic) return 'invalid';

  // 필드 간 정합성 (R-001): 출생 이후 단계는 시대·캐릭터·출생 스냅샷이 모두 있어야 하고,
  // 출생 전 단계는 캐릭터가 없어야 한다. 출생 연도는 시대 범위 안이어야 한다.
  const phase = v.phase as GameState['phase'];
  const afterBirth = phase === 'roulette' || phase === 'birth' || phase === 'life' || phase === 'ending';
  const age = v.age as number;
  if (afterBirth) {
    if (v.generation === null || v.lifeLength === null || v.character === null || v.birthStats === null) return 'invalid';
    const range = generationDef(v.generation as GenerationId).birth;
    const year = (v.character as Character).birthYear;
    if (year < range.from || year > range.to) return 'invalid';
    if (age > LIFE_PARAMS_PLACEHOLDER.maxAge) return 'invalid';
    // 출생신고 상세(M3): 룰렛 이후 모든 단계에 있어야 하고, 지역·체중·부모·주거가 그 출생 연도·성별에 맞아야 한다(시도를 직접 골랐으면 그 시도). 또래 시드도 있어야 한다.
    if (v.peerSeed === null || !isValidBirthReport(v.birthReport, year, (v.character as Character).gender, v.regionPicked === true)) return 'invalid';
  } else if (v.character !== null || v.birthStats !== null || v.birthReport !== null || v.peerSeed !== null) {
    return 'invalid';
  }
  // 자산(v8): 20세 이상에서만 있고(독립이 만든다) 20세 미만에는 없다. 집안 살림은 20세 미만에서만 쌓이고 독립 때 0이 된다.
  if ((v.assets !== null) !== (afterBirth && age >= STAGE_TABLE.youth.startAge)) return 'invalid';
  if (age >= STAGE_TABLE.youth.startAge && v.familyFund !== 0) return 'invalid';
  // 출생 전 단계(title·roulette·birth)에는 집안 살림이 쌓일 수 없다(R-357): 변조한 첫 화면 저장의 familyFund가 새 판의 20세 자산에 합쳐지지 않게 막는다
  if (!(phase === 'life' || phase === 'ending') && v.familyFund !== 0) return 'invalid';
  // 첫 화면(title)에서는 세대·인생 길이가 아직 정해지지 않았다(고르는 값은 설정에 있다). 판 상태에 있으면 변조·손상이다.
  if (phase === 'title' && (v.generation !== null || v.lifeLength !== null)) return 'invalid';
  // 일시정지는 인생(life) 단계에서만 있을 수 있다(DB3). 다른 단계에 켜져 있으면 변조·손상이다.
  if (v.paused === true && phase !== 'life') return 'invalid';

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
    // v6 필드: 없거나 알 수 없는 값이면 그 필드만 기본값 — 옛 `era`(v5 이하)는 읽지 않고 버린다
    generation: isOneOf(GENERATION_CHOICES, v.generation) ? (v.generation as Settings['generation']) : DEFAULT_SETTINGS.generation,
    lived: readLived(v.lived),
    homeRegion: isCurrentRegionName(v.homeRegion) ? v.homeRegion : null,
    moneyView: isOneOf(MONEY_VIEWS, v.moneyView) ? (v.moneyView as Settings['moneyView']) : DEFAULT_SETTINGS.moneyView,
    // 아직 고를 수 없는 인생 길이(1차에서는 「약 1시간」)가 저장돼 있으면 고를 수 있는 값(약 30분)으로 읽는다(R-202)
    lifeLength: isOneOf(LIFE_LENGTHS, v.lifeLength) ? selectableLifeLength(v.lifeLength as Settings['lifeLength']) : DEFAULT_SETTINGS.lifeLength,
    // v3 필드: 없거나 형태가 어긋나면 그 필드만 기본값으로 채운다(이미 고른 다른 설정을 잃지 않는다)
    bgm: readBgm(v.bgm),
    theme: isOneOf(THEMES, v.theme) ? (v.theme as Settings['theme']) : DEFAULT_SETTINGS.theme,
    // v4 필드: 없거나 불리언이 아니면 기본값(켜짐)
    noteCards: typeof v.noteCards === 'boolean' ? v.noteCards : DEFAULT_SETTINGS.noteCards,
    // v5 필드: 없거나 형태가 어긋나면 그 필드만 기본값(꺼짐·본 적 없음) — 이상한 저장이 갑자기 장면을 가리거나 「새」 표시를 없애지 않는다
    gentle: typeof v.gentle === 'boolean' ? v.gentle : DEFAULT_SETTINGS.gentle,
    notesSeen: typeof v.notesSeen === 'string' && VERSION_PATTERN.test(v.notesSeen) ? v.notesSeen : DEFAULT_SETTINGS.notesSeen,
  };
}

/** 기본 설정의 새 사본 — 배열(lived)·객체(bgm)까지 복사해, 한 호출이 고친 값이 기본값과 다음 호출에 새지 않는다 */
function defaultSettings(): Settings {
  return { ...DEFAULT_SETTINGS, lived: [...DEFAULT_SETTINGS.lived], bgm: { ...DEFAULT_SETTINGS.bgm } };
}

/** 살아본 세대: 세대 id의 배열을 세대 순서로 정렬·중복 없이. 알 수 없는 값은 버린다(이상한 저장이 표시를 만들어 내지 않는다) */
function readLived(v: unknown): Settings['lived'] {
  if (!Array.isArray(v)) return [];
  return GENERATION_IDS.filter((id) => v.includes(id));
}

/** BGM 설정: 켬/끔은 불리언, 볼륨은 0~100 정수. 어느 쪽이든 어긋나면 그 값만 기본값(BGM은 꺼짐이 기본이라 어긋난 저장이 갑자기 소리를 내지 않는다). */
function readBgm(v: unknown): Settings['bgm'] {
  if (!isObj(v)) return { ...DEFAULT_SETTINGS.bgm };
  return {
    on: typeof v.on === 'boolean' ? v.on : DEFAULT_SETTINGS.bgm.on,
    volume: isInt(v.volume) && v.volume >= BGM_VOLUME_MIN && v.volume <= BGM_VOLUME_MAX ? v.volume : DEFAULT_SETTINGS.bgm.volume,
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

export function classifySavedGame(raw: string | null, pool?: EventPool): SavedGameKind {
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
export function parseGame(raw: string | null, poolArg?: EventPool): GameState | null {
  const data = parseEnvelope(raw, SCHEMA_VERSION);
  // 진행 중인 판(룰렛 이후)은 출생 연도 표·이벤트 풀로 검증한다 — 지연 로드 덩어리가 오기 전에는 읽지 않는다(null). 앱은 `savedNeedsGameData`로 먼저 불러온다(MG8).
  if (isObj(data) && data.phase !== 'title' && !isGameDataReady()) return null;
  const pool = poolArg ?? (isGameDataReady() ? eventPool() : EMPTY_POOL);
  const verdict = checkGameState(data, pool);
  if (verdict === 'invalid') return null;
  const state = verdict === 'stale-pending' ? { ...(data as GameState), pending: null } : (data as GameState);
  return withValidRegionPicked(withValidFromRandom(withValidGentleUsed(withValidPlay(withCleanNotes(settleDelegatedPending(withValidBy(state), pool)))))) ;
}

/** 이벤트 풀이 아직 없는 첫 화면 단계의 저장을 읽을 때만 쓰는 빈 풀 (title 단계 저장은 풀을 읽지 않는다) */
const EMPTY_POOL: EventPool = Object.freeze({ events: [], byId: new Map() });

/**
 * 저장된 게임 원문이 읽히려면 지연 로드 덩어리(출생 연도 표·이벤트 풀)가 먼저 와야 하는가 (MG8): 지금 버전으로 읽히는 모양이고 첫 화면(title)이 아닌 단계면 참.
 * 이전 버전·손상·첫 화면 단계·저장 없음은 거짓이다(그 경우는 덩어리 없이 새 게임/첫 화면으로 열린다).
 */
export function savedNeedsGameData(raw: string | null): boolean {
  const data = parseEnvelope(raw, SCHEMA_VERSION);
  return isObj(data) && typeof data.phase === 'string' && data.phase !== 'title' && isOneOf(PHASES, data.phase);
}

/** 문자열 → 설정. 문제가 있으면 기본값. */
export function parseSettings(raw: string | null): Settings {
  return readSettings(parseEnvelope(raw, READABLE_SETTINGS_VERSIONS)) ?? defaultSettings();
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

/**
 * 쓰려는 판이 **저장소에 있다고 아는 값**(known)과 수동적인 시간(`play.idle` — 탭 가림·일시정지·나가기 확인 등 사람이 아무것도 하지 않은 시간)만 다른가 (REV-003-M8-1 R-417).
 * 그렇다면 쓰지 않는다: idle만 늘어난 저장을 쓰면 아무것도 하지 않은 탭(열기만 한 탭, 일시정지해 둔 채 배경으로 간 탭)이 저장소에 써서 활성 탭을 「밀린 화면」으로 보내고(R-047),
 * 저장이 막힌 기기에서 진행이 없는데도 저장을 시도한다(R-006·NC-11). hold·decide·fold·note·offSpeed·auto·skips·resumes가 하나라도 늘었거나(= 사람이 한 일이 있다) 인생 상태가 다르면 false다.
 * 이어하기 횟수(resumes)는 그 탭에서 hold·decide가 처음 쌓일 때 같이 오르므로 따로 보지 않는다(core/playTimer.ts). 알던 값이 없거나 읽을 수 없으면 false(쓰는 쪽에 맡긴다).
 * 보이는 두 번째 탭이 결정 카드를 10초 넘게 띄워 decide가 쌓이면 이 함수는 false를 돌려주고 그 탭이 쓴다 — **허용한다**(마스터 결정 M-1, content-M8 13-6: 보이는 탭에서 실제로 읽은 시간이고 마지막 쓰기 우선 규칙 R-011의 연장이다 — 열기만 한 다른 탭이 밀리는 것도 같다).
 */
export function isIdleOnlyChange(knownRaw: string | null, game: GameState): boolean {
  if (knownRaw === null || game.play === undefined) return false;
  const known = parseGame(knownRaw);
  if (known === null || known.play === undefined) return false;
  return serializeGame({ ...game, play: { ...game.play, idle: known.play.idle } }) === serializeGame(known);
}

/**
 * 사람이 한 일이 **있기는 하지만 쓸 만큼은 아닌** 시간의 상한(ms). 마지막으로 아는 저장 뒤에 쌓인 hold + decide + fold + note가 이보다 짧고 「다음 결정으로」(skips)와 인생 상태가 그대로면 flush(10초마다·가림·pagehide)는 쓰지 않는다.
 * 표본 간격(1초)보다 길고 e2e 「일시정지를 풀고 2.5초 흘린 뒤 pagehide → 쓴다」(QA TB01-did)보다 짧은 1.5초다.
 */
export const NEGLIGIBLE_PLAY_MS = 1500;

/**
 * 열자마자 곧바로 닫은 탭이 활성 탭을 밀어내지 않게 (content-M8 13-3 QA 2회차 TB01-close — 「B를 열고 곧바로 닫기(pagehide) → B 쓰기 0, A는 밀리지 않음」, R-047). 보이는 채로 막 뜬 탭은 결정 카드·연출이 흐르므로 닫는 순간
 * 수십~수백 ms의 decide·hold가 쌓여 있어 `isIdleOnlyChange`만으로는 쓰게 된다. 그 시간을 잃어도 되는 이유: 어디까지나 마지막 쓰기 뒤 1.5초 미만이다.
 * 잃는 시간(content-M8 13-8, R-423): 닫는 이벤트(`pagehide`·가림)가 오면 1.5초 미만, 오지 않으면(보이는 채 프로세스가 끝남, iOS에서 `pagehide`가 오지 않음) 최대 약 11.5초(10초 주기 + 1.5초) —
 * 이 규칙은 10초 주기 flush에도 걸려 마지막 쓰기 직후(1.5초 미만)에 주기가 돌면 그 차례를 건너뛰기 때문이다. 5-2절의 「닫을 때마다 최대 10초」보다 1.5초 길지만, 코드로 10초를 지키면 가려졌다 잠깐 보인 탭이 쓰는 F-1 류 경로가 다시 열려 문서를 고쳤다.
 * (1.5초를 넘기면 쓴다 — 보이는 탭이 실제로 읽은 시간, 마스터 결정 M-1). 알던 값이 없거나 읽을 수 없거나 기록이 없으면 false(쓰는 쪽에 맡긴다).
 */
export function isNegligibleChange(knownRaw: string | null, game: GameState): boolean {
  if (knownRaw === null || game.play === undefined) return false;
  const known = parseGame(knownRaw);
  if (known === null || known.play === undefined) return false;
  const k = known.play;
  const p = game.play;
  if (p.skips !== k.skips) return false;
  const human = p.hold - k.hold + (p.decide - k.decide) + (p.fold - k.fold) + (p.note - k.note);
  if (human >= NEGLIGIBLE_PLAY_MS) return false;
  // 기록(play)을 알던 값으로 되돌린 직렬화가 같아야 한다 = 인생 상태는 그대로
  return serializeGame({ ...game, play: k }) === serializeGame(known);
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

export function loadGame(storage: StorageLike | null, pool?: EventPool): GameState | null {
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
  if (!storage) return defaultSettings();
  try {
    return parseSettings(storage.getItem(SETTINGS_KEY));
  } catch {
    return defaultSettings();
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

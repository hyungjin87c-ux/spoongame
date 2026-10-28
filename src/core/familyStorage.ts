import { olderSiblingsOf, reportTiltOf } from '../data/birthReportTable';
import { olderSiblingDraw, YOUNGER_SIBLING_EVENT } from './family';
import { orderSharesOf } from './birthReport';
import { leaveAgeOf, rollFamilyBirth, rollFamilyCore, rollOlderSiblings } from './familyBirth';
import { FAMILY_DATA_VERSION, FAMILY_MAX_CHILDREN, YOUNGER_MOTHER_MAX, type FamilyData } from './familyModel';
import { famSeedOf } from './familyRng';
import { isGameDataReady } from './gameData';
import type { GameState } from './types';

/**
 * 가족 저장 (SPEC-009 FM4a, 설계 문서 2-3·2-4절, K5): **저장 `SCHEMA_VERSION`은 9 그대로**이고 `GameState.family?: FamilyData`는 선택 필드다 —
 * 값이 이상하면 판을 버리지 않고 그 필드만 버린다(`withValidFamily`, `withValidPlay` 방식). 필드가 없는 판(v0.3.0까지의 저장)은 `ensureFamily`가 옛 계산 결과를 스냅샷으로 삼아 채운다(`legacyFamilyFrom`).
 */

type Source = Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed'>;

/** 출생 이후 단계 (가족이 있을 수 있는 단계) */
const AFTER_BIRTH: readonly string[] = ['roulette', 'birth', 'life', 'ending'];

/**
 * 옛 저장(필드 없음)의 가족 스냅샷 (K5, 2-4절): **이미 본 값을 바꾸지 않는다** (DF25).
 *  - 위 형제: 옛 `familyOf`와 같은 값(같은 함수 `olderSiblingPlan`), 이름만 나중에 채운다
 *  - 아래 동생: `seen['infant-new-sibling']`이 있으면 1명(`k` = 그 나이, 첫째일 때만), 없으면 없음. **더 늘리지 않는다**
 *  - 조부모·부모 별세 나이·함께 사는 쪽: 시드로 채운다. 지난 해의 별세는 줄로 소급하지 않는다(`lg: 1` — 상태만 반영)
 */
export function legacyFamilyFrom(game: Source): FamilyData {
  const { character, birthReport: report } = game;
  if (character === null || report === null) throw new Error('legacyFamilyFrom: 출생 전 상태에는 가족이 없다');
  const siblingSeed = game.peerSeed ?? game.seed;
  const famSeed = famSeedOf(siblingSeed);
  const core = rollFamilyCore(famSeed, { birthYear: character.birthYear, report });
  const bornAt = game.seen[YOUNGER_SIBLING_EVENT];
  const y: FamilyData['y'] =
    typeof bornAt === 'number' && report.birthOrder === 1 ? [{ g: olderSiblingDraw(siblingSeed, 99).gender === 'male' ? 0 : 1, k: bornAt, s: leaveAgeOf(famSeed, 11) }] : [];
  return { v: FAMILY_DATA_VERSION, lg: 1, ...core, o: rollOlderSiblings(famSeed, siblingSeed, report), y, l: [] };
}

/** 새로 태어난 판과 같은 방식으로 가족 구성을 (다시) 만든다 — 저장에서 `family`만 이상해 버려진 판을 같은 시드로 되살린다 (결정성, 12-3절 ③) */
export function rebuildFamily(game: Source): FamilyData {
  const { character, birthReport: report } = game;
  if (character === null || report === null) throw new Error('rebuildFamily: 출생 전 상태에는 가족이 없다');
  const siblingSeed = game.peerSeed ?? game.seed;
  return rollFamilyBirth(famSeedOf(siblingSeed), {
    birthYear: character.birthYear,
    gender: character.gender,
    report,
    parentWealth: character.parentWealth,
    orderShares: orderSharesOf(reportTiltOf(character.birthYear), report.region, character.birthYear),
    siblingSeed,
  });
}

/** 가족이 없는 판(출생 이후 단계)에 `family`를 채운다. 순수 함수 — 다음 저장 때 기록된다. 지연 데이터가 아직 없거나 이미 있으면 같은 객체를 돌려준다 */
export function ensureFamily(state: GameState): GameState {
  if (state.family !== undefined || !AFTER_BIRTH.includes(state.phase) || state.character === null || state.birthReport === null || !isGameDataReady()) return state;
  return { ...state, family: legacyFamilyFrom(state) };
}

// ---------- 검증 (2-3절) ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const intIn = (v: unknown, lo: number, hi: number): boolean => isInt(v) && v >= lo && v <= hi;

/** 식구 이름: 한글 2~5자 (숨은 문자·공백 거부) */
const FAMILY_NAME_PATTERN = /^[가-힣]{2,5}$/;
const optName = (v: unknown): boolean => v === undefined || (typeof v === 'string' && FAMILY_NAME_PATTERN.test(v));

/** 저장 크기 안전 한도(글자). 설계 한도는 1000자이고(시험이 잰다), 이 값은 변조·손상을 걸러 내는 느슨한 상한이다 */
const SIZE_GUARD = 2400;
/** `family.log` 종류 코드 (2-2절) */
const LOG_KINDS: ReadonlySet<number> = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16]);
const KEYS: ReadonlySet<string> = new Set(['v', 'lg', 'p', 'g', 'o', 'y', 'c', 'h', 't', 'u', 'ad', 'l']);

function validParent(v: unknown): boolean {
  if (!isObj(v) || !intIn(v.d, 0, 101) || !optName(v.n)) return false;
  if (v.e !== undefined && !intIn(v.e, 1, 5)) return false;
  if (v.w !== undefined && v.w !== 0 && v.w !== 1) return false;
  if (v.r !== undefined && !intIn(v.r, 0, 100)) return false;
  return Object.keys(v).every((k) => k === 'd' || k === 'n' || k === 'e' || k === 'w' || k === 'r');
}

function validGrand(v: unknown): boolean {
  return isObj(v) && intIn(v.a, 16, 56) && intIn(v.d, 0, 101) && optName(v.n) && Object.keys(v).every((k) => k === 'a' || k === 'd' || k === 'n');
}

function validSibling(v: unknown, older: boolean): boolean {
  return (
    isObj(v) && (v.g === 0 || v.g === 1) && (older ? intIn(v.k, 1, 20) : intIn(v.k, 0, 30)) && intIn(v.s, 20, 30) && optName(v.n) && Object.keys(v).every((k) => k === 'g' || k === 'k' || k === 's' || k === 'n')
  );
}

function validLog(l: unknown, maxAge: number): boolean {
  if (!Array.isArray(l) || l.length > 80) return false;
  const seen = new Set<string>();
  for (const e of l) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every(isInt)) return false;
    const [kind, age, target] = e as number[];
    if (!LOG_KINDS.has(kind) || age < 0 || age > maxAge) return false;
    const key = `${kind}:${target}`;
    if (seen.has(key)) return false; // (종류, 대상)은 한 번만 (INV-8)
    seen.add(key);
  }
  return true;
}

/** `family`가 맞는 모양인가 (이 판의 출생신고와 맞는지까지) */
export function isValidFamily(v: unknown, state: Pick<GameState, 'age' | 'birthReport'>): v is FamilyData {
  if (!isObj(v) || v.v !== FAMILY_DATA_VERSION || !Object.keys(v).every((k) => KEYS.has(k))) return false;
  const report = state.birthReport;
  if (report === null) return false;
  if (v.lg !== undefined && v.lg !== 1) return false;
  if (!Array.isArray(v.p) || v.p.length !== 2 || !v.p.every(validParent)) return false;
  if (!Array.isArray(v.g) || v.g.length !== 4 || !v.g.every(validGrand)) return false;
  if (!Array.isArray(v.o) || !v.o.every((s) => validSibling(s, true)) || v.o.length > olderSiblingsOf(report.birthOrder)) return false;
  if (!Array.isArray(v.y) || !v.y.every((s) => validSibling(s, false))) return false;
  if (v.o.length + 1 + v.y.length > FAMILY_MAX_CHILDREN) return false;
  // 새로 태어난 판의 아래 동생은 어머니 나이 한도 안이다 (INV-1) — 옛 저장에서 만든 스냅샷(`lg`)은 사건이 일으킨 값이라 따지지 않는다
  if (v.lg !== 1 && !(v.y as Array<{ k: number }>).every((s) => report.mother.age + s.k <= YOUNGER_MOTHER_MAX)) return false;
  if (v.c !== 0 && v.c !== 1 && v.c !== 2) return false;
  if (v.h !== undefined && !(isObj(v.h) && isInt(v.h.k) && isInt(v.h.r))) return false;
  if (v.t !== undefined && !(Array.isArray(v.t) && v.t.length === 2 && v.t.every(isInt))) return false;
  if (v.u !== undefined && !isInt(v.u)) return false;
  if (v.ad !== undefined && !(Array.isArray(v.ad) && v.ad.length <= 5 && v.ad.every((n) => typeof n === 'string' && FAMILY_NAME_PATTERN.test(n)))) return false;
  if (!validLog(v.l, state.age)) return false;
  return JSON.stringify(v).length <= SIZE_GUARD;
}

/**
 * 저장된 `family`가 이상하면 **그 필드만** 버린다(판을 버리지 않는다, `withValidPlay` 방식). 출생 이후 단계가 아닌 판(첫 화면)에 있어도 버린다. 버릴 필드가 없으면 같은 객체.
 * 출생 이후 판에서 버려졌고 지연 데이터가 놓여 있으면 새로 태어난 판과 같은 방식으로 **같은 시드에서 다시 만든다**(새 판의 저장 값 = 재생성 값). 데이터가 없으면 필드 없이 두어 `ensureFamily`에 맡긴다.
 */
export function withValidFamily(state: GameState): GameState {
  if (!Object.prototype.hasOwnProperty.call(state, 'family')) return state;
  const raw: unknown = (state as { family?: unknown }).family;
  if (AFTER_BIRTH.includes(state.phase) && isValidFamily(raw, state)) return state;
  const rest = { ...state } as Record<string, unknown>;
  delete rest.family;
  const bare = rest as unknown as GameState;
  if (AFTER_BIRTH.includes(bare.phase) && bare.character !== null && bare.birthReport !== null && isGameDataReady()) return { ...bare, family: rebuildFamily(bare) };
  return bare;
}

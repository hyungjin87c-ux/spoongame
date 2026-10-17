import { MAX_OLDER_SIBLINGS, MIN_FIRST_BIRTH_AGE, SIBLING_GAP, olderSiblingLimit, olderSiblingsOf } from '../data/birthReportTable';
import { parentAgeAt } from './birthReport';
import { mixSeed } from './rng';
import type { Gender, GameState, Occupation } from './types';

/**
 * 가족과 삶 (SPEC-003 DB13, 식구 카드): 어머니·아버지(나이·직업·상태), 형제자매(관계·나이 차), 성인 이후 배우자·자녀.
 * 모두 **저장된 상태에서 다시 계산하는 순수 함수**다 — 새로 저장하는 값이 없다. 출생 때 정한 형제 순서·부모 나이·직업(BirthReport)과 인생 중 켜진 플래그·본 이벤트(GameState)만 읽는다.
 * 그래서 새로고침해도 같고, 출생신고·이후 사건과 모순되지 않는다(BR6·CM9): 부모 나이는 해마다 오르고, 사별(`parents_gone`)은 표시에 반영된다.
 *
 * 설계값(통계가 아님):
 *  - 형제 순서가 N째이면 위로 N−1명(다섯째 이상은 4명)이 있고, 나이 차는 시드에서 2~5살씩 누적한다. 성별도 시드에서 정한다(같은 시드 → 같은 형제).
 *    **누적 나이 차는 「어머니 나이 − 최소 첫 출산 나이」를 넘지 않는다**(R-330, CM9) — 어머니가 출생 때 만 24살인데 위로 형제가 20살 차이일 수는 없다. 시드에서 뽑은 나이 차가 그 한도를 넘으면 한도 안으로 줄이고(형제마다 최소 2살은 남긴다),
 *    **출생 생성기가 형제 순서에 맞는 어머니 나이만 만든다**(위 형제 수 ≤ ⌊(어머니 나이 − 16) / 2⌋, core/birthReport.ts#rollParentAges — R-330 r3, 상수는 data/birthReportTable.ts 한 곳) —
 *    그래서 새로 태어난 판은 출생신고 문장의 「N째입니다」와 위 형제 수가 늘 같다. 이 규칙이 생기기 전에 저장된 판이 어머니 16~17세에 둘째 이상이면(옛 생성기가 드물게 만들었다)
 *    최소 간격으로도 한도에 못 들어가는 형제는 보이지 않는다(불가능한 형제를 보이는 것보다 낫다).
 *    아래 동생은 「동생이 생겼다」(infant-new-sibling, 첫째에게만 일어나는 사건) 이후에만 있다 — 그 사건이 일어난 나이가 곧 나이 차다.
 *  - 가족의 나이가 FAMILY_MAX_AGE를 넘기면 살아 있다고 보이지 않는다(부모·형제 모두 「세상을 떠남」). 사별 사건(`parents_gone`)이 먼저 일어났다면 그것이 우선이다.
 *  - 부모의 상태: 사별 > 병환(`cared_parents`) > 고령(85세~) > 건강함.
 *  - 배우자: 혼인(`married`) 「있음」 > 이혼(`divorced`) > 연인(`has_partner`) > 「없음」. 자녀: `has_child`면 「있음」. 20세 전에는 두 줄을 두지 않는다(null).
 */

/** 이 나이를 넘기면 살아 있다고 보지 않는다 (가족 표시의 상한) */
export const FAMILY_MAX_AGE = 100;
/** 부모를 「고령」이라고 적는 나이 */
export const PARENT_AGED_FROM = 85;
/** 배우자·자녀 줄을 보이기 시작하는 나이 (성인 이후, DB13) */
export const FAMILY_ADULT_AGE = 20;
/** 아래 동생을 만드는 사건 (첫째에게만 일어난다 — BR6) */
export const YOUNGER_SIBLING_EVENT = 'infant-new-sibling';
/**
 * 위 형제의 나이 차 범위·위 형제 수 상한·최소 첫 출산 나이는 **출생 생성기와 같은 상수**를 쓴다(data/birthReportTable.ts 한 곳 — R-330 r3). 여기서 다시 내보내는 것은 기존 import 경로를 지키기 위해서다.
 * 위 형제의 누적 나이 차는 「어머니의 출생 때 나이 − MIN_FIRST_BIRTH_AGE」 이하다 (R-330)
 */
export { MAX_OLDER_SIBLINGS, MIN_FIRST_BIRTH_AGE, SIBLING_GAP };

export type ParentState = 'healthy' | 'ill' | 'aged' | 'gone';
export type SiblingKind = 'olderBrother' | 'olderSister' | 'youngerBrother' | 'youngerSister';
export type SpouseState = 'none' | 'partner' | 'married' | 'divorced';
export type ChildState = 'none' | 'has';

export interface ParentView {
  /** 지금 나이(사별·상한 초과면 값은 있어도 보이지 않는다) */
  age: number;
  job: Occupation;
  state: ParentState;
}

export interface SiblingView {
  kind: SiblingKind;
  /** 지금 나이 */
  age: number;
  /** 나와의 나이 차(양수, 살) */
  gap: number;
  /** 위(나이가 많음)인가 */
  older: boolean;
  /** 상한을 넘겨 살아 있다고 보지 않는다 */
  gone: boolean;
}

export interface FamilySummary {
  mother: ParentView;
  father: ParentView;
  /** 위 형제(가까운 순) 다음에 아래 동생 */
  siblings: SiblingView[];
  /** 20세 전에는 null (줄을 두지 않는다) */
  spouse: SpouseState | null;
  child: ChildState | null;
}

/** 부모 한 명의 상태 (parentGone: 사별 플래그가 켜져 있는가) */
export function parentStateOf(age: number, flags: readonly string[]): ParentState {
  if (flags.includes('parents_gone') || age > FAMILY_MAX_AGE) return 'gone';
  if (flags.includes('cared_parents')) return 'ill';
  return age >= PARENT_AGED_FROM ? 'aged' : 'healthy';
}

export function spouseStateOf(flags: readonly string[]): SpouseState {
  if (flags.includes('married')) return 'married';
  if (flags.includes('divorced')) return 'divorced';
  return flags.includes('has_partner') ? 'partner' : 'none';
}

/** 시드에서 위 형제 한 명의 (나이 차, 성별)을 정한다. 같은 시드·같은 순번 → 같은 값. */
function olderSiblingDraw(seed: number, index: number): { gap: number; gender: Gender } {
  const h = mixSeed(seed, 0x51b10000 + index);
  const span = SIBLING_GAP.max - SIBLING_GAP.min + 1;
  return { gap: SIBLING_GAP.min + (h % span), gender: (mixSeed(h, 0x2f) & 1) === 0 ? 'male' : 'female' };
}

function siblingKind(older: boolean, gender: Gender): SiblingKind {
  return older ? (gender === 'male' ? 'olderBrother' : 'olderSister') : gender === 'male' ? 'youngerBrother' : 'youngerSister';
}

/** 가족 보기. 출생 이후 단계의 상태만 받는다(character·birthReport가 있어야 한다 — 없으면 throw). */
export function familyOf(game: Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed'>): FamilySummary {
  const { character, birthReport: report } = game;
  if (character === null || report === null) throw new Error('familyOf: 출생 전 상태에는 가족이 없다');
  const age = game.age;
  const seed = game.peerSeed ?? game.seed;
  const parent = (p: { age: number; job: Occupation }): ParentView => {
    const now = parentAgeAt(p, age);
    return { age: now, job: p.job, state: parentStateOf(now, game.flags) };
  };

  const siblings: SiblingView[] = [];
  const wantedOlder = olderSiblingsOf(report.birthOrder);
  // 위 형제 전체의 나이 차 한도(R-330): 어머니가 첫 아이를 낳은 나이가 MIN_FIRST_BIRTH_AGE 이상이어야 한다
  const gapBudget = Math.max(0, report.mother.age - MIN_FIRST_BIRTH_AGE);
  // 새로 태어난 판은 생성기가 형제 순서에 맞는 어머니 나이만 만들므로 늘 wantedOlder명이다(R-330 r3). 이 방어는 옛 저장 판용이다 — 최소 간격으로도 못 들어가는 형제는 보이지 않는다
  const olderCount = Math.min(wantedOlder, olderSiblingLimit(report.mother.age));
  let cumulative = 0;
  for (let i = 0; i < olderCount; i++) {
    const d = olderSiblingDraw(seed, i);
    // 남은 형제(이 형제 포함) 각각에게 최소 간격을 남기고 나머지만 이 형제의 간격으로 쓸 수 있다 → 마지막 누적은 한도 이하, 간격은 늘 SIBLING_GAP.min 이상
    const room = gapBudget - cumulative - (olderCount - i - 1) * SIBLING_GAP.min;
    cumulative += Math.min(d.gap, room);
    const sibAge = age + cumulative;
    siblings.push({ kind: siblingKind(true, d.gender), age: sibAge, gap: cumulative, older: true, gone: sibAge > FAMILY_MAX_AGE });
  }
  const bornAt = game.seen[YOUNGER_SIBLING_EVENT];
  if (typeof bornAt === 'number' && report.birthOrder === 1) {
    const d = olderSiblingDraw(seed, 99);
    const sibAge = Math.max(0, age - bornAt);
    siblings.push({ kind: siblingKind(false, d.gender), age: sibAge, gap: bornAt, older: false, gone: sibAge > FAMILY_MAX_AGE });
  }

  const adult = age >= FAMILY_ADULT_AGE;
  return {
    mother: parent(report.mother),
    father: parent(report.father),
    siblings,
    spouse: adult ? spouseStateOf(game.flags) : null,
    child: adult ? (game.flags.includes('has_child') ? 'has' : 'none') : null,
  };
}

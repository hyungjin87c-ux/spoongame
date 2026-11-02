import type { EventPool } from './events';
import { applyFlags, applyResolved } from './apply';
import { YOUNGER_SIBLING_EVENT } from './family';
import { deriveFamilyFlags } from './familyFlags';
import {
  FAMILY_LINE_PREFIX,
  LOG_GRAND_GONE,
  LOG_PARENTS_APART,
  LOG_PARENT_GONE,
  LOG_SIB_BORN,
  LOG_SIB_LEFT,
  type FamilyData,
  type PersonId,
} from './familyModel';
import { familyScheduleOf, familyViewOf } from './familyView';
import { familyTables } from './gameData';
import { appendHistory } from './history';
import { FAMILY_LINE_ID, FAMILY_LINE_TEXT } from '../data/familyLineText';
import type { StatDeltas } from './stats';
import { R1_PRESENT, type GameState, type HistoryEntry } from './types';

/**
 * 해마다 바뀌는 가족 형편 (SPEC-009 FM4b FA7, 설계 문서 3·4-7절): 한 해 시작 상태에서 **순수 계산**으로 그 해의 변화를 모아 `FamilyChanges`로 돌려주고(`familyChangesFor`),
 * `applyFamilyChanges`가 인생 기록 줄(`fam-…`)·시스템 플래그·`family.log`·(이른 부모 별세의) 효과를 한 번에 적용한다. **진행 RNG(`rngState`)를 소비하지 않는다** — 판정은 출생 때 정한 계획(`family`)과
 * 해시(`famHash01`)뿐이다(RG7 방식).
 *
 * 시간 규칙(1-1절): 주인공 나이 `age`인 해의 변화는 그 해 `stepYear`에서 줄·로그로 남고, 보기(`familyViewOf`)에서는 `age + 1`부터 바뀌어 보인다 — 별세·이혼·독립·조부모 별세가 그렇다.
 * 아래 동생은 태어난 때 나이 `k`부터 보기에 있고 그 해(`age == k`) 줄이 남는다. 플래그는 **해 끝의 보기**(`age + 1`)로 맞춘다 — 그 해 안의 사건 후보는 해 시작의 플래그로 가려지고, 다음 해부터 새 플래그를 본다.
 *
 * 옛 저장(`lg`)은 지난 해를 소급하지 않는다: 줄·로그는 **지금 해(`age`)에 계획이 일어나는 경우만** 만들고, 지나간 변화는 보기에서 상태로만 읽힌다. 처음 열린 판의 시스템 플래그는 첫 걸음의 차이로 맞춰진다.
 */

export interface FamilyChanges {
  /** 이 해에 남길 인생 기록 줄 (id 접두어 `fam-`) — 종류 코드 오름차순 */
  lines: HistoryEntry[];
  /** 이른 부모 별세만 (4-7절 (1)): 스탯 변화와 집안 살림(만 원). 그 밖의 변화는 없다 (FA0-8) */
  effects?: { stats: StatDeltas; family: number };
  setFlags: string[];
  clearFlags: string[];
  /** `family.log`에 더할 항목 `[종류, 주인공 나이, 대상, 부가]` */
  log: number[][];
  /** 구성이 이 해에 일으키는 사건 id (K2 — 첫째의 첫 동생 반응 카드). 풀에 그 사건이 없으면 만들지 않는다 */
  forcedEvent?: string;
}

/** 이 모듈이 켜고 끄는 플래그 (나머지 시스템 플래그는 값이 없어 건드리지 않는다 — `deriveFamilyFlags` 머리글) */
const MANAGED_FLAGS: readonly string[] = [
  'has_grandparent',
  'lives_with_grandparent',
  'has_older_sibling',
  'has_younger_sibling',
  'has_sibling',
  'mother_gone',
  'father_gone',
  'mother_apart',
  'father_apart',
];

const EMPTY: FamilyChanges = { lines: [], setFlags: [], clearFlags: [], log: [] };

const entry = (age: number, eventId: string, text: string): HistoryEntry => ({ age, kind: 'event', text, eventId });

const SIB_O: readonly PersonId[] = ['o1', 'o2', 'o3', 'o4'];
const SIB_Y: readonly PersonId[] = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7'];

/**
 * 이 해(`age`, 진행 전 상태)의 가족 변화. `pool`을 주면 구성이 일으키는 사건(`forcedEvent`)이 풀에 `trigger: "family"`로 있을 때만 강제로 일으키고, 없으면(시험용 풀 · FM4b 전 풀) 동생 출생도 상태 줄로 낸다.
 * 가족 보기가 없는 상태(출생 전 · `family` 없음)는 아무 변화도 없다 — 앱은 판을 열 때 `ensureFamily`가 채운다.
 */
export function familyChangesFor(game: GameState, age: number, pool?: EventPool): FamilyChanges {
  const f = game.family;
  if (f === undefined || game.character === null || game.birthReport === null) return EMPTY;
  // 시험 전용 R1 프로필은 얼린 세계다 — 연도 축 경제 배선의 항등 스위치(`forceR1`, EY17 ②)와 같은 자리에서 가족 변화도 쓰지 않는다(얼린 스냅숏·난수 흐름이 그대로이도록)
  if (game.generation === R1_PRESENT) return EMPTY;
  const sc = familyScheduleOf(game);
  const v0 = familyViewOf(game, age);
  const v1 = familyViewOf(game, age + 1);
  const logged = (kind: number, target: number): boolean => f.l.some((e) => e[0] === kind && e[2] === target);
  const player = game.character.gender;
  const lines: Array<{ code: number; line: HistoryEntry }> = [];
  const log: number[][] = [];
  const addFlags = new Set<string>();
  let forcedEvent: string | undefined;

  const byId0 = new Map(v0.people.map((p) => [p.id, p]));
  const byId1 = new Map(v1.people.map((p) => [p.id, p]));

  // 1 동생 출생: 태어난 때 나이 `k`가 이 해이다. 첫째의 첫 동생은 반응 카드(`infant-new-sibling`)가 줄을 대신한다 (K2, 부가 1) — 풀에 그 사건이 `trigger: "family"`로 없으면(FM4b 전 풀) 상태 줄이다.
  // 상태 줄 쪽 동생은 `younger_sibling`을 더하기만 한다(K2 5, 사건이 켜던 플래그와 같은 뜻 「동생이 생긴 적 있음」) — K2를 켠 풀에서만이다(옛 풀의 사건은 옛 플래그 소유라 시스템이 건드리지 않는다)
  const k2 = pool === undefined || pool.byId.get(YOUNGER_SIBLING_EVENT)?.trigger === 'family';
  f.y.forEach((s, j) => {
    if (s.k !== age || logged(LOG_SIB_BORN, 21 + j)) return;
    const card = game.birthReport!.birthOrder === 1 && j === 0 && f.lg !== 1 && pool !== undefined && k2 && game.seen[YOUNGER_SIBLING_EVENT] === undefined;
    if (card) forcedEvent = YOUNGER_SIBLING_EVENT;
    else lines.push({ code: LOG_SIB_BORN, line: entry(age, FAMILY_LINE_ID.sibBorn, FAMILY_LINE_TEXT.sibBorn(s.g === 0 ? 'male' : 'female', j + 1)) });
    log.push([LOG_SIB_BORN, age, 21 + j, card ? 1 : 0]);
    if (k2) addFlags.add('younger_sibling');
  });

  // 2 형제 독립: 함께 살던 형제가 이 해에 독립 나이를 넘긴다 (주인공이 어른이 된 뒤 따로 사는 형제는 줄이 없다)
  for (const [ids, base] of [[SIB_O, 10], [SIB_Y, 20]] as const) {
    ids.forEach((id, i) => {
      const a = byId0.get(id);
      const b = byId1.get(id);
      if (a === undefined || b === undefined || b.independent !== true || a.independent === true || b.state === 'gone' || !v0.household.includes(id)) return;
      if (logged(LOG_SIB_LEFT, base + i + 1)) return;
      lines.push({ code: LOG_SIB_LEFT, line: entry(age, FAMILY_LINE_ID.sibLeft, FAMILY_LINE_TEXT.sibLeft(player, b.sibKind!, Math.abs(b.age - v1.age), b.older === true)) });
      log.push([LOG_SIB_LEFT, age, base + i + 1, 0]);
    });
  }

  // 4 조부모 별세 (주인공이 태어나기 전에 떠난 분은 줄이 없다)
  (['pgf', 'pgm', 'mgf', 'mgm'] as const).forEach((id, i) => {
    const a = byId0.get(id);
    const b = byId1.get(id);
    if (a === undefined || b === undefined || a.state === 'gone' || b.state !== 'gone' || logged(LOG_GRAND_GONE, 3 + i)) return;
    lines.push({ code: LOG_GRAND_GONE, line: entry(age, FAMILY_LINE_ID.grandGone, FAMILY_LINE_TEXT.grandGone(i)) });
    log.push([LOG_GRAND_GONE, age, 3 + i, 0]);
  });

  // 5 부모 한 분 별세: 먼저 떠나는 한 분만 모델이 알린다. 그 해에 기존 사건이 이미 두 분을 맡았다면(`parents_gone`) 일어나지 않는다 (K3, INV-9)
  let earlyLoss: { who: 'mother' | 'father' } | null = null;
  if (sc.firstGone !== null && sc.firstGone.at === age && !game.flags.includes('parents_gone') && !f.l.some((e) => e[0] === LOG_PARENT_GONE)) {
    const who = sc.firstGone.who === 0 ? 'mother' : 'father';
    if (byId0.get(who)?.state !== 'gone') {
      lines.push({ code: LOG_PARENT_GONE, line: entry(age, FAMILY_LINE_ID.parentGone, FAMILY_LINE_TEXT.parentGone(who)) });
      log.push([LOG_PARENT_GONE, age, sc.firstGone.who === 0 ? 1 : 2, 0]);
      earlyLoss = { who };
    }
  }

  // 6 부모 이혼·별거: 이 해에 일어나 다음 해부터 한 분이 따로 산다 (원인·책임 서술 없음)
  if (sc.divorce !== null && sc.divorce.at === age && !f.l.some((e) => e[0] === LOG_PARENTS_APART)) {
    const leaver = sc.divorce.leaver === 0 ? 'mother' : 'father';
    lines.push({ code: LOG_PARENTS_APART, line: entry(age, FAMILY_LINE_ID.parentsApart, FAMILY_LINE_TEXT.parentsApart(leaver)) });
    log.push([LOG_PARENTS_APART, age, sc.divorce.leaver === 0 ? 1 : 2, 0]);
  }

  // 플래그: 해 끝의 보기(+ 이 해에 더해지는 로그)에서 파생한 집합과 지금 플래그의 차이만 낸다 (사건이 소유한 플래그는 건드리지 않는다)
  const target = new Set([...deriveFamilyFlags(v1, [...f.l, ...log]), ...addFlags]);
  const have = new Set(game.flags);
  const setFlags = [...target].filter((x) => !have.has(x)).sort();
  const clearFlags = MANAGED_FLAGS.filter((x) => have.has(x) && !target.has(x));

  if (lines.length === 0 && setFlags.length === 0 && clearFlags.length === 0 && forcedEvent === undefined && log.length === 0) return EMPTY;
  lines.sort((a, b) => a.code - b.code);
  const out: FamilyChanges = { lines: lines.map((l) => l.line), setFlags, clearFlags, log };
  if (forcedEvent !== undefined) out.forcedEvent = forcedEvent;
  if (earlyLoss !== null) {
    const effects = earlyLossEffects(game, f, age, earlyLoss.who);
    if (effects !== null) out.effects = effects;
  }
  return out;
}

/** 이른 부모 별세 효과 (4-7절 (1), FA0-8 예외): 주인공 `maxAge` 이하에 한 분이 떠나는 해에만. 20세 이상·끈 상태(`enabled: false`)면 기록 전용(null) */
function earlyLossEffects(game: GameState, f: FamilyData, age: number, who: 'mother' | 'father'): { stats: StatDeltas; family: number } | null {
  const rule = familyTables().design.earlyLoss.value;
  if (!rule.enabled || age > rule.maxAge || game.character === null) return null;
  const base = who === 'father' ? rule.family.father : f.p[0].w === 1 ? rule.family.motherHomemaker : rule.family.mother;
  const family = Math.round(base * rule.wealthMultiplier[game.character.parentWealth - 1]);
  return { stats: { ...rule.stats }, family };
}

/**
 * `familyChangesFor`의 결과를 판에 적용한다: 이른 별세 효과(스탯·집안 살림) → 플래그 → 인생 기록 줄(마일스톤 줄 뒤, 일반 사건 줄 앞이 되도록 `stepYear`가 이 자리에서 부른다) → `family.log`.
 * 효과는 사건 효과와 **같은 경로**(`applyResolved`)로 적용한다. 효과가 없고 플래그만 바뀌면 자산·스탯 계산을 거치지 않는다.
 */
export function applyFamilyChanges(game: GameState, c: FamilyChanges): GameState {
  if (c.lines.length === 0 && c.setFlags.length === 0 && c.clearFlags.length === 0 && c.log.length === 0) return game;
  let s: GameState = game;
  if (c.effects !== undefined) {
    s = applyResolved(s, { stats: c.effects.stats, assets: { net: 0, income: 0, debt: 0 }, family: c.effects.family, setFlags: c.setFlags, clearFlags: c.clearFlags });
  } else if (c.setFlags.length > 0 || c.clearFlags.length > 0) {
    s = { ...s, flags: applyFlags(s.flags, c.setFlags, c.clearFlags) };
  }
  let history = s.history;
  for (const line of c.lines) history = appendHistory(history, line);
  const family = s.family === undefined || c.log.length === 0 ? s.family : { ...s.family, l: [...s.family.l, ...c.log] };
  return { ...s, history, ...(family !== undefined ? { family } : {}) };
}

/** `fam-` 줄인가 (`eventId` 접두어) */
export const isFamilyLine = (h: Pick<HistoryEntry, 'eventId'>): boolean => h.eventId?.startsWith(FAMILY_LINE_PREFIX) === true;

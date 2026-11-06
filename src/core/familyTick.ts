import type { EventPool } from './events';
import { applyFlags, applyResolved } from './apply';
import { YOUNGER_SIBLING_EVENT } from './family';
import { POST_EVENT_FLAGS, deriveFamilyFlags } from './familyFlags';
import {
  EARLY_LOSS_MAX_AGE,
  FAMILY_LINE_PREFIX,
  LOG_GRAND_GONE,
  LOG_PARENTS_APART,
  LOG_PARENT_GONE,
  LOG_SIB_BORN,
  LOG_SIB_LEFT,
  LOG_SIB_LOST,
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

  // 3 어린 형제의 이른 별세 (Q3, FM7a — 안 B: 해시 계획 + 줄 문구 함수): 이 해(`at`)에 계획된 형제가 해 끝의 보기에서 떠난 사람이다. 문장의 호칭은 주인공 성별과 그 형제의 종류, 숫자는 그 형제의 별세 나이다.
  // 스탯·자산 효과는 없다(기록 전용, FA0-8). 계획이 없는 판(1970년 이후 출생·옛 저장 스냅샷·끈 판)은 `sc.siblingLoss`가 null이다.
  const loss = sc.siblingLoss;
  if (loss !== null && loss.at === age) {
    const a = byId0.get(loss.id);
    const b = byId1.get(loss.id);
    const target = (loss.id.startsWith('o') ? 10 : 20) + Number(loss.id.slice(1));
    if (a !== undefined && b !== undefined && a.state !== 'gone' && b.state === 'gone' && b.sibKind !== undefined && !logged(LOG_SIB_LOST, target)) {
      lines.push({ code: LOG_SIB_LOST, line: entry(age, FAMILY_LINE_ID.sibLost, FAMILY_LINE_TEXT.sibLost(player, b.sibKind, b.goneAtOwnAge ?? loss.a)) });
      log.push([LOG_SIB_LOST, age, target, loss.a]);
    }
  }

  // 4 조부모 별세 (주인공이 태어나기 전에 떠난 분은 줄이 없다). 문장의 별세 나이는 카드의 「N세에 세상을 떠남」과 같은 값(보기의 `goneAtOwnAge`)이고, 함께 살던 분(떠나기 직전 `with`)이면 그 사실을 덧붙인다 (T03·T04)
  (['pgf', 'pgm', 'mgf', 'mgm'] as const).forEach((id, i) => {
    const a = byId0.get(id);
    const b = byId1.get(id);
    if (a === undefined || b === undefined || a.state === 'gone' || b.state !== 'gone' || logged(LOG_GRAND_GONE, 3 + i)) return;
    lines.push({ code: LOG_GRAND_GONE, line: entry(age, FAMILY_LINE_ID.grandGone, FAMILY_LINE_TEXT.grandGone(i, b.goneAtOwnAge ?? f.g[i].d, a.state === 'with')) });
    log.push([LOG_GRAND_GONE, age, 3 + i, 0]);
  });

  // 5 부모 한 분 별세: 먼저 떠나는 한 분만 모델이 알린다. 그 해에 기존 사건이 이미 두 분을 맡았다면(`parents_gone`) 일어나지 않는다 (K3, INV-9)
  let earlyLoss: { who: 'mother' | 'father' } | null = null;
  if (sc.firstGone !== null && sc.firstGone.at === age && !game.flags.includes('parents_gone') && !f.l.some((e) => e[0] === LOG_PARENT_GONE)) {
    const who = sc.firstGone.who === 0 ? 'mother' : 'father';
    if (byId0.get(who)?.state !== 'gone') {
      // 별세 나이 N은 카드의 「N세에 세상을 떠남」과 같은 값(보기의 `goneAtOwnAge` = 저장된 `d`)이고, 주인공 19세 이하(`EARLY_LOSS_MAX_AGE`)일 때만 아이가 본 것 한 줄이 붙는다 (T01·T02, R-618)
      lines.push({ code: LOG_PARENT_GONE, line: entry(age, FAMILY_LINE_ID.parentGone, FAMILY_LINE_TEXT.parentGone(who, byId1.get(who)?.goneAtOwnAge ?? f.p[sc.firstGone.who].d, age <= EARLY_LOSS_MAX_AGE)) });
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
  // `lives_with_child`는 해 끝 규칙이 맞춘다(`syncPostEventFlags` — 사건이 켜는 `has_child`·`child_left`를 읽으므로 해 시작 상태로는 한 해 늦다)
  const target = new Set([...[...deriveFamilyFlags(v1, [...f.l, ...log])].filter((x) => !POST_EVENT_FLAGS.includes(x)), ...addFlags]);
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

/**
 * 한 해의 사건 효과가 끝난 뒤 파생 플래그(`POST_EVENT_FLAGS` — `lives_with_child`, R-586)를 맞춘다. `at`은 보는 나이(보통 해가 끝나 오른 나이 `game.age`, 사망 걸음은 `age + 1`).
 * `finishYear`가 한 해의 모든 경로(서술·선택·마일스톤 뒤)에서 부르므로 **해마다 `flags ∩ SYSTEM = derive(view, log)`**(INV-7)가 한 해 늦지 않는다. 난수를 쓰지 않는 순수 계산이고, 구형 저장(플래그 없음)은 첫 해 끝에 채워진다.
 * 가족이 없는 상태(출생 전·옛 시험 상태)와 시험 전용 R1 프로필은 건드리지 않는다.
 */
export function syncPostEventFlags(game: GameState, at: number = game.age): GameState {
  if (game.family === undefined || game.character === null || game.birthReport === null || game.generation === R1_PRESENT) return game;
  const want = deriveFamilyFlags(familyViewOf(game, at), game.family.l);
  const set = POST_EVENT_FLAGS.filter((x) => want.has(x) && !game.flags.includes(x));
  const clear = POST_EVENT_FLAGS.filter((x) => !want.has(x) && game.flags.includes(x));
  return set.length === 0 && clear.length === 0 ? game : { ...game, flags: applyFlags(game.flags, set, clear) };
}

/**
 * 부모 한 분 별세 줄이 난 해의 후보 정리 규칙 (FM7a R-561 + 마스터 결정 후속 199 — 「켜진 해부터」는 별세 줄이 난 그 해를 포함한다):
 *  - `'exclude'` — **지금 판이 쓰는 규칙**이다. 별세 줄이 난 해에는 ① `parents_gone`을 켜는 사건(원본·변형, R-561 — 같은 해에 「어머니가 …」 다음 「부모님이 …」이 이어지는 두 번째 별세를 막는다)과
 *    ② **그 한 분의 플래그(`mother_gone`·`father_gone`)를 `notFlags`로 읽는 사건**(병환·임종 원본, 「아빠/엄마」 낱말이 든 어린 시절 사건 — 별세 줄 뒤에 같은 해 안에서 나오지 않는다)을 후보에서 뺀다.
 *    ②는 한 방향만이다: 그 플래그를 요구하는 사건(변형)은 그 해에 새로 뽑히지 않는다(해 시작 상태 그대로). 빼는 방식은 모두 후보 목록만 줄고 추첨 칸 수는 그대로다(`life.ts#stepYear`의 `draw`).
 *  - `'setters'` ①만 한다 — R-561만 켠 중간 세계. **재측정 전용**(`scripts/familyRemeasure.ts`가 ②의 효과를 따로 잰다).
 *  - `'legacy'` 아무것도 빼지 않는다 — 켜기 전의 규칙. **측정·시험 전용**: 해시 불변 L1 시험(`tests/familyHash.test.ts`)과 재측정이 `withGoneYearRule('legacy', …)`로 옛 세계를 만든다.
 */
export type GoneYearRule = 'legacy' | 'setters' | 'exclude';
export const GONE_YEAR_RULE: GoneYearRule = 'exclude';
let activeGoneYearRule: GoneYearRule = GONE_YEAR_RULE;

/** 측정·시험 전용: `fn` 동안만 별세 해 후보 정리 규칙을 바꾼다(끝나면 되돌린다) */
export function withGoneYearRule<T>(rule: GoneYearRule, fn: () => T): T {
  const before = activeGoneYearRule;
  activeGoneYearRule = rule;
  try {
    return fn();
  } finally {
    activeGoneYearRule = before;
  }
}

/** 지금 쓰는 별세 해 후보 정리 규칙 (`life.ts#stepYear`가 읽는다) */
export const goneYearRuleNow = (): GoneYearRule => activeGoneYearRule;

/** `fam-` 줄인가 (`eventId` 접두어) */
export const isFamilyLine = (h: Pick<HistoryEntry, 'eventId'>): boolean => h.eventId?.startsWith(FAMILY_LINE_PREFIX) === true;

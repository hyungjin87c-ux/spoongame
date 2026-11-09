import {
  GENERATION_IDS,
  autoResolveStep,
  condContextOf,
  countTick,
  emptyCounts,
  estimatePlaySeconds,
  familyChangesFor,
  flagsAfterLine,
  inheritanceAmount,
  lineClearedFlags,
  meetsCondition,
  reviewEnding,
  siblingCountOf,
  stepYear,
  timingEraOfProfile,
  withGoneYearRule,
  withParentsGoneRule,
  withSiblingCountRule,
  yearLineCount,
  type EndingGame,
  type EventPool,
  type GameState,
  type GoneYearRule,
  type ParentsGoneRule,
  type ProfileId,
  type SiblingCountRule,
  type TickCounts,
} from '../src/core';
import { eventPool } from '../src/core';
import { EARLY_LOSS_HALF, withEarlyLoss, withEarlyLossRule, withSiblingLoss } from './familyRulesLib';
import { fm7aSeniorPool, fm7aShippedPool, fm7aVariantsPool, k2OnlyPool, preFm4bPool, preFm7aPool } from './preFm4bPool';
import { MARGIN_LINES, marginSeeds, meanSe } from './marginsLib';
import { SENIOR_CHOICE_MEAN_MIN } from '../src/data/timingTable';
import { simulateLife, startLife } from './simulateLib';
import { spreadSeeds } from '../tests/helpers/familyGolden';

/**
 * 가족 변경(SPEC-009 FM4b)의 분포 재측정 (설계 문서 12-1절 L2, 4-7절 (1) 합격 기준, 7-1절 K1): 같은 시드의 같은 판을 **원인별로 하나씩 켠 세계**에서 돌려 나란히 잰다.
 *   V0 FM4a 기준(FM4b 전 영유아·학창 이벤트 · 이른 별세 효과 끔 · 형제 수 옛 규칙)
 *   V1 + K2(동생 반응 카드를 구성이 정한 해에 강제)
 *   V2 + K4(가족 낱말 사건에 가족 조건 — 지금의 풀)
 *   V3 + 이른 부모 별세 효과 (K1·R-562를 켜기 전 값 — 옛 형제 수 규칙 · 옛 「두 분 모두 떠남」 규칙)
 *   V4 + K1(형제 수 새 정의로 상속) — 형진 님 결정 「실제 형제 수로 나누기」 (FM6에서 켰다)
 *   V5 + R-562(상속·월세 전환이 가족 보기의 「두 분 모두 떠남」과 같은 해에) ← FM6 배포 값 (FM6 판단, 8.1%의 판에서 평균 3.5년 늦던 것) — 이 아래 V2~V5의 청년·중년·노년 이벤트는 FM7a 전 원문이다
 *   V6 + 「남은 한 분」 변형 사건 4개 · 원본의 한 분 별세 제외 조건 (FM7a, R-564 — 같은 해 겹침 정리 전)
 *   V7 + R-561(한 분 별세 줄이 난 해에 parents_gone을 켜는 사건을 후보에서 뺀다 — `GoneYearRule` 'setters')
 *   V8 + 별세 해 notFlags 규칙(후속 199 — 그 해 별세한 한 분의 mother_gone·father_gone을 notFlags로 읽는 사건도 후보에서 뺀다 — 'notflags')
 *   V9 + R-631·R-632(가족 줄이 난 해: 형제·조부모 별세 줄 뒤 꺼지는 형제·조부모 플래그를 요구하는 사건을 빼고, 형제·조부모·부모 한 분 별세 줄이 난 해의 보이는 선택지를 해 시작 ctx ∩ 줄 뒤 ctx로 줄인다 — 'exclude')
 *   V10 + R-586(senior-alone이 함께 사는 자녀가 있는 판을 거른다 — 자녀 독립 나이·lives_with_child는 표시 전용이라 경제에는 이 사건 조건만 닿는다)
 *   V11 + Q3(어린 형제의 이른 별세 — 상속의 형제 수) · 청년 「본가」 문장 ← FM7a 배포 값 (지금 풀에서 조르기 사건만 뺀 것)
 *   V12 + 어린 시절 조르기(SPEC-011 AK10 — 4~12세 조르기 7사건이 본인 카드로 더해진 지금 풀, 반려동물은 꺼짐)
 * R-618(별세·이혼 하한 1세)은 코드 상수라 모든 세계(V0~V12)에 같이 들어 있다 — 원인을 따로 가르지 않는다. 같은 시드·같은 선택 전략(자동 성향)이라 변이 사이의 차이는 켠 원인에서만 온다(짝지은 표본). 실행: `npm run report:family` (docs/data/family-remeasure.md를 쓴다).
 */

export interface Variant {
  id: 'V0' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'V11' | 'V12' | 'V3h';
  label: string;
  pool: () => EventPool;
  /** true 배포 값 · false 끔 · 'half' 효과 절반(측정용 대안) */
  earlyLoss: boolean | 'half';
  rule: SiblingCountRule;
  /** 「두 분 모두 떠남」 규칙 (R-562) */
  goneRule: ParentsGoneRule;
  /** 별세 해 후보 정리: legacy 안 뺀다 · setters R-561만 · notflags R-561 + 한 분 플래그를 notFlags로 읽는 사건 · exclude 거기에 형제·조부모 줄 해의 후보·선택지 정리(R-631·R-632) (FM7a) */
  goneYear: GoneYearRule;
  /** 어린 형제의 이른 별세 계획(Q3)을 켜는가 (FM7a) */
  sibLoss: boolean;
}

export const VARIANTS: readonly Variant[] = [
  { id: 'V0', label: 'FM4a 기준 (FM4b 전 풀 · 효과 끔 · 옛 규칙)', pool: preFm4bPool, earlyLoss: false, rule: 'legacy', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
  { id: 'V1', label: '+ K2 (동생 반응 카드 강제)', pool: k2OnlyPool, earlyLoss: false, rule: 'legacy', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
  { id: 'V2', label: '+ K4 (가족 낱말 사건에 가족 조건)', pool: preFm7aPool, earlyLoss: false, rule: 'legacy', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
  { id: 'V3', label: '+ 이른 부모 별세 효과 (K1·R-562를 켜기 전 값)', pool: preFm7aPool, earlyLoss: true, rule: 'legacy', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
  { id: 'V4', label: '+ K1 켜기 (형제 수 새 정의로 상속)', pool: preFm7aPool, earlyLoss: true, rule: 'view', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
  { id: 'V5', label: '+ R-562 (「두 분 모두 떠남」을 가족 보기와 같게) ← FM6 배포 값', pool: preFm7aPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'legacy', sibLoss: false },
  { id: 'V6', label: '+ 「남은 한 분」 변형 사건 4개 (FM7a, 같은 해 겹침 정리 전)', pool: fm7aVariantsPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'legacy', sibLoss: false },
  { id: 'V7', label: '+ R-561 (한 분 별세 줄이 난 해의 후보에서 parents_gone 사건을 뺀다)', pool: fm7aVariantsPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'setters', sibLoss: false },
  { id: 'V8', label: '+ 별세 해 notFlags 규칙 (그 해 별세한 한 분의 플래그를 notFlags로 읽는 사건도 뺀다 — 후속 199)', pool: fm7aVariantsPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'notflags', sibLoss: false },
  { id: 'V9', label: '+ R-631·R-632 (가족 줄이 난 해: 꺼지는 플래그를 요구하는 사건 · 안 보일 선택지를 뺀다)', pool: fm7aVariantsPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'exclude', sibLoss: false },
  { id: 'V10', label: '+ R-586 (senior-alone이 함께 사는 자녀가 있는 판을 거른다)', pool: fm7aSeniorPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'exclude', sibLoss: false },
  { id: 'V11', label: '+ Q3 (어린 형제의 이른 별세) · 「본가」 ← FM7a 배포 값', pool: fm7aShippedPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'exclude', sibLoss: true },
  { id: 'V12', label: '+ 어린 시절 조르기 (SPEC-011 — 4~12세 조르기 7사건)', pool: eventPool, earlyLoss: true, rule: 'view', goneRule: 'view', goneYear: 'exclude', sibLoss: true },
  { id: 'V3h', label: '(대안) 이른 별세 효과를 절반으로', pool: preFm7aPool, earlyLoss: 'half', rule: 'legacy', goneRule: 'legacy', goneYear: 'legacy', sibLoss: false },
];

export interface LifeRow {
  gen: ProfileId;
  seed: number;
  tier: number;
  /** 20세 독립 직후 순자산(만 원), 20세 전에 끝난 판은 null */
  net20: number | null;
  /** 판이 끝났을 때 순자산(만 원), 20세 전에 끝난 판은 null */
  finalNet: number | null;
  /** 엔딩 방향 판정(up·same·down), 스무 살 전에 끝나면 early */
  movement: 'up' | 'same' | 'down' | 'early';
  deathAge: number;
  /** 19세 이하에 부모 한 분이 떠났는가(이른 별세 효과 대상) */
  earlyLoss: boolean;
  /** 끝난 판의 형제 수: 옛 규칙 · 새 정의 */
  siblingsLegacy: number;
  siblingsView: number;
  /** 상속액(만 원): 두 규칙으로 계산한 값 */
  inheritLegacy: number;
  inheritView: number;
  /** 가족 변화 줄 수(fam-) */
  famLines: number;
  /** 한 판 추정 시간(초, 1배속 수동·읽는 시간 중앙): 가족 줄 포함 · 뺀 값 */
  seconds1x: number;
  seconds1xNoFam: number;
  /** 이 판의 최종 인생 기록 줄 수 */
  historyLength: number;
  /** 모형이 알린 부모 한 분 별세의 주인공 나이(`family.log` 종류 5), 없으면 null */
  lossAge: number | null;
  /** 성인기 「부모님」 사건·글감이 일어난 나이(`seen`), 안 일어났으면 null — `ADULT_PARENT_IDS` 순서 */
  adultParent: Array<number | null>;
  /** FM7a: 「남은 한 분」 변형 사건 4개가 일어난 나이(`FM7A_VARIANT_IDS` 순서, 안 일어났으면 null) */
  variantSeen: Array<number | null>;
  /** FM7a: 임종 사건(원본 또는 변형)이 일어난 나이 — 없으면 null */
  farewellAge: number | null;
  /** FM7a: 한 분 별세 줄이 난 해에 임종 사건도 같은 해에 일어났는가 (R-561이 막는 겹침) */
  sameYearGone: boolean;
  /** FM7a: 병환 원본과 그 변형이 한 판에 둘 다 일어났는가 (같은 인용 c-081을 두 번 보는 판 — P5) */
  careBoth: boolean;
  /** FM7a: 어린 형제의 이른 별세 줄이 난 판(family.log 종류 3) */
  siblingLost: boolean;
  /** FM7a: senior-alone이 일어난 판 */
  seniorAlone: boolean;
  /** 본 사건 전체(`seen`)의 짧은 해시 — 두 세계의 같은 시드 판이 달라졌는지 가른다 */
  seenSig: string;
  /** 인생 기록(연표: 나이·사건·고른 선택지)의 짧은 해시 — 같은 사건에서 보이는 선택지만 달라진 판까지 가른다 (R-632) */
  histSig: string;
  /** R-631: 형제·조부모 줄이 난 해에 그 줄 뒤 꺼지는 플래그를 요구하는 사건(마일스톤 포함)이 같은 해에 일어난 사건 id들 (규칙이 있으면 비어 있어야 한다) */
  sameYearCleared: string[];
  /** R-632: 가족 줄이 난 해에 줄 뒤 ctx로는 안 보이는 선택지가 골라진 「사건/선택지」들 (규칙이 있으면 비어 있어야 한다) · 점검한 선택 수 */
  lineChoiceBad: string[];
  lineChoiceN: number;
  /** R-631: 꺼진 플래그를 요구하는 사건 4개가 일어난 나이(`CLEARED_READER_IDS` 순서) */
  clearedSeen: Array<number | null>;
  /** FM7a(후속 199): 사건 수준 notFlags가 mother_gone·father_gone을 읽는 사건 5개가 일어난 나이(`GONE_READER_IDS` 순서) */
  readerSeen: Array<number | null>;
}

/** 성인기에 「부모님」 낱말이 나오는 사건·글감 (설계 문서 13-2절 FM7 변형 목록 — 원본 기준. FM7a 뒤 youth-housing·note-parents-aging은 문장이 중립이거나 변형이 맡는다) */
export const ADULT_PARENT_IDS = ['middle-parents-care', 'middle-parents-farewell', 'youth-housing', 'note-parents-aging'] as const;
/** 사건 수준 `conditions.notFlags`가 mother_gone·father_gone을 읽는 사건 5개: 어린 시절 셋(「아빠/엄마」 낱말) + 병환·임종 원본 (tests/familyFm7a.test.ts가 풀과 같음을 지킨다) */
export const GONE_READER_IDS = ['infant-care', 'infant-neglect-night', 'school-early-work', 'middle-parents-care', 'middle-parents-farewell'] as const;
/** 사건 수준 `conditions.flags`가 형제·조부모 플래그(`SIBLING_LINE_FLAGS`·`GRANDPARENT_LINE_FLAGS`)를 요구하는 사건 4개 (tests/familyFm7a.test.ts가 풀과 같음을 지킨다 — 형제 셋 + 조부모 노래) */
export const CLEARED_READER_IDS = ['infant-follow-sibling', 'infant-sibling-toy', 'school-family-priority', 'infant-grandparent-song'] as const;
/** FM7a 「남은 한 분」 변형 사건 4개 (병환 · 임종 × 어머니가 먼저 떠난 판 · 아버지가 먼저 떠난 판) */
export const FM7A_VARIANT_IDS = ['middle-parents-care-mother-gone', 'middle-parents-care-father-gone', 'middle-parents-farewell-mother-gone', 'middle-parents-farewell-father-gone'] as const;

/** 줄을 연표 줄과 같은 규칙으로 센다(FA0-7)는 약속에서 가족 줄을 뺀 추정 시간 — 가족 줄만 있는 해는 서술 해에서 조용한 해로, 다른 줄이 있는 해는 줄 대기를 뺀다 */
function secondsWithoutFamily(final: GameState, counts: TickCounts, era: ReturnType<typeof timingEraOfProfile>): number {
  const c: TickCounts = { ...counts };
  const ages = new Set(final.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => h.age));
  for (const age of ages) {
    const fam = final.history.filter((h) => h.age === age && (h.eventId ?? '').startsWith('fam-')).length;
    const all = yearLineCount(final.history, age);
    if (all > fam) c.extraLines -= fam; // 다른 줄이 있는 해: 줄 대기만 줄어든다
    else {
      // 가족 줄만 있는 해: 서술 해 하나가 조용한 해로 (줄이 둘 이상이면 그 둘째 줄부터의 대기도 뺀다)
      c.narrative = Math.max(0, c.narrative - 1);
      c.quiet += 1;
      c.extraLines -= Math.max(0, fam - 1);
    }
  }
  c.extraLines = Math.max(0, c.extraLines);
  return estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, final.lifeLength, era, 'median');
}

/** 한 변이의 한 판: `playToEnd`와 같은 걸음(자동 성향)으로 돌리며 20세 순자산·걸음 집계를 함께 센다 */
export function runLife(v: Variant, gen: ProfileId, seed: number): LifeRow {
  const run = <T>(fn: () => T): T => (v.earlyLoss === 'half' ? withEarlyLoss(true, () => withEarlyLossRule(EARLY_LOSS_HALF, fn)) : withEarlyLoss(v.earlyLoss, fn));
  return run(() =>
    withGoneYearRule(v.goneYear, () => withSiblingLoss(v.sibLoss, () => withSiblingCountRule(v.rule, () => withParentsGoneRule(v.goneRule, () => {
      const pool = v.pool();
      let s: GameState = startLife(seed, gen);
      let net20: number | null = null;
      const counts = emptyCounts();
      const sameYearCleared: string[] = [];
      const lineChoiceBad: string[] = [];
      let lineChoiceN = 0;
      for (let g = 0; s.phase === 'life' && g < 400; g++) {
        let r;
        if (s.pending !== null) r = autoResolveStep(s, s.pending.key, pool);
        else {
          // 가족 줄이 난 해(형제·마지막 조부모·부모 한 분)에 줄 뒤 플래그와 그 해 일어난 사건·고른 선택지를 견준다 — 규칙 유무와 상관없이 같은 방식으로 센다 (R-631·R-632)
          const fam = familyChangesFor(s, s.age, pool);
          const after = flagsAfterLine(new Set(s.flags), fam);
          const cleared = lineClearedFlags(fam);
          const ctx0 = condContextOf(s);
          r = stepYear(s, pool);
          if (after !== null) {
            const lineCtx = { ...ctx0, flags: after };
            for (const id of [r.tick.eventId, ...(r.tick.milestoneIds ?? [])]) {
              if (id !== undefined && (pool.byId.get(id)?.conditions?.flags ?? []).some((f) => cleared.includes(f)) && !sameYearCleared.includes(id)) sameYearCleared.push(id);
            }
            const pick = r.state.pending !== null ? { eventId: r.state.pending.eventId, ids: r.state.pending.choiceIds } : r.tick.choiceId !== undefined && r.tick.eventId !== undefined ? { eventId: r.tick.eventId, ids: [r.tick.choiceId] } : null;
            if (pick !== null) {
              const def = pool.byId.get(pick.eventId);
              for (const cid of pick.ids) {
                const ch = def?.choices?.find((c) => c.id === cid);
                if (ch === undefined) continue;
                lineChoiceN++;
                if (!meetsCondition(ch.requires, lineCtx)) lineChoiceBad.push(`${pick.eventId}/${cid}`);
              }
            }
          }
        }
        s = r.state;
        countTick(counts, r.tick, s.lifeLength);
        if (net20 === null && s.assets !== null && s.age >= 20) net20 = s.assets.net;
      }
      if (s.phase !== 'ending' || s.death === null) throw new Error(`${gen}/${seed}: 사망에 도달하지 못했다`);
      const tier = s.character!.parentWealth;
      const review = reviewEnding(s as EndingGame);
      const movement = review.journey.kind === 'compared' ? review.journey.movement : 'early';
      const reached = s.death.age >= 20 && s.assets !== null;
      const era = timingEraOfProfile(gen);
      const legacy = siblingCountOf(s, 'legacy');
      const view = siblingCountOf(s, 'view');
      return {
        gen,
        seed,
        tier,
        net20,
        finalNet: reached ? s.assets!.net : null,
        movement,
        deathAge: s.death.age,
        earlyLoss: s.family!.l.some((e) => e[0] === 5 && e[1] <= 19),
        siblingsLegacy: legacy,
        siblingsView: view,
        inheritLegacy: inheritanceAmount(tier, legacy),
        inheritView: inheritanceAmount(tier, view),
        famLines: s.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).length,
        seconds1x: estimatePlaySeconds(counts, { speed: 1, skipToDecision: false }, s.lifeLength, era, 'median'),
        seconds1xNoFam: secondsWithoutFamily(s, counts, era),
        historyLength: s.history.length,
        lossAge: s.family!.l.find((e) => e[0] === 5)?.[1] ?? null,
        adultParent: ADULT_PARENT_IDS.map((id) => s.seen[id] ?? null),
        variantSeen: FM7A_VARIANT_IDS.map((id) => s.seen[id] ?? null),
        farewellAge: farewellAgeOf(s),
        sameYearGone: s.family!.l.some((e) => e[0] === 5 && e[1] === farewellAgeOf(s)),
        careBoth: s.seen['middle-parents-care'] !== undefined && (s.seen['middle-parents-care-mother-gone'] !== undefined || s.seen['middle-parents-care-father-gone'] !== undefined),
        siblingLost: s.family!.l.some((e) => e[0] === 3),
        seniorAlone: s.seen['senior-alone'] !== undefined,
        seenSig: seenSigOf(s),
        histSig: histSigOf(s),
        sameYearCleared,
        lineChoiceBad,
        lineChoiceN,
        clearedSeen: CLEARED_READER_IDS.map((id) => s.seen[id] ?? null),
        readerSeen: GONE_READER_IDS.map((id) => s.seen[id] ?? null),
      };
    })))),
  );
}

/** 문자열의 FNV-1a 해시 */
function fnv(t: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

/** 본 사건 전체의 해시 */
function seenSigOf(s: GameState): string {
  return fnv(JSON.stringify(Object.entries(s.seen).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))));
}

/** 인생 기록(나이·사건·고른 선택지)의 해시 */
function histSigOf(s: GameState): string {
  return fnv(JSON.stringify(s.history.map((h) => [h.age, h.eventId ?? h.kind, h.choice ?? ''])));
}

/** 임종 사건(원본 또는 변형)이 일어난 나이 */
function farewellAgeOf(s: GameState): number | null {
  const ages = ['middle-parents-farewell', 'middle-parents-farewell-mother-gone', 'middle-parents-farewell-father-gone'].map((id) => s.seen[id]).filter((a): a is number => typeof a === 'number');
  return ages.length === 0 ? null : Math.min(...ages);
}

export interface TierStats {
  n: number;
  medianNet20: number;
  medianFinalNet: number;
  meanNet20: number;
  meanFinalNet: number;
  nFinal: number;
  movement: { up: number; same: number; down: number; early: number };
}

export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export function tierStats(rows: readonly LifeRow[], tier: number): TierStats {
  const t = rows.filter((r) => r.tier === tier);
  const m = { up: 0, same: 0, down: 0, early: 0 };
  for (const r of t) m[r.movement]++;
  return {
    n: t.length,
    medianNet20: median(t.filter((r) => r.net20 !== null).map((r) => r.net20!)),
    medianFinalNet: median(t.filter((r) => r.finalNet !== null).map((r) => r.finalNet!)),
    meanNet20: mean(t.filter((r) => r.net20 !== null).map((r) => r.net20!)),
    meanFinalNet: mean(t.filter((r) => r.finalNet !== null).map((r) => r.finalNet!)),
    nFinal: t.filter((r) => r.finalNet !== null).length,
    movement: m,
  };
}

/** 한 변이를 7세대 × `perGen`판 돌린다 (세대마다 다른 시드 열) */
export function measureVariant(v: Variant, perGen: number): LifeRow[] {
  const rows: LifeRow[] = [];
  GENERATION_IDS.forEach((gen, gi) => {
    for (const seed of spreadSeeds(perGen, gi)) rows.push(runLife(v, gen, seed));
  });
  return rows;
}

export const GEN_LIST = GENERATION_IDS;

// ---------- 알파 노년 결정 카드 평균 (R-555) ----------

/**
 * 알파 노년(65세+) 결정 카드 평균의 세계별 측정 (FM4b 검수 R-555): `tests/judgeMargins.test.ts`의 알파 한계(−2.5 SE)와 `tests/simulation.test.ts`의 잡음 0.05가 **무엇 때문에** 움직였는지 가른다.
 *   S0 FM4b 전 풀(V0 세계: 동생 반응 카드가 옛 추첨 사건, 가족 조건 없음) · 효과 끔
 *   S2 지금 풀(K2·K4) · 효과 끔 (V2 세계)
 *   S3 지금 풀 · 효과 켬 (배포 값, V3 세계)
 * 표본은 둘이다: **판정 표본**(합친 4줄 — `MARGIN_LINES`, 줄마다 1000판, 판정이 보는 4000판)과 **독립 줄**(시험 시드 줄 `i × 7919 + 13`의 i = 1001~4000, 수동·자동 — 판정 표본과 겹치지 않는다, SPEC-005 QI5 때와 같은 방식).
 * 세계 사이 차이는 같은 시드끼리 짝지어(판마다 차이) 표준오차를 낸다. 독립 줄에서도 같은 크기·같은 방향으로 움직이면 잡음이 아니라 **구조적 이동**이다.
 */
export interface SeniorWorld {
  id: 'S0' | 'S2' | 'S3';
  label: string;
  pool: () => EventPool;
  earlyLoss: boolean;
}

/** 노년 카드 세계는 모두 FM7a **전**이다(R-555는 K2·K4·이른 별세 효과의 이동을 가르는 표 — FM7a의 이동은 9절이 보고한다) */
export const SENIOR_WORLDS: readonly SeniorWorld[] = [
  { id: 'S0', label: 'FM4b 전 풀 · 효과 끔', pool: preFm4bPool, earlyLoss: false },
  { id: 'S2', label: 'FM7a 전 풀(K2·K4) · 효과 끔', pool: preFm7aPool, earlyLoss: false },
  { id: 'S3', label: 'FM7a 전 풀 · 효과 켬 (FM6 배포 값)', pool: preFm7aPool, earlyLoss: true },
];

/** 판정 표본 한 줄 1000판 · 독립 줄 시드 번호 구간 */
export const SENIOR_LINE_LIVES = 1000;
export const SENIOR_INDEPENDENT = { from: 1001, to: 4000 } as const;
/** 알파의 노년 카드 평균 하한 (마스터 결정 M-3, 옛 「다가올 세상」 구간) */
export const SENIOR_FLOOR = SENIOR_CHOICE_MEAN_MIN[timingEraOfProfile('alpha')];

export interface SeniorSample {
  id: 'judged' | 'independent';
  label: string;
  /** 판 순서가 세계 사이에 같다 — 짝지은 차이를 낸다 */
  seeds: Array<{ seed: number; strategy: 'auto' | 'random' }>;
}

export function seniorSamples(): SeniorSample[] {
  const judged = MARGIN_LINES.flatMap((line) => marginSeeds(line, 'alpha', SENIOR_LINE_LIVES).map((seed) => ({ seed, strategy: line.strategy })));
  const indep = (['random', 'auto'] as const).flatMap((strategy) =>
    Array.from({ length: SENIOR_INDEPENDENT.to - SENIOR_INDEPENDENT.from + 1 }, (_, k) => ({ seed: (SENIOR_INDEPENDENT.from + k) * 7919 + 13, strategy })),
  );
  return [
    { id: 'judged', label: '판정 표본 (합친 4줄 × 1000판)', seeds: judged },
    { id: 'independent', label: `독립 줄 (시험 시드 줄 i = ${SENIOR_INDEPENDENT.from}~${SENIOR_INDEPENDENT.to}, 수동·자동)`, seeds: indep },
  ];
}

/** 한 세계에서 알파 판마다의 노년 결정 카드 수 */
export function seniorCards(world: SeniorWorld, sample: SeniorSample): number[] {
  return withGoneYearRule('legacy', () =>
    withSiblingLoss(false, () =>
      withEarlyLoss(world.earlyLoss, () => {
        const pool = world.pool();
        return sample.seeds.map((s) => simulateLife(s.seed, 'alpha', s.strategy, pool, { lifeLength: 'short30' }).choicesByStage.senior);
      }),
    ),
  );
}

/** 짝지은 차이(뒤 − 앞)의 평균과 표준오차 */
export function pairedDiff(a: readonly number[], b: readonly number[]): { diff: number; se: number } {
  const d = a.map((x, i) => b[i] - x);
  return { diff: mean(d), se: meanSe(d) };
}

export { meanSe };

/** 보고서 끝에 붙는 읽는 법 (정적 글 — 숫자는 위 표에서 읽는다) */
export const REPORT_NOTES = `## 11. 읽는 법과 한계

- **이른 별세 효과의 수용 기준(마스터 결정 2026-11-02, 검수 REV-009-FM4b-1 2절)** — 처음 기준(재력 단계별 20세 시작·최종 순자산 **중앙값** 변화 ≤ 3%)은 지표가 틀렸다. 낮은 재력 단계의 20세 시작 순자산은 학자금 대출 바닥(−150만 원 등)에 모여 있어 중앙값이 한 칸(150만 원) 옮겨 가면 분모 바닥 1,000만 원 기준으로 15%가 나온다(효과 크기와 무관 — 반 크기 변형도 같다). 그래서 **평균**으로 본다: ① 최종 순자산 평균 변화 ≤ 3% ② 20세 시작 평균의 절대 변화 ≤ 150만 원 ③ 단계 순서 뒤바뀜 0 ④ 판정 변화 ≤ 2%p. 중앙값 변화와 효과가 걸린 판만의 차이는 **보고만** 한다(판정에 쓰지 않는다). ②의 5단계는 표본이 작아(세대당 1000판에서 약 146판, 효과가 걸린 판 약 25판, 표준오차 약 34만 원 — 150만 원 기준선이 기댓값 위에 있다) **보고만** 한다(마스터 결정 2026-11-03, REV-009-FM6-1 2절). 다른 기준과 1~4단계는 그대로다.
- **K2·K4(2절)의 중앙값 흔들림**은 효과가 아니라 난수 흐름이 옮겨 간 잡음이다(같은 사건 풀을 공유하지 않는 세계끼리라 짝지은 표본이어도 사건이 달라진다) — 같은 규칙의 이른 별세 효과(V2 → V3)는 난수 흐름이 같아 짝이 정확하다.
- **K1(3절)** 형제 수는 \`siblingCountOf(final, 'view')\`(살아 있는 형제 전원, 독립 포함, 별세 제외)와 옛 규칙의 비교이고, 상속액은 \`INHERIT[재력] ÷ (형제 수 + 1)\`을 두 값으로 계산한 평균이다. 출산이 많던 코호트(산업화·베이비붐)에서 새 정의의 형제 수가 크게 늘어(FM4b의 1945년 이전 어머니 보정이 출산 수를 센서스 평균에 맞췄다) 상속액이 절반 가까이 준다. 형진 님이 「실제 형제 수로 나누기」로 정해 FM6(식구 카드 개편)에서 켰다. 수용 기준(마스터 지시 2026-11-02): 단계 순서 뒤바뀜 0 · 최종 평균 변화 ≤ 8% · 판정 변화 ≤ 5%p, INHERIT 값은 다시 맞추지 않는다. 5단계는 표본이 작아(세대당 판 수의 약 2~7%) 판정 변화가 한두 판에 크게 흔들린다 — 판정 열의 %p는 그 표본 크기와 함께 읽는다.
- **R-562(3-2절)** 한 분은 모델이 먼저 별세시키고 다른 분이 100세를 넘으면 가족 보기는 「두 분 모두 떠남」인데 옛 \`parentsAllGone\`은 먼저 떠난 분의 **실제 나이**가 100을 넘을 때까지 거짓이었다 — 상속·월세 전환이 보기보다 평균 3.5년(최대 13년) 늦었다. FM6에서 보기와 같은 해로 맞췄고 \`withParentsGoneRule('legacy')\`가 옛 규칙의 세계를 만든다.
- **판 길이(4절)**는 자동 성향 선택으로 잰 추정 시간이다(판정에 쓰는 수동 흉내·시대별 표본은 \`tests/simulation.test.ts\`·\`npm run report:time\`). 가족 줄을 뺀 값은 같은 판의 걸음 집계에서 가족 줄만 있는 해를 조용한 해로 바꾸고, 다른 줄이 있는 해는 줄 대기를 뺀 근사다.
- **노년 카드 평균(5절)** 은 알파 한 세대(2013~2020년생)의 값이다. 시간 모델·판정 임계는 옛 시대 3구간 상수라 알파는 「다가올 세상」 하한 5.00을 쓴다 — 세대별 시간 모델(GM10)에서 다시 정한다.
- **성인기 「부모님」 사건(7절)** 은 모형이 부모 한 분 별세를 알린 판만 센다. FM6까지(V5, FM7a 전)는 사건 문장이 두 분을 말해 7절 앞 표의 비율(같은 해 포함)로 나왔고, FM7a의 「남은 한 분」 변형·원본의 제외 조건·별세 해 notFlags 규칙(V11, 별세 줄이 난 해 포함)으로 원본 두 사건은 0%가 되었다.
- **FM7a(8절)** 의 원인별 세계(V5 → V11)는 같은 시드·같은 자동 성향 선택이지만 사건 풀과 규칙이 달라 난수 흐름이 옮겨 가는 판이 있다(K2·K4와 같은 이유 — 중앙값은 보고만 한다). R-618(별세·이혼 하한 1세)은 코드 상수라 V0~V11 모두에 들어 있어 따로 가르지 않았다. 자녀 독립 나이(R-586)는 표시 전용이라 경제에는 \`senior-alone\` 조건만 닿는다.
`;

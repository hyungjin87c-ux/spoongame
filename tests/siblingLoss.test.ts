import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  famSeedOf,
  familyChangesFor,
  familyScheduleOf,
  familyTables,
  familyViewOf,
  generateBirthFromSeed,
  inheritanceAmount,
  lineClearedFlags,
  sceneFamilyOf,
  sceneInputOf,
  sceneLineOf,
  siblingCountOf,
  siblingLossPlan,
  stepYear,
  survivalCurve,
  withGoneYearRule,
  type FamilyData,
  type GameState,
  type ProfileId,
} from '../src/core';
import { FAMILY_LINE_ID, FAMILY_LINE_TEXT } from '../src/data/familyLineText';
import { startLife } from '../scripts/simulateLib';
import { withSiblingLoss } from '../scripts/familyRulesLib';
import { spreadSeeds } from './helpers/familyGolden';
import { lifeSteps, seedsFor } from './helpers/familyLife';

/**
 * 어린 형제의 이른 별세 (Q3, SPEC-009 「FM7 나눔」 6절·완료 기준 9, 안 B: 해시 계획 + 줄 문구 함수 `fam-sib-lost`, 형진 님 2026-11-06 승인 · 배율 1.0).
 * 계획(`familyBirth.ts#siblingLossPlan`)은 출생 때 가족 구성과 해시만으로 정한다 — 진행 RNG를 쓰지 않고 저장을 늘리지 않는다. 이 파일이 보는 것:
 *  (a) 1970년 이후 출생 판에서 0건 · 1969년 이하에서는 실제로 일어난다 (b) 구성에 없는 형제·태어난 해(0세)에 떠나는 형제·12세 이상 형제·주인공 0세인 해·주인공 20세 이상에서 0건
 *  (c) 한 판 최대 1건 (d) 보기·그림·카드가 같은 해(줄이 난 해 다음 해)부터 함께 바뀜 (e) 발생 비율이 생존 곡선에서 직접 적분한 목표와 4σ 안 (f)는 tests/familyConsistency.test.ts 전수(가림 분류)와 tests/familyFm7aGentle.test.tsx
 *  (g) 계획이 있는 해와 없는 해의 진행 RNG·스탯·자산·본 사건이 같다(기록 전용) (h) 계획을 끄면 형제는 떠나지 않고 출생신고 「N째」·구성은 그대로다 · 상속의 형제 수는 K1을 따른다.
 * 줄 문구는 tests/familyText.test.ts, 모든 걸음의 모순 0(INV-7·INV-10·FC10)은 tests/familyConsistency.test.ts가 같은 계획으로 본다.
 */

// tests/는 Node 타입을 쓰지 않는다 — 환경 변수 읽기에 필요한 모양만 선언한다
declare const process: { env: Record<string, string | undefined> };
/** 세대당 출생 표본 (비율 시험): 평소 1000, 환경 변수 `SIBLING_LOSS_BIRTHS`로 바꾼다 */
const BIRTHS = Number(process.env.SIBLING_LOSS_BIRTHS ?? 1000);
/** 계획이 있는 세대: 출생 연도 1969 이하가 섞인 세 세대(산업화·베이비붐·86세대) */
const OLD_GENS: readonly ProfileId[] = GENERATION_IDS.slice(0, 3);

interface Born {
  gen: ProfileId;
  seed: number;
  birthYear: number;
  family: FamilyData;
  famSeed: number;
}
const birthsOf = (gen: ProfileId, gi: number, n: number): Born[] =>
  spreadSeeds(n, gi).map((seed) => {
    const b = generateBirthFromSeed(seed, gen);
    return { gen, seed, birthYear: b.character.birthYear, family: b.family, famSeed: famSeedOf(b.peerSeed) };
  });

/** 생존 곡선에서 직접 적분한 한 형제의 「범위 안에서 떠날」 확률 — 구현의 해시 계획과 다른 길로 구한 목표(6절 2항: q = 출생 해를 넘겨 12세 전에 떠날 확률, 주인공 1~19세 안) */
function qOf(s: { g: 0 | 1; k: number }, older: boolean, birthYear: number): number {
  if (older && s.k > 11) return 0;
  const S = survivalCurve(s.g === 0 ? 'male' : 'female', older ? birthYear - s.k : birthYear + s.k);
  const x0 = older ? s.k : 0;
  const lo = older ? s.k + 1 : 1; // 별세 나이 하한: 위 형제는 a > k(주인공이 태어난 해에 떠나면 후보 아님, R-619), 아래 동생은 a ≥ 1(태어난 해에 떠나는 0세는 뺀다)
  const hi = older ? Math.min(11, s.k + 19) : Math.min(11, 19 - s.k);
  if (lo > hi || S[x0] <= 0) return 0;
  return (S[lo] - S[hi + 1]) / S[x0];
}
const lifeP = (b: Born): number => {
  let none = 1;
  b.family.o.forEach((s) => (none *= 1 - qOf(s, true, b.birthYear)));
  b.family.y.forEach((s) => (none *= 1 - qOf(s, false, b.birthYear)));
  return 1 - none;
};

describe('계획의 조건 (완료 기준 9 (a)(b))', () => {
  it('(a) 출생 연도 1970 이상 판에서는 0건이고, 1969 이하 판에서는 실제로 일어난다 (공허 통과 방지)', () => {
    let modern = 0;
    let old = 0;
    let hits = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const b of birthsOf(gen, gi, 300)) {
        const plan = siblingLossPlan(b.famSeed, b.birthYear, b.family);
        if (b.birthYear >= 1970) {
          modern++;
          expect(plan, `${gen}/${b.seed} ${b.birthYear}년생`).toBeNull();
        } else {
          old++;
          if (plan !== null) hits++;
        }
      }
    });
    expect(modern, '1970년 이후 출생 표본').toBeGreaterThan(1000);
    expect(old, '1969년 이하 출생 표본').toBeGreaterThan(300);
    expect(hits, '1969년 이하 판의 계획').toBeGreaterThan(20);
  });

  it('(b) 계획은 구성에 있는 형제 한 명이고, 별세 나이 1~11 · 주인공 나이 1~19, 위 형제는 주인공이 태어난 해를 넘겨 떠나며, 옛 저장 스냅샷(lg)에는 계획이 없다', () => {
    let n = 0;
    let older = 0;
    let younger = 0;
    OLD_GENS.forEach((gen, gi) => {
      for (const b of birthsOf(gen, gi, BIRTHS)) {
        const plan = siblingLossPlan(b.famSeed, b.birthYear, b.family);
        if (plan === null) continue;
        n++;
        const isOlder = plan.id.startsWith('o');
        const idx = Number(plan.id.slice(1)) - 1;
        const sib = (isOlder ? b.family.o : b.family.y)[idx];
        expect(sib, `${gen}/${b.seed}: 구성에 없는 형제 ${plan.id}`).toBeDefined();
        expect(plan.a, `${gen}/${b.seed}: 형제 별세 나이`).toBeGreaterThanOrEqual(1); // 태어난 해에 떠나는 0세는 후보가 아니다 (R-619)
        expect(plan.a, `${gen}/${b.seed}: 형제 별세 나이`).toBeLessThanOrEqual(11); // 12세 이상은 후보가 아니다
        expect(plan.at, `${gen}/${b.seed}: 주인공 나이`).toBeGreaterThanOrEqual(1); // 주인공 0세인 해는 아니다
        expect(plan.at, `${gen}/${b.seed}: 주인공 나이`).toBeLessThanOrEqual(19); // 20세 이상은 아니다
        if (isOlder) {
          older++;
          expect(plan.a, `${gen}/${b.seed}: 위 형제는 주인공이 태어난 해를 넘겨 떠난다`).toBeGreaterThan(sib.k);
          expect(plan.at, `${gen}/${b.seed}`).toBe(plan.a - sib.k);
        } else {
          younger++;
          expect(plan.at, `${gen}/${b.seed}`).toBe(sib.k + plan.a);
        }
        // 옛 저장 스냅샷(`lg`)은 이미 본 형제 구성을 바꾸지 않는다 (DF25) — 같은 구성이라도 새 계획이 생기지 않는다
        const game = { ...startLife(b.seed, gen), family: { ...b.family, lg: 1 as const } } as GameState;
        expect(familyScheduleOf(game).siblingLoss, `${gen}/${b.seed}: lg`).toBeNull();
      }
    });
    expect(n, '계획이 있는 판').toBeGreaterThan(100);
    expect(older, '위 형제').toBeGreaterThan(5);
    expect(younger, '아래 동생').toBeGreaterThan(50);
  });

  it('(e) 발생 비율이 목표와 4σ 안이다 — 목표 = 판마다 1 − Π(1 − q), q = 그 형제가 출생 해를 넘겨 12세 전(1~11세)에 주인공 1~19세 안에 떠날 확률(생존 곡선 직접 적분), 세대별 1000판, 해당 판만 분모', () => {
    let allHits = 0;
    let allN = 0;
    let allExpected = 0;
    for (const [gi, gen] of OLD_GENS.entries()) {
      const born = birthsOf(gen, gi, BIRTHS);
      const hits = born.filter((b) => siblingLossPlan(b.famSeed, b.birthYear, b.family) !== null).length;
      const ps = born.map(lifeP);
      const expected = ps.reduce((a, p) => a + p, 0);
      const sigma = Math.sqrt(ps.reduce((a, p) => a + p * (1 - p), 0));
      expect(Math.abs(hits - expected), `${gen}: 관측 ${hits} · 목표 ${expected.toFixed(1)} · σ ${sigma.toFixed(1)}`).toBeLessThanOrEqual(4 * sigma);
      allHits += hits;
      allN += born.length;
      allExpected += expected;
    }
    // 세대별 4σ가 맞더라도 합쳐서도 맞는다. 1940~69년생 판의 합친 발생 비율은 약 10%(작업자 어림 10.0%)와 크게 다르지 않다 (공허 통과 방지: 1~15% 안)
    if (process.env.SIBLING_LOSS_BIRTHS !== undefined) console.info(`[Q3 발생 비율] 세 세대(산업화·베이비붐·86세대) ${allHits}/${allN} = ${((100 * allHits) / allN).toFixed(2)}% · 목표 ${((100 * allExpected) / allN).toFixed(2)}%`);
    expect(allHits / allN).toBeGreaterThan(0.01);
    expect(allHits / allN).toBeLessThan(0.15);
  });

  it('(h) 계획을 끄면(design.siblingLoss.enabled = false, 한 곳) 모든 판에서 형제는 떠나지 않고, 구성과 출생신고 「N째」는 그대로다', () => {
    OLD_GENS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(120, gi)) {
        const on = generateBirthFromSeed(seed, gen);
        const off = withSiblingLoss(false, () => generateBirthFromSeed(seed, gen));
        expect(JSON.stringify(off.family), `${gen}/${seed}: 구성`).toBe(JSON.stringify(on.family));
        expect(off.report.birthOrder, `${gen}/${seed}: 출생신고 N째`).toBe(on.report.birthOrder);
        expect(JSON.stringify(off.report), `${gen}/${seed}: 출생신고`).toBe(JSON.stringify(on.report));
        const fs = famSeedOf(on.peerSeed);
        expect(withSiblingLoss(false, () => siblingLossPlan(fs, on.character.birthYear, on.family)), `${gen}/${seed}`).toBeNull();
      }
    });
  });

  it('배율 1 미만이면 형제마다 해시로 그 비율만 남는다(스위치 옆의 배율 상수 한 곳 — 0.5면 약 절반)', () => {
    const born = OLD_GENS.flatMap((gen, gi) => birthsOf(gen, gi, 600));
    const full = born.filter((b) => siblingLossPlan(b.famSeed, b.birthYear, b.family) !== null).length;
    const half = born.filter((b) => withScale(0.5, () => siblingLossPlan(b.famSeed, b.birthYear, b.family)) !== null).length;
    expect(full).toBeGreaterThan(100);
    expect(half / full, `배율 0.5: ${half}/${full}`).toBeGreaterThan(0.4);
    expect(half / full, `배율 0.5: ${half}/${full}`).toBeLessThan(0.62);
    // 배율 0이면 한 건도 없다
    expect(born.filter((b) => withScale(0, () => siblingLossPlan(b.famSeed, b.birthYear, b.family)) !== null)).toHaveLength(0);
  });
});

/** 시험 전용: 배율을 `fn` 동안만 바꾼다 */
function withScale<T>(scale: number, fn: () => T): T {
  const rule = familyTables().design.siblingLoss.value;
  const before = rule.scale;
  rule.scale = scale;
  try {
    return fn();
  } finally {
    rule.scale = before;
  }
}

describe('시간 규칙 · 보기·그림·카드 (완료 기준 9 (d))', () => {
  it('줄이 나는 해(at)에는 아직 함께 사는 사람이고, 다음 해(at + 1)부터 떠난 사람이다: 카드 「떠난 가족」의 별세 나이·「내가 M세였던 해」·그림의 식구·형제 수가 같은 해에 함께 바뀐다', () => {
    let checked = 0;
    OLD_GENS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(400, gi)) {
        const base = startLife(seed, gen);
        const sc = familyScheduleOf(base);
        const loss = sc.siblingLoss;
        if (loss === null || loss.at > 18) continue;
        checked++;
        const at = (age: number): GameState => ({ ...base, age });
        const before = familyViewOf(at(loss.at));
        const after = familyViewOf(at(loss.at + 1));
        const was = before.people.find((p) => p.id === loss.id)!;
        const now = after.people.find((p) => p.id === loss.id)!;
        expect(was.state, `${gen}/${seed} ${loss.at}세: 줄이 나는 해에는 아직 떠나지 않았다`).not.toBe('gone');
        expect(before.household, `${gen}/${seed} ${loss.at}세`).toContain(loss.id);
        expect(now.state, `${gen}/${seed} ${loss.at + 1}세`).toBe('gone');
        expect(now.goneAtOwnAge, `${gen}/${seed}: 카드의 「N세에 세상을 떠남」`).toBe(loss.a);
        expect(now.goneAtMyAge, `${gen}/${seed}: 「내가 M세였던 해」`).toBe(loss.at);
        expect(now.age, `${gen}/${seed}: 떠난 사람은 떠난 때 나이`).toBe(loss.a);
        expect(after.household, `${gen}/${seed} ${loss.at + 1}세: 함께 사는 사람에서 빠진다`).not.toContain(loss.id);
        // 형제 수(K1): 같은 해의 계획 없는 세계보다 정확히 하나 적다(그 해에 아래 동생이 새로 태어날 수 있어 앞 해와 견주지 않는다)
        const none = withSiblingLoss(false, () => familyViewOf(at(loss.at + 1)));
        expect(none.siblingCount.living - after.siblingCount.living, `${gen}/${seed}: 형제 수(K1)`).toBe(1);
        expect(none.siblingCount.total, `${gen}/${seed}: 구성의 형제는 그대로(출생신고 「N째」·형제자매 칸 불변)`).toBe(after.siblingCount.total);
        // 그림: 식구에서 빠지고 이 해의 바뀐 때에 sib-gone이 있다
        const scene = sceneFamilyOf(at(loss.at + 1));
        expect(scene.members.some((m) => m.id === loss.id), `${gen}/${seed}: 그림`).toBe(false);
        expect(scene.changed, `${gen}/${seed}: 바뀐 때`).toContain('sib-gone');
        expect(sceneFamilyOf(at(loss.at)).changed, `${gen}/${seed}: 줄이 나는 해에는 아직`).not.toContain('sib-gone');
        // 아래 한 줄은 같은 그림 상태(sceneInputOf)에서 만든다 — 식구 구성이 같은 입력을 읽어 그림과 같이 바뀐다(그 해 아래 동생이 새로 태어나면 식구 수 글은 같을 수 있다)
        expect(sceneInputOf(at(loss.at + 1)).state.members.some((m) => m.id === loss.id), `${gen}/${seed}: 한 줄의 입력(식구)`).toBe(false);
        expect(sceneInputOf(at(loss.at)).state.members.some((m) => m.id === loss.id) || sceneInputOf(at(loss.at)).state.overflow > 0, `${gen}/${seed}: 줄이 나는 해에는 한 줄 입력에 있다`).toBe(true);
        expect(sceneLineOf(sceneInputOf(at(loss.at + 1))), `${gen}/${seed}`).toMatch(/식구|함께|혼자|둘/);
        // 그 뒤로도 떠난 채다(돌아오지 않는다)
        expect(familyViewOf(at(Math.min(100, loss.at + 5))).people.find((p) => p.id === loss.id)!.state, `${gen}/${seed}`).toBe('gone');
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(8);
  });
});

describe('한 판 최대 1건 · 기록 전용 (완료 기준 9 (c)(g))', () => {
  it('(c) 한 판을 끝까지 돌려도 어린 형제의 별세 줄과 로그(종류 3)는 많아야 하나이고, 줄·로그의 별세 나이가 계획과 같다', () => {
    let lives = 0;
    let lines = 0;
    OLD_GENS.forEach((gen, gi) => {
      for (const seed of seedsFor(70, gi)) {
        const steps = lifeSteps(seed, gen);
        const last = steps[steps.length - 1].state;
        lives++;
        const fam = last.history.filter((h) => h.eventId === FAMILY_LINE_ID.sibLost);
        const logs = last.family!.l.filter((e) => e[0] === 3);
        expect(fam.length, `${gen}/${seed}`).toBeLessThanOrEqual(1);
        expect(logs.length, `${gen}/${seed}`).toBe(fam.length);
        if (fam.length === 1) {
          lines++;
          const plan = familyScheduleOf(last).siblingLoss!;
          expect(fam[0].age, `${gen}/${seed}: 줄이 난 주인공 나이`).toBe(plan.at);
          expect(logs[0], `${gen}/${seed}: 로그 [3, 주인공 나이, 대상, 별세 나이]`).toEqual([3, plan.at, (plan.id.startsWith('o') ? 10 : 20) + Number(plan.id.slice(1)), plan.a]);
          // 줄은 계획의 형제 호칭·별세 나이로 만든 승인 문장이다
          const sib = familyViewOf(last, plan.at + 1).people.find((p) => p.id === plan.id)!;
          expect(fam[0].text, `${gen}/${seed}`).toBe(FAMILY_LINE_TEXT.sibLost(last.character!.gender, sib.sibKind!, plan.a));
        }
      }
    });
    expect(lives).toBe(210);
    expect(lines, '줄이 난 판').toBeGreaterThan(3);
  });

  it('(g) 진행 RNG를 쓰지 않는다: 줄이 나는 해에 계획이 있어도 없어도 같은 상태에서 한 걸음의 진행 RNG·스탯·자산·본 사건·대기 선택이 같다 (기록 전용 — 줄·플래그·로그만 다르다). 단 지금 규칙(exclude)에서 줄 뒤 형제 플래그가 꺼지는 해는 R-631·R-632가 그 해 후보·선택지를 줄인다 — 그 해는 ③ 없는 세계(notflags)에서 같다', () => {
    let checked = 0;
    let same = 0;
    let touched = 0;
    OLD_GENS.forEach((gen, gi) => {
      for (const seed of seedsFor(120, gi)) {
        const base = startLife(seed, gen);
        const plan = familyScheduleOf(base).siblingLoss;
        if (plan === null) continue;
        // 줄이 나는 해를 시작할 때의 상태까지 돌린다
        const steps = lifeSteps(seed, gen);
        const step = steps.find((s) => s.before.age === plan.at);
        if (step === undefined) continue;
        const project = (s: GameState): string => JSON.stringify([s.rngState, s.stats, s.assets, s.seen, s.pending, s.age, s.lastChoiceAge]);
        // 계획 자체는 진행 RNG·후보를 건드리지 않는다: R-631·R-632(③) 없는 세계(notflags)에서는 늘 같다
        const onN = withGoneYearRule('notflags', () => stepYear(step.before));
        const offN = withGoneYearRule('notflags', () => withSiblingLoss(false, () => stepYear(step.before)));
        expect(project(onN.state), `${gen}/${seed} ${plan.at}세 (③ 없음)`).toBe(project(offN.state));
        const on = stepYear(step.before);
        const off = withSiblingLoss(false, () => stepYear(step.before));
        // 지금 규칙: 줄 뒤 꺼지는 형제 플래그가 없는 해는 같다. 꺼지는 해는 R-631·R-632가 후보·선택지를 줄여 달라질 수 있다 (후보 목록만 줄고 난수 칸 수 규칙은 그대로)
        if (lineClearedFlags(familyChangesFor(step.before, plan.at)).length === 0) {
          expect(project(on.state), `${gen}/${seed} ${plan.at}세`).toBe(project(off.state));
          same++;
        } else touched++;
        // 차이는 가족 줄·로그뿐이다
        const added = (r: typeof on): string[] => r.state.history.slice(step.before.history.length).map((h) => h.eventId ?? '');
        expect(added(on)).toContain(FAMILY_LINE_ID.sibLost);
        expect(added(off)).not.toContain(FAMILY_LINE_ID.sibLost);
        checked++;
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(5);
    expect(same, '지금 규칙에서도 같은 판(형제 플래그가 안 꺼지는 해)').toBeGreaterThan(3);
    expect(same + touched).toBe(checked);
  });

  it('K1: 떠난 형제는 형제 수에서 빠져 상속식 INHERIT ÷ (형제 수 + 1)의 형제 수가 하나 줄고(상속액이 늘고), 계획을 끈 세계는 형제 수가 그대로다', () => {
    let checked = 0;
    OLD_GENS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(300, gi)) {
        const base = startLife(seed, gen);
        const plan = familyScheduleOf(base).siblingLoss;
        if (plan === null) continue;
        // 두 분이 모두 떠난 해(상속)의 형제 수: 주인공 60세 시점(별세 뒤)의 상태로 본다
        const late = { ...base, age: 60 } as GameState;
        const on = siblingCountOf(late);
        const off = withSiblingLoss(false, () => siblingCountOf(late));
        expect(off - on, `${gen}/${seed}: 형제 수`).toBe(1);
        const tier = base.character!.parentWealth;
        if (inheritanceAmount(tier, off) > 0) expect(inheritanceAmount(tier, on), `${gen}/${seed}: 상속액`).toBeGreaterThan(inheritanceAmount(tier, off));
        checked++;
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(8);
  });
});


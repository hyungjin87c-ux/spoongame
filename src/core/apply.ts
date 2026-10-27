import { applyAssetEffects, clampFamilyFund, regionClassOf, type EconomyContext } from './economy';
import type { CondContext, ResolvedEffects } from './events';
import { applyStatDeltas } from './stats';
import { R1_PRESENT, type GameState } from './types';

/**
 * 효과 적용의 공통 부분 (순수 함수): 인생 진행(life.ts)과 영향 표기(impact.ts)가 **같은 코드**로 선택의 결과를 계산한다 —
 * 그래서 「표기에 없는 변화는 일어나지 않는다」(SPEC-003 EC5, 숨은 효과 0)가 구조로 지켜진다.
 */

/** 플래그를 끄고(clear) 켠다(set). 정렬·중복 없는 배열. 같은 플래그가 둘 다 있으면 켜는 쪽이 이긴다. */
export function applyFlags(flags: readonly string[], setFlags: readonly string[], clearFlags: readonly string[]): string[] {
  const s = new Set(flags);
  for (const f of clearFlags) s.delete(f);
  for (const f of setFlags) s.add(f);
  return [...s].sort();
}

/** 조건·가중치·효과 보너스가 읽는 상태 (출생 가족 정보·자산 포함) */
export function condContextOf(state: GameState): CondContext {
  if (state.character === null) throw new Error('condContextOf: 캐릭터가 없다');
  const r = state.birthReport;
  return {
    character: state.character,
    stats: state.stats,
    flags: new Set(state.flags),
    age: state.age,
    family: r === null ? null : { birthOrder: r.birthOrder, motherBirthAge: r.mother.age, fatherBirthAge: r.father.age, housing: r.housing },
    assets: state.assets,
  };
}

/** 경제 계산이 읽는 상태: 나이·지식·플래그·부모 재력 단계·연도 축 입력(출생 연도·시도 지역군) */
export function economyContextOf(state: GameState): EconomyContext {
  if (state.character === null || state.generation === null) throw new Error('economyContextOf: 캐릭터/세대가 없다');
  const birthYear = state.character.birthYear;
  // 시험 전용 R1 프로필은 항등 스위치(forceR1)를 켜 같은 배선을 지난다(EY17 ②) — 세대 판은 연도 규칙이 아직 없어 늘 항등이다(GM4)
  return {
    age: state.age,
    education: state.stats.education,
    flags: new Set(state.flags),
    tier: state.character.parentWealth,
    year: birthYear + state.age,
    birthYear,
    regionClass: regionClassOf(state.birthReport?.region),
    forceR1: state.generation === R1_PRESENT,
  };
}

/**
 * 해결된 효과를 상태에 적용한다(한 해 마무리·난수는 건드리지 않는다): 스탯(0~100으로 자름) → 플래그 → 20세 미만이면 집안 살림, 20세 이상이면 자산
 * (순자산·소득 보정·부채 + 새로 켜진 플래그의 주거 전환 + 불변식, 연 소득 다시 계산).
 * **간이 상속은 여기에 없다**(M5 r3, 마스터 결정 15-6절): 부모와 작별하는 장면의 선택지에 돈 표시가 앞서지 않도록, 상속은 선택의 효과가 아니라 부모가 모두 떠난 해의 해 끝 규칙이다 —
 * 원인이 사건(`parents_gone`)이든 나이 상한이든 life.ts#finishYear 한 곳에서 한 번 더한다. 그래서 previewChoice·영향 표기에도 들어가지 않는다.
 */
export function applyResolved(state: GameState, eff: ResolvedEffects): GameState {
  const flagsBefore = new Set(state.flags);
  const stats = applyStatDeltas(state.stats, eff.stats);
  const flags = applyFlags(state.flags, eff.setFlags, eff.clearFlags);
  const next: GameState = { ...state, stats, flags };
  if (state.assets === null) return eff.family === 0 ? next : { ...next, familyFund: clampFamilyFund(state.familyFund + eff.family) };
  const delta = eff.assets;
  const assets = applyAssetEffects(state.assets, delta, flagsBefore, economyContextOf(next));
  return { ...next, assets };
}

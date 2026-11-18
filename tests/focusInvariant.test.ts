import { describe, expect, it } from 'vitest';
import eventsSrc from '../src/core/events.ts?raw';
import eventValidateSrc from '../src/core/eventValidate.ts?raw';
import { autoResolveStep, condContextOf, eventPool, resolveChoiceStep, resolveDelegated, stepYear, type FocusId, type GameState } from '../src/core';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';
import { lifeStateAt, pendingStateFrom } from './helpers/focusStates';

/**
 * 결과 불변 (SPEC-018 PL10, 설계 3절): 초점은 `pickWeighted`의 가중에서만 읽힌다 — 뽑힌 뒤의 효과·자격·조건·자동 선택 점수·난수에는 길이 없다.
 * ① 차분(동적): 같은 대기 상태에서 `focus`만 {없음, 0..5}로 바꿔 해결하면 결과가 `focus` 필드만 빼고 전부 같다 ② 읽기 허용 목록(정적) ③ `Condition` 키 ④ `CondContext` 키.
 * ⑤ 변이 증거는 실행 기록에 적는다(`resolveChoiceCore`에 일부러 focus 분기를 넣어 ①이 실패함을 한 번 확인).
 */
const FOCI: ReadonlyArray<FocusId | undefined> = [undefined, 0, 1, 2, 3, 4, 5];
const withFocus = (s: GameState, id: FocusId | undefined): GameState => (id === undefined ? s : { ...s, focus: { id, sec: 3 } });
const strip = (s: GameState): string => {
  const copy = { ...s } as Record<string, unknown>;
  delete copy.focus;
  return JSON.stringify(copy);
};

describe('focusInvariant ① 차분 — focus만 다른 상태를 해결하면 결과가 같다', () => {
  const samples: GameState[] = [];
  for (const age of [13, 20, 40, 65]) {
    for (let seed = 1; seed <= 6; seed++) {
      const p = pendingStateFrom(seed * 101, seed % 2 === 0 ? 'millennial' : 'industrial', age);
      if (p !== null) samples.push(p);
    }
  }

  it('표본이 충분하고 네 구간을 덮는다', () => {
    expect(samples.length).toBeGreaterThanOrEqual(16);
    expect(new Set(samples.map((s) => (s.age < 20 ? 0 : s.age < 40 ? 1 : s.age < 65 ? 2 : 3))).size).toBe(4);
  });

  it('resolveChoiceStep · autoResolveStep: 모든 선택지 × 7개 초점이 focus 필드만 빼고 같은 상태와 같은 틱을 낸다', () => {
    for (const p of samples) {
      const pending = p.pending!;
      for (const choiceId of pending.choiceIds) {
        const base = resolveChoiceStep(withFocus(p, undefined), pending.key, choiceId);
        for (const f of FOCI) {
          const r = resolveChoiceStep(withFocus(p, f), pending.key, choiceId);
          expect(strip(r.state), `${pending.eventId}/${choiceId}/${f}`).toBe(strip(base.state));
          expect(r.tick).toEqual(base.tick);
          expect(r.state.focus, '초점 필드는 해결이 건드리지 않는다').toEqual(withFocus(p, f).focus);
        }
      }
      const auto = autoResolveStep(withFocus(p, undefined), pending.key);
      for (const f of FOCI) {
        const r = autoResolveStep(withFocus(p, f), pending.key);
        expect(strip(r.state), `auto ${pending.eventId}/${f}`).toBe(strip(auto.state));
        expect(r.tick).toEqual(auto.tick);
      }
    }
  });

  it('resolveDelegated(부모가 정한·흘러감 카드): 관찰자로 받은 대기 상태에서 focus만 달라도 같다', () => {
    let checked = 0;
    for (let seed = 1; seed <= 40 && checked < 30; seed++) {
      let s: GameState = lifeStateAt(seed * 57, 'millennial', 13);
      for (let step = 0; step < 6 && s.phase === 'life'; step++) {
        const seen: Array<{ state: GameState; by: 'parent' | 'child' }> = [];
        const r = stepYear(s, eventPool(), (e) => seen.push({ state: e.state, by: e.by }));
        for (const e of seen) {
          const base = resolveDelegated(withFocus(e.state, undefined), e.by);
          for (const f of FOCI) expect(strip(resolveDelegated(withFocus(e.state, f), e.by).state)).toBe(strip(base.state));
          checked++;
        }
        s = r.state.pending !== null ? autoResolveStep(r.state, r.state.pending.key).state : r.state;
      }
    }
    expect(checked, '공허 통과 방지: 위임 카드 표본이 있다').toBeGreaterThan(10);
  });

  it('난수: 해결이 쓰는 난수 상태(`rngState`)도 같다 — 초점이 난수 소비에 닿지 않는다', () => {
    for (const p of samples.slice(0, 8)) {
      const key = p.pending!.key;
      const choice = p.pending!.choiceIds[0];
      const rngs = FOCI.map((f) => resolveChoiceStep(withFocus(p, f), key, choice).state.rngState);
      expect(new Set(rngs).size).toBe(1);
    }
  });
});

describe('focusInvariant ② 읽기 허용 목록 (정적)', () => {
  /** 초점을 읽어도 되는 `src/core` 파일 — 이 밖(효과·보너스·자격·조건·경제·기질·영향 줄·부모 결정·자동 선택)에 나오면 실패한다 */
  const ALLOWED = ['src/core/focus.ts', 'src/core/life.ts', 'src/core/storage.ts', 'src/core/session.ts', 'src/core/types.ts', 'src/core/index.ts', 'src/core/eventLint.ts'];
  const READ = /state\.focus|\.focus\b|focusFactor|focusEffectiveOf|focusChoicesOf|focusTopicsOf|setFocus|focusPromptDue|\bFocusId\b|\bFocusState\b|FOCUS_TABLE|FOCUS_K\b/;

  it('src/core에서 초점 식별자를 읽는 파일이 허용 목록 안에만 있다', () => {
    const offenders: string[] = [];
    for (const path of listRepoTextFiles().paths) {
      if (!/^src\/core\/[^/]+\.ts$/.test(path.replace(/\\/g, '/'))) continue;
      const norm = path.replace(/\\/g, '/');
      if (ALLOWED.includes(norm)) continue;
      if (READ.test(readRepoText(path) ?? '')) offenders.push(norm);
    }
    expect(offenders).toEqual([]);
  });

  it('효과·보너스·자격·경제·기질·영향·부모 결정·자동 선택 파일 명시: 초점 식별자가 한 번도 없다', () => {
    for (const f of ['apply.ts', 'events.ts', 'economy.ts', 'persona.ts', 'personaLife.ts', 'impact.ts', 'parentDecision.ts', 'ask.ts', 'careerTrack.ts', 'stats.ts']) {
      const text = readRepoText(`src/core/${f}`);
      expect(text, f).not.toBeNull();
      expect(READ.test(text ?? ''), f).toBe(false);
    }
  });

  it('life.ts에서 초점은 stepYear 맨 앞 계산과 pickWeighted 두 곳(곱·두 추첨 호출)에만 쓰인다', () => {
    const life = readRepoText('src/core/life.ts') ?? '';
    const lines = life.split('\n').filter((l) => /focusEffectiveOf|focusFactor|\bfocus\b/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    expect(lines.length).toBeLessThanOrEqual(8);
    expect(life.match(/focusEffectiveOf\(/g)).toHaveLength(1);
    expect(life.match(/focusFactor\(/g)).toHaveLength(1);
  });
});

describe('focusInvariant ③ ④ — 사건 데이터·조건 맥락이 초점을 읽는 길이 없다', () => {
  it('③ Condition·검증기에 focus·topic 키가 없다', () => {
    expect(/focus|topic/i.test(eventsSrc.slice(eventsSrc.indexOf('export interface Condition'), eventsSrc.indexOf('export interface Condition') + 6000))).toBe(false);
    expect(/focus|topic/i.test(eventValidateSrc)).toBe(false);
  });

  it('④ condContextOf가 만드는 객체의 키에 focus가 없고, 초점이 달라도 값이 같다', () => {
    const p = pendingStateFrom(7, 'millennial', 20)!;
    const base = condContextOf(p);
    expect(Object.keys(base).some((k) => /focus/i.test(k))).toBe(false);
    for (const f of FOCI) {
      const c = condContextOf(withFocus(p, f));
      expect(JSON.stringify({ ...c, flags: [...c.flags] })).toBe(JSON.stringify({ ...base, flags: [...base.flags] }));
    }
  });
});

import { describe, expect, it } from 'vitest';
import { autoResolveStep, countTick, emptyCounts, stepYear, type GameState, type ProfileId } from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * [CX-003-002 · 결정 후속 234] 진로 강제 슬롯이 19세의 마지막 입시를 가져가지 않는다.
 * 분야 카드가 열리는 해에 `college`를 켜는 사건(대학 지원 `school-exam`, 16~19세)이 후보이면 일반 선택지 추첨을 먼저 돌려
 * 대학 지원이 뽑히면 그것을 내고, 아니면 분야 카드를 낸다 — 19세 고졸 진로 시작과 19세 입시가 함께 남는다.
 */

/** 19세 첫 진행 직전(나이 19, 대기 없음)까지 자동으로 산 상태 */
function at19(seed: number, generation: ProfileId): GameState | null {
  let s: GameState = startLife(seed, generation);
  for (let i = 0; i < 300 && s.phase === 'life'; i++) {
    if (s.pending !== null) {
      s = autoResolveStep(s, s.pending.key).state;
      continue;
    }
    if (s.age === 19) return s;
    s = stepYear(s).state;
  }
  return null;
}

describe('[CX-003-002] 19세: 진로 분야 카드와 마지막 입시가 함께 남는다', () => {
  it('밀레니얼 시드 1~220: 같은 19세 상태에서 persona만 뺀 판이 본인 대학 지원을 내면 켠 판도 같은 카드·같은 후보·같은 난수 상태로 낸다, 고졸 분야 카드도 남는다', () => {
    let paired = 0;
    let field = 0;
    let exam = 0;
    for (let seed = 1; seed <= 220; seed++) {
      const s = at19(seed, 'millennial');
      if (s === null || s.persona === undefined) continue;
      const { persona: _p, ...bare } = s;
      void _p;
      const on = stepYear(s).state;
      const off = stepYear(bare as GameState).state;
      if (off.pending?.eventId === 'school-exam') {
        paired++;
        expect(on.pending, `시드 ${seed}: 대학 지원 대기`).toEqual(off.pending);
        expect(on.rngState, `시드 ${seed}: 난수 상태`).toBe(off.rngState);
      }
      if (on.pending?.eventId === 'school-exam') exam++;
      if (on.pending?.eventId === 'job-pick-field') field++;
    }
    expect(paired, '끈 판의 19세 본인 대학 지원 (공허 통과 방지)').toBeGreaterThan(10);
    expect(exam, '켠 판의 19세 본인 대학 지원').toBe(paired);
    expect(field, '19세 고졸 분야 카드').toBeGreaterThan(10);
  });

  it('Codex 재현 상태(밀레니얼 시드 4, 19세 2014년): 켠 판도 school-exam@19를 낸다', () => {
    const s = at19(4, 'millennial')!;
    expect(s.character!.birthYear + 19).toBe(2014);
    const r = stepYear(s).state;
    expect(r.pending?.eventId).toBe('school-exam');
  });

  it('대학 지원을 고르면(apply) 학업이 이어져 분야 카드는 대학을 마친 뒤로 미뤄진다', () => {
    const s = at19(4, 'millennial')!;
    const r = stepYear(s).state;
    expect(r.pending?.choiceIds).toContain('apply');
    let t = autoResolveStep(r, r.pending!.key).state;
    // 자동 선택이 무엇을 골랐든, college가 켜졌으면 다음 해(20세)에는 분야 카드가 없다
    if (t.flags.includes('college')) {
      t = stepYear(t).state;
      expect(t.pending?.eventId ?? '', '20세').not.toBe('job-pick-field');
    }
  });
});

describe('[CX-003-007] 진로 카드 집계는 엔진과 같은 정의(사건의 pick)를 읽는다', () => {
  it('id 접두사가 job-pick-여도 진로 표지가 없는 선택 틱은 진로 카드로 세지 않는다', () => {
    const c = emptyCounts();
    countTick(c, { kind: 'choice', fromAge: 20, eventId: 'job-pick-field', career: true });
    countTick(c, { kind: 'choice', fromAge: 22, eventId: 'job-pick-fake' });
    expect(c.careerCards).toBe(1);
    expect(c.choice).toBe(2);
  });

  it('실제 판: 진로 카드 틱 수 = 연표의 pick 사건 선택 줄 수', () => {
    let s: GameState = startLife(4, 'millennial');
    const c = emptyCounts();
    for (let i = 0; i < 500 && s.phase === 'life' && s.age <= 36; i++) {
      if (s.pending !== null) {
        s = autoResolveStep(s, s.pending.key).state;
        continue;
      }
      const r = stepYear(s);
      countTick(c, r.tick);
      s = r.state;
    }
    const lines = s.history.filter((h) => h.kind === 'choice' && (h.eventId ?? '').startsWith('job-pick-')).length;
    expect(lines).toBeGreaterThan(0);
    expect(c.careerCards).toBe(lines);
  });
});

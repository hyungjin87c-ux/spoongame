import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { beginBirth, createInitialState, decisionFor, enterBirth, enterLife, isChoiceEvent, parseGame, parseOpened, serializeGame, SCHEMA_VERSION, type GameState } from '../src/core';
import { forcedPending } from './helpers/forcedPending';
import { lifeAt, personaOf } from './helpers/personaTest';
import saveV030 from './fixtures/save-v030-age20.json';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 저장·복원의 persona 부분 (SPEC-018 PL1, 설계 6-1·6-3절): 선택 필드 하나, `SCHEMA_VERSION` 9 그대로, 이상하면 **persona만** 버리고 판은 산다, 옛 저장(필드 없음)은 중립.
 * (직업 카드 `pending`의 구·신 파서 대조는 3단계 몫이다 — 이번 단계는 `persona` 필드 자체의 검증이다.)
 */

const life = (): GameState => lifeAt(31, 14);
const mutate = (s: GameState, fn: (persona: Record<string, unknown>, data: Record<string, unknown>) => void): string => {
  const raw = JSON.parse(serializeGame(s)) as { data: Record<string, unknown> & { persona: Record<string, unknown> } };
  fn(raw.data.persona, raw.data);
  return JSON.stringify(raw);
};

describe('저장 스키마는 v9 그대로', () => {
  it('SCHEMA_VERSION 9이고 persona는 선택 필드라 저장 봉투에 그대로 들어간다', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const raw = JSON.parse(serializeGame(life())) as { version: number; data: { persona: unknown } };
    expect(raw.version).toBe(9);
    expect(raw.data.persona).toBeDefined();
  });

  it('persona v = 1이고 키 순서가 고정이다(같은 값 → 같은 바이트): v·born·w·shown·g', () => {
    const p = personaOf(life());
    expect(p.v).toBe(1);
    expect(Object.keys(p)).toEqual(['v', 'born', 'w', 'shown', 'g']);
  });

  it('크기는 약 90B 안팎이다(작은 선택 필드)', () => {
    expect(JSON.stringify(personaOf(life())).length).toBeLessThan(120);
  });
});

describe('저장 → 복원', () => {
  it('인생 단계 판이 바이트 그대로 돌아온다(persona 포함)', () => {
    const s = life();
    const back = parseGame(serializeGame(s));
    expect(back).not.toBeNull();
    expect(serializeGame(back!)).toBe(serializeGame(s));
    expect(back!.persona).toEqual(s.persona);
  });

  it('갱신된 persona(예산·직업 상태 포함)도 그대로 돌아온다', () => {
    const s = life();
    const p = { ...personaOf(s), advUsed: 7, roleUsed: 3, tries: 2, job: { field: 'clerk' as const, id: 'bank-teller', since: 22 } };
    const back = parseGame(serializeGame({ ...s, persona: p }));
    expect(back!.persona).toEqual(p);
  });

  it('룰렛·출생신고 단계에서도 persona가 남는다(룰렛 도중·직후 새로고침)', () => {
    const roulette = beginBirth(createInitialState(9), 'genz');
    for (const s of [roulette, enterBirth(roulette), enterLife(enterBirth(roulette))]) {
      expect(parseGame(serializeGame(s))!.persona).toEqual(roulette.persona);
    }
  });

  it('엔딩 단계에서도 읽힌다', () => {
    const s = life();
    const ended: GameState = { ...s, phase: 'ending', pending: null, death: { age: s.age, cause: '노환' } };
    expect(parseGame(serializeGame(ended))?.persona).toEqual(s.persona);
  });
});

describe('옛 저장(필드 없음)은 중립이다', () => {
  it('persona가 없는 저장은 그대로 열리고 채우지 않는다(맞춤은 새 판부터)', () => {
    const s = life();
    const { persona: _drop, ...bare } = s;
    void _drop;
    const back = parseGame(serializeGame(bare as GameState));
    expect(back).not.toBeNull();
    expect(back!.persona).toBeUndefined();
    expect(parseOpened(serializeGame(bare as GameState))!.persona).toBeUndefined();
    expect(serializeGame(back!)).toBe(serializeGame(bare as GameState));
  });

  it('구형 저장 고정 표본(v0.3.0 20세)도 열리고 persona는 없다', () => {
    const back = parseGame(JSON.stringify(saveV030));
    expect(back).not.toBeNull();
    expect(back!.persona).toBeUndefined();
  });
});

describe('이상한 persona는 persona만 버리고 판은 산다', () => {
  const cases: Array<[string, (p: Record<string, unknown>, d: Record<string, unknown>) => void]> = [
    ['persona가 null', (_p, d) => (d.persona = null)],
    ['persona가 배열', (_p, d) => (d.persona = [])],
    ['persona가 문자열', (_p, d) => (d.persona = 'x')],
    ['w 길이 5', (p) => (p.w = [50, 50, 50, 50, 50])],
    ['w 길이 7', (p) => (p.w = [50, 50, 50, 50, 50, 50, 50])],
    ['w 4 (하한 5 미만)', (p) => (p.w = [4, 50, 50, 50, 50, 50])],
    ['w 96 (상한 95 초과)', (p) => (p.w = [96, 50, 50, 50, 50, 50])],
    ['w 소수', (p) => (p.w = [50.5, 50, 50, 50, 50, 50])],
    ['w NaN(null로 직렬화)', (p) => (p.w = [null, 50, 50, 50, 50, 50])],
    ['w 문자열', (p) => (p.w = ['50', 50, 50, 50, 50, 50])],
    ['born 6', (p) => (p.born = 6)],
    ['born −1', (p) => (p.born = -1)],
    ['shown 6', (p) => (p.shown = 6)],
    ['shown 문자열', (p) => (p.shown = 'curious')],
    ['g 길이 4', (p) => (p.g = [0, 0, 0, 0])],
    ['g 41', (p) => (p.g = [41, 0, 0, 0, 0])],
    ['v 2', (p) => (p.v = 2)],
    ['v 없음', (p) => delete p.v],
    ['tries 10', (p) => (p.tries = 10)],
    ['tries −1', (p) => (p.tries = -1)],
    ['advUsed 13', (p) => (p.advUsed = 13)],
    ['roleUsed 13', (p) => (p.roleUsed = 13)],
    ['advUsed 소수', (p) => (p.advUsed = 1.5)],
    ['모르는 키', (p) => (p.mood = 3)],
    ['job이 문자열', (p) => (p.job = 'x')],
    ['job.since 없음', (p) => (p.job = { field: 'clerk' })],
    ['job.since 111', (p) => (p.job = { field: 'clerk', since: 111 })],
    ['job에 모르는 키', (p) => (p.job = { field: 'clerk', since: 20, pay: 1 })],
  ];

  for (const [name, fn] of cases) {
    it(name, () => {
      const s = life();
      const back = parseGame(mutate(s, fn));
      expect(back, name).not.toBeNull(); // 판은 산다
      expect(back!.persona).toBeUndefined(); // persona만 버려진다 → 중립
      const { persona: _a, ...rest } = back!;
      const { persona: _b, ...want } = s;
      void _a;
      void _b;
      expect(rest).toEqual(want);
    });
  }

  it('첫 화면(title) 단계의 판에 persona가 있으면 버린다', () => {
    const t = createInitialState(5);
    const raw = JSON.stringify({ version: 9, data: { ...t, persona: personaOf(life()) } });
    const back = parseGame(raw);
    expect(back).not.toBeNull();
    expect(back!.persona).toBeUndefined();
  });
});

describe('직업 상태의 부분 손상 (6-4절 규칙 중 persona 쪽)', () => {
  it('job.field가 모르는 값이면 job 전체만 지운다(none 상태) — persona·판은 산다', () => {
    const back = parseGame(mutate(life(), (p) => (p.job = { field: 'astronaut', id: 'x-y', since: 21 })));
    expect(back!.persona).toBeDefined();
    expect(back!.persona!.job).toBeUndefined();
  });

  it('job.id 모양이 이상하면 id만 지우고 field 상태로 남긴다', () => {
    const back = parseGame(mutate(life(), (p) => (p.job = { field: 'clerk', id: 'Bad Id!', since: 21 })));
    expect(back!.persona!.job).toEqual({ field: 'clerk', since: 21 });
  });

  it('id 없는 field 상태는 그대로 읽힌다', () => {
    const back = parseGame(mutate(life(), (p) => (p.job = { field: 'sales', since: 22 })));
    expect(back!.persona!.job).toEqual({ field: 'sales', since: 22 });
  });
});

describe('손상된 persona가 있는 판의 부모·흘러감 대기를 열어도 죽지 않는다 (검증이 대기 해결보다 먼저)', () => {
  it('부모가 정하는 카드가 대기인 저장 + 손상된 persona → persona만 버리고 대기는 그 해 안에서 풀린다', () => {
    const delegated = EVENT_POOL.events.filter((e) => isChoiceEvent(e) && e.ageRange?.min !== undefined && decisionFor(e.id, e.ageRange.min) !== 'self' && e.heavy === undefined);
    expect(delegated.length).toBeGreaterThan(0);
    let tried = 0;
    for (const ev of delegated) {
      let pending: GameState;
      try {
        pending = forcedPending(ev.id, 'millennial', { age: ev.ageRange!.min! });
      } catch {
        continue;
      }
      tried++;
      const withP: GameState = { ...pending, persona: personaOf(lifeAt(1, 0)) };
      const raw = JSON.parse(serializeGame(withP)) as { data: { persona: Record<string, unknown> } };
      raw.data.persona.w = [1, 2, 3];
      const back = parseGame(JSON.stringify(raw));
      expect(back, ev.id).not.toBeNull();
      expect(back!.persona).toBeUndefined();
      expect(back!.pending).toBeNull(); // 열자마자 그 해 안에서 처리됐다(PD10)
      if (tried >= 3) break;
    }
    expect(tried).toBeGreaterThan(0);
  });
});

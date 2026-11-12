import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { beginBirth, createEventPool, createInitialState, decisionFor, enterBirth, enterLife, indexEntryInYear, isChoiceEvent, parseGame, parseOpened, resolveChoiceStep, serializeGame, stepYear, SCHEMA_VERSION, type GameState } from '../src/core';
import { forcedPending } from './helpers/forcedPending';
import { lifeAt, personaOf } from './helpers/personaTest';
import saveV030 from './fixtures/save-v030-age20.json';
import { playUntil, runToJobCard } from './helpers/careerTest';

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
    const p = { ...personaOf(s), advUsed: 7, roleUsed: 3, tries: 2, job: { field: 'clerk' as const, id: 'clerk-bank', since: 22 } }; // 3a단계: 모르는 id는 복원 때 지워지므로(6-4절) 직업 색인에 있는 id를 쓴다
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
    ['tries 17', (p) => (p.tries = 17)], // 저장 범위 0..16 [CX-003-003]
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

describe('직업 카드(pick) 대기의 저장·복원 (3a단계, 설계 6-4절)', () => {
  /** 구형(v0.5.1) 파서와 같은 풀: 진로 카드 사건을 모른다 → 그 카드만 `stale-pending`으로 풀리고 저장 전체는 산다 */
  const OLD_POOL = createEventPool(EVENT_POOL.events.filter((e) => e.pick === undefined));
  const data = (s: GameState, fn: (d: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(serializeGame(s)) as { data: Record<string, unknown> };
    fn(raw.data);
    return JSON.stringify(raw);
  };
  const pendingOf = (d: Record<string, unknown>) => d.pending as { choiceIds: string[] };
  const personaData = (d: Record<string, unknown>) => d.persona as Record<string, unknown>;

  for (const kind of ['field', 'detail'] as const) {
    describe(`${kind} 카드`, () => {
      const card = runToJobCard(3, kind);

      it('신형 파서: 대기 중 저장이 그대로 돌아온다(후보 id 순서 보존, 바이트 같음)', () => {
        const back = parseGame(serializeGame(card));
        expect(back).not.toBeNull();
        expect(back!.pending).toEqual(card.pending);
        expect(back!.pending!.choiceIds).toEqual(card.pending!.choiceIds);
        expect(serializeGame(back!)).toBe(serializeGame(card));
      });

      it('후보 2개·3개 모두 신형 파서가 받아들인다', () => {
        for (const n of [2, 3]) {
          const raw = data(card, (d) => (pendingOf(d).choiceIds = card.pending!.choiceIds.slice(0, n)));
          const back = parseGame(raw);
          expect(back?.pending?.choiceIds, `후보 ${n}`).toHaveLength(n);
        }
      });

      it('구형(v0.5.1 동치) 파서: 후보 2·3개 모두 모양은 통과하고 그 카드만 풀린다 — 저장 전체·persona는 산다', () => {
        for (const n of [2, 3]) {
          const raw = data(card, (d) => (pendingOf(d).choiceIds = card.pending!.choiceIds.slice(0, n)));
          const back = parseGame(raw, OLD_POOL);
          expect(back, `후보 ${n}`).not.toBeNull();
          expect(back!.pending).toBeNull();
          expect(back!.persona).toEqual(card.persona);
          expect(back!.age).toBe(card.age);
          expect(back!.history).toEqual(card.history);
          expect(back!.seen[card.pending!.eventId]).toBe(card.age);
        }
      });

      it('후보 4~5개(또는 1개·0개)는 모양 어긋남 → 손상으로 보고 저장을 버린다(신·구 파서 같다)', () => {
        const extra = [...card.pending!.choiceIds, 'job-x', 'job-y'];
        for (const n of [0, 1, 4, 5]) {
          const raw = data(card, (d) => (pendingOf(d).choiceIds = extra.slice(0, n)));
          expect(parseGame(raw), `후보 ${n}`).toBeNull();
          expect(parseGame(raw, OLD_POOL), `구형 ${n}`).toBeNull();
        }
      });

      it('해결 직후(대기 없음)에는 persona의 job 상태가 바이트 그대로 돌아온다', () => {
        const after = resolveChoiceStep(card, card.pending!.key, card.pending!.choiceIds[0]).state;
        expect(after.pending).toBeNull();
        const back = parseGame(serializeGame(after));
        expect(serializeGame(back!)).toBe(serializeGame(after));
        expect(back!.persona).toEqual(after.persona);
      });

      it('모르는 id 한 개 → 그 카드만 풀린다(persona 보존)', () => {
        const raw = data(card, (d) => (pendingOf(d).choiceIds = [card.pending!.choiceIds[0], 'no-such-job']));
        const back = parseGame(raw);
        expect(back).not.toBeNull();
        expect(back!.pending).toBeNull();
        expect(back!.persona).toEqual(card.persona);
      });

      it('persona가 손상으로 버려졌는데 직업 카드 pending이 있다 → persona만 버려지고 카드는 풀린다(판은 산다)', () => {
        const back = parseGame(data(card, (d) => (personaData(d).w = [1, 2, 3])));
        expect(back).not.toBeNull();
        expect(back!.persona).toBeUndefined();
        expect(back!.pending).toBeNull();
      });
    });
  }

  it('분야 카드에 분야가 아닌 id(직업 id)가 섞이면 풀린다 / 세부 카드에 다른 분야의 id가 섞이면 풀린다', () => {
    const f = runToJobCard(3, 'field');
    expect(parseGame(data(f, (d) => (pendingOf(d).choiceIds = [f.pending!.choiceIds[0], 'clerk-bank'])))!.pending).toBeNull();
    const dCard = runToJobCard(3, 'detail');
    const other = dCard.persona!.job!.field === 'clerk' ? 'svc-chef' : 'clerk-bank';
    const back = parseGame(data(dCard, (d) => (pendingOf(d).choiceIds = [dCard.pending!.choiceIds[0], other])));
    expect(back).not.toBeNull();
    expect(back!.pending).toBeNull();
  });

  it('persona.job 상태가 카드 종류와 맞지 않으면 풀린다(분야 카드 ↔ 직업 없음, 세부 카드 ↔ field 상태이고 field 일치)', () => {
    const f = runToJobCard(3, 'field');
    expect(parseGame(data(f, (d) => (personaData(d).job = { field: 'clerk', since: 18 })))!.pending).toBeNull();
    const dCard = runToJobCard(3, 'detail');
    expect(parseGame(data(dCard, (d) => delete personaData(d).job))!.pending).toBeNull(); // 상태가 none
    expect(parseGame(data(dCard, (d) => (personaData(d).job = { field: 'machine', id: 'mach-assy', since: 20 })))!.pending).toBeNull(); // hired
    const other = dCard.persona!.job!.field === 'machine' ? 'clerk' : 'machine';
    expect(parseGame(data(dCard, (d) => (personaData(d).job = { field: other, since: 20 })))!.pending).toBeNull(); // field 불일치
    expect(parseGame(serializeGame(dCard))!.pending).toEqual(dCard.pending); // 정상 대조군
  });

  it('연도 구간 대조: 색인 항목의 from·to 경계가 맞다(실제 표에는 yearRange가 아직 없어 순수 함수로 잠근다)', () => {
    expect(indexEntryInYear({ from: 2000 }, 1999)).toBe(false);
    expect(indexEntryInYear({ from: 2000 }, 2000)).toBe(true);
    expect(indexEntryInYear({ to: 2010 }, 2010)).toBe(true);
    expect(indexEntryInYear({ to: 2010 }, 2011)).toBe(false);
    expect(indexEntryInYear({}, 1940)).toBe(true);
  });

  it('모르는 직업 id의 hired 상태: id만 지워 field 상태로 되돌린다 — 플래그 유지·재지원 가능(35세 이하)', () => {
    const hired = playUntil(runToJobCard(3, 'field'), (x) => x.persona?.job?.id !== undefined);
    expect(hired.flags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
    const back = parseGame(data(hired, (d) => ((personaData(d).job as Record<string, unknown>).id = 'removed-job')))!;
    expect(back.persona!.job).toEqual({ field: hired.persona!.job!.field, since: hired.persona!.job!.since });
    expect(back.persona!.tries).toBe(hired.persona!.tries);
    expect(back.flags).toEqual(hired.flags); // has_career·job_picked 유지 — 기존 첫 일 카드가 되살아나지 않는다
    // 재지원: 35세 이하이면 다음 진행에서 세부 카드가 다시 열린다
    expect(playUntil(back, (x) => x.pending !== null).pending?.eventId).toBe('job-pick-detail');
    // 35세를 넘겼으면 카드 없이 남는다
    expect(stepYear({ ...back, age: 40 }).state.pending?.eventId.startsWith('job-pick-') ?? false).toBe(false);
  });

  it('job.field가 모르는 값이면 job 전체를 지우고(none), 35세 이하이면 분야 카드부터 다시 시작한다', () => {
    const hired = playUntil(runToJobCard(3, 'field'), (x) => x.persona?.job?.id !== undefined);
    const back = parseGame(data(hired, (d) => (personaData(d).job = { field: 'astronaut', id: 'x-y', since: 21 })))!;
    expect(back.persona!.job).toBeUndefined();
    expect(back.flags).toEqual(hired.flags);
    expect(playUntil(back, (x) => x.pending !== null).pending?.eventId).toBe('job-pick-field');
  });

  it('대기 없는 판의 persona(job·tries 포함)는 보존된다', () => {
    const mid = playUntil(runToJobCard(3, 'field'), (x) => (x.persona?.tries ?? 0) > 0 || x.persona?.job?.id !== undefined);
    expect(parseGame(serializeGame(mid))!.persona).toEqual(mid.persona);
  });
});

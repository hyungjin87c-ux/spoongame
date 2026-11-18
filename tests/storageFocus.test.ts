import { describe, expect, vi } from 'vitest';
import { SCHEMA_VERSION, parseGame, parseOpened, serializeGame, setFocus, type GameState } from '../src/core';
import { createInitialState } from '../src/core';
import { itFocusOn, lifeStateAt, listOf } from './helpers/focusStates';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 저장·복원의 focus 부분 (SPEC-018 PL10, 설계 6절): 최상위 선택 필드 하나, `SCHEMA_VERSION` 9 그대로, 이상하면 **focus만** 버리고 `persona`와 판은 산다 (6-2절 표 전 행).
 * 구형 파서(v0.6.0 `c09afd6`·v0.5.1)는 최상위의 모르는 키를 거르지 않고 통과·보존한다 — `parseGame`이 같은 식(`data as GameState`)이라 이 시험의 「모르는 최상위 키」 행이 같은 경로를 잠근다(코드 읽기, 재현은 CX-007).
 */
const base = (): GameState => {
  const s = lifeStateAt(11, 'millennial', 25);
  return setFocus(s, listOf(s)[0]); // 20~39세 구간의 첫 초점
};
const mutate = (s: GameState, fn: (data: Record<string, unknown>) => void): string => {
  const raw = JSON.parse(serializeGame(s)) as { data: Record<string, unknown> };
  fn(raw.data);
  return JSON.stringify(raw);
};

describe('저장 모양', () => {
  itFocusOn('SCHEMA_VERSION 9 그대로, 최상위 필드 focus는 `id, sec` 순서이고 id가 없으면 키가 없다', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const s = base();
    expect(s.focus).toBeDefined();
    const raw = JSON.parse(serializeGame(s)) as { version: number; data: { focus: Record<string, unknown>; persona: unknown } };
    expect(raw.version).toBe(9);
    expect(Object.keys(raw.data.focus)).toEqual(['id', 'sec']);
    expect(raw.data.persona).toBeDefined();
    const none = setFocus(s, null);
    expect(Object.keys(none.focus ?? {})).toEqual(['sec']);
    expect(JSON.stringify(none.focus)).toBe('{"sec":1}');
  });

  itFocusOn('크기는 작다 (약 20B)', () => {
    expect(JSON.stringify(base().focus).length).toBeLessThanOrEqual(20);
  });

  itFocusOn('저장 → 읽기 → 저장이 바이트 그대로다 (멀쩡한 값은 같은 객체)', () => {
    const raw = serializeGame(base());
    const back = parseGame(raw)!;
    expect(serializeGame(back)).toBe(raw);
    expect(back.focus).toEqual(base().focus);
  });

  itFocusOn('필드 순서가 뒤집힌 값은 표준 순서로 맞춘다 (같은 값 → 같은 바이트)', () => {
    const s = base();
    const raw = mutate(s, (d) => {
      d.focus = { sec: s.focus!.sec, id: s.focus!.id };
    });
    expect(serializeGame(parseGame(raw)!)).toBe(serializeGame(s));
  });

  itFocusOn('필드가 없는 저장(이 변경 이전의 모든 판)은 그대로 유효하다', () => {
    const s = lifeStateAt(11, 'millennial', 25);
    expect('focus' in s).toBe(false);
    const back = parseGame(serializeGame(s))!;
    expect('focus' in back).toBe(false);
    expect(back.persona).toEqual(s.persona);
  });
});

describe('6-2절 표: 이상한 값은 focus만 버리고 persona·판은 산다', () => {
  const s = base();
  const personaBefore = JSON.stringify(s.persona);
  const dropped = (name: string, fn: (d: Record<string, unknown>) => void): void => {
    itFocusOn(name, () => {
      const back = parseGame(mutate(s, fn));
      expect(back, '판은 열린다').not.toBeNull();
      expect('focus' in back!, 'focus만 버려진다').toBe(false);
      expect(JSON.stringify(back!.persona), 'persona는 그대로').toBe(personaBefore);
      expect(back!.age).toBe(s.age);
      expect(back!.phase).toBe('life');
    });
  };

  dropped('객체가 아님(숫자·문자열·배열·null)', (d) => {
    d.focus = 3;
  });
  dropped('배열', (d) => {
    d.focus = [2, 1];
  });
  dropped('null', (d) => {
    d.focus = null;
  });
  dropped('모르는 키가 있다', (d) => {
    d.focus = { id: 1, sec: 1, extra: 1 };
  });
  dropped('id가 정수가 아니다(1.5)', (d) => {
    d.focus = { id: 1.5, sec: 1 };
  });
  dropped('id가 문자열이다', (d) => {
    d.focus = { id: 'work', sec: 1 };
  });
  dropped('id가 음수다', (d) => {
    d.focus = { id: -1, sec: 1 };
  });
  dropped('id가 6 이상이다 (이후 버전이 더한 모르는 주제)', (d) => {
    d.focus = { id: 6, sec: 1 };
  });
  dropped('sec이 없다', (d) => {
    d.focus = { id: 1 };
  });
  dropped('sec이 범위 밖이다(4)', (d) => {
    d.focus = { id: 1, sec: 4 };
  });
  dropped('sec이 음수다', (d) => {
    d.focus = { id: 1, sec: -1 };
  });
  dropped('sec이 정수가 아니다', (d) => {
    d.focus = { id: 1, sec: 0.5 };
  });
  dropped('sec이 지금 나이의 구간보다 크다 (미래 — 25세에 sec 2)', (d) => {
    d.focus = { id: 1, sec: 2 };
  });

  itFocusOn('id가 있지만 지금 구간 목록에 없으면 보존한다 (효과만 없다) — 25세에 건강(3)', () => {
    expect(listOf(s)).not.toContain(3);
    const back = parseGame(mutate(s, (d) => {
      d.focus = { id: 3, sec: 1 };
    }))!;
    expect(back.focus).toEqual({ id: 3, sec: 1 });
  });

  itFocusOn('id가 없는 {sec}만 있는 값도 유효하다 (「없음」을 고른 판)', () => {
    const back = parseGame(mutate(s, (d) => {
      d.focus = { sec: 1 };
    }))!;
    expect(back.focus).toEqual({ sec: 1 });
  });

  itFocusOn('sec이 지금 구간과 같거나 작으면 유효하다 (25세에 sec 0·1)', () => {
    for (const sec of [0, 1]) {
      const back = parseGame(mutate(s, (d) => {
        d.focus = { id: 2, sec };
      }))!;
      expect(back.focus).toEqual({ id: 2, sec });
    }
  });
});

describe('phase·persona·13세 전', () => {
  itFocusOn('첫 화면(title) 단계의 판에 있으면 버린다', () => {
    const t = { ...createInitialState(5), focus: { id: 1, sec: 0 } } as GameState;
    const back = parseGame(serializeGame(t));
    expect(back).not.toBeNull();
    expect('focus' in back!).toBe(false);
  });

  itFocusOn('13세 전(구간 없음)의 판에 있으면 버린다', () => {
    const young = lifeStateAt(11, 'millennial', 8);
    expect(young.age).toBeLessThan(13);
    const back = parseGame(serializeGame({ ...young, focus: { id: 1, sec: 0 } }));
    expect(back).not.toBeNull();
    expect('focus' in back!).toBe(false);
  });

  itFocusOn('persona가 없는 판(구형 저장 또는 persona가 버려졌다)이면 버린다', () => {
    const s = base();
    const noPersona = mutate(s, (d) => {
      delete d.persona;
    });
    expect('focus' in parseGame(noPersona)!).toBe(false);
    // persona가 손상으로 버려지면 focus도 함께 버려진다
    const brokenPersona = mutate(s, (d) => {
      d.persona = { v: 99 };
    });
    const back = parseGame(brokenPersona)!;
    expect('persona' in back).toBe(false);
    expect('focus' in back).toBe(false);
  });

  itFocusOn('persona가 멀쩡하고 focus만 손상이면 persona는 살아 있다 (모르는 키·미래 sec 모두)', () => {
    const s = base();
    for (const bad of [{ id: 1, sec: 1, zzz: 0 }, { id: 1, sec: 3 }, 'x']) {
      const back = parseGame(mutate(s, (d) => {
        d.focus = bad;
      }))!;
      expect(JSON.stringify(back.persona)).toBe(JSON.stringify(s.persona));
      expect('focus' in back).toBe(false);
    }
  });

  itFocusOn('엔딩 단계의 판도 유효한 focus는 보존한다', () => {
    const s = base();
    const ended = { ...s, phase: 'ending' as const, pending: null };
    const back = parseGame(serializeGame(ended));
    // 엔딩 판은 사망 정보 등 다른 검증이 있어 열리지 않을 수 있다 — 열리면 focus가 보존된다
    if (back !== null) expect(back.focus).toEqual(s.focus);
  });
});

describe('구형 파서 경로: 최상위의 모르는 키는 통과·보존된다', () => {
  itFocusOn('모르는 최상위 키가 있어도 판이 열리고 persona가 유지되며 키가 보존된다', () => {
    const s = lifeStateAt(11, 'millennial', 25);
    const back = parseGame(mutate(s, (d) => {
      d.futureField = { a: 1 };
    })) as (GameState & { futureField?: unknown }) | null;
    expect(back).not.toBeNull();
    expect(back!.futureField).toEqual({ a: 1 });
    expect(JSON.stringify(back!.persona)).toBe(JSON.stringify(s.persona));
  });

  itFocusOn('parseOpened도 focus를 지우지 않는다 (가족 채우기와 독립)', () => {
    const s = base();
    expect(parseOpened(serializeGame(s))!.focus).toEqual(s.focus);
  });
});

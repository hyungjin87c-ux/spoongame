import { describe, expect, it, vi } from 'vitest';
import { parseGame, serializeGame, type GameState } from '../src/core';
import { lifeStateAt } from './helpers/focusStates';

// 맞춤 인생 스위치를 끈 채 연다 (설계 6-2절 「persona가 없음 → 버림. `PERSONA_ENABLED = false`이면 통과·보존」)
vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }));

describe('storageFocus — 맞춤 인생 스위치를 끈 채', () => {
  const s = lifeStateAt(11, 'millennial', 25);
  const withFocus = { ...s, focus: { id: 1, sec: 1 } } as GameState;
  const noPersona = (state: GameState): string => {
    const raw = JSON.parse(serializeGame(state)) as { data: Record<string, unknown> };
    delete raw.data.persona;
    return JSON.stringify(raw);
  };

  it('persona가 없어도 유효한 focus는 통과·보존한다 (켜면 이어진다)', () => {
    const back = parseGame(noPersona(withFocus))!;
    expect(back.focus).toEqual({ id: 1, sec: 1 });
  });

  it('스위치를 꺼도 모양이 틀린 focus는 버린다', () => {
    const raw = JSON.parse(noPersona(withFocus)) as { data: Record<string, unknown> };
    raw.data.focus = { id: 9, sec: 1 };
    expect('focus' in parseGame(JSON.stringify(raw))!).toBe(false);
  });
});

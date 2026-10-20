import { describe, expect, it } from 'vitest';
import { GAME_KEY, SCHEMA_VERSION, loadGame, parseGame, playToEnd, resolveDelegated, serializeGame, stepYear, type GameState, type HistoryEntry, type StorageLike } from '../src/core';
import { reviewEnding } from '../src/core/ending';
import { delegatedSummaryText } from '../src/data/parentDecisionTable';
import { startLife } from '../scripts/simulateLib';
import { forcedPending } from './helpers/forcedPending';

/**
 * T7 저장·호환 (SPEC-005 PD10·SV1, 설계 문서 5절): 연표 줄의 선택 필드 `by`는 `kind: 'choice'`에만 허용되고 `'parent' | 'child'` 외 값은 **그 필드만** 버린다 · `by`가 없는 v8 저장은 그대로 열린다 ·
 * 부모 영역·흘러감 카드가 `pending`인 v8 저장은 열자마자 같은 해 안에서 처리되고 같은 기록 줄이 남는다(이미 지난 해의 줄은 바뀌지 않는다) · 엔딩의 부모·흘러감 집계가 연표와 같다.
 * 저장 스키마 버전은 올리지 않았다(SV1) — 선택 필드 하나가 더해졌을 뿐이다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;
const clone = (s: GameState): Doc => JSON.parse(JSON.stringify(s));
const raw = (d: Doc): string => JSON.stringify({ version: SCHEMA_VERSION, data: d });
const memoryStorage = (text: string): StorageLike => {
  const map = new Map<string, string>([[GAME_KEY, text]]);
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

/** 부모·흘러감 줄이 여럿 있는 어린 시절의 한 판(14세 즈음) — 첫 시드 가운데 부모 줄 3개 이상, 흘러감 줄 1개 이상이 있는 것 */
function youngLifeWithDelegations(): GameState {
  for (let seed = 1; seed < 400; seed++) {
    let s = startLife(seed, 'present');
    while (s.phase === 'life' && s.age < 14 && s.pending === null) s = stepYear(s).state;
    if (s.phase !== 'life' || s.pending !== null) continue; // 본인 카드에서 멈추면 건너뛴다
    const parent = s.history.filter((h) => h.by === 'parent').length;
    const child = s.history.filter((h) => h.by === 'child').length;
    if (parent >= 3 && child >= 1) return s;
  }
  throw new Error('부모·흘러감 줄이 있는 어린 시절의 판을 찾지 못했다');
}

describe('T7-1 연표 줄의 by 필드: choice 줄에만, 값은 parent | child뿐 — 이상한 값은 그 필드만 버리고 판은 유지한다', () => {
  const base = youngLifeWithDelegations();
  const firstChoice = base.history.findIndex((h) => h.kind === 'choice' && h.by === 'parent');
  const firstEvent = base.history.findIndex((h) => h.kind === 'event');

  it('정상 저장: by가 있는 줄은 그대로 열리고(부모·흘러감 모두) 상태가 한 글자도 바뀌지 않는다 (직렬화 왕복)', () => {
    const back = parseGame(serializeGame(base));
    expect(back).not.toBeNull();
    expect(back!.history.filter((h) => h.by === 'parent').length).toBeGreaterThanOrEqual(3);
    expect(back!.history.filter((h) => h.by === 'child').length).toBeGreaterThanOrEqual(1);
    expect(back!.history).toEqual(base.history);
  });

  it('choice 줄의 by가 parent·child가 아니면 그 줄의 by 필드만 사라진다 (문자열·숫자·null·불리언·객체·빈 문자열·대소문자)', () => {
    for (const bad of ['mother', 'self', 'Parent', 'PARENT', '', 5, 0, null, true, false, {}, ['parent']]) {
      const d = clone(base);
      d.history[firstChoice].by = bad;
      const back = parseGame(raw(d));
      expect(back, `by=${JSON.stringify(bad)} 때문에 판이 버려졌다`).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(back!.history[firstChoice], 'by'), `by=${JSON.stringify(bad)}`).toBe(false);
      // 그 필드만 사라졌다: 나머지 줄과 줄의 다른 필드는 그대로
      const expected = { ...base.history[firstChoice] } as Record<string, unknown>;
      delete expected.by;
      expect(back!.history[firstChoice]).toEqual(expected);
      expect(back!.history.filter((_, i) => i !== firstChoice)).toEqual(base.history.filter((_, i) => i !== firstChoice));
      expect(back!.stats).toEqual(base.stats);
      expect(back!.age).toBe(base.age);
    }
  });

  it('choice가 아닌 줄(event·stage·death·note)에 by가 있으면 값이 parent여도 그 필드만 사라진다', () => {
    const d = clone(base);
    d.history[firstEvent].by = 'parent';
    const back = parseGame(raw(d));
    expect(back).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(back!.history[firstEvent], 'by')).toBe(false);
    expect(back!.history[firstEvent].kind).toBe('event');
    // 같은 저장의 진짜 choice 줄은 그대로
    expect(back!.history[firstChoice].by).toBe('parent');
  });

  it('v8 저장(by가 하나도 없음)은 그대로 열린다: 본인이 고른 선택이 전부인 옛 판 — 줄 객체가 새로 만들어지지도 않는다', () => {
    const old = youngLifeWithDelegations();
    const noBy: GameState = { ...old, history: old.history.map((h) => { const { by: _drop, ...rest } = h as HistoryEntry & { by?: unknown }; void _drop; return rest as HistoryEntry; }) };
    const back = parseGame(serializeGame(noBy));
    expect(back).not.toBeNull();
    expect(back!.history.every((h) => !Object.prototype.hasOwnProperty.call(h, 'by'))).toBe(true);
    expect(back!.history).toEqual(noBy.history);
    expect(SCHEMA_VERSION).toBe(8); // 스키마 버전은 올리지 않았다 (SV1)
  });

  it('변이 점검: by 검증을 거치지 않으면 이 시험이 잡는다 (잘못된 값이 그대로 열린 상태를 흉내 내면 위 단언이 실패한다)', () => {
    const d = clone(base);
    d.history[firstChoice].by = 'mother';
    const bypassed = JSON.parse(raw(d)).data as GameState; // 검증 없이 읽은 값
    expect((bypassed.history[firstChoice] as HistoryEntry).by).not.toBeUndefined();
    const checked = parseGame(raw(d))!;
    expect(checked.history[firstChoice].by).toBeUndefined();
  });
});

describe('T7-2 부모 영역·흘러감 카드가 pending인 v8 저장은 열자마자 처리된다 (PD10)', () => {
  it('부모 영역 카드(infant-fever)가 대기 중인 저장: 열면 대기가 없고, 그 해가 부모님이 정한 선택으로 끝나 연표 줄 하나(by: parent)가 남고 나이가 한 살 오른다', () => {
    const pendingState = forcedPending('infant-fever');
    expect(pendingState.pending).not.toBeNull();
    const back = parseGame(serializeGame(pendingState));
    expect(back).not.toBeNull();
    expect(back!.pending).toBeNull();
    expect(back!.age).toBe(pendingState.age + 1);
    const added = back!.history.slice(pendingState.history.length).filter((h) => h.kind === 'choice');
    expect(added).toHaveLength(1);
    expect(added[0].by).toBe('parent');
    expect(added[0].eventId).toBe('infant-fever');
    // 이미 지난 해의 줄은 바뀌지 않았다
    expect(back!.history.slice(0, pendingState.history.length)).toEqual(pendingState.history);
    // 같은 저장을 두 번 열면 같은 결과다 (결정론)
    expect(parseGame(serializeGame(pendingState))).toEqual(back);
    // 열어서 나온 상태는 `resolveDelegated`가 직접 만든 것과 같다 (같은 경로)
    expect(back).toEqual(resolveDelegated(pendingState, 'parent').state);
  });

  it('흘러감 카드(infant-new-sibling — 전 나이 흘러감)가 대기 중인 저장: 열면 by: child 줄이 남는다', () => {
    const pendingState = forcedPending('infant-new-sibling');
    const back = parseGame(serializeGame(pendingState));
    expect(back).not.toBeNull();
    expect(back!.pending).toBeNull();
    const added = back!.history.slice(pendingState.history.length).filter((h) => h.kind === 'choice');
    expect(added).toHaveLength(1);
    expect(added[0].by).toBe('child');
    expect(back).toEqual(resolveDelegated(pendingState, 'child').state);
  });

  it('나이에 따라 갈린다: school-friend는 12세 이하 흘러감 · 13세부터 본인 — 13세 이후 대기 중인 저장은 대기가 그대로 남는다 (본인 카드는 처리하지 않는다)', () => {
    const young = parseGame(serializeGame(forcedPending('school-friend', 'present', { age: 10 })));
    expect(young).not.toBeNull();
    expect(young!.pending).toBeNull();
    expect(young!.history.filter((h) => h.eventId === 'school-friend').pop()?.by).toBe('child');

    const teen = forcedPending('school-friend', 'present', { age: 15 });
    const back = parseGame(serializeGame(teen));
    expect(back).not.toBeNull();
    expect(back!.pending).not.toBeNull();
    expect(back!.pending!.eventId).toBe('school-friend');
    expect(back!.history).toEqual(teen.history);
  });

  it('19세 이상 / 표 밖 이벤트가 대기 중인 저장은 건드리지 않는다 (모두 본인)', () => {
    let found = false;
    for (let seed = 1; seed < 400 && !found; seed++) {
      let s = startLife(seed, 'present');
      while (s.phase === 'life' && s.age < 25 && s.pending === null) s = stepYear(s).state;
      if (s.phase !== 'life' || s.pending === null || s.age < 19) continue;
      found = true;
      const back = parseGame(serializeGame(s));
      expect(back).not.toBeNull();
      expect(back!.pending).toEqual(s.pending);
      expect(back!.history).toEqual(s.history);
    }
    expect(found, '19세 이상에서 대기 중인 판을 찾았다').toBe(true);
  });

  it('loadGame(저장소 경로)도 같다: 저장소에서 읽어도 부모 영역 대기는 처리된 상태로 나온다', () => {
    const pendingState = forcedPending('school-supplies');
    const loaded = loadGame(memoryStorage(serializeGame(pendingState)));
    expect(loaded).not.toBeNull();
    expect(loaded!.pending).toBeNull();
    expect(loaded!.history.filter((h) => h.eventId === 'school-supplies').pop()?.by).toBe('parent');
  });

  it('열린 판을 이어가면 끝까지 간다 (처리된 상태로 이어서 사망까지, 예외 0)', () => {
    const back = parseGame(serializeGame(forcedPending('infant-moving')))!;
    const end = playToEnd(back);
    expect(end.state.phase).toBe('ending');
  });
});

describe('T7-3 엔딩의 부모·흘러감 집계 (PD9): 본인 카드 수 N · 부모님이 정한 M · 흘러간 K', () => {
  it('reviewEnding의 choiceCount·delegated가 연표의 선택 줄(by 유무)과 같고, 셋을 더하면 연표의 선택 줄 전부다', () => {
    for (const seed of [11, 222, 3333, 44444, 7919, 15838]) {
      const end = playToEnd(startLife(seed, 'present')).state;
      expect(end.phase).toBe('ending');
      const r = reviewEnding(end as Parameters<typeof reviewEnding>[0]);
      const lines = end.history.filter((h) => h.kind === 'choice');
      expect(r.choiceCount, `seed ${seed}`).toBe(lines.filter((h) => h.by === undefined).length);
      expect(r.delegated.parent, `seed ${seed}`).toBe(lines.filter((h) => h.by === 'parent').length);
      expect(r.delegated.child, `seed ${seed}`).toBe(lines.filter((h) => h.by === 'child').length);
      expect(r.choiceCount + r.delegated.parent + r.delegated.child).toBe(lines.length);
      expect(r.delegated.parent).toBeGreaterThan(0); // 모든 판에 부모님이 정한 일이 있다 (손계산 4.4장)
    }
  });

  it('엔딩 둘째 줄 문구: 둘 다 있으면 한 문장, 하나만 있으면 그 쪽만, 둘 다 0이면 줄 없음 (한 상수에서 나온다)', () => {
    expect(delegatedSummaryText(4, 2)).toBe('어린 시절의 큰 결정 가운데 4번은 부모님이 내렸고, 2번은 아이의 일로 흘러갔습니다.');
    expect(delegatedSummaryText(5, 0)).toBe('어린 시절의 큰 결정 가운데 5번은 부모님이 내렸습니다.');
    expect(delegatedSummaryText(0, 3)).toBe('어린 시절의 큰 결정 가운데 3번은 아이의 일로 흘러갔습니다.');
    expect(delegatedSummaryText(0, 0)).toBeNull();
  });
});

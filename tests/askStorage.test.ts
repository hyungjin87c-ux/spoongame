import { describe, expect, it } from 'vitest';
import '../src/data/installAll';
import age0 from './fixtures/save-v030-age0.json';
import age20 from './fixtures/save-v030-age20.json';
import age65 from './fixtures/save-v030-age65.json';
import mother20 from './fixtures/save-v040-mother-age20.json';
import {
  GAME_KEY,
  SCHEMA_VERSION,
  advanceUntilDecision,
  closenessOf,
  createEventPool,
  loadGame,
  parseGame,
  parseOpened,
  playToEnd,
  resolveChoiceStep,
  saveGame,
  serializeGame,
  type EventPool,
  type GameState,
  type StorageLike,
} from '../src/core';
import { ASK_KINDS } from '../src/data/askTable';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from '../scripts/simulateLib';
import { askEvent } from './helpers/askEvents';

/**
 * 조르기 카드와 저장 (SPEC-011 AK6 ③, `docs/data/ask-model.md` 5-3절 3, 완료 기준 12): 조르기 카드가 `pending`인 저장을 열면 같은 카드·같은 결과이고, 이미 지나간 해의 줄은 바뀌지 않으며,
 * 조르기 사건이 없던 구형 저장·`family`가 없는 구형 저장도 열린다. **저장 스키마 버전(9)과 `HistoryEntry` 모양은 그대로다** — 새 저장 필드·새 줄 종류가 없다
 * (조르기 결과 줄은 일반 선택 줄과 같은 모양이고, `parent_strained`는 이름만 새 일반 플래그다).
 * 실제 사건 9개는 AK7이라 합성 사건(`tests/helpers/askEvents.ts`)을 실제 풀에 더한 풀로 본다.
 */

const EVS = ASK_KINDS.map((k) => askEvent(`ask-${k}-x`, k));
// 실제 조르기 사건(AK7 이후)이 풀에 들어와도 이 시험의 합성 사건만 보도록 실제 조르기 사건은 뺀다
const POOL: EventPool = createEventPool([...EVENT_POOL.events.filter((e) => e.ask === undefined), ...EVS]);
const isAsk = (id: string | undefined): boolean => EVS.some((e) => e.id === id);
const memoryStorage = (text: string | null): StorageLike => {
  const map = new Map<string, string>();
  if (text !== null) map.set(GAME_KEY, text);
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

/** 4~12세에 조르기 카드가 떠서 멈춘 판 (「다음 결정으로」가 멈춘 그 자리) — 앞선 부모 결정·흘러감 줄이 연표에 있다 */
function askPendingLife(minSeed = 1): GameState {
  for (let seed = minSeed; seed < minSeed + 200; seed++) {
    const r = advanceUntilDecision(startLife(seed, 'alpha'), POOL);
    if (r.state.pending !== null && isAsk(r.state.pending.eventId)) return r.state;
  }
  throw new Error('조르기 카드가 대기 중인 판을 찾지 못했다');
}

const PENDING = askPendingLife();
// 부모 결정·흘러감 줄이 이미 있는 판도 하나 (이미 지나간 해의 줄이 바뀌지 않는지 보려면 앞선 줄이 있어야 한다)
const PENDING_WITH_LINES = ((): GameState => {
  for (let seed = 1; seed < 300; seed++) {
    const s = askPendingLife(seed);
    if (s.history.some((h) => h.by === 'parent') && s.history.some((h) => h.by === 'child')) return s;
  }
  return PENDING;
})();

describe('AK6 ③ 저장 스키마·줄 모양은 그대로다', () => {
  it('SCHEMA_VERSION은 9 그대로이고, 조르기 결과 줄은 일반 선택 줄과 같은 키뿐이다 (새 저장 필드 0)', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const s = PENDING;
    const r = resolveChoiceStep(s, s.pending!.key, 'tantrum', POOL);
    const line = r.state.history.filter((h) => isAsk(h.eventId)).pop()!;
    expect(Object.keys(line).sort()).toEqual(['age', 'choice', 'eventId', 'kind', 'text', 'title']);
    // 상태의 최상위 키도 조르기 때문에 늘지 않는다 (일반 선택을 해결한 판과 같은 키 집합)
    const keysBefore = Object.keys(s).sort();
    expect(Object.keys(r.state).sort()).toEqual(keysBefore);
  });
});

describe('AK6 ③ 조르기 카드가 pending인 저장', () => {
  it('저장 → 열기: 같은 카드(eventId·key·나이·보이는 선택지 셋)이고 상태가 한 글자도 바뀌지 않는다 · save → load → save가 바이트까지 같다', () => {
    for (const s of [PENDING, PENDING_WITH_LINES]) {
      const raw = serializeGame(s);
      const back = parseGame(raw, POOL);
      expect(back).not.toBeNull();
      expect(back!.pending).toEqual(s.pending);
      expect(back!.pending!.choiceIds).toEqual(['beg', 'tantrum', 'endure']);
      expect(back).toEqual(s);
      expect(serializeGame(back!)).toBe(raw);
      // 앱이 쓰는 읽기·쓰기 경로도 같다
      const store = memoryStorage(null);
      expect(saveGame(store, s)).toBe(true);
      const opened = loadGame(store, POOL);
      expect(opened).toEqual(s);
    }
  });

  it('새로고침 뒤 같은 카드의 결과는 열기 전과 같다 — 세 선택 모두 상태 전체가 같고 (해시), 새로고침을 연타해도 같다', () => {
    const raw = serializeGame(PENDING);
    for (const choice of ['beg', 'tantrum', 'endure']) {
      const direct = resolveChoiceStep(PENDING, PENDING.pending!.key, choice, POOL);
      for (let i = 0; i < 5; i++) {
        const reopened = parseGame(raw, POOL)!;
        const r = resolveChoiceStep(reopened, reopened.pending!.key, choice, POOL);
        expect(r.state, `${choice}#${i}`).toEqual(direct.state);
        expect(r.tick).toEqual(direct.tick);
      }
    }
  });

  it('해결한 뒤의 저장: 이미 지나간 해의 줄은 바뀌지 않고 한 번만 해결된다 — 같은 키로 다시 눌러도 아무 일도 없다', () => {
    const s = PENDING_WITH_LINES;
    const r = resolveChoiceStep(s, s.pending!.key, 'beg', POOL).state;
    const back = parseGame(serializeGame(r), POOL)!;
    expect(back).toEqual(r);
    expect(back.history).toEqual(r.history);
    // 앞선 줄(부모 결정·흘러감 · 단계 줄)은 해결 전과 그대로다
    expect(back.history.slice(0, s.history.length)).toEqual(s.history);
    expect(back.history.filter((h) => isAsk(h.eventId))).toHaveLength(1);
    expect(back.pending).toBeNull();
    const again = resolveChoiceStep(back, s.pending!.key, 'beg', POOL);
    expect(again.state).toBe(back);
    // 본 적 있는 카드는 다시 나오지 않는다 (같은 종류 1장 — askPeers·once 모두)
    const askId = s.pending!.eventId;
    expect(back.seen[askId]).toBe(s.pending!.age);
  });

  it('parent_strained 플래그가 켜진 저장도 열린다 — 이름이 플래그 형식을 지키고, 열어도 사이가 한 단계 아래로 읽힌다 (저장 마이그레이션 없음)', () => {
    let strained: GameState | null = null;
    for (let seed = 1; seed < 200 && strained === null; seed++) {
      const s = askPendingLife(seed);
      const r = resolveChoiceStep(s, s.pending!.key, 'tantrum', POOL).state;
      if (r.flags.includes('parent_strained')) strained = r;
    }
    expect(strained).not.toBeNull();
    const back = parseGame(serializeGame(strained!), POOL);
    expect(back).toEqual(strained);
    expect(back!.flags).toContain('parent_strained');
    const without = { ...back!, flags: back!.flags.filter((f) => f !== 'parent_strained') };
    for (const role of ['mother', 'father'] as const) {
      expect(closenessOf({ id: role, role }, back!)).toBeLessThanOrEqual(closenessOf({ id: role, role }, without));
      expect(closenessOf({ id: role, role }, back!)).toBeGreaterThanOrEqual(Math.max(1, closenessOf({ id: role, role }, without) - 1));
    }
  });

  it('조르기 사건이 풀에 없는 앱(콘텐츠가 바뀐 경우)이 이 저장을 열면 저장 전체를 버리지 않고 대기만 풀어 이어간다 (R-046) — 이미 남은 줄은 그대로', () => {
    const s = PENDING_WITH_LINES;
    const back = parseGame(serializeGame(s), EVENT_POOL);
    expect(back).not.toBeNull();
    expect(back!.pending).toBeNull();
    expect(back!.history).toEqual(s.history);
    expect(back!.stats).toEqual(s.stats);
  });
});

describe('AK6 ③ 조르기 사건이 없던 구형 저장·family가 없는 구형 저장', () => {
  const FIXTURES: Array<[string, unknown, number]> = [['v0.3.0 0세', age0, 0], ['v0.3.0 20세', age20, 20], ['v0.3.0 65세', age65, 65], ['v0.4.0 어머니만 20세', mother20, 20]];

  it('모두 열리고 줄·스탯·플래그가 그대로이다 — 조르기 사건이 풀에 있어도 옛 줄에는 조르기 줄이 없다', () => {
    for (const [name, doc, age] of FIXTURES) {
      const raw = JSON.stringify(doc);
      const opened = parseOpened(raw, POOL);
      expect(opened, name).not.toBeNull();
      expect(opened!.age, name).toBe(age);
      const plain = parseGame(raw, POOL)!;
      expect(plain.history, name).toEqual((doc as { data: { history: unknown } }).data.history);
      expect(plain.history.some((h) => isAsk(h.eventId)), name).toBe(false);
      expect(plain.flags.includes('parent_strained'), name).toBe(false);
      expect(Object.keys(plain.seen).some((id) => isAsk(id)), name).toBe(false);
    }
  });

  it('열어서 끝까지 이어 가도 깨지지 않는다 — 0세 저장은 앞으로 4~12세에 조르기 카드를 만날 수 있고, 13세 이상 저장은 만나지 않는다', () => {
    const asks = (doc: unknown): number => {
      let n = 0;
      for (let k = 0; k < 6; k++) {
        const s = parseOpened(JSON.stringify(doc), POOL)!;
        // 판마다 다른 선택을 하도록 난수 상태를 흔들지 않고, 같은 저장을 자동 모드로 이어 간다
        const end = playToEnd({ ...s, rngState: (s.rngState + k * 1013904223) >>> 0 }, null, POOL).state;
        n += end.history.filter((h) => isAsk(h.eventId)).length;
        expect(end.phase).toBe('ending');
      }
      return n;
    };
    expect(asks(age0)).toBeGreaterThan(0);
    expect(asks(age20)).toBe(0);
    expect(asks(age65)).toBe(0);
    expect(asks(mother20)).toBe(0);
  });
});

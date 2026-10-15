import { describe, expect, it } from 'vitest';
import { ERAS, STATE_WORD_RULES, createEventPool, createRng, playToEnd, resolveChoiceStep, stepYear, textPartsOf, type Era, type EventDef, type EventPool, type GameState } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { chooserFor, startLife, type Strategy } from '../scripts/simulateLib';

/**
 * 이벤트 흐름 (R-045 e, SPEC "선택이 스탯과 이후 이벤트에 영향"): 선택이 이후 이벤트를 열고 닫는지를 진행 루프로 직접 확인한다.
 * 데이터 쪽 연결(어느 이벤트가 어떤 플래그를 켜고 읽는가)은 tests/events.test.ts "플래그 연결"이, 여기서는 실제로 플레이했을 때 그 길이 막히지 않는지를 본다.
 */

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

/** 지정한 이벤트에서는 지정한 선택지를 고르고(그 이벤트의 보이는 선택지에 있을 때), 나머지는 무작위로 고른다. */
function forced(rules: Record<string, string>, seed: number) {
  const rng = createRng(seed ^ 0x51ed270b);
  return (s: GameState): string => {
    const p = s.pending!;
    const f = rules[p.eventId];
    return f !== undefined && p.choiceIds.includes(f) ? f : rng.pick(p.choiceIds);
  };
}

const saw = (f: GameState, ...ids: string[]) => ids.some((id) => Object.prototype.hasOwnProperty.call(f.seen, id));
const chose = (f: GameState, eventId: string, choiceId: string) => {
  const ev = EVENT_POOL.byId.get(eventId)!;
  const label = ev.choices!.find((c) => c.id === choiceId)!.label;
  return f.history.some((h) => h.eventId === eventId && h.kind === 'choice' && h.choice === label);
};

interface Tally {
  n: number;
  hit: number;
}

/** 세 시대 x 시드로 forced 규칙대로 플레이하고, cond를 만족한 판 중 hitIf를 만족한 판의 수를 센다. */
function tally(rules: Record<string, string>, cond: (f: GameState) => boolean, hitIf: (f: GameState) => boolean, perEra = 160): Tally {
  const t: Tally = { n: 0, hit: 0 };
  for (const era of ERAS) {
    for (let i = 1; i <= perEra; i++) {
      const seed = i * 7919 + 13;
      const f = playToEnd(startLife(seed, era), forced(rules, seed)).state;
      if (!cond(f)) continue;
      t.n++;
      if (hitIf(f)) t.hit++;
    }
  }
  return t;
}

const PARTNER = { 'youth-meeting': 'meet' } as const;
const CHILD_EVENTS = ['middle-child-school', 'middle-child-grows', 'middle-child-leaves', 'senior-grandchildren', 'senior-grandchild-visit'] as const;

describe('결혼·연애: 막다른 길이 없다 (R-045 e)', () => {
  it('결혼 "기다리자" 뒤에 다시 이야기가 나온다 (재등장 80% 이상)', () => {
    const t = tally(
      { ...PARTNER, 'youth-marriage': 'wait' },
      (f) => chose(f, 'youth-marriage', 'wait'),
      (f) => saw(f, 'youth-marriage-again'),
    );
    expect(t.n, '표본').toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.8);
  });

  it('두 번 기다리면 상대가 떠나가는 이벤트로 이어진다 (80% 이상) — 선택에는 값이 있다', () => {
    const t = tally(
      { ...PARTNER, 'youth-marriage': 'wait', 'youth-marriage-again': 'wait' },
      (f) => chose(f, 'youth-marriage-again', 'wait'),
      (f) => saw(f, 'youth-partner-leaves'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.8);
  });

  it('헤어진 뒤에 다시 만날 길이 있다: 헤어진 판의 50% 이상에서 "다시 온 연락"이 나온다', () => {
    const t = tally(
      { ...PARTNER, 'youth-marriage': 'part' },
      (f) => chose(f, 'youth-marriage', 'part'),
      (f) => saw(f, 'youth-reunion'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.5);
  });

  it('소개 자리를 미루면 뒤늦은 소개가 다시 온다 (50% 이상)', () => {
    const t = tally(
      { 'youth-meeting': 'later' },
      (f) => chose(f, 'youth-meeting', 'later'),
      (f) => saw(f, 'youth-meeting-again'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.5);
  });

  it('선택은 되돌릴 수 없는 방향도 만든다: "기다리자"를 고르지 않은 판에는 재등장 이벤트가 나오지 않는다', () => {
    const t = tally(
      { ...PARTNER, 'youth-marriage': 'marry' },
      (f) => chose(f, 'youth-marriage', 'marry'),
      (f) => saw(f, 'youth-marriage-again', 'youth-partner-leaves'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit).toBe(0);
  });
});

describe('아이·손주: 손주 이벤트는 아이를 둔 판에서만, 둔 판에서는 거의 항상 열린다 (R-045 e)', () => {
  const MARRY = { ...PARTNER, 'youth-marriage': 'marry' } as const;

  it('아이를 갖기로 한 판의 95% 이상에서 아이와 손주에 관한 이벤트가 하나 이상 나온다', () => {
    const t = tally(
      { ...MARRY, 'youth-child': 'have' },
      (f) => chose(f, 'youth-child', 'have'),
      (f) => saw(f, ...CHILD_EVENTS),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.95);
  });

  it('아이 없이 살기로 한 판에는 아이·손주 이벤트가 하나도 나오지 않는다', () => {
    const t = tally(
      { ...MARRY, 'youth-child': 'none' },
      (f) => chose(f, 'youth-child', 'none'),
      (f) => saw(f, ...CHILD_EVENTS, 'senior-estranged-child'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit).toBe(0);
  });

  it('아이를 미룬 판의 55% 이상에서 "늦어진 이야기"가 다시 나온다', () => {
    const t = tally(
      { ...MARRY, 'youth-child': 'later' },
      (f) => chose(f, 'youth-child', 'later'),
      (f) => saw(f, 'youth-child-again'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.55);
  });

  it('아이의 앞날에서 내 뜻을 밀어붙인 판에는 노년에 소원해진 자식 이벤트가 열릴 수 있다 (20% 이상), 그러지 않은 판에는 닫혀 있다', () => {
    const push = tally(
      { ...MARRY, 'youth-child': 'have', 'middle-child-school': 'push' },
      (f) => chose(f, 'middle-child-school', 'push'),
      (f) => saw(f, 'senior-estranged-child'),
      500,
    );
    expect(push.n).toBeGreaterThan(30);
    expect(push.hit / push.n).toBeGreaterThanOrEqual(0.2);
    const support = tally(
      { ...MARRY, 'youth-child': 'have', 'middle-child-school': 'support', 'middle-marriage-crisis': 'talk' },
      (f) => chose(f, 'middle-child-school', 'support') && !f.flags.includes('child_distant'),
      (f) => saw(f, 'senior-estranged-child'),
      500,
    );
    expect(support.n).toBeGreaterThan(30);
    expect(support.hit).toBe(0);
  });
});

describe('일·학업·건강: 선택이 이후 이벤트를 연다 (R-045 e)', () => {
  it('시험 준비를 이어 간 판의 90% 이상에서 합격 또는 불합격 소식이 나온다', () => {
    const t = tally(
      { 'youth-exam-prep': 'persist' },
      (f) => chose(f, 'youth-exam-prep', 'persist'),
      (f) => saw(f, 'youth-exam-passed', 'youth-exam-failed'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.9);
  });

  it('시험에 떨어진 뒤에도 길이 막히지 않는다: 첫 일자리 선택이 다시 열린 판이 50% 이상이다', () => {
    const t = tally(
      { 'youth-exam-prep': 'persist' },
      (f) => saw(f, 'youth-exam-failed'),
      (f) => saw(f, 'youth-first-job'),
      500,
    );
    expect(t.n).toBeGreaterThan(50);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.5);
  });

  it('배움을 미루고 돈을 모은 판의 75% 이상에서 "다시 돌아갈 자리"가 열린다', () => {
    const t = tally(
      { 'youth-night-study': 'save' },
      (f) => chose(f, 'youth-night-study', 'save'),
      (f) => saw(f, 'youth-return-school'),
      300,
    );
    expect(t.n).toBeGreaterThan(60);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.75);
  });

  it('퇴직금을 받고 나온 판의 50% 이상에서 "다시 구하는 일자리"가 나온다', () => {
    const t = tally(
      { 'middle-layoff': 'leave' },
      (f) => chose(f, 'middle-layoff', 'leave'),
      (f) => saw(f, 'middle-job-again'),
      250,
    );
    expect(t.n).toBeGreaterThan(80);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.5);
  });

  it('검진 결과를 미룬 판의 75% 이상에서 쓰러지는 이벤트가 나오고, 생활을 바꾼 판에서는 나오지 않는다', () => {
    const ignored = tally(
      { 'middle-health-check': 'postpone' },
      (f) => chose(f, 'middle-health-check', 'postpone'),
      (f) => saw(f, 'middle-health-crisis'),
    );
    expect(ignored.n).toBeGreaterThan(100);
    expect(ignored.hit / ignored.n).toBeGreaterThanOrEqual(0.75);
    const changed = tally(
      { 'middle-health-check': 'change', 'middle-health-check-later': 'exercise' },
      (f) => chose(f, 'middle-health-check', 'change'),
      (f) => saw(f, 'middle-health-crisis'),
    );
    expect(changed.n).toBeGreaterThan(100);
    expect(changed.hit).toBe(0);
  });

  it('전학 온 아이에게 먼저 말을 건 판의 80% 이상에서 오랜 친구 이야기(결혼식·재회·노년의 소식) 중 하나가 나온다', () => {
    const t = tally(
      { 'school-friend': 'greet' },
      (f) => chose(f, 'school-friend', 'greet'),
      (f) => saw(f, 'youth-friend-wedding', 'middle-friend-reunion', 'senior-old-friend'),
    );
    expect(t.n).toBeGreaterThan(100);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.8);
  });
});

describe('모든 이벤트에 닿을 수 있다: 네 가지 선택 전략으로 세 시대를 돌리면 (이벤트, 시대) 쌍이 빠짐없이 한 번 이상 나온다', () => {
  const covered = lazy(() => {
    const hit = new Map<string, number>();
    const strategies: Array<Strategy | 'last'> = ['random', 'first', 'auto', 'last'];
    for (const strategy of strategies) {
      for (const era of ERAS) {
        for (let i = 1; i <= 350; i++) {
          const seed = i * 7919 + 13;
          const chooser = strategy === 'last' ? (s: GameState) => s.pending!.choiceIds[s.pending!.choiceIds.length - 1] : chooserFor(strategy, seed);
          const f = playToEnd(startLife(seed, era), chooser).state;
          for (const id of Object.keys(f.seen)) hit.set(`${id}|${era}`, (hit.get(`${id}|${era}`) ?? 0) + 1);
        }
      }
    }
    return hit;
  });

  it('조건이 어긋나 영원히 열리지 않는 이벤트가 없다', () => {
    const hit = covered();
    const missing: string[] = [];
    for (const e of EVENT_POOL.events) for (const era of e.eras ?? ERAS) if ((hit.get(`${e.id}|${era}`) ?? 0) < 1) missing.push(`${e.id}(${era})`);
    expect(missing).toEqual([]);
  });

  it('이벤트가 한 시대에서만 나오도록 걸려 있으면 다른 시대에서는 나오지 않는다 (시대 전용 이벤트의 격리)', () => {
    const hit = covered();
    for (const e of EVENT_POOL.events) {
      if (e.eras === undefined) continue;
      for (const era of ERAS) if (!e.eras.includes(era)) expect(hit.get(`${e.id}|${era}`) ?? 0, `${e.id}가 ${era}에서 나왔다`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// 한 판 안에서 이미 일어난 일과 모순되는 이벤트가 나오지 않는다 (REV-001-M4-1 R-057~R-060, R-062, R-065)
//
// 형식은 모두 "한 판에서 X 뒤 Y 0건"이다. 단언이 공허하지 않도록 (1) X 뒤에 Y가 나올 수 있는 판(표본)이 충분히 있음을 세고,
// (2) 막는 조건을 일부러 지운 대조 풀에서는 같은 시드에서 Y가 실제로 나오는지 본다.
// ---------------------------------------------------------------------------------------------------------------------

/** 이벤트 하나가 일어난 순간: 나이·그때의 플래그(after: 바로 직후의 플래그), 선택지 이벤트면 화면에 보인 선택지와 고른 선택지 */
interface Occurrence {
  id: string;
  age: number;
  flags: readonly string[];
  after: readonly string[];
  visible?: readonly string[];
  choice?: string;
}

interface Life {
  seed: number;
  era: Era;
  parentWealth: number;
  final: GameState;
  occ: Occurrence[];
}

/** playToEnd와 같은 진행에 "이벤트가 일어난 순간의 플래그"를 기록한다 (진행 규칙은 같은 core 함수를 쓴다) */
function trace(seed: number, era: Era, chooser: (s: GameState) => string, pool: EventPool = EVENT_POOL): Life {
  let s = startLife(seed, era);
  const occ: Occurrence[] = [];
  for (let i = 0; s.phase === 'life'; i++) {
    if (i > 1000) throw new Error(`${era} ${seed}: 진행이 끝나지 않는다`);
    if (s.pending !== null) {
      const p = s.pending;
      const choice = chooser(s);
      const next = resolveChoiceStep(s, p.key, choice, pool).state;
      if (next === s) throw new Error(`${era} ${seed}: 선택이 적용되지 않았다`);
      occ.push({ id: p.eventId, age: p.age, flags: s.flags, after: next.flags, visible: p.choiceIds, choice });
      s = next;
    } else {
      const r = stepYear(s, pool);
      if ((r.tick.kind === 'narrative' || r.tick.kind === 'death') && r.tick.eventId !== undefined) occ.push({ id: r.tick.eventId, age: s.age, flags: s.flags, after: r.state.flags });
      s = r.state;
    }
  }
  return { seed, era, parentWealth: s.character!.parentWealth, final: s, occ };
}

function populate(rules: Record<string, string>, perEra: number, pool: EventPool = EVENT_POOL, eras: readonly Era[] = ERAS): Life[] {
  const out: Life[] = [];
  for (const era of eras) {
    for (let i = 1; i <= perEra; i++) {
      const seed = i * 7919 + 13;
      out.push(trace(seed, era, forced(rules, seed), pool));
    }
  }
  return out;
}

/** 조건 일부를 바꾼 대조 풀 (이벤트 id -> 바꾸는 함수) */
function poolWith(changes: Record<string, (e: EventDef) => EventDef>): EventPool {
  return createEventPool(EVENT_POOL.events.map((e) => (changes[e.id] ? changes[e.id](e) : e)));
}

const indexOfEvent = (l: Life, id: string) => l.occ.findIndex((o) => o.id === id);
const occurred = (l: Life, ...ids: string[]) => l.occ.some((o) => ids.includes(o.id));
/** id 이벤트에서 고른 선택지 (일어나지 않았거나 선택지 이벤트가 아니면 undefined) */
const pickedAt = (l: Life, id: string) => l.occ.find((o) => o.id === id)?.choice;
/** 앞 이벤트가 일어난 뒤에 뒤 이벤트(들)가 일어난 판의 수 */
const afterCount = (lives: readonly Life[], first: string, ...later: string[]) =>
  lives.filter((l) => {
    const i = indexOfEvent(l, first);
    return i >= 0 && l.occ.slice(i + 1).some((o) => later.includes(o.id));
  }).length;

/** 규칙 없이 무작위로 고른 세 시대 1500판 — 여러 단언이 함께 쓴다 */
const GENERAL = lazy(() => populate({}, 500));

const MARRIED_RULES = { 'youth-meeting': 'meet', 'youth-marriage': 'marry' } as const;

describe('한 판 안의 모순 0건: 부모님 (R-057) — 임종 뒤에 병환이 나오지 않는다', () => {
  const lives = GENERAL;

  it('임종 뒤 병환 0건: 병환 뒤 임종은 일어나지만(표본 15판 이상) 임종 뒤 병환은 한 판도 없다', () => {
    let careThenFarewell = 0;
    for (const l of lives()) {
      const c = indexOfEvent(l, 'middle-parents-care');
      const f = indexOfEvent(l, 'middle-parents-farewell');
      if (c >= 0 && f >= 0 && c < f) careThenFarewell++;
    }
    expect(careThenFarewell, '병환 뒤 임종이 있는 판').toBeGreaterThanOrEqual(15);
    expect(afterCount(lives(), 'middle-parents-farewell', 'middle-parents-care')).toBe(0);
  });

  it('대조: 병환 이벤트의 닫는 조건을 지우면 같은 시드들에서 임종 뒤 병환이 실제로 나온다 (위 단언이 공허하지 않다)', () => {
    const open = poolWith({ 'middle-parents-care': (e) => ({ ...e, conditions: undefined }) });
    expect(afterCount(populate({}, 300, open), 'middle-parents-farewell', 'middle-parents-care')).toBeGreaterThan(0);
  });

  it('임종을 알리는 이벤트는 어떤 선택으로 끝나도 parents_gone을 켜고, 그 뒤 "부모님"이 들어간 이벤트가 하나도 나오지 않는다', () => {
    const wordsOf = (id: string) => textPartsOf(EVENT_POOL.byId.get(id)!).some((p) => p.value.includes('부모님'));
    const mentioning = EVENT_POOL.events.filter((e) => e.stages.some((s) => s === 'middle' || s === 'senior') && wordsOf(e.id)).map((e) => e.id);
    expect(mentioning).toEqual(expect.arrayContaining(['middle-parents-care', 'middle-parents-farewell']));
    let farewells = 0;
    for (const l of lives()) {
      const f = indexOfEvent(l, 'middle-parents-farewell');
      if (f < 0) continue;
      farewells++;
      expect(l.final.flags, `${l.era} ${l.seed}`).toContain('parents_gone');
      const later = l.occ.slice(f + 1).map((o) => o.id);
      expect(later.filter((id) => mentioning.includes(id)), `${l.era} ${l.seed}: 임종 뒤 부모님이 나오는 이벤트`).toEqual([]);
    }
    expect(farewells).toBeGreaterThan(100);
  });
});

describe('한 판 안의 모순 0건: 아이 (R-058) — 독립한 아이가 다시 자라지 않고, 늦게 맞은 아이의 나이와 맞는다', () => {
  const normal = lazy(() => populate({ ...MARRIED_RULES, 'youth-child': 'have' }, 400));
  const late = lazy(() => populate({ ...MARRIED_RULES, 'youth-child': 'later', 'youth-child-again': 'have' }, 400));
  const CHILD_LIFE = ['middle-child-grows', 'middle-child-school'] as const;

  it('아이가 독립한 뒤(middle-child-leaves)에는 "어깨를 넘어섰다"(자라난 아이)·"앞날"(아이의 앞날)이 나오지 않는다 — 독립 뒤 이벤트 0건, 독립한 판은 표본 50판 이상', () => {
    const lives = normal();
    const left = lives.filter((l) => occurred(l, 'middle-child-leaves'));
    expect(left.length).toBeGreaterThanOrEqual(50);
    expect(afterCount(lives, 'middle-child-leaves', ...CHILD_LIFE)).toBe(0);
    for (const l of left) expect(l.final.flags, `${l.era} ${l.seed}`).toContain('child_left');
  });

  it('대조: 독립 표시(child_left)로 닫는 조건을 지우면 독립 뒤에도 자라난 아이·아이의 앞날이 나온다', () => {
    const open = poolWith({
      'middle-child-grows': (e) => ({ ...e, conditions: { flags: ['has_child'] } }),
      'middle-child-school': (e) => ({ ...e, ageRange: { min: 44, max: 58 }, conditions: { flags: ['has_child'] } }),
      'middle-child-leaves': (e) => ({ ...e, ageRange: { min: 50, max: 64 } }),
    });
    expect(afterCount(populate({ ...MARRIED_RULES, 'youth-child': 'have' }, 300, open), 'middle-child-leaves', ...CHILD_LIFE)).toBeGreaterThan(0);
  });

  it('아이의 나이: 아이를 맞은 나이(youth-child)로 재면 자라난 아이는 3살 이상, 아이의 앞날(진로)은 13살 이상, 독립은 19살 이상일 때만 나온다', () => {
    const MIN_CHILD_AGE: Record<string, number> = { 'middle-child-grows': 3, 'middle-child-school': 13, 'middle-child-leaves': 19 };
    const seen: Record<string, number> = {};
    for (const l of normal()) {
      const born = l.final.seen['youth-child'];
      if (born === undefined || !l.final.flags.includes('has_child')) continue;
      for (const o of l.occ) {
        const min = MIN_CHILD_AGE[o.id];
        if (min === undefined) continue;
        seen[o.id] = (seen[o.id] ?? 0) + 1;
        expect(o.age - born, `${l.era} ${l.seed}: ${o.id} (부모 ${o.age}세, 아이를 맞은 때 ${born}세)`).toBeGreaterThanOrEqual(min);
      }
    }
    for (const id of Object.keys(MIN_CHILD_AGE)) expect(seen[id] ?? 0, `${id} 표본`).toBeGreaterThanOrEqual(40);
  });

  it('손주 이야기(손주를 맡아 달라는 부탁·찾아온 아이들)는 아이가 24살 이상일 때만 나온다 — 늦게 맞은 아이(44세)에게도 성립한다', () => {
    let n = 0;
    for (const [lives, bornId] of [[normal(), 'youth-child'], [late(), 'youth-child-again']] as const) {
      for (const l of lives) {
        const born = l.final.seen[bornId];
        if (born === undefined || !l.final.flags.includes('has_child')) continue;
        for (const o of l.occ) {
          if (o.id !== 'senior-grandchildren' && o.id !== 'senior-grandchild-visit') continue;
          n++;
          expect(o.age - born, `${l.era} ${l.seed}: ${o.id}`).toBeGreaterThanOrEqual(24);
        }
      }
    }
    expect(n).toBeGreaterThan(100);
  });

  it('늦게 맞은 아이(아이를 미루다 늦게 맞이함, child_late)에게는 독립·진로·"어깨를 넘어섰다"가 나오지 않고, 대신 늦둥이 이야기가 아이가 4살 이상일 때 나온다', () => {
    const lives = late().filter((l) => l.final.flags.includes('child_late'));
    expect(lives.length).toBeGreaterThanOrEqual(60);
    let lateStories = 0;
    for (const l of lives) {
      expect(occurred(l, 'middle-child-grows', 'middle-child-school', 'middle-child-leaves'), `${l.era} ${l.seed}`).toBe(false);
      expect(l.final.flags, `${l.era} ${l.seed}`).not.toContain('child_left');
      const o = l.occ.find((x) => x.id === 'middle-late-child');
      if (o === undefined) continue;
      lateStories++;
      expect(o.age - l.final.seen['youth-child-again'], `${l.era} ${l.seed}: 늦둥이 이야기`).toBeGreaterThanOrEqual(4);
    }
    expect(lateStories, '늦둥이 이야기가 나온 판').toBeGreaterThanOrEqual(15);
  });

  it('대조: 늦게 맞은 아이를 가리지 않는 옛 조건(44~58세, child_late 닫음 없음)이면 아이가 어린데 진로·독립이 나온다', () => {
    const open = poolWith({
      'middle-child-school': (e) => ({ ...e, ageRange: { min: 44, max: 58 }, conditions: { flags: ['has_child'] } }),
      'middle-child-leaves': (e) => ({ ...e, ageRange: { min: 50, max: 64 }, conditions: { flags: ['has_child'] } }),
    });
    const lives = populate({ ...MARRIED_RULES, 'youth-child': 'later', 'youth-child-again': 'have' }, 300, open);
    let tooYoung = 0;
    for (const l of lives) {
      const born = l.final.seen['youth-child-again'];
      if (born === undefined) continue;
      for (const o of l.occ) if ((o.id === 'middle-child-school' && o.age - born < 13) || (o.id === 'middle-child-leaves' && o.age - born < 19)) tooYoung++;
    }
    expect(tooYoung).toBeGreaterThan(0);
  });
});

/** 연표에 남은 글 가운데 성인기(20세 이후) 이벤트의 모든 문구 */
function adultTexts(l: Life): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  for (const h of l.final.history) {
    if ((h.kind !== 'event' && h.kind !== 'choice') || h.age < 20 || h.eventId === undefined) continue;
    out.push({ id: h.eventId, text: `${h.title ?? ''} ${h.text} ${h.choice ?? ''}` });
  }
  return out;
}

describe('한 판 안의 모순 0건: 가족 상태와 문구 (R-059) — 자식 없는 판에 "자식", 미혼 판에 "배우자", 기혼 판에 "혼자"가 나오지 않는다', () => {
  const [CHILD_WORDS, SPOUSE_WORDS] = [STATE_WORD_RULES[0].words, STATE_WORD_RULES[1].words];
  const childless = lazy(() => [...GENERAL(), ...populate({ ...MARRIED_RULES, 'youth-child': 'none' }, 250), ...populate({ 'youth-meeting': 'later', 'youth-matchmaker': 'decline' }, 250)]);

  it('아이를 두지 않은 판(has_child 없음)의 성인기 연표에는 자식·손주·아들·딸·아이가 나오지 않는다 (아이를 가질지 정하는 두 이벤트 제외)', () => {
    let checked = 0;
    for (const l of childless()) {
      if (l.final.flags.includes('has_child')) continue;
      checked++;
      for (const t of adultTexts(l)) {
        if (t.id === 'youth-child' || t.id === 'youth-child-again') continue;
        expect(CHILD_WORDS.test(t.text), `${l.era} ${l.seed}: ${t.id} — "${t.text}"`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(800);
  });

  it('결혼한 적 없는 판(married·divorced 없음)의 연표에는 배우자·남편·아내·부부가 나오지 않는다', () => {
    let checked = 0;
    for (const l of childless()) {
      if (l.final.flags.includes('married') || l.final.flags.includes('divorced')) continue;
      checked++;
      for (const t of adultTexts(l)) expect(SPOUSE_WORDS.test(t.text), `${l.era} ${l.seed}: ${t.id} — "${t.text}"`).toBe(false);
    }
    expect(checked).toBeGreaterThan(800);
  });

  it('기혼일 때(그 이벤트가 일어난 순간 married가 켜져 있을 때)는 "혼자"가 들어간 글이 보이지 않는다', () => {
    const lives = [...childless(), ...populate({ ...MARRIED_RULES }, 300)];
    let marriedOccurrences = 0;
    for (const l of lives) {
      for (const o of l.occ) {
        const ev = EVENT_POOL.byId.get(o.id)!;
        if (!ev.stages.some((s) => s !== 'infant' && s !== 'school')) continue;
        const shown = [ev.title, ev.text, ...(ev.choices ?? []).filter((c) => o.visible?.includes(c.id)).map((c) => c.label), ...(ev.choices ?? []).filter((c) => c.id === o.choice).map((c) => c.result)].join(' ');
        if (o.flags.includes('married')) {
          marriedOccurrences++;
          expect(/혼자/.test(shown), `${l.era} ${l.seed}: 기혼인데 ${o.id}에 "혼자" — "${shown}"`).toBe(false);
        }
      }
    }
    expect(marriedOccurrences).toBeGreaterThan(2000);
  });

  it('연락이 끊긴 자식(child_distant)과 손주 돌봄은 한 판에 함께 나오지 않는다 — 그 상태에서 손주 이벤트·손주 돌봄 선택지·자식 곁으로 옮기는 선택지가 보이지 않는다', () => {
    const estranged = lazy(() =>
      populate({ ...MARRIED_RULES, 'youth-child': 'have', 'middle-child-school': 'push', 'senior-estranged-child': 'wait', 'senior-gathering': 'grandchildren', 'senior-move-home': 'child' }, 450),
    );
    let distantSenior = 0;
    for (const l of estranged()) {
      for (const o of l.occ) {
        if (!o.flags.includes('child_distant')) continue;
        if (EVENT_POOL.byId.get(o.id)!.stages.includes('senior')) distantSenior++;
        expect(['senior-grandchildren', 'senior-grandchild-visit'], `${l.era} ${l.seed}: 소원한 자식과 ${o.id}`).not.toContain(o.id);
        if (o.id === 'senior-gathering') expect(o.visible, `${l.era} ${l.seed}: 소원한데 손주 돌봄 선택지`).not.toContain('grandchildren');
        if (o.id === 'senior-move-home') expect(o.visible, `${l.era} ${l.seed}: 소원한데 자식 곁으로`).not.toContain('child');
      }
    }
    expect(distantSenior, '소원한 상태로 노년 이벤트를 만난 횟수').toBeGreaterThan(100);
    // 대조: 막는 조건을 지우면 같은 시드들에서 실제로 나온다
    const open = poolWith({
      'senior-grandchildren': (e) => ({ ...e, conditions: { flags: ['has_child'] } }),
      'senior-grandchild-visit': (e) => ({ ...e, conditions: { flags: ['has_child'], stats: { relationships: { min: 46 } } } }),
    });
    let leaked = 0;
    for (const l of populate({ ...MARRIED_RULES, 'youth-child': 'have', 'middle-child-school': 'push', 'senior-estranged-child': 'wait' }, 400, open)) {
      for (const o of l.occ) if (o.flags.includes('child_distant') && (o.id === 'senior-grandchildren' || o.id === 'senior-grandchild-visit')) leaked++;
    }
    expect(leaked).toBeGreaterThan(0);
  });

  it('화해하면 길이 다시 열린다: 소원해진 자식에게 먼저 연락한 판에서는 그 뒤에 손주 이야기가 나올 수 있다 (child_distant가 풀린다)', () => {
    const lives = populate({ ...MARRIED_RULES, 'youth-child': 'have', 'middle-child-school': 'push', 'senior-estranged-child': 'call' }, 450);
    const called = lives.filter((l) => pickedAt(l, 'senior-estranged-child') === 'call');
    expect(called.length).toBeGreaterThanOrEqual(30);
    for (const l of called) {
      const i = indexOfEvent(l, 'senior-estranged-child');
      expect(l.occ[i].flags, `${l.era} ${l.seed}`).toContain('child_distant');
      expect(l.final.flags, `${l.era} ${l.seed}: 화해한 뒤`).not.toContain('child_distant');
    }
    expect(afterCount(called, 'senior-estranged-child', 'senior-grandchildren', 'senior-grandchild-visit'), '화해 뒤 손주 이야기가 나온 판').toBeGreaterThan(0);
  });
});

describe('한 판 안의 모순 0건: 재력·학업 (R-060) — 고재력 판에 "우리 집에 없다", 학업 중단 뒤 입시가 나오지 않는다', () => {
  const lives = GENERAL;

  it('부모 재력 4·5단계 판에는 "말하지 않는 격차"(우리 집에 없다는 사실)가 나오지 않고, 1~3단계 판에는 나올 수 있다', () => {
    let rich = 0;
    let modest = 0;
    let modestGap = 0;
    for (const l of lives()) {
      if (l.parentWealth >= 4) {
        rich++;
        expect(occurred(l, 'school-money-gap'), `${l.era} ${l.seed}: 재력 ${l.parentWealth}`).toBe(false);
      } else {
        modest++;
        if (occurred(l, 'school-money-gap')) modestGap++;
      }
    }
    expect(rich).toBeGreaterThan(200);
    expect(modestGap / modest, '재력 1~3단계에서 이 이벤트를 만나는 비율').toBeGreaterThan(0.1);
  });

  it('집안 사정으로 학교를 접은 판(school-family-priority "집안의 결정을 따른다")에서는 그 뒤 입시·학교 생활 이벤트가 하나도 나오지 않는다', () => {
    const IN_SCHOOL = ['school-exam', 'school-tutoring', 'school-club', 'school-bully', 'school-teacher-notice', 'school-scholarship', 'school-friend-quarrel', 'school-career-choice', 'school-parttime', 'school-first-love', 'school-early-work', 'school-friend', 'school-lunch', 'school-long-walk'];
    const dropped = populate({ 'school-family-priority': 'accept' }, 500, EVENT_POOL, ['past']).filter((l) => pickedAt(l, 'school-family-priority') === 'accept');
    expect(dropped.length, '학교를 접은 판').toBeGreaterThanOrEqual(40);
    for (const l of dropped) {
      const i = indexOfEvent(l, 'school-family-priority');
      expect(l.final.flags, `${l.era} ${l.seed}`).toEqual(expect.arrayContaining(['left_school', 'early_work']));
      expect(l.occ.slice(i + 1).filter((o) => IN_SCHOOL.includes(o.id)).map((o) => o.id), `${l.era} ${l.seed}: 학교를 접은 뒤`).toEqual([]);
      expect(l.final.flags, `${l.era} ${l.seed}`).not.toContain('college'); // 입시 선택(college)을 한 적이 없다
    }
  });

  it('대조: 닫는 조건(left_school)을 지우면 학교를 접은 뒤에도 입시가 실제로 나온다', () => {
    const open = poolWith({ 'school-exam': (e) => ({ ...e, conditions: undefined }) });
    const dropped = populate({ 'school-family-priority': 'accept' }, 500, open, ['past']).filter((l) => pickedAt(l, 'school-family-priority') === 'accept');
    expect(afterCount(dropped, 'school-family-priority', 'school-exam')).toBeGreaterThan(0);
  });
});

describe('한 판 안의 모순 0건: 일·집 상태 (R-065) — 가업·시험 합격 판의 해고, 이미 집이 있는 판의 집 구하기', () => {
  const lives = GENERAL;

  it('가업을 이은 판(family_business)과 시험에 합격한 판(passed_exam)에는 정리 해고(middle-layoff)가 나오지 않는다', () => {
    const family = populate({ 'youth-first-job': 'family' }, 400).filter((l) => l.final.flags.includes('family_business'));
    const passed = populate({ 'youth-exam-prep': 'persist' }, 400).filter((l) => l.final.flags.includes('passed_exam'));
    expect(family.length).toBeGreaterThanOrEqual(30);
    expect(passed.length).toBeGreaterThanOrEqual(30);
    for (const l of [...family, ...passed]) expect(occurred(l, 'middle-layoff'), `${l.era} ${l.seed}`).toBe(false);
    // 일반 판에서는 해고 이야기가 나온다 (닫힌 것은 이 두 경우뿐이다)
    expect(lives().filter((l) => occurred(l, 'middle-layoff')).length).toBeGreaterThan(50);
  });

  it('이미 직장이 있는 판(has_career)에는 "쪼개진 일자리"(youth-gig-work)가 나오지 않고, 직업이 없는 판에는 나올 수 있다', () => {
    let gig = 0;
    for (const l of lives()) {
      for (const o of l.occ) {
        if (o.id !== 'youth-gig-work') continue;
        gig++;
        expect(o.flags, `${l.era} ${l.seed}`).not.toContain('has_career');
      }
    }
    expect(gig).toBeGreaterThan(15);
  });

  it('검진: "다시 받은 결과"는 첫 검진을 받은 판에서만, 그 뒤에 나온다', () => {
    let later = 0;
    for (const l of lives()) {
      const j = indexOfEvent(l, 'middle-health-check-later');
      if (j < 0) continue;
      later++;
      const i = indexOfEvent(l, 'middle-health-check');
      expect(i, `${l.era} ${l.seed}: 첫 검진 없이 "다시 받은 결과"`).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(j);
    }
    expect(later).toBeGreaterThan(80);
  });

  it('집 구하기(youth-housing)는 결혼했거나 이미 집이 있는 판에는 나오지 않고, 월세 인상은 월세방을 구한 판에서만 나오며, "함께 살 사람을 구한다"는 미혼일 때만 고를 수 있다', () => {
    let housing = 0;
    let hikes = 0;
    let shareVisible = 0;
    for (const l of [...lives(), ...populate({ ...MARRIED_RULES, 'youth-housing': 'rent' }, 300)]) {
      for (const o of l.occ) {
        if (o.id === 'youth-housing') {
          housing++;
          expect(o.flags, `${l.era} ${l.seed}: 기혼인데 집 구하기`).not.toContain('married');
          expect(o.flags, `${l.era} ${l.seed}: 자가인데 집 구하기`).not.toContain('own_home');
        }
        if (o.id === 'youth-rent-hike') {
          hikes++;
          expect(o.flags, `${l.era} ${l.seed}: 월세방 없이 월세 인상`).toContain('renting');
          expect(o.flags, `${l.era} ${l.seed}`).not.toContain('own_home');
          if (o.visible?.includes('share')) {
            shareVisible++;
            expect(o.flags, `${l.era} ${l.seed}: 기혼인데 함께 살 사람을 구한다`).not.toContain('married');
          }
        }
      }
    }
    expect(housing).toBeGreaterThan(300);
    expect(hikes).toBeGreaterThan(20);
    expect(shareVisible).toBeGreaterThan(5);
  });
});

describe('한 판 안의 모순 0건: 일 상태와 문구 (R-065) — 직장이 없는 판에 출근·일터·회사가 나오지 않는다', () => {
  it('성인기에 직업 플래그(has_career·own_business)가 없을 때 일터 어휘(일터·출근·퇴근·직장·회사·상사·동료)가 보이는 판이 한 판도 없다', () => {
    const WORK = STATE_WORD_RULES[3].words;
    let jobless = 0;
    let violations = 0;
    for (const l of [...GENERAL(), ...populate({ 'youth-exam-prep': 'persist', 'youth-night-study': 'study' }, 250)]) {
      for (const o of l.occ) {
        const ev = EVENT_POOL.byId.get(o.id)!;
        if (!ev.stages.some((s) => s === 'youth' || s === 'middle' || s === 'senior')) continue;
        const shown = [ev.title, ev.text, ...(ev.choices ?? []).filter((c) => o.visible?.includes(c.id)).map((c) => c.label), ...(ev.choices ?? []).filter((c) => c.id === o.choice).map((c) => c.result)].join(' ');
        if (o.flags.includes('has_career') || o.flags.includes('own_business')) continue;
        jobless++;
        if (WORK.test(shown)) violations++;
      }
    }
    expect(jobless, '직업이 없는 상태에서 일어난 성인기 이벤트').toBeGreaterThan(1000);
    expect(violations, '그중 일터 어휘가 보인 것').toBe(0);
  });
});

describe('재회 뒤 결혼 경로와 이혼 뒤 상태 (R-062) — 헤어짐·재회 뒤에도 흐름이 멈추지 않는다', () => {
  const REUNION = { ...{ 'youth-meeting': 'meet', 'youth-marriage': 'part', 'youth-reunion': 'meet' } } as const;

  it('헤어졌다 다시 만난 판의 70% 이상에서 결혼 이야기("다시 이어진 사이")가 다시 나온다', () => {
    const t = tally(
      REUNION,
      (f) => chose(f, 'youth-reunion', 'meet'),
      (f) => saw(f, 'youth-second-chance'),
      400,
    );
    expect(t.n).toBeGreaterThan(60);
    expect(t.hit / t.n).toBeGreaterThanOrEqual(0.7);
  });

  it('재회 뒤 결혼을 고르면 결혼 상태가 되고(married), 그 뒤 아이 이야기(youth-child)가 다시 열린다', () => {
    const lives = populate({ ...REUNION, 'youth-second-chance': 'marry' }, 400).filter((l) => pickedAt(l, 'youth-second-chance') === 'marry');
    expect(lives.length).toBeGreaterThanOrEqual(40);
    for (const l of lives) {
      const i = indexOfEvent(l, 'youth-second-chance');
      expect(l.occ[i].flags, `${l.era} ${l.seed}`).toEqual(expect.arrayContaining(['has_partner', 'reunited']));
      expect(l.occ[i].flags).not.toContain('married');
      expect(l.occ[i].after, `${l.era} ${l.seed}`).toContain('married');
      expect(l.occ[i].after).not.toContain('reunited');
    }
    expect(afterCount(lives, 'youth-second-chance', 'youth-child', 'middle-marriage-crisis', 'senior-spouse-care'), '결혼한 뒤 가족 이벤트가 이어진 판').toBeGreaterThan(lives.length / 4);
  });

  it('재회 뒤에는 결혼 이야기를 한 번만 한다 (once) — 다시 이별을 택한 판도 막다른 길이 아니다', () => {
    const parted = populate({ ...REUNION, 'youth-second-chance': 'part' }, 400).filter((l) => pickedAt(l, 'youth-second-chance') === 'part');
    expect(parted.length).toBeGreaterThanOrEqual(30);
    for (const l of parted) {
      const i = indexOfEvent(l, 'youth-second-chance');
      expect(l.occ[i].after, `${l.era} ${l.seed}`).not.toContain('has_partner');
      expect(l.occ[i].after).not.toContain('reunited');
      expect(l.occ.filter((o) => o.id === 'youth-second-chance')).toHaveLength(1);
    }
  });

  it('이혼(별거)하면 has_partner도 함께 풀린다 — 이혼한 뒤에는 결혼 이야기(youth-marriage 계열)·연인 이야기가 나오지 않는다', () => {
    const lives = populate({ ...MARRIED_RULES, 'middle-marriage-crisis': 'apart' }, 450).filter((l) => pickedAt(l, 'middle-marriage-crisis') === 'apart');
    expect(lives.length).toBeGreaterThanOrEqual(30);
    for (const l of lives) {
      const after = l.occ[indexOfEvent(l, 'middle-marriage-crisis')].after;
      expect(after, `${l.era} ${l.seed}`).toContain('divorced');
      expect(after).not.toContain('married');
      expect(after, `${l.era} ${l.seed}: 이혼했는데 연인(has_partner)`).not.toContain('has_partner');
    }
    expect(afterCount(lives, 'middle-marriage-crisis', 'youth-marriage', 'youth-marriage-again', 'youth-second-chance', 'youth-partner-leaves', 'senior-spouse-care', 'middle-both-working')).toBe(0);
    // 대조: has_partner를 풀지 않던 옛 방식이면 이혼한 뒤에도 연인 상태가 남는다
    const old = poolWith({
      'middle-marriage-crisis': (e) => ({
        ...e,
        choices: e.choices!.map((c) => (c.id === 'apart' ? { ...c, effects: { ...c.effects, clearFlags: ['married'] } } : c)),
      }),
    });
    const oldLives = populate({ ...MARRIED_RULES, 'middle-marriage-crisis': 'apart' }, 300, old).filter((l) => pickedAt(l, 'middle-marriage-crisis') === 'apart');
    expect(oldLives.filter((l) => l.occ[indexOfEvent(l, 'middle-marriage-crisis')].after.includes('has_partner')).length, '옛 방식에서 이혼 직후에도 has_partner가 남은 판').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// REV-001-M4-2 R-072~R-075 (M5에서 반영): 이미 일어난 일(사업·학교를 접음·늦게 맞은 아이·거처)과 어긋나는 이벤트가 한 판에 나오지 않는다.
// 같은 방식: (1) 한 판에서 X 뒤 Y 0건, (2) 막는 조건을 일부러 되돌린 대조 풀에서는 같은 시드에서 Y가 실제로 나온다.
// ---------------------------------------------------------------------------------------------------------------------

/** 그 이벤트에서 이 판에 실제로 보인 모든 글(제목·본문·보인 선택지 문구·고른 선택지의 결과) */
function shownText(o: Occurrence): string {
  const ev = EVENT_POOL.byId.get(o.id)!;
  return [ev.title, ev.text, ...(ev.choices ?? []).filter((c) => o.visible?.includes(c.id)).map((c) => c.label), ...(ev.choices ?? []).filter((c) => c.id === o.choice).map((c) => c.result)].join(' ');
}

describe('한 판 안의 모순 0건: 직장 없이 사업을 시작한 판 (R-072) — "일자리를 고를 수 있는"·"지원서를 낸 곳"·"공장 밤샘 근무"가 나오지 않는다', () => {
  const RULES = { 'youth-startup': 'start' } as const;
  const JOB_EVENTS = ['youth-first-job', 'youth-job-rejections', 'youth-gig-work', 'youth-factory-night'] as const;
  /** 직장(has_career) 없이 사업을 시작한 순간이 있는 판 */
  const startedWithoutJob = (lives: readonly Life[]) =>
    lives.filter((l) => {
      const o = l.occ.find((x) => x.id === 'youth-startup');
      return o !== undefined && o.choice === 'start' && !o.flags.includes('has_career');
    });
  const lives = lazy(() => startedWithoutJob(populate(RULES, 500)));

  it('사업을 시작한 뒤에는 첫 일자리 고르기·지원서 소식 없음·쪼개진 일자리·공장 밤샘이 한 판도 나오지 않는다 (표본 60판 이상)', () => {
    expect(lives().length, '직장 없이 사업을 시작한 판').toBeGreaterThanOrEqual(60);
    for (const l of lives()) {
      const i = indexOfEvent(l, 'youth-startup');
      expect(l.occ[i].after, `${l.era} ${l.seed}`).toContain('own_business');
      expect(l.occ.slice(i + 1).filter((o) => (JOB_EVENTS as readonly string[]).includes(o.id)).map((o) => o.id), `${l.era} ${l.seed}: 사업을 시작한 뒤`).toEqual([]);
    }
  });

  it('어느 판이든 사업을 하는 동안(own_business) 일어난 이벤트에는 위 네 가지가 없다', () => {
    let businessEvents = 0;
    for (const l of [...GENERAL(), ...lives()]) {
      for (const o of l.occ) {
        if (!o.flags.includes('own_business')) continue;
        businessEvents++;
        expect(JOB_EVENTS as readonly string[], `${l.era} ${l.seed}: ${o.id}`).not.toContain(o.id);
      }
    }
    expect(businessEvents).toBeGreaterThan(500);
  });

  it('직장도 사업도 없는 판에서는 그대로 나온다 (닫힌 것은 사업을 시작한 판뿐이다)', () => {
    let seen = 0;
    for (const l of GENERAL()) for (const o of l.occ) if (o.id === 'youth-first-job' || o.id === 'youth-job-rejections' || o.id === 'youth-gig-work') seen++;
    expect(seen).toBeGreaterThan(100);
  });

  it('대조: own_business 닫음을 되돌린 풀(예전 조건)에서는 같은 시드에서 사업을 시작한 뒤에도 이 이벤트들이 실제로 나온다', () => {
    const old = poolWith({
      'youth-first-job': (e) => ({ ...e, conditions: { notFlags: ['has_career'] } }),
      'youth-job-rejections': (e) => ({ ...e, conditions: { notFlags: ['has_career'] } }),
      'youth-gig-work': (e) => ({ ...e, conditions: { notFlags: ['has_career'] } }),
      'youth-factory-night': (e) => ({ ...e, conditions: { parentWealth: { max: 3 } } }),
    });
    const control = startedWithoutJob(populate(RULES, 500, old));
    const hits: Record<string, number> = {};
    for (const l of control) {
      const i = indexOfEvent(l, 'youth-startup');
      for (const o of l.occ.slice(i + 1)) if ((JOB_EVENTS as readonly string[]).includes(o.id)) hits[o.id] = (hits[o.id] ?? 0) + 1;
    }
    expect(Object.values(hits).reduce((a, b) => a + b, 0), `옛 조건에서 사업 뒤에 나온 일자리 이벤트: ${JSON.stringify(hits)}`).toBeGreaterThan(5);
    expect(Object.keys(hits).length, '네 가지 중 둘 이상은 실제로 나온다').toBeGreaterThanOrEqual(2);
  });

  it('시험에 합격한 판(passed_exam)에는 합격한 뒤 공장 밤샘 근무가 나오지 않는다 (지난 세상, 재력 1~3단계에서 열리는 이벤트)', () => {
    const passed = populate({ 'youth-exam-prep': 'persist' }, 700, EVENT_POOL, ['past']).filter((l) => l.final.flags.includes('passed_exam'));
    expect(passed.length).toBeGreaterThanOrEqual(30);
    for (const l of passed) {
      const o = l.occ.find((x) => x.id === 'youth-factory-night');
      const passedAt = l.occ.find((x) => x.id === 'youth-exam-passed');
      if (o !== undefined && passedAt !== undefined) expect(o.age, `${l.era} ${l.seed}: 합격한 뒤 공장 밤샘`).toBeLessThan(passedAt.age);
    }
  });
});

describe('한 판 안의 모순 0건: 학교를 접은 판 (R-073) — "학교에서 돌아오면"이 나오지 않는다', () => {
  it('집 앞의 강아지(school-puppy)의 어느 문구에도 "학교"가 없다 (중립 문구)', () => {
    const ev = EVENT_POOL.byId.get('school-puppy')!;
    for (const p of textPartsOf(ev)) expect(p.value, p.where).not.toContain('학교');
  });

  it('학교를 접은 판(left_school)에서도 강아지 이야기는 나올 수 있고, 그때 보이는 글에 "학교"가 없다', () => {
    const dropped = populate({ 'school-family-priority': 'accept', 'school-puppy': 'keep' }, 800, EVENT_POOL, ['past']).filter((l) => pickedAt(l, 'school-family-priority') === 'accept');
    expect(dropped.length).toBeGreaterThanOrEqual(100);
    let puppy = 0;
    for (const l of dropped) {
      const i = indexOfEvent(l, 'school-family-priority');
      for (const o of l.occ.slice(i + 1)) {
        if (o.id !== 'school-puppy') continue;
        puppy++;
        expect(o.flags, `${l.era} ${l.seed}`).toContain('left_school');
        expect(shownText(o), `${l.era} ${l.seed}: 학교를 접은 뒤의 강아지 이야기`).not.toContain('학교');
      }
    }
    expect(puppy, '학교를 접은 뒤 강아지 이야기가 나온 판').toBeGreaterThanOrEqual(5);
  });

  it('대조: 예전 문구("학교에서 돌아오면")였다면 학교를 접은 판에서 실제로 "학교"가 보인다', () => {
    const old = poolWith({
      'school-puppy': (e) => ({
        ...e,
        choices: e.choices!.map((c) => (c.id === 'keep' ? { ...c, result: c.result.replace('하루를 마치고 돌아오면', '학교에서 돌아오면') } : c)),
      }),
    });
    const dropped = populate({ 'school-family-priority': 'accept', 'school-puppy': 'keep' }, 800, old, ['past']).filter((l) => pickedAt(l, 'school-family-priority') === 'accept');
    const violations = dropped.filter((l) => {
      const i = indexOfEvent(l, 'school-family-priority');
      return l.occ.slice(i + 1).some((o) => o.id === 'school-puppy' && o.choice === 'keep');
    });
    expect(violations.length, '학교를 접은 뒤 "데려와 기른다"까지 간 판').toBeGreaterThan(0);
    expect(old.byId.get('school-puppy')!.choices!.find((c) => c.id === 'keep')!.result).toContain('학교에서 돌아오면');
  });
});

describe('한 판 안의 모순 0건: 늦게 맞은 아이 (R-074) — 66~67세에 "손주를 돌본다"가 보이지 않는다', () => {
  const late = lazy(() => populate({ ...MARRIED_RULES, 'youth-child': 'later', 'youth-child-again': 'have' }, 250).filter((l) => l.final.flags.includes('child_late')));
  const normal = lazy(() => populate({ ...MARRIED_RULES, 'youth-child': 'have' }, 300).filter((l) => l.final.flags.includes('has_child') && !l.final.flags.includes('child_late')));
  const gatherings = (lives: readonly Life[]) => lives.flatMap((l) => l.occ.filter((o) => o.id === 'senior-gathering').map((o) => ({ l, o })));

  it('늦게 맞은 아이(child_late)가 있는 판의 "넉넉해진 시간"에는 "손주를 돌본다"가 보이지 않는다 (표본: 늦게 맞은 아이 60판, 이 이벤트가 나온 판 10판 이상)', () => {
    expect(late().length).toBeGreaterThanOrEqual(60);
    const g = gatherings(late());
    expect(g.length, '이 이벤트가 나온 판').toBeGreaterThanOrEqual(10);
    for (const { l, o } of g) expect(o.visible, `${l.era} ${l.seed}: ${o.age}세`).not.toContain('grandchildren');
  });

  it('아이를 일찍 맞은 판(손주를 볼 나이의 아이가 있는 판)에서는 그대로 보인다 — 닫힌 것은 늦게 맞은 아이뿐이다', () => {
    const g = gatherings(normal());
    expect(g.length).toBeGreaterThanOrEqual(30);
    expect(g.filter(({ o }) => o.visible?.includes('grandchildren')).length, '"손주를 돌본다"가 보인 판').toBeGreaterThanOrEqual(15);
  });

  it('"손주를 돌본다"가 보인 모든 판의 아이는 그때 24살 이상이다 (아이를 맞은 나이로 잰다)', () => {
    let n = 0;
    for (const [lives, bornId] of [[normal(), 'youth-child'], [late(), 'youth-child-again']] as const) {
      for (const { l, o } of gatherings(lives)) {
        if (!o.visible?.includes('grandchildren')) continue;
        n++;
        expect(o.age - l.final.seen[bornId], `${l.era} ${l.seed}`).toBeGreaterThanOrEqual(24);
      }
    }
    expect(n).toBeGreaterThan(15);
  });

  it('대조: child_late 닫음을 되돌린 풀(예전 조건)에서는 늦게 맞은 아이 판에서도 "손주를 돌본다"가 실제로 보인다', () => {
    const old = poolWith({
      'senior-gathering': (e) => ({
        ...e,
        choices: e.choices!.map((c) => (c.id === 'grandchildren' ? { ...c, requires: { flags: ['has_child'], notFlags: ['child_distant'] } } : c)),
      }),
    });
    const lives = populate({ ...MARRIED_RULES, 'youth-child': 'later', 'youth-child-again': 'have' }, 250, old).filter((l) => l.final.flags.includes('child_late'));
    const bad = gatherings(lives).filter(({ o }) => o.visible?.includes('grandchildren'));
    expect(bad.length).toBeGreaterThan(0);
  });
});

describe('한 판 안의 모순 0건: 거처 (R-075) — 부모님 집에 머문 뒤 "혼자 먹는 저녁", 살던 집을 떠난 뒤 "혼자 지내는 집"·"익숙한 집"이 나오지 않는다', () => {
  it('부모님 집에 머물기로 한 판(lives_with_parents)에는 그 뒤 "혼자 먹는 저녁"이 나오지 않는다', () => {
    const stayed = populate({ 'youth-housing': 'parents' }, 400).filter((l) => pickedAt(l, 'youth-housing') === 'parents');
    expect(stayed.length, '부모님 집에 머문 판').toBeGreaterThanOrEqual(100);
    for (const l of stayed) {
      expect(l.occ[indexOfEvent(l, 'youth-housing')].after, `${l.era} ${l.seed}`).toContain('lives_with_parents');
      expect(afterCount([l], 'youth-housing', 'youth-lonely-city'), `${l.era} ${l.seed}`).toBe(0);
    }
    // 이 이벤트는 다른 판에서는 나온다 (닫힌 것은 부모님 집에 머문 뒤뿐이다)
    expect(GENERAL().filter((l) => occurred(l, 'youth-lonely-city')).length).toBeGreaterThan(50);
  });

  it('대조: lives_with_parents 닫음을 되돌린 풀에서는 부모님 집에 머문 뒤에도 "혼자 먹는 저녁"이 실제로 나온다', () => {
    const old = poolWith({ 'youth-lonely-city': (e) => ({ ...e, conditions: { notFlags: ['married'] } }) });
    const stayed = populate({ 'youth-housing': 'parents' }, 400, old).filter((l) => pickedAt(l, 'youth-housing') === 'parents');
    expect(afterCount(stayed, 'youth-housing', 'youth-lonely-city')).toBeGreaterThan(0);
  });

  const MOVED = [
    ['자식 곁으로 옮긴다', 'child'],
    ['돌봄이 있는 곳으로 간다', 'facility'],
  ] as const;
  for (const [label, choice] of MOVED) {
    it(`"${label}"를 고른 판(moved_home)에는 그 뒤 "혼자 사는 집"이 나오지 않고, "점점 깊어지는 병"의 선택지에 "익숙한 집에서 지낸다"가 보이지 않는다`, () => {
      const moved = populate({ ...MARRIED_RULES, 'youth-child': 'have', 'senior-move-home': choice }, 500).filter((l) => pickedAt(l, 'senior-move-home') === choice);
      expect(moved.length, label).toBeGreaterThanOrEqual(60);
      let illness = 0;
      for (const l of moved) {
        const i = indexOfEvent(l, 'senior-move-home');
        expect(l.occ[i].after, `${l.era} ${l.seed}`).toContain('moved_home');
        expect(l.occ.slice(i + 1).some((o) => o.id === 'senior-alone'), `${l.era} ${l.seed}: 이주 뒤 혼자 사는 집`).toBe(false);
        for (const o of l.occ.slice(i + 1)) {
          if (o.id !== 'senior-illness-later') continue;
          illness++;
          expect(o.visible, `${l.era} ${l.seed}`).not.toContain('home');
          expect(o.visible!.length, '선택지는 둘 이상 남는다').toBeGreaterThanOrEqual(2);
        }
      }
      expect(illness, '이주 뒤 "점점 깊어지는 병"이 나온 판').toBeGreaterThanOrEqual(5);
    });
  }

  it('살던 집에 머문 판(stay)과 이주를 정하지 않은 판에서는 그대로다: "혼자 사는 집"이 나오고 "익숙한 집에서 지낸다"가 보인다', () => {
    const stayed = populate({ 'senior-move-home': 'stay' }, 300).filter((l) => pickedAt(l, 'senior-move-home') === 'stay');
    expect(stayed.length).toBeGreaterThanOrEqual(60);
    for (const l of stayed) expect(l.occ[indexOfEvent(l, 'senior-move-home')].after, `${l.era} ${l.seed}`).not.toContain('moved_home');
    expect(stayed.filter((l) => occurred(l, 'senior-alone')).length, '머문 판에서 혼자 사는 집').toBeGreaterThan(0);
    const homeVisible = [...stayed, ...GENERAL()].flatMap((l) => l.occ.filter((o) => o.id === 'senior-illness-later' && o.visible?.includes('home')));
    expect(homeVisible.length).toBeGreaterThan(10);
  });

  it('대조: moved_home 닫음을 되돌린 풀에서는 이주 뒤에도 "혼자 사는 집"이 나오고 "익숙한 집에서 지낸다"가 보인다', () => {
    const old = poolWith({
      'senior-alone': (e) => ({ ...e, conditions: { notFlags: ['married'] } }),
      'senior-illness-later': (e) => ({ ...e, choices: e.choices!.map((c) => (c.id === 'home' ? { ...c, requires: undefined } : c)) }),
    });
    const moved = populate({ 'senior-move-home': 'facility' }, 300, old).filter((l) => pickedAt(l, 'senior-move-home') === 'facility');
    expect(afterCount(moved, 'senior-move-home', 'senior-alone')).toBeGreaterThan(0);
    const homeAfterMove = moved.filter((l) => {
      const i = indexOfEvent(l, 'senior-move-home');
      return l.occ.slice(i + 1).some((o) => o.id === 'senior-illness-later' && o.visible?.includes('home'));
    });
    expect(homeAfterMove.length).toBeGreaterThan(0);
  });
});

describe('한 판 안의 모순 0건: 거처 2 (R-082) — "혼자 먹는 저녁" 뒤 "부모님 집에 머문다", 돌봄 시설 뒤 손주 맡기·"집이 다시 시끄러워졌다"가 보이지 않는다', () => {
  // ----- 역순: 혼자 사는 방(lives_alone) -> 집 구하기 -----
  const lonelyThenHousing = (lives: readonly Life[]) =>
    lives.filter((l) => {
      const a = indexOfEvent(l, 'youth-lonely-city');
      const b = indexOfEvent(l, 'youth-housing');
      return a >= 0 && b > a;
    });
  const oldHousing = () =>
    poolWith({ 'youth-housing': (e) => ({ ...e, choices: e.choices!.map((c) => (c.id === 'parents' ? { ...c, requires: undefined } : c)) }) });

  it('역순: "혼자 먹는 저녁"이 먼저 일어난 판의 집 구하기에는 "부모님 집에 머문다"가 보이지 않고 선택지는 둘 이상 남는다 (표본 200판 이상)', () => {
    const lives = lonelyThenHousing(GENERAL());
    expect(lives.length, '혼자 먹는 저녁 뒤에 집 구하기가 나온 판').toBeGreaterThanOrEqual(200);
    for (const l of lives) {
      const o = l.occ[indexOfEvent(l, 'youth-housing')];
      expect(o.flags, `${l.era} ${l.seed}`).toContain('lives_alone');
      expect(o.visible, `${l.era} ${l.seed}: 혼자 사는 방 뒤의 집 구하기`).not.toContain('parents');
      expect(o.visible!.length, '선택지는 둘 이상 남는다').toBeGreaterThanOrEqual(2);
    }
  });

  it('닫힌 것은 그 판뿐이다: 혼자 먹는 저녁이 아직 없던 판의 집 구하기에는 "부모님 집에 머문다"가 그대로 보이고, 고르면 부모님 집에 머문 것으로 이어진다', () => {
    const open = GENERAL().flatMap((l) => l.occ.filter((o) => o.id === 'youth-housing' && !o.flags.includes('lives_alone')));
    expect(open.length).toBeGreaterThanOrEqual(200);
    expect(open.filter((o) => o.visible!.includes('parents')).length, '"부모님 집에 머문다"가 보인 집 구하기').toBeGreaterThan(100);
    const stayed = populate({ 'youth-housing': 'parents' }, 400).filter((l) => pickedAt(l, 'youth-housing') === 'parents');
    expect(stayed.length).toBeGreaterThanOrEqual(100);
    for (const l of stayed) expect(l.occ[indexOfEvent(l, 'youth-housing')].after, `${l.era} ${l.seed}`).toContain('lives_with_parents');
  });

  it('어느 순서로도 한 판에 "혼자 먹는 저녁"과 "부모님 집에 머문다"가 함께 일어나지 않는다 (부모님 집을 고르도록 강제해도)', () => {
    const lives = populate({ 'youth-housing': 'parents' }, 500);
    let both = 0;
    let lonely = 0;
    for (const l of lives) {
      if (occurred(l, 'youth-lonely-city')) lonely++;
      if (occurred(l, 'youth-lonely-city') && pickedAt(l, 'youth-housing') === 'parents') both++;
    }
    expect(lonely, '혼자 먹는 저녁이 나온 판').toBeGreaterThan(100);
    expect(both, '혼자 먹는 저녁과 부모님 집 머물기가 함께 있는 판').toBe(0);
  });

  it('대조: "부모님 집에 머문다"의 닫는 조건(requires)을 지운 풀에서는 혼자 먹는 저녁 뒤에도 그 선택지가 실제로 보이고, 고른 판도 있다', () => {
    const lives = lonelyThenHousing(populate({ 'youth-housing': 'parents' }, 500, oldHousing()));
    const shown = lives.filter((l) => l.occ[indexOfEvent(l, 'youth-housing')].visible!.includes('parents'));
    expect(shown.length, '옛 조건에서 혼자 먹는 저녁 뒤에 "부모님 집에 머문다"가 보인 판').toBeGreaterThan(50);
    expect(shown.filter((l) => pickedAt(l, 'youth-housing') === 'parents').length, '그중 고른 판').toBeGreaterThan(50);
  });

  // ----- 돌봄 시설(in_care) -----
  const MOVE_RULES = { ...MARRIED_RULES, 'youth-child': 'have' } as const;
  const moved = (choice: 'facility' | 'child', pool: EventPool = EVENT_POOL) =>
    populate({ ...MOVE_RULES, 'senior-move-home': choice }, 500, pool).filter((l) => pickedAt(l, 'senior-move-home') === choice);
  const facility = lazy(() => moved('facility'));
  const nearChild = lazy(() => moved('child'));
  const after = (l: Life, ...ids: string[]) => l.occ.slice(indexOfEvent(l, 'senior-move-home') + 1).filter((o) => ids.includes(o.id));

  it('"돌봄이 있는 곳으로 간다"는 moved_home과 in_care를 함께 켜고, "자식 곁으로 옮긴다"는 moved_home만 켠다 (두 이주를 구분한다)', () => {
    expect(facility().length).toBeGreaterThanOrEqual(100);
    expect(nearChild().length).toBeGreaterThanOrEqual(100);
    for (const l of facility()) {
      const a = l.occ[indexOfEvent(l, 'senior-move-home')].after;
      expect(a, `${l.era} ${l.seed}`).toEqual(expect.arrayContaining(['moved_home', 'in_care']));
    }
    for (const l of nearChild()) {
      const a = l.occ[indexOfEvent(l, 'senior-move-home')].after;
      expect(a, `${l.era} ${l.seed}`).toContain('moved_home');
      expect(a, `${l.era} ${l.seed}`).not.toContain('in_care');
    }
  });

  it('시설로 옮긴 판에는 그 뒤 "손주를 맡아 달라는 부탁"이 나오지 않고, "넉넉해진 시간"에 "손주를 돌본다"가 보이지 않는다 (표본: 시설 100판 이상, 이후 "넉넉해진 시간" 20번 이상)', () => {
    let gatherings = 0;
    for (const l of facility()) {
      expect(after(l, 'senior-grandchildren').map((o) => o.id), `${l.era} ${l.seed}: 시설로 옮긴 뒤 손주 맡기`).toEqual([]);
      for (const o of after(l, 'senior-gathering')) {
        gatherings++;
        expect(o.visible, `${l.era} ${l.seed}: ${o.age}세`).not.toContain('grandchildren');
        expect(o.visible!.length, '선택지는 둘 이상 남는다').toBeGreaterThanOrEqual(2);
      }
    }
    expect(gatherings, '시설로 옮긴 뒤 "넉넉해진 시간"이 나온 횟수').toBeGreaterThanOrEqual(20);
  });

  it('자식 곁으로 옮긴 판은 막지 않는다: 그 뒤에도 손주 맡기가 나오고 "손주를 돌본다"가 보인다 (닫힌 것은 시설뿐이다)', () => {
    const lives = nearChild();
    expect(lives.flatMap((l) => after(l, 'senior-grandchildren')).length, '자식 곁 이주 뒤 손주 맡기').toBeGreaterThan(5);
    expect(lives.flatMap((l) => after(l, 'senior-gathering')).filter((o) => o.visible!.includes('grandchildren')).length, '자식 곁 이주 뒤 "손주를 돌본다"').toBeGreaterThan(5);
  });

  it('시설과 상관없는 판(이주를 정하지 않았거나 살던 집에 머문 판)에서는 손주 맡기가 그대로 나온다', () => {
    const lives = populate({ ...MOVE_RULES, 'senior-move-home': 'stay' }, 500);
    expect(lives.filter((l) => occurred(l, 'senior-grandchildren')).length, '손주 맡기가 나온 판').toBeGreaterThan(30);
  });

  it('찾아온 아이들·오래가는 통증의 글은 이주한 판에서도 맞는 글이다: "집을 찾았다"·"집 안이 시끄러웠다"·"익숙한 동네"가 없다 (중립 문구)', () => {
    const visit = EVENT_POOL.byId.get('senior-grandchild-visit')!;
    for (const p of textPartsOf(visit)) expect(p.value, p.where).not.toMatch(/집/);
    const illness = EVENT_POOL.byId.get('senior-illness')!;
    for (const p of textPartsOf(illness)) expect(p.value, p.where).not.toContain('익숙한 동네');
    // 시설 판에서도 실제로 나오는 이벤트다
    expect(facility().flatMap((l) => after(l, 'senior-grandchild-visit')).length).toBeGreaterThan(10);
  });

  it('대조: 시설 이주 뒤 손주를 닫는 조건을 지운 풀에서는 같은 시드에서 시설로 옮긴 뒤에도 손주 맡기가 나오고 "손주를 돌본다"가 보인다', () => {
    const old = poolWith({
      'senior-grandchildren': (e) => ({ ...e, conditions: { flags: ['has_child'], notFlags: ['child_distant'] } }),
      'senior-gathering': (e) => ({
        ...e,
        choices: e.choices!.map((c) => (c.id === 'grandchildren' ? { ...c, requires: { flags: ['has_child'], notFlags: ['child_distant', 'child_late'] } } : c)),
      }),
    });
    const lives = moved('facility', old);
    expect(lives.flatMap((l) => after(l, 'senior-grandchildren')).length, '옛 조건에서 시설 이주 뒤 손주 맡기').toBeGreaterThan(5);
    expect(lives.flatMap((l) => after(l, 'senior-gathering')).filter((o) => o.visible!.includes('grandchildren')).length, '옛 조건에서 시설 이주 뒤 "손주를 돌본다"').toBeGreaterThan(5);
  });
});

describe('한 판 안의 모순 0건: 거처 3 (R-094) — "혼자 먹는 저녁"의 본문은 집 구하기에서 무엇을 골랐든 맞는다', () => {
  const lonely = EVENT_POOL.byId.get('youth-lonely-city')!;
  /** 이 이벤트가 일어난 순간에 해당 플래그가 켜져 있던 판 (집 구하기가 먼저였던 판) */
  const withFlag = (choice: string, flag: string) =>
    populate({ 'youth-housing': choice }, 500).filter((l) => l.occ.some((o) => o.id === 'youth-lonely-city' && o.flags.includes(flag)));

  it('본문이 집의 형태를 단정하지 않는다: "작은 방"·"월세"·"부모님 집"·"작은 집"·"내 집"·"보증금"이 없고, 낯선 동네에서 혼자 먹는 저녁을 말한다 (중립 문구)', () => {
    for (const p of textPartsOf(lonely)) expect(p.value, p.where).not.toMatch(/작은 방|월세|부모님 집|작은 집|내 집|자가|보증금/);
    expect(lonely.text).toContain('낯선 동네에서 혼자 저녁을 먹는 날이 늘었다');
  });

  it('빚을 내 집을 마련(own_home)한 판에서도 월세방(renting)을 구한 판에서도 실제로 나오는 이벤트다 — 그래서 본문이 어느 쪽에서도 맞아야 한다 (표본 10판 이상)', () => {
    expect(withFlag('loan', 'own_home').length, '집을 마련한 뒤 혼자 먹는 저녁').toBeGreaterThanOrEqual(10);
    expect(withFlag('rent', 'renting').length, '월세방을 구한 뒤 혼자 먹는 저녁').toBeGreaterThanOrEqual(10);
  });
});

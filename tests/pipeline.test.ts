import { describe, expect, it } from 'vitest';
import {
  BAND_GRACE,
  ERAS,
  advanceYear,
  autoResolveStep,
  familyOf,
  finalWealthStanding,
  maxAgeOf,
  playToEnd,
  reviewEnding,
  standingScore,
  startBandOf,
  type EndingGame,
  type Era,
  type GameState,
  type ParentWealth,
} from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { EVENT_POOL } from '../src/data/events';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { startLife } from '../scripts/simulateLib';
import {
  EXPECTED_BIRTH_YEARS,
  EXPECTED_GRACE,
  EXPECTED_START_BANDS,
  FAMILY_RULES,
  PIPELINE_STRATEGIES,
  allowedGiven,
  checkCharacterName,
  checkEnding,
  checkFamilyRules,
  checkMoney,
  checkStats,
  checkTransition,
  deepEqual,
  expectedEndScore,
  pipelineSeed,
  roundTrip,
  runPipelineCell,
  runPipelineLife,
  type PipelineStrategy,
} from '../scripts/pipelineLib';

/**
 * 1000판 전체 파이프라인 (SPEC-001 M6 완료 기준: "1000판 자동 시뮬레이션에서 에러 0건", "1000판 시뮬레이션에서 이름이 출생 연대·성별 풀과 100% 일치").
 *
 * 세 시대 × 두 선택 전략(자동 모드 / 무작위 수동 흉내) × 1000판 = 6000판을, 화면(UI)이 쓰는 세션 reducer로 사람이 누르는 순서 그대로
 *   타이틀 → 시작 → 시대 선택 → 출생 → 인생(한 해씩·다음 결정으로·선택·자동 선택) → 사망 → 엔딩 회고(reviewEnding) → 다시 태어나기 → 새 판 출생·첫 결정
 * 까지 돌린다. 불변식은 scripts/pipelineLib.ts 머리말. 같은 계산이 `npm run sim:1000`으로도 돌고(수치 보고), 6000판이 약 25초라 기본 `npm test`에 전부 둔다.
 *
 * 첫 블록은 점검 도구 자체의 시험이다 — "점검이 아무것도 못 잡아서 0건"이 아님을 보이려고, 일부러 틀린 입력을 넣어 점검이 잡는지 본다(대조군).
 */

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

/** 나이가 age 이상이 될 때까지(또는 끝날 때까지) 성향 자동 선택으로 진행한 인생 */
function lifeAt(seed: number, era: Era, age: number): GameState {
  let s = startLife(seed, era);
  for (let i = 0; i < 1000 && s.phase === 'life' && s.age < age; i++) s = s.pending !== null ? autoResolveStep(s, s.pending.key).state : advanceYear(s);
  return s;
}

const endedGame = lazy(() => playToEnd(startLife(321, 'present'), null).state as EndingGame);

describe('점검 도구 시험 (대조군): 일부러 틀린 입력을 넣으면 점검이 잡는다', () => {
  it('deepEqual: 객체·배열을 깊게, 키 순서와 무관하게 비교한다', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual({ a: null }, { a: 0 })).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });

  it('checkStats: 0~100 정수만 통과한다 (101, -1, 50.5, NaN은 잡는다)', () => {
    const ok = { education: 100, health: 50, happiness: 1, relationships: 99 };
    expect(checkStats(ok, 'x')).toEqual([]);
    expect(checkStats({ ...ok, education: 101 }, 'x')).toHaveLength(1);
    expect(checkStats({ ...ok, health: -1 }, 'x')).toHaveLength(1);
    expect(checkStats({ ...ok, happiness: 50.5 }, 'x')).toHaveLength(1);
    expect(checkStats({ ...ok, education: Number.NaN, relationships: 200 }, 'x')).toHaveLength(2);
    expect(checkStats(null, 'x')).toHaveLength(1);
  });

  it('checkMoney: 20세 미만의 자산·20세 이상의 자산 없음·남은 집안 살림·부채 < −순자산·정수가 아닌 값을 각각 잡고, 정상 상태는 통과한다 (SPEC-003 M5 EC1 불변식)', () => {
    const young = lifeAt(21, 'present', 12);
    const adult = lifeAt(21, 'present', 30);
    expect(young.phase).toBe('life');
    expect(adult.phase).toBe('life');
    expect(young.assets).toBeNull();
    expect(adult.assets).not.toBeNull();
    expect(checkMoney(young, 'x')).toEqual([]);
    expect(checkMoney(adult, 'x')).toEqual([]);
    expect(checkMoney({ ...young, assets: adult.assets }, 'x').join()).toContain('20세 미만');
    expect(checkMoney({ ...adult, assets: null }, 'x').join()).toContain('자산이 없다');
    expect(checkMoney({ ...adult, familyFund: 300 }, 'x').join()).toContain('집안 살림');
    expect(checkMoney({ ...young, familyFund: 3001 }, 'x').join()).toContain('±3000');
    expect(checkMoney({ ...adult, assets: { ...adult.assets!, net: -500, debt: 100 } }, 'x').join()).toContain('총자산 < 0');
    expect(checkMoney({ ...adult, assets: { ...adult.assets!, debt: -1 } }, 'x').join()).toContain('음수');
    expect(checkMoney({ ...adult, assets: { ...adult.assets!, net: 10.5 } }, 'x').join()).toContain('정수');
    // 빚이 순자산보다 큰 것(집을 산 빚)은 괜찮다
    expect(checkMoney({ ...adult, assets: { ...adult.assets!, net: -500, debt: 9000 } }, 'x')).toEqual([]);
  });

  it('checkCharacterName: 맞는 이름은 통과하고, 풀 밖 이름·다른 성별 풀·시대 밖 연도·없는 성·금지 이름·성과 첫 글자가 같은 이름은 각각 잡는다', () => {
    // 맞는 이름: 지금 세상(2026년생, 2025년 풀) 여자 풀의 첫 이름 + 성씨 표의 성
    const given = allowedGiven(2026, 'female')![0];
    expect(checkCharacterName('present', `김${given}`, 2026, 'female')).toEqual([]);
    expect(checkCharacterName('present', '김가나다', 2026, 'female').join()).toContain('풀에 없다');
    // 같은 연도라도 성별 풀이 다르다: 남자 풀의 이름은 여자 풀에 없다 (두 풀이 완전히 같지 않다)
    const maleOnly = allowedGiven(2026, 'male')!.find((n) => !allowedGiven(2026, 'female')!.includes(n))!;
    expect(maleOnly).toBeTruthy();
    expect(checkCharacterName('present', `김${maleOnly}`, 2026, 'female').join()).toContain('풀에 없다');
    // 출생 연도가 시대 밖 (M2 시기의 지금 세상 연도 2022도 이제 밖이다)
    expect(checkCharacterName('present', `김${given}`, 1995, 'female').join()).toContain('범위');
    expect(checkCharacterName('present', `김${given}`, 2022, 'female').join()).toContain('범위');
    expect(checkCharacterName('past', `김${allowedGiven(2026, 'female')![0]}`, 2026, 'female').join()).toContain('범위');
    // 없는 성
    expect(checkCharacterName('present', `뷁${given}`, 2026, 'female').join()).toContain('성씨 표에 없다');
    // 금지 이름 (박정희: 1960년대 여자 풀에 "정희"가 있다)
    expect(allowedGiven(1965, 'female')).toContain('정희');
    expect(checkCharacterName('past', '박정희', 1965, 'female').join()).toContain('금지 이름');
    // 성과 이름 첫 글자가 같은 조합 (이이서: 지금 세상 여자 풀(2025년)에 "이서")
    expect(allowedGiven(2026, 'female')).toContain('이서');
    const same = checkCharacterName('present', '이이서', 2026, 'female');
    expect(same).toHaveLength(1);
    expect(same[0]).toContain('첫 글자');
    // 한글 3~4자가 아닌 이름
    expect(checkCharacterName('present', 'Kim', 2026, 'female').join()).toContain('한글 3~4자');
  });

  it('allowedGiven: 시대 밖 연도는 null, 지난 세상은 verified + estimated, 지금 세상(2026)은 2025년 풀 하나, 다가올 세상은 2021~2025 합집합', () => {
    for (const y of [1949, 1990, 2007, 2008, 2025, 2029, 2061]) expect(allowedGiven(y, 'male'), String(y)).toBeNull();
    expect(allowedGiven(1955, 'male')!.length).toBeGreaterThanOrEqual(20);
    expect(allowedGiven(2026, 'male')!).toHaveLength(20);
    const future = allowedGiven(2040, 'female')!;
    expect(future.length).toBeGreaterThan(20);
    expect(new Set(future).size).toBe(future.length);
    for (const n of allowedGiven(2026, 'female')!) expect(future).toContain(n); // 지금 세상 풀(2025년)은 다가올 세상 합집합 안에 있다
  });

  describe('checkFamilyRules: 가족 정합 규칙 (BR6·CM9, R-272)', () => {
    /** 실제 한 판에서 시작해 연표·플래그·출생신고 상세를 필요한 대로 바꾼 판 (출생 때 어머니 34·아버지 38, 첫째) */
    const base = (): GameState => {
      const g = endedGame();
      return { ...g, flags: [], history: [g.history[0]], birthReport: { ...g.birthReport!, birthOrder: 1, mother: { ...g.birthReport!.mother, age: 34 }, father: { ...g.birthReport!.father, age: 38 } } };
    };
    const first = (g: GameState, order: number): GameState => ({ ...g, history: [{ ...g.history[0], text: `2026년 1월, 서울특별시 종로구의 평범한 가정에서 3.2kg 여자아이로 태어났습니다. ${['첫째', '둘째', '셋째', '넷째', '다섯째 이상'][order - 1]}입니다. (3.2kg은 상위 약 50%)` }, ...g.history.slice(1)] });
    const withEvent = (g: GameState, eventId: string, age: number): GameState => ({ ...g, history: [...g.history, { age, kind: 'event', title: 't', text: 'x', eventId }] });
    const check = (g: GameState) => checkFamilyRules(first(g, g.birthReport!.birthOrder), 'x');

    it('대조군: 규칙을 지키는 판은 위반 0이고 점검 횟수가 센다 — 병환(아버지 38 + 30 = 68세)·임종(38 + 40 = 78세)·동생(첫째, 어머니 34 + 3 = 37세)·사별·연표 첫 줄', () => {
      let g = withEvent(base(), 'middle-parents-care', 30);
      g = withEvent(g, 'middle-parents-farewell', 40);
      g = withEvent(g, 'infant-new-sibling', 3);
      g = { ...g, flags: ['parents_gone'] };
      const r = check(g);
      expect(r.problems).toEqual([]);
      expect(r.applied).toBe(3 + 1 + 1); // 사건 3개 + 사별 + 연표 첫 줄
      // 사건이 없는 판도 연표 첫 줄은 점검한다
      expect(check(base())).toEqual({ problems: [], applied: 1 });
    });

    it('병환·임종 사건이 부모 나이에 어긋나면 잡는다: 나이 많은 쪽이 60세 미만(병환)·65세 미만(임종)·100세 초과', () => {
      expect(check(withEvent(base(), 'middle-parents-care', 21)).problems.join()).toContain('middle-parents-care'); // 38 + 21 = 59
      expect(check(withEvent(base(), 'middle-parents-care', 22)).problems).toEqual([]); // 60
      expect(check(withEvent(base(), 'middle-parents-care', 62)).problems).toEqual([]); // 100
      expect(check(withEvent(base(), 'middle-parents-care', 63)).problems.join()).toContain('101세'); // 38 + 63 = 101
      expect(check(withEvent(base(), 'middle-parents-farewell', 26)).problems.join()).toContain('middle-parents-farewell'); // 64
      expect(check(withEvent(base(), 'middle-parents-farewell', 27)).problems).toEqual([]); // 65
      expect(check(withEvent(base(), 'middle-parents-farewell', 63)).problems.join()).toContain('101세'); // 101
      // 나이 많은 쪽 기준이다: 어머니가 더 많은 판에서는 어머니 나이로 판정한다
      const older = { ...base(), birthReport: { ...base().birthReport!, mother: { ...base().birthReport!.mother, age: 44 } } };
      expect(check(withEvent(older, 'middle-parents-farewell', 21)).problems).toEqual([]); // 44 + 21 = 65
    });

    it('동생이 생겼다 사건은 첫째가 아닌 판, 어머니가 45세를 넘는 때를 잡는다 (R-268)', () => {
      expect(check(withEvent({ ...base(), birthReport: { ...base().birthReport!, birthOrder: 2 } }, 'infant-new-sibling', 3)).problems.join()).toContain('형제 순서가 2번째');
      const oldMother = (age: number) => ({ ...base(), birthReport: { ...base().birthReport!, mother: { ...base().birthReport!.mother, age } } });
      expect(check(withEvent(oldMother(43), 'infant-new-sibling', 2)).problems).toEqual([]); // 45세
      expect(check(withEvent(oldMother(43), 'infant-new-sibling', 3)).problems.join()).toContain('어머니는 46세');
      expect(check(withEvent(oldMother(47), 'infant-new-sibling', 2)).problems.join()).toContain('어머니는 49세');
    });

    it('식구 카드의 위 형제: 누적 나이 차가 어머니의 첫 출산 한도(어머니 나이 − 16)를 넘거나, 위 형제 수가 형제 순서 − 1과 다르거나, 어머니가 그 순서를 낳기엔 어렸으면 잡는다 — 순서에 맞는 어머니 나이에서는 위반 0이고 점검 횟수가 센다 (R-330, r3)', () => {
      const motherOf = (age: number, order: number): GameState => {
        const g = base();
        return { ...g, birthReport: { ...g.birthReport!, birthOrder: order, mother: { ...g.birthReport!.mother, age } } };
      };
      // 대조군: 어머니가 그 순서를 낳을 수 있는 나이(첫째 16·둘째 18·셋째 20·넷째 22·다섯째 이상 24세 이상 — 독립으로 적은 표)면 위반 0이고, 위 형제가 있으면 한 번 더 센다.
      // 낳을 수 없는 나이(생성기가 이제 만들지 않는 조합 — 옛 저장 판에나 있다)면 잡는다: 어머니 나이 위반 + 식구 카드가 형제를 숨긴 만큼 위 형제 수 불일치
      let possible = 0;
      let impossible = 0;
      for (let motherAge = 16; motherAge <= 46; motherAge++) {
        for (const order of [1, 2, 3, 4, 5]) {
          const g = motherOf(motherAge, order);
          const r = checkFamilyRules(first(g, order), 'x');
          const minMother = 16 + 2 * Math.min(4, order - 1);
          if (motherAge >= minMother) {
            possible++;
            expect(r.problems, `어머니 ${motherAge}세 ${order}째`).toEqual([]);
            expect(r.applied, `어머니 ${motherAge}세 ${order}째`).toBe(1 + (order > 1 ? 1 : 0));
          } else {
            impossible++;
            expect(r.problems.join(), `어머니 ${motherAge}세 ${order}째`).toContain(`어머니는 출생 때 ${motherAge}세다(${minMother}세 이상이어야 한다`);
            expect(r.problems.join(), `어머니 ${motherAge}세 ${order}째`).toContain(`위 형제가 ${familyOf(g).siblings.filter((s) => s.older).length}명인데 형제 순서는 ${order}번째다(위 형제 ${Math.min(4, order - 1)}명이어야 한다`);
            expect(r.applied, `어머니 ${motherAge}세 ${order}째`).toBe(2);
          }
        }
      }
      expect(possible, '공허 통과 방지').toBeGreaterThan(100);
      expect(impossible, '공허 통과 방지: 낳을 수 없는 조합도 점검했다').toBe(2 + 4 + 6 + 8); // 둘째 16·17세 / 셋째 16~19세 / 넷째 16~21세 / 다섯째 이상 16~23세 — 첫째는 없다 (2 + 4 + 6 + 8 = 20)
      // 공허 통과 방지: 규칙이 실제로 잡는다 — 식구 카드가 한도를 넘는 형제를 만들었다고 가정한 요약(family 인자)을 넘기면 위반이다
      const g = motherOf(24, 5);
      const real = familyOf(g);
      const sibling = (gap: number) => ({ kind: 'olderBrother' as const, age: gap, gap, older: true, gone: false });
      const forge = (gaps: number[]) => ({ ...real, siblings: gaps.map(sibling) });
      expect(checkFamilyRules(first(g, 5), 'x', forge([5, 9, 14, 20])).problems.join(), '어머니 24세인데 가장 위 형제와 20살 차이').toContain('가장 위 형제와 나이 차 20살인데 어머니는 출생 때 24세다');
      expect(checkFamilyRules(first(g, 5), 'x', forge([2, 4, 6, 8])).problems, '정확히 한도(8살)에 닿는 것은 통과').toEqual([]);
      expect(checkFamilyRules(first(g, 5), 'x', forge([2, 3, 6, 8])).problems.join(), '형제 사이 1살').toContain('위 형제 사이 나이 차 1살 < 2살');
      // R-330 r3: 위 형제 수는 「이하」가 아니라 「같다」 — 식구 카드가 형제를 줄여 보이면(셋·없음) 모순으로 잡는다
      expect(checkFamilyRules(first(g, 5), 'x', forge([2, 4, 6])).problems.join(), '다섯째인데 위 형제 3명').toContain('위 형제가 3명인데 형제 순서는 5번째다(위 형제 4명이어야 한다');
      expect(checkFamilyRules(first(g, 5), 'x', forge([])).problems.join(), '다섯째인데 위 형제 없음').toContain('위 형제가 0명인데 형제 순서는 5번째다');
      expect(checkFamilyRules(first(g, 5), 'x', forge([])).applied, '위 형제가 있어야 하는 판은 점검 횟수에 센다').toBe(2);
      const second = motherOf(24, 2);
      expect(checkFamilyRules(first(second, 2), 'x', { ...familyOf(second), siblings: [2, 4].map(sibling) }).problems.join(), '둘째인데 위 형제 2명').toContain('위 형제가 2명인데 형제 순서는 2번째');
      expect(FAMILY_RULES.motherMinFirstBirth).toBe(16);
      expect(FAMILY_RULES.minSiblingGap).toBe(2);
    });

    it('사별(parents_gone) 플래그가 있는데 임종 사건이 연표에 없으면 잡고, 있으면 통과한다', () => {
      expect(check({ ...base(), flags: ['parents_gone'] }).problems.join()).toContain('임종 사건이 연표에 없다');
      expect(check({ ...withEvent(base(), 'middle-parents-farewell', 40), flags: ['parents_gone'] }).problems).toEqual([]);
    });

    it('연표 첫 줄(출생신고 서술문)의 형제 순서가 저장된 순서와 다르면 잡는다', () => {
      const g = base();
      expect(checkFamilyRules(first(g, 2), 'x').problems.join()).toContain('형제 순서');
      expect(checkFamilyRules(first(g, 1), 'x').problems).toEqual([]);
      expect(checkFamilyRules({ ...g, birthReport: null }, 'x').problems.join()).toContain('출생신고 상세가 없어');
    });

    it('점검 규칙표가 이벤트 데이터의 조건과 같다 (독립으로 적은 표와 데이터가 어긋나면 어느 쪽이 틀렸는지 여기서 드러난다)', () => {
      for (const [id, [min, max]] of Object.entries(FAMILY_RULES.olderParentAtEvent)) expect(EVENT_POOL.byId.get(id)!.conditions?.parentAge, id).toEqual({ min, max });
      expect(EVENT_POOL.byId.get('infant-new-sibling')!.conditions).toEqual({ birthOrder: { max: 1 }, motherAge: { max: FAMILY_RULES.siblingMotherMax } });
    });
  });

  describe('checkTransition: 한 걸음 전후의 불변식', () => {
    const prev = lifeAt(11, 'present', 12);
    const step = () => {
      let s = prev;
      s = s.pending !== null ? autoResolveStep(s, s.pending.key).state : advanceYear(s);
      return s;
    };
    const next = step();
    const check = (n: GameState, kind: 'single' | 'skip' = 'single') => checkTransition(prev, n, kind, 'x');

    it('정상 걸음은 위반이 없다', () => {
      expect(prev.phase).toBe('life');
      expect(next).not.toBe(prev);
      expect(check(next)).toEqual([]);
    });

    it('스탯이 범위를 벗어나거나 정수가 아니면 잡는다', () => {
      expect(check({ ...next, stats: { ...next.stats, education: 101 } }).join()).toContain('education');
      expect(check({ ...next, stats: { ...next.stats, health: 30.5 } }).join()).toContain('health');
    });

    it('나이가 줄거나, 한 해씩인데 2살 이상 오르면 잡는다 (다음 결정으로는 여러 해 허용)', () => {
      expect(check({ ...next, age: prev.age - 1 }).join()).toContain('나이가 줄었다');
      expect(check({ ...next, age: prev.age + 2 }, 'single').join()).toContain('나이가');
      expect(check({ ...next, age: prev.age + 2 }, 'skip').join()).not.toContain('한 걸음에');
    });

    it('연표가 줄거나 상한을 넘거나 나이가 거꾸로 가거나 첫 줄이 출생이 아니면 잡는다', () => {
      expect(check({ ...next, history: next.history.slice(0, 0) }).join()).toContain('연표가 줄었다');
      const long = Array.from({ length: HISTORY_LIMITS.maxEntries + 1 }, () => ({ age: 0, kind: 'stage' as const, text: '출생' }));
      expect(check({ ...next, history: long }).join()).toContain('상한');
      const reversed = [...next.history, { age: 3, kind: 'event' as const, text: 'a' }, { age: 1, kind: 'event' as const, text: 'b' }];
      expect(check({ ...next, history: reversed }).join()).toContain('거꾸로');
      expect(check({ ...next, history: [{ age: 0, kind: 'event' as const, text: '출생 아님' }, ...next.history.slice(1)] }).join()).toContain('출생 기록');
    });

    it('시대·시드·캐릭터·출생 스냅샷이 바뀌면 잡는다', () => {
      expect(check({ ...next, era: next.era === 'past' ? 'future' : 'past' }).join()).toContain('시대가 바뀌었다');
      expect(check({ ...next, seed: next.seed + 1 }).join()).toContain('시드');
      expect(check({ ...next, character: { ...next.character!, looks: (next.character!.looks + 1) % 101 } }).join()).toContain('캐릭터가 바뀌었다');
      expect(check({ ...next, birthStats: { ...next.birthStats!, education: (next.birthStats!.education + 1) % 101 } }).join()).toContain('출생 스냅샷');
    });

    it('대기 중인 선택지가 현재 나이·실제 이벤트·선택지와 맞지 않거나, 엔딩인데 사망 정보가 없거나 대기가 남아 있으면 잡는다', () => {
      const pending = { eventId: 'nope-event', key: 'nope-event@' + next.age, age: next.age, choiceIds: ['a', 'b'] };
      expect(check({ ...next, pending }).join()).toContain('선택지 이벤트가 아니다');
      expect(check({ ...next, pending: { ...pending, age: next.age + 1 } }).join()).toContain('대기 나이');
      expect(check({ ...next, phase: 'ending', death: null }).join()).toContain('사망 정보가 없다');
      expect(check({ ...next, phase: 'ending', death: { age: next.age + 1, cause: '노환' } }).join()).toContain('사망 나이');
      expect(check({ ...next, phase: 'ending', death: { age: next.age, cause: '노환' } }).join()).toContain('사망 기록');
      expect(check({ ...next, death: { age: next.age, cause: '노환' } }).join()).toContain('사망 정보가 있다');
      expect(check({ ...next, phase: 'birth' }).join()).toContain('단계가');
    });

    it('플래그 중복·본 이벤트가 현재 나이보다 큰 나이를 가지면 잡는다', () => {
      expect(check({ ...next, flags: ['a', 'a'] }).join()).toContain('플래그');
      expect(check({ ...next, seen: { ...next.seen, 'x-y': next.age + 5 } }).join()).toContain('나이가 현재 나이보다 크다');
    });
  });

  it('roundTrip: 저장 검증을 통과하지 못하는 상태, 복원하면 달라지는 상태를 잡고, 정상 상태는 통과한다', () => {
    const s = lifeAt(17, 'future', 9);
    expect(roundTrip(s, 'x').problems).toEqual([]);
    expect(roundTrip(s, 'x').restored).toEqual(s);
    expect(roundTrip({ ...s, stats: { ...s.stats, education: 101 } }, 'x').problems.join()).toContain('저장 검증');
    // 모양은 맞지만 풀에 없는 이벤트가 대기 중이면 parseGame이 대기를 풀어 상태가 달라진다 (콘텐츠 갱신 규칙) — 복원 결과가 다르다고 잡는다
    const age = s.age;
    const stale: GameState = { ...s, seen: { ...s.seen, 'gone-event': age }, lastChoiceAge: age, pending: { eventId: 'gone-event', key: `gone-event@${age}`, age, choiceIds: ['a', 'b'] } };
    expect(roundTrip(stale, 'x').problems.join()).toContain('다르다');
  });

  describe('checkEnding: 엔딩 회고와 문장', () => {
    const game = endedGame();
    const review = reviewEnding(game);
    it('정상 엔딩은 위반이 없다', () => {
      expect(game.phase).toBe('ending');
      expect(review.journey.kind).toBe('compared');
      expect(checkEnding(game, 'x')).toEqual([]);
    });

    it('방향이 문장의 숫자와 어긋나면 잡는다 (판정 뒤집기)', () => {
      if (review.journey.kind !== 'compared') throw new Error('테스트 전제');
      const j = review.journey;
      for (const wrong of (['up', 'same', 'down'] as const).filter((m) => m !== j.movement)) {
        const problems = checkEnding(game, 'x', { ...review, journey: { ...j, movement: wrong } });
        expect(problems.join(), `방향 ${j.movement} → ${wrong}`).toContain('숫자와 판정이 어긋난다');
      }
    });

    it('판정에 쓰는 구간이 문장에 말한 구간과 다르면 잡는다 (R-096 증상: 화면은 "하위 1% 안쪽", 판정은 [0, 0])', () => {
      if (review.journey.kind !== 'compared') throw new Error('테스트 전제');
      const j = review.journey;
      const old = { low: 0, high: 0, kind: 'bottom' as const, percent: 1 }; // 올려 말하기 전의 band
      const problems = checkEnding(game, 'x', { ...review, journey: { ...j, start: old } });
      expect(problems.join()).toContain('판정에 쓰는 band');
      // 문장의 구간이 재력 단계의 구간과 다른 경우도 잡는다
      const other = { low: 0, high: 7, kind: 'bottom' as const, percent: 7 };
      expect(checkEnding(game, 'x', { ...review, journey: { ...j, start: other } }).join()).toContain('단계의 구간');
    });

    it('도착 자리가 분포표에서 직접 센 값과 다르면 잡는다', () => {
      if (review.journey.kind !== 'compared') throw new Error('테스트 전제');
      const j = review.journey;
      const wrongEnd = { kind: 'top' as const, percent: standingScore(j.end) === 93 ? 8 : 7, within: false }; // 실제 자리가 아닌 다른 자리
      expect(checkEnding(game, 'x', { ...review, journey: { ...j, end: wrongEnd } }).join()).toContain('분포표에서 직접 센');
    });

    it('스무 살 전 사망과 회고 종류가 어긋나면 잡는다 (사망 나이 9인데 compared, 사망 나이 70인데 early)', () => {
      const young: EndingGame = { ...game, age: 9, death: { age: 9, cause: '사고' } };
      expect(checkEnding(young, 'x', review).join()).toContain('compared');
      const early = reviewEnding(young);
      expect(early.journey.kind).toBe('early');
      expect(checkEnding(young, 'x', early)).toEqual([]);
      expect(checkEnding(game, 'x', early).join()).toContain('early');
    });

    it('연표를 단계별로 묶은 것이 연표와 다르거나 선택 수가 틀리면 잡는다', () => {
      const dropped = { ...review, timeline: review.timeline.map((g, i) => (i === 0 ? { ...g, entries: g.entries.slice(1) } : g)) };
      expect(checkEnding(game, 'x', dropped).join()).toContain('빠지거나');
      expect(checkEnding(game, 'x', { ...review, choiceCount: review.choiceCount + 1 }).join()).toContain('선택 수');
    });

    it('연표에 느낌표·이모지가 있으면 잡는다', () => {
      const bad: EndingGame = { ...game, history: [...game.history.slice(0, -1), { age: game.death.age, kind: 'event', title: '제목', text: '좋은 일이 있었다!' }, game.history[game.history.length - 1]] };
      expect(checkEnding(bad, 'x', review).join()).toContain('느낌표');
    });
  });

  it('기준 표(EXPECTED_*)는 구현 값과 같다: 출발선 구간 15개·여유 2점·시대별 출생 연도, 도착 점수(분포표를 직접 센 값)는 세 시대 × 재산 0~100 전부에서 구현과 같다', () => {
    for (const era of ERAS) {
      for (let w = 1; w <= 5; w++) {
        const b = startBandOf(era, w as ParentWealth);
        expect([b.low, b.high], `${era} ${w}단계`).toEqual([...EXPECTED_START_BANDS[era][w - 1]]);
      }
      expect(EXPECTED_BIRTH_YEARS[era], era).toEqual(ERA_CONFIG[era].birthYears);
      for (let v = 0; v <= 100; v++) expect(expectedEndScore(era, v), `${era} 재산 ${v}`).toBe(standingScore(finalWealthStanding(era, v)));
    }
    expect(EXPECTED_GRACE).toBe(BAND_GRACE);
  });

  it('pipelineSeed: 시대·전략마다 다른 시드 줄이고, uint32이며, 같은 인자면 같다', () => {
    const seeds = new Set<number>();
    for (const era of ERAS) for (const st of PIPELINE_STRATEGIES) for (let i = 1; i <= 1000; i++) seeds.add(pipelineSeed(i, era, st));
    expect(seeds.size).toBe(6000);
    for (const s of seeds) expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
    expect(pipelineSeed(5, 'past', 'auto')).toBe(pipelineSeed(5, 'past', 'auto'));
  });

  it('한 판 실행: 위반 없이 끝까지 가고(타이틀부터 다시 태어나기 뒤 첫 결정까지), 같은 인자는 같은 결과이며, 매 걸음 저장 모드도 같은 인생이다', () => {
    for (const era of ERAS) {
      for (const strategy of PIPELINE_STRATEGIES) {
        const seed = pipelineSeed(3, era, strategy);
        const a = runPipelineLife({ seed, era, strategy, stepSerialize: false });
        expect(a.problems, `${era}/${strategy}`).toEqual([]);
        expect(a.threw).toBe(false);
        expect(a.deathAge).toBeGreaterThan(0);
        expect(a.deathAge).toBeLessThanOrEqual(maxAgeOf(era));
        expect(a.checks.names).toBe(2); // 첫 판 + 다시 태어난 판
        expect(a.checks.rebirths).toBe(1);
        expect(a.checks.endingTexts).toBe(1);
        expect(a.checks.transitions).toBeGreaterThan(30);
        expect(runPipelineLife({ seed, era, strategy, stepSerialize: false })).toEqual(a);
        const every = runPipelineLife({ seed, era, strategy, stepSerialize: true });
        expect(every.problems).toEqual([]);
        expect({ ...every, checks: a.checks }).toEqual(a); // 매 걸음 복원해도 인생은 같다 (점검 횟수만 다르다)
        expect(every.checks.roundTrips).toBeGreaterThan(a.checks.roundTrips + 10); // 매 걸음 모드는 걸음마다 한 번 더 저장 검증한다 (수동 흉내는 한 걸음이 여러 해라 걸음 수가 적다)
      }
    }
  });

  it('전략 두 가지는 실제로 다른 경로다: 같은 시대·같은 시드 줄에서 자동 모드와 수동 흉내의 인생이 다르다', () => {
    const deathAges = (strategy: PipelineStrategy) => Array.from({ length: 30 }, (_, i) => runPipelineLife({ seed: 100 + i, era: 'present', strategy, stepSerialize: false }).deathAge);
    expect(deathAges('auto')).not.toEqual(deathAges('manual'));
  });
});

describe('1000판 전체 파이프라인 (SPEC-001 M6): 세 시대 × 자동 모드·수동 흉내 × 1000판, 타이틀 → 시대 선택 → 출생 → 인생 → 사망 → 엔딩 회고 → 다시 태어나기, 에러 0건', () => {
  const LIVES = 1000;
  const EVERY = 20; // 20판마다 한 판은 매 걸음 저장→복원 (50판/칸)
  const reports = new Map<string, ReturnType<typeof runPipelineCell>>();
  const cell = (era: Era, strategy: PipelineStrategy) => {
    const key = `${era}/${strategy}`;
    if (!reports.has(key)) reports.set(key, runPipelineCell(era, strategy, { lives: LIVES, stepSerializeEvery: EVERY }));
    return reports.get(key)!;
  };

  for (const era of ERAS) {
    for (const strategy of PIPELINE_STRATEGIES) {
      it(
        `${era} / ${strategy === 'auto' ? '자동 모드' : '수동 흉내'}: ${LIVES}판 모두 예외 0, 불변식 위반 0 — 스탯 0~100 정수·나이 단조·연표 상한·사망 도달·이름 풀 일치·금지 이름 0·엔딩 문구 규칙·숫자-판정 일치·저장 검증`,
        () => {
          const r = cell(era, strategy);
          expect(r.problems, `위반 ${r.problemCount}건 (판 ${r.failedLives}개)`).toEqual([]);
          expect(r.problemCount).toBe(0);
          expect(r.exceptions).toBe(0);
          expect(r.failedLives).toBe(0);
          expect(r.lives).toBe(LIVES);
          // 점검이 실제로 돌았다: 판마다 이름 2번(첫 판 + 다시 태어난 판)·엔딩 문장 1번·다시 태어나기 1번, 저장 검증은 판마다 여러 번
          expect(r.checks.names).toBe(LIVES * 2);
          expect(r.checks.endingTexts).toBe(LIVES);
          expect(r.checks.rebirths).toBe(LIVES);
          expect(r.checks.roundTrips).toBeGreaterThan(LIVES * 20);
          // 가족 정합(BR6, R-272): 판마다 연표 첫 줄 + 부모 병환·임종·동생 사건·사별을 실제로 대조했다(사건이 나온 판이 있어 판 수보다 많다)
          expect(r.checks.familyRules).toBeGreaterThan(LIVES * 1.2);
          expect(r.checks.transitions).toBeGreaterThan(LIVES * 40);
          expect(r.checks.duplicateInputs).toBeGreaterThan(LIVES * 40);
          expect(r.stepSerializedLives).toBe(LIVES / EVERY);
          // 모두 사망에 도달했고 사망 나이는 시대 상한 이하
          expect(r.journeys.none, '끝까지 가지 못한 판').toBe(0);
          expect(r.deathAge.max).toBeLessThanOrEqual(maxAgeOf(era));
          expect(r.deathAge.min).toBeGreaterThanOrEqual(0);
          // 엔딩 회고의 세 방향이 모두 실제로 나왔다 (공허한 통과가 아니다)
          // 측정(M5 r3·r4, `npm run sim:1000` — 분포표는 수동 흉내로 만든다): 여섯 칸(세 시대 × 자동·수동 흉내) 모두 앞섬 250~325·비슷함 390~447·뒤쪽 270~337(1000판 중).
          // 2a에서는 자동 모드가 돈에 무게를 둔 선택을 해 앞섬 약 52%·비슷함 27~31%였고 그래서 하한을 200으로 낮췄다. r2의 자동 모드 가드(앞섬 ≤ 45%, 관측 26~32%)가 그 근거를 없애
          // 하한을 300으로 되돌렸다(R-356). 앞섬·뒤쪽의 하한은 관측의 절반 이하인 100이다.
          expect(r.journeys.up).toBeGreaterThan(100);
          expect(r.journeys.same).toBeGreaterThan(300);
          expect(r.journeys.down).toBeGreaterThan(100);
          expect(r.journeys.up + r.journeys.same + r.journeys.down + r.journeys.early).toBe(LIVES);
          // 서로 다른 인물이 나온다 (같은 인물만 반복하지 않는다)
          expect(r.distinctNames).toBeGreaterThan(100);
          // 시간 추정 (읽는 시간 18초 가정): 판당 선택지 평균 20~25개, 1배속 수동 최대 30분 이내 — M4 목표가 1000판에서도 유지된다
          expect(r.choices.mean).toBeGreaterThanOrEqual(20);
          expect(r.choices.mean).toBeLessThanOrEqual(25);
          expect(r.minutes1x.max).toBeLessThanOrEqual(30);
        },
        240_000,
      );
    }
  }

  it('합계: 6000판, 위반 0, 예외 0 — 20세 전에 끝난 인생도 엔딩까지 갔다', () => {
    const all = ERAS.flatMap((era) => PIPELINE_STRATEGIES.map((strategy) => cell(era, strategy)));
    expect(all).toHaveLength(6);
    expect(all.reduce((a, r) => a + r.lives, 0)).toBe(6000);
    expect(all.reduce((a, r) => a + r.problemCount, 0)).toBe(0);
    expect(all.reduce((a, r) => a + r.exceptions, 0)).toBe(0);
    expect(all.reduce((a, r) => a + r.journeys.early, 0)).toBeGreaterThan(0); // 스무 살 전 사망 문장 경로도 실제로 점검했다
    // 이름: 세 시대 모두 다양한 이름이 나왔다
    expect(all.reduce((a, r) => a + r.checks.names, 0)).toBe(12000);
  }, 240_000);
});

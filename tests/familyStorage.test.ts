import { describe, expect, it } from 'vitest';
import age0 from './fixtures/save-v030-age0.json';
import age20 from './fixtures/save-v030-age20.json';
import age65 from './fixtures/save-v030-age65.json';
import {
  GENERATION_IDS,
  SCHEMA_VERSION,
  YOUNGER_SIBLING_EVENT,
  createInitialState,
  gameData,
  installGameData,
  ensureFamily,
  familyOf,
  generateBirthFromSeed,
  isFamilyFillOnly,
  isIdleOnlyChange,
  isValidFamily,
  legacyFamilyFrom,
  olderSiblingPlan,
  parseGame,
  parseOpened,
  serializeGame,
  uninstallGameData,
  withValidFamily,
  type FamilyData,
  type GameState,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 가족 저장 (SPEC-009 FM4a, K5 · docs/data/family-model.md 2-3절·2-4절·12-3절): 저장 `SCHEMA_VERSION`은 9 그대로이고 `family`는 선택 필드다.
 * 필드가 없는 옛 저장은 `legacyFamilyFrom`으로 열리고, 이상한 값은 그 필드만 버린 뒤 같은 시드로 같은 값을 다시 만든다(결정성). 저장 추가량 ≤ 1000자.
 */

const life = (seed = 7, gen: 'genx' | 'alpha' | 'industrial' = 'genx'): GameState => startLife(seed, gen);
const roundTrip = (s: GameState): GameState | null => parseGame(serializeGame(s));
const withFamily = (s: GameState, family: unknown): GameState => ({ ...s, family: family as FamilyData });

describe('필드가 있는 판', () => {
  it('새로 태어난 판은 family를 갖고 저장·복원해도 그대로다(스키마 버전은 9 그대로)', () => {
    expect(SCHEMA_VERSION).toBe(9);
    for (const gen of GENERATION_IDS) {
      const s = startLife(3, gen);
      expect(s.family).toBeDefined();
      expect(s.family!.lg).toBeUndefined();
      expect(roundTrip(s)).toEqual(s);
    }
  });

  it('유효한 family는 같은 객체로 통과한다(버릴 필드가 없으면 같은 객체)', () => {
    const s = life();
    expect(withValidFamily(s)).toBe(s);
    expect(isValidFamily(s.family, s)).toBe(true);
  });

  it('첫 화면(title) 단계에 family가 있으면 그 필드만 버린다(출생 이후 단계에만 있다)', () => {
    const born = life();
    const title = { ...createInitialState(5), family: born.family } as GameState;
    const parsed = parseGame(serializeGame(title));
    expect(parsed).not.toBeNull();
    expect(parsed!.family).toBeUndefined();
    expect(parsed!.phase).toBe('title');
  });
});

describe('이상한 값은 그 필드만 버리고 같은 시드로 같은 값을 다시 만든다 (결정성, 12-3절 ③)', () => {
  const clone = (f: FamilyData): Record<string, unknown> => JSON.parse(JSON.stringify(f)) as Record<string, unknown>;
  const mutations: Array<[string, (f: Record<string, unknown>) => unknown]> = [
    ['부모 별세 나이가 숫자가 아님', (f) => ({ ...f, p: [{ d: 'x' }, (f.p as unknown[])[1]] })],
    ['부모 별세 나이 음수', (f) => ({ ...f, p: [{ d: -1 }, (f.p as unknown[])[1]] })],
    ['부모 칸이 둘이 아님', (f) => ({ ...f, p: [(f.p as unknown[])[0]] })],
    ['조부모 출생 때 나이 범위 밖', (f) => ({ ...f, g: [{ a: 5, d: 70 }, ...(f.g as unknown[]).slice(1)] })],
    ['조부모 칸이 셋', (f) => ({ ...f, g: (f.g as unknown[]).slice(0, 3) })],
    ['위 형제 수가 순서보다 많음', (f) => ({ ...f, o: [{ g: 0, k: 2, s: 20 }, { g: 0, k: 4, s: 21 }, { g: 1, k: 6, s: 22 }, { g: 1, k: 8, s: 23 }, { g: 0, k: 10, s: 24 }] })],
    ['전체 자녀 수가 8명을 넘음', (f) => ({ ...f, o: [], y: Array.from({ length: 8 }, (_, i) => ({ g: 0, k: 2 + i, s: 20 })) })],
    ['형제의 독립 나이가 범위 밖', (f) => ({ ...f, y: [{ g: 0, k: 3, s: 99 }] })],
    ['이름에 제로폭 문자', (f) => ({ ...f, p: [{ d: 70, n: '김' + String.fromCodePoint(0x200b) + '철수' }, (f.p as unknown[])[1]] })],
    ['이름이 한글이 아님', (f) => ({ ...f, g: [{ a: 30, d: 70, n: 'Kim' }, ...(f.g as unknown[]).slice(1)] })],
    ['함께 사는 쪽이 0·1·2가 아님', (f) => ({ ...f, c: 3 })],
    ['로그에 미래 나이', (f) => ({ ...f, l: [[1, 99, 21, 0]] })],
    ['로그에 같은 (종류, 대상)이 두 번', (f) => ({ ...f, l: [[1, 2, 21, 0], [1, 3, 21, 0]] })],
    ['로그 종류가 허용 목록 밖', (f) => ({ ...f, l: [[99, 2, 21, 0]] })],
    ['로그 항목이 네 칸이 아님', (f) => ({ ...f, l: [[1, 2, 21]] })],
    ['모르는 키', (f) => ({ ...f, zzz: 1 })],
    ['버전이 다름', (f) => ({ ...f, v: 2 })],
    ['family가 배열', () => []],
    ['family가 null', () => null],
    ['family가 문자열', () => '가족'],
  ];

  for (const [name, mutate] of mutations) {
    it(`${name} → 판은 열리고 family는 같은 시드로 다시 만든 원래 값이다`, () => {
      for (const [seed, gen] of [[7, 'genx'], [11, 'industrial'], [4, 'alpha']] as const) {
        const s = life(seed, gen);
        const broken = withFamily(s, mutate(clone(s.family!)));
        const parsed = parseGame(serializeGame(broken));
        expect(parsed, `${name} (${gen}): 판이 열린다`).not.toBeNull();
        expect(parsed!.family, `${name} (${gen}): 새 판의 저장 값 = 재생성 값`).toEqual(s.family);
        // 다른 필드는 그대로
        expect({ ...parsed!, family: undefined }).toEqual({ ...s, family: undefined });
      }
    });
  }

  it('지연 데이터가 없는 때(MG8)에는 버린 채로 열고(필드 없음), 데이터가 놓인 뒤 ensureFamily가 채운다', () => {
    const s = life();
    const raw = serializeGame(withFamily(s, { v: 2 }));
    const installed = gameData();
    uninstallGameData();
    try {
      // 진행 중인 판은 데이터 없이 읽지 않는다(null) — 첫 화면 단계의 판만 데이터 없이 열린다
      expect(parseGame(raw)).toBeNull();
    } finally {
      installGameData(installed);
    }
    const parsed = parseGame(raw)!;
    expect(parsed.family).toEqual(s.family);
  });
});

describe('옛 저장(v0.3.0, family 없음) 이어하기 — 0·20·65세 고정 파일 (12-3절 ⑤)', () => {
  const FIXTURES: Array<[string, unknown, number]> = [['0세', age0, 0], ['20세', age20, 20], ['65세', age65, 65]];

  for (const [name, fixture, age] of FIXTURES) {
    it(`${name}: 열리고 같은 판이 이어진다 — 스탯·자산·플래그·기록 불변, family가 채워지고 소급 줄은 0`, () => {
      const raw = JSON.stringify(fixture);
      expect(raw).not.toContain('"family"');
      const plain = parseGame(raw)!;
      expect(plain, '새 코드가 이전 빌드의 저장 원문을 연다').not.toBeNull();
      expect(plain.family).toBeUndefined();
      expect(plain.age).toBe(age);
      const opened = parseOpened(raw)!;
      expect(opened.family).toBeDefined();
      expect(opened.family!.lg).toBe(1);
      expect(opened.family!.l, '지난 해의 변화를 로그로 소급하지 않는다').toEqual([]);
      expect(opened.history, '인생 기록에 줄이 늘지 않는다').toEqual(plain.history);
      expect({ ...opened, family: undefined }).toEqual({ ...plain, family: undefined });
      // 다시 저장해도 읽힌다(family 포함) — 다음 저장 때 기록된다
      const again = parseGame(serializeGame(opened))!;
      expect(again.family).toEqual(opened.family);
      // 같은 원문은 늘 같은 family (결정성)
      expect(parseOpened(raw)!.family).toEqual(opened.family);
      // 열기만 한 탭은 쓰지 않는다 (R-417·R-532): family만 채운 상태는 저장 대상이 아니다
      expect(isFamilyFillOnly(raw, opened)).toBe(true);
      expect(isIdleOnlyChange(raw, opened)).toBe(true);
    });

    it(`${name}: 위 형제는 옛 familyOf와 같고, 아래 동생은 seen의 사건이 있을 때만 한 명이다`, () => {
      const raw = JSON.stringify(fixture);
      const plain = parseGame(raw)!;
      const fam = parseOpened(raw)!.family!;
      const old = familyOf(plain);
      expect(fam.o.map((s) => [s.k, s.g === 0 ? 'male' : 'female'])).toEqual(old.siblings.filter((x) => x.older).map((x) => [x.gap, x.kind === 'olderBrother' ? 'male' : 'female']));
      const bornAt = plain.seen[YOUNGER_SIBLING_EVENT];
      if (typeof bornAt === 'number' && plain.birthReport!.birthOrder === 1) expect(fam.y).toHaveLength(1);
      else expect(fam.y).toEqual([]);
      if (fam.y.length === 1) expect(fam.y[0].k).toBe(bornAt);
    });
  }

  it('옛 저장에서 만든 스냅샷(lg: 1)이 손상되면 옛 저장 규칙으로 되살린다 — 새 판 방식으로 만들지 않는다 (R-533, DF25)', () => {
    for (const fixture of [age0, age20, age65]) {
      const opened = parseOpened(JSON.stringify(fixture))!;
      const broken = { ...opened, family: { ...opened.family!, c: 3 } } as unknown as GameState;
      const parsed = parseGame(serializeGame(broken))!;
      expect(parsed.family!.lg).toBe(1);
      expect(parsed.family).toEqual(legacyFamilyFrom(opened));
    }
  });

  it('ensureFamily: 이미 있으면 같은 객체, 첫 화면이면 그대로, 출생 이후이고 없으면 legacyFamilyFrom 결과를 채운다', () => {
    const s = life();
    expect(ensureFamily(s)).toBe(s);
    const title = createInitialState(9);
    expect(ensureFamily(title)).toBe(title);
    const bare = { ...s, family: undefined } as GameState;
    delete (bare as { family?: unknown }).family;
    expect(ensureFamily(bare).family).toEqual(legacyFamilyFrom(bare));
  });

  it('legacyFamilyFrom은 위 형제를 옛 계산(olderSiblingPlan)과 같게 만들고 아래 동생은 첫째의 사건 한 명뿐이다 — 형제 수가 옛 familyOf와 같다', () => {
    let withEvent = 0;
    for (const gen of GENERATION_IDS) {
      for (const seed of spreadSeeds(60, GENERATION_IDS.indexOf(gen))) {
        const b = generateBirthFromSeed(seed, gen);
        const base = { ...createInitialState(seed), phase: 'life', age: 12, character: b.character, birthReport: b.report, peerSeed: b.peerSeed } as GameState;
        for (const seen of [{} as Record<string, number>, { [YOUNGER_SIBLING_EVENT]: 3 } as Record<string, number>]) {
          const g = { ...base, seen };
          const f = legacyFamilyFrom(g);
          expect(f.o.map((x) => x.k)).toEqual(olderSiblingPlan(b.peerSeed, b.report).map((x) => x.gap));
          expect(f.o.length + f.y.length).toBe(familyOf(g).siblings.length);
          if (f.y.length > 0) withEvent++;
        }
      }
    }
    expect(withEvent).toBeGreaterThan(30);
  });
});

describe('크기 (2-3절: 저장 추가량 ≤ 1000자)', () => {
  it('7세대 × 1000판 중 가장 큰 family도 1000자 이하이고, 평균은 훨씬 작다', () => {
    let max = 0;
    let sum = 0;
    let n = 0;
    for (const gen of GENERATION_IDS) {
      for (const seed of spreadSeeds(1000, GENERATION_IDS.indexOf(gen))) {
        const len = JSON.stringify(generateBirthFromSeed(seed, gen).family).length;
        max = Math.max(max, len);
        sum += len;
        n++;
      }
    }
    expect(max).toBeLessThanOrEqual(1000);
    expect(sum / n).toBeLessThan(600);
  });

  it('로그를 40개 쌓은 최악의 경우도 한도 안이다(FM4b가 쓸 자리 점검)', () => {
    const s = life();
    const log = Array.from({ length: 40 }, (_, i) => [4 + (i % 5), 10 + (i % 8), 100 + i, 0]);
    expect(JSON.stringify({ ...s.family, l: log }).length).toBeLessThanOrEqual(1000);
  });
});

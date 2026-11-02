import { describe, expect, it } from 'vitest';
import { FAMILY_BASIS, FAMILY_TABLES } from '../src/data/familyTables';
import tablesRaw from '../src/data/family/tables.json?raw';
import { BIRTH_SIBLING_DISPLAY, BIRTH_SIBLING_TEXT, birthSiblingLine } from '../src/data/birthSiblingText';
import { familyTables, gameData, isGameDataReady } from '../src/core';

/**
 * 가족 모델 표 덩어리 `familyData` (SPEC-009 FM4a, 설계 문서 D-4·A-10·FA0-4): 모양, 설계 문서에 적힌 값과의 대조, 근거 표시, 지연 로드 연결, 출생신고 형제자매 문구(B-1 기본값).
 * 표의 값은 `scripts/genFamilyTables.ts`가 묵은 자료(`docs/data/fd-a-family.json`)에서 뽑는다 — 이 시험은 자료 파일을 읽지 않고(다른 수집 작업이 같은 파일을 늘리는 중에도 안정) 표 자체를 본다.
 */

describe('tables.json 모양', () => {
  const t = FAMILY_TABLES;

  it('사망확률: 남·여 × 22구간 × 1970~2024(55해), 확률 0~1, 마지막 구간(100세 이상)은 전 해 1, 나이가 들수록 커진다', () => {
    expect(t.mortality.firstYear).toBe(1970);
    expect(t.mortality.lastYear).toBe(2024);
    expect(t.mortality.classes).toBe(22);
    expect(t.mortality.qx).toHaveLength(2);
    for (const sex of t.mortality.qx) {
      expect(sex).toHaveLength(22);
      for (const row of sex) {
        expect(row).toHaveLength(55);
        for (const q of row) {
          expect(q).toBeGreaterThanOrEqual(0);
          expect(q).toBeLessThanOrEqual(1);
        }
      }
      expect(sex[21].every((q) => q === 1)).toBe(true);
      // 2024년 열: 15~19세(구간 4)보다 70~74세(구간 14)가 훨씬 크다
      expect(sex[14][54]).toBeGreaterThan(sex[4][54] * 5);
    }
    expect(t.mortality.e0Slope[0]).toBeGreaterThan(0.2);
    expect(t.mortality.e0Slope[1]).toBeGreaterThan(t.mortality.e0Slope[0]); // 여자가 더 빨리 늘었다
  });

  it('어머니 출산 연령: 일곱 칸, 1981~2025 45해 + 센서스 5칸(1956~1980), 각 줄 합 100 근방', () => {
    const m = FAMILY_TABLES.motherAge;
    expect(m.bins).toHaveLength(7);
    expect(m.vitalFrom).toBe(1981);
    expect(m.vital).toHaveLength(45);
    for (const row of [...m.vital, ...m.census.map((c) => c.pct)]) {
      expect(row).toHaveLength(7);
      expect(row.reduce((a, b) => a + b, 0)).toBeGreaterThan(99.5);
      expect(row.reduce((a, b) => a + b, 0)).toBeLessThan(100.6);
    }
    expect(m.census.map((c) => [c.from, c.to])).toEqual([[1956, 1960], [1961, 1965], [1966, 1970], [1971, 1975], [1976, 1980]]);
    // 센서스 칸은 같은 묶음의 더 어린 자녀 쪽을 쓴다: 1956~60은 10~14세 자녀(1970 센서스)뿐, 1976~80은 1980 센서스 0~4세
    expect(m.census[0].childAge).toBe(10);
    expect(m.census[4]).toMatchObject({ census: 1980, childAge: 0 });
    // 1981년: 20~24세 38.68 · 25~29세 41.59 (인구동향조사)
    expect(m.vital[0][1]).toBeCloseTo(38.68, 1);
    expect(m.vital[0][2]).toBeCloseTo(41.59, 1);
    expect(m.shift).toEqual([{ to: 1915, by: 3 }, { to: 1935, by: 2 }, { to: 1955, by: 1 }]);
  });

  it('조부모와 사는 아동: 2000·2005는 센서스 환산(15.00·14.65), 1970 42.9 · 1995 18.4 · 2025 4.7(3세대 이상 × 1.85), 시간순', () => {
    const pts = FAMILY_TABLES.household.points;
    const at = (y: number) => pts.find((p) => p[0] === y)!;
    expect(at(2000)).toEqual([2000, 15, 'official-calc']);
    expect(at(2005)).toEqual([2005, 14.65, 'official-calc']);
    expect(at(1970)[1]).toBeCloseTo(42.9, 0);
    expect(at(1995)[1]).toBeCloseTo(18.4, 0);
    expect(at(2025)[1]).toBeCloseTo(4.7, 0);
    expect(at(1970)[2]).toBe('estimated');
    for (let i = 1; i < pts.length; i++) expect(pts[i][0]).toBeGreaterThan(pts[i - 1][0]);
    expect(FAMILY_TABLES.household.multiplier).toBe(1.85);
  });

  it('부모 이혼: 1993~2025 33해의 비율(%)과 조이혼율 1970~2025 56해', () => {
    const d = FAMILY_TABLES.divorce;
    expect(d.rateFrom).toBe(1993);
    expect(d.rate).toHaveLength(33);
    expect(d.rate[0]).toBeCloseTo(0.47, 3);
    expect(Math.max(...d.rate)).toBeCloseTo(1.539, 3); // 2003 최고
    expect(d.rate.indexOf(Math.max(...d.rate)) + 1993).toBe(2003);
    expect(d.crudeFrom).toBe(1970);
    expect(d.crude).toHaveLength(56);
    expect(d.crude[0]).toBeCloseTo(0.4, 5);
  });

  it('표는 한 글자도 숨은 문자·이름을 담지 않고, 크기는 64KB 안이다(지연 덩어리 — 집 표(묶음 B)가 들어와 25KB에서 올렸다)', () => {
    expect(tablesRaw.length).toBeLessThan(64_000);
    expect(JSON.parse(tablesRaw)).toBeTypeOf('object');
  });
});

describe('근거 표시 (FA0-4)', () => {
  it('모든 칸에 basis(official · calc · estimated · design)와 한 줄 근거가 있다', () => {
    expect(FAMILY_BASIS.length).toBeGreaterThanOrEqual(8);
    const ids = new Set<string>();
    for (const b of FAMILY_BASIS) {
      expect(['official', 'calc', 'estimated', 'design']).toContain(b.basis);
      expect(b.note.length).toBeGreaterThan(10);
      expect(ids.has(b.id), b.id).toBe(false);
      ids.add(b.id);
    }
    for (const kind of ['official', 'calc', 'estimated', 'design']) expect(FAMILY_BASIS.some((b) => b.basis === kind), kind).toBe(true);
  });
});

describe('지연 덩어리 연결', () => {
  it('설치된 게임 데이터에 family 표가 있고 core의 familyTables()가 그것을 돌려준다', () => {
    expect(isGameDataReady()).toBe(true);
    expect(gameData().family).toBe(FAMILY_TABLES);
    expect(familyTables()).toBe(FAMILY_TABLES);
  });
});

describe('출생신고 형제자매 칸 — 기본값은 위 형제만 (B-1)', () => {
  const fam = (older: Array<0 | 1>, younger: number) => ({
    o: older.map((g, i) => ({ g, k: 2 + i * 3, s: 22 })),
    y: Array.from({ length: younger }, (_, i) => ({ g: 0 as const, k: 3 + i * 3, s: 25 })),
  });

  it('기본값 showYounger는 false이고 문구 조각은 한 상수 객체에 있다', () => {
    expect(BIRTH_SIBLING_DISPLAY.showYounger).toBe(false);
    expect(BIRTH_SIBLING_TEXT.label).toBe('형제자매');
  });

  it('위 형제가 없으면 「위로 없음」, 있으면 호칭별 명수 — 남자 주인공은 형·누나, 여자 주인공은 오빠·언니', () => {
    expect(birthSiblingLine(fam([], 0), 'male')).toBe('위로 없음');
    expect(birthSiblingLine(fam([0], 0), 'male')).toBe('위로 형 1명');
    expect(birthSiblingLine(fam([0, 1], 0), 'male')).toBe('위로 형 1명, 누나 1명');
    expect(birthSiblingLine(fam([1, 1, 0], 0), 'female')).toBe('위로 언니 2명, 오빠 1명');
  });

  it('아래 동생이 있어도 기본값에서는 보이지 않는다(태어나는 해에 처음 보인다) — 켜면(showYounger) 「아래로 동생 N명」이 붙는다', () => {
    expect(birthSiblingLine(fam([0], 2), 'male')).toBe('위로 형 1명');
    expect(birthSiblingLine(fam([], 3), 'female')).toBe('위로 없음');
    expect(birthSiblingLine(fam([0, 1], 2), 'male', true)).toBe('위로 형 1명, 누나 1명, 아래로 동생 2명');
    expect(birthSiblingLine(fam([], 1), 'male', true)).toBe('위로 없음, 아래로 동생 1명');
    expect(birthSiblingLine(fam([0], 0), 'male', true)).toBe('위로 형 1명');
  });
});

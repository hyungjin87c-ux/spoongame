import peersSrc from '../src/core/peers.ts?raw';
import { describe, expect, it } from 'vitest';
import { ERAS, GENDERS, PEER_COUNT, beginBirth, createInitialState, isRejectedName, peersOf, type Era } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { allowedGiven, checkBirthReport, rawRegions, rawSigungu } from '../scripts/pipelineLib';
import { codeOnly } from './helpers/code';
import { sigmaTolerancePct, EPS } from './helpers/stats';

/**
 * 같은 해 태어난 사람들 (SPEC-003 VP3). 이름 풀 일치는 원자료를 직접 읽은 독립 기준(scripts/pipelineLib.ts#allowedGiven — scourt 원자료·names.json을 직접 읽는다)으로 대조한다.
 */

const YEAR: Record<Era, number> = { past: 1972, present: 2026, future: 2044 };

describe('peersOf: 결정적이고 4명이다', () => {
  it('같은 시드·같은 출생 연월 → 같은 인물(새로고침해도 같다). 시드나 출생 연월이 다르면 다른 인물', () => {
    for (const era of ERAS) {
      const a = peersOf(123456, YEAR[era], 5, '김민준');
      expect(PEER_COUNT).toBe(4);
      expect(a).toHaveLength(4);
      expect(peersOf(123456, YEAR[era], 5, '김민준')).toEqual(a);
      expect(peersOf(123457, YEAR[era], 5, '김민준')).not.toEqual(a);
      expect(peersOf(123456, YEAR[era], 6, '김민준')).not.toEqual(a);
    }
  });

  it('상태에는 시드만 저장되고 인물은 매번 같은 함수로 만든다: 저장된 peerSeed로 다시 만든 또래가 처음과 같다', () => {
    const born = beginBirth(createInitialState(31337), 'present');
    const first = peersOf(born.peerSeed!, born.character!.birthYear, born.birthReport!.month, born.character!.name);
    const restored = JSON.parse(JSON.stringify(born)) as typeof born;
    expect(peersOf(restored.peerSeed!, restored.character!.birthYear, restored.birthReport!.month, restored.character!.name)).toEqual(first);
  });

  it('입력 검사: 시대 밖 연도·1~12가 아닌 월은 throw', () => {
    expect(() => peersOf(1, 2000, 1)).toThrow(RangeError);
    expect(() => peersOf(1, 2026, 0)).toThrow(RangeError);
    expect(() => peersOf(1, 2026, 13)).toThrow(RangeError);
    expect(() => peersOf(1, 2026, 1.5)).toThrow(RangeError);
  });
});

describe('이름·지역·수저 규칙 (세 시대 × 시드 1000개, 원자료 직접 대조)', () => {
  for (const era of ERAS) {
    it(`${era}: 이름이 그 시대·성별 풀과 100% 일치, 서로·주인공과 겹치지 않음, 금지 이름·성과 첫 글자가 같은 이름 없음, 지역·시군구·수저가 유효하다`, () => {
      let peers = 0;
      const genders = new Set<string>();
      const regions = rawRegions(YEAR[era])!;
      const regionNames = new Set(regions.map((r) => r.name));
      for (let seed = 1; seed <= 1000; seed++) {
        const main = '이주원';
        const list = peersOf(seed * 7919, YEAR[era], 1 + (seed % 12), main);
        const names = new Set([main]);
        for (const p of list) {
          peers++;
          genders.add(p.gender);
          const surname = p.name[0];
          const given = p.name.slice(1);
          const allowed = allowedGiven(YEAR[era], p.gender)!;
          expect(allowed, `${era} ${seed} ${p.name}`).toContain(given);
          expect(isRejectedName(surname, given), `${p.name}`).toBe(false);
          expect(names.has(p.name), `${era} ${seed} 이름 겹침 ${p.name}`).toBe(false);
          names.add(p.name);
          expect(regionNames.has(p.region), p.region).toBe(true);
          expect(rawSigungu(YEAR[era], p.region).has(`${p.sigunguSido}|${p.sigungu}`), `${p.region} ${p.sigungu}`).toBe(true);
          expect([1, 2, 3, 4, 5]).toContain(p.wealth);
        }
      }
      expect(peers).toBe(4000);
      expect(genders).toEqual(new Set(GENDERS));
    });
  }

  it('수저는 시대 가중치(ERA_CONFIG.wealthWeights)와 4σ 이내, 지역은 룰렛 지역 확률과 4σ 이내로 나온다 (또래 24000명)', () => {
    for (const era of ERAS) {
      const all = Array.from({ length: 6000 }, (_, i) => peersOf(i * 31 + 7, YEAR[era], 1 + (i % 12))).flat();
      expect(all).toHaveLength(24000);
      ERA_CONFIG[era].wealthWeights.forEach((weight, i) => {
        const observed = (all.filter((p) => p.wealth === i + 1).length / all.length) * 100;
        expect(Math.abs(observed - weight), `${era} ${i + 1}단계 관측 ${observed.toFixed(2)}% / 기대 ${weight}%`).toBeLessThanOrEqual(sigmaTolerancePct(weight, all.length) + EPS);
      });
      for (const r of rawRegions(YEAR[era])!) {
        const observed = (all.filter((p) => p.region === r.name).length / all.length) * 100;
        expect(Math.abs(observed - r.sharePct), `${era} ${r.name} 관측 ${observed.toFixed(2)}% / 기대 ${r.sharePct}%`).toBeLessThanOrEqual(sigmaTolerancePct(r.sharePct, all.length) + EPS);
      }
    }
  });

  it('이름이 풀 크기 때문에 겹칠 위험이 있어도 겹치지 않는다: 주인공 이름을 피한다(주인공과 같은 이름이 또래에 없다)', () => {
    // 가장 흔한 이름 조합을 주인공으로 두고 또래 4000명을 만들어도 겹치지 않는다
    for (const main of ['김서준', '이도윤', '박하준']) {
      for (let i = 0; i < 1000; i++) expect(peersOf(i + 1, 2026, 1 + (i % 12), main).map((p) => p.name)).not.toContain(main);
    }
  });
});

describe('출생 결과 전체의 독립 점검 (checkBirthReport)', () => {
  it('세 시대 × 시드 300개: 룰렛 결과·출생신고 상세·서술문·또래가 원자료 기준 점검을 통과한다', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 300; seed++) {
        const game = beginBirth(createInitialState(seed * 977), era);
        expect(checkBirthReport(game, `${era} ${seed}`), `${era} ${seed}`).toEqual([]);
      }
    }
  });

  it('대조군: 값을 일부러 틀리게 하면 점검이 잡는다 (룰렛 멈출 자리·지역·시군구·체중 격자·부모 나이·또래 시드 없음·서술문 형식)', () => {
    const game = beginBirth(createInitialState(2468), 'present');
    expect(checkBirthReport(game, 'x')).toEqual([]);
    const r = game.birthReport!;
    const wrongRegion = r.region === '서울' ? '부산' : '서울';
    const cases: Array<[string, ReturnType<typeof beginBirth>, string]> = [
      ['지역이 룰렛 목록 밖', { ...game, birthReport: { ...r, region: '울산광역시' } }, '룰렛 목록에 없다'],
      ['시군구가 그 지역의 후보가 아님', { ...game, birthReport: { ...r, region: wrongRegion } }, '후보가 아니다'],
      ['체중이 0.1kg 격자 밖', { ...game, birthReport: { ...r, birthWeightKg: 3.25 } }, '격자'],
      ['부모 나이 범위 밖', { ...game, birthReport: { ...r, mother: { ...r.mother, age: 12 } } }, '어머니 나이'],
      ['직업 이상값', { ...game, birthReport: { ...r, father: { ...r.father, job: 'x' as never } } }, '아버지 직업'],
      ['형제 순서 범위 밖', { ...game, birthReport: { ...r, birthOrder: 9 } }, '형제 순서'],
      ['월 범위 밖', { ...game, birthReport: { ...r, month: 14 } }, '출생 월'],
      ['또래 시드 없음', { ...game, peerSeed: null }, '또래 시드'],
      ['지금 세상 출생 연도가 지난 세상', { ...game, character: { ...game.character!, birthYear: 1975 } }, ''],
    ];
    for (const [name, broken, needle] of cases) {
      const problems = checkBirthReport(broken, name);
      expect(problems.length, name).toBeGreaterThan(0);
      if (needle !== '') expect(problems.join('\n'), name).toContain(needle);
    }
  });
});

describe('또래 소스 점검', () => {
  it('peers.ts에 Math.random·Date가 없다 — 난수는 시드에서 만든 RNG뿐이다', () => {
    const code = codeOnly(peersSrc); // 주석은 빼고 코드만 본다
    expect(code.trim().length).toBeGreaterThan(200);
    expect(code).not.toContain('Math.random');
    expect(code).not.toMatch(/Date\.now|new Date/);
  });
});

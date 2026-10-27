import { describe, expect, it } from 'vitest';
import { GENERATION_CHOICES, GENERATION_IDS } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { beginBirth, createInitialState } from '../src/core';
import { pickRandomGeneration } from '../src/core/generationMixture';
import { ALL_GENERATIONS_RANGE, FIRST_BIRTH_YEAR, GENERATIONS, LAST_BIRTH_YEAR, generationDef, generationsOfYear, isGenerationId, yearsOfGeneration } from '../src/data/generations';
import { GENERATION_CONFIG } from '../src/data/generationConfig';

/**
 * 세대 정의표 (SPEC-004 GD1·GD2, `docs/data/generations.md` 2절) — 7종·범위 경계·겹침 해·연 수 합 85 · 서로 다른 연도 81개(1940~2020), 알파는 2013~2020이고 2021년 이후는 어느 세대에도 없다(r3).
 * 랜덤 세대(GS3): 7세대를 같은 확률(1/7)로 뽑는다.
 */

describe('GENERATIONS (GD1)', () => {
  it('세대 7종: id·표시 이름·출생 연도 범위가 형진 님 표 그대로다', () => {
    expect(GENERATIONS.map((g) => [g.id, g.label, g.birth.from, g.birth.to])).toEqual([
      ['industrial', '산업화 세대 · 전후 세대', 1940, 1954],
      ['boomer', '베이비붐 세대', 1955, 1963],
      ['g86', '86세대', 1960, 1969],
      ['genx', 'X세대', 1970, 1980],
      ['millennial', '밀레니얼 세대', 1981, 1996],
      ['genz', 'Z세대', 1997, 2012],
      ['alpha', '알파 세대', 2013, 2020],
    ]);
    expect(GENERATIONS.map((g) => g.id)).toEqual([...GENERATION_IDS]);
  });

  it('BGM 참고 장르(표시용)가 세대마다 하나씩이다', () => {
    expect(GENERATIONS.map((g) => g.bgm)).toEqual(['trot', 'folk', 'citypop', 'njs', 'electropop', 'lofi', 'chiptune']);
  });

  it('연 수 합 85 − 겹침 4(1960~1963) = 서로 다른 연도 81개, 합집합 = 1940~2020 전체이고 빈 해가 없다', () => {
    const counts = GENERATIONS.map((g) => g.birth.to - g.birth.from + 1);
    expect(counts).toEqual([15, 9, 10, 11, 16, 16, 8]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(85);
    const union = new Set(GENERATION_IDS.flatMap((id) => yearsOfGeneration(id)));
    expect(union.size).toBe(81);
    for (let y = FIRST_BIRTH_YEAR; y <= LAST_BIRTH_YEAR; y++) expect(union.has(y), `${y}`).toBe(true);
  });

  it('알파 마지막 해 2020 = LAST_BIRTH_YEAR이고 2021 이상은 어느 세대에도 없다', () => {
    expect(LAST_BIRTH_YEAR).toBe(2020);
    expect(generationDef('alpha').birth.to).toBe(LAST_BIRTH_YEAR);
    for (const y of [2021, 2022, 2025, 2026, 2030, 2060]) expect(generationsOfYear(y), `${y}`).toEqual([]);
    expect(generationsOfYear(1939)).toEqual([]);
    expect(ALL_GENERATIONS_RANGE).toEqual({ from: 1940, to: 2020 });
  });

  it('겹침 해 1960~1963은 베이비붐과 86세대 양쪽이고 나머지 해는 정확히 한 세대다 (GD2)', () => {
    for (let y = 1940; y <= 2020; y++) {
      const gens = generationsOfYear(y);
      if (y >= 1960 && y <= 1963) expect(gens, `${y}`).toEqual(['boomer', 'g86']);
      else expect(gens.length, `${y}`).toBe(1);
    }
  });

  it('GENERATION_CHOICES = 「랜덤」 + 세대 7종 (첫 화면 목록 8줄의 값)', () => {
    expect([...GENERATION_CHOICES]).toEqual(['random', ...GENERATION_IDS]);
    expect(GENERATION_CHOICES.length).toBe(8);
    expect(isGenerationId('alpha')).toBe(true);
    expect(isGenerationId('random')).toBe(false);
    expect(isGenerationId('past')).toBe(false);
  });

  it('알려지지 않은 id는 throw한다', () => {
    expect(() => generationDef('present' as never)).toThrow();
  });
});

describe('랜덤 세대 (GS3)', () => {
  it('randomWeight는 7세대 모두 1/7이다 (인구 비례가 아니다)', () => {
    for (const id of GENERATION_IDS) expect(GENERATION_CONFIG[id].randomWeight, id).toBeCloseTo(1 / 7, 12);
  });

  it('70000회 뽑기에서 세대별 횟수가 10000 ± 4σ(≈ ±370) 안이다', () => {
    const rng = createRng(20261027);
    const counts: Record<string, number> = Object.fromEntries(GENERATION_IDS.map((id) => [id, 0]));
    for (let i = 0; i < 70000; i++) counts[pickRandomGeneration(rng)]++;
    const sigma = Math.sqrt(70000 * (1 / 7) * (6 / 7));
    for (const id of GENERATION_IDS) expect(Math.abs(counts[id] - 10000), `${id} ${counts[id]}`).toBeLessThan(4 * sigma);
    expect(Math.round(4 * sigma)).toBeGreaterThanOrEqual(370);
  });

  it('같은 시드면 같은 세대가 나온다 (새로고침해도 같은 결과)', () => {
    for (let seed = 1; seed <= 200; seed++) expect(pickRandomGeneration(createRng(seed))).toBe(pickRandomGeneration(createRng(seed)));
  });

  it('GS3 경로 동치(1000판): 「랜덤 세대」 줄로 태어난 판 = 같은 RNG 상태에서 뽑은 세대를 직접 고른 판 — 둘 다 같은 generateBirth를 거쳐 인물·출생신고·또래 시드·난수 상태가 같다', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const init = createInitialState(seed * 7919);
      const viaRandom = beginBirth(init, 'random');
      // 랜덤 경로가 한 일을 손으로 되짚는다: 난수 1번으로 세대를 뽑고, 그 상태에서 직접 고른 경로를 부른다
      const rng = createRng(init.rngState);
      const g = pickRandomGeneration(rng);
      expect(viaRandom.generation, `시드 ${seed}`).toBe(g);
      const direct = beginBirth({ ...init, rngState: rng.getState() }, g);
      expect(direct.character, `시드 ${seed}`).toEqual(viaRandom.character);
      expect(direct.stats, `시드 ${seed}`).toEqual(viaRandom.stats);
      expect(direct.birthReport, `시드 ${seed}`).toEqual(viaRandom.birthReport);
      expect(direct.peerSeed, `시드 ${seed}`).toBe(viaRandom.peerSeed);
      expect(direct.rngState, `시드 ${seed}`).toBe(viaRandom.rngState);
      // 표지만 다르다: 랜덤 경로는 fromRandom을 단다
      expect(viaRandom.fromRandom).toBe(true);
      expect(direct.fromRandom).toBeUndefined();
    }
  });
});

import { describe, expect, it } from 'vitest';
import golden from './fixtures/scene-golden.json';
import { ALL_ERA_WINDOWS, ERA_GOLDEN_BANDS, ERA_GOLDEN_BIRTHS, ERA_GOLDEN_SEEDS, SCENE_GOLDEN_AGES, SCENE_GOLDEN_SEEDS, eraGolden, sceneGolden } from './helpers/sceneGolden';

/**
 * 집 그림(`sceneOf`)과 시대의 창(`eraOf`)의 고정 시드 골든 (SPEC-009 FM5b, 검수 R-546). 골든은 `scripts/sceneGolden.ts`(`npm run golden:scene`)가 만든다 — 규칙·표·승인된 데이터를 **일부러** 바꿀 때만 다시 만들고
 * 바뀐 글을 눈으로 확인한다. 이 시험이 깨졌다면 의도한 변경인지 먼저 본다(예: 소품 개수·집 크기 규칙, 시대의 창 고르기·데이터).
 */
describe('고정 시드 골든 — 집 그림 sceneOf (7세대 × 3시드 × 9나이)', () => {
  const now = sceneGolden();
  it('골든이 정한 칸(세대·시드·나이)과 지금 시험이 도는 칸이 같다', () => {
    expect(golden.sceneSeeds).toBe(SCENE_GOLDEN_SEEDS);
    expect(golden.sceneAges).toEqual([...SCENE_GOLDEN_AGES]);
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden.scene).sort());
    expect(Object.keys(now).length).toBe(7 * SCENE_GOLDEN_SEEDS * SCENE_GOLDEN_AGES.length);
  });
  it('모든 칸의 배경·집(크기·지붕)·식구 수·소품·반려동물·열쇠 해시가 골든과 같다', () => {
    const diff = Object.entries(golden.scene).filter(([k, v]) => now[k] !== v).map(([k, v]) => `${k}\n  골든 ${v}\n  지금 ${now[k]}`);
    expect(diff.slice(0, 5), `달라진 칸 ${diff.length}개 — 의도한 변경이면 npm run golden:scene`).toEqual([]);
  });
});

describe('고정 시드 골든 — 시대의 창 eraOf (시드 2 × 수저 구간 3 × 가리기 2 × 출생 6, 출생~2025)', () => {
  const now = eraGolden();
  it('골든이 정한 칸과 같고, 그림 번호표(승인된 43장)가 같다', () => {
    expect(golden.eraSeeds).toEqual([...ERA_GOLDEN_SEEDS]);
    expect(golden.eraBands).toEqual([...ERA_GOLDEN_BANDS]);
    expect(golden.eraBirths).toEqual([...ERA_GOLDEN_BIRTHS]);
    expect(ALL_ERA_WINDOWS.length).toBe(43);
    expect(now.ids).toEqual(golden.eraIds);
    expect(Object.keys(now.rows).sort()).toEqual(Object.keys(golden.era).sort());
  });
  it('모든 칸의 해마다 그림·가림 표시가 골든과 같다', () => {
    const diff = Object.entries(golden.era).filter(([k, v]) => now.rows[k] !== v).map(([k]) => k);
    expect(diff, '달라진 칸 — 의도한 변경이면 npm run golden:scene').toEqual([]);
  });
  it('골든 자체가 공허하지 않다: 그림이 있는 해가 많고, 가리기 칸에는 가려진 해가 있으며, 안 가리는 칸에는 없다', () => {
    const rows = Object.entries(golden.era);
    for (const [k, line] of rows) {
      const pics = (line.match(/\d\d[.v]/g) ?? []).filter((c) => c.slice(0, 2) !== '00').length;
      // 승인된 그림은 1940~1990년대뿐이라 2003년생은 한 해도 그림이 없다(빈 틀) — 그 밖의 출생은 있어야 한다
      if (!k.endsWith('/2003')) expect(pics, k).toBeGreaterThan(0);
      else expect(pics, k).toBe(0);
      if (k.includes('/plain/')) expect(line.includes('v'), k).toBe(false);
    }
    expect(rows.filter(([k, line]) => k.includes('/gentle/') && k.endsWith('/1944') && line.includes('v')).length).toBeGreaterThan(0);
  });
});

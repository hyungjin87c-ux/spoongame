import { describe, expect, it } from 'vitest';
import golden from './fixtures/scene-golden.json';
import { ALL_ERA_WINDOWS, ERA_GOLDEN_BANDS, ERA_GOLDEN_BIRTHS, ERA_GOLDEN_SEEDS, SCENE_GOLDEN_AGES, SCENE_GOLDEN_SEEDS, eraGolden, sceneGolden } from './helpers/sceneGolden';

/**
 * 집 그림(`sceneOf`)과 시대의 창(`eraOf`)의 고정 시드 골든 (SPEC-009 FM5b, 검수 R-546). 골든은 `scripts/sceneGolden.ts`(`npm run golden:scene`)가 만든다 — 규칙·표·승인된 데이터를 **일부러** 바꿀 때만 다시 만들고
 * 바뀐 글을 눈으로 확인한다. 이 시험이 깨졌다면 의도한 변경인지 먼저 본다(예: 소품 개수·집 크기 규칙, 시대의 창 고르기·데이터).
 * **FM4b 갱신(2026-10-28)**: 골든을 다시 만들었다. 사유 둘 — ① 집 종류·방 수가 출생 때 정한 값(`family.h`, 묶음 B)으로 채워져 장면 칸 104개의 집 모양·크기가 표의 모양대로 달라졌다(이전: 점유 형태 기본 모양)
 * ② 가리기를 켠 1987년의 대체 그림이 12월 투표소가 되었다(FM5b 마스터 결정) — 시대의 창 칸 중 1987년 가리기 칸만 달라졌다.
 * **FM4b 검수 1회차 반영 갱신(2026-11-02, R-557·R-558·R-565)**: 장면 189칸 중 4칸(식구 수·열쇠 해시)을 다시 만들었다 — 조부모 별세 해·함께 사는 쪽·동생 구성이 달라져 그 나이의 식구 수가 달라진 칸이다(ai-log/2026-11-02_SPEC-009_dev-FM4b-r2.md 2절).
 * **시대의 창 r5 반영 갱신(2026-11-02)**: ① 장면 189칸 중 2칸(`boomer/1000041/9` · `g86/2000081/4`)의 집이 `house-detached-h2`에서 지붕이 초가인 `house-detached-h1×0.86`으로 바뀌었다 — 초가 규칙(단독 · 시골/해안 · 재력 ≤ 2 · ~1975, era-window.md 9-4절 ③)이 1970~75에도 h1을 쓰게 했다. 나머지 187칸은 그대로다. ② 시대의 창 72행은 그림 번호표가 43장 → 94장이라 번호가 모두 새로 매겨졌다. 번호를 id로 풀어 견주면 1990년 앞 해(1940~1989)의 그림·가림 표시는 바뀌지 않았고, 바뀐 칸은 모두 1990년 이후 해다(ai-log/2026-11-02_SPEC-009_dev-era-r5.md 3절).
 * **FM6 갱신(2026-11-02)**: 장면 189칸 중 76칸의 열쇠 해시를 다시 만들었다(시대의 창 72행은 그대로). 사유 하나 — 「가진 것」(FK2)과 묶인 소품(`prop-antenna`·`prop-ac-unit`·`prop-car`·`prop-ev-charger`)이 이제 그려진다:
 * `sceneInputOf`가 `possessionTiesOf`(집의 순위와 항목 보급률)를 기본으로 읽는다. 일찍 텔레비전·에어컨·승용차를 들인 집에만 나오므로 0~85세 모든 나이에서 칸이 바뀐다 — 달라진 칸은 앞 소품 73 · 뒤+앞 소품 3이고
 * 집 종류·배경·식구 수·반려동물은 한 칸도 달라지지 않았다(골든 판은 플래그가 없어 배우자·자녀 경로는 `tests/familyCard.test.ts`·`sceneFamily.test.ts`가 본다).
 * **FM7a 갱신(2026-11-06)**: 장면 189칸 중 3칸(`boomer/1000041/9·15·22`)의 식구 수가 하나씩 줄었다(8→7 · 8→7 · 6→5) — 사유 하나: 어린 형제의 이른 별세(Q3, `familyBirth.ts#siblingLossPlan`, 형진 님 승인·배율 1.0)가
 * 이 판의 아래 동생 `y1`(주인공 2세에 태어남)을 4살에 떠나게 해(주인공 6세의 해, 보기에서는 7세부터 떠난 사람) 그 뒤 나이의 「함께 사는 사람」에서 빠졌다. 같은 변경의 R-618(별세·이혼 하한 1세)·R-586(자녀 독립 나이)은
 * 이 골든 21판의 칸을 바꾸지 않았다(골든 판은 플래그가 없어 자녀 경로는 `tests/familyCard.test.ts`·`sceneFamily.test.ts`가 본다). 시대의 창 72행은 그대로다. 나머지 186칸은 열쇠 해시까지 같다.
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
  it('골든이 정한 칸과 같고, 그림 번호표(승인된 94장)가 같다', () => {
    expect(golden.eraSeeds).toEqual([...ERA_GOLDEN_SEEDS]);
    expect(golden.eraBands).toEqual([...ERA_GOLDEN_BANDS]);
    expect(golden.eraBirths).toEqual([...ERA_GOLDEN_BIRTHS]);
    expect(ALL_ERA_WINDOWS.length).toBe(94);
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
      // 승인된 그림이 1940~2025 모든 해에 닿으므로(94장) 어느 출생이든 그림이 있는 해가 있어야 한다 — 2003년생도 (2003~2025)
      expect(pics, k).toBeGreaterThan(0);
      if (k.includes('/plain/')) expect(line.includes('v'), k).toBe(false);
    }
    expect(rows.filter(([k, line]) => k.includes('/gentle/') && k.endsWith('/1944') && line.includes('v')).length).toBeGreaterThan(0);
  });
});

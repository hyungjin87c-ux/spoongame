import { expect, test } from '@playwright/test';
import { BIRTH_VARIANTS } from './m3Variants';
import { BIRTH_STATE_IDS, openWordBreakState } from './wordBreakStates';

/**
 * 룰렛·출생신고의 문구 (SPEC-003 QM3-3·QM3-4, QA-003-M3 M3-O05·M3-O07). 화면 문구는 없는 기능을 가리키지 않고(대시보드 또래 칸은 M4가 넣었다), 어체가 한 문단 안에서 섞이지 않는다.
 *  - QM3-3: 출생신고(세 세상 × 표본 7가지)의 눈에 보이는 글자에 `/대시보드|오른쪽 칸/` 0건, 또래 안내는 「네 사람도 같은 세상에서 나이를 먹습니다.」 + (M4 이후) 둘째 문장 하나. 안내가 가리키는 대시보드 또래 칸이 실제로 있는지는 e2e/m4-peers-note.spec.ts가 본다. (프로덕션 번들 스모크는 e2e-prod/smoke.spec.ts)
 *  - QM3-4: 비교 표 안내(서류 본문)는 합쇼체 — 문구 전체 단언·해요체 종결 0. 룰렛 회전 중 안내(화면 안내문)는 해요체 — 「확률대로 돌아가요.」
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

// M4: DASHBOARD_PEERS_SHIPPED = true → 둘째 문장이 더해졌다(첫 문장은 그대로). 위치(「오른쪽 칸」)가 아니라 누를 버튼 이름 + 칸 제목으로 가리킨다.
const PEERS_NOTE = '네 사람도 같은 세상에서 나이를 먹습니다. 살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.';
const COMPARE_NOTE = '평균은 각 통계의 전체 대상(학생, 가구) 기준이고, 이 가정 열은 수저 단계에 맞춘 소득 구간의 값입니다. 단계와 소득 구간의 대응은 게임의 설계값입니다.';
const SPIN_NOTE = '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.';

test.describe('출생신고 문구 360x740', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const id of BIRTH_STATE_IDS) {
    test(`${id}: 눈에 보이는 글자에 「대시보드」·「오른쪽 칸」 0건이고 또래 안내는 한 문단(두 문장)이다 (QM3-3)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await openWordBreakState(page, id);
      const text = (await page.getByTestId('birth-screen').innerText()).replace(/\s+/g, ' ');
      expect(text).not.toMatch(/대시보드|오른쪽 칸/);
      expect(text, '시대: 지금·지난·다가올 세상 모두').toContain('같은 해 태어난 사람들');
      const note = page.locator('[data-testid="peers-card"] p.card__note');
      await expect(note).toHaveCount(1);
      expect((await note.innerText()).trim()).toBe(PEERS_NOTE);
      // 화면에 안 보이는 속성에도 없다(aria-label 등)
      expect(await page.getByTestId('birth-screen').evaluate((el) => el.outerHTML)).not.toMatch(/대시보드|오른쪽 칸/);
    });
  }

  test('세 세상(지금·지난·다가올)을 모두 덮는다 — 표본 7가지에 세 시대가 모두 있다 (공허 통과 방지)', () => {
    const eras = new Set(BIRTH_STATE_IDS.map((id) => (id in BIRTH_VARIANTS ? BIRTH_VARIANTS[id as keyof typeof BIRTH_VARIANTS].era : 'present')));
    expect([...eras].sort()).toEqual(['future', 'past', 'present']);
  });

  for (const id of BIRTH_STATE_IDS) {
    const present = !(id in BIRTH_VARIANTS) || BIRTH_VARIANTS[id as keyof typeof BIRTH_VARIANTS].era === 'present';
    if (!present) continue;
    test(`${id}: 비교 표 안내는 서류 본문이라 합쇼체다 — 문구 전체 단언, 해요체 종결(「…요.」) 0 (QM3-4)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await openWordBreakState(page, id);
      const note = (await page.getByTestId('compare-note').innerText()).replace(/\s+/g, ' ').trim();
      expect(note).toBe(COMPARE_NOTE);
      for (const sentence of note.split(/(?<=\.)\s+/)) {
        expect(sentence).toMatch(/(입니다|합니다|됩니다|습니다)\.$/);
        expect(sentence).not.toMatch(/요\.$/);
      }
    });
  }
});

test.describe('룰렛 안내 360x740', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test('회전 중 안내는 화면 안내문이라 해요체로 통일 — 「…고를 수 없어요. 확률대로 돌아가요.」 (QM3-4, 마스터 확인 2)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await openWordBreakState(page, 'roulette-spin');
    const note = (await page.getByTestId('roulette-status').innerText()).replace(/\s+/g, ' ').trim();
    expect(note).toBe(SPIN_NOTE);
    expect(note).not.toMatch(/니다\./);
  });
});

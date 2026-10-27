import { expect, test } from '@playwright/test';
import { KNOWN_SEED, birthState, injectSave } from './helpers';

/**
 * 출생신고의 또래 안내 문구 ⇔ 대시보드 또래 칸 (SPEC-003 QM3-3, M4 착수 결정 3): 화면 문구는 없는 기능을 가리키지 않는다.
 * 출생신고의 또래 카드 안내 둘째 문장은 「살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.」이다 — 이 문장이 가리키는 것이 실제로 있어야 한다:
 *   ① 문장이 이름 붙인 버튼 「살아가기」가 출생신고 하단 띠에 그 글자로 있고,
 *   ② 그 버튼을 누르면 도착하는 대시보드에 문장이 이름 붙인 칸 「같은 해 태어난 사람들」이 제목 그대로 있으며,
 *   ③ 그 칸에 출생신고의 또래와 같은 네 사람이 「요즘 모습」(나이에 맞는 상태)과 함께 보이고,
 *   ④ 문장은 위치(「오른쪽 칸」)나 내부 이름(「대시보드」)을 쓰지 않는다(한 열인 좁은 화면에서는 그 칸이 맨 아래라 위치 서술이 틀린다).
 * 세 세상(지난·지금·다가올)에서 모두 본다. 안내문 전체 문구 단언은 e2e/m3-copy.spec.ts, 프로덕션 번들은 e2e-prod/smoke.spec.ts.
 */

const ERAS = [
  { era: 'alpha', wealth: 3 },
  { era: 'industrial', wealth: 2 },
  { era: 'genz', wealth: 5 },
] as const;

for (const { era, wealth } of ERAS) {
  test(`${era} 세상: 출생신고의 또래 안내가 가리키는 버튼·칸·사람이 실제로 있다 (문구 ⇔ 기능)`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await injectSave(page, birthState(KNOWN_SEED, era, wealth, 50), '/');
    await expect(page.getByTestId('birth-screen')).toBeVisible();

    // 안내문: 가리키는 이름 둘을 안내문에서 뽑는다
    const note = (await page.locator('[data-testid="peers-card"] p.card__note').innerText()).replace(/\s+/g, ' ').trim();
    const named = [...note.matchAll(/「([^」]+)」/g)].map((m) => m[1]);
    expect(named, '안내문이 이름 붙인 칸').toEqual(['같은 해 태어난 사람들']);
    expect(note).toMatch(/^네 사람도 같은 세상에서 나이를 먹습니다\. 살아가기를 누르면 /);
    expect(note, '위치·내부 이름을 쓰지 않는다').not.toMatch(/오른쪽|왼쪽|위쪽|아래쪽|대시보드/);
    const verb = /([가-힣]+)를 누르면/.exec(note)![1];

    // ① 안내문이 이름 붙인 버튼
    const next = page.getByTestId('next-life');
    await expect(next).toHaveText(verb);
    // 출생신고의 또래 네 사람
    const bornNames = await page.getByTestId('peer').locator('.name').allInnerTexts();
    expect(bornNames).toHaveLength(4);

    // ② 누르면 도착하는 대시보드에 그 칸이 제목 그대로 있다
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const card = page.getByTestId('peers-now-card');
    await expect(card.getByRole('heading', { name: named[0] })).toBeVisible();
    // ③ 같은 네 사람 + 요즘 모습(나이에 맞는 상태 라벨)
    const nowNames = await page.getByTestId('peer-now-name').allInnerTexts();
    expect(nowNames).toEqual(bornNames);
    const labels = await page.getByTestId('peer-now-label').allInnerTexts();
    expect(labels).toHaveLength(4);
    for (const l of labels) expect(l, '0세 또래는 모두 어린 시절').toBe('어린 시절');
    await expect(card).toContainText('설계값');
  });
}

test('또래 칸의 요즘 모습은 나이와 모순되지 않는다: 같은 판의 0세·성인에서 라벨이 나이에 맞게 바뀌고, 새로고침해도 같다 (VP4)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const adult = await page.evaluate<unknown>(`(async () => {
    const core = await import('/src/core/index.ts');
    await (await import('/src/data/gameData.ts')).loadGameData(); // MG8: 지연 로드 덩어리를 먼저 불러온다
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(${KNOWN_SEED}), 'alpha')));
    while (s.phase === 'life' && (s.age < 40 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
    return s;
  })()`);
  await injectSave(page, adult as Parameters<typeof injectSave>[1], '/');
  const read = async () => {
    // 지연 로드(MG8) 뒤 인생 화면이 그려지는 동안 목록이 비어 있을 수 있다 — 네 사람이 모두 그려진 뒤에 읽는다(이름을 먼저 읽고 라벨을 나중에 읽어 둘이 어긋나던 경합)
    await expect(page.getByTestId('peer-now-name')).toHaveCount(4);
    await expect(page.getByTestId('peer-now-label')).toHaveCount(4);
    return { names: await page.getByTestId('peer-now-name').allInnerTexts(), labels: await page.getByTestId('peer-now-label').allInnerTexts() };
  };
  const first = await read();
  expect(first.labels).toHaveLength(4);
  const ALLOWED = ['일하는 사람', '다시 일하는 사람', '구직 중', '돌봄', '은퇴', '학교에 다님', '어린 시절'];
  for (const l of first.labels) expect(ALLOWED).toContain(l);
  for (const l of first.labels) expect(['어린 시절', '학교에 다님'], '40세 또래가 어린 시절·학교일 수 없다').not.toContain(l);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('peers-now-card')).toBeVisible();
    expect(await read(), '새로고침해도 같다(결정적)').toEqual(first);
  }
});

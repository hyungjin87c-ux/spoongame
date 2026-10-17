import { expect, test, type Page } from '@playwright/test';
import { openM4Screen } from './m4States';
import { dashViolations, measureDash, settleDash } from './m4Fixed';
import { noHorizontalOverflow } from './helpers';
import { setRootFontPercent } from './textResize';

/**
 * 대시보드 「나가기」 확인 단계의 화면 맞춤 (QA-003-M4 O03, SPEC-003 QM2-12 (5)와 같은 규칙): 글자 200% 모바일에서 확인 단계를 열면 안내문 첫 줄이 화면 위로 밀리고 「돌아가기」만 보였다
 * (360×740 214px·320×568 343px·640×400 154px). 이제 확인 단계를 **열 때**, 열려 있는 동안 **크기(글자·창·회전)가 바뀐 뒤**에, 안내문 첫 줄과 포커스를 받은 「돌아가기」가 함께 화면 안에 오고
 * 포커스는 「돌아가기」에 그대로 있다. 둘이 고정 요소(헤더·하단 진행 줄)와 한 화면에 못 들어가면 두 고정 요소가 함께 풀린다(ui/exitAsk.ts) — 닫으면 원래대로 돌아온다.
 * 「화면 안」은 구현의 함수를 부르지 않고 여기서 따로 잰다: 위 가장자리 = 고정된(sticky) 헤더의 아래끝(풀렸으면 0), 아래 가장자리 = 고정된 진행 줄의 위끝(풀렸으면 창 높이) — 그 안에 있어야 한다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';

interface AskView {
  vh: number;
  /** 고정 요소가 가리지 않는 위·아래 가장자리 */
  top: number;
  bottom: number;
  titleTop: number;
  noTop: number;
  noBottom: number;
  headPosition: string;
  barPosition: string;
  focused: string | null;
  /** 안내문 첫 줄 한가운데에서 맞는 요소가 안내문 자신인가 / 「돌아가기」 한가운데에서 맞는 요소가 그 버튼인가 (다른 요소가 덮고 있지 않다) */
  titleHit: boolean;
  cancelHit: boolean;
}

async function askView(page: Page): Promise<AskView> {
  return page.evaluate(() => {
    const el = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const fixedLike = (e: HTMLElement) => ['fixed', 'sticky'].includes(getComputedStyle(e).position);
    const head = el('dash-head');
    const bar = el('controls');
    const title = el('exit-ask-title');
    const no = el('exit-no');
    const vh = window.innerHeight;
    const t = title.getBoundingClientRect();
    const n = no.getBoundingClientRect();
    // 안내문의 첫 줄 한가운데(위에서 한 줄 높이의 절반쯤) / 버튼 한가운데
    const lineY = t.top + Math.min(12, t.height / 2);
    const hitTitle = document.elementFromPoint(t.left + Math.min(40, t.width / 2), lineY);
    const hitNo = document.elementFromPoint(n.left + n.width / 2, n.top + n.height / 2);
    return {
      vh,
      top: fixedLike(head) ? head.getBoundingClientRect().bottom : 0,
      bottom: fixedLike(bar) ? bar.getBoundingClientRect().top : vh,
      titleTop: t.top,
      noTop: n.top,
      noBottom: n.bottom,
      headPosition: getComputedStyle(head).position,
      barPosition: getComputedStyle(bar).position,
      focused: (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? null,
      titleHit: hitTitle !== null && (title === hitTitle || title.contains(hitTitle)),
      cancelHit: hitNo !== null && (no === hitNo || no.contains(hitNo)),
    };
  });
}

/** 안내문 첫 줄과 「돌아가기」가 함께 고정 요소에 가리지 않는 가장자리 안에 있고, 포커스는 「돌아가기」에 있는가 — 어긋난 곳을 글로 돌려준다(비어 있으면 통과) */
function askProblems(v: AskView, label: string): string[] {
  const out: string[] = [];
  if (v.titleTop < v.top - 0.5) out.push(`${label}: 안내문 첫 줄(위끝 ${Math.round(v.titleTop)}px)이 위 가장자리(${Math.round(v.top)}px) 밖 — ${Math.round(v.top - v.titleTop)}px 가려졌다`);
  if (v.titleTop > v.vh - 8) out.push(`${label}: 안내문 첫 줄(위끝 ${Math.round(v.titleTop)}px)이 화면(${v.vh}px) 아래에 있다`);
  if (v.noBottom > v.bottom + 0.5) out.push(`${label}: 「돌아가기」(아래끝 ${Math.round(v.noBottom)}px)가 아래 가장자리(${Math.round(v.bottom)}px) 밖 — ${Math.round(v.noBottom - v.bottom)}px 가려졌다`);
  if (v.noBottom < 0 + 8) out.push(`${label}: 「돌아가기」(아래끝 ${Math.round(v.noBottom)}px)가 화면 위에 있다`);
  if (v.focused !== 'exit-no') out.push(`${label}: 포커스가 「돌아가기」에 없다(${v.focused})`);
  if (!v.titleHit) out.push(`${label}: 안내문 첫 줄 자리에서 다른 요소가 맞는다(가려졌다)`);
  if (!v.cancelHit) out.push(`${label}: 「돌아가기」 한가운데에서 다른 요소가 맞는다(가려졌다)`);
  return out;
}

/** 극단(구간이 화면보다 큰 경우)의 최소 보장: 포커스를 받은 「돌아가기」는 고정 요소에 가리지 않는 가장자리 안에 온다(CM10) — 안내문은 닿는 만큼만 보인다 */
function focusProblems(v: AskView, label: string): string[] {
  const out: string[] = [];
  if (v.noTop < v.top - 0.5) out.push(`${label}: 「돌아가기」(위끝 ${Math.round(v.noTop)}px)가 위 가장자리(${Math.round(v.top)}px) 밖`);
  if (v.noBottom > v.bottom + 0.5) out.push(`${label}: 「돌아가기」(아래끝 ${Math.round(v.noBottom)}px)가 아래 가장자리(${Math.round(v.bottom)}px) 밖 — ${Math.round(v.noBottom - v.bottom)}px 가려졌다`);
  if (v.focused !== 'exit-no') out.push(`${label}: 포커스가 「돌아가기」에 없다(${v.focused})`);
  if (!v.cancelHit) out.push(`${label}: 「돌아가기」 한가운데에서 다른 요소가 맞는다(가려졌다)`);
  return out;
}

async function openAsk(page: Page): Promise<void> {
  await expect(page.getByTestId('tool-exit')).toBeEnabled();
  await page.getByTestId('tool-exit').click();
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await expect(page.getByTestId('exit-no')).toBeFocused();
}

/** 맞춤은 열린 직후 한두 프레임 안에 끝난다 — 정착을 기다렸다가 잰다 */
async function settledView(page: Page, label: string): Promise<AskView> {
  await settleDash(page);
  await expect.poll(async () => askProblems(await askView(page), label), { message: label, timeout: 5_000 }).toEqual([]);
  return askView(page);
}

const SIZES = [
  { name: '360x740', width: 360, height: 740 },
  { name: '320x568', width: 320, height: 568 },
  { name: '640x400', width: 640, height: 400 },
] as const;

for (const size of SIZES) {
  test.describe(`나가기 확인 단계 맞춤 ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    for (const percent of [200, 100] as const) {
      test(`${size.name} · 글자 ${percent}%: 열면 안내문 첫 줄과 「돌아가기」가 함께 화면 안(고정 요소에 안 가림)에 오고 포커스는 「돌아가기」다 — 가로 넘침 0, 고정 요소 규칙 통과${percent === 200 ? ' (O03)' : ' (대조: 원래 되던 크기)'}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(60_000);
        await openM4Screen(page, 'dash-infant');
        if (percent !== 100) await setRootFontPercent(page, percent);
        await measureDash(page);
        await openAsk(page);
        const label = `${size.name}/${percent}%`;
        const v = await settledView(page, label);
        // 증거 스크린샷은 맞춘 직후(스크롤한 그대로)에 찍는다 — 아래 measureDash는 측정하며 맨 위로 스크롤한다. 입력 가드(0.4초)가 풀려 두 버튼이 활성이 된 뒤에 찍는다(R-340: 가드 중에는 버튼이 흐린 비활성이다)
        await expect(page.getByTestId('exit-no')).toBeEnabled();
        await expect(page.getByTestId('exit-yes')).toBeEnabled();
        await page.screenshot({ path: `${SHOTS}/dev-M4-r4-exit-ask-${size.name}-font${percent}.png` });
        expect(await noHorizontalOverflow(page), `${label}: 가로 넘침 0`).toBe(true);
        const m = await measureDash(page);
        expect(dashViolations(m, label), `${label}: 고정 요소 규칙(확인 단계가 열려 있을 때의 해제 포함)`).toEqual([]);
        testInfo.annotations.push({ type: '측정', description: `헤더 ${v.headPosition} · 진행 줄 ${v.barPosition} · 안내문 위끝 ${Math.round(v.titleTop)}px / 돌아가기 아래끝 ${Math.round(v.noBottom)}px / 가장자리 ${Math.round(v.top)}~${Math.round(v.bottom)}px (화면 ${v.vh}px)` });
      });
    }

    test(`${size.name} · 글자 200%: 닫고 다시 열어도 같다 — 닫으면 고정 요소가 원래 규칙으로 돌아오고(진행 줄 고정 ↔ 해제), 포커스는 「나가기」로 돌아온다. Esc도 같다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(60_000);
      await openM4Screen(page, 'dash-infant');
      await setRootFontPercent(page, 200);
      const closed = await measureDash(page);
      for (const how of ['돌아가기 버튼', 'Esc', '돌아가기 버튼'] as const) {
        await openAsk(page);
        await settledView(page, `${size.name}/200%/${how}`);
        if (how === 'Esc') await page.keyboard.press('Escape');
        else await page.getByTestId('exit-no').click();
        await expect(page.getByTestId('exit-ask')).toHaveCount(0);
        await expect(page.getByTestId('tool-exit')).toBeFocused();
        const after = await measureDash(page);
        // 닫은 뒤 고정 요소는 확인 단계 없이 열었을 때와 같다 (위 해제는 확인 단계 때문에만 생겼다)
        expect(after.bar!.position, `${how}로 닫은 뒤 진행 줄`).toBe(closed.bar!.position);
        expect(after.head!.position, `${how}로 닫은 뒤 헤더`).toBe(closed.head!.position);
        expect(dashViolations(after, `${size.name}/200%/닫은 뒤`)).toEqual([]);
      }
    });
  });
}

test.describe('나가기 확인 단계 맞춤: 가장 낮은 화면 320x256 (1280 창의 400% 상당)', () => {
  test.use({ viewport: { width: 320, height: 256 } });

  test('320x256 · 글자 100%: 고정 요소를 풀면 구간(약 212px)이 화면(256px)에 들어간다 — 안내문 첫 줄과 「돌아가기」가 함께 보인다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await openM4Screen(page, 'dash-infant');
    await measureDash(page);
    await openAsk(page);
    const v = await settledView(page, '320x256/100%');
    expect(v.barPosition, '진행 줄(112px = 44%)은 절반 규칙으로는 고정이지만 구간이 못 들어가 풀린다').toBe('static');
    expect(dashViolations(await measureDash(page), '320x256/100%')).toEqual([]);
  });

  test('320x256 · 글자 200%: 구간(약 557px)이 화면(256px)보다 커서 다 못 넣는다 — 포커스를 받은 「돌아가기」는 반드시 화면 안(CM10), 안내문은 닿는 만큼만. 열고 닫고 크기를 바꿔도 같다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(60_000);
    await openM4Screen(page, 'dash-infant');
    await setRootFontPercent(page, 200);
    await measureDash(page);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // 맨 아래에서 열어 스크롤이 일해야만 닿게 한다
    await expect(page.getByTestId('tool-exit')).toBeEnabled();
    await page.getByTestId('tool-exit').evaluate((el) => (el as HTMLButtonElement).click());
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    await expect(page.getByTestId('exit-no')).toBeFocused();
    await settleDash(page);
    await expect.poll(async () => focusProblems(await askView(page), '320x256/200% 열기')).toEqual([]);
    const v = await askView(page);
    expect(v.titleTop, '구간이 화면보다 커서 안내문 첫 줄은 화면 위로 잘린다(이 크기의 한계)').toBeLessThan(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.setViewportSize({ width: 320, height: 300 });
    await settleDash(page);
    await expect.poll(async () => focusProblems(await askView(page), '320x300/200% 높이 변경')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('exit-ask')).toHaveCount(0);
    await expect(page.getByTestId('tool-exit')).toBeFocused();
  });
});

test.describe('나가기 확인 단계 맞춤: 열려 있는 동안 크기가 바뀐 뒤', () => {
  test('글자 크기(100 ↔ 200%)·창 크기·회전이 바뀔 때마다 다시 맞춘다 — 새로고침 없이, 포커스를 잃지 않고 (QM2-12 (5))', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 360, height: 740 });
    await openM4Screen(page, 'dash-infant');
    await openAsk(page);
    await settledView(page, '360x740/100% 열기');
    const steps: Array<[string, () => Promise<void>]> = [
      ['글자 200%로 키움', () => setRootFontPercent(page, 200)],
      ['320×568로 줄임', () => page.setViewportSize({ width: 320, height: 568 })],
      ['640×400(가로·낮은 창)', () => page.setViewportSize({ width: 640, height: 400 })],
      ['667×375 가로 폰', () => page.setViewportSize({ width: 667, height: 375 })],
      ['글자 100%로 되돌림', () => setRootFontPercent(page, 100)],
      ['360×740 세로로 되돌림', () => page.setViewportSize({ width: 360, height: 740 })],
      ['글자 150%', () => setRootFontPercent(page, 150)],
      ['글자 200%·320×568', async () => {
        await page.setViewportSize({ width: 320, height: 568 });
        await setRootFontPercent(page, 200);
      }],
    ];
    for (const [name, change] of steps) {
      await change();
      await settledView(page, name);
      await expect(page.getByTestId('exit-ask'), `${name}: 확인 단계가 열린 채`).toBeVisible();
      expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid')), `${name}: 포커스 유지`).toBe('exit-no');
      expect(await noHorizontalOverflow(page), `${name}: 가로 넘침 0`).toBe(true);
    }
  });

  test('대조(측정이 실제로 잡는다): 맞춘 뒤 맨 위로 스크롤해 두면 측정이 「화면 밖」으로 잡고, 창 크기가 바뀌면 다시 맞춘다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await openM4Screen(page, 'dash-infant');
    await setRootFontPercent(page, 200);
    await measureDash(page);
    await openAsk(page);
    await settledView(page, '맞춘 직후');
    await page.evaluate(() => window.scrollTo(0, 0));
    const away = askProblems(await askView(page), '맨 위로 스크롤');
    expect(away.length, '맨 위로 스크롤해 두면 안내문/버튼이 화면 밖이라 측정이 문제를 잡는다').toBeGreaterThan(0);
    await page.setViewportSize({ width: 320, height: 569 }); // 창 높이가 1px 바뀐다
    await settledView(page, '창 크기가 바뀐 뒤');
  });

  test('키보드로 연 경우도 같다 (Enter): 320×568 · 글자 200%', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 320, height: 568 });
    await openM4Screen(page, 'dash-infant');
    await setRootFontPercent(page, 200);
    await measureDash(page);
    await expect(page.getByTestId('tool-exit')).toBeEnabled();
    await page.getByTestId('tool-exit').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('exit-ask')).toBeVisible();
    await settledView(page, '키보드로 연 직후');
  });
});

test('나가기 확인 단계는 넓은 화면(데스크톱)에서 그대로다: 1280×800 · 글자 200%에서도 고정 진행 줄이 없어 안내문과 「돌아가기」가 함께 보이고, 헤더가 고정이다 (회귀)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 1280, height: 800 });
  await openM4Screen(page, 'dash-infant');
  await measureDash(page);
  await openAsk(page);
  const v = await settledView(page, '1280x800/100%');
  expect(v.barPosition, '넓은 화면의 진행 줄은 고정이 아니다').toBe('static');
  expect(v.headPosition, '구간이 넉넉하면 헤더는 고정 그대로').toBe('sticky');
  await setRootFontPercent(page, 200);
  await settledView(page, '1280x800/200%');
});

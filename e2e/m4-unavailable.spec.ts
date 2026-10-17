import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, findPendingState, injectSave, lifeState, startPageHidden } from './helpers';

/**
 * 지속 비활성 버튼의 모양과 대비 (SPEC-003 DS3, R-337 / REV-003-M4-1, docs/design/design-system.md 2절 「비활성 컨트롤의 대비」, 시안 D-23).
 * 자동 모드에서 「다음 결정으로」는 **게임 내내** 비활성이고 「생각 남기기」는 M7c까지 준비 중이다 — 과도 상태가 아니므로 WCAG의 비활성 면제를 쓰지 않고 4.5:1로 잰다.
 * 불투명도(0.55 흐림은 라이트 글자 3.77:1이었다) 대신 `--c-text-3` 글자 + 점선 `--c-border-strong` 테두리(강제 색상은 GrayText 점선)로 그린다. 유일한 예외는 진입 직후 0.4초 입력 가드의 흐림(과도 상태).
 * 렌더 픽셀 기준 4.5:1은 e2e/m4-colors.spec.ts가 6조합 × 8화면에서 비활성 버튼을 면제 없이 재고, 여기서는 계산된 모양과 색 대비·가드와의 구분을 본다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const AUTO = { speed: 1, autoMode: true } as const;

interface Look {
  opacity: number;
  borderStyle: string;
  borderWidth: number;
  /** 글자색 대 바탕색 명도 대비 */
  ratio: number;
  unavailableAttr: string | null;
  ariaDisabled: string | null;
}

async function lookOf(page: Page, testId: string): Promise<Look> {
  return page.getByTestId(testId).evaluate((el) => {
    const parse = (css: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(css);
      const p = m === null ? [0, 0, 0, 0] : m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const cs = getComputedStyle(el);
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (let cur: Element | null = el; cur !== null; cur = cur.parentElement) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c.a >= 1) {
        bg = c;
        break;
      }
    }
    const [hi, lo] = [lum(parse(cs.color)), lum(bg)].sort((a, b) => b - a);
    return {
      opacity: Number(cs.opacity),
      borderStyle: cs.borderTopStyle,
      borderWidth: parseFloat(cs.borderTopWidth),
      ratio: (hi + 0.05) / (lo + 0.05),
      unavailableAttr: el.getAttribute('data-unavailable'),
      ariaDisabled: el.getAttribute('aria-disabled'),
    };
  });
}

async function openAuto(page: Page, scheme: 'light' | 'dark', forced: boolean, target = '/'): Promise<void> {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), target, AUTO);
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

for (const [name, scheme, forced] of [
  ['라이트', 'light', false],
  ['다크', 'dark', false],
  ['강제 색상(고대비)', 'light', true],
] as const) {
  test(`${name}: 자동 모드의 「다음 결정으로」와 준비 중인 「생각 남기기」는 불투명도 1 + 점선 + 글자 대비 ≥ 4.5:1이다 (R-337)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await openAuto(page, scheme, forced);
    await expect(page.getByTestId('auto')).toBeEnabled(); // 입력 가드가 풀린 뒤
    for (const id of ['skip', 'tool-note']) {
      const look = await lookOf(page, id);
      expect(look.unavailableAttr, `${id} 지속 비활성 표식`).toBe('true');
      expect(look.ariaDisabled, `${id}는 눌러도 입력을 무시한다`).toBe('true');
      expect(look.opacity, `${id}: 불투명도로 흐리지 않는다`).toBe(1);
      expect(look.borderStyle, `${id}: 점선 테두리`).toBe('dashed');
      expect(look.borderWidth, `${id}: 테두리가 남아 있다`).toBeGreaterThanOrEqual(1);
      expect(look.ratio, `${id} 글자 대비 ${look.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
    // 옅은 글자가 일반 버튼과 구분된다(같은 모양이 아니다): 눌리는 보조 버튼은 실선 테두리
    const autoLook = await lookOf(page, 'auto');
    expect(autoLook.borderStyle).not.toBe('dashed');
    expect(autoLook.unavailableAttr).toBeNull();
  });
}

test('강제 색상: 「생각 남기기」 안의 「준비 중」 알약은 글자·테두리가 버튼 이름·점선과 같은 GrayText다 — 라디오 카드의 「준비 중」 메타 알약과 같은 색 (D-30①)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await openAuto(page, 'light', true);
  await expect(page.getByTestId('auto')).toBeEnabled();
  const r = await page.getByTestId('tool-note').evaluate((btn) => {
    const pill = btn.querySelector('.tool-soon') as HTMLElement | null;
    if (pill === null) throw new Error('「준비 중」 알약이 없다');
    // 시스템 색 이름을 이 브라우저가 실제로 어떤 값으로 바꾸는지 탐침 요소로 읽는다
    const probe = (name: string) => {
      const span = document.createElement('span');
      span.style.color = name;
      document.body.appendChild(span);
      const value = getComputedStyle(span).color;
      span.remove();
      return value;
    };
    const p = getComputedStyle(pill);
    const b = getComputedStyle(btn);
    return { pillColor: p.color, pillBorder: p.borderTopColor, btnColor: b.color, btnBorder: b.borderTopColor, gray: probe('GrayText'), text: probe('CanvasText') };
  });
  expect(r.gray, '탐침이 GrayText와 CanvasText를 구분한다(공허 통과 방지)').not.toBe(r.text);
  expect(r.btnColor, '버튼 이름은 GrayText').toBe(r.gray);
  expect(r.btnBorder, '버튼 점선은 GrayText').toBe(r.gray);
  expect(r.pillColor, '알약 글자는 GrayText(CanvasText 아님)').toBe(r.gray);
  expect(r.pillBorder, '알약 테두리는 GrayText(CanvasText 아님)').toBe(r.gray);
});

test('0.4초 입력 가드의 흐림은 그대로다: 가드만 닫힌 버튼은 불투명도 0.55·실선이고 표식이 없으며, 같은 순간에도 지속 비활성 버튼은 불투명도 1·점선이다 (유일한 예외, R-337)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await openAuto(page, 'light', false, '/?__guard=600000'); // 가드가 사실상 풀리지 않는 개발 서버 탐침
  const pause = await lookOf(page, 'pause');
  expect(pause.ariaDisabled, '가드가 닫혀 있다').toBe('true');
  expect(pause.unavailableAttr, '가드는 지속 비활성이 아니다').toBeNull();
  expect(pause.opacity, '가드의 흐림').toBeCloseTo(0.55, 2);
  expect(pause.borderStyle).not.toBe('dashed');
  for (const id of ['skip', 'tool-note']) {
    const look = await lookOf(page, id);
    expect(look.unavailableAttr, id).toBe('true');
    expect(look.opacity, `${id}: 가드가 닫혀 있어도 지속 비활성 모양이 이긴다`).toBe(1);
    expect(look.borderStyle, id).toBe('dashed');
  }
});

test('선택지 대기 중의 「다음 결정으로」도 지속 비활성 모양이다 — 자동 모드가 아니어도 (선택하기 전까지 누를 수 없다)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await findPendingState(page, 'present'), '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  const look = await lookOf(page, 'skip');
  expect(look.unavailableAttr).toBe('true');
  expect(look.opacity).toBe(1);
  expect(look.borderStyle).toBe('dashed');
  expect(look.ratio).toBeGreaterThanOrEqual(4.5);
});

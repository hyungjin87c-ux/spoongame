import { expect, test, type Page } from '@playwright/test';
import { auditFocus, summarize } from './focusObscured';
import { noHorizontalOverflow } from './helpers';
import { openM4Screen } from './m4States';
import { setRootFontPercent } from './textResize';

/** 뷰포트를 직접 지정하는 시험이 도는 프로젝트: Chromium `mobile-360`, WebKit(playwright.webkit.config.ts) `webkit-mobile-360` — 이전에는 앞의 하나만 받아 WebKit 설정에서는 이 파일의 시험이 모두 건너뛰어졌다(2026-10-27 바로잡음) */
const runsHere = (projectName: string): boolean => projectName === 'mobile-360' || projectName === 'webkit-mobile-360';

/**
 * 도구 버튼 한 줄 (SPEC-005 r4 UX9·QI9, 완료 기준 1). **형진 님 지시 2026-10-26 「도구줄은 한줄에 나오도록 해줘」 — 마스터 해석: PC 폭(뷰포트 ≥ 960px) 전 구간에서 한 줄, 휴대폰·태블릿(< 960px)은 그대로**
 * (처음 M21은 한 줄을 1180px 이상에서만 보장하고 960~1154px를 두 줄로 두었다 — 이 지시가 그 부분을 바꿨다).
 * 12개 버튼 = 진행 줄 7(일시정지 · 1·2·4·8배 · 다음 결정으로 · 자동 모드) + 도구 줄 5(BGM · 생각 남기기 · 다크 모드 · 의견 보내기 · 나가기).
 *  ① 1180 이상 × 글자 100%(designer r4 규격: 이름 + 아이콘): 12개 버튼의 위쪽 좌표 차 ≤ 2px, 버튼 이름이 줄바꿈되지 않는다. BGM을 켜면 볼륨 줄이, 나가기를 누르면 확인 상자가 12개 버튼 줄 **아래 별도 줄**이고 켜고 끌 때 버튼이 움직이지 않는다.
 *  ② 960~1179 × 글자 100%(압축 모드 ①: 도구 5개를 아이콘만): 같은 단언이 960 · 1024 · 1100에서도 돈다. 도구 버튼은 폭 44px, 이름 글자는 눈에 안 보이고(clip-path) DOM에 그대로 있으며, 마우스 올림·키보드 포커스에서 오른쪽 맞춤 말풍선으로 보이고 화면 밖으로 나가지 않는다.
 *     960에서 한 줄에 들어가므로(측정: 진행 묶음 581 + 도구 묶음 252 + 간격 16 ≤ 안쪽 폭 928) 압축 모드 ②(진행 묶음 글자 줄이기)는 쓰지 않았다.
 *  ③ 접근 가능한 이름은 어느 폭에서도 같다(960 · 1100 · 1280). 글자 200%: 한 줄을 요구하지 않고 wrap으로 물러나며 가로 넘침 0(1.4.10 reflow). 폭 320 · 글자 200%: 가로 넘침 0px·가려진 포커스 0(CM10).
 *  ④ 폭 360·959(< 960px): 진행 줄은 하단 고정 띠, 도구 줄은 본문 위 한 줄 묶음 — 배치가 r4 이전과 같다(r4 CSS는 `@media (min-width: 960px)` 안에만 있다).
 *  ⑤ WCAG 1.4.13(REV-005-r4-1 R-501): 마우스 PC(960~1179)의 말풍선은 Esc로 숨고(올려 둔 채·포커스를 둔 채) 말풍선 위로 포인터를 옮겨도 사라지지 않으며(올릴 수 있음), 주 입력이 터치인 화면(hover: none · pointer: coarse — `hasTouch` 에뮬레이션 1024 등)은 압축하지 않고 이름이 보이는 배치로 물러난다(wrap 허용, 가로 넘침 0, 한 번 탭으로 동작).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface Row {
  id: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  /** 이름 글자가 놓인 줄 수 (Range 사각형의 서로 다른 위쪽 좌표) */
  nameLines: number;
}

/** 12개 버튼(진행 줄 7 + 도구 줄 5)의 자리 */
async function twelve(page: Page): Promise<Row[]> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="controls"] .btn, [data-testid="tools"] .btn'));
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const tops = new Set<number>();
      for (const node of Array.from(el.querySelectorAll('span')).filter((s) => !s.classList.contains('sr-only') && s.getAttribute('aria-hidden') !== 'true')) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const q of Array.from(range.getClientRects())) if (q.width > 0.5 && q.height > 0.5) tops.add(Math.round(q.top));
      }
      if (tops.size === 0) {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const q of Array.from(range.getClientRects())) if (q.width > 0.5 && q.height > 0.5) tops.add(Math.round(q.top));
      }
      return { id: el.getAttribute('data-testid') ?? `speed-${el.getAttribute('data-speed') ?? i}`, top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, nameLines: tops.size };
    });
  });
}

const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);
/** 위쪽 좌표 차 ≤ 2px로 같은 줄에 놓인 버튼들의 줄 수 */
const rowCount = (rows: Row[]): number => {
  const tops = [...rows].map((r) => r.top).sort((a, b) => a - b);
  let n = 0;
  let last = Number.NEGATIVE_INFINITY;
  for (const t of tops) {
    if (t - last > 2) n++;
    last = t;
  }
  return n;
};

async function openToolbar(page: Page, width: number, height = 800): Promise<void> {
  await page.setViewportSize({ width, height });
  await openM4Screen(page, 'dash-adult');
  await expect(page.getByTestId('tool-bgm')).toBeEnabled();
}

for (const width of [960, 1024, 1100, 1180, 1280, 1366, 1920]) {
  test(`${width}px · 글자 100%: 12개 버튼이 한 줄(위쪽 좌표 차 ≤ 2px)이고 이름이 줄바꿈되지 않으며 가로 넘침이 없다 (UX9-1)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    const rows = await twelve(page);
    expect(rows.map((r) => r.id), '12개: 진행 줄 7 + 도구 줄 5').toHaveLength(12);
    expect(spread(rows.map((r) => r.top)), `위쪽 좌표 차(px): ${rows.map((r) => `${r.id}=${Math.round(r.top)}`).join(' ')}`).toBeLessThanOrEqual(2);
    for (const r of rows) {
      expect(r.nameLines, `${r.id}: 이름이 놓인 줄 수`).toBe(1);
      expect(r.height, `${r.id}: 버튼 높이(이름이 줄바꿈되면 커진다)`).toBeLessThanOrEqual(48);
    }
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
  });

  test(`${width}px: BGM을 켜면 볼륨 줄이, 나가기를 누르면 확인 상자가 12개 버튼 줄 아래 별도 줄이고 켜고 끌 때 버튼의 가로 위치 변화가 ≤ 1px이다 (UX9-2)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    const base = await twelve(page);
    const bottom = Math.max(...base.map((r) => r.bottom));

    // BGM 켜기 → 볼륨 줄
    await page.getByTestId('tool-bgm').click();
    const volume = page.getByTestId('bgm-volume');
    await expect(volume).toBeVisible();
    const withVolume = await twelve(page);
    expect((await volume.boundingBox())!.y, '볼륨 줄이 12개 버튼 줄 아래').toBeGreaterThanOrEqual(bottom - 1);
    withVolume.forEach((r, i) => expect(Math.abs(r.left - base[i].left), `BGM 켠 뒤 ${r.id}의 가로 위치 변화(px)`).toBeLessThanOrEqual(1));
    expect(spread(withVolume.map((r) => r.top)), '켠 뒤에도 한 줄').toBeLessThanOrEqual(2);

    // 나가기 → 확인 상자
    await page.getByTestId('tool-exit').click();
    const ask = page.getByTestId('exit-ask');
    await expect(ask).toBeVisible();
    const withAsk = await twelve(page);
    expect((await ask.boundingBox())!.y, '확인 상자가 12개 버튼 줄 아래').toBeGreaterThanOrEqual(bottom - 1);
    expect((await ask.boundingBox())!.y, '확인 상자가 볼륨 줄 아래').toBeGreaterThanOrEqual((await volume.boundingBox())!.y);
    withAsk.forEach((r, i) => expect(Math.abs(r.left - base[i].left), `확인 상자를 연 뒤 ${r.id}의 가로 위치 변화(px)`).toBeLessThanOrEqual(1));
    expect(spread(withAsk.map((r) => r.top)), '확인 상자를 연 뒤에도 한 줄').toBeLessThanOrEqual(2);

    // 돌아가기 → 닫으면 처음 자리
    await page.getByTestId('exit-no').click();
    await expect(ask).toHaveCount(0);
    await page.getByTestId('tool-bgm').click();
    await expect(volume).toHaveCount(0);
    const back = await twelve(page);
    back.forEach((r, i) => expect(Math.abs(r.left - base[i].left) + Math.abs(r.top - base[i].top), `${r.id}: 끄고 나면 처음 자리`).toBeLessThanOrEqual(1));
  });
}

/** 말풍선(이름 글자 칸)의 상태 — 압축 모드의 도구 버튼은 평소 숨기고 올림·포커스에서만 보인다 */
async function tipState(page: Page, testId: string): Promise<{ clip: string; position: string; left: number; right: number; text: string; buttonWidth: number }> {
  return page.evaluate((id) => {
    const btn = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const tip = Array.from(btn.querySelectorAll<HTMLElement>('span')).find((el) => !el.classList.contains('sr-only'))!;
    const r = tip.getBoundingClientRect();
    const cs = getComputedStyle(tip);
    return { clip: cs.clipPath, position: cs.position, left: r.left, right: r.right, text: (tip.textContent ?? '').trim(), buttonWidth: btn.getBoundingClientRect().width };
  }, testId);
}

const TOOL_IDS = ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit'] as const;
const TOOL_NAMES = ['BGM', '생각 남기기', '다크 모드', '의견 보내기', '나가기'] as const;

for (const width of [960, 1024, 1100, 1179]) {
  test(`${width}px · 글자 100%: 압축 모드 — 도구 5개는 아이콘만(폭 44px)이고 이름은 DOM에 그대로 있으며 평소에는 눈에 안 보인다. 진행 묶음 글자는 줄이지 않았다 (형진 님 2026-10-26)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    const rows = await twelve(page);
    expect(rowCount(rows), `${width}px: 한 줄`).toBe(1);
    for (const r of rows.slice(7)) expect(Math.round(r.right - r.left), `${r.id}: 아이콘만 — 버튼 폭 44px`).toBe(44);
    for (let i = 0; i < 5; i++) {
      const t = await tipState(page, TOOL_IDS[i]);
      expect(t.text, `${TOOL_IDS[i]}: 이름 글자 칸이 DOM에 그대로 있다`).toBe(TOOL_NAMES[i]);
      expect(t.clip, `${TOOL_IDS[i]}: 평소에는 눈에 안 보인다(clip-path로 가림 — 이름은 DOM에 그대로)`).toBe('inset(50%)');
      expect(t.position, `${TOOL_IDS[i]}: 말풍선은 버튼 안 자리를 차지하지 않는다`).toBe('absolute');
    }
    // 진행 묶음은 글자 그대로(압축 모드 ②를 쓰지 않았다)
    const names = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-testid="controls"] .btn')).map((el) => (el.textContent ?? '').trim().split(' ').filter((x) => x !== '').join(' ')));
    expect(names).toEqual(['일시정지', '1배', '2배', '4배', '8배', '다음 결정으로', '자동 모드 꺼짐']);
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
  });

  test(`${width}px: 말풍선 — 마우스를 올리면 이름이 보이고 키보드 포커스(Tab)에서도 보이며 포커스 링이 있고 화면 밖으로 나가지 않는다 (색에만 의존하지 않는다)`, async ({ page, browserName }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    // 올림
    for (let i = 0; i < 5; i++) {
      const id = TOOL_IDS[i];
      await page.getByTestId(id).hover();
      const hover = await tipState(page, id);
      expect(hover.clip, `${id}: 올리면 보인다`).toBe('none');
      expect(hover.text).toBe(TOOL_NAMES[i]);
      expect(hover.left, `${id}: 말풍선이 화면 왼쪽 밖으로 나가지 않는다`).toBeGreaterThanOrEqual(0);
      expect(hover.right, `${id}: 말풍선이 화면 오른쪽 밖으로 나가지 않는다`).toBeLessThanOrEqual(width);
      expect(await noHorizontalOverflow(page), `${id}: 말풍선이 떠 있어도 가로 넘침 0`).toBe(true);
      await page.mouse.move(1, 1);
      expect((await tipState(page, id)).clip, `${id}: 치우면 다시 숨는다`).toBe('inset(50%)');
    }
    // 키보드 포커스: 진행 줄 마지막(자동 모드)에서 Tab으로 도구 줄 다섯을 차례로 지난다
    await page.getByTestId('auto').focus();
    for (let i = 0; i < 5; i++) {
      const id = TOOL_IDS[i];
      // Playwright WebKit은 링크(<a>, 의견 보내기)를 Tab 순서에 넣지 않는다(Safari 기본 설정과 같다) — 그 자리는 포커스를 직접 준다. 앞뒤 버튼은 Tab으로 그대로 확인한다
      if (browserName === 'webkit' && id === 'tool-feedback') await page.getByTestId(id).focus();
      else await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), `${id}: Tab 순서`).toBe(id);
      const focus = await tipState(page, id);
      expect(focus.clip, `${id}: 키보드 포커스에서 보인다`).toBe('none');
      expect(focus.right, `${id}: 말풍선이 화면 오른쪽 밖으로 나가지 않는다`).toBeLessThanOrEqual(width);
      const ring = await page.evaluate((tid) => {
        const cs = getComputedStyle(document.querySelector<HTMLElement>(`[data-testid="${tid}"]`)!);
        return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
      }, id);
      expect(ring.style, `${id}: 포커스 링이 있다`).not.toBe('none');
      expect(ring.width, `${id}: 포커스 링 굵기`).toBeGreaterThanOrEqual(2);
    }
  });
}

// ---------- WCAG 1.4.13 (REV-005-r4-1 R-501) — 압축 모드 말풍선 ----------

for (const width of [960, 1024, 1179]) {
  test(`${width}px: 말풍선은 Esc로 숨길 수 있다 — 올려 둔 채·포커스를 둔 채로 숨고, 포인터를 치웠다 다시 올리거나 다른 버튼으로 옮기면 다시 보인다 (WCAG 1.4.13 닫을 수 있음)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    // 마우스: 올리면 보이고, Esc로 숨으며(포인터는 그대로 버튼 위), 치웠다 다시 올리면 다시 보인다
    await page.getByTestId('tool-bgm').hover();
    expect((await tipState(page, 'tool-bgm')).clip, '올리면 보인다').toBe('none');
    await page.keyboard.press('Escape');
    expect((await tipState(page, 'tool-bgm')).clip, 'Esc로 숨는다').toBe('inset(50%)');
    expect(await page.getByTestId('tool-bgm').evaluate((el) => el.matches(':hover')), '포인터는 그대로 버튼 위에 있다(움직이지 않고 닫았다)').toBe(true);
    await page.mouse.move(1, 1);
    await page.getByTestId('tool-bgm').hover();
    expect((await tipState(page, 'tool-bgm')).clip, '치웠다 다시 올리면 다시 보인다').toBe('none');
    // 다른 버튼으로 옮기면 그 버튼의 말풍선은 보인다
    await page.keyboard.press('Escape');
    await page.getByTestId('tool-dark').hover();
    expect((await tipState(page, 'tool-dark')).clip, '다른 버튼을 올리면 그 말풍선은 보인다').toBe('none');
    await page.mouse.move(1, 1);
    // 키보드: Tab 포커스로 보이고, Esc로 숨으며(포커스는 그대로), 다음 버튼으로 Tab하면 그 말풍선은 보인다
    await page.getByTestId('auto').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('tool-bgm');
    expect((await tipState(page, 'tool-bgm')).clip, '포커스에서 보인다').toBe('none');
    await page.keyboard.press('Escape');
    expect((await tipState(page, 'tool-bgm')).clip, 'Esc로 숨는다').toBe('inset(50%)');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), '포커스는 그대로 버튼에 있다').toBe('tool-bgm');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('tool-note');
    expect((await tipState(page, 'tool-note')).clip, '다음 버튼의 말풍선은 보인다').toBe('none');
    // 말풍선이 없을 때의 Esc는 아무 일도 하지 않는다(속성을 켜지 않는다 — 다음에 올리면 바로 보인다)
    await page.mouse.move(1, 1);
    await page.getByTestId('pause').focus();
    await page.keyboard.press('Escape');
    expect(await page.getByTestId('tools').getAttribute('data-tip-off'), '보이는 말풍선이 없었으면 속성이 켜지지 않는다').toBeNull();
    await page.getByTestId('tool-exit').hover();
    expect((await tipState(page, 'tool-exit')).clip).toBe('none');
  });

  test(`${width}px: 말풍선 위로 포인터를 옮겨도 사라지지 않는다 — 버튼에서 말풍선으로 건너가는 동안 끊기지 않고 말풍선을 눌러도 같은 버튼이 동작한다 (WCAG 1.4.13 올릴 수 있음)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    const btn = page.getByTestId('tool-dark');
    await btn.hover();
    const tip = btn.locator('span:not(.sr-only)').first();
    const box = (await tip.boundingBox())!;
    const bb = (await btn.boundingBox())!;
    expect(box.y, '말풍선은 버튼 아래에 있다').toBeGreaterThanOrEqual(bb.y + bb.height);
    // 버튼 가운데 → 말풍선 가운데로 한 걸음씩(틈 8px를 지난다)
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
    expect((await tipState(page, 'tool-dark')).clip, '말풍선 위에 포인터가 있어도 보인다').toBe('none');
    expect(await btn.evaluate((el) => el.matches(':hover')), '말풍선 위에서도 버튼의 :hover가 유지된다').toBe(true);
    // 말풍선을 누르면 같은 버튼이 눌린다(라벨을 누르는 것과 같다)
    const before = await btn.getAttribute('aria-pressed');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(btn).not.toHaveAttribute('aria-pressed', before ?? '');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', before ?? '');
    // 말풍선이 가려진 동안에는 아래 요소를 가로채지 않는다(clip-path가 맞힘 판정까지 자른다)
    await page.mouse.move(1, 1);
    const below = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-testid="tool-dark"]') !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(below, '가려진 말풍선은 맞힘 대상이 아니다').toBe(false);
  });
}

test.describe('주 입력이 터치인 화면(hover: none · pointer: coarse — 가로 태블릿)', () => {
  test.use({ hasTouch: true });

  for (const width of [960, 1024, 1100, 1179]) {
    test(`${width}px: 압축하지 않는다 — 도구 이름이 늘 보이고(말풍선 없음) 가로 넘침 0이며 한 번 탭으로 동작한다 (WCAG 1.4.13, R-501)`, async ({ page }, testInfo) => {
      test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
      await openToolbar(page, width);
      expect(await page.evaluate(() => matchMedia('(hover: none)').matches && matchMedia('(pointer: coarse)').matches), '터치 에뮬레이션이 켜져 있다(hover: none · pointer: coarse)').toBe(true);
      for (let i = 0; i < 5; i++) {
        const t = await tipState(page, TOOL_IDS[i]);
        expect(t.text, `${TOOL_IDS[i]}: 이름 글자`).toBe(TOOL_NAMES[i]);
        expect(t.clip, `${TOOL_IDS[i]}: 이름이 가려지지 않는다`).toBe('none');
        expect(t.position, `${TOOL_IDS[i]}: 이름은 버튼 안에 놓인다(말풍선이 아니다)`).not.toBe('absolute');
        expect(t.buttonWidth, `${TOOL_IDS[i]}: 이름이 들어가 44px보다 넓다`).toBeGreaterThan(60);
      }
      const rows = await twelve(page);
      expect(rows, '버튼 12개').toHaveLength(12);
      for (const r of rows) {
        expect(r.left, `${r.id}: 화면 왼쪽 밖으로 나가지 않는다`).toBeGreaterThanOrEqual(-0.5);
        expect(r.right, `${r.id}: 화면 오른쪽 밖으로 나가지 않는다`).toBeLessThanOrEqual(width + 0.5);
        expect(r.height, `${r.id}: 버튼 높이 44px 이상`).toBeGreaterThanOrEqual(44 - 0.5);
        expect(r.nameLines, `${r.id}: 이름이 한 줄에 놓인다`).toBe(1);
      }
      expect(await noHorizontalOverflow(page), `${width}px: 가로 넘침 0 (wrap으로 물러난다)`).toBe(true);
      if (width === 1179) expect(rowCount(rows), '1179px는 designer r4 규격대로 한 줄').toBe(1);
      // 접근 가능한 이름은 마우스 화면과 같다
      const names = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-testid="tools"] .btn')).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().split(' ').filter((x) => x !== '').join(' ')),
      );
      expect(names).toEqual(['BGM', '생각 남기기', '다크 모드', '의견 보내기(새 탭으로 열립니다)', '나가기']);
      // 한 번 탭으로 동작한다
      const dark = page.getByTestId('tool-dark');
      const before = await dark.getAttribute('aria-pressed');
      await dark.tap();
      await expect(dark).not.toHaveAttribute('aria-pressed', before ?? '');
      await dark.tap();
      await expect(dark).toHaveAttribute('aria-pressed', before ?? '');
    });
  }
});

for (const width of [1180, 1280]) {
  test(`${width}px: designer r4 규격 그대로 — 도구 버튼은 이름 + 아이콘이고 이름 글자 칸이 평소에 보인다 (압축 모드는 닿지 않는다)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width);
    for (let i = 0; i < 5; i++) {
      const t = await tipState(page, TOOL_IDS[i]);
      expect(t.clip, `${TOOL_IDS[i]}: 이름이 보인다`).toBe('none');
      expect(t.position, `${TOOL_IDS[i]}: 이름은 버튼 안에 놓인다`).not.toBe('absolute');
      expect(t.buttonWidth, `${TOOL_IDS[i]}: 이름이 들어가 44px보다 넓다`).toBeGreaterThan(60);
    }
  });
}

test('한 줄이 되는 최소 폭(UX9-5 기록): 960~1300을 20px씩 훑는다 — 모든 폭에서 한 줄(압축 모드가 960까지 내려 보장), 가로 넘침 0, 어느 폭에서도 일부만 접힌 줄이 없다 (형진 님 2026-10-26)', async ({ page }, testInfo) => {
  test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
  test.setTimeout(120_000);
  await openToolbar(page, 960);
  let scanned = 0;
  for (let w = 960; w <= 1300; w += 20) {
    await page.setViewportSize({ width: w, height: 800 });
    expect(rowCount(await twelve(page)), `${w}px: 줄 수`).toBe(1);
    expect(await noHorizontalOverflow(page), `${w}px: 가로 넘침 0`).toBe(true);
    scanned++;
  }
  // 문턱 양쪽(1170 · 1179 · 1180 · 1190)도 한 줄 — 압축 모드(≤ 1179)와 r4 규격(≥ 1180)의 경계가 끊기지 않는다
  for (const w of [1170, 1179, 1180, 1190]) {
    await page.setViewportSize({ width: w, height: 800 });
    expect(rowCount(await twelve(page)), `${w}px: 경계에서도 한 줄`).toBe(1);
  }
  // 960 미만은 한 줄을 요구하지 않는다(휴대폰·태블릿은 그대로 — 진행 줄은 하단 고정 띠)
  await page.setViewportSize({ width: 959, height: 800 });
  expect(rowCount(await twelve(page)), '959px: 진행 줄이 하단 띠로 갈라져 한 줄이 아니다').toBeGreaterThanOrEqual(2);
  testInfo.annotations.push({ type: '한 줄 최소 폭', description: `960px 이상 전 구간(${scanned}개 폭을 훑음, 960~1300 20px 단위). 압축 없이 한 줄이 되는 최소 폭은 이전 측정 1160px(designer r4 규격)` });
});

test('글자 200% × 폭 1000(압축 모드 구간): 한 줄을 요구하지 않고 wrap으로 물러나며 가로 넘침이 없다 — 12개 버튼 모두 눌릴 자리에 있다 (1.4.10 reflow)', async ({ page }, testInfo) => {
  test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
  await openToolbar(page, 1000);
  await setRootFontPercent(page, 200);
  expect(await noHorizontalOverflow(page), '1000px × 200%: 가로 넘침 0').toBe(true);
  const rows = await twelve(page);
  expect(rows, '버튼 12개').toHaveLength(12);
  for (const r of rows) {
    expect(r.left, `${r.id}: 화면 왼쪽 밖으로 나가지 않는다`).toBeGreaterThanOrEqual(-0.5);
    expect(r.right, `${r.id}: 화면 오른쪽 밖으로 나가지 않는다`).toBeLessThanOrEqual(1000.5);
  }
});

test('글자 200%: 1280 · 1920에서는 한 줄을 요구하지 않고(컨테이너 질의가 물러난다) 가로 넘침이 없다 — 12개 버튼 모두 눌릴 자리에 있다 (UX9-4, M21)', async ({ page }, testInfo) => {
  test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
  for (const width of [1280, 1920]) {
    await openToolbar(page, width);
    await setRootFontPercent(page, 200);
    expect(await noHorizontalOverflow(page), `${width}px × 200%: 가로 넘침 0`).toBe(true);
    const rows = await twelve(page);
    expect(rows, `${width}px × 200%: 버튼 12개`).toHaveLength(12);
    expect(rowCount(rows), `${width}px × 200%: 두 줄 이상(한 줄 비요구)`).toBeGreaterThanOrEqual(2);
    for (const r of rows) {
      expect(r.left, `${r.id}: 화면 왼쪽 밖으로 나가지 않는다`).toBeGreaterThanOrEqual(-0.5);
      expect(r.right, `${r.id}: 화면 오른쪽 밖으로 나가지 않는다`).toBeLessThanOrEqual(width + 0.5);
    }
  }
});

test('폭 320 · 글자 200%: 가로 넘침 0px, 가려진 포커스 0 (CM10) — 한 줄 CSS가 닿지 않는 좁은 화면 (UX9-4)', async ({ page, browserName }, testInfo) => {
  test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
  // 포커스 가림 감사(focusObscured.ts)는 Tab·Shift+Tab 순회로 모든 조작 요소를 지나는데, Playwright WebKit은 링크(의견 보내기)를 Tab 순서에 넣지 않고 스크롤 보정도 Chromium과 달라 감사가 맞지 않는다 — 이 파일이 WebKit에서 돌게 된 2026-10-27에 처음 드러난 시험 도구 한계이고 앱 코드(< 960px는 이번 회차에서 안 바뀜)와 무관하다. 후속은 TODO
  test.skip(browserName === 'webkit', 'WebKit: 링크가 Tab 순서에 없고 감사의 스크롤 가정이 달라 오탐 — Chromium에서만 돈다(후속 TODO)');
  test.setTimeout(180_000);
  await openToolbar(page, 320, 568);
  await setRootFontPercent(page, 200);
  expect(await noHorizontalOverflow(page), '320px × 200%: 가로 넘침 0').toBe(true);
  const audit = await auditFocus(page, '320x568/200%/도구 줄', { headingTestId: 'life-name' });
  expect(audit.violations, summarize(audit)).toEqual([]);
  for (const id of ['pause', 'skip', 'auto', 'tool-bgm', 'tool-exit']) expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(id);
});

test('Tab 순서·접근 가능한 이름은 그대로다: 진행 줄 7개 → 도구 줄 5개 순서이고 이름이 바뀌지 않았다 — 960 · 1100(압축 모드) · 1280에서 모두 같다 (UX9-4)', async ({ page }, testInfo) => {
  test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
  const EXPECTED = ['일시정지', '1배', '2배', '4배', '8배', '다음 결정으로', '자동 모드 꺼짐', 'BGM', '생각 남기기', '다크 모드', '의견 보내기(새 탭으로 열립니다)', '나가기'];
  for (const width of [960, 1100, 1280]) {
    await openToolbar(page, width);
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-testid="controls"] .btn, [data-testid="tools"] .btn')).map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().split(' ').filter((x) => x !== '').join(' ')),
    );
    expect(names, `${width}px: 이름`).toEqual(EXPECTED);
    // 접근성 트리에서도 같은 이름으로 찾아진다(숨긴 말풍선 글자가 이름 계산에서 빠지지 않는다)
    for (const name of ['BGM', '생각 남기기', '다크 모드', '나가기']) await expect(page.getByRole('button', { name, exact: true }), `${width}px: 역할 button 「${name}」`).toHaveCount(1);
    await expect(page.getByRole('link', { name: /^의견 보내기 ?\(새 탭으로 열립니다\)$/ }), `${width}px: 링크 「의견 보내기」`).toHaveCount(1);
  }
});

for (const width of [360, 959]) {
  test(`${width}px (< 960px): 진행 줄은 하단 고정 띠, 도구 줄은 본문 위 묶음이다 — 배치가 r4 이전과 같다 (UX9-3)`, async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행');
    await openToolbar(page, width, 740);
    const m = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('[data-testid="controls"]')!;
      const tools = document.querySelector<HTMLElement>('[data-testid="tools"]')!;
      const toolbar = document.querySelector<HTMLElement>('.toolbar')!;
      const tb = tools.getBoundingClientRect();
      const b = bar.getBoundingClientRect();
      return {
        barPosition: getComputedStyle(bar).position,
        barBottom: Math.round(window.innerHeight - b.bottom),
        barHeight: Math.round(b.height),
        toolsTop: Math.round(tb.top),
        toolsHeight: Math.round(tb.height),
        toolsBelowBar: tb.top >= b.bottom,
        toolbarContainer: getComputedStyle(toolbar).containerType,
        toolGap: getComputedStyle(tools).columnGap,
        toolPadding: getComputedStyle(tools.querySelector('.btn--tool')!).paddingLeft,
        toolIcon: getComputedStyle(tools.querySelector('.btn--tool .icon')!).width,
      };
    });
    expect(m.barPosition, '진행 줄은 하단 고정 띠').toBe('fixed');
    expect(m.barBottom, '화면 맨 아래에 붙어 있다').toBe(0);
    expect(m.toolsBelowBar, '도구 줄은 본문 위(진행 줄 위쪽)에 있다').toBe(false);
    expect(m.toolbarContainer, '컨테이너 질의는 960px 이상에서만 건다').toBe('normal');
    // r4 규칙(간격 8·아이콘 18)이 닿지 않는다: 모바일의 도구 줄 간격은 8px, 아이콘은 지금 크기(18px 아님)
    expect(m.toolGap).toBe('8px');
    expect(m.toolIcon, '도구 아이콘 크기는 r4 이전 그대로(22px)').not.toBe('18px');
    // 진행 줄(고정 띠)의 높이: 360px에서 112px — design-system 16-1 실측(r4 이전과 같음)
    if (width === 360) expect(m.barHeight, '진행 줄 높이(px)').toBeLessThanOrEqual(120);
  });
}

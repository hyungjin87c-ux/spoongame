import { expect, test, type Page } from '@playwright/test';
import { SPEED_CYCLE, activeTestId, noHorizontalOverflow, pressSpeedTo, readSettings, settle, tabWalk } from './helpers';
import { openM4Screen } from './m4States';
import { setRootFontPercent } from './textResize';

/**
 * 조작 영역 안 B (SPEC-012 QF5, 완료 기준 9~12 — designer `docs/design/controls-compact.md`): 한 줄 진행 줄 + 배속 한 단추 + 도구 줄 44px(모바일) · 36px(PC).
 * 측정은 designer의 `scripts/design/shootControlsCompact.mjs`와 같은 방식(360×740 · 글자 100%, 터치, 오차 ±2px). 터치(`pointer: coarse`)는 `hasTouch`가 켠다 — 누르는 영역 44px은 거친 포인터에서만 `::before`가 채운다.
 * 뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 돈다.
 */
const runsHere = (projectName: string): boolean => projectName === 'mobile-360' || projectName === 'webkit-mobile-360';
const SKIP = '뷰포트를 직접 지정하므로 mobile-360(WebKit은 webkit-mobile-360)에서만 실행';

async function open(page: Page, width: number, height: number, percent = 100): Promise<void> {
  await page.setViewportSize({ width, height });
  await openM4Screen(page, 'dash-adult');
  await expect(page.getByTestId('speed')).toBeEnabled();
  if (percent !== 100) await setRootFontPercent(page, percent);
  await settle(page);
}

interface Box {
  id: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
  width: number;
  /** 거친 포인터에서 ::before가 넓힌 누르는 영역 [위, 아래] (px, 버튼 밖으로 나간 만큼) — 없으면 [0, 0] */
  reach: [number, number];
}

/** 진행 줄 버튼과 도구 줄 버튼의 자리·크기·누르는 영역 */
async function boxes(page: Page): Promise<{ progress: Box[]; tools: Box[]; bar: { top: number; height: number; position: string }; toolsGroup: { top: number; height: number }; vh: number }> {
  return page.evaluate(() => {
    const rect = (b: HTMLElement) => {
      const r = b.getBoundingClientRect();
      const before = getComputedStyle(b, '::before');
      const reach: [number, number] = before.content === 'none' || before.content === '' || before.position !== 'absolute' ? [0, 0] : [-parseFloat(before.top) - parseFloat(getComputedStyle(b).borderTopWidth), -parseFloat(before.bottom) - parseFloat(getComputedStyle(b).borderBottomWidth)]; // ::before는 패딩 상자(테두리 안쪽) 기준이라 테두리 두께를 더해 "테두리 밖으로 나간 만큼"
      return { id: b.getAttribute('data-testid') ?? b.tagName, top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width, reach };
    };
    const bar = document.querySelector<HTMLElement>('[data-testid="controls"]')!;
    const tools = document.querySelector<HTMLElement>('[data-testid="tools"]')!;
    const br = bar.getBoundingClientRect();
    const tr = tools.getBoundingClientRect();
    return {
      progress: [...bar.querySelectorAll<HTMLElement>('button')].map(rect),
      tools: [...tools.querySelectorAll<HTMLElement>('button, a')].map(rect),
      bar: { top: br.top, height: br.height, position: getComputedStyle(bar).position },
      toolsGroup: { top: tr.top, height: tr.height },
      vh: window.innerHeight,
    };
  });
}

const spread = (xs: number[]): number => Math.max(...xs) - Math.min(...xs);

test.describe('터치 360×740 · 글자 100% (완료 기준 9·10)', () => {
  test.use({ hasTouch: true });

  test('하단 고정 진행 줄은 한 줄이고 높이 48px(±2) — 화면의 약 6.5%, 도구 줄은 이름 한 줄 44px(±2)', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), '터치 에뮬레이션(pointer: coarse)').toBe(true);
    const m = await boxes(page);
    expect(m.bar.position, '하단 고정 띠').toBe('fixed');
    expect(m.progress.map((b) => b.id)).toEqual(['pause', 'speed', 'skip', 'auto']);
    expect(spread(m.progress.map((b) => b.top)), '진행 줄 버튼이 한 줄(위쪽 좌표 차 ≤ 1px)').toBeLessThanOrEqual(1);
    expect(Math.abs(m.bar.height - 48), `하단 띠 높이(px) ${m.bar.height} — 옛 112px`).toBeLessThanOrEqual(2);
    expect(m.bar.height / m.vh, '화면 높이의 비율').toBeLessThan(0.07);
    expect(m.bar.top + m.bar.height, '화면 맨 아래에 붙어 있다').toBeCloseTo(m.vh, 0);
    // 보이는 높이 36px, 도구 줄 버튼 44px · 한 줄 이름
    for (const b of m.progress) expect(Math.abs(b.height - 36), `${b.id} 보이는 높이 ${b.height}`).toBeLessThanOrEqual(1);
    expect(m.tools.map((b) => b.id)).toEqual(['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit']);
    expect(spread(m.tools.map((b) => b.top)), '도구 줄이 한 줄').toBeLessThanOrEqual(1);
    expect(Math.abs(m.toolsGroup.height - 44), `도구 줄 높이(px) ${m.toolsGroup.height} — 옛 64px`).toBeLessThanOrEqual(2);
    for (const b of m.tools) expect(b.height, `${b.id} 높이 44px 이상`).toBeGreaterThanOrEqual(44 - 0.5);
    const lines = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="tools"] .btn--tool')].map((b) => ({ id: b.dataset.testid, ws: getComputedStyle(b).whiteSpace })));
    for (const l of lines) expect(l.ws, `${l.id}: 이름 한 줄(nowrap)`).toBe('nowrap');
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
  });

  test('누르는 영역: 진행 줄 버튼은 높이 44px(보이는 36 + ::before 위아래 4)·폭 ≥ 44px이고 이웃과 겹치지 않으며, 보이는 가장자리 밖 3px 위·아래를 눌러도 그 버튼이 눌린다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    const m = await boxes(page);
    for (const b of m.progress) {
      expect(b.reach, `${b.id}: ::before가 위아래로 넓힌 만큼`).toEqual([4, 4]);
      expect(b.height + b.reach[0] + b.reach[1], `${b.id}: 누르는 높이`).toBeGreaterThanOrEqual(44 - 1);
      expect(b.width, `${b.id}: 폭`).toBeGreaterThanOrEqual(44 - 0.5);
    }
    // 이웃과 겹침 0: 같은 줄이라 가로로만 이웃한다 — 누르는 영역은 가로로 넓히지 않는다
    const sorted = [...m.progress].sort((a, b) => a.left - b.left);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].left, `${sorted[i - 1].id}↔${sorted[i].id}`).toBeGreaterThanOrEqual(sorted[i - 1].right - 0.5);
    // 보이는 가장자리 밖 3px(위·아래)이 그 버튼의 ::before다 — elementFromPoint가 그 버튼(또는 자손)을 돌려준다
    const hits = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button')].map((b) => {
        const r = b.getBoundingClientRect();
        const x = r.left + r.width / 2;
        return { id: b.dataset.testid, up: b === document.elementFromPoint(x, r.top - 3) || b.contains(document.elementFromPoint(x, r.top - 3)), down: b === document.elementFromPoint(x, r.bottom + 3) || b.contains(document.elementFromPoint(x, r.bottom + 3)) };
      }),
    );
    for (const h of hits) {
      expect(h.up, `${h.id}: 위 3px`).toBe(true);
      expect(h.down, `${h.id}: 아래 3px`).toBe(true);
    }
  });

  test('배속 단추를 빠르게 연타해도 한 번 눌러 한 단계씩만 바뀐다(오터치 없음): 인접 일시정지·다음 결정으로는 눌리지 않는다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    await page.waitForTimeout(500); // 진입 입력 가드가 지난 뒤
    const m = await boxes(page);
    const speed = m.progress.find((b) => b.id === 'speed')!;
    const x = Math.round((speed.left + speed.right) / 2);
    const y = Math.round((speed.top + speed.bottom) / 2);
    const before = Number(await page.getByTestId('speed').getAttribute('data-speed'));
    // 100ms 간격으로 세 번 탭: 1 → 2 → 4 → 8
    for (let i = 0; i < 3; i++) {
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(100);
    }
    const cycle = SPEED_CYCLE as readonly number[];
    await expect(page.getByTestId('speed')).toHaveAttribute('data-speed', String(cycle[(cycle.indexOf(before) + 3) % 4]));
    expect(await page.getByTestId('pause').getAttribute('data-paused'), '일시정지는 눌리지 않았다').toBe('false');
    // 보이는 단추의 바로 옆(왼쪽 일시정지 쪽 경계 1px 밖)은 이웃 버튼이다
    const pause = m.progress.find((b) => b.id === 'pause')!;
    expect(speed.left - pause.right, '일시정지와 배속 사이 간격(px)').toBeCloseTo(6, 0);
    expect(await page.evaluate(([a, b]) => document.elementFromPoint(a, b)?.closest('button')?.dataset.testid, [Math.round(pause.right + 1), Math.round((pause.top + pause.bottom) / 2)] as const), '간격 안은 어느 버튼도 아니다(오터치 없음)').toBeUndefined();
  });
});

test.describe('글자 200%·작은 폭 (완료 기준 9 ③④ · 10)', () => {
  test.use({ hasTouch: true });

  test('360 × 글자 200%: 하단 띠 ≤ 95px(+2)이고 고정이 유지되며(≤ 화면의 50%) 가로 넘침 0 · 모든 버튼이 화면 안에 있다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740, 200);
    const m = await boxes(page);
    expect(m.bar.height, `하단 띠 높이(px) ${m.bar.height}`).toBeLessThanOrEqual(95 + 2);
    expect(m.bar.height / m.vh, '화면 높이의 비율').toBeLessThan(0.5);
    expect(m.bar.position, '고정 유지(풀리지 않는다)').toBe('fixed');
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
    for (const b of [...m.progress, ...m.tools]) {
      expect(b.left, `${b.id} 왼쪽`).toBeGreaterThanOrEqual(-0.5);
      expect(b.right, `${b.id} 오른쪽`).toBeLessThanOrEqual(360 + 0.5);
    }
    // 두 줄: [⏸ · 1배 · 다음 결정으로] / [자동 모드]
    const rows = new Set(m.progress.map((b) => Math.round(b.top / 4)));
    expect(rows.size, '진행 줄이 두 줄로 접힌다').toBeLessThanOrEqual(2);
  });

  test('320×568 · 글자 100%: 「자동 모드」가 둘째 줄로 접혀도 하단 띠 ≤ 92px(+2) · 넘침 0 · 도구 줄은 이름 두 줄로 물러나도 넘치지 않는다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 320, 568);
    const m = await boxes(page);
    expect(m.bar.height, `하단 띠 높이(px) ${m.bar.height}`).toBeLessThanOrEqual(92 + 2);
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
    for (const b of [...m.progress, ...m.tools]) {
      expect(b.left, `${b.id} 왼쪽`).toBeGreaterThanOrEqual(-0.5);
      expect(b.right, `${b.id} 오른쪽`).toBeLessThanOrEqual(320 + 0.5);
    }
  });

  test('320 × 글자 200%: 가로 넘침 0 · 버튼 글자가 잘리지 않고 모든 버튼에 닿을 수 있다(고정을 풀어도 된다)', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 320, 568, 200);
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
    const clipped = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button, [data-testid="tools"] .btn')].filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.dataset.testid));
    expect(clipped, '글자가 잘린 버튼').toEqual([]);
    for (const id of ['pause', 'speed', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-exit']) {
      await page.getByTestId(id).scrollIntoViewIfNeeded();
      const inView = await page.evaluate((i) => {
        const r = document.querySelector<HTMLElement>(`[data-testid="${i}"]`)!.getBoundingClientRect();
        return r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.left >= -0.5 && r.right <= window.innerWidth + 0.5;
      }, id);
      expect(inView, `${id}에 닿는다`).toBe(true);
    }
  });
});

test.describe('배속 한 단추의 동작·접근성 (완료 기준 11)', () => {
  test('누를 때마다 1 → 2 → 4 → 8 → 1배: 보이는 글자가 지금 배속이고 접근 이름은 「배속 N배, 누르면 M배」, aria-pressed는 없고 role=status가 바뀐 값을 읽는다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    const btn = page.getByTestId('speed');
    const status = page.getByTestId('speed-status');
    await expect(status).toHaveAttribute('role', 'status');
    const order = [1, 2, 4, 8, 1, 2];
    for (let i = 0; i < order.length; i++) {
      const s = order[i];
      const next = order[(i + 1) % 4];
      await expect(btn).toHaveText(`${s}배`);
      await expect(btn).toHaveAttribute('data-speed', String(s));
      await expect(btn).toHaveAttribute('aria-label', `배속 ${s}배, 누르면 ${next}배`);
      await expect(btn, '값이라 aria-pressed를 쓰지 않는다').not.toHaveAttribute('aria-pressed', /.*/);
      await expect(status).toHaveText(`배속 ${s}배`);
      expect((await readSettings(page)).speed, '설정 저장').toBe(s);
      if (i < order.length - 1) await btn.click();
    }
  });

  test('Tab 정지점은 일시정지 · 배속 · 다음 결정으로 · 자동 모드 넷이고 Space·Enter가 배속을 한 단계 바꾼다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    await page.getByTestId('life-name').focus();
    expect(await tabWalk(page, 4)).toEqual(['pause', 'speed', 'skip', 'auto']);
    await page.getByTestId('speed').focus();
    expect(await activeTestId(page)).toBe('speed');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('speed')).toHaveAttribute('data-speed', '2');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('speed')).toHaveAttribute('data-speed', '4');
    await pressSpeedTo(page, 1);
    await expect(page.getByTestId('speed')).toHaveAttribute('data-speed', '1');
  });

  test('모바일 일시정지는 아이콘만(이름 「일시정지」·「다시 진행」은 읽기 전용)이고 「다음 결정으로」·「자동 모드」는 글만이다 — 자동 모드 켜짐은 글자 「켜짐」 + 눌림이 알린다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 360, 740);
    const pauseVisibleText = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="pause"]')!;
      return [...b.querySelectorAll('span')].map((s) => ({ text: s.textContent, w: s.getBoundingClientRect().width })).filter((s) => s.w > 2).map((s) => s.text);
    });
    expect(pauseVisibleText, '일시정지는 아이콘만 보인다').toEqual([]);
    await expect(page.getByTestId('pause')).toContainText('일시정지'); // 읽기 전용 이름은 남아 있다
    const icons = await page.evaluate(() => ['skip', 'auto'].map((id) => getComputedStyle(document.querySelector(`[data-testid="${id}"] .icon`)!).display));
    expect(icons, '글 버튼 둘은 아이콘 없이 글만').toEqual(['none', 'none']);
    await expect(page.getByTestId('auto')).toContainText('자동 모드 꺼짐');
    await page.getByTestId('auto').click();
    await expect(page.getByTestId('auto')).toHaveText('자동 모드 켜짐');
    await expect(page.getByTestId('auto')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('PC 1280×800 회귀 (완료 기준 12)', () => {
  test('도구 줄 버튼 36px · 진행 줄 버튼 36px · 도구 줄 블록 44px(위 여백 8 + 36) — 조작 영역이 지금보다 커지지 않고 한 줄이다', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 1280, 800);
    const m = await boxes(page);
    for (const b of [...m.progress, ...m.tools]) expect(Math.abs(b.height - 36), `${b.id} 높이 ${b.height}`).toBeLessThanOrEqual(1);
    expect(spread([...m.progress, ...m.tools].map((b) => b.top)), '9개 버튼이 한 줄').toBeLessThanOrEqual(2);
    const block = await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>('.toolbar')!;
      return { height: t.getBoundingClientRect().height, padTop: parseFloat(getComputedStyle(t).paddingTop) };
    });
    expect(block.padTop, '도구 줄 위 여백 12 → 8').toBe(8);
    expect(Math.abs(block.height - 44), `도구 줄 블록 높이(px) ${block.height} — 옛 56px`).toBeLessThanOrEqual(1);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('960~1179px 마우스: 도구 줄은 아이콘만 36 정사각이고 말풍선 규칙은 그대로다 · 1024 한 줄', async ({ page }, testInfo) => {
    test.skip(!runsHere(testInfo.project.name), SKIP);
    await open(page, 1024, 800);
    const m = await boxes(page);
    for (const b of m.tools) {
      expect(Math.abs(b.height - 36), `${b.id} 높이`).toBeLessThanOrEqual(1);
      expect(Math.abs(b.width - 36), `${b.id} 폭(정사각)`).toBeLessThanOrEqual(1);
    }
    expect(spread([...m.progress, ...m.tools].map((b) => b.top)), '1024에서도 9개 버튼이 한 줄').toBeLessThanOrEqual(2);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, startPageHidden } from './helpers';
import { longestCardStates } from './m7bCards';
import { cardReady } from './m7bStates';
import { decisionBeforeDue, infantDue, sheetReady, shortDecision } from './m7cStates';

/**
 * 시트가 열린 동안 문서 스크롤 잠금 (SPEC-003 M7c T1 — REV-003-M7b-3 R-400, QA-003-M7b A20b; content-M7c 7-1절 T1 완료 판정 (a)~(h)).
 * `overscroll-behavior: contain`은 시트 **안**에서 끝까지 쓴 뒤의 연쇄만 끊는다 — 스크림(시트 위쪽 바탕)에서 시작한 드래그·짧은 시트(넘침 없음)의 휠·PageDown·Space는 그대로 뒤 문서를 움직였다.
 * 잠금(`useScrollLock` → `html.sheet-open { overflow: hidden; padding-right: var(--scrollbar-w) }`)이 이를 막는지를 **행동**(scrollY·본문 위치)으로 본다.
 *  (a) 스크림 터치 드래그 (b) 짧은 시트의 휠 (c) 짧은 시트의 PageDown·Space·방향키 (d) 긴 시트 끝에서 계속 쓸기 (e) 스크롤바 폭 밀림 0 (f) 스크롤한 채 열고 닫은 뒤 scrollY 복원
 *  (g) 결정 시트 → 기록 시트로 이어질 때 튐 0(scrollY 500에서 시작, 모든 프레임 500) (h) 변이 점검 — 잠금을 빼면 (a)~(c)가 실패한다(시험이 실제로 잡는다).
 * 두 시트(결정 시트·기록 시트) 모두에서 본다. 헤드리스 크로뮴은 겹쳐 그리는 스크롤바라 폭이 0이므로 (e)는 시험 안에서 고전 스크롤바(15px)를 강제한다.
 */

const SHOTS = 'qa/screenshots/003';
const MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;
const OFF = { speed: 1, autoMode: false, noteCards: false } as const;

const scrollY = (page: Page): Promise<number> => page.evaluate(() => Math.round(window.scrollY));

/** 시트 뒤 문서가 충분히 길어야(스크롤 가능) 새어 나가는 스크롤이 눈에 보인다 */
async function tallDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.style.minHeight = '5000px';
    window.scrollTo(0, 0);
  });
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), '문서가 시트 뒤에서 스크롤 가능하다').toBeGreaterThan(1500);
}

/** 짧은 기록 시트(수동)를 연다: 인용·선택지 없음, 입력란 + 두 버튼이라 어느 뷰포트에서도 시트 안 스크롤이 없다 */
async function openShortNote(page: Page): Promise<void> {
  await page.goto('/');
  await startPageHidden(page); // 시계가 문서 높이·스크롤에 끼어들지 않게
  await injectSave(page, lifeState(KNOWN_SEED), '/', OFF);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await tallDocument(page);
  await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click()); // 마우스 클릭의 scrollIntoView가 위치를 바꾸지 않게
  await sheetReady(page);
}

/** 짧은 결정 시트(선택지 2개·인용 없음) */
async function openShortDecision(page: Page): Promise<void> {
  await page.goto('/');
  const state = await shortDecision(page);
  await startPageHidden(page);
  await injectSave(page, state, '/', MANUAL);
  await cardReady(page);
  await tallDocument(page);
}

async function expectShort(page: Page): Promise<void> {
  const noInnerScroll = await page.getByRole('dialog').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  expect(noInnerScroll, '짧은 시트: 시트 안에 스크롤이 없다(휠·키가 곧바로 문서로 넘어가는 경우)').toBe(true);
}

async function touchDragOnScrim(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  return cdp;
}

/**
 * 스크림(시트 위쪽 바탕)에서 시작하는 터치 끌기: 손가락 하나가 위로 끌린다(touchStart → touchMove × 10 → touchEnd). 터치 이벤트는 브라우저가 스크롤 여부를
 * 정하는 실제 경로(touch-action·overflow 규칙)를 그대로 거친다. (`Input.synthesizeScrollGesture`는 이 환경에서 문서를 움직이지 못해 쓰지 않는다.)
 */
async function dragScrim(page: Page, cdp: CDPSession): Promise<void> {
  const box = (await page.getByRole('dialog').boundingBox())!;
  const x = Math.round(box.x + box.width / 2);
  const startY = Math.max(60, Math.round(box.y) - 10); // 시트 바로 위쪽 바탕
  expect(startY, '스크림이 보이는 자리가 있다').toBeLessThan(box.y);
  const step = Math.floor(Math.min(150, startY - 5) / 10);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - i * step }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}

async function wheelOver(page: Page, where: 'scrim' | 'sheet'): Promise<void> {
  const box = (await page.getByRole('dialog').boundingBox())!;
  const x = Math.round(box.x + box.width / 2);
  const y = where === 'scrim' ? Math.max(10, Math.round(box.y / 2)) : Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
  }
}

async function keysOnSheet(page: Page): Promise<void> {
  // 포커스는 시트 안(질문 제목)에 있다 — 시트가 짧아 스크롤할 곳이 없으면 키는 문서로 넘어간다
  for (const key of ['PageDown', 'Space', 'ArrowDown', 'ArrowDown', 'End']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(80);
  }
}

/** 잠금을 걷어 낸다(변이): 문서 잠금·스크림 touch-action·연쇄 차단을 모두 푼다 */
async function removeLock(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'html.sheet-open { overflow: visible !important; padding-right: 0 !important; } .overlay { touch-action: auto !important; overscroll-behavior: auto !important; } .sheet { overscroll-behavior: auto !important; }' });
}

for (const kind of ['기록 시트', '결정 시트'] as const) {
  const open = (page: Page) => (kind === '기록 시트' ? openShortNote(page) : openShortDecision(page));

  test(`(a) ${kind}: 스크림(시트 위쪽 바탕)에서 터치 끌기 뒤 문서 scrollY가 변하지 않는다`, async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '잠금 클래스').toBe(true);
    const cdp = await touchDragOnScrim(page);
    await dragScrim(page, cdp);
    expect(await scrollY(page), '끌기 뒤 scrollY').toBe(0);
    await page.screenshot({ path: `${SHOTS}/dev-M7c-scroll-lock-${kind === '기록 시트' ? 'note' : 'decision'}.png` });
  });

  test(`(b) ${kind}가 짧을 때(안쪽 스크롤 없음) 휠 뒤 scrollY가 변하지 않는다 — 시트 위·스크림 위 모두`, async ({ page }) => {
    await open(page);
    await expectShort(page);
    await wheelOver(page, 'sheet');
    expect(await scrollY(page), '시트 위 휠').toBe(0);
    await wheelOver(page, 'scrim');
    expect(await scrollY(page), '스크림 위 휠').toBe(0);
  });

  test(`(c) ${kind}가 짧을 때 PageDown·Space·방향키·End 뒤 scrollY가 변하지 않는다`, async ({ page }) => {
    await open(page);
    await expectShort(page);
    await keysOnSheet(page);
    expect(await scrollY(page)).toBe(0);
  });

  test(`(h) 변이 점검 ${kind}: 잠금(overflow hidden·touch-action)을 빼면 (a)(b)(c)와 같은 동작이 문서를 움직인다 — 위 단언이 공허하지 않다`, async ({ page }) => {
    await open(page);
    await expectShort(page);
    await removeLock(page);
    // 휠·키 → 터치 순서: 터치 에뮬레이션을 켠 뒤에는 이 브라우저의 휠 래칭이 달라질 수 있어 터치를 마지막에 한다
    const moved: Record<string, number> = {};
    await wheelOver(page, 'sheet');
    moved.b = await scrollY(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await keysOnSheet(page);
    moved.c = await scrollY(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const cdp = await touchDragOnScrim(page);
    await dragScrim(page, cdp);
    moved.a = await scrollY(page);
    expect(moved.a, '(a) 잠금이 없으면 터치 끌기가 문서를 움직인다').toBeGreaterThan(0);
    expect(moved.b, '(b) 잠금이 없으면 짧은 시트의 휠이 문서를 움직인다').toBeGreaterThan(0);
    expect(moved.c, '(c) 잠금이 없으면 키가 문서를 움직인다').toBeGreaterThan(0);
  });
}

test('(d) 긴 시트: 안쪽 끝까지 쓴 뒤 계속 쓸어도 문서는 그대로다 (결정 시트 — 데이터에서 고른 가장 긴 카드, 폭 360. SPEC-005 QI5로 예전 school-tutoring은 부모님이 정하는 카드가 되어 시트가 아니다)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  // 가장 긴 카드를 데이터에서 고른다(youth-startup은 360px에서 안쪽 스크롤이 없는 짧은 시트였다)
  const [{ state }] = await longestCardStates(page, 1);
  await startPageHidden(page);
  await injectSave(page, state, '/', MANUAL);
  await cardReady(page);
  await tallDocument(page);
  const inner = await page.getByRole('dialog').evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(inner, '긴 시트: 안쪽 스크롤이 있다').toBeGreaterThan(20);
  const box = (await page.getByRole('dialog').boundingBox())!;
  await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]') as HTMLElement;
    el.scrollTop = el.scrollHeight;
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(150);
  }
  expect(await scrollY(page), '시트 끝 이후 문서 scrollY 불변').toBe(0);
  expect(await page.getByRole('dialog').evaluate((el) => el.scrollTop > 0), '시트 안 스크롤은 막히지 않았다').toBe(true);
});

test('(f) 문서를 스크롤한 채 시트를 열고 닫은 뒤 scrollY가 열기 전과 같다 (기록 시트·결정 시트)', async ({ page }) => {
  await page.goto('/');
  await startPageHidden(page);
  await injectSave(page, lifeState(KNOWN_SEED), '/', OFF);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await tallDocument(page);
  await page.evaluate(() => window.scrollTo(0, 640));
  expect(await scrollY(page)).toBe(640);
  await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
  await sheetReady(page);
  expect(await scrollY(page), '열린 동안').toBe(640);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  expect(await scrollY(page), '닫은 뒤').toBe(640);
  // 결정 시트: 접었다 다시 열 때 (열리는 동작이 문서를 움직이지 않는다 — 접을 때의 포커스 이동은 별개다).
  // 스크롤 앵커링(접힌 띠가 사라질 때 브라우저가 보이는 내용을 지키려고 하는 보정)은 잠금과 무관한 레이아웃 동작이라 끈다 — 이 시험은 잠금이 위치를 건드리지 않는지만 본다
  const state = await shortDecision(page);
  await injectSave(page, state, '/', MANUAL);
  await cardReady(page);
  await tallDocument(page);
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  await page.evaluate(() => {
    document.documentElement.style.overflowAnchor = 'none';
    window.scrollTo(0, 500);
  });
  expect(await scrollY(page)).toBe(500);
  await page.evaluate(() => (document.querySelector('[data-testid="decision-reopen"]') as HTMLElement).click());
  await cardReady(page);
  expect(await scrollY(page), '다시 열린 동안 scrollY 불변').toBe(500);
  await page.evaluate(() => (document.querySelector('[data-testid="decision-fold-btn"]') as HTMLElement).click());
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '접으면 잠금이 풀린다').toBe(false);
});

test('(g) 결정 시트 → 기록 시트로 이어질 때 잠금이 풀렸다 다시 걸리지 않고 scrollY가 튀지 않는다 (모든 프레임에서 overflow: hidden)', async ({ page }) => {
  await page.goto('/');
  const d = await decisionBeforeDue(page);
  await startPageHidden(page);
  await injectSave(page, d.state, '/', MANUAL);
  await cardReady(page);
  await tallDocument(page);
  // 0이 아닌 자리에서 시작한다(M7c r2 관찰 4) — 0에서 시작하면 잠금이 풀렸다 걸리며 위로 튀는 일이 0과 같아 보인다. 잠금 중이어도 프로그램의 scrollTo는 먹는다
  await page.evaluate(() => window.scrollTo(0, 500));
  expect(await scrollY(page), '시작 위치').toBe(500);
  await page.evaluate(() => {
    const w = window as unknown as { __frames: Array<{ overflow: string; y: number; sheets: number }>; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const tick = () => {
      w.__frames.push({ overflow: getComputedStyle(document.documentElement).overflow, y: window.scrollY, sheets: document.querySelectorAll('[role="dialog"]').length });
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByTestId(`choice-${d.choiceId}`).click();
  await expect(page.getByTestId('note-sheet')).toBeVisible();
  await page.waitForTimeout(400);
  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: Array<{ overflow: string; y: number; sheets: number }>; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  expect(frames.length, '프레임을 충분히 쟀다').toBeGreaterThan(10);
  expect(frames.map((f) => f.overflow).filter((o) => o !== 'hidden'), '전환 중 어느 프레임에서도 문서 잠금이 풀리지 않았다').toEqual([]);
  expect(frames.map((f) => f.y).filter((y) => y !== 500), 'scrollY 튐 0 (모든 프레임에서 500)').toEqual([]);
  expect(Math.max(...frames.map((f) => f.sheets)), '대화상자는 한 번에 하나').toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '마지막 시트가 닫히면 풀린다').toBe(false);
  expect(await scrollY(page), '닫은 뒤에도 같은 자리').toBe(500);
});

for (const kind of ['기록 시트', '결정 시트'] as const) {
  test(`관찰 5: ${kind}가 처음 그려지는 순간(DOM에 들어온 직후·그려지는 모든 프레임)에 문서 잠금이 이미 걸려 있다 — 효과가 한 프레임 늦지 않다`, async ({ page }) => {
    await page.goto('/');
    const subject = kind === '기록 시트' ? (await infantDue(page)).state : await shortDecision(page);
    // 시트가 DOM에 들어온 같은 작업(task)의 마이크로태스크(= 그림이 그려지기 전)에 잠금 클래스를 읽고, 시트가 보이는 모든 프레임에서도 읽는다.
    // 한계(솔직히): 두 시트는 마운트 때 자기 레이아웃 효과에서 상태를 갱신해 그 동기 재렌더가 대기 중인 일반 효과를 먼저 비우므로, 훅을 일반 효과로 되돌려도 이 시험은 통과한다(변이 점검으로 확인).
    // 그래서 효과의 종류 자체는 tests/scrollLock.test.tsx의 원본 단언(useIsoLayoutEffect, useEffect 없음)이 고정하고, 이 시험은 「첫 그림부터 잠겨 있다」는 결과를 지킨다.
    await page.addInitScript(() => {
      const rec = { atInsert: [] as boolean[], frames: [] as Array<{ dialog: boolean; locked: boolean }> };
      (window as unknown as { __lockRec: typeof rec }).__lockRec = rec;
      const locked = () => document.documentElement.classList.contains('sheet-open');
      new MutationObserver((records) => {
        for (const r of records) {
          for (const n of Array.from(r.addedNodes)) {
            if (n instanceof Element && (n.matches('[role="dialog"]') || n.querySelector('[role="dialog"]') !== null)) rec.atInsert.push(locked());
          }
        }
      }).observe(document, { childList: true, subtree: true });
      const tick = () => {
        rec.frames.push({ dialog: document.querySelector('[role="dialog"]') !== null, locked: locked() });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await startPageHidden(page);
    await injectSave(page, subject, '/', MANUAL);
    if (kind === '기록 시트') await sheetReady(page);
    else await cardReady(page);
    await page.waitForTimeout(300);
    const rec = await page.evaluate(() => (window as unknown as { __lockRec: { atInsert: boolean[]; frames: Array<{ dialog: boolean; locked: boolean }> } }).__lockRec);
    expect(rec.atInsert.length, '시트가 DOM에 들어온 순간을 잡았다').toBeGreaterThanOrEqual(1);
    expect(rec.atInsert, 'DOM에 들어온 직후(그림 전)에 이미 잠겨 있다').not.toContain(false);
    const withDialog = rec.frames.filter((f) => f.dialog);
    expect(withDialog.length, '시트가 보이는 프레임을 충분히 쟀다').toBeGreaterThan(5);
    expect(withDialog.filter((f) => !f.locked), '시트가 보이는 프레임 중 잠기지 않은 것').toEqual([]);
  });
}

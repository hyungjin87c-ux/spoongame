import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameState, HistoryEntry } from '../src/core/types';
import { KNOWN_SEED, evalCore, findPendingState, injectSave, lifeState, noHorizontalOverflow, readSave, settle, startPageHidden, withoutPlay } from './helpers';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { adultState } from './m4States';
import { setRootFontPercent } from './textResize';

/**
 * 인생 기록 최신순 (SPEC-005 QI1, LR1~LR7) — 실제 브라우저에서 본다. 순수 계산(순서·키·보정 계획)은 tests/logOrder.test.tsx, 서버 렌더 구조는 tests/dashboard.test.tsx.
 * 이 파일은 브라우저 가리지 않고 같은 단언으로 돈다(Chromium 기본, WebKit은 `playwright test -c <webkit 설정>`으로 같은 파일을 돌린다 — 직접 보정하는 스크롤 위치가 WebKit에서도 가만히 있는지가 핵심).
 *  - LR1 위가 최신(DOM 순서 = 화면 순서 = 읽기 순서, 접근성 트리의 첫 항목이 가장 최근 줄)
 *  - LR2 맨 위를 보고 있으면 맨 위에 머문다 / 아래에서 읽는 중이면 보던 줄의 화면 위치 변화 ≤ 2px + 「새 기록 N개 · 맨 위로」 / 새로고침 뒤 맨 위
 *  - LR3 단계 줄의 구분선은 줄 아래
 *  - LR4 키보드 Home = 맨 위(가장 최근) · End = 맨 아래(가장 오래된) / 움직임 줄이기에서 부드러운 스크롤 없음
 *  - LR5 결정 카드(인라인)·접힌 띠가 인생 기록 위에 있고 어느 폭·글자 크기에서도 겹치지 않는다
 *  - LR7 상한 300줄에서도 줄이 다시 만들어지지 않고 보던 위치가 흔들리지 않는다 / 나가기 → 이어서 살기 뒤 맨 위 (R-442)
 *  - R-439 줄이 다시 흐를 때(글자 크기 100 ↔ 200% · 창 폭 1280 → 960 / 360 → 320 · 새 줄과 겹침) 아래에서 읽던 사람의 보던 줄이 제자리 — overflow-anchor: none으로 잃은 브라우저 스크롤 고정을 LogList가 대신한다
 *  - R-438 「새 기록 N개 · 맨 위로」 알약이 스크롤 영역 안 위 가장자리(+8px, 가운데)에 떠 있고 화면 안·가려짐 0·터치 44px·글자 200% 넘침 0 (docs/design/log-order-qi1.md)
 *  - R-441 「새 기록 N개 · 맨 위로」를 키보드로 누르면 포커스가 목록 영역으로 간다
 *  - R-444 키보드로 알약에 Tab한 뒤 Home·PageUp·↑로 목록이 맨 위에 닿아 알약이 저절로 사라져도 포커스가 목록 영역으로 간다(body로 떨어지지 않는다)
 * 타이머는 멈춰 두고(startPageHidden) 줄은 「다음 결정으로」·선택으로만 늘린다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;
const TOP_SLACK = 24;

const rowsOf = (page: Page) => page.getByTestId('log-row');
const listOf = (page: Page) => page.getByTestId('log-list');
const scrollTopOf = (list: Locator) => list.evaluate((el) => el.scrollTop);

/** 떠 있는 결정 카드가 있으면 첫 선택지를 고른다 (모달 시트가 뒤의 클릭을 가로채지 않게 한다) */
async function chooseIfPending(page: Page): Promise<boolean> {
  const panel = page.getByTestId('choice-panel');
  if (!(await panel.isVisible())) return false;
  const pending = (await readSave(page)).data.pending!;
  const choice = page.getByTestId(`choice-${pending.choiceIds[0]}`);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(panel).toHaveCount(0);
  return true;
}

/** 줄이 `count`개 이상 늘 때까지 진행한다: 선택지가 떠 있으면 첫 선택지를 고르고, 없으면 「다음 결정으로」를 누른다(선택지만 뜨고 줄은 안 느는 해도 있다). 끝날 때 떠 있는 결정 카드도 골라 둔다. */
async function addRows(page: Page, count = 1): Promise<number> {
  const rows = rowsOf(page);
  const start = await rows.count();
  for (let i = 0; i < 40 && (await rows.count()) < start + count; i++) {
    if (await chooseIfPending(page)) {
      // 고른 결과 줄이 생겼다
    } else {
      await expect(page.getByTestId('skip')).toBeEnabled();
      await page.getByTestId('skip').click();
      await settle(page);
    }
  }
  await chooseIfPending(page);
  const added = (await rows.count()) - start;
  expect(added, '줄이 늘었다').toBeGreaterThanOrEqual(count);
  return added;
}

/** 영역 안에서 완전히 보이는 첫 줄 — 줄 내용과 영역 윗변에서의 거리 */
function watchedRow(list: Locator): Promise<{ text: string; offset: number }> {
  return list.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const row = [...el.querySelectorAll('[data-testid="log-row"]')].find((r) => r.getBoundingClientRect().top >= box.top)!;
    return { text: (row.textContent ?? '').replace(/\s+/g, ' ').trim(), offset: row.getBoundingClientRect().top - box.top };
  });
}

async function openAdult(page: Page): Promise<GameState> {
  await startPageHidden(page);
  await page.goto('/');
  const adult = await adultState(page);
  await injectSave(page, adult, '/', MANUAL);
  await expect(page.getByTestId('skip')).toBeEnabled();
  return adult;
}

const savedHistory = async (page: Page): Promise<HistoryEntry[]> => (await readSave(page)).data.history as HistoryEntry[];

test('LR1 순서: 새 판을 진행하면 줄이 위가 최신으로 쌓인다 — 화면 줄 = 저장 연표를 거꾸로 읽은 것, 나이는 위에서 아래로 늘지 않고 같은 나이 안에서도 나중 줄이 위다', async ({ page }) => {
  test.setTimeout(90_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  await expect(page.getByTestId('skip')).toBeEnabled();
  await addRows(page, 8);
  const rows = rowsOf(page);
  await expect.poll(async () => (await savedHistory(page)).length).toBe(await rows.count());
  const history = await savedHistory(page);
  const dom = await rows.evaluateAll((els) =>
    els.map((el) => ({ kind: el.getAttribute('data-kind'), age: Number((el.querySelector('.log__age')?.textContent ?? '').replace('세', '')), text: (el.querySelector('.log__text')?.textContent ?? '').replace(/\s+/g, ' ').trim() })),
  );
  expect(dom).toHaveLength(history.length);
  dom.forEach((d, i) => {
    const h = history[history.length - 1 - i];
    expect([d.kind, d.age], `${i}번째 줄`).toEqual([h.kind, h.age]);
    expect(d.text, `${i}번째 줄의 글`).toContain(h.text.slice(0, 12));
  });
  const ages = dom.map((d) => d.age);
  expect(ages, '나이는 위에서 아래로 늘지 않는다').toEqual([...ages].sort((a, b) => b - a));
  expect(dom.at(-1)!.kind, '맨 아래는 출생').toBe('stage');
  await expect(rows.first()).toHaveClass(/log__row--latest/);
  expect(await page.locator('.log__row--latest').count(), '굵은 줄은 하나').toBe(1);
  // 읽기 순서: 접근성 트리의 첫 항목이 가장 최근 줄이다 (DOM 순서 = 읽기 순서)
  const tree = await listOf(page).ariaSnapshot();
  const lines = tree.split('\n');
  const starts = lines.flatMap((l, i) => (/^\s*- listitem\b/.test(l) ? [i] : []));
  const items = starts.map((from, k) => lines.slice(from, starts[k + 1] ?? lines.length).join('\n'));
  expect(items.length, '접근성 트리의 항목 수 = 줄 수').toBe(history.length);
  const latest = history.at(-1)!;
  expect(items[0], '첫 항목이 가장 최근 줄(나이)').toContain(`${latest.age}세`);
  expect(items[0], '첫 항목이 가장 최근 줄(글)').toContain(latest.text.slice(0, 8));
  expect(items.at(-1)!, '마지막 항목은 출생').toContain('0세');
  // live region 속성이 유지된다
  const ol = page.locator('[data-testid="log-list"] > ol');
  await expect(ol).toHaveAttribute('aria-live', 'polite');
  await expect(ol).toHaveAttribute('aria-relevant', 'additions');
});

test('LR2 맨 위에 머무는 중에는 줄 10개가 쌓여도 스크롤 위치가 맨 위(≤ 24)이고 버튼이 뜨지 않는다. 새 줄이 바로 보인다', async ({ page }) => {
  test.setTimeout(120_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  await expect(page.getByTestId('skip')).toBeEnabled();
  const list = listOf(page);
  expect(await scrollTopOf(list), '처음에는 맨 위').toBeLessThanOrEqual(TOP_SLACK);
  const added = await addRows(page, 10);
  expect(added).toBeGreaterThanOrEqual(10);
  expect(await scrollTopOf(list), '맨 위에 머문다').toBeLessThanOrEqual(TOP_SLACK);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
  const firstVisible = await list.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const r = el.querySelector('[data-testid="log-row"]')!.getBoundingClientRect();
    return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
  });
  expect(firstVisible, '가장 최근 줄이 영역 안에 온전히 보인다').toBe(true);
});

test('LR2 아래에서 지난 기록을 읽는 중이면(스크롤 ≥ 200px) 줄이 쌓여도 보던 줄의 화면 위치 변화 ≤ 2px이고, 「새 기록 N개 · 맨 위로」가 쌓인 수를 말하며, 누르면 N이 0이 되고 맨 위로 간다. 직접 맨 위까지 올려도 0이 된다', async ({ page }) => {
  test.setTimeout(120_000);
  await openAdult(page);
  const list = listOf(page);
  const rows = rowsOf(page);
  const reach = await list.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(reach, '내려 읽을 만큼 기록이 길다').toBeGreaterThan(260);
  await list.evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  await settle(page);
  expect(await scrollTopOf(list)).toBeGreaterThanOrEqual(200);
  const before = await watchedRow(list);
  const count0 = await rows.count();
  let totalAdded = 0;
  for (let round = 0; round < 3; round++) {
    totalAdded += await addRows(page, 1);
    await settle(page);
    const now = await watchedRow(list);
    expect(now.text, `${round + 1}번째: 보던 줄이 그대로`).toBe(before.text);
    expect(Math.abs(now.offset - before.offset), `${round + 1}번째: 보던 줄의 화면 위치 변화(${before.offset} → ${now.offset})`).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('log-jump')).toHaveText(new RegExp(`새 기록 ${(await rows.count()) - count0}개 · 맨 위로`));
  }
  expect(totalAdded).toBeGreaterThanOrEqual(3);
  expect(await scrollTopOf(list), '따라가지 않고 아래에서 읽는 중이다').toBeGreaterThan(200);
  // 직접 맨 위까지 올리면 개수가 0이 되고 버튼이 사라진다
  await list.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
  // 다시 아래로 읽다가 줄이 쌓이면 개수는 0부터 센다. 버튼을 누르면 맨 위로 가고 사라진다
  await list.evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  await settle(page);
  const count1 = await rows.count();
  await addRows(page, 1);
  await expect(page.getByTestId('log-jump')).toHaveText(new RegExp(`새 기록 ${(await rows.count()) - count1}개 · 맨 위로`));
  await page.getByTestId('log-jump').click();
  await expect.poll(() => scrollTopOf(list)).toBeLessThanOrEqual(TOP_SLACK);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
  await expect(rows.first()).toHaveClass(/log__row--latest/);
});

test('LR1 줄은 다시 만들어지지 않는다: 줄이 쌓여도 기존 줄의 DOM 요소가 그대로이고 새 줄만 맨 위에 생긴다', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const rows = rowsOf(page);
  await rows.evaluateAll((els) => els.forEach((el) => ((el as unknown as { __kept: boolean }).__kept = true)));
  const before = await rows.count();
  await addRows(page, 2);
  const after = await rows.evaluateAll((els) => els.map((el) => (el as unknown as { __kept?: boolean }).__kept === true));
  expect(after.length).toBeGreaterThan(before);
  const fresh = after.length - before;
  expect(after.slice(0, fresh), '새 줄은 맨 위, 표식이 없다').toEqual(new Array(fresh).fill(false));
  expect(after.slice(fresh), '기존 줄은 모두 같은 요소').toEqual(new Array(before).fill(true));
});

test('LR2 새로고침하면 맨 위(가장 최근)에서 시작한다', async ({ page }) => {
  test.setTimeout(90_000); // 개발 서버 첫 요청(콜드 스타트)이 WebKit에서 30초에 가깝다
  await openAdult(page);
  const list = listOf(page);
  await list.evaluate((el) => el.scrollTo({ top: 300, behavior: 'instant' }));
  await settle(page);
  expect(await scrollTopOf(list)).toBeGreaterThan(200);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(rowsOf(page).first()).toHaveClass(/log__row--latest/);
  expect(await scrollTopOf(listOf(page)), '새로고침 복원 뒤 맨 위').toBeLessThanOrEqual(TOP_SLACK);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
});

test('LR3 단계 줄(출생 포함)의 구분선은 줄 아래에 있고 위에는 없다. 가장 오래된 줄(출생)은 목록 끝이라 아래 선도 없다. 단계 줄이 같은 단계 안의 다른 줄보다 아래에 있다', async ({ page }) => {
  test.setTimeout(90_000); // 개발 서버 첫 요청(콜드 스타트)이 WebKit에서 30초에 가깝다
  await openAdult(page);
  const info = await page.locator('[data-testid="log-row"][data-kind="stage"]').evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      const siblings = [...(el.parentElement as HTMLElement).children];
      return { top: cs.borderTopWidth, bottom: cs.borderBottomWidth, last: el === siblings[siblings.length - 1], age: Number((el.querySelector('.log__age')?.textContent ?? '').replace('세', '')), index: siblings.indexOf(el) };
    }),
  );
  expect(info.length, '단계 줄 여럿(출생·학교·스무 살·마흔)').toBeGreaterThanOrEqual(3);
  for (const s of info) {
    expect(s.top, '위 선 없음').toBe('0px');
    expect(s.bottom, `${s.age}세 단계 줄: ${s.last ? '목록 끝(출생)은 아래 선 없음' : '아래 굵은 선 2px'}`).toBe(s.last ? '0px' : '2px');
  }
  // 단계 줄 아래(= 더 오래된 쪽)에는 그 단계 이전의 줄만 있다 — 나이가 이 단계 시작 나이 이하
  const ordered = await rowsOf(page).evaluateAll((els) =>
    els.map((el) => ({ kind: el.getAttribute('data-kind'), age: Number((el.querySelector('.log__age')?.textContent ?? '').replace('세', '')) })),
  );
  ordered.forEach((r, i) => {
    if (r.kind !== 'stage' || i === ordered.length - 1) return;
    expect(ordered[i + 1].age, `${r.age}세 단계 줄 아래는 이전 단계(나이 ≤ ${r.age})`).toBeLessThanOrEqual(r.age);
    if (i > 0) expect(ordered[i - 1].age, `${r.age}세 단계 줄 위는 이 단계의 줄(나이 ≥ ${r.age})`).toBeGreaterThanOrEqual(r.age);
  });
});

test('LR4 키보드: 영역에 포커스를 두고 PageDown·PageUp·방향키로 읽고, End = 맨 아래(가장 오래된 줄), Home = 맨 위(가장 최근 줄)', async ({ page }) => {
  test.setTimeout(90_000); // 개발 서버 첫 요청(콜드 스타트)이 WebKit에서 30초에 가깝다
  await openAdult(page);
  const list = listOf(page);
  await expect(list).toHaveAttribute('role', 'region');
  await expect(list).toHaveAttribute('aria-label', '인생 기록');
  await expect(list).toHaveAttribute('tabindex', '0');
  await list.focus();
  const max = await list.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(max).toBeGreaterThan(260);
  expect(await scrollTopOf(list)).toBeLessThanOrEqual(TOP_SLACK);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => scrollTopOf(list)).toBeGreaterThan(0);
  await page.keyboard.press('PageDown');
  await expect.poll(() => scrollTopOf(list)).toBeGreaterThan(100);
  await page.keyboard.press('End');
  await expect.poll(async () => max - (await scrollTopOf(list))).toBeLessThanOrEqual(2);
  const oldest = await list.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const rows = el.querySelectorAll('[data-testid="log-row"]');
    const r = rows[rows.length - 1].getBoundingClientRect();
    return { visible: r.bottom <= box.bottom + 1, kind: rows[rows.length - 1].getAttribute('data-kind') };
  });
  expect(oldest.visible, 'End: 가장 오래된 줄(출생)이 보인다').toBe(true);
  expect(oldest.kind).toBe('stage');
  await page.keyboard.press('Home');
  await expect.poll(() => scrollTopOf(list)).toBe(0);
  const newest = await list.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const r = el.querySelector('[data-testid="log-row"]')!.getBoundingClientRect();
    return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
  });
  expect(newest, 'Home: 가장 최근 줄이 보인다').toBe(true);
});

test('LR4 움직임 줄이기: 「맨 위로」를 누르면 부드러운 스크롤 없이 곧바로 맨 위로 간다', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAdult(page);
  const list = listOf(page);
  await list.evaluate((el) => el.scrollTo({ top: 260, behavior: 'instant' }));
  await settle(page);
  await addRows(page, 1);
  await expect(page.getByTestId('log-jump')).toBeVisible();
  expect(await list.evaluate((el) => getComputedStyle(el).scrollBehavior), '움직임 줄이기에서는 CSS도 부드럽지 않다').toBe('auto');
  await page.getByTestId('log-jump').click();
  await settle(page);
  expect(await scrollTopOf(list), '한두 프레임 안에 맨 위 — 미끄러지지 않는다').toBeLessThanOrEqual(TOP_SLACK);
});

test('LR7 상한 300줄: 줄이 더해져 가장 오래된 쪽이 지워져도 줄 수는 300이고 보던 줄의 화면 위치가 흔들리지 않으며 새 줄 수는 센다', async ({ page }) => {
  test.setTimeout(120_000);
  await startPageHidden(page);
  await page.goto('/');
  const adult = await adultState(page);
  // 연표를 정확히 300줄로 채운다: 출생 바로 뒤(가장 오래된 쪽)에 지워질 후보인 서술 줄을 끼운다
  const pad = 300 - adult.history.length;
  expect(pad).toBeGreaterThan(0);
  const filler: HistoryEntry[] = Array.from({ length: pad }, (_, i) => ({ age: 1 + (i % 4), kind: 'event', text: `오래전 어느 해의 일입니다 ${i + 1}.`, title: '오래된 일', eventId: `pad-${i}` }));
  const state: GameState = { ...adult, history: [adult.history[0], ...filler, ...adult.history.slice(1)] };
  expect(state.history).toHaveLength(300);
  await injectSave(page, state, '/', MANUAL);
  await expect(page.getByTestId('skip')).toBeEnabled();
  const list = listOf(page);
  const rows = rowsOf(page);
  await expect(rows).toHaveCount(300);
  await list.evaluate((el) => el.scrollTo({ top: 400, behavior: 'instant' }));
  await settle(page);
  const before = await watchedRow(list);
  let added = 0;
  for (let i = 0; i < 3; i++) {
    expect((await savedHistory(page)).length, '상한 그대로').toBeLessThanOrEqual(300);
    const top0 = await rows.first().textContent();
    // 줄이 하나 늘 때까지(길이는 300 그대로라 줄 수가 아니라 첫 줄이 바뀌는 것으로 센다)
    for (let guard = 0; guard < 40; guard++) {
      if (await chooseIfPending(page)) {
        // 고른 결과 줄이 생겼다
      } else {
        await expect(page.getByTestId('skip')).toBeEnabled();
        await page.getByTestId('skip').click();
        await settle(page);
      }
      if ((await rows.first().textContent()) !== top0) break;
    }
    expect(await rows.first().textContent(), '새 줄이 맨 위에 생겼다').not.toBe(top0);
    added++;
    await expect(rows).toHaveCount(300);
    const now = await watchedRow(list);
    expect(now.text, `${added}번째: 보던 줄이 그대로`).toBe(before.text);
    expect(Math.abs(now.offset - before.offset), `${added}번째: 보던 줄의 화면 위치 변화`).toBeLessThanOrEqual(2);
  }
  await expect(page.getByTestId('log-jump')).toBeVisible();
  const label = (await page.getByTestId('log-jump').textContent()) ?? '';
  expect(Number(/새 기록 (\d+)개/.exec(label)![1]), '길이는 그대로여도 쌓인 줄을 센다').toBeGreaterThanOrEqual(added);
});

/** 결정 카드(또는 접힌 띠)와 인생 기록의 자리 — 카드가 인생 기록 위에 있고 겹치지 않으며 가로 넘침이 없는지 */
async function cardAboveLog(page: Page, label: string): Promise<void> {
  const g = await page.evaluate(() => {
    const rect = (id: string) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect() ?? null;
    const card = rect('choice-panel') ?? rect('decision-fold');
    return { card: card && { bottom: card.bottom }, log: rect('log'), pin: rect('log-pin'), list: rect('log-list'), vw: window.innerWidth };
  });
  expect(g.card && g.log, `${label}: 카드와 인생 기록이 모두 있다`).toBeTruthy();
  expect(g.card!.bottom, `${label}: 카드는 인생 기록 위(겹침 0)`).toBeLessThanOrEqual(g.log!.top + 0.5);
  expect(g.log!.right, `${label}: 인생 기록이 가로로 넘치지 않는다`).toBeLessThanOrEqual(g.vw + 0.5);
  expect(await noHorizontalOverflow(page), `${label}: 가로 넘침 0`).toBe(true);
  expect(g.pin!.top, `${label}: 고정 가상 인구 줄은 스크롤 영역 밖 맨 위`).toBeLessThan(g.list!.top);
}

for (const percent of [100, 200]) {
  test(`LR5 자동 모드의 인라인 결정 카드는 인생 기록 위에 있고 겹치지 않으며 가로 넘침이 없다 — 글자 ${percent}%`, async ({ page }) => {
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const state = await findPendingState(page, 'present', { minChoices: 3 });
    await injectSave(page, state, '/', { speed: 1, autoMode: true });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    if (percent !== 100) await setRootFontPercent(page, percent);
    await settle(page);
    await cardAboveLog(page, `인라인 카드 ${percent}%`);
  });

  test(`LR5 접힌 띠(결정 다시 열기)는 인생 기록 위에 있고 겹치지 않으며 가로 넘침이 없다 — 글자 ${percent}%`, async ({ page }) => {
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const state = await findPendingState(page, 'present', { minChoices: 3 });
    await injectSave(page, state, '/', MANUAL);
    await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-fold')).toBeVisible();
    if (percent !== 100) await setRootFontPercent(page, percent);
    await settle(page);
    await cardAboveLog(page, `접힌 띠 ${percent}%`);
  });
}

test('LR2 8배속 자동 진행으로 줄이 폭주하는 중에도 아래에서 읽는 사람의 보던 줄은 프레임마다 움직이지 않는다 (타이머를 멈추지 않는다)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const adult = await adultState(page);
  await injectSave(page, adult, '/', { speed: 8, autoMode: true });
  const list = listOf(page);
  const rows = rowsOf(page);
  await expect(rows.first()).toBeVisible();
  await list.evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  await settle(page);
  expect(await scrollTopOf(list), '아래에서 읽는 중').toBeGreaterThan(200);
  const count0 = await rows.count();
  // 프레임마다 보던 줄(영역 안에서 윗변이 영역 윗변 아래에 걸린 첫 줄을 처음 한 번 정해 끝까지 그 줄만)의 영역 안 위치를 기록한다 — 한 프레임이라도 튀면 최대 변화가 커진다
  const result = await page.evaluate(
    () =>
      new Promise<{ maxDelta: number; frames: number; rowsAdded: number; text: string }>((resolve) => {
        const el = document.querySelector('[data-testid="log-list"]') as HTMLElement;
        const all = () => [...el.querySelectorAll('[data-testid="log-row"]')] as HTMLElement[];
        const box = () => el.getBoundingClientRect();
        const watched = all().find((r) => r.getBoundingClientRect().bottom > box().top + 1)!;
        const offsetNow = () => watched.getBoundingClientRect().top - box().top;
        const first = offsetNow();
        const startCount = all().length;
        let maxDelta = 0;
        let frames = 0;
        const t0 = performance.now();
        const tick = () => {
          frames++;
          maxDelta = Math.max(maxDelta, Math.abs(offsetNow() - first));
          // 줄이 5개 쌓일 때까지(최대 40초) 계속 잰다
          if (all().length - startCount < 5 && performance.now() - t0 < 40_000) requestAnimationFrame(tick);
          else resolve({ maxDelta, frames, rowsAdded: all().length - startCount, text: (watched.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20) });
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(result.rowsAdded, `줄이 여러 개 쌓였다(${result.rowsAdded}개, ${result.frames}프레임)`).toBeGreaterThanOrEqual(5);
  expect(result.maxDelta, `보던 줄(「${result.text}」)의 프레임별 최대 이동(px) — ${result.rowsAdded}줄이 쌓이는 동안`).toBeLessThanOrEqual(2);
  expect((await rows.count()) - count0).toBeGreaterThanOrEqual(5);
  await expect(page.getByTestId('log-jump')).toBeVisible();
});

// ---------- R-439 줄이 다시 흐를 때(글자 크기·창 크기·화면 회전) 보던 자리 ----------

interface Watched {
  text: string;
  /** 잡아 둔 줄의 윗변이 영역 윗변에서 떨어진 거리(px, 윗변이 영역 위로 넘어 있으면 음수) */
  offset: number;
  /** 지금 영역 윗변에 걸친 첫 줄이 잡아 둔 그 줄인가 */
  first: boolean;
  /** 잡아 둔 줄이 DOM에 그대로 있는가(다시 만들어지지 않았다) */
  connected: boolean;
  scrollTop: number;
  scrollHeight: number;
}

/** 영역 윗변에 걸친 첫 줄(아랫변이 영역 윗변 아래인 첫 줄)을 `pin`이면 새로 잡고, 아니면 전에 잡아 둔 줄의 지금 거리를 잰다 */
function readWatched(list: Locator, pin: boolean): Promise<Watched> {
  return list.evaluate((el, doPin) => {
    const w = window as unknown as { __watched?: HTMLElement };
    const box = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('[data-testid="log-row"]')] as HTMLElement[];
    const first = rows.find((r) => r.getBoundingClientRect().bottom > box.top + 1)!;
    if (doPin || w.__watched === undefined) w.__watched = first;
    const row = w.__watched;
    return {
      text: (row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 24),
      offset: row.getBoundingClientRect().top - box.top,
      first: first === row,
      connected: row.isConnected,
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
    };
  }, pin);
}

/** 목록을 `min`px 이상 내리되 한 줄의 중간(그 줄 윗변이 영역 윗변보다 18px 위)에 맞추고, 그 줄을 잡아 둔다 — 줄 경계에 걸려 어느 줄이 「첫 줄」인지 흔들리지 않게 */
async function pinMidRow(list: Locator, min = 200): Promise<Watched> {
  await list.evaluate((el, minTop) => {
    const box = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('[data-testid="log-row"]')] as HTMLElement[];
    const y = (r: HTMLElement) => r.getBoundingClientRect().top - box.top + el.scrollTop; // 줄 윗변의 목록 안 위치
    const target = rows.find((r) => y(r) + 18 >= minTop && r.getBoundingClientRect().height > 40)!;
    el.scrollTo({ top: y(target) + 18, behavior: 'instant' });
  }, min);
  const w = await readWatched(list, true);
  expect(w.scrollTop, '아래에서 읽는 중(≥ 200px)').toBeGreaterThanOrEqual(min);
  expect(Math.abs(w.offset + 18), `잡은 줄은 윗변이 영역 위로 약 18px 넘어 있다(${w.offset.toFixed(2)}px — WebKit은 스크롤 위치를 화면 픽셀에 맞춘다)`).toBeLessThanOrEqual(1.5);
  return w;
}

/** 줄이 다시 흐른 뒤: 잡아 둔 줄이 그대로 있고(같은 요소) 영역 윗변에 걸친 첫 줄이며 영역 윗변에서의 거리 변화가 작다(≤ 2px) */
function expectKept(now: Watched, before: Watched, label: string): void {
  expect(now.connected, `${label}: 줄이 다시 만들어지지 않았다`).toBe(true);
  expect(now.first, `${label}: 영역 윗변에 걸친 첫 줄이 보던 줄(「${before.text}」) 그대로다`).toBe(true);
  expect(Math.abs(now.offset - before.offset), `${label}: 보던 줄의 영역 윗변에서의 거리 변화(${before.offset.toFixed(1)} → ${now.offset.toFixed(1)}px)`).toBeLessThanOrEqual(2);
}

test('R-439 글자 크기: 아래에서(≥ 200px) 읽는 중 루트 글자를 100 → 200 → 100%로 바꿔도 보던 줄이 같고 영역 윗변에서의 거리 변화 ≤ 2px이다 — 위치는 줄이 커진 만큼 따라간다', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const list = listOf(page);
  const before = await pinMidRow(list);
  await setRootFontPercent(page, 200);
  await settle(page);
  const big = await readWatched(list, false);
  expectKept(big, before, '글자 200%');
  expect(big.scrollHeight, '글자가 커져 내용이 정말 길어졌다(공허 통과 방지)').toBeGreaterThan(before.scrollHeight * 1.4);
  expect(big.scrollTop, '위치가 줄이 커진 만큼 따라갔다').toBeGreaterThan(before.scrollTop + 80);
  await setRootFontPercent(page, 100);
  await settle(page);
  const back = await readWatched(list, false);
  expectKept(back, before, '글자 100%로 되돌림');
  expect(Math.abs(back.scrollTop - before.scrollTop), '되돌리면 위치도 처음과 같다(어긋남이 쌓이지 않는다)').toBeLessThanOrEqual(3);
  await expect(page.getByTestId('log-jump'), '크기가 바뀌어도 새 기록으로 세지 않는다').toHaveCount(0);
});

test('R-439 창 폭: 아래에서(≥ 200px) 읽는 중 뷰포트 폭을 1280 → 960(모바일은 360 → 320)으로 줄였다 되돌려도 보던 줄이 같고 영역 윗변에서의 거리 변화 ≤ 2px이다 (글자 100%)', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const list = listOf(page);
  const full = page.viewportSize()!;
  const narrow = { width: full.width >= 1000 ? 960 : 320, height: full.height };
  const before = await pinMidRow(list);
  await page.setViewportSize(narrow);
  await settle(page);
  expectKept(await readWatched(list, false), before, `폭 ${full.width} → ${narrow.width}`);
  await page.setViewportSize(full);
  await settle(page);
  expectKept(await readWatched(list, false), before, `폭 ${narrow.width} → ${full.width}로 되돌림`);
});

test('R-439 창 폭 + 글자 150%: 폭이 줄어 줄바꿈이 실제로 늘어나는(내용 높이가 달라지는) 상태에서도 보던 줄이 같고 거리 변화 ≤ 2px이다', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const list = listOf(page);
  const full = page.viewportSize()!;
  const narrow = { width: full.width >= 1000 ? 960 : 320, height: full.height };
  await setRootFontPercent(page, 150);
  await settle(page);
  const before = await pinMidRow(list);
  await page.setViewportSize(narrow);
  await settle(page);
  const small = await readWatched(list, false);
  expectKept(small, before, `글자 150% · 폭 ${full.width} → ${narrow.width}`);
  expect(small.scrollHeight, `폭이 줄어 내용 높이가 달라졌다(${before.scrollHeight} → ${small.scrollHeight}, 공허 통과 방지)`).toBeGreaterThan(before.scrollHeight);
  await page.setViewportSize(full);
  await settle(page);
  expectKept(await readWatched(list, false), before, `글자 150% · 폭 ${narrow.width} → ${full.width}로 되돌림`);
});

test('R-439 맨 위(≤ 24px)를 보고 있으면 글자 크기가 바뀌어도 되맞추지 않고 맨 위에 머문다 — 가장 최근 줄이 보인다', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const list = listOf(page);
  expect(await scrollTopOf(list)).toBeLessThanOrEqual(TOP_SLACK);
  await setRootFontPercent(page, 200);
  await settle(page);
  expect(await scrollTopOf(list), '글자 200%에서도 맨 위').toBeLessThanOrEqual(TOP_SLACK);
  await setRootFontPercent(page, 100);
  await settle(page);
  expect(await scrollTopOf(list), '글자 100%로 되돌려도 맨 위').toBeLessThanOrEqual(TOP_SLACK);
  const newest = await list.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const r = el.querySelector('[data-testid="log-row"]')!.getBoundingClientRect();
    return r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
  });
  expect(newest, '가장 최근 줄이 영역 안에 온전히 보인다').toBe(true);
});

/** 30세 넘게 살아 쌓인 긴 기록 + 아직 고르지 않은 선택지가 떠 있는 상태 (결정 하나가 줄 하나를 만든다) */
async function pendingAdultState(page: Page): Promise<GameState> {
  const state = await evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'present')));
     while (s.phase === 'life' && s.age < 30) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
     for (let i = 0; i < 60 && s.phase === 'life' && !s.pending; i++) s = core.advanceUntilDecision(s).state;
     return s;`,
  );
  expect(state.pending, '대기 중인 선택지가 있다').not.toBeNull();
  expect(state.history.length, '긴 인생 기록').toBeGreaterThan(15);
  return withoutPlay(state);
}

test('R-439 새 줄과 글자 크기 변화가 한 프레임에 겹쳐도(같은 작업에서 글자를 200%로 키우고 선택을 누름) 보던 줄은 한 번에 제자리로 간다 — 영역 윗변에서의 거리 변화 ≤ 2px', async ({ page }) => {
  test.setTimeout(90_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await pendingAdultState(page), '/', MANUAL);
  const choice = page.locator('[data-testid="choice-panel"] button[data-testid^="choice-"]').first();
  await expect(choice).toBeEnabled();
  const list = listOf(page);
  const before = await pinMidRow(list);
  // 글자를 키우면 레이아웃이 더러워지고 ResizeObserver는 다음 프레임에야 돈다. 그 전에(같은 작업) 선택을 눌러 새 줄을 그리게 한다 = 흐름 변화와 새 줄이 한 프레임에 겹친다
  const added = await page.evaluate(async () => {
    const count = () => document.querySelectorAll('[data-testid="log-row"]').length;
    const rowsBefore = count();
    document.documentElement.style.fontSize = '200%';
    (document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]') as HTMLElement).click();
    for (let i = 0; i < 8; i++) await Promise.resolve(); // 마이크로태스크만 비운다 — 프레임(레이아웃·관찰자)은 아직 오지 않는다
    return count() - rowsBefore;
  });
  expect(added, '새 줄이 프레임 전에 같은 작업 안에서 그려졌다(겹침 재현)').toBeGreaterThanOrEqual(1);
  await settle(page);
  const now = await readWatched(list, false);
  expectKept(now, before, '새 줄 + 글자 200%');
  expect(now.scrollTop, '글자가 커진 만큼 따라갔다').toBeGreaterThan(before.scrollTop + 80);
  await expect(page.getByTestId('log-jump')).toHaveText(new RegExp(`새 기록 ${added}개 · 맨 위로`));
  // 한 프레임 더 지나도(관찰자가 다시 돌아도) 가만히 있다
  await settle(page);
  expectKept(await readWatched(list, false), before, '한 프레임 더');
});

// ---------- R-441 「새 기록 N개 · 맨 위로」 키보드 ----------

for (const key of ['Enter', 'Space']) {
  test(`R-441 키보드로(${key}) 「새 기록 N개 · 맨 위로」를 누르면 버튼이 사라져도 포커스가 목록 영역으로 가고(화면은 끌려가지 않는다) 맨 위로 올라가며, 거기서 방향키로 계속 읽는다`, async ({ page }) => {
    test.setTimeout(120_000);
    await openAdult(page);
    const list = listOf(page);
    await list.evaluate((el) => el.scrollTo({ top: 260, behavior: 'instant' }));
    await settle(page);
    await addRows(page, 1);
    const jump = page.getByTestId('log-jump');
    await expect(jump).toBeVisible();
    await jump.focus();
    await expect(jump).toBeFocused();
    const pageY = await page.evaluate(() => window.scrollY);
    await page.keyboard.press(key);
    await expect(jump, '누르면 버튼은 사라진다').toHaveCount(0);
    await expect(list, '포커스가 문서 맨 앞(body)으로 떨어지지 않고 목록 영역으로 간다').toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), '활성 요소는 인생 기록 영역').toBe('log-list');
    expect(await page.evaluate(() => window.scrollY), '포커스가 문서를 끌고 가지 않는다(preventScroll)').toBe(pageY);
    await expect.poll(() => scrollTopOf(list)).toBeLessThanOrEqual(TOP_SLACK);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => scrollTopOf(list), '포커스가 목록에 있으니 방향키로 이어서 읽는다').toBeGreaterThan(0);
  });
}

// ---------- R-444 알약이 포커스를 가진 채 저절로 사라질 때 ----------

for (const key of ['Home', 'PageUp', 'ArrowUp']) {
  test(`R-444 키보드로(${key}) 알약에 Tab한 뒤 목록이 맨 위에 닿아 알약이 저절로 사라져도 포커스가 문서 맨 앞(body)으로 떨어지지 않고 목록 영역으로 간다(화면은 끌려가지 않는다)`, async ({ page }) => {
    test.setTimeout(120_000);
    await openAdult(page);
    const list = listOf(page);
    await list.evaluate((el) => el.scrollTo({ top: 260, behavior: 'instant' }));
    await settle(page);
    await addRows(page, 1);
    const jump = page.getByTestId('log-jump');
    await expect(jump).toBeVisible();
    // 키보드로 알약에 닿는다: 목록 영역(tabindex 0)에 포커스를 두고 Tab — 알약은 영역 안 첫 자식(줄 목록 앞)이라 다음 정지점이다
    await list.focus();
    await page.keyboard.press('Tab');
    await expect(jump, 'Tab으로 알약에 닿았다(공허 통과 방지)').toBeFocused();
    expect(await scrollTopOf(list), '아직 아래에서 읽는 중이라 알약이 떠 있다').toBeGreaterThan(TOP_SLACK);
    const pageY = await page.evaluate(() => window.scrollY);
    // 맨 위에 닿을 때까지 키를 누른다(Home·PageUp은 한두 번, ↑는 40px씩이라 여러 번) — 닿으면 알약이 저절로 사라진다
    for (let i = 0; i < 16 && (await jump.count()) > 0; i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
    }
    await expect(jump, '맨 위에 닿으면 알약은 저절로 사라진다(누르지 않았다)').toHaveCount(0);
    expect(await scrollTopOf(list), '목록은 맨 위에 닿았다').toBeLessThanOrEqual(TOP_SLACK);
    await expect(list, '포커스가 문서 맨 앞(body)으로 떨어지지 않고 목록 영역으로 간다').toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), '활성 요소는 인생 기록 영역').toBe('log-list');
    expect(await page.evaluate(() => window.scrollY), '포커스가 문서를 끌고 가지 않는다(preventScroll)').toBe(pageY);
    // 거기서 방향키로 계속 읽는다 — 포커스가 목록에 있다
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => scrollTopOf(list), '포커스가 목록에 있으니 방향키로 이어서 읽는다').toBeGreaterThan(0);
  });
}

test('R-444 대조: 알약이 포커스를 갖지 않은 채 저절로 사라질 때는 포커스를 가져오지 않는다 — 다른 곳(「다음 결정으로」)의 포커스가 목록으로 빼앗기지 않는다', async ({ page }) => {
  test.setTimeout(120_000);
  await openAdult(page);
  const list = listOf(page);
  await list.evaluate((el) => el.scrollTo({ top: 260, behavior: 'instant' }));
  await settle(page);
  await addRows(page, 1);
  const jump = page.getByTestId('log-jump');
  await expect(jump).toBeVisible();
  const skip = page.getByTestId('skip');
  await skip.focus(); // 포커스는 알약이 아니라 다른 조작 요소에 있다
  await expect(skip).toBeFocused();
  await list.evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' })); // 직접 맨 위까지 올린다(휠·스크롤바와 같은 길)
  await expect(jump, '맨 위에 닿으면 알약은 사라진다').toHaveCount(0);
  await expect(skip, '알약이 포커스를 갖지 않았으니 포커스는 그대로다').toBeFocused();
});

// ---------- R-442 나가기 → 이어서 살기 뒤 맨 위 ----------

test('R-442 아래로 스크롤했다가 나가기 → 첫 화면 「이어서 살기」로 돌아오면 인생 기록은 맨 위(가장 최근)에서 시작한다 (scrollTop ≤ 24)', async ({ page }) => {
  test.setTimeout(90_000);
  await openAdult(page);
  const list = listOf(page);
  await list.evaluate((el) => el.scrollTo({ top: 300, behavior: 'instant' }));
  await settle(page);
  expect(await scrollTopOf(list), '아래에서 읽는 중').toBeGreaterThan(200);
  await expect(page.getByTestId('tool-exit')).toBeEnabled();
  await page.getByTestId('tool-exit').click();
  await expect(page.getByTestId('exit-yes')).toBeEnabled();
  await page.getByTestId('exit-yes').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('resume')).toBeEnabled();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(rowsOf(page).first()).toHaveClass(/log__row--latest/);
  expect(await scrollTopOf(listOf(page)), '이어서 살기 뒤 맨 위').toBeLessThanOrEqual(TOP_SLACK);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
});

// ---------- R-438 「새 기록 N개 · 맨 위로」 알약 자리 (docs/design/log-order-qi1.md) ----------

interface PillGeometry {
  /** 알약 윗변이 스크롤 영역 윗변에서 떨어진 거리 */
  fromTop: number;
  /** 알약 가로 가운데와 영역 가로 가운데의 차 */
  centerDx: number;
  withinListX: boolean;
  withinViewport: boolean;
  /** 알약 한가운데에서 맞는 요소가 알약(또는 그 안)인가 — 고정 머리·하단 띠에 가려지지 않았다 */
  hit: boolean;
  /** 한가운데에서 맞은 요소(알약이 아닐 때 무엇에 가려졌는지 — 진단용) */
  coveredBy: string;
  rect: string;
  /** 하단 고정 띠·고정 머리와 겹치는 면적(px²) */
  overlapBars: number;
  /** 터치 대상 높이(알약 + ::before가 위아래로 늘린 만큼) */
  touchHeight: number;
  width: number;
  height: number;
  /** 슬롯(알약을 감싼 높이 0 sticky 상자)의 높이·position */
  slotHeight: number;
  slotPosition: string;
  /** 줄 목록(ol) 윗변의 스크롤 내용 안 위치 — 0이면 슬롯이 줄을 밀지 않는다 */
  olTopInContent: number;
  /** 알약이 줄 목록(live region) 밖인가 */
  outsideLive: boolean;
}

async function pillGeometry(page: Page): Promise<PillGeometry> {
  return page.evaluate(() => {
    const pill = document.querySelector('[data-testid="log-jump"]') as HTMLElement;
    const list = document.querySelector('[data-testid="log-list"]') as HTMLElement;
    const slot = pill.parentElement as HTMLElement;
    const ol = list.querySelector('ol') as HTMLElement;
    const r = pill.getBoundingClientRect();
    const lr = list.getBoundingClientRect();
    const before = getComputedStyle(pill, '::before');
    const cs = getComputedStyle(pill);
    const extra = (v: string) => (Number.isFinite(parseFloat(v)) ? -parseFloat(v) : Number.NaN); // top·bottom이 음수면 그만큼 늘어난다
    const center = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const bars = ['controls', 'bottom-bar', 'dash-head']
      .map((id) => document.querySelector(`[data-testid="${id}"]`))
      .filter((el): el is Element => el !== null && ['fixed', 'sticky'].includes(getComputedStyle(el).position))
      .map((el) => el.getBoundingClientRect());
    const overlap = bars.reduce((sum, b) => sum + Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)), 0);
    return {
      fromTop: r.top - lr.top,
      centerDx: r.left + r.width / 2 - (lr.left + lr.width / 2),
      withinListX: r.left >= lr.left - 0.5 && r.right <= lr.right + 0.5,
      withinViewport: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
      hit: center !== null && (center === pill || pill.contains(center)),
      coveredBy: center === null ? "null(화면 밖)" : `${center.tagName}.${String(center.className)}#${center.getAttribute("data-testid") ?? ""}`,
      rect: `알약 ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} · 창 ${window.innerWidth}x${window.innerHeight} · scrollY ${Math.round(window.scrollY)}/${document.documentElement.scrollHeight} · 카드 ${Math.round((document.querySelector('[data-testid="log"]') as HTMLElement).getBoundingClientRect().top)} · 영역 ${Math.round(lr.top)}~${Math.round(lr.bottom)} · 띠 ${bars.map((b) => Math.round(b.top) + "~" + Math.round(b.bottom)).join(",")} · 덮은 ${center instanceof HTMLElement ? Math.round(center.getBoundingClientRect().top) + "~" + Math.round(center.getBoundingClientRect().bottom) : ""}`,
      overlapBars: overlap,
      touchHeight: pill.clientHeight + Math.max(parseFloat(cs.borderTopWidth) || 0, extra(before.top) || 0) + Math.max(parseFloat(cs.borderBottomWidth) || 0, extra(before.bottom) || 0),
      width: r.width,
      height: r.height,
      slotHeight: slot.getBoundingClientRect().height,
      slotPosition: getComputedStyle(slot).position,
      olTopInContent: ol.getBoundingClientRect().top - lr.top + list.scrollTop,
      outsideLive: !ol.contains(pill),
    };
  });
}

test('R-438 알약 자리: 아래에서(≥ 200px) 읽는 중 새 줄이 쌓이면 「새 기록 N개 · 맨 위로」가 스크롤 영역 안 위 가장자리 +8px 가운데에 떠 있고, 화면 안이며 가려지지 않고(하단 띠·머리와 겹침 0), 터치 대상 ≥ 44px이고, 스크롤해도 같은 자리이며 줄을 밀지 않는다', async ({ page }) => {
  test.setTimeout(120_000);
  await openAdult(page);
  const list = listOf(page);
  const mobile = page.viewportSize()!.width < 960;
  if (!mobile) expect(await page.evaluate(() => window.scrollY), '1280×800: 페이지 스크롤 0에서 잰다').toBe(0);
  const pinned = await pinMidRow(list);
  await addRows(page, 1);
  const jump = page.getByTestId('log-jump');
  await expect(jump).toBeVisible();
  await settle(page);
  // 나타나도 줄이 밀리지 않는다: 보던 줄의 영역 안 거리가 그대로이고 슬롯이 자리를 차지하지 않는다
  expectKept(await readWatched(list, false), pinned, '알약이 나타난 뒤');
  if (mobile) await list.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' })); // 한 열 배치: 인생 기록 영역을 고정 머리 바로 아래로(스크롤 여백이 머리 높이를 지킨다)
  await settle(page);
  const g = await pillGeometry(page);
  expect(g.slotHeight, '슬롯은 높이 0').toBe(0);
  expect(g.slotPosition, '슬롯은 sticky').toBe('sticky');
  expect(Math.abs(g.olTopInContent), '줄 목록은 영역 내용의 맨 위에서 시작한다(슬롯이 줄을 밀지 않는다)').toBeLessThan(0.5);
  expect(g.outsideLive, '알약은 live region(ol) 밖').toBe(true);
  expect(Math.abs(g.fromTop - 8), `알약 윗변이 영역 위 가장자리에서 8px 아래(${g.fromTop.toFixed(1)}px)`).toBeLessThanOrEqual(1.5);
  expect(Math.abs(g.centerDx), `가로 가운데(${g.centerDx.toFixed(1)}px 어긋남)`).toBeLessThanOrEqual(3);
  expect(g.withinListX, '영역 가로 안').toBe(true);
  expect(g.withinViewport, `${mobile ? '카드를 헤더 아래로 맞춘 화면' : '1280×800 페이지 스크롤 0'}에서 알약이 화면 안`).toBe(true);
  expect(g.hit, `알약 한가운데에서 맞는 요소가 알약 — 고정 머리·하단 띠에 가려지지 않는다(${g.coveredBy} / ${g.rect})`).toBe(true);
  expect(g.overlapBars, '하단 고정 띠·고정 머리와 겹침 0').toBe(0);
  expect(g.touchHeight, `터치 대상 높이(알약 ${g.height.toFixed(1)}px + ::before)`).toBeGreaterThanOrEqual(44 - 0.5);
  expect(g.width, '터치 대상 폭').toBeGreaterThanOrEqual(44);
  // 스크롤해도 같은 자리(sticky): 영역을 더 내려도 알약은 영역 위 가장자리 +8px에 붙어 있다
  await list.evaluate((el) => el.scrollBy({ top: 90, behavior: 'instant' }));
  await settle(page);
  const moved = await pillGeometry(page);
  expect(Math.abs(moved.fromTop - 8), `더 내려도 영역 위 가장자리 +8px(${moved.fromTop.toFixed(1)}px)`).toBeLessThanOrEqual(1.5);
  expect(moved.hit).toBe(true);
});

test('R-438 글자 200%: 알약이 두 줄로 접혀도 영역 안·화면 안이고 가로 넘침 0·낱말 끊김 0이며 터치 대상 ≥ 44px이다 (폭 360·320, 데스크톱은 1280)', async ({ page }) => {
  test.setTimeout(120_000);
  await openAdult(page);
  const list = listOf(page);
  const full = page.viewportSize()!;
  await pinMidRow(list);
  await addRows(page, 1);
  await expect(page.getByTestId('log-jump')).toBeVisible();
  for (const width of full.width < 960 ? [360, 320] : [full.width]) {
    await page.setViewportSize({ width, height: full.height });
    await setRootFontPercent(page, 200);
    await settle(page);
    await expect(page.getByTestId('log-jump'), `${width}px: 크기를 바꿔도 알약이 남아 있다`).toBeVisible();
    await list.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await settle(page);
    const g = await pillGeometry(page);
    expect(await noHorizontalOverflow(page), `${width}px · 200%: 가로 넘침 0`).toBe(true);
    expect(g.withinListX, `${width}px · 200%: 영역 가로 안`).toBe(true);
    expect(g.hit, `${width}px · 200%: 알약이 가려지지 않는다(${g.coveredBy} / ${g.rect})`).toBe(true);
    expect(Math.abs(g.fromTop - 8), `${width}px · 200%: 영역 위 가장자리 +8px(${g.fromTop.toFixed(1)}px)`).toBeLessThanOrEqual(1.5);
    expect(g.touchHeight, `${width}px · 200%: 터치 대상 높이`).toBeGreaterThanOrEqual(44 - 0.5);
    expect(g.overlapBars, `${width}px · 200%: 하단 띠·머리와 겹침 0`).toBe(0);
    const words = await measureWordBreaks(page, { scope: '[data-testid="log-jump"]' });
    expect(words.checked, `${width}px · 200%: 잰 낱말`).toBeGreaterThanOrEqual(2);
    expect(words.broken.map(describeWordBreak), `${width}px · 200%: 끊긴 낱말`).toEqual([]);
    expect(words.unavoidable.map(describeWordBreak), `${width}px · 200%: 한 줄보다 긴 낱말`).toEqual([]);
    if (width < 700) expect(g.height, `${width}px · 200%: 글자가 커서 두 줄 이상이다(공허 통과 방지)`).toBeGreaterThan(60);
  }
});

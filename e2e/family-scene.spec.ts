import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, SETTINGS_KEY, findPendingState, injectSave, lifeState, noHorizontalOverflow, readSave, skipRoulette, toBirthReport } from './helpers';

/**
 * 집과 가족 그림 카드 · 시대의 창 칸 · 인생 기록 시대 줄 (SPEC-009 FM5, FH1·FH4·FH6·FH9·FT1~FT6). 실제 브라우저(Chromium) — desktop(1280×800)과 mobile-360 두 프로젝트에서 돈다.
 * 구조·문구·접근성 속성은 tests/sceneCard.test.tsx(서버 렌더)가 보고, 여기서는 **실제 폭·연속 동작**을 본다: PC 2:1 · 360 띠(80px) 배치, 접기 저장, 해가 바뀔 때 그림·연도 표, 가로 넘침 0, 다크, 움직임 줄이기,
 * 그림 덩어리 요청 실패·재시도, 시대의 창 덩어리를 못 받았을 때의 빈 틀(승인 94장이 1940~2025 모든 해에 닿으므로 데이터가 있는 판에는 빈 틀이 없다), 승인된 그림이 있는 해(1980년 무렵·2016년)의 창(FM5b): 톤 A 필터·색 class 규칙이 실제로 칠해지는지, 가리기, 창 → 그해 줄 이동, 늦게 온 10년 덩어리가 읽던 자리를 밀지 않는지.
 */

/** 개발 서버 전용 탐침: 연출 시간을 N배 빠르게(실제로 기다리지 않는다) */
const FAST = '/?__timescale=1000';
/**
 * 해가 한 걸음씩 보이는 빠른 시계(한 해 약 0.3초). FAST(1000배)는 한 해가 50~80ms라 13세(결정 모달이 뜨는 나이)까지 1초 안에 가서, 시험이 「나이가 올랐다」를 확인하고 「일시정지」나
 * 「다시 불러오기」를 누르는 사이에 모달이 덮을 수 있다. 달리는 판에서 어느 나이 앞에 멈춰 읽어야 하는 시험은 이 시계를 쓴다.
 */
const STEADY = '/?__timescale=100';
/** 수동·1배속·기록 카드 꺼짐(e2e 기본) — 13세 전에는 부모님이 정하거나 흘러가므로 선택지에서 멈추지 않는다 */
const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;
/** 시간을 멈춘 0세 판 — 해가 바뀌지 않아야 하는 시험(배치·접기·다크·빈 틀)이 빠른 시계에 흔들리지 않게 한다 */
const still = () => ({ ...lifeState(KNOWN_SEED), paused: true });

async function startFromTitle(page: Page): Promise<void> {
  await page.goto('/');
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.click();
  await skipRoulette(page);
  await toBirthReport(page);
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

const sceneCard = (page: Page) => page.getByTestId('family-scene');
const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} 상자`).not.toBeNull();
  return b!;
};

test('태어나기 → 살아가기: 집과 가족 그림 카드가 인생 기록 카드 앞에 있고, 그림이 도착하면 조각이 그려지며 연도 표가 머리 연도와 같다', async ({ page }) => {
  await startFromTitle(page);
  await expect(sceneCard(page)).toBeVisible();
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  // 층 여섯과 조각
  const layers = await page.locator('[data-testid="scene-house"] [data-layer]').evaluateAll((els) => els.map((e) => e.getAttribute('data-layer')));
  expect(layers).toEqual(['배경', '소품-뒤', '집', '소품-앞', '반려동물', '식구']);
  expect(await page.locator('[data-testid="scene-house"] [data-layer="식구"] [data-piece]').count()).toBeGreaterThanOrEqual(1);
  expect(await page.locator('[data-testid="scene-house"] [data-self="true"]').count(), '주인공 조각은 하나').toBe(1);
  // 연도 표는 머리 연도와 같다
  const year = (await page.locator('.scene__year time').textContent())!;
  expect(await page.locator('.year-row').first().textContent()).toContain(year.replace('년', ''));
  // 대체 글: 그림은 role=img이고 이름이 「{연도}년 {사는 곳} · {집 낱말} · …」 (FM4b부터 집 종류가 정해져 「집」 한 낱말이 아니다)
  const img = page.locator('[data-testid="scene-house"] [role="img"]');
  // 360px에서 아래 한 줄이 한 줄에 안 들어가면 FitList가 가운뎃점 없이 항목마다 줄을 나누므로(QM2-10 규칙 3) 항목 사이는 「 · 」 또는 공백이다 — 출생 구성은 판마다 달라 긴 줄이 나오는 판에서만 그렇다
  await expect(img).toHaveAccessibleName(/^\d{4}년 .+(?: · | )(?:단독주택|단독주택 셋방|다가구 단독주택|연립주택|다세대주택|아파트|작은 집|가게 딸린 집|상가주택|넓은 단독주택|요양 시설)(?: · | ).+(함께|지냅니다)/);
  // 순서: 그림 카드가 인생 기록보다 위(같은 열 · 한 열 모두)
  const s = await box(page, '[data-testid="family-scene"]');
  const l = await box(page, '[data-testid="log"]');
  expect(s.y).toBeLessThan(l.y);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('배치(FM2d): PC는 집 : 시대의 창 = 2 : 1(둘 사이 8px, 높이가 같다), 휴대폰(카드 480px 이하)은 집 전폭 + 그 아래 창 띠 80px(그림 100×80)', async ({ page }) => {
  await injectSave(page, still(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  // 시대의 창 덩어리(10년대 묶음)는 집 그림과 따로 도착한다 — 빈 틀(data-empty)이 그림 있는 칸으로 바뀐 뒤에 잰다
  await expect(page.locator('#scene-era')).not.toHaveAttribute('data-empty', 'true');
  await expect(page.locator('#scene-era .era__pic')).toBeVisible();
  const vw = page.viewportSize()!.width;
  const house = await box(page, '[data-testid="scene-house"]');
  const era = await box(page, '#scene-era');
  const card = await box(page, '[data-testid="family-scene"]');
  if (card.width > 480) {
    expect(era.x, '창은 집 오른쪽').toBeGreaterThan(house.x + house.width - 1);
    expect(Math.abs(era.x - (house.x + house.width) - 8), '사이 8px').toBeLessThan(1);
    expect(Math.abs(house.width / era.width - 2), `집 ${house.width} : 창 ${era.width}`).toBeLessThan(0.03);
    expect(Math.abs(house.height - era.height), '같은 높이').toBeLessThan(1);
    // 5:4 창(그림 좌표계 40×32)
    expect(Math.abs(era.width / era.height - 1.25), '창 5:4').toBeLessThan(0.05);
  } else {
    expect(era.y, '창 띠는 집 아래').toBeGreaterThanOrEqual(house.y + house.height - 1);
    expect(Math.abs(era.height - 80), '띠 높이 80').toBeLessThan(1);
    const pic = await box(page, '#scene-era .era__pic');
    expect(Math.abs(pic.width - 100)).toBeLessThan(1);
    expect(Math.abs(pic.height - 80)).toBeLessThan(1);
    expect(Math.abs(house.width - (card.width - 2)), '집 그림은 카드 전폭(카드 테두리 1px씩 안쪽)').toBeLessThan(1);
    // R-553 ① A안: 띠 바탕이 카드 바탕(--c-surface)과 같다 — 그림 옆 빈 자리가 「카드 위에 놓인 그림 한 장」으로 읽힌다
    const bg = await page.evaluate(() => {
      const css = (el: Element | null): string => (el === null ? '' : getComputedStyle(el).backgroundColor);
      return { era: css(document.querySelector('#scene-era')), card: css(document.querySelector('[data-testid="family-scene"]')) };
    });
    expect(bg.era, '띠 바탕은 카드 바탕과 같다').toBe(bg.card);
  }
  // 집 그림 높이 ≤ 25vh(FH1)
  const vh = page.viewportSize()!.height;
  expect(house.height).toBeLessThanOrEqual(vh * 0.25 + 1);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(vw).toBeGreaterThan(0);
});

test('시대의 창 덩어리를 받지 못한 판(2016년, 2010년대 덩어리 요청 차단)의 창은 빈 틀이다: 링크도 그림도 없고, 인생 기록에 시대 줄(data-tl="era")이 없다 — 연도 표만 보인다', async ({ page }) => {
  let blocked = 0;
  await page.route(/\/eraWindows\/d2010\.ts/, (route) => {
    blocked++;
    return route.abort();
  });
  await injectSave(page, still(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect.poll(() => blocked, '2010년대 덩어리 요청을 실제로 막았다(공허 통과 방지)').toBeGreaterThan(0);
  await expect(page.locator('#scene-era')).toHaveAttribute('data-empty', 'true');
  expect(await page.locator('a.era').count()).toBe(0);
  expect(await page.locator('#scene-era svg[viewBox="0 0 40 32"] [data-piece]').count()).toBe(0);
  expect(await page.locator('[data-tl="era"]').count()).toBe(0);
  await expect(page.locator('.scene__year')).toBeVisible();
  // 빈 틀은 키보드 정지점이 아니다
  expect(await page.locator('[data-testid="family-scene"] a').count()).toBe(0);
});

test('승인된 그림(시대의 창 r5 반영): 2016년 판의 창에 겨울 광장의 촛불이 오르고, 2010년대는 톤 필터가 없으며, 줄은 승인 표기 문장이다', async ({ page }) => {
  await injectSave(page, still(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-era', 'era-2016-candle-winter', { timeout: 15_000 });
  await expect(era).toHaveAttribute('data-dec', '2010');
  await expect(era).toHaveAttribute('href', '#log-y2016');
  await expect(era).toHaveAccessibleName(/시대의 창 · 겨울 밤마다 광장에 촛불이 모였습니다\. 그해 기록으로/);
  expect(await page.locator('#scene-era svg rect').count(), '도형이 있다 — 빈 틀이 아니다').toBeGreaterThan(30);
  const filter = await page.locator('#scene-era svg').first().evaluate((el) => getComputedStyle(el).filter);
  expect(filter, '2010년대는 톤 필터 없음').toBe('none');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('「그림 접기」: 그림(집 + 시대의 창)이 사라지고 아래 한 줄·펼침만 남는다 — 설정에 저장되어 새로고침해도 접혀 있고, 「그림 펼치기」로 돌아온다', async ({ page }) => {
  await injectSave(page, still(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const fold = page.getByTestId('scene-fold');
  await expect(fold).toHaveText('그림 접기');
  await expect(fold).toHaveAttribute('aria-expanded', 'true');
  const line = await page.getByTestId('scene-line').textContent();
  await fold.click();
  await expect(sceneCard(page)).toHaveAttribute('data-fold', 'true');
  await expect(page.getByTestId('scene-pic')).toBeHidden();
  await expect(fold).toHaveText('그림 펼치기');
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('scene-line')).toHaveText(line!);
  // 설정에 저장 (선택 필드 sceneFold)
  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY))!) as { data: { sceneFold?: boolean } };
  expect(saved.data.sceneFold).toBe(true);
  expect(await noHorizontalOverflow(page)).toBe(true);
  await page.reload();
  await expect(sceneCard(page)).toHaveAttribute('data-fold', 'true');
  await expect(page.getByTestId('scene-pic')).toBeHidden();
  await page.getByTestId('scene-fold').click();
  await expect(sceneCard(page)).toHaveAttribute('data-fold', 'false');
  await expect(page.getByTestId('scene-pic')).toBeVisible();
  const again = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY))!) as { data: { sceneFold?: boolean } };
  expect('sceneFold' in again.data, '펼치면 필드가 사라진다(접은 적 없는 설정과 같은 모양)').toBe(false);
});

test('펼침 「함께 사는 사람」: 키보드로 열리고(Enter), 그림의 식구와 같은 사람 줄·「가족과 삶 열기」가 나온다', async ({ page }) => {
  await injectSave(page, { ...lifeState(KNOWN_SEED), paused: true }, FAST, MANUAL); // 시간을 멈춘 판 — 세는 동안 해가 바뀌지 않는다
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const more = page.getByTestId('scene-more');
  await expect(more).not.toHaveAttribute('open', '');
  await page.locator('#scene-more > summary').focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('open', '');
  const rows = await page.locator('[data-testid="scene-people"] li').allTextContents();
  expect(rows.some((r) => r.startsWith('나 · '))).toBe(true);
  // 그림의 식구 조각 수(업힌 아기 포함) ≥ 펼침 사람 줄 수(밀린 사람 제외) 중 주인공 + 가족 — 같은 집합
  const pieces = await page.locator('[data-testid="scene-house"] [data-layer="식구"] [data-piece]').count();
  const people = rows.filter((r) => /· \d+세$/.test(r)).length;
  expect(pieces).toBe(people);
  await page.getByTestId('scene-open-family').click();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('family-t');
});

test('해가 바뀌면 그림과 연도 표가 바뀐다: 0세(업힌 아기) → 3세 넘어(유아 조각)로 식구 조각이 바뀌고, 연도 표가 해마다 오르며 인생 기록 연도와 같다', async ({ page }) => {
  await injectSave(page, lifeState(KNOWN_SEED), STEADY, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const first = await page.locator('.scene__year time').getAttribute('datetime');
  const pieceIds = () => page.locator('[data-testid="scene-house"] [data-layer="식구"] [data-piece]').evaluateAll((els) => els.map((e) => e.getAttribute('data-piece')));
  // 나이가 오를 때까지(빠른 시계) 기다린 뒤 멈춘다 — 멈춘 화면에서 읽는다(빠른 시계가 읽는 사이에 해를 넘기지 않게). STEADY(한 해 약 0.3초)라 13세 결정 모달이 「일시정지」를 덮기 전에 누른다
  await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000, intervals: [50] }).toBeGreaterThanOrEqual(4);
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
  await page.waitForTimeout(700); // 교차 페이드가 끝나 겹친 이전 그림이 사라질 때까지
  await expect(page.locator('.scene__year time')).not.toHaveAttribute('datetime', first!);
  const age = Number((await page.getByTestId('life-age').locator('b').textContent())!);
  const yearNow = Number(await page.locator('.scene__year time').getAttribute('datetime'));
  expect(yearNow).toBe(2016 + age); // lifeState의 출생 연도 2016
  // 3세를 넘으면 업힌 아기 조각은 없고 주인공은 유아 이상 조각이다
  expect(age).toBeGreaterThanOrEqual(3);
  expect(await pieceIds()).not.toContain('fig-infant-carried');
  const self = await page.locator('[data-testid="scene-house"] [data-self="true"]').getAttribute('data-piece');
  expect(self).toMatch(/^fig-(toddler|child|teen|young|middle)-m-e3$/);
  // 인생 기록과 모순이 없다: 대체 글의 연도 = 연도 표
  await expect(page.locator('[data-testid="scene-house"] [role="img"]')).toHaveAccessibleName(new RegExp(`^${yearNow}년 `));
});

test('바뀌는 해의 교차 페이드(FH4): 구성이 바뀌는 해에 이전 그림이 잠깐 겹쳐 사라지고(1배속), 움직임 줄이기(prefers-reduced-motion)이면 겹침 없이 즉시 교체된다', async ({ page, browser }) => {
  const watch = async (p: Page): Promise<number> => {
    await p.addInitScript(() => {
      (window as unknown as { __prev: number }).__prev = 0;
      new MutationObserver((muts) => {
        for (const m of muts) m.addedNodes.forEach((n) => {
          if (n instanceof Element && (n.matches('.scene__svg--prev') || n.querySelector('.scene__svg--prev'))) (window as unknown as { __prev: number }).__prev++;
        });
      }).observe(document, { childList: true, subtree: true });
    });
    await injectSave(p, lifeState(KNOWN_SEED), FAST, MANUAL);
    await expect.poll(async () => (await readSave(p)).data.age, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
    await p.waitForTimeout(600);
    return p.evaluate(() => (window as unknown as { __prev: number }).__prev);
  };
  expect(await watch(page), '1배속: 구성이 바뀌는 해에 이전 그림이 겹친다').toBeGreaterThan(0);
  const ctx = await browser.newContext({ viewport: page.viewportSize()!, reducedMotion: 'reduce' });
  const reduced = await ctx.newPage();
  expect(await watch(reduced), '움직임 줄이기: 겹침 없음').toBe(0);
  await ctx.close();
});

test('다크: 토큰이 어두운 값으로 바뀌고 그림 하늘 조각이 그 토큰을 읽으며, 가로 넘침이 없다', async ({ page }) => {
  await injectSave(page, still(), FAST, { ...MANUAL, theme: 'dark' });
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const sky = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-scene-sky').trim());
  expect(sky).toBe('#1e2633');
  const rect = await page.locator('[data-testid="scene-house"] [data-piece^="bg-"] rect').first().evaluate((el) => getComputedStyle(el).fill);
  expect(rect).toBe('rgb(30, 38, 51)'); // #1e2633
  const era = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-era').trim());
  expect(era).toBe('#f5a8d6');
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 라이트도 같은 조각이 라이트 토큰을 읽는다
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  const skyLight = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--c-scene-sky').trim());
  expect(skyLight).toBe('#dfe6ed');
});

test('그림 덩어리(familyArt) 요청이 막혀도 게임은 계속되고 글만 보인다(그림 칸만 빈다): 「다시 불러오기」로 되살아난다 (FH9)', async ({ page }) => {
  await page.route('**/data/familyArt/**', (route) => route.abort());
  await injectSave(page, lifeState(KNOWN_SEED), STEADY, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'failed', { timeout: 15_000 });
  await expect(page.getByTestId('scene-art-failed')).toBeVisible();
  await expect(page.getByTestId('scene-line')).toContainText(/ · (?:단독주택|단독주택 셋방|다가구 단독주택|연립주택|다세대주택|아파트|작은 집|가게 딸린 집|상가주택|넓은 단독주택|요양 시설) · /);
  await expect(page.getByTestId('scene-placeholder')).toBeVisible();
  expect(await page.locator('[data-piece]').count(), '그림 조각 없음').toBe(0);
  // 게임은 계속된다
  const age0 = (await readSave(page)).data.age;
  await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000, intervals: [50] }).toBeGreaterThan(age0);
  // 멈춘다 — 달리는 판에서는 부모님 카드가 끼어 들며 줄이 밀리고(5·7세), 13세에는 결정 모달이 「다시 불러오기」를 덮는다. 「게임은 계속된다」는 위에서 이미 확인했다
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 풀고 다시 불러오기
  await page.unroute('**/data/familyArt/**');
  await page.getByTestId('scene-art-retry').click();
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect(page.getByTestId('scene-art-failed')).toHaveCount(0);
  expect(await page.locator('[data-testid="scene-house"] [data-piece]').count()).toBeGreaterThan(5);
});

test('연타·새로고침 연타에도 그림 덩어리는 한 번만 요청된다(중복 요청 0) — 저장된 판을 새로고침해도 카드가 그림과 함께 복원된다', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    if (/\/data\/familyArt\/index\.ts/.test(r.url())) requests.push(r.url().replace(/\?.*$/, ''));
  });
  await injectSave(page, still(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  expect(requests.length, `그림 덩어리 요청 ${requests.join(', ')}`).toBe(1);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  }
});

/** 문서 순서: 앞 선택자의 요소가 뒤 선택자의 요소보다 앞에 있는가 */
async function before(page: Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(([x, y]) => {
    const ea = document.querySelector(x);
    const eb = document.querySelector(y);
    return ea !== null && eb !== null && (ea.compareDocumentPosition(eb) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }, [a, b]);
}

test('가운데 열 순서(FH1): 결정 카드가 떠 있어도(자동 모드 인라인 · 모달 시트 · 접힌 띠) 결정 카드 → 집과 가족 그림 → 인생 기록 순서가 변하지 않고, 그림이 결정 카드를 밀어내지 않는다', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('[data-testid="start-birth"]') !== null);
  const decision = await findPendingState(page, 'alpha');
  // 자동 모드(인라인 카드): 카드가 그림 위 — 화면 위치도 그렇다
  await injectSave(page, decision, '/', { speed: 1, autoMode: true });
  await expect(page.locator('.decision--inline')).toBeVisible();
  expect(await before(page, '.decision--inline', '[data-testid="family-scene"]')).toBe(true);
  expect(await before(page, '[data-testid="family-scene"]', '[data-testid="log"]')).toBe(true);
  const d = await box(page, '.decision--inline');
  const sc = await box(page, '[data-testid="family-scene"]');
  expect(d.y + d.height, '그림 카드는 결정 카드 아래').toBeLessThanOrEqual(sc.y + 1);
  expect(await noHorizontalOverflow(page)).toBe(true);
  // 접힌 띠
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.locator('.fold')).toBeVisible();
  expect(await before(page, '.fold', '[data-testid="family-scene"]')).toBe(true);
  expect(await before(page, '[data-testid="family-scene"]', '[data-testid="log"]')).toBe(true);
  // 모달 시트(수동 모드): 카드는 그림 위 흐름에 없지만(시트) 그림 → 인생 기록 순서는 그대로
  await injectSave(page, decision, '/', { speed: 1, autoMode: false });
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  expect(await before(page, '[data-testid="family-scene"]', '[data-testid="log"]')).toBe(true);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------------------------------------------------------------- 승인된 시대의 창 그림 (FM5b)

/** 1975년생 X세대 5세 = 1980년의 멈춘 판 — 형진 님이 승인한 시대의 창 그림이 있는 해(금남로). 나이마다 기록 줄 `perAge`개 */
function era1980(perAge = 1): GameState {
  const base = lifeState(KNOWN_SEED);
  const history: GameState['history'] = [{ age: 0, kind: 'stage', text: '1975년 1월, 서울특별시의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.' }];
  for (let a = 0; a <= 5; a++) for (let j = 0; j < perAge; j++) if (!(a === 0 && j === 0)) history.push({ age: a, kind: 'event', text: `${a}세 ${j}번째 일입니다.`, eventId: `e${a}-${j}` });
  return { ...base, generation: 'genx', character: { ...base.character!, birthYear: 1975 }, age: 5, paused: true, history };
}

test('승인된 그림(FM5b): 1980년 무렵 판의 창에 금남로 그림이 오르고, 톤 A 필터(1980년대 세피아 .18)와 색 class 규칙이 실제로 칠해지며, 접근 이름은 문장이다', async ({ page }) => {
  await injectSave(page, era1980(), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-era', 'era-1980-may-geumnam-ro', { timeout: 15_000 });
  await expect(era).toHaveAttribute('data-dec', '1980');
  await expect(era).toHaveAttribute('href', '#log-y1980');
  expect(await page.locator('#scene-era svg rect').count(), '도형이 있다 — 빈 틀이 아니다').toBeGreaterThan(30);
  // 색은 class 규칙이 칠한다: 하늘 면(e-sky)이 토큰 --c-scene-sky(#dfe6ed)다. 칠이 없으면 SVG 기본값(검정)이 된다
  const fill = await page.locator('#scene-era svg .e-sky').first().evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe('rgb(223, 230, 237)');
  // 톤 A: 1980년대 필터(세피아 .18)
  const filter = await page.locator('#scene-era svg').first().evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('sepia(0.18)');
  await expect(era).toHaveAccessibleName(/시대의 창 · 5월, 광주에 민주화 시위가 있었습니다\. 그해 기록으로/);
  const b = (await era.boundingBox())!;
  expect(b.width).toBeGreaterThan(90);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('승인된 그림 · 다크: 같은 그림이 다크 토큰으로 칠해지고 톤 A 필터가 약해진다(세피아 .08)', async ({ page }) => {
  await injectSave(page, era1980(), FAST, { ...MANUAL, theme: 'dark' });
  await expect(page.locator('#scene-era')).toHaveAttribute('data-era', 'era-1980-may-geumnam-ro', { timeout: 15_000 });
  const fill = await page.locator('#scene-era svg .e-sky').first().evaluate((el) => getComputedStyle(el).fill);
  expect(fill).toBe('rgb(30, 38, 51)'); // 다크 --c-scene-sky #1e2633
  const filter = await page.locator('#scene-era svg').first().evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('sepia(0.08)');
});

test('무거운 장면 가리기(FM5b): 꺼짐이면 1980년 금남로 그림과 원문 시대 줄, 켜면 그해 일상 그림으로 바뀌고 시대 줄은 가려진다(펼쳐 보기)', async ({ page }) => {
  await injectSave(page, era1980(), FAST, { ...MANUAL, gentle: false });
  await expect(page.locator('#scene-era')).toHaveAttribute('data-era', 'era-1980-may-geumnam-ro', { timeout: 15_000 });
  const row = page.locator('#log-y1980');
  await expect(row).toContainText('5월, 광주에 민주화 시위가 있었습니다.');
  await expect(row).not.toHaveAttribute('data-veiled', 'true');
  await injectSave(page, era1980(), FAST, { ...MANUAL, gentle: true });
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-kind', 'daily', { timeout: 15_000 });
  await expect(era).toHaveAttribute('data-dec', '1980');
  expect(await era.getAttribute('data-era')).not.toBe('era-1980-may-geumnam-ro');
  expect(await page.locator('#scene-era svg rect').count(), '일상 그림이 오른다').toBeGreaterThan(20);
  const veiled = page.locator('#log-y1980');
  await expect(veiled).toHaveAttribute('data-veiled', 'true');
  await expect(veiled.getByTestId('veil-btn')).toBeVisible();
  await expect(veiled.locator('.veil__body')).toBeHidden(); // 원문은 hidden — 펼치기 전에는 보이지 않는다
});

test('창 → 그해 줄(FM5b): 시대의 창을 누르면 인생 기록의 그해 시대 줄로 가서 초점을 받고 잠깐 강조되며, 주소(#)는 바뀌지 않는다', async ({ page }) => {
  await injectSave(page, era1980(8), FAST, MANUAL);
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-era', 'era-1980-may-geumnam-ro', { timeout: 15_000 });
  await expect(page.locator('#log-y1980')).toHaveCount(1, { timeout: 15_000 });
  const urlBefore = page.url();
  await era.click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('log-y1980');
  await expect(page.locator('#log-y1980')).toHaveAttribute('data-flash', 'true');
  expect(page.url(), '뒤로가기 기록을 더럽히지 않는다').toBe(urlBefore);
  // 강조는 잠깐 뒤에 꺼진다
  await expect(page.locator('#log-y1980')).not.toHaveAttribute('data-flash', 'true', { timeout: 6_000 });
  // 키보드: 창은 초점 정지점 하나이고 Enter로도 같다
  await era.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('log-y1980');
});

test('늦게 온 10년 덩어리(FM5b R-547): 아래에서 지난 기록을 읽는 중에 과거 해의 시대 줄이 한꺼번에 끼어도 읽던 줄이 움직이지 않고, 「새 기록 N개」는 생기지 않는다', async ({ page }) => {
  let release = (): void => undefined;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route(/\/eraWindows\/d19\d0\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await injectSave(page, era1980(9), FAST, MANUAL);
  await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  expect(await page.locator('[data-tl="era"]').count(), '덩어리가 오기 전에는 시대 줄이 없다').toBe(0);
  const list = page.getByTestId('log-list');
  // 맨 아래(오래된 기록)를 읽는 중
  // (.log__list는 scroll-behavior: smooth라 즉시 이동으로 — 미끄러지는 중에 재면 읽던 자리가 흔들린다)
  await list.evaluate((el) => {
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
  });
  await page.waitForTimeout(250);
  // 읽는 줄 = 영역 윗변에 걸친 첫 줄(보정이 붙드는 줄). 그 줄의 글과 윗변에서의 거리를 기억해 두었다가 덩어리가 온 뒤 같은 줄을 찾아 잰다
  const reading = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="log-list"]')!.getBoundingClientRect();
    const row = [...document.querySelectorAll('[data-testid="log-row"]')].find((r) => r.getBoundingClientRect().bottom > box.top + 0.5)!;
    return { text: row.textContent ?? '', top: row.getBoundingClientRect().top - box.top };
  });
  expect(reading.text, '읽는 줄은 기록 줄이다').toMatch(/번째 일입니다|태어났습니다/);
  const topOf = (): Promise<number> =>
    page.evaluate((text) => {
      const row = [...document.querySelectorAll('[data-testid="log-row"]')].find((r) => r.textContent === text);
      const box = document.querySelector('[data-testid="log-list"]')!;
      return row!.getBoundingClientRect().top - box.getBoundingClientRect().top;
    }, reading.text);
  const before = reading.top;
  const scrollBefore = await list.evaluate((el) => el.scrollTop);
  expect(scrollBefore, '아래에서 읽는 중이어야 한다').toBeGreaterThan(24);
  release();
  // SPEC-012 QF3a(사건·일상 모두 나이 규칙, 맞는 장면이 없으면 빈 해): 1980년생 0~9세에게 맞는 시대 줄은 5개 이상이 아니라 2개쯤으로 줄었다(학교·기기·일 장면은 7·13·20세부터) — 「한꺼번에 끼어든다」를 지키는 데는 2개 이상이면 된다
  await expect.poll(() => page.locator('[data-tl="era"]').count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(400);
  const after = await topOf();
  expect(Math.abs(after - before), `읽던 줄이 ${before} → ${after}로 밀렸다`).toBeLessThan(2);
  expect(await list.evaluate((el) => el.scrollTop), '시대 줄이 끼며 스크롤 위치가 보정됐다').toBeGreaterThan(scrollBefore);
  await expect(page.getByTestId('log-jump')).toHaveCount(0);
});

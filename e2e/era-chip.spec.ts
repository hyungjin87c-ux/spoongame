import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, injectSave, lifeState, noHorizontalOverflow, type InjectedSettings } from './helpers';

/**
 * SPEC-010 FU3 「예측」 칩 · 미래 톤 · FU11 예측 근거 보기 (표준 레인, 실제 브라우저 Chromium — desktop 1280×800과 mobile-360 두 프로젝트).
 * 구조·문구·접근 이름은 tests/eraChip.test.tsx(서버 렌더)가 보고, 여기서는 **실제 폭·연속 동작**을 본다:
 *  - 2030년 판(알파 2016년생 14세, 부모 재력 3 = 가운데 구간)의 창에 「예측」 표와 밑그림 톤이 칠해지고, 인생 기록의 2027~2030년 줄에 칩이 있으며 2026년 줄에는 없다.
 *  - 근거 종류 글자를 누르면(마우스·Enter·Space) 근거 칸이 열리고 닫힌다(기본 닫힘, aria-expanded).
 *  - 칩·근거 글자가 넘치지 않는다: 지금 폭 · 다크 · 강제 색상 · 360 · 320 · 글자 200% (펼침 상태 포함).
 */

/** 알파 2016년생 14세 = 2030년의 멈춘 판 (부모 재력 3 → 가운데 구간). 나이마다 기록 줄 하나 */
function y2030(): GameState {
  const base = lifeState(KNOWN_SEED);
  const history: GameState['history'] = [{ age: 0, kind: 'stage', text: '2016년 1월, 서울특별시의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.' }];
  for (let a = 1; a <= 14; a++) history.push({ age: a, kind: 'event', text: `${a}세의 일입니다.`, eventId: `e${a}` });
  return { ...base, age: 14, paused: true, history };
}
const FAST = '/?__timescale=1000';
const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;

async function open(page: Page, settings: Partial<InjectedSettings> = {}): Promise<void> {
  await injectSave(page, y2030(), FAST, { ...MANUAL, ...settings });
  await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect(page.locator('#scene-era')).toHaveAttribute('data-future', 'true', { timeout: 15_000 });
  // 2020년대·2030년대 덩어리가 오면 줄이 선다(2027~2030)
  await expect(page.locator('#log-y2030')).toHaveCount(1, { timeout: 15_000 });
}

const row = (page: Page, year: number): Locator => page.locator(`#log-y${year}`);
/** 안 보이는 가로 넘침까지 잡는다: 요소의 오른쪽 끝이 그 조상(줄 글 칸)의 오른쪽 끝을 넘지 않는다 */
async function insideParent(el: Locator, parentSelector: string): Promise<boolean> {
  return el.evaluate((node, sel) => {
    const parent = node.closest(sel);
    if (parent === null) return false;
    const a = node.getBoundingClientRect();
    const b = parent.getBoundingClientRect();
    return a.left >= b.left - 0.5 && a.right <= b.right + 0.5;
  }, parentSelector);
}

test('창: 2030년 판의 시대의 창에 「예측」 표가 서고 밑그림 톤이 칠해진다 — data-future · data-dec 2030 · 접근 이름 「예측: …」 · 2020년대 톤이 아니다', async ({ page }) => {
  await open(page);
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-dec', '2030');
  await expect(era).toHaveAccessibleName(/^시대의 창 · 예측: .+ 그해 기록으로$/);
  const fc = era.getByTestId('era-fc');
  await expect(fc).toBeVisible();
  await expect(fc).toContainText('예측');
  expect(await fc.locator('svg.icon').count(), '표에 아이콘 #i-ahead').toBe(1);
  expect(await fc.locator('svg.icon use').getAttribute('href')).toBe('#i-ahead');
  // 표는 창 칸 안에 있고 그림 상자 밖의 형제다
  expect(await insideParent(fc, '#scene-era')).toBe(true);
  expect(await fc.evaluate((el) => el.parentElement?.id)).toBe('scene-era');
  // 밑그림: 채도 절반 + 조금 밝게, 표 아이콘에는 걸리지 않는다
  const filter = await era.locator('.era__pic svg').first().evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('saturate(0.5)');
  expect(filter).toContain('contrast(0.92)');
  expect(filter).toContain('brightness(1.06)');
  expect(await fc.locator('svg.icon').evaluate((el) => getComputedStyle(el).filter), '창 표 아이콘은 톤 필터 밖').toBe('none');
  // 표 색: 카드 면 꼬리표 + 오디색 글자 (토큰)
  const style = await fc.evaluate((el) => {
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return { color: cs.color, bg: cs.backgroundColor, era: root.getPropertyValue('--c-era').trim(), surface: root.getPropertyValue('--c-surface').trim() };
  });
  expect(style.color).toBe(await page.evaluate((t) => { const d = document.createElement('i'); d.style.color = t; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, style.era));
  // 휴대폰 띠: 표는 100×80 그림 옆 띠 바탕 위, PC는 그림 왼쪽 위
  const eb = (await era.boundingBox())!;
  const fb = (await fc.boundingBox())!;
  if (page.viewportSize()!.width <= 480) expect(fb.x - eb.x, '휴대폰: 그림(100px) 옆').toBeGreaterThanOrEqual(100);
  else expect(fb.x - eb.x, 'PC: 그림 왼쪽 위').toBeLessThan(16);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('인생 기록: 2027~2030년 시대 줄에는 칩(아이콘 + 「예측」)과 근거 종류 글자가 있고, 2026년 줄에는 없다 — 칩은 해로 정한다', async ({ page }) => {
  await open(page);
  for (const y of [2027, 2028, 2029, 2030]) {
    const r = row(page, y);
    await expect(r.getByTestId('chip-fc'), `${y}`).toBeVisible();
    await expect(r.getByTestId('chip-fc')).toContainText('예측');
    expect(await r.getByTestId('chip-fc').locator('use').getAttribute('href')).toBe('#i-ahead');
    const basis = r.locator('.log__basis');
    await expect(basis, `${y}: 근거 종류 글자`).toBeVisible();
    await expect(basis).toHaveText(/^(공식 전망 바탕|전문가 전망 바탕|가상 시나리오)$/);
    // 칩과 근거 글자는 표지와 같은 flex-wrap 줄(.log__tlrow) 안
    expect(await r.locator('.log__tlrow .chip--fc').count()).toBe(1);
  }
  await expect(row(page, 2026), '2026년은 사실 — 칩 없음').toBeVisible();
  expect(await row(page, 2026).locator('.chip--fc, .log__basis, .log__tlrow').count()).toBe(0);
  // 2027·2030은 근거 글이 있는 가상 시나리오, 2028은 공식 전망 바탕
  await expect(row(page, 2028).locator('.log__basis')).toHaveText('공식 전망 바탕');
  await expect(row(page, 2030).locator('.log__basis')).toHaveText('가상 시나리오');
  // 경제 칸의 「전망」 칩과 다른 모양: 꼬리표(6px)이고 알약(999px)이 아니다
  const radius = await row(page, 2028).getByTestId('chip-fc').evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(radius).toBe('6px');
});

test('근거 보기: 근거 종류 글자를 누르면 칸이 열리고 닫힌다 — 기본 닫힘, 마우스·Enter·Space, aria-expanded·aria-controls, 사람·자료·연도 글이 나온다', async ({ page }) => {
  await open(page);
  const r = row(page, 2028);
  const btn = r.getByTestId('why-btn');
  const body = r.getByTestId('why-body');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('공식 전망 바탕');
  await expect(btn).toHaveAccessibleName('예측, 공식 전망 바탕. 근거 보기');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  expect(await btn.getAttribute('aria-controls')).toBe('why-era-2028');
  await expect(body, '기본 닫힘').toBeHidden();
  // 마우스
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(body).toBeVisible();
  await expect(body).toContainText('이 장면과 관련된 말과 자료입니다.');
  await expect(body).toContainText('통계청, 정부 통계기관, 정책브리핑');
  await expect(body).toContainText('2023년');
  await expect(body).toContainText('조영태, 서울대 보건대학원 교수');
  await expect(body).toContainText('보도 기준'); // 2차 자료 표시
  expect(await body.getByRole('listitem').count(), '근거 두 건').toBe(2);
  expect(await body.innerText(), '인용부호가 없다 (직접 인용 0)').not.toMatch(/[“”"‘’]/);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(body).toBeHidden();
  // 키보드: 초점 → Enter → Space
  await btn.focus();
  await expect(btn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(body).toBeVisible();
  await page.keyboard.press('Space');
  await expect(body).toBeHidden();
  // 열린 채로 다른 줄도 따로 열린다(펼침 상태는 줄마다)
  await btn.click();
  await row(page, 2030).getByTestId('why-btn').click();
  await expect(row(page, 2030).getByTestId('why-body')).toContainText('레이 커즈와일');
  await expect(row(page, 2030).getByTestId('why-body')).toContainText('2047년경');
  await expect(body).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('근거 보기 · 후속 해: 사람·회사 이름은 근거 칸에만 있다 — 시대 줄 문장과 창 이름에는 없다', async ({ page }) => {
  await open(page);
  for (const y of [2027, 2028, 2029, 2030]) {
    const sent = await row(page, y).locator('.log__sent').innerText();
    expect(sent, `${y}`).not.toMatch(/올트먼|커즈와일|통계청|조영태|기상청|비발트|보건복지부|이화여대/);
  }
  const name = await page.locator('#scene-era').getAttribute('title');
  expect(name).not.toMatch(/올트먼|커즈와일|통계청|조영태|기상청|비발트|보건복지부|이화여대/);
});

/** 칩이 넘치지 않는지 한꺼번에 본다: 문서 가로 넘침 0, 2027~2030 줄의 칩·근거 글자·근거 칸이 줄 글 칸 안, 창 표가 창 칸 안 */
async function noChipOverflow(page: Page, label: string): Promise<void> {
  expect(await noHorizontalOverflow(page), `${label}: 문서 가로 넘침`).toBe(true);
  for (const y of [2027, 2028, 2029, 2030]) {
    const r = row(page, y);
    for (const part of ['.chip--fc', '.log__basis', '.log__tl']) {
      const el = r.locator(part).first();
      await el.scrollIntoViewIfNeeded();
      expect(await insideParent(el, '.log__text'), `${label}: ${y} ${part}`).toBe(true);
      const b = (await el.boundingBox())!;
      expect(b.width, `${label}: ${y} ${part} 보인다`).toBeGreaterThan(8);
    }
    const body = r.getByTestId('why-body');
    if (await body.isVisible()) expect(await insideParent(body, '.log__text'), `${label}: ${y} 근거 칸`).toBe(true);
    // 줄 글 칸 자체가 줄(li) 안에 있다
    expect(await insideParent(r.locator('.log__text'), 'li'), `${label}: ${y} 글 칸`).toBe(true);
  }
  const fc = page.locator('#scene-era').getByTestId('era-fc');
  expect(await insideParent(fc, '#scene-era'), `${label}: 창 표`).toBe(true);
}
async function openAllWhy(page: Page): Promise<void> {
  for (const y of [2027, 2028, 2029, 2030]) {
    const btn = row(page, y).getByTestId('why-btn');
    if ((await btn.getAttribute('aria-expanded')) === 'false') await btn.click();
  }
}

test('넘침 0 · 지금 폭과 다크: 칩·근거 글자·근거 칸(펼침)·창 표가 넘치지 않는다', async ({ page }) => {
  await open(page);
  await noChipOverflow(page, '닫힘');
  await openAllWhy(page);
  await noChipOverflow(page, '펼침');
});

test('넘침 0 · 다크: 토큰이 어두운 값으로 바뀌어도 칩이 읽히고 넘치지 않으며, 밑그림 다크 값(채도 .55)이 칠해진다', async ({ page }) => {
  await open(page, { theme: 'dark' });
  const filter = await page.locator('#scene-era .era__pic svg').first().evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('saturate(0.55)');
  expect(filter).toContain('brightness(0.94)');
  expect(filter).not.toContain('contrast');
  // 칩 글자색 = 시대 줄 표지 글자색(--c-era, 다크 값)
  const r = row(page, 2028);
  const colors = await r.evaluate((el) => ({ chip: getComputedStyle(el.querySelector('.chip--fc')!).color, tl: getComputedStyle(el.querySelector('.log__tl')!).color }));
  expect(colors.chip).toBe(colors.tl);
  await openAllWhy(page);
  await noChipOverflow(page, '다크 펼침');
});

test('넘침 0 · 강제 색상: 칩과 창 표가 Canvas/CanvasText로 바뀌어도 글자 「예측」과 아이콘이 남고 테두리가 보이며 넘치지 않는다', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  const r = row(page, 2028);
  const chip = r.getByTestId('chip-fc');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('예측');
  const s = await chip.evaluate((el) => {
    const cs = getComputedStyle(el);
    const icon = el.querySelector('svg')!.getBoundingClientRect();
    return { color: cs.color, border: cs.borderTopColor, borderWidth: cs.borderTopWidth, bg: cs.backgroundColor, iconW: icon.width };
  });
  expect(s.border, '테두리 = 글자색(CanvasText)').toBe(s.color);
  expect(s.borderWidth).toBe('1px');
  expect(s.iconW, '아이콘이 남는다').toBeGreaterThan(8);
  expect(s.bg, '면은 Canvas').not.toBe(s.color);
  const fc = await page.locator('#scene-era').getByTestId('era-fc').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, border: cs.borderTopColor, borderWidth: cs.borderTopWidth, bg: cs.backgroundColor };
  });
  expect(fc.border).toBe(fc.color);
  expect(fc.borderWidth).toBe('1px');
  expect(fc.bg).not.toBe(fc.color);
  // 근거 종류 글자(단추)는 읽히고 눌린다
  await row(page, 2028).getByTestId('why-btn').click();
  await expect(row(page, 2028).getByTestId('why-body')).toBeVisible();
  await noChipOverflow(page, '강제 색상');
});

for (const [w, h] of [[360, 740], [320, 640]] as const) {
  test(`넘침 0 · ${w}px: 칩·근거 글자가 길어지면 줄이 나뉘어도 가로 넘침이 없다 (닫힘·펼침)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await noChipOverflow(page, `${w}px 닫힘`);
    await openAllWhy(page);
    await noChipOverflow(page, `${w}px 펼침`);
    if (w <= 480) {
      const eb = (await page.locator('#scene-era').boundingBox())!;
      const fb = (await page.locator('#scene-era').getByTestId('era-fc').boundingBox())!;
      expect(fb.x - eb.x, '띠: 표는 그림(100px) 옆').toBeGreaterThanOrEqual(100);
      expect(fb.x + fb.width, '띠 안').toBeLessThanOrEqual(eb.x + eb.width + 0.5);
    }
  });
}

for (const [w, h] of [[1280, 800], [360, 740], [320, 640]] as const) {
  test(`넘침 0 · 글자 200% · ${w}px: 칩이 다음 줄로 내려가도 넘침 0이고 근거 글자·칩이 잘리지 않는다 (펼침 포함)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await noChipOverflow(page, `글자 200% ${w}px 닫힘`);
    await openAllWhy(page);
    await noChipOverflow(page, `글자 200% ${w}px 펼침`);
    // 칩 높이가 한 글자 줄 안에서 유지된다(글자가 잘리지 않는다): 칩 안 글자 상자가 칩 상자 안
    const fits = await row(page, 2028).getByTestId('chip-fc').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      const c = el.getBoundingClientRect();
      return t.left >= c.left - 0.5 && t.right <= c.right + 0.5 && t.top >= c.top - 0.5 && t.bottom <= c.bottom + 0.5;
    });
    expect(fits, '칩 글자가 칩 안').toBe(true);
  });
}

test('2026년 판(사실): 창에 「예측」 표도 data-future도 없다 — 칩은 해로 정한다', async ({ page }) => {
  const s = y2030();
  const g = { ...s, age: 10 };
  await injectSave(page, { ...g, history: g.history.filter((h) => h.age <= 10) }, FAST, MANUAL);
  await expect(page.locator('#scene-era')).toHaveAttribute('data-era', /.+/, { timeout: 15_000 });
  await expect(page.locator('#scene-era')).toHaveAttribute('data-dec', '2020');
  expect(await page.locator('#scene-era').getAttribute('data-future')).toBeNull();
  expect(await page.locator('#scene-era [data-testid="era-fc"]').count()).toBe(0);
  await expect(page.locator('#scene-era')).toHaveAccessibleName(/^시대의 창 · (?!예측)/);
});

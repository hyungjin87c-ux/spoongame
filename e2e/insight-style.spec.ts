import { expect, test, type Page } from '@playwright/test';
import { SETTINGS_MANUAL, cardReady, findCardState, openCard } from './m7bStates';

/**
 * 인용 박스의 풀이 문장 (SPEC-005 r4 UX14·QI14 — **형진 님 결정 2026-10-26: 「풀이라고 따로 쓰지 않고 그 문장은 조금 다른 폰트나 색으로 구분만 해줘」**):
 *  ① 화면에 보이는 「풀이」 라벨이 없다. 눈에 안 보이는 접두 「풀이:」(.sr-only)만 스크린리더용으로 있다.
 *  ② 문장은 인용 박스 안 출처 뒤에 오고(`.cite__insight-text`), 요약·출처와 **색과 굵기로** 구분된다 — 글자 크기 14px 그대로, 굵기만 한 단계 위(보통 400 → 굵게 700), 기울임 없음, 새 웹폰트 없음(글꼴 같은 것).
 *     색은 「전망」 칩 글자와 같은 놋쇠 계열 토큰 --c-on-accent-soft이고 인용 박스 면 위에서 라이트·다크 모두 4.5:1 이상이다(렌더된 색으로 잰다; 토큰 쌍은 scripts/checkContrastLib.ts).
 *  ③ 강제 색상에서는 색 차이가 사라지므로 위 간격(8px 띄움)과 굵기로 구분이 남는다.
 */

/** 통계 인용 + 풀이가 있는 본인 결정 카드(수동 모드 시트)를 연다 */
async function openInsightCard(page: Page): Promise<void> {
  await page.goto('/');
  const state = await findCardState(page, 'youth-startup');
  await openCard(page, state, SETTINGS_MANUAL, { hidden: true });
  await cardReady(page);
  await expect(page.getByTestId('cite-insight')).toBeVisible();
}

interface Look {
  sentence: { size: string; weight: number; style: string; family: string; color: string; top: number };
  text: { size: string; weight: number; style: string; family: string; color: string };
  srcBottom: number;
  kindBottom: number;
  textTop: number;
  box: string;
  token: string;
}

/** 문장·요약·출처의 렌더된 모양 (한 번에 읽는다) */
async function look(page: Page): Promise<Look> {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector<HTMLElement>(s)!;
    const sentence = q('.cite__insight-text');
    const text = q('.cite__text');
    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return { size: cs.fontSize, weight: parseInt(cs.fontWeight, 10), style: cs.fontStyle, family: cs.fontFamily, color: cs.color };
    };
    // 토큰 --c-on-accent-soft가 실제로 풀린 색 (임시 요소로 읽는다)
    const probe = document.createElement('span');
    probe.style.color = 'var(--c-on-accent-soft)';
    document.body.appendChild(probe);
    const token = getComputedStyle(probe).color;
    probe.remove();
    return {
      sentence: { ...style(sentence), top: sentence.getBoundingClientRect().top },
      text: style(text),
      srcBottom: q('.cite__src').getBoundingClientRect().bottom,
      kindBottom: q('.cite__kind').getBoundingClientRect().bottom,
      textTop: text.getBoundingClientRect().top,
      box: getComputedStyle(q('.cite')).backgroundColor,
      token,
    };
  });
}

/** WCAG 대비(rgb 문자열 둘) */
function contrast(a: string, b: string): number {
  const rgb = (s: string): number[] => (s.match(/[0-9.]+/g) ?? []).slice(0, 3).map(Number);
  const lum = (c: number[]): number => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const x = lum(rgb(a));
  const y = lum(rgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('화면 글자에 「풀이」 라벨이 0개다 — 눈에 안 보이는 접두 「풀이:」(.sr-only)만 있고, 문장 스타일 클래스는 cite__insight-text다', async ({ page }) => {
  await openInsightCard(page);
  const m = await page.evaluate(() => {
    const cite = document.querySelector<HTMLElement>('[data-testid="cite"]')!;
    // 눈에 보이는 글자: .sr-only 안의 글자는 뺀다
    const walker = document.createTreeWalker(cite, NodeFilter.SHOW_TEXT);
    let visible = '';
    let node = walker.nextNode();
    while (node !== null) {
      if (node.parentElement?.closest('.sr-only') === null) visible += node.textContent ?? '';
      node = walker.nextNode();
    }
    const sr = cite.querySelector<HTMLElement>('.cite__insight-text .sr-only');
    const srBox = sr?.getBoundingClientRect();
    return {
      visible,
      labelNodes: cite.querySelectorAll('.cite__insight-label').length,
      srText: sr?.textContent ?? null,
      srSize: srBox === undefined ? null : [Math.round(srBox.width), Math.round(srBox.height)],
      sentenceClass: cite.querySelector('[data-testid="cite-insight"] > p')?.className ?? null,
      sentence: cite.querySelector('.cite__insight-text')?.textContent ?? '',
    };
  });
  expect(m.labelNodes, '라벨 요소 0개').toBe(0);
  expect(m.visible, '화면에 보이는 인용 박스 글자에 「풀이」가 없다').not.toContain('풀이');
  expect(m.srText, '스크린리더용 접두').toBe('풀이: ');
  expect(m.srSize, '접두는 눈에 안 보이는 크기(1×1px)').toEqual([1, 1]);
  expect(m.sentenceClass, '문장 스타일 클래스').toBe('cite__insight-text');
  expect(m.sentence.length, '접두 + 문장').toBeGreaterThan(10);
});

test('문장은 요약·출처와 색과 굵기로 구분된다: 14px 그대로, 굵게(700 ↔ 400), 기울임 없음, 같은 글꼴, 색은 놋쇠 계열 토큰, 위로 8px 이상 띄운다', async ({ page }) => {
  await openInsightCard(page);
  const l = await look(page);
  expect(l.sentence.size, '글자 크기는 요약과 같은 14px').toBe(l.text.size);
  expect(l.sentence.size).toBe('14px');
  expect(l.text.weight, '요약은 보통 굵기').toBe(400);
  expect(l.sentence.weight, '문장은 굵게').toBe(700);
  expect(l.sentence.style, '기울임 없음(한글 가짜 기울임)').toBe('normal');
  expect(l.sentence.family, '새 웹폰트 없음 — 같은 글꼴').toBe(l.text.family);
  expect(l.sentence.color, '색이 요약과 다르다').not.toBe(l.text.color);
  expect(l.sentence.color, '색은 --c-on-accent-soft(「전망」 칩 글자 토큰)').toBe(l.token);
  const gapToSrc = l.sentence.top - l.srcBottom;
  const gapInside = l.textTop - l.kindBottom; // 박스 안 보통 줄 간격(종류 라벨 → 요약)
  expect(gapToSrc, '요약·출처 묶음과 떨어져 보인다(박스 안 줄 간격보다 크다)').toBeGreaterThan(gapInside + 4);
  expect(gapToSrc, '위로 8px 이상').toBeGreaterThanOrEqual(8);
  expect(gapToSrc, '떨어져 보일 만큼만(과하지 않다)').toBeLessThanOrEqual(20);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: 문장 글자와 인용 박스 면의 대비가 4.5:1 이상이다 (렌더된 색, 요약 글자도 같은 기준)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openInsightCard(page);
    const l = await look(page);
    const sentence = contrast(l.sentence.color, l.box);
    const text = contrast(l.text.color, l.box);
    expect(sentence, `${scheme} 문장 ${l.sentence.color} / 면 ${l.box}`).toBeGreaterThanOrEqual(4.5);
    expect(text, `${scheme} 요약 ${l.text.color} / 면 ${l.box}`).toBeGreaterThanOrEqual(4.5);
    // 색이 눈에 띄게 다르다(같은 색에 굵기만 다른 것이 아니다)
    expect(l.sentence.color).not.toBe(l.text.color);
  });
}

test('강제 색상: 색 차이는 사라져도 굵기(700 ↔ 400)와 위 간격이 구분을 남긴다', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openInsightCard(page);
  const l = await look(page);
  expect(l.sentence.weight, '문장은 여전히 굵게').toBeGreaterThan(l.text.weight);
  expect(l.sentence.top - l.srcBottom, '위 간격이 그대로 남는다').toBeGreaterThanOrEqual(8);
  expect(l.sentence.color, '강제 색상에서는 글자색이 시스템 색 하나로 모인다(색으로 구분하지 않는다)').toBe(l.text.color);
});

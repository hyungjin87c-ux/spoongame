import { expect, test } from '@playwright/test';
import { measureLineBreaks } from './lineBreaks';
import { setRootFontPercent } from './textResize';

/**
 * 줄바꿈·링크 밑줄 보완 (REV-003-M2-3 R-236·R-237, SPEC-003 QM2-10 a 측정기 점검).
 *  · 측정기 점검: 줄 첫머리의 쉼표·마침표·구분 기호·닫는 괄호와 줄 끝의 구분 기호·여는 괄호를 e2e/lineBreaks.ts가 실제로 잡는다(잡지 못하면 감사가 공허하다).
 *  · R-236: 푸터 출처 링크 안의 줄바꿈 묶음(inline-block `.keep-phrase`)에는 링크의 밑줄이 전파되지 않아 일부만 밑줄이 끊겼다 — 링크 색이 글자색 그대로(inherit)라 밑줄이 유일한 링크 표시다.
 *    묶음이 링크와 같은 text-decoration을 상속해 자기 글자에 밑줄을 긋는다. 이전 구현(규칙 없음)에서는 묶음의 text-decoration-line이 none이라 이 단언이 실패한다.
 *  · R-237: 한 줄 설명의 「한 번의」는 글자 200%에서도 갈라지지 않는다(이전에는 「한국인의 한 / 번의 인생」).
 */

test('줄바꿈 측정기 점검: 줄 첫머리의 쉼표·마침표·가운뎃점·닫는 괄호와 줄 끝의 여는 괄호·줄표를 실제로 잡고, 정상 글은 잡지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '브라우저 한 곳에서만 실행');
  // 폭 2ch, 어디서나 줄을 바꿀 수 있게(line-break: anywhere) 해 문장부호가 줄 첫머리에 오는 상황을 일부러 만든다
  const box = (id: string, text: string) => `<div id="${id}" style="width:2ch;font:16px monospace;word-break:break-all;line-break:anywhere">${text}</div>`;
  await page.setContent(
    `<!doctype html><meta charset="utf-8">${box('comma', 'ab,c')}${box('period', 'ab.c')}${box('dot', 'ab·c')}${box('close', 'ab)c')}${box('slash', 'ab/c')}${box('open', 'a(bc')}${box('dash', 'a—bc')}` +
      `<div id="ok" style="width:40ch;font:16px monospace">ab, cd. ef · gh (ij) 240,326 건</div>`,
  );
  for (const [id, mark, where] of [
    ['comma', ',', '첫머리'],
    ['period', '.', '첫머리'],
    ['dot', '·', '첫머리'],
    ['close', ')', '첫머리'],
    ['slash', '/', '첫머리'],
    ['open', '(', '끝'],
    ['dash', '—', '끝'],
  ] as const) {
    const r = await measureLineBreaks(page, `#${id}`, { keeps: false });
    expect(r.violations.join(' | '), `${id}: 줄 ${where}의 「${mark}」`).toContain(`줄 ${where}에 「${mark}」`);
  }
  const ok = await measureLineBreaks(page, '#ok');
  expect(ok.lineCount, '정상 글은 한 줄').toBe(1);
  expect(ok.violations).toEqual([]);
});

for (const [width, height] of [
  [360, 740],
  [320, 568],
] as const) {
  test(`${width}x${height} 글자 200%: 푸터 링크 안의 줄바꿈 묶음(inline-block)도 링크의 밑줄(선 종류·색)을 상속해 밑줄이 끊기지 않는다 (R-236)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await setRootFontPercent(page, 200);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('.title-page a[href]')].map((a) => {
        const line = (el: Element) => {
          const cs = getComputedStyle(el);
          return { line: cs.textDecorationLine, color: cs.textDecorationColor, style: cs.textDecorationStyle };
        };
        const blocks = [...a.querySelectorAll('*')].filter((e) => getComputedStyle(e).display === 'inline-block');
        return { testId: a.closest('[data-testid]')?.getAttribute('data-testid') ?? '', link: line(a), blocks: blocks.map((b) => ({ text: (b.textContent ?? '').slice(0, 20), ...line(b) })) };
      }),
    );
    const credit = links.find((l) => l.testId === 'names-credit')!;
    expect(credit, '푸터 출처 링크').toBeDefined();
    expect(credit.link.line, '링크 자신은 밑줄').toContain('underline');
    expect(credit.blocks.length, '링크 안의 줄바꿈 묶음(공허 통과 방지)').toBeGreaterThanOrEqual(1);
    const problems: string[] = [];
    for (const l of links) {
      for (const b of l.blocks) {
        if (!b.line.includes('underline')) problems.push(`${l.testId} 「${b.text}」: 묶음의 text-decoration-line이 ${b.line}(링크 ${l.link.line})`);
        if (b.color !== l.link.color) problems.push(`${l.testId} 「${b.text}」: 밑줄 색 ${b.color} ≠ 링크 ${l.link.color}`);
        if (b.style !== l.link.style) problems.push(`${l.testId} 「${b.text}」: 밑줄 모양 ${b.style} ≠ 링크 ${l.link.style}`);
      }
    }
    expect(problems).toEqual([]);
  });
}

for (const [width, height] of [
  [360, 740],
  [320, 568],
] as const) {
  for (const percent of [100, 150, 200] as const) {
    test(`${width}x${height} 글자 ${percent}%: 한 줄 설명의 「한 번의」는 두 줄로 갈라지지 않는다 (R-237)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.getByTestId('start-birth')).toBeEnabled();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const r = await measureLineBreaks(page, '.hero__tag', { separators: true, keeps: true, keepWords: ['한 번의'] });
      expect(r.keepChecked, '「한 번의」를 실제로 잰 개수').toBeGreaterThanOrEqual(1);
      expect(r.violations).toEqual([]);
      if (percent === 200 && width === 360) await page.getByTestId('title-screen').locator('.hero__tag').screenshot({ path: 'qa/screenshots/003/dev-M2-r5-r237-hero-tag-360x740-200pct.png' });
    });
  }
}

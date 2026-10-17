import { expect, test, type Page } from '@playwright/test';
import { describeWordBreak, measureWordBreaks } from './lineBreaks';
import { openM4Screen, type M4Screen } from './m4States';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 새 화면 제목(h1)의 글자 크기 상한 (SPEC-003 QM3-2, 완료 기준 17 ②, R-321 / REV-003-M4-1). 룰렛·출생신고는 e2e/m3-title-cap.spec.ts가 보고, 여기서는 M4의 네 가지 제목을 같은 기준으로 잰다:
 *   대시보드 이름(h1) · 엔딩 「{이름}의 인생」 · 밀린 화면 메시지 · 오류 화면 메시지.
 * 새 화면의 제목 낱말은 **어떤 조합에서도 중간에서 끊기지 않는다** — QM3-1의 허용(한 줄보다 긴 낱말·`<wbr>`)을 제목에는 쓰지 않는다(e2e/m4-breaks.spec.ts는 150·200%의 `unavoidable`을 허용하지만 제목에는 금지다).
 * 조합 = `STANDARD_VIEWPORTS` 11종 × 글자 100·125·150·175·200%: 제목의 낱말마다 (1) 한 줄에 놓인다(글자 하나씩 `Range`로 잰 줄 수 1) (2) 자연 폭 ≤ 제목 내용 폭이고 ≤ 제목을 담은 줄 폭(컨테이너 내용 폭 —
 * 줄 안에서 줄어드는 flex 제목은 자기 상자만 보면 늘 통과하므로 담는 상자도 본다) (3) 제목의 계산 글자 크기 ≥ 같은 화면 본문의 계산 글자 크기.
 * 끝의 시험들은 상한을 빼면(이전 구현) 같은 조합에서 낱말이 갈라지는 것을 확인한다(시험이 실제로 잡는다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const PERCENTS = [100, 125, 150, 175, 200] as const;

interface HeadingWord {
  word: string;
  /** 글자 하나씩 잰 줄 수 */
  lines: number;
  /** 글자 상자 폭의 합 */
  natural: number;
}

interface HeadingReport {
  words: HeadingWord[];
  /** 제목 내용 폭 */
  contentWidth: number;
  /** 제목을 담은 줄 폭(컨테이너 내용 폭) */
  lineWidth: number;
  /** 제목·본문 요소의 계산 글자 크기(px) */
  fontPx: number;
  bodyPx: number;
}

/** 제목의 눈에 보이는 낱말을 잰다. 글자 크기를 바꾼 직후 같은 호출 안에서 읽어도 레이아웃이 최신이다 */
async function measureHeading(page: Page, headingSelector: string, bodySelector: string, containerSelector: string): Promise<HeadingReport> {
  return page.evaluate(
    ([h, b, c]) => {
      const heading = document.querySelector(h);
      const body = document.querySelector(b);
      const container = document.querySelector(c);
      if (heading === null || body === null || container === null) throw new Error(`제목·본문·컨테이너를 찾지 못했다: ${h} / ${b} / ${c}`);
      const cs = getComputedStyle(heading);
      const contentWidth = heading.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const ccs = getComputedStyle(container);
      const lineWidth = container.getBoundingClientRect().width - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight) - parseFloat(ccs.borderLeftWidth) - parseFloat(ccs.borderRightWidth);
      const words: Array<{ word: string; lines: number; natural: number }> = [];
      const range = document.createRange();
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode() as Text | null; node !== null; node = walker.nextNode() as Text | null) {
        const parent = node.parentElement;
        if (parent === null || parent.closest('.sr-only') !== null) continue;
        for (const m of node.data.matchAll(/\S+/g)) {
          const start = m.index ?? 0;
          const rects: DOMRect[] = [];
          for (let i = 0; i < m[0].length; i++) {
            range.setStart(node, start + i);
            range.setEnd(node, start + i + 1);
            const r = range.getClientRects()[0];
            if (r !== undefined && r.width > 0) rects.push(r);
          }
          let lines = rects.length === 0 ? 0 : 1;
          for (let i = 1; i < rects.length; i++) {
            const a = rects[i - 1];
            const d = rects[i];
            if (Math.min(a.bottom, d.bottom) - Math.max(a.top, d.top) < 0.5 * Math.min(a.height, d.height)) lines++;
          }
          words.push({ word: m[0], lines, natural: rects.reduce((sum, r) => sum + r.width, 0) });
        }
      }
      return { words, contentWidth, lineWidth, fontPx: parseFloat(cs.fontSize), bodyPx: parseFloat(getComputedStyle(body).fontSize) };
    },
    [headingSelector, bodySelector, containerSelector] as const,
  );
}

async function setRootPercentSync(page: Page, percent: number): Promise<void> {
  await page.evaluate((p) => {
    document.documentElement.style.fontSize = `${p}%`;
  }, percent);
}

interface TitleSpec {
  id: string;
  screen: M4Screen;
  heading: string;
  /** 같은 화면의 본문 요소 — 제목 ≥ 본문 */
  body: string;
  /** 제목을 담은 줄(내용 폭으로 잰다) */
  container: string;
  /** 제목의 낱말 수와 가장 긴 낱말(공허 통과 방지). 이름·문구는 시드마다 다르므로 낱말 수만 본다 */
  wordCount: number;
}

const TITLES: readonly TitleSpec[] = [
  { id: 'dash', screen: 'dash-adult', heading: '[data-testid="life-name"]', body: '[data-testid="log-row"] .log__text', container: '[data-testid="dash-head"] .dash-head__inner', wordCount: 1 },
  { id: 'ending', screen: 'ending', heading: '[data-testid="ending-name"]', body: '[data-testid="ending-death"]', container: '.ending__who', wordCount: 2 },
  { id: 'superseded', screen: 'superseded', heading: '[data-testid="superseded-text"]', body: '[data-testid="superseded-screen"] section.card > p', container: '[data-testid="superseded-screen"] section.card', wordCount: 6 },
  { id: 'error', screen: 'error', heading: '[data-testid="error-screen"] h1', body: '[data-testid="error-screen"] .btn', container: '[data-testid="error-screen"] section.card', wordCount: 6 },
];

/** 한 화면·글자 크기의 제목이 규칙을 지키는지: 위반 목록 */
async function titleProblems(page: Page, spec: TitleSpec, label: string): Promise<string[]> {
  const r = await measureHeading(page, spec.heading, spec.body, spec.container);
  const problems: string[] = [];
  if (r.words.length !== spec.wordCount) problems.push(`${label}: 제목 낱말 ${r.words.length}개 (기대 ${spec.wordCount}) — 공허 통과 방지: ${r.words.map((w) => w.word).join(' ')}`);
  for (const w of r.words) {
    if (w.lines !== 1) problems.push(`${label}: 「${w.word}」가 ${w.lines}줄에 걸쳐 끊겼다 (자연 폭 ${w.natural.toFixed(0)}px, 제목 내용 폭 ${r.contentWidth.toFixed(0)}px, 줄 폭 ${r.lineWidth.toFixed(0)}px, 글자 ${r.fontPx.toFixed(1)}px)`);
    if (w.natural > r.contentWidth + 0.5) problems.push(`${label}: 「${w.word}」 자연 폭 ${w.natural.toFixed(0)}px > 제목 내용 폭 ${r.contentWidth.toFixed(0)}px`);
    if (w.natural > r.lineWidth + 0.5) problems.push(`${label}: 「${w.word}」 자연 폭 ${w.natural.toFixed(0)}px > 제목을 담은 줄 폭 ${r.lineWidth.toFixed(0)}px`);
  }
  if (r.fontPx + 0.01 < r.bodyPx) problems.push(`${label}: 제목 글자 ${r.fontPx.toFixed(1)}px < 본문 ${r.bodyPx.toFixed(1)}px`);
  return problems;
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`새 화면 제목 글자 크기 상한 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    test(`${vp.name} · 글자 100·125·150·175·200% · 대시보드 이름·엔딩·밀린 화면·오류 화면: 제목의 낱말이 한 줄에 놓이고 자연 폭 ≤ 제목 내용 폭·줄 폭이며 제목 글자 ≥ 본문 (QM3-2)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(180_000);
      const problems: string[] = [];
      for (const spec of TITLES) {
        await openM4Screen(page, spec.screen);
        for (const percent of PERCENTS) {
          await setRootPercentSync(page, percent);
          const label = `${vp.name}/${percent}%/${spec.id}`;
          problems.push(...(await titleProblems(page, spec, label)));
          // 제목은 QM3-1의 허용(한 줄보다 긴 낱말·<wbr>)을 쓰지 않는다 — 낱말 끊김 감사기에서도 끊김·불가피·의도·강제 모두 0
          const wb = await measureWordBreaks(page, { scope: spec.heading });
          for (const rec of [...wb.broken, ...wb.unavoidable, ...wb.intended, ...wb.forced]) problems.push(`${label}: 제목 낱말 끊김 ${describeWordBreak(rec)}`);
          expect(wb.checked, `${label}: 감사기가 제목의 낱말을 실제로 쟀다`).toBe(spec.wordCount);
        }
      }
      expect(problems).toEqual([]);
    });
  });
}

// ---------- 이전 구현 대조 ----------
// 상한을 빼면(제목을 상한 없는 기본 크기로 되돌리면) 폭 320 · 글자 200%에서 밀린·오류 화면 메시지가 낱말 중간에서 갈라진다 — 시험이 실제로 잡는다.
// 엔딩은 이름이 3글자라 기본 크기에서도 들어가므로, 이름이 길어진 경우(데이터에 없어도 코드가 지켜야 하는 경우)를 DOM에서 만들어 대조한다.

test.describe('이전 구현 대조 320x568 · 글자 200%', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('밀린 화면: 상한이 있으면 위반이 없고, 상한을 빼면(기본 --fs-xl) 가장 긴 낱말 「바뀌었습니다.」(7글자)가 한 줄에 못 들어가 갈라진다 (M3-L02와 같은 결함)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    const spec = TITLES.find((t) => t.id === 'superseded')!;
    await openM4Screen(page, spec.screen);
    await setRootPercentSync(page, 200);
    expect(await titleProblems(page, spec, 'superseded/200%'), '상한이 있으면 위반 없음').toEqual([]);
    await page.addStyleTag({ content: '.system h1 { font-size: var(--fs-xl) !important; }' });
    const before = await measureHeading(page, spec.heading, spec.body, spec.container);
    const longest = [...before.words].sort((a, b) => b.word.length - a.word.length)[0];
    expect(longest.word).toBe('바뀌었습니다.');
    expect(longest.lines, `상한을 빼면 「${longest.word}」가 한 줄에 못 들어간다 (자연 폭 ${longest.natural.toFixed(0)}px > 줄 폭 ${before.lineWidth.toFixed(0)}px)`).toBeGreaterThan(1);
    expect((await titleProblems(page, spec, 'superseded/200%')).length, '이전 구현은 위반이 난다').toBeGreaterThan(0);
  });

  test('엔딩: 이름이 길어져도(여섯 글자) 상한이 칸 수를 따라가 한 줄에 놓인다. 상한을 빼면 같은 이름에서 갈라진다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    const spec = TITLES.find((t) => t.id === 'ending')!;
    await openM4Screen(page, 'ending');
    // 제목 문구와 칸 수(--title-chars = 가장 긴 낱말 + 1)를 함께 바꾼다 — 앱이 하는 계산과 같다(data/dashText.ts#titleCharsFor)
    const longTitle = '남궁민수정하의 인생'; // 「남궁민수정하의」 7글자 → 칸 수 8
    await page.evaluate((t) => {
      const h1 = document.querySelector('[data-testid="ending-name"]') as HTMLElement;
      h1.textContent = t;
      h1.style.setProperty('--title-chars', String([...t.split(' ')[0]].length + 1));
    }, longTitle);
    await setRootPercentSync(page, 200);
    const ok = await measureHeading(page, spec.heading, spec.body, spec.container);
    expect(ok.words.map((w) => w.word)).toEqual(['남궁민수정하의', '인생']);
    for (const w of ok.words) {
      expect(w.lines, `상한이 있으면 「${w.word}」가 한 줄 (글자 ${ok.fontPx.toFixed(1)}px)`).toBe(1);
      expect(w.natural).toBeLessThanOrEqual(ok.lineWidth + 0.5);
    }
    expect(ok.fontPx, '제목이 본문보다 작아지지 않는다').toBeGreaterThanOrEqual(ok.bodyPx);
    await page.addStyleTag({ content: '.ending__who .t-title { font-size: var(--fs-2xl) !important; }' });
    const before = await measureHeading(page, spec.heading, spec.body, spec.container);
    expect(before.words[0].lines, `상한을 빼면 「${before.words[0].word}」가 갈라진다 (자연 폭 ${before.words[0].natural.toFixed(0)}px > 줄 폭 ${before.lineWidth.toFixed(0)}px)`).toBeGreaterThan(1);
  });
});

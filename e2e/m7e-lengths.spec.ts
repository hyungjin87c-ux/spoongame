import { expect, test, type Page } from '@playwright/test';
import { TEXT_LIMITS } from '../src/core/eventLint';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { LENGTH_SAMPLE_IDS, lengthSample, type LengthSample } from './lengthSamples';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 합쇼체 새 길이 한도(SPEC-003 M7e-1: 본문 74 · 결과 84 · 한 문장 52, 제목 16 · 라벨 24는 그대로)가 화면에 들어가는지 — 결정 카드와 인생 기록 (CM11 · QM3-1 감사 기준).
 * 개발 서버 전용 하니스(harness/layout.html — 실제 LifeScreen·실제 CSS)에 가장 긴 문장으로 만든 표본(e2e/lengthSamples.ts)을 보이고 잰다.
 *  - 표본 worst: 제목·본문·라벨·결과가 정확히 한도 끝값인 덩어리 글(줄바꿈 낭비 최악). 표본 natural: 실제 한국어 합쇼체 문장(긴 낱말).
 *  - 결정 카드: 선택지 3개(제목 16 · 본문 74 · 라벨 24자). 인생 기록: 사건 줄(본문 74자)과 선택 결과 줄(결과 84자 + 선택한 길 라벨 24자)이 네 줄.
 * 조합: 폭·높이 320×568 · 360×740 × 글자 100·150·200%. 단언은 CM11과 같다 —
 *  (가) 가로 넘침 0px · 화면 밖 요소 0 · 글자 잘림 0 (e2e/textResize.ts)
 *  (나) 끊긴 낱말(결함) 0, 100%에서는 한 줄보다 긴 낱말 0, 의도한 끊김은 `<wbr>` 목록뿐 (e2e/lineBreaks.ts#measureWordBreaks, QM3-1)
 *  (다) 구분 기호가 줄 끝·첫머리에 혼자 남는 줄 0 (QM2-10)
 *  (라) 선택지 3개가 스크롤로 닿고 가려지지 않으며, 인생 기록은 영역 안에서 맨 아래까지 스크롤하면 마지막 줄이 온전히 보인다
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [100, 150, 200] as const;
const SHOTS = 'qa/screenshots/003';
const SCOPE = '[data-testid="life-screen"]';
/** 하니스가 기본으로 두는 인생 기록 줄 수(출생·스무 살·사건·선택 — harness/layout.tsx#stateFor) */
const HARNESS_BASE_ROWS = 4;

/** 하니스를 열고 표본을 보인다 (두 프레임 기다려 레이아웃이 자리 잡게 한다) */
async function showSample(page: Page, size: { width: number; height: number }, sample: LengthSample): Promise<void> {
  await page.setViewportSize(size);
  await page.goto('/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
  await page.evaluate(
    async ({ event, history }) => {
      const w = window as unknown as { __layout: { showCustom: (ev: unknown, history?: unknown) => void } };
      w.__layout.showCustom(event, history);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    },
    { event: sample.event, history: sample.history },
  );
  await expect(page.getByTestId('choice-panel')).toBeVisible();
}

test('표본 대조: 표본의 글자 수가 한도와 맞다 (worst는 정확히 한도, natural은 한도 이하·한 문장도 한도 이하)', () => {
  const worst = lengthSample('worst');
  expect(worst.event.title.length).toBe(TEXT_LIMITS.title);
  expect(worst.event.text.length).toBe(TEXT_LIMITS.text);
  for (const c of worst.event.choices!) {
    expect(c.label.length).toBe(TEXT_LIMITS.label);
    expect(c.result.length).toBe(TEXT_LIMITS.result);
  }
  const natural = lengthSample('natural');
  expect(natural.event.title.length).toBeLessThanOrEqual(TEXT_LIMITS.title);
  expect(natural.event.text.length).toBe(TEXT_LIMITS.text);
  expect(natural.event.choices!.map((c) => c.label.length).every((n) => n <= TEXT_LIMITS.label && n >= TEXT_LIMITS.label - 3)).toBe(true);
  expect(natural.event.choices![0].result.length).toBe(TEXT_LIMITS.result);
  for (const s of [worst, natural]) expect(s.longestSentence).toBeLessThanOrEqual(TEXT_LIMITS.sentence);
});

for (const size of SIZES) {
  for (const percent of PERCENTS) {
    for (const id of LENGTH_SAMPLE_IDS) {
      test(`${size.width}x${size.height} · 글자 ${percent}% · 표본 ${id}: 결정 카드와 인생 기록이 넘치지 않는다 — 가로 넘침 0px·글자 잘림 0·끊긴 낱말 0·구분 기호 혼자 남는 줄 0·선택지와 기록 끝에 닿는다`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(60_000);
        const sample = lengthSample(id);
        const label = `${size.width}x${size.height}/${percent}%/${id}`;
        await showSample(page, size, sample);
        if (percent !== 100) await setRootFontPercent(page, percent);

        // (가) 가로 넘침·글자 잘림
        const m = await measureTextResize(page);
        expect(textResizeViolations(m, label), `루트 글자 ${m.rootFontPx}px`).toEqual([]);

        // 표본이 실제로 화면에 있다 (공허 통과 방지): 결정 카드 본문과 인생 기록의 표본 줄
        await expect(page.getByTestId('choice-panel')).toContainText(sample.event.text.slice(0, 20));
        const rows = page.getByTestId('log-row');
        await expect(rows).toHaveCount(HARNESS_BASE_ROWS + sample.history.length);
        const logText = await page.getByTestId('log-list').innerText();
        expect(logText).toContain(sample.event.text.slice(0, 20));
        expect(logText).toContain(sample.event.choices![0].result.slice(0, 20));
        expect(logText).toContain(sample.event.choices![0].label.slice(0, 10));

        // (나) 낱말 끊김
        const words = await measureWordBreaks(page, { scope: SCOPE });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(80);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `글자 100%인 ${size.width}px에서는 한 줄보다 긴 낱말로 끊기는 곳도 0`).toEqual([]);
        for (const i of words.intended) expect(INTENDED_BREAK_WORDS, `의도 목록 밖 낱말이 intended로 셈: ${describeWordBreak(i)}`).toContain(i.word);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') });

        // (다) 구분 기호
        const lines = await measureLineBreaks(page, SCOPE, { separators: true, keeps: true });
        expect(lines.violations).toEqual([]);

        // (라) 선택지 3개에 스크롤로 닿고(가려지지 않는다), 인생 기록은 영역 안에서 맨 아래까지 스크롤하면 마지막 줄 끝이 온전히 보인다
        const reach = await page.evaluate(() => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const covered = (el: Element) => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 24));
            return !(hit === el || el.contains(hit));
          };
          const buttons = [...document.querySelectorAll('[data-testid="choice-panel"] button.choice')].map((el) => {
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            return { name: (el.textContent ?? '').trim().slice(0, 16), inside: r.left >= 0 && r.right <= vw, onScreen: r.bottom > 0 && r.top < vh, covered: covered(el) };
          });
          const list = document.querySelector('[data-testid="log-list"]') as HTMLElement;
          const rowsEl = [...document.querySelectorAll('[data-testid="log-row"]')];
          list.scrollTop = list.scrollHeight;
          const lr = list.getBoundingClientRect();
          const last = rowsEl[rowsEl.length - 1].getBoundingClientRect();
          const textEl = rowsEl[rowsEl.length - 1].querySelector('.log__text') as HTMLElement;
          return {
            buttons,
            log: {
              lastBottomInside: last.bottom <= lr.bottom + 1,
              lastHorizontallyInside: last.left >= lr.left - 0.5 && last.right <= lr.right + 0.5,
              textHorizontallyInside: textEl.getBoundingClientRect().right <= lr.right + 0.5,
              scrollable: list.scrollHeight > list.clientHeight,
              listWidth: Math.round(lr.width),
              listHeight: Math.round(lr.height),
            },
          };
        });
        expect(reach.buttons).toHaveLength(3);
        for (const r of reach.buttons) {
          expect(r.inside, `${label}: ${r.name}이(가) 가로로 화면 밖에 있다`).toBe(true);
          expect(r.onScreen, `${label}: ${r.name}에 스크롤로 닿지 않는다`).toBe(true);
          expect(r.covered, `${label}: ${r.name}이(가) 고정 머리·진행 줄에 가려진다`).toBe(false);
        }
        expect(reach.log.lastBottomInside, `${label}: 인생 기록 맨 아래로 스크롤해도 마지막 줄 끝이 영역 밖이다 (${JSON.stringify(reach.log)})`).toBe(true);
        expect(reach.log.lastHorizontallyInside, `${label}: 마지막 인생 기록 줄이 영역 밖으로 넘친다`).toBe(true);
        expect(reach.log.textHorizontallyInside, `${label}: 마지막 인생 기록 줄의 글이 영역 밖으로 넘친다`).toBe(true);

        // 증거 스크린샷: 가장 좁은 폭 · 가장 큰 글자 — 결정 카드 전체와 인생 기록 카드 전체(요소 스크린샷이라 화면보다 길어도 처음부터 끝까지 담긴다)
        if (size.width === 320 && percent === 200) {
          await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/dev-M7e-1-320x568-200pct-${id}-card.png` });
          // 인생 기록은 영역 안에서 스크롤되므로, 증거에는 모든 줄이 한 번에 보이게 영역 높이 제한을 풀고 찍는다(측정이 모두 끝난 뒤라 단언에 영향이 없다)
          await page.addStyleTag({ content: '.log__list { max-height: none !important; overflow: visible !important; }' });
          await page.getByTestId('log').screenshot({ path: `${SHOTS}/dev-M7e-1-320x568-200pct-${id}-log.png` });
        }
        testInfo.annotations.push({ type: '측정', description: `${label}: 낱말 ${words.checked}개, 끊김(결함) ${words.broken.length}, 한 줄보다 긴 낱말 ${words.unavoidable.length}, 문서 높이 ${await page.evaluate(() => document.documentElement.scrollHeight)}px` });
      });
    }
  }
}

test('측정기 대조: 표본의 인생 기록 줄 글칸을 좁히면(overflow-wrap: anywhere) 끊긴 낱말이 잡힌다 — 이 감사가 공허하게 통과하지 않는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(60_000);
  const sample = lengthSample('natural');
  await showSample(page, SIZES[0], sample);
  const before = await measureWordBreaks(page, { scope: SCOPE });
  expect(before.broken, '덮어쓰기 전에는 끊긴 낱말이 없다').toEqual([]);
  await page.addStyleTag({ content: '.log__row { flex-wrap: nowrap !important; } .log__text { flex: 0 0 3.2rem !important; min-width: 0 !important; overflow-wrap: anywhere !important; word-break: break-all !important; }' });
  const after = await measureWordBreaks(page, { scope: SCOPE });
  expect(after.broken.length + after.unavoidable.length, '일부러 만든 끊김이 잡힌다').toBeGreaterThan(0);
});

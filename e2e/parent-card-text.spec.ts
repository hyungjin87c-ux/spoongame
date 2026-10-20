import { expect, test, type Page } from '@playwright/test';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { evalCore } from './helpers';
import { findDelegatedYear, showParentCard, type Era } from './parentStates';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 부모님이 정한·아이의 일로 흘러간 카드의 글자 (SPEC-005 QI5 PD5·PD8, CM11·QM3-1): 이 카드에는 선택지 버튼이 없는 대신 영향 줄·도장·인용 박스·안내 한 줄이 있다 — 카드가 가장 긴 모습이 되는 조합
 * (제목 + 상황 + 고른 길 + 결과 문장 + 인용 요약 + 출처가 가장 긴 카드, 첫 부모 카드의 안내 한 줄 포함)을 320×568·360×740 × 글자 100·150·200%에서 재고
 * (가로 넘침 0px·글자 잘림 0·끊긴 낱말(결함) 0·구분 기호 혼자 남는 줄 0), 사람이 고르는 카드의 같은 감사(`m7b-text-resize`·`m7b-word-breaks`·`m7b-line-breaks`)와 같은 기준이다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다. 카드는 일시정지로 붙잡아 잰다(`showParentCard`).
 */

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [100, 150, 200] as const;

interface LongDelegated {
  id: string;
  era: Era;
  by: 'parent' | 'child';
  /** 그 카드에서 라벨 + 결과 문장이 가장 긴 길 */
  chosen: string;
  total: number;
}

/** 부모님이 정하거나 흘러가는 나이가 있는 카드 가운데 글이 가장 긴 n개 (제목 + 상황 + 가장 긴 길의 라벨 + 결과 + 인용 요약 + 출처 줄) */
async function longestDelegated(page: Page, n: number): Promise<LongDelegated[]> {
  return evalCore<LongDelegated[]>(
    page,
    `const data = await import('/src/data/events/index.ts');
     const best = new Map();
     for (const ev of data.EVENT_POOL.events) {
       if (ev.choices === undefined) continue;
       const ages = core.possibleAgesOf(ev);
       const who = ages.map((a) => core.decisionFor(ev.id, a)).find((w) => w !== 'self');
       if (who === undefined) continue;
       for (const era of ['past', 'present', 'future']) {
         if (ev.eras !== undefined && !ev.eras.includes(era)) continue;
         const age = ages.find((a) => core.decisionFor(ev.id, a) !== 'self');
         const cite = core.citationFor(ev, era, core.calendarYear(2026, age));
         const per = ev.choices.map((c) => ({ id: c.id, len: (who === 'parent' ? (c.parentLabel ?? c.label) : c.label).length + (who === 'parent' ? (c.parentResult ?? c.result) : c.result).length }));
         const top = per.sort((a, b) => b.len - a.len || (a.id < b.id ? -1 : 1))[0];
         const total = ev.title.length + ev.text.length + top.len + (cite === null ? 0 : cite.text.length + cite.sourceLine.length);
         const prev = best.get(ev.id);
         if (prev === undefined || total > prev.total) best.set(ev.id, { id: ev.id, era, by: who, chosen: top.id, total });
       }
     }
     return [...best.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).slice(0, arg.n);`,
    { n },
  );
}

const yearsCache = new Map<string, Awaited<ReturnType<typeof findDelegatedYear>>>();
const cardsCache: { list: LongDelegated[] | null } = { list: null };

for (const size of SIZES) {
  for (const percent of PERCENTS) {
    for (const rank of [0, 1, 2]) {
      test(`${size.width}x${size.height} · 글자 ${percent}% · 가장 긴 부모·흘러감 카드 #${rank + 1}: 가로 넘침 0px·글자 잘림 0·끊긴 낱말(결함) 0·구분 기호 혼자 남는 줄 0 (CM11·QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(150_000);
        await page.setViewportSize(size);
        await page.goto('/');
        cardsCache.list ??= await longestDelegated(page, 3);
        const card = cardsCache.list[rank];
        expect(card, `긴 카드 #${rank + 1}`).toBeDefined();
        let y = yearsCache.get(`${card.id}/${card.era}`);
        if (y === undefined) {
          // 가장 긴 길로 흘러간 판을 먼저 찾고, 그 길이 드물어 못 찾으면 어느 길이든 같은 카드로 잰다
          try {
            y = await findDelegatedYear(page, { eventId: card.id, era: card.era, by: card.by, chosen: card.chosen, firstBorn: card.id === 'infant-new-sibling' });
          } catch {
            y = await findDelegatedYear(page, { eventId: card.id, era: card.era, by: card.by });
          }
          yearsCache.set(`${card.id}/${card.era}`, y);
        }
        await showParentCard(page, y);
        if (percent !== 100) await setRootFontPercent(page, percent);
        const label = `${size.width}x${size.height}/${percent}%/${card.id}`;
        const m = await measureTextResize(page);
        expect(textResizeViolations(m, label), `루트 글자 ${m.rootFontPx}px`).toEqual([]);
        const words = await measureWordBreaks(page, { scope: '[data-testid="parent-card"]' });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(20);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `글자 100%인 ${size.width}px에서는 한 줄보다 긴 낱말로 끊기는 곳도 0`).toEqual([]);
        for (const i of words.intended) expect(INTENDED_BREAK_WORDS, `의도 목록 밖 낱말이 intended로 셈: ${describeWordBreak(i)}`).toContain(i.word);
        const lines = await measureLineBreaks(page, '[data-testid="parent-card"]', { separators: true, keeps: true });
        expect(lines.violations).toEqual([]);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') });
      });
    }
  }
}

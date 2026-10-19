import { expect, test } from '@playwright/test';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { expandSheet } from './m7bCards';
import { setRootFontPercent } from './textResize';

/**
 * 인용 박스 구분 기호 줄바꿈 **상시** 감사 (SPEC-003 QM2-10·QM3-1, REV-003-M7b-2 R-398, design D-67).
 * 대기 상태를 시드로 찾는 대신 **하니스 페이지**(harness/layout.html — 앱의 실제 `LifeScreen`·`dash.css`·`citations.json`·`citationFor`·`CitationBox`)에서
 * **연결된 카드 × 세상 전부**(지금 89칸)의 인용 박스를 칸마다 보여 재므로 수십 초에 돈다. 상시는 가장 좁은 문맥 — 폭 320 인라인 카드(인용 박스 안쪽 한 줄 223px) × 글자 150·200% 둘이다:
 * 150%는 200%의 부분집합이 아니다(229px 사슬은 150%에서만 「·」 뒤에서 갈렸다). 시트·폭 360 문맥(257·263·297px)은 \`CITE_AUDIT_ALL=1 npm run e2e -- e2e/m7b-cite-lines.spec.ts\`로 같은 감사를 더 돌린다(기본은 건너뜀).
 *  - \`measureLineBreaks\`(구분 기호가 줄 끝·첫머리에 혼자 남는 곳 0, 숫자+단위가 갈라지는 곳 0).
 *  - \`measureWordBreaks\`: 한 줄보다 짧은데 끊긴 낱말(결함) 0, 글자 100·150%에서 한 줄보다 긴 낱말 0, **글자 200%의 「한 줄보다 긴 낱말」은 10글자급(자연 폭 ≥ 224px)뿐**(R-399 ① 잠금 —
 *    9글자 기관·조사 이름 216px 5종은 D-65 안쪽 여백으로 들어간다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface Ctx {
  name: string;
  width: number;
  mode: 'inline' | 'sheet';
  /** 상시(true) / CITE_AUDIT_ALL=1일 때만(false) */
  always: boolean;
}
const CONTEXTS: readonly Ctx[] = [
  { name: '320 인라인', width: 320, mode: 'inline', always: true },
  { name: '320 시트', width: 320, mode: 'sheet', always: false },
  { name: '360 인라인', width: 360, mode: 'inline', always: false },
  { name: '360 시트', width: 360, mode: 'sheet', always: false },
];
/** 한 줄(인용 박스 안쪽 문단)보다 긴 낱말 가운데 「10글자급」의 가장 짧은 자연 폭 — 한글 9글자 24px = 216px, 한글 10글자 약 224px 이상 (design D-65·D-67) */
const TEN_CHAR_PX = 224;

interface Cell {
  id: string;
  era: 'past' | 'present' | 'future';
  birthYear: number;
  age: number;
  year: number;
  citation: string;
}

async function openHarness(page: import('@playwright/test').Page, ctx: Ctx): Promise<Cell[]> {
  await page.setViewportSize({ width: ctx.width, height: 740 });
  await page.goto(ctx.mode === 'sheet' ? '/harness/layout.html?mode=sheet' : '/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
  const cells = await page.evaluate(() => (window as unknown as { __layout: { cells: Cell[] } }).__layout.cells);
  if (ctx.mode === 'sheet') await expandSheet(page); // 시트의 안쪽 스크롤 밖 글자도 재도록 세로 제한을 푼다(폭은 그대로)
  return cells;
}

async function showCell(page: import('@playwright/test').Page, cell: Cell): Promise<void> {
  await page.evaluate(
    async (c) => {
      (window as unknown as { __layout: { showCell: (id: string, era: string, birthYear: number, age: number) => void } }).__layout.showCell(c.id, c.era, c.birthYear, c.age);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    },
    cell,
  );
}

/** node 형식 정의가 없는 e2e 설정이라 전역 process를 좁게 읽는다 */
const auditAll = (): string | undefined => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CITE_AUDIT_ALL;

const label = (ctx: Ctx, percent: number, c: Cell) => `${ctx.name}/${percent}%/${c.era}/${c.id}(${c.citation})`;

for (const ctx of CONTEXTS) {
  for (const percent of [100, 150, 200] as const) {
    test(`${ctx.name} · 글자 ${percent}%: 연결된 카드 × 세상 전부의 인용 박스 — 구분 기호 줄바꿈 위반 0, 끊긴 낱말(결함) 0, 한 줄보다 긴 낱말은 ${percent === 200 ? '10글자급(≥ 224px)뿐' : '0'} (D-67)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.skip(!ctx.always && auditAll() !== '1', '상시는 320 인라인 둘 — 나머지 문맥은 CITE_AUDIT_ALL=1일 때만');
      test.setTimeout(240_000);
      const cells = await openHarness(page, ctx);
      expect(cells.length, '연결된 카드 × 세상 칸').toBeGreaterThanOrEqual(85);
      await setRootFontPercent(page, percent);
      const violations: string[] = [];
      const broken: string[] = [];
      const unavoidable: string[] = [];
      let lines = 0;
      let chars = 0;
      let words = 0;
      let measured = 0;
      for (const cell of cells) {
        await showCell(page, cell);
        if ((await page.locator('.cite').count()) === 0) {
          violations.push(`${label(ctx, percent, cell)}: 인용 박스가 보이지 않는다(하니스 칸이 연결과 어긋남)`);
          continue;
        }
        measured++;
        const report = await measureLineBreaks(page, '.cite', { separators: true, keeps: true });
        lines += report.lineCount;
        chars += report.charCount;
        for (const v of report.violations) violations.push(`${label(ctx, percent, cell)}: ${v}`);
        const w = await measureWordBreaks(page, { scope: '.cite' });
        words += w.checked;
        for (const b of w.broken) broken.push(`${label(ctx, percent, cell)}: ${describeWordBreak(b)}`);
        for (const u of w.unavoidable) unavoidable.push(`${label(ctx, percent, cell)}: ${describeWordBreak(u)}${u.natural >= TEN_CHAR_PX ? '' : ' ← 10글자급 아님'}`);
      }
      expect(measured, '재어 본 칸').toBe(cells.length);
      expect(lines, '잰 줄 수(공허 통과 방지)').toBeGreaterThan(cells.length * 3);
      expect(chars, '잰 글자 수').toBeGreaterThan(cells.length * 60);
      expect(words, '잰 낱말 수').toBeGreaterThan(cells.length * 8);
      expect(violations, '구분 기호·숫자 단위 줄바꿈 위반').toEqual([]);
      expect(broken, '한 줄보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
      if (percent === 200) expect(unavoidable.filter((u) => u.includes('← 10글자급 아님')), '글자 200%의 「한 줄보다 긴 낱말」은 10글자급(자연 폭 ≥ 224px)뿐이다').toEqual([]);
      else expect(unavoidable, `글자 ${percent}%에서는 한 줄보다 긴 낱말이 없다`).toEqual([]);
      testInfo.annotations.push({ type: '측정', description: `${ctx.name} ${percent}%: ${cells.length}칸 · ${lines}줄 · ${chars}글자 · ${words}낱말 / 한 줄보다 긴 낱말 ${unavoidable.length}건${unavoidable.length > 0 ? ` — ${[...new Set(unavoidable.map((u) => u.split(': ').slice(1).join(': ').replace(/ @.*$/, '')))].join(' · ')}` : ''}` });
    });
  }
}

test('측정기 대조(공허 통과 방지): 옛 c-097 출처 「출생아수·합계출산율(1970~)」(Glue 묶음 한 사슬 229px)을 하니스 칸에 넣으면 글자 150% · 폭 320 인라인(한 줄 223px)에서 「출생아수·」가 줄 끝에 남는다 — D-66이 고친 결함을 이 감사가 실제로 잡는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  const ctx: Ctx = { name: '320 인라인', width: 320, mode: 'inline', always: true };
  const cells = await openHarness(page, ctx);
  await setRootFontPercent(page, 150);
  await showCell(page, cells[0]);
  // 옛 출처 제목을 앱과 같은 묶음 모양(.keep-phrase)으로 같은 자리에 넣는다
  await page.evaluate(() => {
    const src = document.querySelector('.cite__src')!;
    src.innerHTML = '국가데이터처(2026), 인구동향조사 <span class="keep-phrase">출생아수·합계출산율(1970~)</span>';
  });
  const report = await measureLineBreaks(page, '.cite', { separators: true, keeps: true });
  expect(report.violations.length, `옛 꼴은 위반이 있다: ${report.violations.join(' / ')}`).toBeGreaterThan(0);
  expect(report.violations.join(' ')).toContain('출생아수·');
});

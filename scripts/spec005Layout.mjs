import { chromium } from '@playwright/test';

/**
 * SPEC-005 QI0 기준선 측정: 첫 화면 「인생 길이」 영역의 높이. 실행: node scripts/spec005Layout.mjs [기준주소=http://localhost:5199]
 * 개발 서버(npm run dev -- --port N --strictPort)가 떠 있어야 한다. 저장된 판이 없는 새 브라우저로 첫 화면(`/`)을 열어 재고, 아무것도 저장하거나 바꾸지 않는다.
 * 영역 = `fieldset`(범례 「인생 길이」 + 라디오 카드 2 + 한 줄 안내) 전체의 보이는 높이(CSS px). 부분(범례 · 라디오 묶음 · 안내)도 함께 적는다.
 * 뷰포트 3개(1280×800 · 1920×1080 · 360×740) × 글자 크기 100·200%(루트 글자 크기).
 */
const base = process.argv[2] ?? 'http://localhost:5199';
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
  { width: 360, height: 740 },
];
const PERCENTS = [100, 200];

const browser = await chromium.launch();
const out = [];
for (const vp of VIEWPORTS) {
  for (const percent of PERCENTS) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(base + '/');
    await page.getByTestId('life-length-group').waitFor();
    if (percent !== 100) await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, percent);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const group = document.querySelector('[data-testid="life-length-group"]');
      const fs = group.closest('fieldset');
      const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null);
      const legend = fs.querySelector('legend');
      const hint = fs.querySelector('[data-testid="life-length-hint"]');
      const era = document.querySelector('[data-testid="era-group"]')?.closest('fieldset');
      const style = getComputedStyle(fs);
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const mt = (el) => parseFloat(cs(el)?.marginTop ?? '0') || 0;
      const mb = (el) => parseFloat(cs(el)?.marginBottom ?? '0') || 0;
      return {
        fieldset: h(fs),
        // 영역이 차지하는 세로 자리 = 상자 높이 + 위아래 바깥 여백(이웃과의 틈)
        fieldsetWithMargins: Math.round((h(fs) + mt(fs) + mb(fs)) * 10) / 10,
        legend: h(legend),
        group: h(group),
        hint: h(hint),
        eraFieldset: h(era),
        viewportH: window.innerHeight,
        rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        cardHeights: [...group.querySelectorAll('label, .choice')].map((el) => Math.round(el.getBoundingClientRect().height * 10) / 10),
        fieldsetPadding: `${style.paddingTop}/${style.paddingBottom}`,
        docHeight: document.documentElement.scrollHeight,
      };
    });
    out.push({ viewport: `${vp.width}x${vp.height}`, percent, ...m });
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(out, null, 2));

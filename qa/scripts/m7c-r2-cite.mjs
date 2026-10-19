// QA-003 M7c 2회차 CQ05 확인 (QA2-3): ① 영유아기 기억의 인용 c-037(새 문장)이 세 세상 × 폭 320·360 × 글자 100·150·200%에서
// 시트 밖으로 넘치지 않고 인용 안 낱말이 두 줄에 걸쳐 끊기지 않는가(사용자 글 제외 낱말 끊김 측정) + 대표 화면 스크린샷.
// 사용: node qa/scripts/m7c-r2-cite.mjs
import { launch, openOracle, dueStateFor, openSeeded, sheetReady, shot, sleep, runCase, setRootFont, appendJsonl } from './m7c-r2-lib.mjs';

const MEASURE = () => {
  const sheet = document.querySelector('[data-testid="note-sheet"]');
  const cite = document.querySelector('[data-testid="cite"]');
  if (!sheet || !cite) return null;
  const sr = sheet.getBoundingClientRect();
  const over = [];
  for (const el of cite.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.right > sr.right + 1 || r.left < sr.left - 1) over.push(el.tagName.toLowerCase());
  }
  const broken = [];
  const walker = document.createTreeWalker(cite, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const re = /\S+/g;
    let m;
    while ((m = re.exec(n.textContent))) {
      const r = document.createRange();
      r.setStart(n, m.index);
      r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0.5);
      if (rects.length > 1) {
        const tops = rects.map((x) => x.top);
        if (Math.max(...tops) - Math.min(...tops) > 6) broken.push(m[0]);
      }
    }
  }
  // 줄 수: 본문 단락의 높이 / 줄 높이
  const bodyEl = [...cite.querySelectorAll('p, span, div')].find((e) => (e.textContent || '').includes('이어져 있다고 봅니다') && e.children.length === 0) || cite;
  const lh = parseFloat(getComputedStyle(bodyEl).lineHeight) || 20;
  return { docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, over, broken: [...new Set(broken)], lines: Math.round(bodyEl.getBoundingClientRect().height / lh), citeRect: { w: Math.round(cite.getBoundingClientRect().width), h: Math.round(cite.getBoundingClientRect().height) } };
};

const b = await launch();
const { page: oracle } = await openOracle(b);
const states = {};
for (const era of ['past', 'present', 'future']) states[era] = await dueStateFor(oracle, 'note-infant-memory', { era, paused: true });

await runCase({ id: 'C-cite-wrap', cat: '콘텐츠(2회차)', title: '① 인용 c-037 새 문장 줄바꿈 — 세 세상 × 폭 320·360 × 글자 100·150·200%에서 시트 밖 넘침 0 · 인용 안 낱말 끊김 0', steps: '5세 ① 시트를 열고 글자 크기를 바꿔 인용 박스를 측정', expected: '넘침 0, 끊긴 낱말 0 (알려진 허용 낱말 규칙 외)' }, async () => {
  const rows = [];
  const bad = [];
  const shots = [];
  for (const era of ['past', 'present', 'future']) {
    for (const [w, h] of [[320, 568], [360, 740]]) {
      for (const font of [100, 150, 200]) {
        const { ctx, page } = await openSeeded(b, states[era], { vp: { width: w, height: h }, wait: '[data-testid="note-sheet"]' });
        await sheetReady(page);
        await setRootFont(page, font);
        await sleep(250);
        const m = await page.evaluate(MEASURE);
        const rec = { era, w, font, ...m };
        rows.push(rec);
        appendJsonl('cite-wrap.jsonl', rec);
        if (!m || m.docOverflow || m.over.length || m.broken.length) bad.push(rec);
        if (w === 320 && font === 200) {
          await page.evaluate(() => document.querySelector('[data-testid="cite"]').scrollIntoView({ block: 'center' }));
          await sleep(150);
          shots.push(await shot(page, 'C-cite', `${era}-320x568-200`));
        }
        if (w === 360 && font === 100) shots.push(await shot(page, 'C-cite', `${era}-360x740-100`));
        await ctx.close();
      }
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `문제 ${bad.length}/${rows.length}: ${JSON.stringify(bad).slice(0, 500)}` : `${rows.length}조합 모두 넘침 0·끊긴 낱말 0 (본문 줄 수 범위 ${Math.min(...rows.map((r) => r.lines))}~${Math.max(...rows.map((r) => r.lines))}줄)`, shots, rows };
});

await b.close();

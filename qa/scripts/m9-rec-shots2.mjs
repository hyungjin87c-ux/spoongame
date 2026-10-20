// QA-003 M9: 카드 전수 훑기에서 나온 RECORD 3건(CARRY-M7b-D65r·L03·L04)의 대표 샷을 임시 폴더에 M9-<케이스ID>.png로 찍는다.
// 사용: QA_OUT=qa/results/m9/m7b node qa/scripts/m9-rec-shots2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, SHOT_DIR } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const browser = await launch();
const out = (id) => path.join(SHOT_DIR, `M9-${id}.png`);

// D65r: 복합 금액이 줄 사이에서 갈린 인용 박스
{
  const rows = readJsonl(path.join(OUT, 'lines.jsonl'));
  const hit = rows.find((r) => {
    const parts = (r.lines && r.lines.parts) || {};
    return Object.values(parts).some((p) => (p.lines || []).some((l, i, a) => /\d[\d,]*(억|만|천|백)$/.test(l) && /^(\d[\d,]*(억|만|천|백)?\s*)?원/.test(a[i + 1] || '')));
  });
  if (hit) {
    const m = /^(\d+)@(\d+)-(sheet|inline)$/.exec(hit.cfg);
    const vp = { name: `${m[1]}`, width: Number(m[1]), height: m[1] === '320' ? 568 : 740, touch: m[1] === '360' };
    const { ctx, page } = await openCard(browser, `sweep/sw-${hit.era}-${hit.ev}`, m[3], { vp, font: Number(m[2]) });
    const cite = page.getByTestId('cite');
    await cite.scrollIntoViewIfNeeded();
    await sleep(250);
    await cite.screenshot({ path: out('CARRY-M7b-D65r') });
    console.log('D65r 샘플', hit.cid, hit.era, hit.ev, hit.cfg, JSON.stringify(hit.lines.parts['요약'].lines.slice(0, 5)));
    await ctx.close();
  } else console.log('D65r 샘플 없음');
}

// L03: 인라인 · 320×568 · 글자 200% — 하단 띠가 맨 아래 선택지의 아래 모서리를 덮는 한 조합
{
  const vp = VPS.find((v) => v.name === '320x568');
  const { ctx, page } = await openCard(browser, 'sweep/sw-future-middle-layoff', 'inline', { vp, font: 200 });
  await page.getByTestId('choice-hold').focus();
  await sleep(300);
  await page.screenshot({ path: out('CARRY-M7b-L03') });
  await ctx.close();
}

// L04: 단서 없는 시트(맨 위에서 아래 내용이 시트 밖에 있고 가림 단서가 없다) — 320×568 · 글자 200%
{
  const rows = readJsonl(path.join(OUT, 'sweep.jsonl'));
  const hit = rows.find((r) => r.cfg === '320x568@200' && r.m && r.m.scrollCue && r.m.scrollCue.hiddenBelow && r.m.scrollCue.hiddenBelow.length && !r.m.scrollCue.hasMask);
  if (hit) {
    const vp = VPS.find((v) => v.name === '320x568');
    const { ctx, page } = await openCard(browser, `sweep/sw-${hit.era}-${hit.ev}`, 'sheet', { vp, font: 200 });
    await page.screenshot({ path: out('CARRY-M7b-L04') });
    console.log('L04 샘플', hit.era, hit.ev, JSON.stringify(hit.m.scrollCue));
    await ctx.close();
  }
}
await browser.close();

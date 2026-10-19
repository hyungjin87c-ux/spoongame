// QA-003 M7b 2회차: D-65·D-66 화면 증거 스크린샷 — 인용 박스를 화면 가운데로 가져와 폭 320/360 × 글자 150/200% × 시트/인라인으로 찍는다.
// 사용: QA_OUT=qa/results/m7b/r2 QA_SHOT_PREFIX=M7b-r2 node qa/scripts/m7b-r2-shots.mjs   (카드 저장은 m7b-r2-sweep.mjs states가 만든 r2/states/sweep)
import { launch, sleep, shot, cardReady } from './m7b-lib.mjs';
import { openCard } from './m7b-audit.mjs';

const CELLS = [
  ['c-097', 'past', 'school-family-priority'],
  ['c-098', 'past', 'youth-marriage'],
  ['c-099', 'past', 'youth-child'],
  ['c-049', 'present', 'school-academy-night'],
  ['c-088', 'present', 'senior-move-home'],
  ['c-006', 'present', 'school-tutoring'],
  ['c-010', 'present', 'school-scholarship'],
  ['c-086', 'present', 'senior-new-device'],
  ['c-061', 'present', 'infant-kindergarten'],
];
const CFGS = [
  { w: 320, h: 568, font: 200, mode: 'inline' },
  { w: 320, h: 568, font: 200, mode: 'sheet' },
  { w: 320, h: 568, font: 150, mode: 'inline' },
  { w: 360, h: 740, font: 150, mode: 'sheet', touch: true },
  { w: 360, h: 740, font: 200, mode: 'inline', touch: true },
];
const b = await launch();
const made = [];
for (const [cid, era, ev] of CELLS) {
  for (const c of CFGS) {
    const { ctx, page } = await openCard(b, `sweep/sw-${era}-${ev}`, c.mode, { vp: { width: c.w, height: c.h, touch: !!c.touch }, font: c.font, hidden: true });
    await cardReady(page).catch(() => {});
    await page.evaluate(() => document.querySelector('[data-testid="cite"]').scrollIntoView({ block: 'center' }));
    await sleep(250);
    made.push(await shot(page, 'D65', `${cid}-${ev}-${c.w}x${c.font}-${c.mode}`));
    await ctx.close();
  }
}
await b.close();
console.log(made.length, '장');

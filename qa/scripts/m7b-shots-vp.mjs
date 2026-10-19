// QA-003 M7b L03 대표 스크린샷: 공통 뷰포트 몇 곳 × 시트·접힌 띠·인라인 (인용 있는 긴 카드 sibling-past)
import { launch, sleep, shot, cardReady } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
const b = await launch();
for (const vi of [4, 7, 8, 9, 10]) {
  for (const mode of ['sheet', 'fold', 'inline']) {
    const font = VPS[vi].name.includes('zoom') ? 100 : 100;
    const { ctx, page } = await openCard(b, 'sibling-past', mode, { vp: VPS[vi], font, hidden: true });
    await sleep(200);
    await shot(page, 'L03', `${VPS[vi].name}-${mode}`);
    await ctx.close();
  }
}
await b.close();

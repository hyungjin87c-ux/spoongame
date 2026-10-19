// 탐색용: prod에서 360x740 터치로 새 판 → 첫 카드까지
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readCard, shot, PROD, TOUCH, sleep, waitGuard } from './m7b-lib.mjs';

const era = process.argv[2] || 'past';
const seed = Number(process.argv[3] || 11);
const b = await launch();
const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
const p = await ctx.newPage();
const t0 = Date.now();
await newGameToLife(p, { era });
await waitGuard(p, 'pause');
await p.locator('[data-speed="8"]').tap();
for (let i = 0; i < 200; i++) {
  const c = await readCard(p);
  if (c.mode) {
    console.log(JSON.stringify(c, null, 1));
    break;
  }
  await sleep(250);
}
console.log('ms', Date.now() - t0);
await shot(p, 'explore', era);
await b.close();

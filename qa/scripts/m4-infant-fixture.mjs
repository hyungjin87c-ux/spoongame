import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, newGameToLife, readDash, OUT, GAME_KEY, PROD } from './m4-lib.mjs';
const SEED = { past: 155, present: 229, future: 138 };
const b = await launch();
for (const era of ['past', 'present', 'future']) {
  const ctx = await mkctx(b, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, SEED[era]);
  const p = await ctx.newPage();
  await newGameToLife(p, { era, base: PROD });
  await p.getByTestId('pause').click();
  await new Promise((r) => setTimeout(r, 200));
  const d = await readDash(p);
  const raw = await p.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  fs.writeFileSync(path.join(OUT, 'saves', era + '-infant.json'), JSON.stringify({ game: raw, age: d.age, screen: d.screen }));
  console.log(era, d.age, d.paused, raw.length);
  await ctx.close();
}
await b.close();

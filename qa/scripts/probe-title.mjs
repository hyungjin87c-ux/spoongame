import { DEV, PROD, launch, mkctx, snap, toLife, sleep } from './lib.mjs';
const b = await launch();
const out = [];
for (const base of [DEV, PROD]) {
  const ctx = await mkctx(b, { viewport: { width: 360, height: 740 } });
  const p = await ctx.newPage();
  await p.goto(base + '/');
  await sleep(400);
  const t1 = await p.title();
  await toLife(p, 'present');
  const t2 = await p.title();
  const lang = await p.evaluate(() => document.documentElement.lang);
  const meta = await p.evaluate(() => document.querySelector('meta[name=viewport]')?.content);
  out.push(`${base.includes('4290') ? 'prod' : 'dev'}: 타이틀 화면 title="${t1}", 인생 화면 title="${t2}", lang=${lang}, viewport=${meta}`);
  await ctx.close();
}
console.log(out.join('\n'));
await b.close();

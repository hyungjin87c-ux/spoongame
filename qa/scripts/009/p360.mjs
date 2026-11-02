import { chromium, inject, lifeAt } from './qalib.mjs';
const b = await chromium.launch();
const out = [];
for (const theme of ['light', 'dark']) for (const vp of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 500, colorScheme: theme });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  for (const [gen, by, year, w] of [['g86', 1965, 1965, 3], ['genx', 1975, 1980, 3], ['genz', 2004, 2009, 1]]) {
    await inject(p, lifeAt({ generation: gen, birthYear: by, age: year - by, wealth: w, perAge: 2 }), { speed: 1, autoMode: false, noteCards: false, theme }, '/?__timescale=100');
    await p.waitForSelector('#scene-era[data-era]', { timeout: 15000 });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const css = (el) => (el ? getComputedStyle(el) : null);
      const era = document.querySelector('#scene-era'), card = document.querySelector('[data-testid="family-scene"]');
      const svg = era.querySelector('svg');
      const icon = document.querySelector('[data-tl="era"] .log__tl svg');
      const sym = document.querySelector('symbol#i-era');
      const ib = icon?.getBoundingClientRect();
      const row = document.querySelector('[data-tl="era"]');
      const iconColor = icon ? getComputedStyle(icon).color : null;
      const rowBg = row ? getComputedStyle(row).backgroundColor : null;
      return { eraBg: css(era).backgroundColor, cardBg: css(card).backgroundColor, filter: css(svg).filter, dec: era.getAttribute('data-dec'), id: era.getAttribute('data-era'),
        iconSize: ib ? [Math.round(ib.width), Math.round(ib.height)] : null, symbolInDom: !!sym, iconColor, rowBg, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        eraBox: (() => { const r = era.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() };
    });
    out.push(`${theme} ${vp.width} ${year}: ${m.id} dec=${m.dec} bg era/card ${m.eraBg === m.cardBg ? '같음' : m.eraBg + '≠' + m.cardBg} filter=${m.filter} era=${m.eraBox} icon=${m.iconSize} sym=${m.symbolInDom} iconColor=${m.iconColor} overflow=${m.ov}`);
  }
  out.push(`  errors ${errs.length}`);
  await ctx.close();
}
console.log(out.join('\n'));
await b.close();

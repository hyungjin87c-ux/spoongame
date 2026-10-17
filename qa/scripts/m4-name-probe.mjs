import { launch, mkctx, sleep, PROD, GAME_KEY, VP, whichScreen } from './m4-lib.mjs';
import { loadSave } from './m4-states.mjs';
const names = { hangul4: '가나다라', hangul5: '가나다라마', hangul8: '가나다라마바사아', hangul20: '가나다라마바사아자차카타파하거너더러머버', latin10: 'WWWWWWWWWW', latin40: 'W'.repeat(40), emojiZwj: '👨‍👩‍👧‍👦🏳️‍🌈김', rtl: 'مرحبا بالعالم', tag: '<img src=x onerror=window.__xss=1>', spaces: '   김   ', newline: '김\n수\n호' };
const b = await launch();
const out = [];
for (const [tag, name] of Object.entries(names)) {
  const base = JSON.parse(loadSave('present', 'age30'));
  base.data.character.name = name;
  const ctx = await mkctx(b, { viewport: { width: 320, height: 568 } });
  await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify(base)]);
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await sleep(500);
  const scr = await whichScreen(p);
  let over = null;
  if (scr === 'life-screen') {
    await p.evaluate(() => { const st = document.createElement('style'); st.textContent = 'html{font-size:200% !important}'; document.head.appendChild(st); });
    await sleep(300);
    over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  }
  out.push(`${tag}(${[...name].length}자): ${scr}${over !== null ? ' 넘침 ' + over + 'px(320·200%)' : ''}`);
  await ctx.close();
}
console.log(out.join('\n'));
await b.close();

// QA-003 M8 2회차: 첫 화면 가상 인구 한 줄(population-line)의 줄 끝 홀로 관형사 확인(스크린샷 + 줄 나눔) — D-98 대상(FS5 설명·가상 인구 주석) 밖의 글
import { launch, mkctx, sleep, setRootFont, PROD, shot, runCase } from './m8-lib.mjs';
const browser = await launch();
for (const [w, h, pct] of [[320, 568, 200], [360, 740, 200], [360, 740, 100]]) {
  const ctx = await mkctx(browser, { viewport: { width: w, height: h }, colorScheme: 'light' });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch {} });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await setRootFont(page, pct);
  await sleep(200);
  const info = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="population-line"]');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n; const words = [];
    while ((n = walker.nextNode())) {
      const re = /\S+/g; let m;
      while ((m = re.exec(n.textContent))) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rc = r.getClientRects()[0]; if (rc) words.push({ w: m[0], t: Math.round(rc.top) });
      }
    }
    for (const x of words) { const l = lines.find((q) => q.t === x.t); if (l) l.ws.push(x.w); else lines.push({ t: x.t, ws: [x.w] }); }
    return { html: el.innerHTML.slice(0, 300), text: el.textContent.replace(/\s+/g, ' ').trim(), lines: lines.map((l) => l.ws.join(' ')) };
  });
  const s = await shot(page, `DET-popline-${w}x${h}-${pct}`, '');
  console.log(w, h, pct, JSON.stringify(info));
  await ctx.close();
}
await browser.close();

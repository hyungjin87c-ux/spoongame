// QA-003 M5: 변조된 긴 이름이 어느 요소를 넘치게 하는지 찾는다(헤더의 M4 기록과 M5 신규 요소(안내 한 줄·영향 줄)를 가르려고).
import { launch, mkctx, PROD, GAME_KEY, sleep, editSave, setRootFont } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';
const browser = await launch();
const CHOICE = loadSave('present', 'adult-choice');
for (const [label, name] of [['한글 20자', '가나다라마바사아자차카타파하가나다라마바'], ['W 20자', 'WWWWWWWWWWWWWWWWWWWW'], ['태그', '<b onclick=1>x</b>']]) {
  const ctx = await mkctx(browser, { viewport: { width: 320, height: 568 } });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [GAME_KEY, editSave(CHOICE, (d) => (d.character.name = name))]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]');
  await setRootFont(page, 200);
  await sleep(500);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const e of document.body.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 0.5) out.push(`${e.tagName.toLowerCase()}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''} right ${Math.round(r.right)}`);
    }
    return { vw, scrollW: document.documentElement.scrollWidth, over: out.slice(0, 12), hintRight: Math.round(document.querySelector('[data-testid="choice-hint"]').getBoundingClientRect().right), hintScroll: document.querySelector('[data-testid="choice-hint"]').scrollWidth };
  });
  console.log(label, JSON.stringify(r));
  await ctx.close();
}
await browser.close();

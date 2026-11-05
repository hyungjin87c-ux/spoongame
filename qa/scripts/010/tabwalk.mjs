// m4-focus 실패 재현: 알파 시드 777 50세(dash-adult)에서 Tab을 눌러 포커스 정지점을 적는다
import { chromium, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const wait = Number(process.argv[2] ?? 0);
const vp = process.argv[3] ? process.argv[3].split('x').map(Number) : [1280, 800];
const { browser, page, errors } = await newPage(chromium, { width: vp[0], height: vp[1] });
await page.goto(BASE + '/');
const st = await evalCore(page, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
  while (s.phase === 'life' && (s.age < 50 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
  return s;`);
console.log('born', st.character.birthYear, 'age', st.age, 'W', st.character.parentWealth, 'phase', st.phase);
await inject(page, st, { speed: 1, autoMode: false }, '/');
await page.getByTestId('life-screen').waitFor();
if (wait) await settle(page, wait);
await page.keyboard.press('Shift');
await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
const desc = () => page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return 'BODY'; return (a.getAttribute('data-testid') || a.tagName + '.' + (a.className || '') + '[' + (a.textContent || '').trim().slice(0, 20) + ']'); });
const stops = [];
for (let i = 0; i < 70; i++) { await page.keyboard.press('Tab'); const d = await desc(); stops.push(d); if (d === 'BODY') break; }
console.log(stops.length, stops.join(' > '));
const rows = await page.evaluate(() => ({ eraRows: document.querySelectorAll('[data-tl="era"]').length, whyBtn: document.querySelectorAll('[data-testid="why-btn"]').length }));
console.log(rows, errors);
await browser.close();

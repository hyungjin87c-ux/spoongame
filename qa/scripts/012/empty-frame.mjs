// 미래 빈 해(후보 소진)의 창 모습 — 사진은 저장소 밖(인자 2)에 둔다. 사용: node qa/scripts/012/empty-frame.mjs <폭x높이> <출력 폴더>
import { chromium, newPage, evalCore, inject, BASE } from './lib.mjs';
const [vp = '360x740', out = '.'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
const { browser, page, errors } = await newPage(chromium, { width: w, height: h }, { hasTouch: w < 500 });
await page.goto(BASE + '/');
const snap = await evalCore(page, `
  const era = await import('/src/core/eraWindow.ts');
  const L = await import('/src/data/eraWindows/index.ts');
  const windows = []; for (const d of L.ERA_DECADES_WITH_DATA) windows.push(...(await L.ERA_DECADE_LOADERS[d]()).windows);
  for (let seed = 1; seed < 3000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'genz')));
    const by = s.character.birthYear;
    // 미래 빈 해와 장면 있는 해를 찾는다: 먼저 이 사람의 famSeed로 eraOf
    const ctx = { regionKey: s.birthReport.region, gentle: false, seed: core.famSeedOf(s.peerSeed), windows, birthYear: by, band: core.bandOfWealth(s.character.parentWealth) };
    const emptyAge = [...Array(80).keys()].find((a) => by + a >= 2040 && by + a <= 2060 && era.eraOf(by + a, ctx).pic === null);
    if (emptyAge === undefined) continue;
    let guard = 0;
    while (s.phase === 'life' && s.age < emptyAge && guard++ < 300) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } s = core.stepYear(s).state; }
    if (s.phase === 'life' && s.age === emptyAge) return { ...s, paused: true };
  }
  return null;`);
delete snap.play;
await inject(page, snap, { speed: 1, autoMode: false, noteCards: false });
await page.getByTestId('life-screen').waitFor({ state: 'visible' });
await page.waitForFunction(() => document.querySelectorAll('[data-tl=era]').length >= 3, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);
const info = await page.evaluate(() => { const e = document.querySelector('#scene-era'); return { year: document.querySelector('.scene__year time')?.textContent, empty: e?.dataset.empty, era: e?.dataset.era ?? null, html: e?.outerHTML.slice(0, 300) }; });
console.log(JSON.stringify(info), 'errors', errors.length);
await page.screenshot({ path: `${out}/empty-frame-${vp}.png` });
await browser.close();

import { chromium, webkit, GAME_KEY, SAVE_VERSION, BASE } from './qalib.mjs';
for (const [name, bt, vp] of [['webkit-360', webkit, { width: 360, height: 740 }], ['webkit-1280', webkit, { width: 1280, height: 800 }], ['chromium-360', chromium, { width: 360, height: 740 }]]) {
  const b = await bt.launch(); const p = await (await b.newContext({ viewport: vp })).newPage();
  await p.goto(BASE + '/'); await p.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  const mid = await p.evaluate(`(async () => { const core = await import('/src/core/index.ts'); await (await import('/src/data/gameData.ts')).loadGameData();
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
    while (s.phase === 'life' && s.age < 50) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state; const { play, ...rest } = s; return rest; })()`);
  await p.evaluate(([k, v]) => localStorage.setItem(k, v), [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: mid })]);
  for (let i = 0; i < 3; i++) { await p.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await p.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await p.goto(BASE + '/');
  await p.getByTestId('log-list').waitFor();
  const meas = () => p.getByTestId('log-list').evaluate((el) => { const rs = el.querySelectorAll('[data-testid="log-row"]'); const r = rs[rs.length - 1].getBoundingClientRect(); const bx = el.getBoundingClientRect(); return { bottomOver: +(r.bottom - bx.bottom).toFixed(2), topUnder: +(r.top - bx.top).toFixed(2), sTop: el.scrollTop, sH: el.scrollHeight, cH: el.clientHeight, max: el.scrollHeight - el.clientHeight, era: el.querySelectorAll('[data-tl="era"]').length, rows: rs.length }; });
  const r0 = await p.getByTestId('log-list').evaluate((el) => { el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }); const rs = el.querySelectorAll('[data-testid="log-row"]'); const r = rs[rs.length - 1].getBoundingClientRect(); const bx = el.getBoundingClientRect(); return { bottomOver: +(r.bottom - bx.bottom).toFixed(2), era: el.querySelectorAll('[data-tl="era"]').length, sTop: el.scrollTop, max: el.scrollHeight - el.clientHeight }; });
  await p.waitForTimeout(1200);
  console.log(name, 'scroll 직후', JSON.stringify(r0), '| 1.2s 뒤', JSON.stringify(await meas()));
  await p.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
  console.log('   다시 맨 아래로 →', JSON.stringify(await meas()));
  await b.close();
}

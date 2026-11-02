import { webkit, chromium, GAME_KEY, SAVE_VERSION, BASE } from './qalib.mjs';
const which = process.argv[2] === 'chromium' ? chromium : webkit;
const age = Number(process.argv[3] ?? 50);
const b = await which.launch(); const p = await (await b.newContext({ viewport: { width: 360, height: 740 } })).newPage();
await p.goto(BASE + '/'); await p.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
const mid = await p.evaluate(`(async () => { const core = await import('/src/core/index.ts'); await (await import('/src/data/gameData.ts')).loadGameData();
  let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
  while (s.phase === 'life' && s.age < ${age}) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state; const { play, ...rest } = s; return rest; })()`);
await p.evaluate(([k, v]) => localStorage.setItem(k, v), [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: mid })]);
for (let i = 0; i < 3; i++) { await p.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await p.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
// 페이지가 뜨기 전에 관찰자 설치: 보이는 첫 줄의 글과 목록 윗변에서의 거리를 기록
await p.addInitScript(() => {
  window.__log = [];
  const tick = () => {
    const el = document.querySelector('[data-testid="log-list"]'); if (!el) return;
    const box = el.getBoundingClientRect();
    const rows = [...el.querySelectorAll('li')];
    const row = rows.find((r) => r.getBoundingClientRect().bottom > box.top + 0.5);
    window.__log.push({ t: Math.round(performance.now()), era: el.querySelectorAll('[data-tl="era"]').length, sTop: el.scrollTop, max: el.scrollHeight - el.clientHeight, first: row ? (row.id || row.textContent.slice(0, 14)) : null, off: row ? +(row.getBoundingClientRect().top - box.top).toFixed(1) : null });
  };
  setInterval(tick, 40);
});
await p.goto(BASE + '/');
await p.getByTestId('log-list').waitFor();
await p.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
await p.waitForTimeout(2500);
const log = await p.evaluate(() => window.__log);
// 줄 수가 달라지는 순간과 그 앞뒤만 출력
let prev = null; const out = [];
for (const r of log) { if (!prev || r.era !== prev.era || Math.abs(r.sTop - prev.sTop) > 0 || r.first !== prev.first || r.off !== prev.off) out.push(r); prev = r; }
console.log(process.argv[2] ?? 'webkit', 'age', age, out.slice(0, 40).map((r) => `${r.t}ms era=${r.era} sTop=${r.sTop}/${r.max} first=${r.first} off=${r.off}`).join('\n'));
await b.close();

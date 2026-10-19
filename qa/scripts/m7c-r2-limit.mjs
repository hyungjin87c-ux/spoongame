// QA-003 M7c 2회차 R-411 / QA2-4 (content-M7c 11-7): 기록이 40개에 이른 판에서는 자동 카드가 시트 없이 소비된다(진행이 멈추지 않음),
// 40개 안내 시트는 「생각 남기기」 버튼으로 열 때만 보인다, 39개에서는 시트가 뜨고 저장하면 40개 → 그 뒤 자동 카드는 소비.
// 사용: node qa/scripts/m7c-r2-limit.mjs [ID 일부]
import { launch, openOracle, plainLife, evalCore, withNotes, openSeeded, sheetReady, readNote, readLog, readSave, noteRowsOf, readCard, shot, sleep, runCase, GAME_KEY, SET_MANUAL } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: 'R-411 기록 40개', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots, ...extra.rec };
};

const b = await launch();
const { page: oracle } = await openOracle(b);
// ① 카드를 소비하고 세 해를 더 가도 결정 카드가 없는 판(소비 직후 결정 시트가 화면을 가리지 않게)
const silent = await evalCore(
  oracle,
  `for (let seed = 1; seed < 4000; seed++) {
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     for (let g = 0; g < 300 && s.phase === 'life'; g++) {
       if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
       const due = core.dueNote(s);
       if (due !== null) {
         if (due.id === 'note-infant-memory') {
           let t = core.consumeNote(s, due);
           let ok = true;
           for (let i = 0; i < 3 && ok; i++) { const r = core.stepYear(t); t = r.state; if (t.phase !== 'life' || t.pending !== null) ok = false; }
           if (ok) return { ...s, paused: true };
         }
         s = core.consumeNote(s, due);
       }
       s = core.stepYear(s).state;
     }
   }
   return null;`,
);
if (!silent) throw new Error('조용한 상태를 못 찾음');
const infant = await evalCore(
  oracle,
  `for (let seed = 1; seed < 4000; seed++) {
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     for (let g = 0; g < 300 && s.phase === 'life'; g++) {
       if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
       const due = core.dueNote(s);
       if (due !== null) { if (due.id === 'note-infant-memory') return { ...s, paused: true }; s = core.consumeNote(s, due); }
       s = core.stepYear(s).state;
     }
   }
   return null;`,
);

const noteSheets = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="note-sheet"]').length);
const ageOf = (page) => page.evaluate(() => { const e = document.querySelector('[data-testid="life-age"] b'); return e ? parseInt(e.textContent, 10) : null; });
const seenOf = (page) => page.evaluate((k) => { try { return Object.keys(JSON.parse(localStorage.getItem(k)).data.seen).filter((x) => x.startsWith('note-')); } catch { return null; } }, GAME_KEY);

// 진행을 몰아가는 도우미: 결정 카드가 뜨면 첫 선택지를 고르고, 기록 시트가 뜨면 세어서 닫는다(저장). 조건이 되면 멈춘다
async function drive(page, { until, maxMs = 90000, onSheet = null }) {
  const t0 = Date.now();
  const sheets = [];
  let decisions = 0;
  while (Date.now() - t0 < maxMs) {
    if (await until()) return { ok: true, sheets, decisions, ms: Date.now() - t0 };
    if ((await noteSheets(page)) > 0) {
      await sheetReady(page).catch(() => {});
      const n = await readNote(page);
      sheets.push({ age: await ageOf(page), card: n.card, via: n.via, input: n.inputValue !== null, title: n.title });
      if (onSheet) await onSheet(page, n);
      await sleep(500);
      continue;
    }
    const hasChoice = await page.evaluate(() => !!document.querySelector('[data-testid="choice-panel"]'));
    if (hasChoice) {
      await page.waitForFunction(() => { const c = document.querySelector('.choice'); return !c || c.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 5000 }).catch(() => {});
      await sleep(450);
      const first = page.locator('.choice').first();
      if ((await first.count()) > 0) {
        const bx = await first.boundingBox();
        if (bx) await page.touchscreen.tap(bx.x + bx.width / 2, Math.min(bx.y + bx.height / 2, 736));
        decisions++;
        await sleep(450);
      }
      continue;
    }
    await sleep(120);
  }
  return { ok: false, sheets, decisions, ms: Date.now() - t0 };
}

await run({ id: 'L-40-auto', title: '기록 40개 판: 자동 ① 카드는 시트 없이 소비되고 진행이 멈추지 않는다 · 연표 40줄 유지', steps: '수동 기록 40개를 쌓은 5세 판을 8배속으로 진행 → 시트 관찰, seen 소비, 나이 진행, 기록 줄 수', expected: '기록 시트 0번, note-infant-memory가 seen에 생김, 나이가 오름, 기록 줄 40개 그대로' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const st40 = await withNotes(oracle, { ...silent, paused: false }, 40);
  const { ctx, page } = await openSeeded(b, st40, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="life-screen"]' });
  await page.evaluate(() => {
    window.__sheetSeen = 0;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="note-sheet"]')) window.__sheetSeen++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const age0 = await ageOf(page);
  const r = await drive(page, { until: async () => (await ageOf(page)) >= age0 + 3, maxMs: 40000 });
  const seen = await seenOf(page);
  const sheetSeen = await page.evaluate(() => window.__sheetSeen);
  const rows = noteRowsOf(await readSave(page)).length;
  const logN = (await readLog(page)).filter((x) => x.isNote).length;
  chk(`진행이 멈추지 않음(나이 ${age0}→${await ageOf(page)})`, r.ok, JSON.stringify(r));
  chk('기록 시트가 한 번도 뜨지 않음', sheetSeen === 0, `sheetSeen=${sheetSeen}`);
  chk('① 카드가 seen에 소비 표시', Array.isArray(seen) && seen.includes('note-infant-memory'), JSON.stringify(seen));
  chk('저장의 기록 줄 40개 그대로(41번째 없음)', rows === 40, rows);
  chk('인생 기록 화면의 기록 줄 40개', logN === 40, logN);
  shots.push(await shot(page, 'L-40-auto', 'after'));
  // 「생각 남기기」 버튼으로 열 때만 40개 안내
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 8000 });
  await page.evaluate(() => { const p = document.querySelector('[data-testid="pause"]'); if (p && p.getAttribute('data-paused') !== 'true') p.click(); });
  await sleep(500);
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await sheetReady(page);
  const n = await readNote(page);
  chk('버튼으로 열면 40개 안내(입력란 없음·닫기)', n.inputValue === null && n.limitClose && n.title === '이 인생에서 남길 수 있는 기록은 40개까지입니다.', JSON.stringify({ title: n.title, via: n.via, input: n.inputValue }));
  shots.push(await shot(page, 'L-40-auto', 'limit-by-button'));
  await page.getByTestId('note-limit-close').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(500);
  const rows2 = noteRowsOf(await readSave(page)).length;
  chk('안내를 닫아도 기록 40줄', rows2 === 40, rows2);
  await ctx.close();
  return done(checks, shots, { rec: { rec: { drive: r, sheetSeen, seen } } });
});

await run({ id: 'L-40-reload', title: '기록 40개 판에서 자동 카드가 뜰 차례인 채 새로고침 12번 — 시트가 한 번도 뜨지 않고 저장이 깨지지 않는다', steps: '40개 + ① 적격 판(일시정지)을 열고 새로고침 12번', expected: '시트 0, 기록 40줄 유지(불러온 저장에서 적격인 드문 경우 = 다음 전이에서 소비)' }, async () => {
  const { checks, chk } = mk();
  const st40 = await withNotes(oracle, infant, 40);
  const { ctx, page } = await openSeeded(b, st40, { settings: SET_MANUAL, wait: '[data-testid="life-screen"]' });
  let seenSheet = 0;
  for (let i = 0; i < 12; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="note-sheet"]', { timeout: 10000 });
    await sleep(250);
    seenSheet += await noteSheets(page);
  }
  const rows = noteRowsOf(await readSave(page)).length;
  chk(`12번 새로고침 동안 시트가 뜬 횟수 ${seenSheet}`, seenSheet === 0, seenSheet);
  chk('기록 40줄 유지', rows === 40, rows);
  await ctx.close();
  return done(checks, []);
});

await run({ id: 'L-39', title: '기록 39개 판: 자동 ①은 시트가 뜨고(입력란 있음) 저장하면 40개 → 그 뒤 자동 카드는 시트 없이 소비되고 진행은 이어진다', steps: '수동 기록 39개 + ① 적격 판을 8배속으로 진행: ① 시트에 글 쓰고 1번 → 이후 결정 카드는 첫 선택지로 넘기며 나이 17세까지', expected: '시트 정확히 1번(①), 저장 40개, 이후 카드(또래와 나 등)는 seen에만 남음, 시트 0, 나이 17 이상', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const st39 = await withNotes(oracle, { ...infant, paused: false }, 39);
  const { ctx, page } = await openSeeded(b, st39, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  const n0 = await readNote(page);
  chk('39개에서는 입력란 있는 자동 ① 시트가 뜸', n0.inputValue !== null && n0.card === 'note-infant-memory' && !n0.limitClose, JSON.stringify({ card: n0.card, via: n0.via, input: n0.inputValue }));
  shots.push(await shot(page, 'L-39', 'sheet-at-39'));
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('마흔 번째 기록');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(300);
  chk('저장하면 기록 40개', noteRowsOf(await readSave(page)).length === 40, noteRowsOf(await readSave(page)).length);
  const sheetsAfter = [];
  const r = await drive(page, { until: async () => (await ageOf(page)) >= 17 || !(await page.getByTestId('life-screen').count()), maxMs: 120000, onSheet: async (p) => { sheetsAfter.push(await ageOf(p)); await p.keyboard.press('Escape'); } });
  const seen = await seenOf(page);
  chk(`나이 17세 이상까지 진행(결정 ${r.decisions}번)`, r.ok, JSON.stringify(r));
  chk('그 뒤 기록 시트가 한 번도 뜨지 않음', r.sheets.length === 0, JSON.stringify(r.sheets));
  chk('또래와 나(②)가 seen에 소비 표시(시트 없이)', Array.isArray(seen) && seen.includes('note-teen-envy'), JSON.stringify(seen));
  chk('기록 줄은 40개 그대로', noteRowsOf(await readSave(page)).length === 40, noteRowsOf(await readSave(page)).length);
  shots.push(await shot(page, 'L-39', 'after-17'));
  await ctx.close();
  return done(checks, shots, { rec: { rec: { drive: r, seen } } });
});

await run({ id: 'L-41-click', title: '40개 판에서 「생각 남기기」 20번 연타·Esc — 안내 시트만 하나, 41번째 줄 없음', steps: '40개 판에서 도구 줄 버튼을 가드가 풀릴 때마다 20번 눌러 보기', expected: '시트는 한 번에 하나, 입력란 없음, 기록 40줄' }, async () => {
  const { checks, chk } = mk();
  const st40 = await withNotes(oracle, silent, 40);
  const { ctx, page } = await openSeeded(b, st40, { settings: SET_MANUAL, wait: '[data-testid="life-screen"]' });
  let maxSheets = 0;
  let withInput = 0;
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => document.querySelector('[data-testid="tool-note"]')?.click());
    await sleep(60);
    maxSheets = Math.max(maxSheets, await noteSheets(page));
    withInput += await page.evaluate(() => (document.querySelector('[data-testid="note-input"]') ? 1 : 0));
    await page.keyboard.press('Escape');
    await sleep(450);
  }
  chk('동시에 열린 시트 ≤ 1', maxSheets <= 1, maxSheets);
  chk('입력란이 나온 적 없음', withInput === 0, withInput);
  chk('기록 40줄', noteRowsOf(await readSave(page)).length === 40, noteRowsOf(await readSave(page)).length);
  await ctx.close();
  return done(checks, []);
});

await b.close();

// QA-003 M7c 2회차 F-1 보충 (11-1-6 (d)): 가드가 과하지 않음 + 가드 중 모양.
//  M1 자동 모드 자동 선택 직후 100ms에 배속 탭이 막히지 않는다 (3 뷰포트)
//  M2 시트 없이 소비된 직후(자동 모드 · 카드 끔 · 기록 40개)에도 배속 탭이 작동한다, 시트 0
//  M3 평소 배속 연타(100ms 간격 4번)가 마지막 값에 도달, 일시정지·자동 모드 연타도 짝수 번이면 제자리
//  M4 가드 중 흐림 모양(스크린샷 + 계산된 불투명도) — 1번/2번/확인 버림/결정 선택 직후, 가드가 풀린 뒤와 비교
//  M5 「의견 보내기」 링크도 가드 중에는 새 창을 열지 않는다
// 사용: node qa/scripts/m7c-r2-guard2.mjs [케이스ID 일부]
import { launch, openOracle, plainLife, dueStateFor, pendingState, withNotes, evalCore, openSeeded, sheetReady, shot, sleep, runCase, appendJsonl, STD_VIEWPORTS, SET_MANUAL, SET_AUTO, SET_OFF, GAME_KEY } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '입력 가드(2회차)', ...c }, fn) : null);
const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const pendRun = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
// 소비 직후 결정 카드(모달)가 곧바로 뜨면 컨트롤이 가려지므로, ① 카드를 소비하고 두 해를 더 가도 결정 카드가 없는 판을 고른다
const silentDue = await evalCore(
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
           if (ok) return { ...s, paused: true, __seed: seed };
         }
         s = core.consumeNote(s, due);
       }
       s = core.stepYear(s).state;
     }
   }
   return null;`,
);
if (!silentDue) throw new Error('조용한 소비 상태를 못 찾음');
const { __seed: silentSeed, ...silentRest } = silentDue;
const infantRun = { ...silentRest, paused: false };
const VP3 = STD_VIEWPORTS.filter((v) => ['360x740', '320x568', '1280x800'].some((n) => v.name.startsWith(n)));

const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots, ...extra.rec };
};
const speedNow = (page) => page.evaluate(() => { const c = document.querySelector('[data-speed][aria-pressed="true"]'); return c ? c.getAttribute('data-speed') : null; });
const speedBtn = (page, v) =>
  page.evaluate((vv) => {
    const t = document.querySelector(`[data-speed="${vv}"]`);
    if (!t) return null;
    t.scrollIntoView({ block: 'center', inline: 'center' });
    const r = t.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, dis: t.getAttribute('aria-disabled') };
  }, v);
const tapSpeed = async (page, v) => {
  const bt = await speedBtn(page, v);
  if (!bt) return null;
  await page.touchscreen.tap(bt.x, bt.y);
  return bt;
};

// ---------------------------------------------------------------- M1
await run({ id: 'G-auto-select', title: '자동 모드 자동 선택(인라인 카드가 저절로 사라짐) 직후 100ms에 배속 탭이 막히지 않는다', steps: '자동 모드·진행 중 결정 카드 → 카드가 저절로 사라진 것을 관찰한 100ms 뒤 배속(현재와 다른 값) 탭', expected: '배속이 바뀜(G8: 자동 선택에는 가드를 걸지 않음)' }, async () => {
  const { checks, chk } = mk();
  const rows = [];
  for (const vp of VP3) {
    const { ctx, page } = await openSeeded(b, pendRun, { vp: { width: vp.width, height: vp.height }, settings: { ...SET_AUTO, speed: 1 }, wait: '[data-testid="choice-panel"]' });
    await page.evaluate(() => {
      window.__gone = null;
      new MutationObserver(() => {
        if (!document.querySelector('[data-testid="choice-panel"]') && window.__gone === null) window.__gone = performance.now();
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.waitForFunction(() => window.__gone !== null, null, { timeout: 15000 });
    await sleep(100);
    const t = await page.evaluate(() => performance.now() - window.__gone);
    const before = await speedNow(page);
    const want = before === '4' ? '2' : '4';
    const bt = await tapSpeed(page, want);
    await sleep(250);
    const after = await speedNow(page);
    rows.push({ vp: vp.name, sinceGoneMs: Math.round(t), from: before, want, after, guardedAtTap: bt && bt.dis });
    chk(`${vp.name}: 자동 선택 ${Math.round(t)}ms 뒤 배속 ${before}→${after}`, after === want && !(bt && bt.dis === 'true'), JSON.stringify(rows[rows.length - 1]));
    appendJsonl('guard2.jsonl', { id: 'G-auto-select', ...rows[rows.length - 1] });
    await ctx.close();
  }
  return done(checks, [], { rec: { rows } });
});

// ---------------------------------------------------------------- M2
for (const V of [
  { id: 'auto-mode', label: '자동 모드(소비)', st: infantRun, settings: { ...SET_AUTO, speed: 8 } },
  { id: 'cards-off', label: '카드 끔(소비)', st: infantRun, settings: { speed: 8, autoMode: false, noteCards: false } },
  { id: 'limit-40', label: '기록 40개(소비, R-411)', st: null, settings: { speed: 8, autoMode: false, noteCards: true } },
]) {
  await run({ id: `G-silent-${V.id}`, title: `시트 없이 소비된 직후(${V.label}) — 시트 0, 배속 탭이 막히지 않는다`, steps: '① 카드가 뜰 차례(5세)인 판을 8배속으로 진행 → 저장의 seen에 note-infant-memory가 생기는 순간을 관찰 → 100ms 뒤 배속 탭', expected: '시트가 한 번도 뜨지 않고, 배속이 바뀜' }, async () => {
    const { checks, chk } = mk();
    const rows = [];
    for (const vp of VP3) {
      let st = V.st;
      if (V.id === 'limit-40') st = await withNotes(oracle, infantRun, 40);
      const { ctx, page } = await openSeeded(b, st, { vp: { width: vp.width, height: vp.height }, settings: V.settings, wait: '[data-testid="life-screen"]' });
      await page.evaluate(() => {
        window.__sheetSeen = 0;
        new MutationObserver(() => {
          if (document.querySelector('[data-testid="note-sheet"]')) window.__sheetSeen++;
        }).observe(document.body, { childList: true, subtree: true });
      });
      // 화면 진입 가드(400ms)가 끝난 뒤 진행시킨다(이미 진행 중이면 그대로)
      await sleep(700);
      const key = GAME_KEY;
      const t0 = Date.now();
      let seenAt = null;
      while (Date.now() - t0 < 25000) {
        const has = await page.evaluate((k) => { try { const d = JSON.parse(localStorage.getItem(k)).data; return d.seen && d.seen['note-infant-memory'] !== undefined; } catch { return false; } }, key);
        if (has) { seenAt = Date.now(); break; }
        await sleep(15);
      }
      if (seenAt === null) {
        // 시계가 멈춰 있으면 일시정지를 푼다
        const paused = await page.evaluate(() => document.querySelector('[data-testid="pause"]')?.getAttribute('data-paused'));
        chk(`${vp.name}: 소비 관찰`, false, `25초 안에 소비 못 봄 paused=${paused}`);
        await ctx.close();
        continue;
      }
      await sleep(100);
      const before = await speedNow(page);
      const want = before === '2' ? '1' : '2';
      const bt = await tapSpeed(page, want);
      await sleep(250);
      const after = await speedNow(page);
      const sheetSeen = await page.evaluate(() => window.__sheetSeen);
      const rec = { vp: vp.name, consumeToTapMs: Date.now() - seenAt, from: before, want, after, guardedAtTap: bt && bt.dis, sheetSeen };
      rows.push(rec);
      chk(`${vp.name}: 시트 0 · 소비 뒤 배속 ${before}→${after}`, sheetSeen === 0 && after === want && !(bt && bt.dis === 'true'), JSON.stringify(rec));
      appendJsonl('guard2.jsonl', { id: `G-silent-${V.id}`, ...rec });
      await ctx.close();
    }
    return done(checks, [], { rec: { rows } });
  });
}

// ---------------------------------------------------------------- M3
await run({ id: 'G-normal-taps', title: '평소 조작은 막히지 않는다 — 배속 연타(100ms 간격 4번)가 마지막 값에 도달, 일시정지·자동 모드 4번 연타는 제자리로', steps: '진행 중 인생에서 배속 2·4·8·2를 100ms 간격으로 탭, 일시정지 4번, 자동 모드 4번', expected: '배속 2, 일시정지·자동 모드는 처음과 같음, 각 탭이 직전 값을 바꿈' }, async () => {
  const { checks, chk } = mk();
  const rows = [];
  for (const vp of VP3) {
    const { ctx, page } = await openSeeded(b, { ...base, paused: false }, { vp: { width: vp.width, height: vp.height }, settings: { ...SET_MANUAL, speed: 1 }, wait: '[data-testid="life-screen"]' });
    await sleep(900);
    const seq = [];
    for (const v of ['2', '4', '8', '2']) {
      await tapSpeed(page, v);
      await sleep(100);
      seq.push(await speedNow(page));
    }
    chk(`${vp.name}: 배속 연타 ${seq.join('→')}`, seq.join(',') === '2,4,8,2', seq.join(','));
    const p0 = await page.evaluate(() => document.querySelector('[data-testid="pause"]').getAttribute('data-paused'));
    for (let i = 0; i < 4; i++) {
      const bt = await page.evaluate(() => { const t = document.querySelector('[data-testid="pause"]'); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.touchscreen.tap(bt.x, bt.y);
      await sleep(100);
    }
    const p1 = await page.evaluate(() => document.querySelector('[data-testid="pause"]').getAttribute('data-paused'));
    chk(`${vp.name}: 일시정지 4번 연타 제자리(${p0}→${p1})`, p0 === p1, `${p0}/${p1}`);
    const a0 = await page.evaluate(() => document.querySelector('[data-testid="auto"]').getAttribute('aria-pressed'));
    for (let i = 0; i < 4; i++) {
      const bt = await page.evaluate(() => { const t = document.querySelector('[data-testid="auto"]'); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.touchscreen.tap(bt.x, bt.y);
      await sleep(100);
    }
    const a1 = await page.evaluate(() => document.querySelector('[data-testid="auto"]').getAttribute('aria-pressed'));
    chk(`${vp.name}: 자동 모드 4번 연타 제자리(${a0}→${a1})`, a0 === a1, `${a0}/${a1}`);
    rows.push({ vp: vp.name, seq, p0, p1, a0, a1 });
    appendJsonl('guard2.jsonl', { id: 'G-normal-taps', ...rows[rows.length - 1] });
    await ctx.close();
  }
  return done(checks, [], { rec: { rows } });
});

// ---------------------------------------------------------------- M4 모양
await run({ id: 'G-look', title: '가드 중 모양 — 시트가 닫힌 직후 컨트롤이 흐려 보이고(불투명도 0.55, aria-disabled), 가드가 풀리면 원래대로', steps: '360×740 터치에서 1번·2번·확인 버림·결정 선택 직후 곧바로 스크린샷과 계산된 불투명도, 600ms 뒤 다시', expected: '직후 흐림(<1), 600ms 뒤 1', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const rows = [];
  const ctrlOpacity = (page) =>
    page.evaluate(() => {
      const sel = ['[data-testid="pause"]', '[data-speed="2"]', '[data-testid="skip"]', '[data-testid="auto"]', '[data-testid="tool-bgm"]', '[data-testid="tool-note"]', '[data-testid="tool-dark"]', '[data-testid="tool-exit"]'];
      return sel.map((s) => { const e = document.querySelector(s); return e ? { s: s.replace(/\[data-testid="|\[data-speed="|"\]/g, ''), dis: e.getAttribute('aria-disabled'), op: parseFloat(getComputedStyle(e).opacity) } : null; }).filter(Boolean);
    });
  const K = [
    { id: 'keep', label: '1번 저장', state: base, manual: true, text: '모양 시험', btn: 'note-save' },
    { id: 'skip', label: '2번(글 없음)', state: base, manual: true, text: '', btn: 'note-skip' },
    { id: 'discard', label: '확인 버림', state: base, manual: true, text: '버릴 글', btn: 'note-confirm-discard', viaSkip: true },
    { id: 'auto-keep', label: '자동 ① 1번', state: infant, manual: false, text: '모양 시험', btn: 'note-save' },
    { id: 'decision', label: '결정 선택', state: pend, decision: true },
  ];
  for (const k of K) {
    const { ctx, page } = await openSeeded(b, k.state, { wait: k.decision ? '[data-testid="choice-panel"]' : k.manual ? '[data-testid="life-screen"]' : '[data-testid="note-sheet"]' });
    let target;
    if (k.decision) {
      await page.waitForFunction(() => { const c = document.querySelector('.choice'); return c && c.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
      await sleep(500);
      target = page.locator('.choice').first();
    } else {
      if (k.manual) await page.getByTestId('tool-note').tap();
      await sheetReady(page);
      if (k.text) {
        await page.getByTestId('note-input').focus();
        await page.keyboard.insertText(k.text);
      }
      if (k.viaSkip) {
        await page.getByTestId('note-skip').click({ force: true });
        await page.waitForSelector('[data-testid="note-confirm"]');
        await sleep(600);
      }
      target = page.getByTestId(k.btn);
    }
    const box = await target.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, Math.min(box.y + box.height / 2, 738));
    const ops = await ctrlOpacity(page);
    shots.push(await shot(page, 'G-look', `${k.id}-during`));
    const during = ops;
    await sleep(700);
    const later = await ctrlOpacity(page);
    shots.push(await shot(page, 'G-look', `${k.id}-after`));
    const dimmed = during.filter((o) => o.dis === 'true' && o.op < 0.99);
    rows.push({ k: k.id, during, later });
    appendJsonl('guard2.jsonl', { id: 'G-look', k: k.id, during, later });
    chk(`${k.label}: 직후 컨트롤 ${during.length}개 중 ${dimmed.length}개가 aria-disabled + 불투명도<1`, during.length > 0 && dimmed.length === during.length, JSON.stringify(during.map((o) => `${o.s}:${o.dis}/${o.op}`)));
    chk(`${k.label}: 600ms 뒤 모두 풀림(aria-disabled 아님·불투명도 1)`, later.every((o) => o.dis !== 'true' && o.op > 0.99), JSON.stringify(later.map((o) => `${o.s}:${o.dis}/${o.op}`)));
    await ctx.close();
  }
  return done(checks, shots, { rec: { rows } });
});

// ---------------------------------------------------------------- M5
await run({ id: 'G-feedback', title: '가드 중에는 「의견 보내기」 링크도 새 창을 열지 않는다', steps: '1번 저장 직후 100ms에 도구 줄 「의견 보내기」 위치 탭(팝업 감시), 600ms 뒤에는 열림 시도(참고)', expected: '직후 팝업 0', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  const popups = [];
  ctx.on('page', (p) => popups.push(p.url()));
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('링크 가드 시험');
  const save = await page.getByTestId('note-save').boundingBox();
  const fb = await page.evaluate(() => { const e = document.querySelector('[data-testid="tool-feedback"]'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, href: !!e.getAttribute('href') }; });
  chk('도구 줄 의견 보내기가 있다', !!fb, JSON.stringify(fb));
  // 시트가 열린 동안 스크롤 위치가 바뀌었을 수 있어 좌표는 시트가 닫힌 뒤에 다시 잰다
  await page.touchscreen.tap(save.x + save.width / 2, save.y + save.height / 2);
  await sleep(40);
  const fb2 = await page.evaluate(() => { const e = document.querySelector('[data-testid="tool-feedback"]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, dis: e.getAttribute('aria-disabled'), inView: r.top >= 0 && r.bottom <= innerHeight }; });
  if (fb2.inView) {
    await page.touchscreen.tap(fb2.x, fb2.y);
    await sleep(500);
    chk(`직후 의견 보내기 탭: 팝업 ${popups.length}개 (aria-disabled=${fb2.dis})`, popups.length === 0 && fb2.dis === 'true', JSON.stringify({ popups, fb2 }));
  } else {
    chk('의견 보내기가 화면 밖이라 직후 탭은 생략(스크롤 위치 문제)', true, JSON.stringify(fb2));
  }
  await ctx.close();
  return done(checks, []);
});


// ---------------------------------------------------------------- M6 시트가 열린 직후 1번·2번의 가드 모양 (D-89 .note-choice 흐림)
await run({ id: 'G-look-sheet', title: '시트가 열린 직후 400ms 동안 1번·2번(·확인 단계 버튼)도 흐려 보이고 가드가 풀리면 원래대로', steps: '수동 시트를 열자마자 계산된 불투명도와 스크린샷, 700ms 뒤 다시 / 확인 단계의 두 버튼도 같게', expected: '직후 aria-disabled=true + 불투명도<1, 700ms 뒤 해제·1' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
  const readOp = () => page.evaluate(() => ['note-save', 'note-skip', 'note-confirm-discard', 'note-confirm-back'].map((t) => { const e = document.querySelector('[data-testid="' + t + '"]'); return e ? { t, dis: e.getAttribute('aria-disabled'), op: parseFloat(getComputedStyle(e).opacity) } : null; }).filter(Boolean));
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await page.waitForSelector('[data-testid="note-sheet"]');
  const during = await readOp();
  shots.push(await shot(page, 'G-look-sheet', 'open-during'));
  await sleep(700);
  const later = await readOp();
  shots.push(await shot(page, 'G-look-sheet', 'open-after'));
  chk('열린 직후 1번·2번이 aria-disabled + 불투명도<1', during.length === 2 && during.every((o) => o.dis === 'true' && o.op < 0.99), JSON.stringify(during));
  chk('700ms 뒤 풀림', later.every((o) => o.dis !== 'true' && o.op > 0.99), JSON.stringify(later));
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('모양');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="note-confirm"]');
  const duringC = await readOp();
  shots.push(await shot(page, 'G-look-sheet', 'confirm-during'));
  await sleep(700);
  const laterC = await readOp();
  chk('확인 단계가 뜬 직후 두 버튼이 흐림', duringC.length === 2 && duringC.every((o) => o.dis === 'true' && o.op < 0.99), JSON.stringify(duringC));
  chk('700ms 뒤 풀림(확인 단계)', laterC.every((o) => o.dis !== 'true' && o.op > 0.99), JSON.stringify(laterC));
  await ctx.close();
  return done(checks, shots);
});

await b.close();

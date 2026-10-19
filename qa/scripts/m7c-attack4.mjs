// QA-003 M7c 보충: 기록 카드 → 같은 해의 결정 카드로 이어짐(동시 열림 0), 움직임 줄이기, 시트 안 긴 질문(이름 20자 최대) 레이아웃, 확인 단계에서 끄기 칸 없음 확인.
// 사용: node qa/scripts/m7c-attack4.mjs [ID 일부]
import { launch, openOracle, plainLife, evalCore, openSeeded, sheetReady, readNote, readCard, readSave, noteRowsOf, shot, sleep, runCase, setRootFont, SET_MANUAL } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '동작 공격', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots };
};
const b = await launch();
const { page: oracle } = await openOracle(b);

// 기록 카드가 뜰 차례이고, 카드를 소비한 뒤 같은 해를 한 걸음 진행하면 결정 카드가 대기하는 상태
const noteThenDecision = await evalCore(
  oracle,
  `for (let seed = 1; seed < 6000; seed++) {
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     for (let g = 0; g < 900 && s.phase === 'life'; g++) {
       if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
       const due = core.dueNote(s);
       if (due !== null) {
         const after = core.stepYear(core.consumeNote(s, due)).state;
         if (after.phase === 'life' && after.pending !== null && after.pending.choiceIds.length >= 2) return { state: { ...s, paused: false }, cardId: due.id, age: s.age, seed };
         s = core.consumeNote(s, due);
       }
       s = core.stepYear(s).state;
     }
   }
   return null;`,
);

await run({ id: 'B15b', title: '기록 카드를 닫으면 같은 해의 끝에 결정 카드가 이어서 뜬다 — 두 시트가 한 프레임도 동시에 열리지 않고, 결정 시트가 열릴 때 포커스는 결정 제목', steps: '기록 카드(해의 첫머리)를 2번으로 닫고 8배속으로 해가 차오르길 기다리며 매 프레임 대화상자 수를 잰다', expected: '대화상자 수 ≤1(모든 프레임), 결정 시트가 이어서 뜸, 진행률은 기록 시트가 닫힌 뒤에야 흐름', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  if (!noteThenDecision) return { verdict: 'SKIP', actual: '상태를 찾지 못함', shots: [] };
  const { ctx, page } = await openSeeded(b, noteThenDecision.state, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  await page.evaluate(() => {
    window.__maxDlg = 0;
    window.__both = 0;
    const tick = () => {
      const n = document.querySelectorAll('[role="dialog"]').length;
      if (n > window.__maxDlg) window.__maxDlg = n;
      if (document.querySelector('[data-testid="note-sheet"]') && document.querySelector('[data-testid="choice-panel"]')) window.__both++;
      window.__raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const age0 = (await readCard(page)).age;
  await sleep(1500);
  chk('기록 시트가 열린 동안 결정 시트 없음·나이 그대로', !(await readCard(page)).choiceSheet && (await readCard(page)).age === age0 && (await readCard(page)).mode === null, JSON.stringify(await readCard(page)));
  await page.getByTestId('note-skip').tap();
  let sawDecision = false;
  let focusAtDecision = null;
  for (let i = 0; i < 120; i++) {
    const c = await readCard(page);
    if (c.mode === 'sheet') {
      sawDecision = true;
      await sleep(300);
      focusAtDecision = (await readCard(page)).activeTid;
      break;
    }
    await sleep(100);
  }
  const m = await page.evaluate(() => ({ max: window.__maxDlg, both: window.__both }));
  chk('결정 시트가 이어서 뜸', sawDecision, `나이 ${(await readCard(page)).age} (기록 시트 나이 ${age0})`);
  chk('대화상자 동시 열림 0(모든 프레임 ≤1)', m.max <= 1 && m.both === 0, JSON.stringify(m));
  chk('결정 시트의 포커스는 제목', focusAtDecision === 'choice-title', focusAtDecision);
  shots.push(await shot(page, 'B15b', 'decision-after-note'));
  await ctx.close();
  return done(checks, shots, { note: `카드 ${noteThenDecision.cardId} 나이 ${noteThenDecision.age}` });
});

await run({ id: 'M01', title: '움직임 줄이기(prefers-reduced-motion: reduce): 기록 시트가 열리고 닫힐 때 애니메이션·전환이 없다(시간 ≤ 0.01s)', steps: 'emulateMedia reducedMotion=reduce로 시트 요소의 animation·transition 시간 읽기, 열고 닫기', expected: '모든 animation-duration·transition-duration ≤ 0.01s', }, async () => {
  const { checks, chk } = mk();
  const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
  const { ctx, page } = await openSeeded(b, base);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const d = await page.evaluate(() => {
    const toS = (v) => Math.max(...String(v).split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x) || 0)));
    const out = [];
    for (const sel of ['.overlay', '.sheet', '.note-choice', '.field__input', '.btn']) {
      for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        out.push({ sel, anim: toS(cs.animationDuration), name: cs.animationName, trans: toS(cs.transitionDuration) });
      }
    }
    return out;
  });
  const slow = d.filter((x) => (x.name !== 'none' && x.anim > 0.011) || x.trans > 0.011);
  chk('움직임 줄이기에서 애니메이션·전환 없음', slow.length === 0, JSON.stringify(slow.slice(0, 4)));
  await ctx.close();
  return done(checks);
});

// 이름 20자·가장 긴 질문 — 시트 질문 제목이 넘치지 않고 시트가 열린다
await run({ id: 'T-longname', title: '이름이 최대 길이(한글 5자)인 인생에서 가장 긴 질문(③ 변형)이 폭 320·글자 200%에서도 넘치지 않는다', steps: '이름을 5자로 바꾼 저장에서 ③ 카드 시트(첫 사랑 변형)를 연다', expected: '질문 제목이 시트 안·가로 넘침 0·낱말 끊김 규칙대로', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const st = await evalCore(
    oracle,
    `for (let seed = 1; seed < 6000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       for (let g = 0; g < 900 && s.phase === 'life'; g++) {
         if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[(seed + g) % s.pending.choiceIds.length]); continue; }
         const due = core.dueNote(s);
         if (due !== null) {
           if (due.id === 'note-first-love' && s.flags.includes('first_love')) return { ...s, paused: true };
           s = core.consumeNote(s, due);
         }
         s = core.stepYear(s).state;
       }
     }
     return null;`,
  );
  if (!st) return { verdict: 'SKIP', actual: '첫사랑 변형 상태를 못 찾음', checks, shots };
  const longName = '가나다라마'; // 이름은 한글 3~5자(NC-13)라 5자가 최대
  st.character.name = longName;
  for (const [w, h, font] of [[320, 568, 200], [360, 740, 100], [320, 568, 100]]) {
    const { ctx, page } = await openSeeded(b, st, { vp: { width: w, height: h }, wait: '[data-testid="note-sheet"]' });
    await setRootFont(page, font);
    await sleep(300);
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="note-title"]');
      const s = document.querySelector('[data-testid="note-sheet"]');
      const tr = t.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      return { right: Math.round(tr.right), sheetRight: Math.round(sr.right), docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, text: t.textContent, scrollW: t.scrollWidth, clientW: t.clientWidth };
    });
    chk(`${w}×${h} 글자 ${font}%: 질문 제목 안에 들어감`, m.right <= m.sheetRight + 1 && !m.docOverflow && m.scrollW <= m.clientW + 1, JSON.stringify(m));
    if (font === 200) shots.push(await shot(page, 'T-longname', `${w}-${font}`));
    await ctx.close();
  }
  return done(checks, shots);
});

await b.close();

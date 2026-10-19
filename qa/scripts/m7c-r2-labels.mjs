// QA-003 M7c 2회차 라벨 확인 (D5, CQ06): ③ 「첫사랑」 · ④ 「마음을 나누는 일」 라벨이 화면에서(저장 직후 인생 기록, 엔딩 연표) 맞게 붙는가,
// 기본 변형으로 쓴 글에도 같은 라벨, 옛 라벨(「첫사랑의 추억」「연애의 기억」) 0. 엔딩 연표는 오라클(core)로 만든 엔딩 직전 저장을 prod에 심어 연다.
// 사용: node qa/scripts/m7c-r2-labels.mjs
import { launch, openOracle, plainLife, dueStateFor, evalCore, openSeeded, sheetReady, readNote, readLog, readSave, noteRowsOf, shot, sleep, runCase, SET_MANUAL } from './m7c-r2-lib.mjs';

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

const CASES = [
  { id: 'L-first-love-default', card: 'note-first-love', forbid: 'first_love', req: null, label: '첫사랑', note: '③ 기본 변형' },
  { id: 'L-first-love-variant', card: 'note-first-love', forbid: null, req: 'first_love', label: '첫사랑', note: '③ first_love 변형' },
  { id: 'L-romance-default', card: 'note-youth-romance', forbid: 'has_partner', req: null, label: '마음을 나누는 일', note: '④ 기본 변형' },
  { id: 'L-romance-partner', card: 'note-youth-romance', forbid: null, req: 'has_partner', label: '마음을 나누는 일', note: '④ 교제 중 변형' },
];
for (const C of CASES) {
  await runCase({ id: C.id, cat: '콘텐츠(2회차)', title: `${C.note}로 쓴 글에 붙는 라벨 — 저장 직후 인생 기록의 「나의 기록 · ${C.label}」`, steps: '해당 카드가 뜬 판에서 글을 써 1번 → 인생 기록 줄의 라벨 읽기 → 새로고침 뒤에도 같음', expected: `나의 기록 · ${C.label}` }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const st = await dueStateFor(oracle, C.card, { era: 'present', requireFlag: C.req, forbidFlag: C.forbid, paused: true, to: 8000 });
    if (!st) return { verdict: 'SKIP', actual: '해당 변형 상태를 못 찾음', shots: [] };
    const { ctx, page } = await openSeeded(b, st, { wait: '[data-testid="note-sheet"]' });
    await sheetReady(page);
    const n = await readNote(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText('라벨 확인용 글');
    await page.getByTestId('note-save').tap();
    await sleep(700);
    let rows = (await readLog(page)).filter((r) => r.isNote);
    chk(`저장 직후 라벨 「${rows.length ? rows[rows.length - 1].label : '없음'}」`, rows.length === 1 && rows[0].label === `나의 기록 · ${C.label}`, JSON.stringify(rows.map((r) => r.label)));
    chk('저장된 title(옛 라벨 아님)', noteRowsOf(await readSave(page))[0].title === C.label, JSON.stringify(noteRowsOf(await readSave(page))));
    shots.push(await shot(page, C.id, 'log'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    await sleep(400);
    rows = (await readLog(page)).filter((r) => r.isNote);
    chk('새로고침 뒤에도 같은 라벨', rows.length === 1 && rows[0].label === `나의 기록 · ${C.label}`, JSON.stringify(rows.map((r) => r.label)));
    await ctx.close();
    return done(checks, shots, { note: `질문 「${n.title}」` });
  });
}

// 엔딩 연표: 오라클로 7장 모두에 글을 쓰며 끝까지 진행한 엔딩 상태를 prod에 심어 연다
await runCase({ id: 'L-ending', cat: '콘텐츠(2회차)', title: '엔딩 연표의 「나의 기록 · {라벨}」 — 7종 + 수동 모두 새 라벨로 표시(③ 첫사랑 · ④ 마음을 나누는 일)', steps: '오라클 core로 자동 카드마다 writeNote하며 끝까지 진행한 엔딩 저장을 prod에 심어 엔딩 화면을 연다', expected: '연표의 나의 기록 줄 라벨이 ["영유아기 기억","또래와 나","첫사랑","마음을 나누는 일","아팠던 시간","부모님의 나이듦","중년의 인생" 중 해당] + 수동 「지금의 생각」, 옛 라벨 0, 가로 넘침 0' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const ended = await evalCore(
    oracle,
    `for (let seed = 1; seed < 400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       const kinds = new Set();
       let n = 0;
       for (let g = 0; g < 1500 && s.phase === 'life'; g++) {
         if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
         const due = core.dueNote(s);
         if (due !== null) { s = core.writeNote(s, { cardId: due.id, text: '시험 기록 ' + due.id.replace('note-', '') }); kinds.add(due.id); }
         if (s.age % 17 === 3 && n < 3) { const t = core.writeNote(s, { cardId: null, text: '수동 기록 ' + s.age }); if (t !== s) { s = t; n++; } }
         s = core.stepYear(s).state;
       }
       if (s.phase !== 'life' && kinds.has('note-first-love') && kinds.has('note-youth-romance')) return { state: s, kinds: [...kinds], seed };
     }
     return null;`,
  );
  if (!ended) return { verdict: 'SKIP', actual: '③④가 모두 있는 엔딩 상태를 못 찾음', shots: [] };
  const { ctx, page } = await openSeeded(b, ended.state, { wait: '[data-testid="ending-screen"]' });
  await sleep(500);
  const labels = await page.evaluate(() => [...document.querySelectorAll('[data-testid="note-label"]')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const stale = labels.filter((l) => /첫사랑의 추억|연애의 기억|연애담/.test(l));
  const want = new Set(['나의 기록 · 영유아기 기억', '나의 기록 · 또래와 나', '나의 기록 · 첫사랑', '나의 기록 · 마음을 나누는 일', '나의 기록 · 아팠던 시간', '나의 기록 · 부모님의 나이듦', '나의 기록 · 중년의 인생', '나의 기록 · 지금의 생각']);
  chk(`연표의 나의 기록 줄 ${labels.length}개 라벨 모두 기대 집합 안`, labels.length >= 5 && labels.every((l) => want.has(l)), JSON.stringify(labels));
  chk('③ 「첫사랑」·④ 「마음을 나누는 일」 줄이 있음', labels.includes('나의 기록 · 첫사랑') && labels.includes('나의 기록 · 마음을 나누는 일'), JSON.stringify(labels));
  chk('옛 라벨 0', stale.length === 0, JSON.stringify(stale));
  chk('가로 넘침 0', !over, over);
  const row = page.locator('[data-testid="note-label"]').filter({ hasText: '마음을 나누는 일' }).first();
  await row.scrollIntoViewIfNeeded().catch(() => {});
  shots.push(await shot(page, 'L-ending', 'timeline-row'));
  await ctx.close();
  return done(checks, shots, { note: `시드 ${ended.seed}, 카드 ${ended.kinds.length}종` });
});
await b.close();

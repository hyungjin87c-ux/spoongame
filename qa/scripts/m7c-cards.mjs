// QA-003 M7c 콘텐츠 판독용 화면 수집: 질문 7종·변형 전부가 실제 화면(360×740 터치)에 뜬 모습을 스크린샷으로 남기고, 화면의 질문·인용·안내·버튼 문구와 그 시점의 전제(플래그·부모 나이·건강·본 이벤트)를 표로 저장한다.
// 사용: node qa/scripts/m7c-cards.mjs   결과: qa/results/m7c/cards.json + qa/screenshots/003/M7c-Q-<카드>-<변형>.png
import { launch, openOracle, plainLife, evalCore, openSeeded, sheetReady, readNote, shot, sleep, writeJson, addCase } from './m7c-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);

const VARIANTS = [
  { id: 'Q1', card: 'note-infant-memory', variant: 'default', pred: 'true', era: 'present' },
  { id: 'Q1p', card: 'note-infant-memory', variant: 'past', pred: 'true', era: 'past' },
  { id: 'Q1f', card: 'note-infant-memory', variant: 'future', pred: 'true', era: 'future' },
  { id: 'Q2', card: 'note-teen-envy', variant: 'default', pred: 'true', era: 'present' },
  { id: 'Q3a', card: 'note-first-love', variant: 'first_love', pred: "has('first_love')", era: 'present' },
  { id: 'Q3b', card: 'note-first-love', variant: 'default', pred: "!has('first_love')", era: 'present' },
  { id: 'Q4a', card: 'note-youth-romance', variant: 'broke_up', pred: "has('broke_up') && !has('has_partner') && !has('married')", era: 'present' },
  { id: 'Q4b', card: 'note-youth-romance', variant: 'partner', pred: "has('has_partner') || has('married')", era: 'present' },
  { id: 'Q4c', card: 'note-youth-romance', variant: 'default', pred: "!has('broke_up') && !has('has_partner') && !has('married')", era: 'present' },
  { id: 'Q5a', card: 'note-illness', variant: 'event', pred: "s.seen['middle-health-crisis'] !== undefined || s.seen['senior-illness'] !== undefined", era: 'present' },
  { id: 'Q5b', card: 'note-illness', variant: 'lowhealth', pred: "s.seen['middle-health-crisis'] === undefined && s.seen['senior-illness'] === undefined && s.stats.health <= 35", era: 'present' },
  { id: 'Q6', card: 'note-parents-aging', variant: 'default', pred: "!has('parents_gone')", era: 'present' },
  { id: 'Q7', card: 'note-midlife', variant: 'default', pred: 'true', era: 'present' },
];

const out = [];
for (const V of VARIANTS) {
  let st = null;
  for (const era of [V.era]) {
    st = await evalCore(
      oracle,
      `const pred = new Function('s', 'has', 'return ' + arg.pred);
       for (let seed = 1; seed < 6000; seed++) {
         let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
         for (let g = 0; g < 900 && s.phase === 'life'; g++) {
           if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[(seed + g) % s.pending.choiceIds.length]); continue; }
           const due = core.dueNote(s);
           if (due !== null) {
             if (due.id === arg.card && pred(s, (f) => s.flags.includes(f))) return { ...s, paused: true };
             s = core.consumeNote(s, due);
           }
           s = core.stepYear(s).state;
         }
       }
       return null;`,
      { card: V.card, pred: V.pred, era },
    );
  }
  if (!st) {
    out.push({ ...V, found: false });
    console.log(V.id, '상태를 찾지 못함');
    continue;
  }
  const { ctx, page } = await openSeeded(b, st, { wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  await sleep(300);
  const n = await readNote(page);
  const shotPath = await shot(page, `Q-${V.card.replace('note-', '')}-${V.variant}`, '');
  out.push({
    ...V,
    found: true,
    age: st.age,
    era: st.era,
    flags: st.flags,
    stats: st.stats,
    parents: { mother: st.birthReport.mother.age, father: st.birthReport.father.age },
    seenIllness: ['middle-health-crisis', 'senior-illness', 'senior-illness-later'].filter((k) => st.seen[k] !== undefined),
    onScreen: { card: n.card, kind: n.kind, title: n.title, when: n.when, cite: n.cite, hint: n.hint, keep: n.saveName, skip: n.skipName, toggle: n.toggle, dialogName: n.dialogName },
    shot: shotPath,
  });
  console.log(V.id, `나이 ${st.age}`, n.title);
  await ctx.close();
}
// 수동 질문
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
{
  const { ctx, page } = await openSeeded(b, base);
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const n = await readNote(page);
  out.push({ id: 'QM', card: 'manual', variant: 'manual', found: true, onScreen: { title: n.title, kind: n.kind, hint: n.hint }, shot: await shot(page, 'Q-manual', '') });
  console.log('QM', n.title);
  await ctx.close();
}
writeJson('cards.json', out);
await b.close();
